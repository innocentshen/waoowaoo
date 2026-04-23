'use client'

import { useMemo } from 'react'
import { NovelPromotionStoryboard } from '@/types/project'
import { useStoryboardTaskPresentation } from '@/lib/query/hooks/useTaskPresentation'
import {
  NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES,
  NOVEL_PROMOTION_PANEL_LIP_SYNC_TASK_TYPES,
  NOVEL_PROMOTION_PANEL_VIDEO_TASK_TYPES,
} from '@/lib/novel-promotion/panel-task-types'

interface TaskTarget {
  key: string
  targetType: string
  targetId: string
  types: string[]
  resource: 'text' | 'image' | 'video'
  hasOutput: boolean
}

interface UseStoryboardTaskAwareStoryboardsProps {
  projectId: string
  initialStoryboards: NovelPromotionStoryboard[]
  isRunningPhase: (phase: string | null | undefined) => boolean
}

function buildStoryboardTextTargets(storyboards: NovelPromotionStoryboard[]): TaskTarget[] {
  const targets: TaskTarget[] = []

  for (const storyboard of storyboards) {
    targets.push({
      key: `storyboard:${storyboard.id}`,
      targetType: 'NovelPromotionStoryboard',
      targetId: storyboard.id,
      types: ['regenerate_storyboard_text', 'insert_panel'],
      resource: 'text',
      hasOutput: !!(storyboard.panels || []).length,
    })
    if (storyboard.episodeId) {
      targets.push({
        key: `episode:${storyboard.episodeId}`,
        targetType: 'NovelPromotionEpisode',
        targetId: storyboard.episodeId,
        types: ['regenerate_storyboard_text', 'insert_panel'],
        resource: 'text',
        hasOutput: !!(storyboard.panels || []).length,
      })
    }
  }

  return targets
}

function buildPanelTargets(storyboards: NovelPromotionStoryboard[], type: 'image' | 'video' | 'lip-sync'): TaskTarget[] {
  const targets: TaskTarget[] = []

  for (const storyboard of storyboards) {
    for (const panel of storyboard.panels || []) {
      if (type === 'image') {
        targets.push({
          key: `panel-image:${panel.id}`,
          targetType: 'NovelPromotionPanel',
          targetId: panel.id,
          types: [...NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES],
          resource: 'image',
          hasOutput: !!panel.imageUrl,
        })
      } else if (type === 'video') {
        targets.push({
          key: `panel-video:${panel.id}`,
          targetType: 'NovelPromotionPanel',
          targetId: panel.id,
          types: [...NOVEL_PROMOTION_PANEL_VIDEO_TASK_TYPES],
          resource: 'video',
          hasOutput: !!panel.videoUrl,
        })
      } else {
        targets.push({
          key: `panel-lip:${panel.id}`,
          targetType: 'NovelPromotionPanel',
          targetId: panel.id,
          types: [...NOVEL_PROMOTION_PANEL_LIP_SYNC_TASK_TYPES],
          resource: 'video',
          hasOutput: !!panel.lipSyncVideoUrl,
        })
      }
    }
  }

  return targets
}

export function useStoryboardTaskAwareStoryboards({
  projectId,
  initialStoryboards,
  isRunningPhase,
}: UseStoryboardTaskAwareStoryboardsProps) {
  const storyboardTextTargets = useMemo(
    () => buildStoryboardTextTargets(initialStoryboards),
    [initialStoryboards],
  )
  const panelImageTargets = useMemo(
    () => buildPanelTargets(initialStoryboards, 'image'),
    [initialStoryboards],
  )
  const panelVideoTargets = useMemo(
    () => buildPanelTargets(initialStoryboards, 'video'),
    [initialStoryboards],
  )
  const panelLipSyncTargets = useMemo(
    () => buildPanelTargets(initialStoryboards, 'lip-sync'),
    [initialStoryboards],
  )

  const storyboardTextStates = useStoryboardTaskPresentation(
    projectId,
    storyboardTextTargets,
    !!projectId && storyboardTextTargets.length > 0,
  )
  const panelImageStates = useStoryboardTaskPresentation(
    projectId,
    panelImageTargets,
    !!projectId && panelImageTargets.length > 0,
  )
  const panelVideoStates = useStoryboardTaskPresentation(
    projectId,
    panelVideoTargets,
    !!projectId && panelVideoTargets.length > 0,
  )
  const panelLipSyncStates = useStoryboardTaskPresentation(
    projectId,
    panelLipSyncTargets,
    !!projectId && panelLipSyncTargets.length > 0,
  )

  const taskAwareStoryboards = useMemo(() => {
    return initialStoryboards.map((storyboard) => {
      const storyboardTaskRunning =
        isRunningPhase(storyboardTextStates.getTaskState(`storyboard:${storyboard.id}`)?.phase) ||
        isRunningPhase(storyboardTextStates.getTaskState(`episode:${storyboard.episodeId}`)?.phase)

      const nextPanels = (storyboard.panels || []).map((panel) => {
        const panelRuntime = panel as typeof panel & {
          imageTaskId?: string | null
          imageTaskIntent?: string | null
          lipSyncTaskRunning?: boolean
        }
        const panelImageTaskState = panelImageStates.getTaskState(`panel-image:${panel.id}`)
        const panelImageRunning = isRunningPhase(panelImageTaskState?.phase)

        const imageTaskIntent = panelImageRunning ? (panelImageTaskState?.intent ?? null) : null
        const imageTaskId = panelImageRunning ? (panelImageTaskState?.runningTaskId ?? null) : null
        const videoTaskRunning = isRunningPhase(panelVideoStates.getTaskState(`panel-video:${panel.id}`)?.phase)
        const lipSyncTaskRunning = isRunningPhase(panelLipSyncStates.getTaskState(`panel-lip:${panel.id}`)?.phase)

        if (
          panel.imageTaskRunning === panelImageRunning &&
          panelRuntime.imageTaskId === imageTaskId &&
          panelRuntime.imageTaskIntent === imageTaskIntent &&
          panel.videoTaskRunning === videoTaskRunning &&
          panelRuntime.lipSyncTaskRunning === lipSyncTaskRunning
        ) {
          return panel
        }

        return {
          ...panel,
          imageTaskRunning: panelImageRunning,
          imageTaskId,
          imageTaskIntent,
          videoTaskRunning,
          lipSyncTaskRunning,
        }
      })

      const panelsUnchanged = nextPanels.every((panel, index) => panel === (storyboard.panels || [])[index])
      if (
        storyboard.storyboardTaskRunning === storyboardTaskRunning &&
        panelsUnchanged
      ) {
        return storyboard
      }

      return {
        ...storyboard,
        storyboardTaskRunning,
        panels: nextPanels,
      }
    })
  }, [
    initialStoryboards,
    isRunningPhase,
    panelImageStates,
    panelLipSyncStates,
    panelVideoStates,
    storyboardTextStates,
  ])

  return {
    taskAwareStoryboards,
  }
}
