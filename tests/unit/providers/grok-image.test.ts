import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'grok',
  name: 'xAI Grok',
  apiKey: 'grok-key',
  baseUrl: 'https://api.x.ai/v1',
})))

const normalizeToBase64ForGenerationMock = vi.hoisted(() =>
  vi.fn(async () => 'data:image/png;base64,REF_IMAGE_BASE64'),
)

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

vi.mock('@/lib/media/outbound-image', () => ({
  normalizeToBase64ForGeneration: normalizeToBase64ForGenerationMock,
}))

import { generateGrokImage } from '@/lib/providers/grok/image'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

describe('generateGrokImage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('submits text-to-image requests to grok generations endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ b64_json: PNG_BASE64 }],
    }), { status: 200 }))

    const result = await generateGrokImage({
      userId: 'user-1',
      prompt: 'draw cat',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
        aspectRatio: '16:9',
        resolution: '2K',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/images/generations')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      model: 'grok-imagine-image',
      prompt: 'draw cat',
      response_format: 'b64_json',
      aspect_ratio: '16:9',
      resolution: '2k',
    })
    expect(result.success).toBe(true)
    expect(result.imageBase64).toBe(PNG_BASE64)
    expect(result.imageUrl).toBe(`data:image/png;base64,${PNG_BASE64}`)
  })

  it('submits image edits to grok edits endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ url: 'https://cdn.x.ai/generated.jpg' }],
    }), { status: 200 }))

    const result = await generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: ['https://example.com/ref.png'],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/images/edits')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.image).toEqual({
      type: 'image_url',
      url: 'data:image/png;base64,REF_IMAGE_BASE64',
    })
    expect(normalizeToBase64ForGenerationMock).toHaveBeenCalledWith('https://example.com/ref.png')
    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.x.ai/generated.jpg',
    })
  })
})
