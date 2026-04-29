import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  userPreference: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/crypto-utils', () => ({
  decryptApiKey: vi.fn((value: string) => value.replace(/^enc:/, '')),
}))

describe('api-config grok2api template upgrade', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    prismaMock.userPreference.findUnique.mockResolvedValue({
      customProviders: JSON.stringify([
        {
          id: 'openai-compatible:oa-1',
          name: 'OpenAI Compat',
          apiKey: 'enc:test-key',
          baseUrl: 'https://compat.test/v1',
          gatewayRoute: 'openai-compat',
        },
      ]),
      customModels: JSON.stringify([
        {
          modelId: 'grok-imagine-video',
          modelKey: 'openai-compatible:oa-1::grok-imagine-video',
          name: 'Grok Video',
          type: 'video',
          provider: 'openai-compatible:oa-1',
          compatMediaTemplate: {
            version: 1,
            mediaType: 'video',
            mode: 'async',
            create: {
              method: 'POST',
              path: '/videos',
              contentType: 'multipart/form-data',
              multipartFileFields: ['input_reference'],
              bodyTemplate: {
                model: '{{model}}',
                prompt: '{{prompt}}',
                seconds: '{{duration}}',
                size: '{{size}}',
                input_reference: '{{image}}',
              },
            },
            status: {
              method: 'GET',
              path: '/videos/{{task_id}}',
            },
            content: {
              method: 'GET',
              path: '/videos/{{task_id}}/content',
            },
            response: {
              taskIdPath: '$.id',
              statusPath: '$.status',
              errorPath: '$.error.message',
            },
            polling: {
              intervalMs: 3000,
              timeoutMs: 600000,
              doneStates: ['completed', 'succeeded'],
              failStates: ['failed', 'error', 'canceled'],
            },
          },
          compatMediaTemplateCheckedAt: '2026-04-09T00:00:00.000Z',
          compatMediaTemplateSource: 'manual',
        },
      ]),
    })
  })

  it('upgrades stale grok2api video template on read', async () => {
    const apiConfig = await import('@/lib/api-config')

    const selection = await apiConfig.resolveModelSelection(
      'user-1',
      'openai-compatible:oa-1::grok-imagine-video',
      'video',
    )

    expect(selection.compatMediaTemplate).toMatchObject({
      mode: 'async',
      create: {
        path: '/videos',
        bodyTemplate: {
          resolution_name: '{{resolution}}',
          preset: 'normal',
          input_reference: '{{image}}',
        },
      },
      response: {
        taskIdPath: '$.id',
        statusPath: '$.status',
      },
      polling: {
        doneStates: ['completed'],
        failStates: ['failed'],
      },
    })
  })

  it('upgrades stale gpt-image-2 sync template to current b64 image template on read', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValueOnce({
      customProviders: JSON.stringify([
        {
          id: 'openai-compatible:oa-1',
          name: 'OpenAI Compat',
          apiKey: 'enc:test-key',
          baseUrl: 'https://compat.test/v1',
          gatewayRoute: 'openai-compat',
        },
      ]),
      customModels: JSON.stringify([
        {
          modelId: 'gpt-image-2',
          modelKey: 'openai-compatible:oa-1::gpt-image-2',
          name: 'GPT Image 2',
          type: 'image',
          provider: 'openai-compatible:oa-1',
          compatMediaTemplate: {
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
              errorPath: '$.error.message',
            },
          },
        },
      ]),
    })
    const apiConfig = await import('@/lib/api-config')

    const selection = await apiConfig.resolveModelSelection(
      'user-1',
      'openai-compatible:oa-1::gpt-image-2',
      'image',
    )

    expect(selection.compatMediaTemplate).toMatchObject({
      mode: 'sync',
      create: {
        path: '/images/generations',
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          n: 1,
          size: '{{size}}',
          response_format: 'b64_json',
        },
      },
      response: {
        outputUrlPath: '$.data[0].url',
        outputUrlsPath: '$.data',
      },
    })
    expect(selection.compatMediaTemplate).not.toHaveProperty('status')
    expect(selection.compatMediaTemplate).not.toHaveProperty('polling')
  })

  it('upgrades prior gpt-image-2 async image template to current b64 image template on read', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValueOnce({
      customProviders: JSON.stringify([
        {
          id: 'openai-compatible:oa-1',
          name: 'OpenAI Compat',
          apiKey: 'enc:test-key',
          baseUrl: 'https://compat.test/v1',
          gatewayRoute: 'openai-compat',
        },
      ]),
      customModels: JSON.stringify([
        {
          modelId: 'gpt-image-2',
          modelKey: 'openai-compatible:oa-1::gpt-image-2',
          name: 'GPT Image 2',
          type: 'image',
          provider: 'openai-compatible:oa-1',
          compatMediaTemplate: {
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
                size: '{{size}}',
                response_format: 'url',
              },
            },
            status: {
              method: 'GET',
              path: '/images/generations/{{task_id}}',
            },
            response: {
              taskIdPath: '$.id',
              statusPath: '$.status',
              outputUrlPath: '$.result.data[0].url',
              outputUrlsPath: '$.result.data',
              errorPath: '$.error.message',
            },
            polling: {
              intervalMs: 3000,
              timeoutMs: 180000,
              doneStates: ['completed'],
              failStates: ['failed'],
            },
          },
        },
      ]),
    })
    const apiConfig = await import('@/lib/api-config')

    const selection = await apiConfig.resolveModelSelection(
      'user-1',
      'openai-compatible:oa-1::gpt-image-2',
      'image',
    )

    expect(selection.compatMediaTemplate).toMatchObject({
      mode: 'sync',
      create: {
        path: '/images/generations',
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          n: 1,
          size: '{{size}}',
          response_format: 'b64_json',
        },
      },
      response: {
        outputUrlPath: '$.data[0].url',
        outputUrlsPath: '$.data',
      },
    })
    expect(selection.compatMediaTemplate).not.toHaveProperty('status')
    expect(selection.compatMediaTemplate).not.toHaveProperty('polling')
  })

  it('upgrades prior gpt-image-2 task polling template to current b64 image template on read', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValueOnce({
      customProviders: JSON.stringify([
        {
          id: 'openai-compatible:oa-1',
          name: 'OpenAI Compat',
          apiKey: 'enc:test-key',
          baseUrl: 'https://compat.test/v1',
          gatewayRoute: 'openai-compat',
        },
      ]),
      customModels: JSON.stringify([
        {
          modelId: 'gpt-image-2',
          modelKey: 'openai-compatible:oa-1::gpt-image-2',
          name: 'GPT Image 2',
          type: 'image',
          provider: 'openai-compatible:oa-1',
          compatMediaTemplate: {
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
              outputUrlsPath: '$.data.result.images',
              errorPath: '$.data.error.message',
            },
            polling: {
              intervalMs: 3000,
              timeoutMs: 180000,
              doneStates: ['completed', 'succeeded', 'success'],
              failStates: ['failed', 'error', 'canceled', 'cancelled'],
            },
          },
        },
      ]),
    })
    const apiConfig = await import('@/lib/api-config')

    const selection = await apiConfig.resolveModelSelection(
      'user-1',
      'openai-compatible:oa-1::gpt-image-2',
      'image',
    )

    expect(selection.compatMediaTemplate).toMatchObject({
      mode: 'sync',
      create: {
        path: '/images/generations',
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          n: 1,
          size: '{{size}}',
          response_format: 'b64_json',
        },
      },
      response: {
        outputUrlPath: '$.data[0].url',
        outputUrlsPath: '$.data',
      },
    })
    expect(selection.compatMediaTemplate).not.toHaveProperty('status')
    expect(selection.compatMediaTemplate).not.toHaveProperty('polling')
  })
})
