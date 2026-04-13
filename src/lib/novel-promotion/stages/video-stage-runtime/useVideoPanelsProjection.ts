'use client'

import { useMemo } from 'react'
import type {
  Clip,
  Storyboard,
  VideoPanel,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video'

interface TaskStateLike {
  phase?: string | null
  lastError?: { code?: string; message?: string } | null
}

interface TaskPresentationLike {
  getTaskState: (key: string) => TaskStateLike | null
}

interface UseVideoPanelsProjectionParams {
  storyboards: Storyboard[]
  clips: Clip[]
  panelVideoStates: TaskPresentationLike
  panelLipStates: TaskPresentationLike
}

function isTaskRunningPhase(phase: string | null | undefined) {
  return phase === 'queued' || phase === 'processing'
}

function parsePanelCharacters(characters: string | null | undefined): Array<string | { name?: string; appearance?: string }> {
  if (!characters) return []

  try {
    const parsed = JSON.parse(characters)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parsePanelStringArray(value: string | null | undefined): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  } catch {
    // fall through to comma-separated parsing
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function useVideoPanelsProjection({
  storyboards,
  clips,
  panelVideoStates,
  panelLipStates,
}: UseVideoPanelsProjectionParams) {
  const clipIndexById = useMemo(() => {
    return new Map(clips.map((clip, index) => [clip.id, index]))
  }, [clips])

  const sortedStoryboards = useMemo(() => {
    return [...storyboards].sort((left, right) => {
      const leftIndex = clipIndexById.get(left.clipId ?? '') ?? Number.MAX_SAFE_INTEGER
      const rightIndex = clipIndexById.get(right.clipId ?? '') ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })
  }, [clipIndexById, storyboards])

  const basePanels = useMemo<VideoPanel[]>(() => {
    const panels: VideoPanel[] = []
    sortedStoryboards.forEach((storyboard) => {
      const storyboardPanels = storyboard.panels || []
      storyboardPanels.forEach((panel, index) => {
        const actualPanelIndex = panel.panelIndex ?? index
        const locations = parsePanelStringArray(panel.location)
        const props = parsePanelStringArray(panel.props)

        const panelId = panel.id || undefined

        panels.push({
          panelId,
          storyboardId: storyboard.id,
          panelIndex: actualPanelIndex,
          textPanel: {
            panel_number: panel.panelNumber || actualPanelIndex + 1,
            shot_type: panel.shotType || '',
            camera_move: panel.cameraMove || '',
            description: panel.description || '',
            characters: parsePanelCharacters(panel.characters),
            location: locations.join(' / '),
            locations,
            props,
            text_segment: panel.srtSegment || '',
            duration: panel.duration || undefined,
            imagePrompt: panel.imagePrompt || undefined,
            video_prompt: panel.videoPrompt || undefined,
            videoModel: panel.videoModel || undefined,
          },
          imageUrl: panel.imageUrl || undefined,
          firstLastFramePrompt: panel.firstLastFramePrompt || undefined,
          videoUrl: panel.videoUrl || undefined,
          videoCandidates: panel.videoCandidates || undefined,
          videoGenerationMode: panel.videoGenerationMode || undefined,
          videoTaskRunning: panel.videoTaskRunning || false,
          videoErrorCode: panel.videoErrorCode || undefined,
          videoErrorMessage: panel.videoErrorMessage || undefined,
          videoModel: panel.videoModel || undefined,
          linkedToNextPanel: panel.linkedToNextPanel || false,
          lipSyncVideoUrl: panel.lipSyncVideoUrl || undefined,
          lipSyncTaskRunning: panel.lipSyncTaskRunning || false,
          lipSyncErrorCode: panel.lipSyncErrorCode || undefined,
          lipSyncErrorMessage: panel.lipSyncErrorMessage || undefined,
        })
      })
    })
    return panels
  }, [sortedStoryboards])

  const allPanels = useMemo<VideoPanel[]>(() => {
    return basePanels.map((panel) => {
      const panelId = panel.panelId
      const panelVideoState = panelId ? panelVideoStates.getTaskState(`panel-video:${panelId}`) : null
      const panelLipState = panelId ? panelLipStates.getTaskState(`panel-lip:${panelId}`) : null

      const videoTaskRunning = panelVideoState
        ? isTaskRunningPhase(panelVideoState.phase)
        : panel.videoTaskRunning || false
      const videoErrorCode = panelVideoState?.phase === 'failed'
        ? panelVideoState.lastError?.code || panel.videoErrorCode || undefined
        : panel.videoErrorCode || undefined
      const videoErrorMessage = panelVideoState?.phase === 'failed'
        ? panelVideoState.lastError?.message || panel.videoErrorMessage || undefined
        : panel.videoErrorMessage || undefined
      const lipSyncTaskRunning = panelLipState
        ? isTaskRunningPhase(panelLipState.phase)
        : panel.lipSyncTaskRunning || false
      const lipSyncErrorCode = panelLipState?.phase === 'failed'
        ? panelLipState.lastError?.code || panel.lipSyncErrorCode || undefined
        : panel.lipSyncErrorCode || undefined
      const lipSyncErrorMessage = panelLipState?.phase === 'failed'
        ? panelLipState.lastError?.message || panel.lipSyncErrorMessage || undefined
        : panel.lipSyncErrorMessage || undefined

      if (
        videoTaskRunning === (panel.videoTaskRunning || false) &&
        videoErrorCode === (panel.videoErrorCode || undefined) &&
        videoErrorMessage === (panel.videoErrorMessage || undefined) &&
        lipSyncTaskRunning === (panel.lipSyncTaskRunning || false) &&
        lipSyncErrorCode === (panel.lipSyncErrorCode || undefined) &&
        lipSyncErrorMessage === (panel.lipSyncErrorMessage || undefined)
      ) {
        return panel
      }

      return {
        ...panel,
        videoTaskRunning,
        videoErrorCode,
        videoErrorMessage,
        lipSyncTaskRunning,
        lipSyncErrorCode,
        lipSyncErrorMessage,
      }
    })
  }, [basePanels, panelLipStates, panelVideoStates])

  return {
    sortedStoryboards,
    allPanels,
  }
}
