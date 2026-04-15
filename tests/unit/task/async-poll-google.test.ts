import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() =>
  vi.fn(async () => ({
    id: 'google',
    apiKey: 'google-key',
    baseUrl: 'https://google-proxy.example',
  })),
)

const asyncTaskUtilsMock = vi.hoisted(() => ({
  queryGeminiBatchStatus: vi.fn(),
  queryGoogleVideoStatus: vi.fn(),
  querySeedanceVideoStatus: vi.fn(),
}))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
  getUserModels: vi.fn(),
}))

vi.mock('@/lib/async-submit', () => ({
  queryFalStatus: vi.fn(),
}))

vi.mock('@/lib/async-task-utils', () => asyncTaskUtilsMock)

import { pollAsyncTask } from '@/lib/async-poll'

describe('async poll google task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes custom baseUrl to google video status polling', async () => {
    asyncTaskUtilsMock.queryGoogleVideoStatus.mockResolvedValueOnce({
      status: 'completed',
      videoUrl: 'https://cdn.example/video.mp4',
    })

    const result = await pollAsyncTask('GOOGLE:VIDEO:operations/123', 'user-1')

    expect(getProviderConfigMock).toHaveBeenCalledWith('user-1', 'google')
    expect(asyncTaskUtilsMock.queryGoogleVideoStatus).toHaveBeenCalledWith(
      'operations/123',
      'google-key',
      'https://google-proxy.example',
    )
    expect(result).toEqual({
      status: 'completed',
      resultUrl: 'https://cdn.example/video.mp4',
      videoUrl: 'https://cdn.example/video.mp4',
      error: undefined,
    })
  })

  it('passes custom baseUrl to gemini batch polling', async () => {
    asyncTaskUtilsMock.queryGeminiBatchStatus.mockResolvedValueOnce({
      status: 'completed',
      imageUrl: 'https://cdn.example/image.png',
    })

    const result = await pollAsyncTask('GEMINI:BATCH:batches/123', 'user-1')

    expect(getProviderConfigMock).toHaveBeenCalledWith('user-1', 'google')
    expect(asyncTaskUtilsMock.queryGeminiBatchStatus).toHaveBeenCalledWith(
      'batches/123',
      'google-key',
      'https://google-proxy.example',
    )
    expect(result).toEqual({
      status: 'completed',
      imageUrl: 'https://cdn.example/image.png',
      resultUrl: 'https://cdn.example/image.png',
      error: undefined,
    })
  })
})
