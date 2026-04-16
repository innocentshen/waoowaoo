import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveOpenAICompatClientConfigMock = vi.hoisted(() =>
  vi.fn(async () => ({
    providerId: 'openai-compatible:node-1',
    baseUrl: 'https://compat.example.com/v1',
    apiKey: 'sk-test',
  })),
)

const responsesStreamMock = vi.hoisted(() => vi.fn())
const createOpenAICompatClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    responses: {
      stream: responsesStreamMock,
    },
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

import {
  runOpenAICompatResponsesCompletion,
  runOpenAICompatResponsesCompletionStream,
} from '@/lib/model-gateway/openai-compat/responses'

describe('model-gateway openai-compat responses executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts responses payload to normalized chat completion', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output: [
        { type: 'reasoning', text: 'think-' },
        { type: 'output_text', text: 'hello' },
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 7,
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const completion = await runOpenAICompatResponsesCompletion({
      userId: 'user-1',
      providerId: 'openai-compatible:node-1',
      modelId: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
    })

    expect(completion.choices[0]?.message?.content).toEqual([
      { type: 'reasoning', text: 'think-' },
      { type: 'text', text: 'hello' },
    ])
    expect(completion.usage?.prompt_tokens).toBe(12)
    expect(completion.usage?.completion_tokens).toBe(7)
    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined
    expect(String(firstCall?.[0])).toBe('https://compat.example.com/v1/responses')
  })

  it('sends GPT-5.4 reasoning effort in responses format and omits temperature', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      output_text: 'hello',
      usage: {
        input_tokens: 4,
        output_tokens: 2,
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await runOpenAICompatResponsesCompletion({
      userId: 'user-1',
      providerId: 'openai-compatible:node-1',
      modelId: 'gpt-5.4',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      reasoning: true,
      reasoningEffort: 'xhigh',
    })

    const init = (fetchMock.mock.calls.at(0) as unknown as [string, RequestInit] | undefined)?.[1]
    expect(init).toBeDefined()
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(body.reasoning).toEqual({ effort: 'xhigh' })
    expect(body).not.toHaveProperty('temperature')
  })

  it('throws status-bearing error when responses endpoint fails', async () => {
    const fetchMock = vi.fn(async () => new Response('not supported', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      runOpenAICompatResponsesCompletion({
        userId: 'user-1',
        providerId: 'openai-compatible:node-1',
        modelId: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.2,
      }),
    ).rejects.toThrow('OPENAI_COMPAT_RESPONSES_FAILED: 404')
  })

  it('streams responses deltas from the upstream provider', async () => {
    const finalResponse = {
      output: [
        { type: 'reasoning', text: 'think-' },
        { type: 'output_text', text: 'hello' },
      ],
      usage: {
        input_tokens: 9,
        output_tokens: 4,
      },
    }
    const finalResponseMock = vi.fn(async () => finalResponse)
    responsesStreamMock.mockReturnValueOnce({
      ...createAsyncIterable([
        { type: 'response.reasoning_text.delta', delta: 'think-' },
        { type: 'response.output_text.delta', delta: 'he' },
        { type: 'response.output_text.delta', delta: 'llo' },
      ]),
      finalResponse: finalResponseMock,
    })

    const onStage = vi.fn()
    const onChunk = vi.fn()
    const onComplete = vi.fn()
    const completion = await runOpenAICompatResponsesCompletionStream(
      {
        userId: 'user-1',
        providerId: 'openai-compatible:node-1',
        modelId: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.2,
      },
      { onStage, onChunk, onComplete },
    )

    const request = responsesStreamMock.mock.calls.at(0)?.at(0) as Record<string, unknown> | undefined
    expect(request?.model).toBe('gpt-4.1-mini')
    expect(onChunk).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'reasoning', delta: 'think-', seq: 1 }))
    expect(onChunk).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'text', delta: 'he', seq: 2 }))
    expect(onChunk).toHaveBeenNthCalledWith(3, expect.objectContaining({ kind: 'text', delta: 'llo', seq: 3 }))
    expect(onStage).toHaveBeenNthCalledWith(1, expect.objectContaining({ stage: 'streaming' }))
    expect(onStage).toHaveBeenNthCalledWith(2, expect.objectContaining({ stage: 'completed' }))
    expect(onComplete).toHaveBeenCalledWith('hello', undefined)
    expect(finalResponseMock).toHaveBeenCalledTimes(1)
    expect(completion.choices[0]?.message?.content).toEqual([
      { type: 'reasoning', text: 'think-' },
      { type: 'text', text: 'hello' },
    ])
    expect(completion.usage?.prompt_tokens).toBe(9)
    expect(completion.usage?.completion_tokens).toBe(4)
  })
})
