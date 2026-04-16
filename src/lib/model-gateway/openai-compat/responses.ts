import type { ChatCompletionStreamCallbacks } from '@/lib/llm/types'
import { buildOpenAIChatCompletion } from '@/lib/llm/providers/openai-compat'
import { buildReasoningAwareContent, extractStreamDeltaParts, mapOpenAICompatReasoningEffort } from '@/lib/llm/utils'
import { isLikelyOpenAIReasoningModel } from '@/lib/llm/reasoning-capability'
import { emitStreamChunk, emitStreamStage, resolveStreamStepMeta } from '@/lib/llm/stream-helpers'
import { withStreamChunkTimeout } from '@/lib/llm/stream-timeout'
import type { InternalLLMStreamStepMeta } from '@/lib/llm-observe/internal-stream-context'
import type { OpenAICompatChatRequest } from '../types'
import { createOpenAICompatClient, resolveOpenAICompatClientConfig } from './common'

type ResponsesUsage = {
  promptTokens: number
  completionTokens: number
}

type ErrorWithStatus = Error & { status?: number }

type OpenAICompatResponsesStream = AsyncIterable<unknown> & {
  finalResponse?: () => Promise<unknown>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function buildResponsesBody(input: OpenAICompatChatRequest): Record<string, unknown> {
  const useReasoningControls = input.reasoning !== false && isLikelyOpenAIReasoningModel(input.modelId)
  const body: Record<string, unknown> = {
    model: input.modelId,
    input: input.messages.map((message) => ({
      role: message.role,
      content: [{ type: 'input_text', text: message.content }],
    })),
  }
  if (useReasoningControls) {
    body.reasoning = {
      effort: mapOpenAICompatReasoningEffort(input.reasoningEffort),
    }
  } else {
    body.temperature = input.temperature
  }
  return body
}

function readResponsesFailureMessage(payload: unknown): string {
  const root = asRecord(payload)
  const error = asRecord(root?.error)
  if (error && typeof error.message === 'string' && error.message.trim()) {
    return `OPENAI_COMPAT_RESPONSES_FAILED: ${error.message.trim()}`
  }
  if (typeof root?.status === 'string' && root.status.trim()) {
    return `OPENAI_COMPAT_RESPONSES_FAILED: status=${root.status.trim()}`
  }
  return 'OPENAI_COMPAT_RESPONSES_FAILED'
}

function collectText(node: unknown, acc: string[]) {
  if (typeof node === 'string') {
    acc.push(node)
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectText(item, acc))
    return
  }
  const record = asRecord(node)
  if (!record) return

  const type = typeof record.type === 'string' ? record.type : ''
  if (type.includes('reasoning')) return
  if (typeof record.output_text === 'string') acc.push(record.output_text)
  if (typeof record.text === 'string') acc.push(record.text)
  if (typeof record.content === 'string') acc.push(record.content)
  if (record.content !== undefined && typeof record.content !== 'string') collectText(record.content, acc)
  if (record.output !== undefined) collectText(record.output, acc)
}

function collectReasoning(node: unknown, acc: string[]) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectReasoning(item, acc))
    return
  }
  const record = asRecord(node)
  if (!record) return

  const type = typeof record.type === 'string' ? record.type : ''
  if (type.includes('reasoning')) {
    if (typeof record.text === 'string') acc.push(record.text)
    if (typeof record.content === 'string') acc.push(record.content)
    if (record.content !== undefined && typeof record.content !== 'string') {
      collectReasoning(record.content, acc)
    }
  }

  if (record.reasoning !== undefined) collectReasoning(record.reasoning, acc)
  if (record.reasoning_content !== undefined) collectReasoning(record.reasoning_content, acc)
  if (record.output !== undefined) collectReasoning(record.output, acc)
}

function extractResponsesText(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''
  if (typeof root.output_text === 'string') return root.output_text

  const parts: string[] = []
  collectText(root.output ?? root, parts)
  return parts.join('')
}

function extractResponsesReasoning(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''

  const parts: string[] = []
  collectReasoning(root.output ?? root, parts)
  return parts.join('')
}

function extractResponsesUsage(payload: unknown): ResponsesUsage {
  const usage = asRecord(asRecord(payload)?.usage) || {}
  const promptTokens = typeof usage.input_tokens === 'number'
    ? usage.input_tokens
    : (typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0)
  const completionTokens = typeof usage.output_tokens === 'number'
    ? usage.output_tokens
    : (typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0)
  return {
    promptTokens,
    completionTokens,
  }
}

export async function runOpenAICompatResponsesCompletion(input: OpenAICompatChatRequest) {
  const config = await resolveOpenAICompatClientConfig(input.userId, input.providerId)
  const endpoint = toEndpoint(config.baseUrl, '/responses')
  const body = buildResponsesBody(input)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    const error = new Error(
      `OPENAI_COMPAT_RESPONSES_FAILED: ${response.status} ${errorBody.slice(0, 300)}`,
    ) as ErrorWithStatus
    error.status = response.status
    throw error
  }

  const payload = await response.json() as unknown
  const text = extractResponsesText(payload)
  const reasoning = extractResponsesReasoning(payload)
  const usage = extractResponsesUsage(payload)

  return buildOpenAIChatCompletion(
    input.modelId,
    buildReasoningAwareContent(text, reasoning),
    usage,
  )
}

export async function runOpenAICompatResponsesCompletionStream(
  input: OpenAICompatChatRequest,
  callbacks?: ChatCompletionStreamCallbacks,
  stepMeta?: InternalLLMStreamStepMeta,
) {
  const config = await resolveOpenAICompatClientConfig(input.userId, input.providerId)
  const client = createOpenAICompatClient(config)
  const resolvedStepMeta = stepMeta || resolveStreamStepMeta({})
  const body = buildResponsesBody(input)

  emitStreamStage(callbacks, resolvedStepMeta, 'streaming', 'openai-compat')
  const stream = client.responses.stream(body) as OpenAICompatResponsesStream

  let seq = 1
  let text = ''
  let reasoning = ''

  for await (const event of withStreamChunkTimeout(stream)) {
    const eventRecord = asRecord(event)
    const eventType = typeof eventRecord?.type === 'string' ? eventRecord.type : ''
    if (eventType === 'error') {
      const message = typeof eventRecord?.message === 'string' ? eventRecord.message.trim() : ''
      throw new Error(`OPENAI_COMPAT_RESPONSES_FAILED: ${message || 'unknown stream error'}`)
    }
    if (eventType === 'response.failed') {
      throw new Error(readResponsesFailureMessage(eventRecord?.response ?? event))
    }

    const { textDelta, reasoningDelta } = extractStreamDeltaParts(event)
    if (reasoningDelta) {
      reasoning += reasoningDelta
      emitStreamChunk(callbacks, resolvedStepMeta, {
        kind: 'reasoning',
        delta: reasoningDelta,
        seq,
        lane: 'reasoning',
      })
      seq += 1
    }
    if (textDelta) {
      text += textDelta
      emitStreamChunk(callbacks, resolvedStepMeta, {
        kind: 'text',
        delta: textDelta,
        seq,
        lane: 'main',
      })
      seq += 1
    }
  }

  let finalPayload: unknown = null
  if (typeof stream.finalResponse === 'function') {
    try {
      finalPayload = await stream.finalResponse()
    } catch {
      finalPayload = null
    }
  }

  const finalText = extractResponsesText(finalPayload) || text
  const finalReasoning = extractResponsesReasoning(finalPayload) || reasoning
  const usage = extractResponsesUsage(finalPayload)
  const completion = buildOpenAIChatCompletion(
    input.modelId,
    buildReasoningAwareContent(finalText, finalReasoning),
    usage,
  )

  emitStreamStage(callbacks, resolvedStepMeta, 'completed', 'openai-compat')
  callbacks?.onComplete?.(finalText, resolvedStepMeta)
  return completion
}

