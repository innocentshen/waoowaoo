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

describe('api-config legacy provider migration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    prismaMock.userPreference.findUnique.mockResolvedValue({
      customProviders: JSON.stringify([
        { id: 'qwen', name: 'Qwen', apiKey: 'enc:legacy-key' },
      ]),
      customModels: JSON.stringify([
        {
          type: 'llm',
          provider: 'qwen',
          modelId: 'qwen3.5-flash',
          modelKey: 'qwen::qwen3.5-flash',
          name: 'Qwen 3.5 Flash',
        },
      ]),
    })
  })

  it('resolves legacy qwen models and providers as bailian', async () => {
    const apiConfig = await import('@/lib/api-config')

    const selection = await apiConfig.resolveModelSelection('user-1', 'qwen::qwen3.5-flash', 'llm')
    expect(selection).toMatchObject({
      provider: 'bailian',
      modelId: 'qwen3.5-flash',
      modelKey: 'bailian::qwen3.5-flash',
    })

    const provider = await apiConfig.getProviderConfig('user-1', 'bailian')
    expect(provider).toMatchObject({
      id: 'bailian',
      apiKey: 'legacy-key',
    })
  })
})
