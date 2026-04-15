import { beforeEach, describe, expect, it, vi } from 'vitest'

const googleGenAiConstructorMock = vi.hoisted(() => vi.fn())
const googleGenerateContentMock = vi.hoisted(() =>
  vi.fn(async () => ({
    candidates: [
      {
        content: {
          parts: [{ text: 'hello from google' }],
        },
      },
    ],
  })),
)

const fetchMock = vi.hoisted(() =>
  vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.includes('api.x.ai/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'grok-4' }] }), { status: 200 })
    }
    if (url.includes('dashscope.aliyuncs.com/compatible-mode/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'qwen-plus' }] }), { status: 200 })
    }
    if (url.includes('api.siliconflow.cn/v1/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'Qwen/Qwen3-32B' }] }), { status: 200 })
    }
    if (url.includes('api.siliconflow.cn/v1/user/info')) {
      return new Response(JSON.stringify({ data: { balance: '12.3000' } }), { status: 200 })
    }
    return new Response('not-found', { status: 404 })
  }),
)

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

import { testProviderConnection } from '@/lib/user-api/provider-test'

describe('provider test connection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('passes bailian probe with models step and credits skip', async () => {
    const result = await testProviderConnection({
      apiType: 'bailian',
      apiKey: 'bl-key',
    })

    expect(result.success).toBe(true)
    expect(result.steps).toEqual([
      {
        name: 'models',
        status: 'pass',
        message: 'Found 1 models',
      },
      {
        name: 'credits',
        status: 'skip',
        message: 'Not supported by Bailian probe API',
      },
    ])
  })

  it('passes siliconflow probe with models and credits steps', async () => {
    const result = await testProviderConnection({
      apiType: 'siliconflow',
      apiKey: 'sf-key',
    })

    expect(result.success).toBe(true)
    expect(result.steps[0]).toEqual({
      name: 'models',
      status: 'pass',
      message: 'Found 1 models',
    })
    expect(result.steps[1]).toEqual({
      name: 'credits',
      status: 'pass',
      message: 'Balance: 12.3000',
    })
  })

  it('passes grok probe with models step', async () => {
    const result = await testProviderConnection({
      apiType: 'grok',
      apiKey: 'grok-key',
    })

    expect(result.success).toBe(true)
    expect(result.steps[0]).toEqual({
      name: 'models',
      status: 'pass',
      message: 'Found 1 models',
    })
  })

  it('uses custom baseUrl for grok probe', async () => {
    fetchMock.mockImplementationOnce(async (input: unknown) => {
      const url = String(input)
      if (url.includes('grok-proxy.example/v1/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'grok-4' }] }), { status: 200 })
      }
      return new Response('not-found', { status: 404 })
    })

    const result = await testProviderConnection({
      apiType: 'grok',
      apiKey: 'grok-key',
      baseUrl: 'https://grok-proxy.example/v1',
    })

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://grok-proxy.example/v1/models'),
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('uses custom baseUrl for google official probe', async () => {
    const result = await testProviderConnection({
      apiType: 'google',
      apiKey: 'google-key',
      baseUrl: 'https://google-proxy.example',
    })

    expect(result.success).toBe(true)
    expect(result.steps[0]).toEqual({
      name: 'textGen',
      status: 'pass',
      model: 'gemini-3-flash-preview',
      message: 'Response: hello from google',
    })
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

  it('classifies auth failures for bailian models probe', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('unauthorized', { status: 401 }))

    const result = await testProviderConnection({
      apiType: 'bailian',
      apiKey: 'bad-key',
    })

    expect(result.success).toBe(false)
    expect(result.steps[0]).toEqual({
      name: 'models',
      status: 'fail',
      message: 'Authentication failed (401)',
      detail: 'unauthorized',
    })
    expect(result.steps[1]).toEqual({
      name: 'credits',
      status: 'skip',
      message: 'Not supported by Bailian probe API',
    })
  })

  it('classifies rate limit failures for siliconflow models probe', async () => {
    fetchMock.mockImplementationOnce(async () => new Response('rate limit', { status: 429 }))

    const result = await testProviderConnection({
      apiType: 'siliconflow',
      apiKey: 'sf-key',
    })

    expect(result.success).toBe(false)
    expect(result.steps[0]).toEqual({
      name: 'models',
      status: 'fail',
      message: 'Rate limited (429)',
      detail: 'rate limit',
    })
    expect(result.steps[1]).toEqual({
      name: 'credits',
      status: 'skip',
      message: 'Skipped because model probe failed',
    })
  })

  it('classifies network failures for siliconflow user info probe', async () => {
    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ data: [{ id: 'Qwen/Qwen3-32B' }] }), { status: 200 }),
    )
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('socket hang up')
    })

    const result = await testProviderConnection({
      apiType: 'siliconflow',
      apiKey: 'sf-key',
    })

    expect(result.success).toBe(false)
    expect(result.steps[0]).toEqual({
      name: 'models',
      status: 'pass',
      message: 'Found 1 models',
    })
    expect(result.steps[1]).toEqual({
      name: 'credits',
      status: 'fail',
      message: 'Network error: socket hang up',
    })
  })
})
