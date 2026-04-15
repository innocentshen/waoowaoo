import { beforeEach, describe, expect, it, vi } from 'vitest'

const googleGenAiConstructorMock = vi.hoisted(() => vi.fn())
const googleGenerateContentMock = vi.hoisted(() => vi.fn(async () => ({ candidates: [] })))
const openAIConstructorMock = vi.hoisted(() => vi.fn())
const openAIState = vi.hoisted(() => ({
  modelList: vi.fn(async () => ({ data: [] })),
  create: vi.fn(async () => ({
    model: 'gpt-4.1-mini',
    choices: [{ message: { content: '2' } }],
  })),
}))

const fetchMock = vi.hoisted(() =>
  vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.includes('/compatible-mode/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'qwen-plus' }] }), { status: 200 })
    }
    if (url.endsWith('/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'Qwen/Qwen3-32B' }] }), { status: 200 })
    }
    if (url.endsWith('/v1/user/info')) {
      return new Response(JSON.stringify({ data: { balance: '9.8000' } }), { status: 200 })
    }
    return new Response('not-found', { status: 404 })
  }),
)

vi.mock('openai', () => ({
  default: class OpenAI {
    constructor(options: unknown) {
      openAIConstructorMock(options)
    }

    models = {
      list: openAIState.modelList,
    }
    chat = {
      completions: {
        create: openAIState.create,
      },
    }
  },
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class GoogleGenAI {
    constructor(options: unknown) {
      googleGenAiConstructorMock(options)
    }

    models = {
      generateContent: googleGenerateContentMock,
    }
  },
}))

import { testLlmConnection } from '@/lib/user-api/llm-test-connection'

describe('llm test connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('tests openai-compatible provider via openai-style endpoint', async () => {
    const result = await testLlmConnection({
      provider: 'openai-compatible',
      apiKey: 'oa-key',
      baseUrl: 'https://compat.example.com/v1',
      model: 'gpt-4.1-mini',
    })

    expect(result.provider).toBe('openai-compatible')
    expect(result.message).toBe('openai-compatible 连接成功')
    expect(result.model).toBe('gpt-4.1-mini')
    expect(result.answer).toBe('2')
    expect(openAIState.create).toHaveBeenCalledWith({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: '1+1等于几？只回答数字' }],
      max_tokens: 10,
      temperature: 0,
    })
  })

  it('requires baseUrl for gemini-compatible provider', async () => {
    await expect(testLlmConnection({
      provider: 'gemini-compatible',
      apiKey: 'gm-key',
    })).rejects.toThrow('自定义渠道需要提供 baseUrl')
  })

  it('tests bailian provider via zero-inference probe', async () => {
    const result = await testLlmConnection({
      provider: 'bailian',
      apiKey: 'bl-key',
    })

    expect(result.provider).toBe('bailian')
    expect(result.message).toBe('bailian 连接成功')
    expect(result.model).toBe('qwen-plus')
  })

  it('tests siliconflow provider via zero-inference probes', async () => {
    const result = await testLlmConnection({
      provider: 'siliconflow',
      apiKey: 'sf-key',
    })

    expect(result.provider).toBe('siliconflow')
    expect(result.message).toBe('siliconflow 连接成功')
    expect(result.model).toBe('Qwen/Qwen3-32B')
    expect(result.answer).toBe('balance=9.8000')
  })

  it('tests grok provider via official xAI endpoint', async () => {
    openAIState.create.mockResolvedValueOnce({
      model: 'grok-4',
      choices: [{ message: { content: '2' } }],
    })

    const result = await testLlmConnection({
      provider: 'grok',
      apiKey: 'grok-key',
      model: 'grok-4',
    })

    expect(result.provider).toBe('grok')
    expect(result.message).toBe('grok 连接成功')
    expect(result.model).toBe('grok-4')
    expect(result.answer).toBe('2')
  })
  it('passes custom google baseUrl into the google sdk probe', async () => {
    const result = await testLlmConnection({
      provider: 'google',
      apiKey: 'google-key',
      baseUrl: 'https://google-proxy.example/',
    })

    expect(result.provider).toBe('google')
    expect(result.message).toBe('google 连接成功')
    expect(googleGenAiConstructorMock).toHaveBeenCalledWith({
      apiKey: 'google-key',
      httpOptions: {
        baseUrl: 'https://google-proxy.example',
      },
    })
    expect(googleGenerateContentMock).toHaveBeenCalledWith({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: '你好' }] }],
    })
  })

  it('uses custom grok baseUrl when provided', async () => {
    openAIState.create.mockResolvedValueOnce({
      model: 'grok-4',
      choices: [{ message: { content: '2' } }],
    })

    const result = await testLlmConnection({
      provider: 'grok',
      apiKey: 'grok-key',
      model: 'grok-4',
      baseUrl: 'https://grok-proxy.example/v1',
    })

    expect(result.provider).toBe('grok')
    expect(result.model).toBe('grok-4')
    expect(result.answer).toBe('2')
    expect(openAIConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://grok-proxy.example/v1',
      apiKey: 'grok-key',
    }))
  })
})
