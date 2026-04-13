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

describe('api-config grok base url normalization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    prismaMock.userPreference.findUnique.mockResolvedValue({
      customProviders: JSON.stringify([
        {
          id: 'grok',
          name: 'xAI Grok',
          apiKey: 'enc:grok-key',
          baseUrl: 'https://proxy.example.com/v1',
        },
      ]),
      customModels: JSON.stringify([
        {
          type: 'image',
          provider: 'grok',
          modelId: 'grok-imagine-image',
          modelKey: 'grok::grok-imagine-image',
          name: 'Grok Imagine Image',
        },
      ]),
    })
  })

  it('forces the official xAI base url for grok providers', async () => {
    const apiConfig = await import('@/lib/api-config')

    const provider = await apiConfig.getProviderConfig('user-1', 'grok')
    expect(provider).toMatchObject({
      id: 'grok',
      apiKey: 'grok-key',
      baseUrl: 'https://api.x.ai/v1',
    })
  })
})
