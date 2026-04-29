import { beforeEach, describe, expect, it, vi } from 'vitest'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'grok',
  name: 'xAI Grok',
  apiKey: 'grok-key',
  baseUrl: 'https://api.x.ai/v1',
})))

const normalizeToOriginalMediaUrlMock = vi.hoisted(() =>
  vi.fn(async (input: string) => `${input}?signed=1`),
)
const normalizeToBase64ForGenerationMock = vi.hoisted(() =>
  vi.fn(async () => `data:image/png;base64,${PNG_BASE64}`),
)

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

vi.mock('@/lib/media/outbound-image', () => ({
  normalizeToBase64ForGeneration: normalizeToBase64ForGenerationMock,
  normalizeToOriginalMediaUrl: normalizeToOriginalMediaUrlMock,
}))

import { generateGrokImage } from '@/lib/providers/grok/image'

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

  it('accepts the official auto aspect ratio option', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ b64_json: PNG_BASE64 }],
    }), { status: 200 }))

    await generateGrokImage({
      userId: 'user-1',
      prompt: 'draw cat',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
        aspectRatio: 'auto',
      },
    })

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.aspect_ratio).toBe('auto')
  })

  it('rejects unsupported aspect ratios before calling xai', async () => {
    await expect(generateGrokImage({
      userId: 'user-1',
      prompt: 'draw cat',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
        aspectRatio: '5:7',
      },
    })).rejects.toThrow('GROK_IMAGE_ASPECT_RATIO_UNSUPPORTED')

    expect(fetchSpy).not.toHaveBeenCalled()
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
      url: 'https://example.com/ref.png?signed=1',
    })
    expect(normalizeToOriginalMediaUrlMock).toHaveBeenCalledWith('https://example.com/ref.png')
    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.x.ai/generated.jpg',
    })
  })

  it('sends multiple reference images via the images array', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ url: 'https://cdn.x.ai/generated.jpg' }],
    }), { status: 200 }))

    const result = await generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: ['https://example.com/ref-a.png', 'https://example.com/ref-b.png'],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/images/edits')
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.image).toBeUndefined()
    expect(body.images).toEqual([
      { type: 'image_url', url: 'https://example.com/ref-a.png?signed=1' },
      { type: 'image_url', url: 'https://example.com/ref-b.png?signed=1' },
    ])
    expect(normalizeToOriginalMediaUrlMock).toHaveBeenCalledWith('https://example.com/ref-a.png')
    expect(normalizeToOriginalMediaUrlMock).toHaveBeenCalledWith('https://example.com/ref-b.png')
    expect(result).toEqual({
      success: true,
      imageUrl: 'https://cdn.x.ai/generated.jpg',
    })
  })

  it('keeps data urls unchanged for image edits', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ url: 'https://cdn.x.ai/generated.jpg' }],
    }), { status: 200 }))

    await generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: ['data:image/png;base64,INLINE_IMAGE'],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.image).toEqual({
      type: 'image_url',
      url: 'data:image/png;base64,INLINE_IMAGE',
    })
    expect(normalizeToOriginalMediaUrlMock).not.toHaveBeenCalled()
  })

  it('allows up to five input images for grok-imagine-image edits', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ url: 'https://cdn.x.ai/generated.jpg' }],
    }), { status: 200 }))

    await generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: [
        'https://example.com/ref-a.png',
        'https://example.com/ref-b.png',
        'https://example.com/ref-c.png',
        'https://example.com/ref-d.png',
        'https://example.com/ref-e.png',
      ],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.images).toHaveLength(5)
  })

  it('rejects more than five input images for grok-imagine-image before calling xai', async () => {
    await expect(generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: [
        'https://example.com/ref-a.png',
        'https://example.com/ref-b.png',
        'https://example.com/ref-c.png',
        'https://example.com/ref-d.png',
        'https://example.com/ref-e.png',
        'https://example.com/ref-f.png',
      ],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })).rejects.toThrow('GROK_IMAGE_REFERENCE_LIMIT_EXCEEDED')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('makes sensitive thriller prompts non-graphic before sending to xai', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [{ b64_json: PNG_BASE64 }],
    }), { status: 200 }))

    await generateGrokImage({
      userId: 'user-1',
      prompt: '血衣研究员额角伤口渗血，男孩蜷缩在实验台下',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(body.prompt).toContain('Grok media safety constraints')
    expect(body.prompt).toContain('受伤研究员')
    expect(body.prompt).not.toContain('血衣研究员')
    expect(body.prompt).not.toContain('伤口')
    expect(body.prompt).not.toContain('渗血')
  })

  it('surfaces xai image moderation as an explicit error', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      respect_moderation: false,
    }), { status: 200 }))

    await expect(generateGrokImage({
      userId: 'user-1',
      prompt: 'draw cat',
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image',
      },
    })).rejects.toThrow('GROK_IMAGE_CONTENT_MODERATED')
  })

  it('rejects multiple input images for grok-imagine-image-pro before calling xai', async () => {
    await expect(generateGrokImage({
      userId: 'user-1',
      prompt: 'edit this image',
      referenceImages: [
        'https://example.com/ref-a.png',
        'https://example.com/ref-b.png',
      ],
      options: {
        provider: 'grok',
        modelId: 'grok-imagine-image-pro',
      },
    })).rejects.toThrow('supports at most 1 input image')

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
