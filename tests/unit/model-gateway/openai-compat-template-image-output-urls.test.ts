import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveConfigMock = vi.hoisted(() => vi.fn(async () => ({
  providerId: 'openai-compatible:test-provider',
  baseUrl: 'https://compat.example.com/v1',
  apiKey: 'sk-test',
})))

vi.mock('@/lib/model-gateway/openai-compat/common', () => ({
  resolveOpenAICompatClientConfig: resolveConfigMock,
}))

import { generateImageViaOpenAICompatTemplate } from '@/lib/model-gateway/openai-compat/template-image'

describe('openai-compat template image output urls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all image urls when outputUrlsPath contains multiple values', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { url: 'https://cdn.test/1.png' },
        { url: 'https://cdn.test/2.png' },
      ],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-1',
      modelKey: 'openai-compatible:test-provider::gpt-image-1',
      prompt: 'draw a cat',
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'sync',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        response: {
          outputUrlPath: '$.data[0].url',
          outputUrlsPath: '$.data',
        },
      },
    })

    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.test/1.png',
      imageUrls: ['https://cdn.test/1.png', 'https://cdn.test/2.png'],
    })
  })

  it('keeps single-url output compatible when outputUrlsPath has only one image', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [{ url: 'https://cdn.test/only.png' }],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-1',
      modelKey: 'openai-compatible:test-provider::gpt-image-1',
      prompt: 'draw a cat',
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'sync',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        response: {
          outputUrlsPath: '$.data',
        },
      },
    })

    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.test/only.png',
    })
  })

  it('accepts OpenAI-style b64_json image output when no url is returned', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: 'YmFzZTY0LWltYWdl' }],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-2',
      modelKey: 'openai-compatible:test-provider::gpt-image-2',
      prompt: 'draw a cat',
      options: { outputFormat: 'png' },
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'sync',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        response: {
          outputUrlsPath: '$.data',
        },
      },
    })

    expect(result).toEqual({
      success: true,
      imageBase64: 'YmFzZTY0LWltYWdl',
      imageUrl: 'data:image/png;base64,YmFzZTY0LWltYWdl',
    })
  })

  it('accepts common output result url fallback', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      output: [{ result: 'https://cdn.test/output-result.png' }],
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-2',
      modelKey: 'openai-compatible:test-provider::gpt-image-2',
      prompt: 'draw a cat',
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'sync',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        response: {
          outputUrlsPath: '$.data',
        },
      },
    })

    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.test/output-result.png',
    })
  })

  it('accepts nested image url fallback from provider-specific response shapes', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      result: {
        artifacts: [
          { output_url: 'https://cdn.test/provider-specific.webp' },
        ],
      },
    }), { status: 200 })) as unknown as typeof fetch

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-2',
      modelKey: 'openai-compatible:test-provider::gpt-image-2',
      prompt: 'draw a cat',
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'sync',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
          },
        },
        response: {
          outputUrlsPath: '$.data',
        },
      },
    })

    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.test/provider-specific.webp',
    })
  })

  it('returns OCOMPAT async image external id when template mode is async', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      data: [
        {
          status: 'submitted',
          task_id: 'task_img_1',
        },
      ],
    }), { status: 200 })) as unknown as typeof fetch

    const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url')

    const result = await generateImageViaOpenAICompatTemplate({
      userId: 'user-1',
      providerId: 'openai-compatible:test-provider',
      modelId: 'gpt-image-2',
      modelKey: 'openai-compatible:test-provider::gpt-image-2',
      prompt: 'draw a cat',
      options: { size: '1024x1024' },
      profile: 'openai-compatible',
      template: {
        version: 1,
        mediaType: 'image',
        mode: 'async',
        create: {
          method: 'POST',
          path: '/images/generations',
          contentType: 'application/json',
          bodyTemplate: {
            model: '{{model}}',
            prompt: '{{prompt}}',
            n: 1,
            size: '{{size}}',
            response_format: 'url',
          },
        },
        status: {
          method: 'GET',
          path: '/tasks/{{task_id}}',
        },
        response: {
          taskIdPath: '$.data[0].task_id',
          statusPath: '$.data.status',
          outputUrlPath: '$.data.result.images[0].url[0]',
        },
        polling: {
          intervalMs: 3000,
          timeoutMs: 180000,
          doneStates: ['completed', 'succeeded', 'success'],
          failStates: ['failed', 'error', 'canceled', 'cancelled'],
        },
      },
    })

    expect(result).toEqual({
      success: true,
      async: true,
      requestId: 'task_img_1',
      externalId: `OCOMPAT:IMAGE:b64_${encode('openai-compatible:test-provider')}:${encode('gpt-image-2')}:task_img_1`,
    })
  })
})
