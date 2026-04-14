import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('@/lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

import { waitForTaskResult } from '@/lib/task/client'

describe('waitForTaskResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries transient snapshot fetch errors before resolving the task result', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new Error('Connection error.'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: 'task-1',
            status: 'completed',
            result: {
              success: true,
              mediaUrl: 'https://example.com/video.mp4',
            },
          },
        }),
      })

    const resultPromise = waitForTaskResult('task-1', {
      intervalMs: 10,
      timeoutMs: 1000,
    })

    await vi.runAllTimersAsync()

    await expect(resultPromise).resolves.toEqual({
      success: true,
      mediaUrl: 'https://example.com/video.mp4',
    })
    expect(apiFetchMock).toHaveBeenCalledTimes(3)
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/tasks/task-1', {
      method: 'GET',
      cache: 'no-store',
    })
  })
})
