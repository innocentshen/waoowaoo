import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'chatcmpl_1',
    object: 'chat.completion',
    created: 1,
    model: 'gpt-5.4',
    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })),
)

const createOpenAICompatClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  })),
)

const resolveOpenAICompatClientConfigMock = vi.hoisted(() =>
  vi.fn(async () => ({
    providerId: 'openai-compatible:node-1',
    baseUrl: 'https://compat.example.com/v1',
    apiKey: 'sk-test',
  })),
)

function createAsyncIterable<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield value
      }
    },
  }
}

vi.mock('@/lib/model-gateway/openai-compat/common', () => ({
  createOpenAICompatClient: createOpenAICompatClientMock,
  resolveOpenAICompatClientConfig: resolveOpenAICompatClientConfigMock,
}))

import { runOpenAICompatChatCompletion, runOpenAICompatChatCompletionStream } from '@/lib/model-gateway/openai-compat/chat'

describe('model-gateway openai-compat chat executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends GPT-5.4 reasoning_effort and omits temperature', async () => {
    await runOpenAICompatChatCompletion({
      userId: 'user-1',
      providerId: 'openai-compatible:node-1',
      modelId: 'gpt-5.4',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      reasoning: true,
      reasoningEffort: 'xhigh',
    })

    const request = createMock.mock.calls.at(0)?.at(0) as Record<string, unknown> | undefined
    expect(request?.reasoning_effort).toBe('xhigh')
    expect(request).not.toHaveProperty('temperature')
  })

  it('keeps temperature for non-reasoning models', async () => {
    await runOpenAICompatChatCompletion({
      userId: 'user-1',
      providerId: 'openai-compatible:node-1',
      modelId: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      reasoning: true,
      reasoningEffort: 'high',
    })

    const request = createMock.mock.calls.at(0)?.at(0) as Record<string, unknown> | undefined
    expect(request?.temperature).toBe(0.2)
    expect(request).not.toHaveProperty('reasoning_effort')
  })

  it('streams chat-completions deltas from the upstream provider', async () => {
    const finalCompletion = {
      id: 'chatcmpl_stream_final',
      object: 'chat.completion',
      created: 1,
      model: 'gpt-4.1-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    }
    const finalChatCompletion = vi.fn(async () => finalCompletion)
    createMock.mockResolvedValueOnce(({
      ...createAsyncIterable([
        { choices: [{ delta: { content: 'he' } }] },
        { choices: [{ delta: { content: 'llo' } }] },
      ]),
      finalChatCompletion,
    }) as never)

    const onStage = vi.fn()
    const onChunk = vi.fn()
    const onComplete = vi.fn()
    const completion = await runOpenAICompatChatCompletionStream(
      {
        userId: 'user-1',
        providerId: 'openai-compatible:node-1',
        modelId: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.2,
      },
      { onStage, onChunk, onComplete },
    )

    const request = createMock.mock.calls.at(0)?.at(0) as Record<string, unknown> | undefined
    expect(request?.stream).toBe(true)
    expect(onChunk).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'text', delta: 'he', seq: 1 }))
    expect(onChunk).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'text', delta: 'llo', seq: 2 }))
    expect(onStage).toHaveBeenNthCalledWith(1, expect.objectContaining({ stage: 'streaming' }))
    expect(onStage).toHaveBeenNthCalledWith(2, expect.objectContaining({ stage: 'completed' }))
    expect(onComplete).toHaveBeenCalledWith('hello', undefined)
    expect(finalChatCompletion).toHaveBeenCalledTimes(1)
    expect(completion).toEqual(finalCompletion)
  })
})
