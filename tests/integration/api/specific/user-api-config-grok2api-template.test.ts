import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'
import {
  installAuthMocks,
  mockAuthenticated,
  resetAuthMockState,
} from '../../../helpers/auth'

type UserPreferenceSnapshot = {
  customProviders: string | null
  customModels: string | null
}

const prismaMock = vi.hoisted(() => ({
  userPreference: {
    findUnique: vi.fn<(...args: unknown[]) => Promise<UserPreferenceSnapshot | null>>(),
    upsert: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
}))

const encryptApiKeyMock = vi.hoisted(() => vi.fn((value: string) => `enc:${value}`))
const decryptApiKeyMock = vi.hoisted(() => vi.fn((value: string) => value.replace(/^enc:/, '')))
const getBillingModeMock = vi.hoisted(() => vi.fn(async () => 'OFF'))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/crypto-utils', () => ({
  encryptApiKey: encryptApiKeyMock,
  decryptApiKey: decryptApiKeyMock,
}))

vi.mock('@/lib/billing/mode', () => ({
  getBillingMode: getBillingModeMock,
}))

const routeContext = { params: Promise.resolve({}) }

function readSavedModelsFromUpsert(): Array<Record<string, unknown>> {
  const firstCall = prismaMock.userPreference.upsert.mock.calls[0]
  if (!firstCall) {
    throw new Error('expected prisma.userPreference.upsert to be called at least once')
  }

  const payload = firstCall[0] as { update?: { customModels?: unknown } }
  const rawModels = payload.update?.customModels
  if (typeof rawModels !== 'string') {
    throw new Error('expected update.customModels to be a JSON string')
  }

  const parsed = JSON.parse(rawModels) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('expected update.customModels to parse as an array')
  }
  return parsed as Array<Record<string, unknown>>
}

describe('api specific - user api-config PUT grok2api template backfill', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetAuthMockState()

    prismaMock.userPreference.findUnique.mockResolvedValue({
      customProviders: null,
      customModels: null,
    })
    prismaMock.userPreference.upsert.mockResolvedValue({ id: 'pref-1' })
    getBillingModeMock.mockResolvedValue('OFF')
  })

  it('backfills grok2api image generation template with size placeholder', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'grok-imagine-image',
            modelKey: 'openai-compatible:oa-1::grok-imagine-image',
            name: 'Grok Image',
            type: 'image',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::grok-imagine-image')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      version: 1,
      mediaType: 'image',
      mode: 'sync',
      create: {
        path: '/images/generations',
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          size: '{{size}}',
          response_format: 'url',
        },
      },
      response: {
        outputUrlPath: '$.data[0].url',
      },
    })
  })

  it('backfills gpt-image-2 as sync b64 image template', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'gpt-image-2',
            modelKey: 'openai-compatible:oa-1::gpt-image-2',
            name: 'GPT Image 2',
            type: 'image',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::gpt-image-2')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      version: 1,
      mediaType: 'image',
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
    expect(savedModel?.compatMediaTemplate).not.toHaveProperty('status')
    expect(savedModel?.compatMediaTemplate).not.toHaveProperty('polling')
  })

  it('backfills grok2api image edit template with multipart image field', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'grok-imagine-image-edit',
            modelKey: 'openai-compatible:oa-1::grok-imagine-image-edit',
            name: 'Grok Edit',
            type: 'image',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::grok-imagine-image-edit')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      version: 1,
      mediaType: 'image',
      mode: 'sync',
      create: {
        path: '/images/edits',
        contentType: 'multipart/form-data',
        multipartFileFields: ['image[]'],
        bodyTemplate: {
          'image[]': '{{images}}',
          size: '{{size}}',
          response_format: 'url',
        },
      },
    })
  })

  it('backfills grok2api video template as async multipart request', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'grok-imagine-video',
            modelKey: 'openai-compatible:oa-1::grok-imagine-video',
            name: 'Grok Video',
            type: 'video',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::grok-imagine-video')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      version: 1,
      mediaType: 'video',
      mode: 'async',
      create: {
        path: '/videos',
        contentType: 'multipart/form-data',
        multipartFileFields: ['input_reference'],
        bodyTemplate: {
          model: '{{model}}',
          prompt: '{{prompt}}',
          seconds: '{{duration}}',
          size: '{{size}}',
          resolution_name: '{{resolution}}',
          preset: 'normal',
          input_reference: '{{image}}',
        },
      },
      status: {
        path: '/videos/{{task_id}}',
      },
      content: {
        path: '/videos/{{task_id}}/content',
      },
      response: {
        taskIdPath: '$.id',
        statusPath: '$.status',
      },
      polling: {
        intervalMs: 3000,
        timeoutMs: 600000,
        doneStates: ['completed'],
        failStates: ['failed'],
      },
    })
  })

  it('upgrades stored generic video template for current grok2api model ids', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    prismaMock.userPreference.findUnique.mockResolvedValueOnce({
      customProviders: null,
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
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'grok-imagine-video',
            modelKey: 'openai-compatible:oa-1::grok-imagine-video',
            name: 'Grok Video',
            type: 'video',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::grok-imagine-video')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      mode: 'async',
      create: {
        bodyTemplate: {
          resolution_name: '{{resolution}}',
          preset: 'normal',
        },
      },
      response: {
        taskIdPath: '$.id',
        statusPath: '$.status',
      },
    })
  })

  it('upgrades stored generic image template for current grok2api edit model ids', async () => {
    installAuthMocks()
    mockAuthenticated('user-1')
    prismaMock.userPreference.findUnique.mockResolvedValueOnce({
      customProviders: null,
      customModels: JSON.stringify([
        {
          modelId: 'grok-imagine-image-edit',
          modelKey: 'openai-compatible:oa-1::grok-imagine-image-edit',
          name: 'Grok Edit',
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
          compatMediaTemplateCheckedAt: '2026-04-09T00:00:00.000Z',
          compatMediaTemplateSource: 'manual',
        },
      ]),
    })
    const route = await import('@/app/api/user/api-config/route')

    const req = buildMockRequest({
      path: '/api/user/api-config',
      method: 'PUT',
      body: {
        providers: [
          { id: 'openai-compatible:oa-1', name: 'OpenAI Compat', baseUrl: 'https://compat.test', apiKey: 'oa-key' },
        ],
        models: [
          {
            modelId: 'grok-imagine-image-edit',
            modelKey: 'openai-compatible:oa-1::grok-imagine-image-edit',
            name: 'Grok Edit',
            type: 'image',
            provider: 'openai-compatible:oa-1',
          },
        ],
      },
    })

    const res = await route.PUT(req, routeContext)
    expect(res.status).toBe(200)

    const savedModel = readSavedModelsFromUpsert().find((item) => item.modelKey === 'openai-compatible:oa-1::grok-imagine-image-edit')
    expect(savedModel?.compatMediaTemplate).toMatchObject({
      mode: 'sync',
      create: {
        path: '/images/edits',
        multipartFileFields: ['image[]'],
        bodyTemplate: {
          'image[]': '{{images}}',
        },
      },
    })
  })
})
