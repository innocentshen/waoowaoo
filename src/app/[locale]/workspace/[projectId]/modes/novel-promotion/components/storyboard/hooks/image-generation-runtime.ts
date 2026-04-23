import { NovelPromotionPanel, NovelPromotionStoryboard } from '@/types/project'

export interface StoryboardImageMutationResult {
  async?: boolean
  imageUrl?: string
}

function isConcreteTaskId(taskId: string | null | undefined): taskId is string {
  return Boolean(taskId && taskId.trim() && !taskId.startsWith('optimistic:'))
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || error.message === 'Failed to fetch'
}

export function getStoryboardPanels(storyboard: NovelPromotionStoryboard): NovelPromotionPanel[] {
  return Array.isArray(storyboard.panels) ? storyboard.panels : []
}

export function updatePanelByIdInStoryboards(
  storyboards: NovelPromotionStoryboard[],
  panelId: string,
  updater: (panel: NovelPromotionPanel) => NovelPromotionPanel,
): NovelPromotionStoryboard[] {
  return storyboards.map((storyboard) => {
    const panels = getStoryboardPanels(storyboard)
    let changed = false
    const updatedPanels = panels.map((panel) => {
      if (panel.id !== panelId) return panel
      changed = true
      return updater(panel)
    })
    return changed ? { ...storyboard, panels: updatedPanels } : storyboard
  })
}

export function getRunningPanelImageTaskIdMap(
  storyboards: NovelPromotionStoryboard[],
): Map<string, string> {
  const runningTaskIdsByPanelId = new Map<string, string>()

  for (const storyboard of storyboards) {
    for (const panel of getStoryboardPanels(storyboard)) {
      if (!panel.imageTaskRunning) continue
      const taskId = typeof panel.imageTaskId === 'string' ? panel.imageTaskId.trim() : ''
      if (!isConcreteTaskId(taskId)) continue
      runningTaskIdsByPanelId.set(panel.id, taskId)
    }
  }

  return runningTaskIdsByPanelId
}

export function clearPanelImageTaskStateInStoryboards(
  storyboards: NovelPromotionStoryboard[],
  panelIds: Iterable<string>,
): NovelPromotionStoryboard[] {
  const targetIds = new Set(panelIds)
  if (targetIds.size === 0) return storyboards

  return storyboards.map((storyboard) => {
    const panels = getStoryboardPanels(storyboard)
    let changed = false
    const updatedPanels = panels.map((panel) => {
      if (!targetIds.has(panel.id)) return panel
      changed = true
      return {
        ...panel,
        imageTaskRunning: false,
        imageTaskId: null,
        imageTaskIntent: null,
      }
    })

    return changed ? { ...storyboard, panels: updatedPanels } : storyboard
  })
}

export function updatePanelImageUrlInStoryboards(
  storyboards: NovelPromotionStoryboard[],
  storyboardId: string,
  panelIndex: number,
  imageUrl: string,
): NovelPromotionStoryboard[] {
  return storyboards.map((storyboard) => {
    if (storyboard.id !== storyboardId) return storyboard
    const panels = getStoryboardPanels(storyboard)
    const updatedPanels = panels.map((panel, index) =>
      index === panelIndex ? { ...panel, imageUrl } : panel,
    )
    return { ...storyboard, panels: updatedPanels }
  })
}

function createPanelMap(storyboards: NovelPromotionStoryboard[]): Map<string, NovelPromotionPanel> {
  const panelMap = new Map<string, NovelPromotionPanel>()
  for (const storyboard of storyboards) {
    const panels = getStoryboardPanels(storyboard)
    for (const panel of panels) {
      panelMap.set(panel.id, panel)
    }
  }
  return panelMap
}

export function reconcileSubmittingPanelImageIds(
  previousIds: Set<string>,
  storyboards: NovelPromotionStoryboard[],
): Set<string> {
  const panelMap = createPanelMap(storyboards)
  let changed = false
  const next = new Set(previousIds)

  for (const panelId of previousIds) {
    const panel = panelMap.get(panelId)
    if (!panel) {
      next.delete(panelId)
      changed = true
      continue
    }

    const isTaskRunning = Boolean((panel as { imageTaskRunning?: boolean }).imageTaskRunning)
    const hasError = Boolean((panel as { imageErrorMessage?: string | null }).imageErrorMessage)
    if (isTaskRunning || hasError) {
      next.delete(panelId)
      changed = true
    }
  }

  return changed ? next : previousIds
}

export function reconcileModifyingPanelIds(
  previousIds: Set<string>,
  storyboards: NovelPromotionStoryboard[],
): Set<string> {
  const panelMap = createPanelMap(storyboards)
  let changed = false
  const next = new Set(previousIds)

  for (const panelId of previousIds) {
    const panel = panelMap.get(panelId)
    if (!panel) {
      next.delete(panelId)
      changed = true
      continue
    }

    const isTaskRunning = Boolean((panel as { imageTaskRunning?: boolean }).imageTaskRunning)
    const taskIntent = (panel as NovelPromotionPanel & { imageTaskIntent?: string }).imageTaskIntent
    const hasError = Boolean((panel as { imageErrorMessage?: string | null }).imageErrorMessage)
    if ((isTaskRunning && taskIntent === 'modify') || hasError) {
      next.delete(panelId)
      changed = true
    }
  }

  return changed ? next : previousIds
}
