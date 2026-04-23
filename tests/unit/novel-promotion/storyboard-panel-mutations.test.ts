import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { TaskTargetOverlayMap } from '@/lib/query/task-target-overlay'
import { queryKeys } from '@/lib/query/keys'

const queryClient = new QueryClient()

const {
  useQueryClientMock,
  useMutationMock,
} = vi.hoisted(() => ({
  useQueryClientMock: vi.fn(() => queryClient),
  useMutationMock: vi.fn((options: unknown) => options),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => useQueryClientMock(),
    useMutation: (options: unknown) => useMutationMock(options),
  }
})

import { useRegenerateProjectPanelImage } from '@/lib/query/mutations/storyboard-panel-mutations'

function getOverlay(projectId: string, panelId: string) {
  const overlayMap = queryClient.getQueryData<TaskTargetOverlayMap>(
    queryKeys.tasks.targetStateOverlay(projectId),
  ) || {}
  return overlayMap[`NovelPromotionPanel:${panelId}`] || null
}

describe('storyboard panel mutations', () => {
  beforeEach(() => {
    queryClient.clear()
    useQueryClientMock.mockClear()
    useMutationMock.mockClear()
  })

  it('replaces optimistic overlay task id with the real submitted task id', () => {
    const mutation = useRegenerateProjectPanelImage('project-1') as unknown as {
      onMutate: (variables: { panelId: string; count?: number }) => void
      onSuccess: (data: unknown, variables: { panelId: string; count?: number }) => void
    }

    mutation.onMutate({ panelId: 'panel-1', count: 1 })
    const optimisticOverlay = getOverlay('project-1', 'panel-1')

    expect(optimisticOverlay?.runningTaskId).toMatch(/^optimistic:NovelPromotionPanel:panel-1:/)

    mutation.onSuccess(
      {
        async: true,
        taskId: 'task-panel-1',
        status: 'queued',
      },
      { panelId: 'panel-1', count: 1 },
    )

    const resolvedOverlay = getOverlay('project-1', 'panel-1')

    expect(resolvedOverlay?.runningTaskId).toBe('task-panel-1')
    expect(resolvedOverlay?.runningTaskType).toBe('image_panel')
    expect(resolvedOverlay?.phase).toBe('queued')
  })
})
