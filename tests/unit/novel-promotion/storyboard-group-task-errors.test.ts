import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES } from '@/lib/novel-promotion/panel-task-types'

const {
  dismissMutateMock,
  useDismissFailedTasksMock,
  useTaskListMock,
} = vi.hoisted(() => ({
  dismissMutateMock: vi.fn(),
  useDismissFailedTasksMock: vi.fn(),
  useTaskListMock: vi.fn(),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useMemo: <T,>(factory: () => T) => factory(),
    useCallback: <T extends (...args: never[]) => unknown>(factory: T) => factory,
  }
})

vi.mock('@/lib/query/hooks/useTaskStatus', () => ({
  useTaskList: useTaskListMock,
}))

vi.mock('@/lib/query/mutations/task-mutations', () => ({
  useDismissFailedTasks: useDismissFailedTasksMock,
}))

vi.mock('@/lib/errors/display', () => ({
  resolveErrorDisplay: (error?: { code?: string | null; message?: string | null } | null) =>
    error
      ? {
        code: error.code || 'UNKNOWN',
        message: error.message || 'unknown',
      }
      : null,
}))

import { useStoryboardGroupTaskErrors } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/useStoryboardGroupTaskErrors'

describe('useStoryboardGroupTaskErrors', () => {
  beforeEach(() => {
    dismissMutateMock.mockReset()
    useDismissFailedTasksMock.mockReset()
    useTaskListMock.mockReset()

    useDismissFailedTasksMock.mockReturnValue({
      mutate: dismissMutateMock,
    })
  })

  it('limits storyboard image errors to image-related panel tasks', () => {
    useTaskListMock.mockReturnValue({
      data: [
        {
          id: 'task-image',
          type: 'image_panel',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'image failed' },
        },
        {
          id: 'task-video',
          type: 'video_panel',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'video failed' },
        },
        {
          id: 'task-lip',
          type: 'lip_sync',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'lip failed' },
        },
        {
          id: 'task-variant',
          type: 'panel_variant',
          targetId: 'panel-2',
          error: { code: 'EXTERNAL_ERROR', message: 'variant failed' },
        },
      ],
    })

    const result = useStoryboardGroupTaskErrors({
      projectId: 'project-1',
      episodeId: 'episode-1',
    })

    expect(useTaskListMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      targetType: 'NovelPromotionPanel',
      type: [...NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES],
      statuses: ['failed'],
      limit: 200,
      enabled: true,
    }))
    expect(result.panelTaskErrorMap.get('panel-1')).toEqual({
      taskId: 'task-image',
      message: 'image failed',
    })
    expect(result.panelTaskErrorMap.get('panel-2')).toEqual({
      taskId: 'task-variant',
      message: 'variant failed',
    })
    expect(result.panelTaskErrorMap.size).toBe(2)
  })

  it('dismisses only image-related failed tasks for the requested panel', () => {
    useTaskListMock.mockReturnValue({
      data: [
        {
          id: 'task-image',
          type: 'image_panel',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'image failed' },
        },
        {
          id: 'task-modify',
          type: 'modify_asset_image',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'modify failed' },
        },
        {
          id: 'task-video',
          type: 'video_panel',
          targetId: 'panel-1',
          error: { code: 'EXTERNAL_ERROR', message: 'video failed' },
        },
        {
          id: 'task-other-panel',
          type: 'image_panel',
          targetId: 'panel-2',
          error: { code: 'EXTERNAL_ERROR', message: 'other failed' },
        },
      ],
    })

    const result = useStoryboardGroupTaskErrors({
      projectId: 'project-1',
      episodeId: 'episode-1',
    })

    result.clearPanelTaskError('panel-1')

    expect(useDismissFailedTasksMock).toHaveBeenCalledWith('project-1')
    expect(dismissMutateMock).toHaveBeenCalledWith(['task-image', 'task-modify'])
  })
})
