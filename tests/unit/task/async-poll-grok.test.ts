import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'grok',
  apiKey: 'grok-key',
  baseUrl: 'https://grok-proxy.example/v1',
})))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
}))

import { pollAsyncTask } from '@/lib/async-poll'

describe('async poll GROK video status mapping', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    getProviderConfigMock.mockResolvedValue({
      id: 'grok',
      apiKey: 'grok-key',
      baseUrl: 'https://grok-proxy.example/v1',
    })
    fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  it('maps queued status to pending', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'queued' }), { status: 200 }))

    const result = await pollAsyncTask('GROK:VIDEO:req_queued', 'user-1')
    expect(result).toEqual({ status: 'pending' })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://grok-proxy.example/v1/videos/req_queued',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer grok-key',
        },
      },
    )
  })

  it('maps completed status to video url', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'completed',
      video: { url: 'https://cdn.x.ai/video.mp4' },
    }), { status: 200 }))

    const result = await pollAsyncTask('GROK:VIDEO:req_done', 'user-1')
    expect(result).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.x.ai/video.mp4',
      videoUrl: 'https://cdn.x.ai/video.mp4',
    })
  })

  it('maps failed status to provider error message', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'failed',
      error: { message: 'generation failed' },
    }), { status: 200 }))

    const result = await pollAsyncTask('GROK:VIDEO:req_failed', 'user-1')
    expect(result).toEqual({
      status: 'failed',
      error: 'Grok: generation failed',
    })
  })
})
