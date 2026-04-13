import type { MutableRefObject } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  useRefreshAllMock,
  usePanelCrudActionsMock,
  useStoryboardGroupActionsMock,
  usePanelInsertActionsMock,
  refreshAllFn,
  panelCrudResult,
  groupActionsResult,
  panelInsertResult,
} = vi.hoisted(() => ({
  useRefreshAllMock: vi.fn(),
  usePanelCrudActionsMock: vi.fn(),
  useStoryboardGroupActionsMock: vi.fn(),
  usePanelInsertActionsMock: vi.fn(),
  refreshAllFn: vi.fn(),
  panelCrudResult: {
    savingPanels: new Set<string>(),
    deletingPanelIds: new Set<string>(),
    saveStateByPanel: {},
    hasUnsavedByPanel: new Set<string>(),
    savePanel: vi.fn(),
    savePanelWithData: vi.fn(),
    debouncedSave: vi.fn(),
    retrySave: vi.fn(),
    addPanel: vi.fn(),
    deletePanel: vi.fn(),
    addCharacterToPanel: vi.fn(),
    removeCharacterFromPanel: vi.fn(),
    setPanelLocation: vi.fn(),
  },
  groupActionsResult: {
    submittingStoryboardTextIds: new Set<string>(),
    addingStoryboardGroup: false,
    movingClipId: null,
    deleteStoryboard: vi.fn(),
    regenerateStoryboardText: vi.fn(),
    addStoryboardGroup: vi.fn(),
    moveStoryboardGroup: vi.fn(),
  },
  panelInsertResult: {
    insertingAfterPanelId: null,
    insertPanel: vi.fn(),
  },
}))

vi.mock('@/lib/query/hooks', () => ({
  useRefreshAll: useRefreshAllMock,
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/usePanelCrudActions', () => ({
  usePanelCrudActions: usePanelCrudActionsMock,
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/useStoryboardGroupActions', () => ({
  useStoryboardGroupActions: useStoryboardGroupActionsMock,
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/usePanelInsertActions', () => ({
  usePanelInsertActions: usePanelInsertActionsMock,
}))

import { usePanelOperations } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/usePanelOperations'

describe('usePanelOperations refresh wiring', () => {
  beforeEach(() => {
    refreshAllFn.mockReset()
    useRefreshAllMock.mockReset()
    usePanelCrudActionsMock.mockReset()
    useStoryboardGroupActionsMock.mockReset()
    usePanelInsertActionsMock.mockReset()

    useRefreshAllMock.mockReturnValue(refreshAllFn)
    usePanelCrudActionsMock.mockReturnValue(panelCrudResult)
    useStoryboardGroupActionsMock.mockReturnValue(groupActionsResult)
    usePanelInsertActionsMock.mockReturnValue(panelInsertResult)
  })

  it('uses the full episode refresh callback for storyboard operations', () => {
    const panelEditsRef = {
      current: {},
    } as MutableRefObject<Record<string, never>>

    const result = usePanelOperations({
      projectId: 'project-1',
      episodeId: 'episode-1',
      panelEditsRef,
    })

    expect(useRefreshAllMock).toHaveBeenCalledWith('project-1', 'episode-1')
    expect(usePanelCrudActionsMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      panelEditsRef,
      onRefresh: refreshAllFn,
    }))
    expect(useStoryboardGroupActionsMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      episodeId: 'episode-1',
      onRefresh: refreshAllFn,
    }))
    expect(usePanelInsertActionsMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      onRefresh: refreshAllFn,
    }))
    expect(result.moveStoryboardGroup).toBe(groupActionsResult.moveStoryboardGroup)
  })
})
