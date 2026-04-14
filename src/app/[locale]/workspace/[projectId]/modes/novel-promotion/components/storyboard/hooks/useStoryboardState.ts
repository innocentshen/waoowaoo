'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { NovelPromotionStoryboard, NovelPromotionClip, NovelPromotionPanel } from '@/types/project'
import { PanelEditData } from '../../PanelEditForm'
import {
  computeStoryboardStartIndex,
  computeTotalPanels,
  formatClipTitle,
  getStoryboardPanels,
  sortStoryboardsByClipOrder,
} from './storyboard-state-utils'

type StoryboardCharacter = { name: string; appearance: string; slot?: string }

export interface StoryboardPanel {
  id: string
  panelIndex: number
  panel_number: number
  shot_type: string
  camera_move: string | null
  description: string
  characters: StoryboardCharacter[]
  location?: string
  srt_range?: string
  duration?: number
  video_prompt?: string
  source_text?: string
  candidateImages?: string
  imageUrl?: string | null
  photographyRules?: string | null
  actingNotes?: string | null
  imageTaskRunning?: boolean
}

interface UseStoryboardStateProps {
  projectId: string
  episodeId: string
  initialStoryboards: NovelPromotionStoryboard[]
  clips: NovelPromotionClip[]
}

function parsePanelCharacters(charactersJson: string | null | undefined): StoryboardCharacter[] {
  if (!charactersJson) return []

  try {
    const parsed = JSON.parse(charactersJson)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item): StoryboardCharacter[] => {
      if (
        typeof item !== 'object'
        || item === null
        || typeof (item as { name?: unknown }).name !== 'string'
        || typeof (item as { appearance?: unknown }).appearance !== 'string'
      ) {
        return []
      }

      const candidate = item as { name: string; appearance: string; slot?: unknown }
      return [{
        name: candidate.name,
        appearance: candidate.appearance,
        slot: typeof candidate.slot === 'string' ? candidate.slot : undefined,
      }]
    })
  } catch {
    return []
  }
}

function toStoryboardPanel(panel: NovelPromotionPanel): StoryboardPanel {
  return {
    id: panel.id,
    panelIndex: panel.panelIndex,
    panel_number: panel.panelNumber ?? panel.panelIndex + 1,
    shot_type: panel.shotType ?? '',
    camera_move: panel.cameraMove,
    description: panel.description ?? '',
    location: panel.location || undefined,
    characters: parsePanelCharacters(panel.characters),
    srt_range: panel.srtStart && panel.srtEnd ? `${panel.srtStart}-${panel.srtEnd}` : undefined,
    duration: panel.duration ?? undefined,
    video_prompt: panel.videoPrompt || undefined,
    source_text: panel.srtSegment || undefined,
    candidateImages: panel.candidateImages || undefined,
    imageUrl: panel.imageUrl,
    photographyRules: panel.photographyRules,
    actingNotes: panel.actingNotes,
    imageTaskRunning: panel.imageTaskRunning || false,
  }
}

function toPanelEditData(panel: StoryboardPanel): PanelEditData {
  return {
    id: panel.id,
    panelIndex: panel.panelIndex,
    panelNumber: panel.panel_number,
    shotType: panel.shot_type,
    cameraMove: panel.camera_move,
    description: panel.description,
    location: panel.location || null,
    characters: panel.characters || [],
    srtStart: null,
    srtEnd: null,
    duration: panel.duration || null,
    videoPrompt: panel.video_prompt || null,
    photographyRules: panel.photographyRules ?? null,
    actingNotes: panel.actingNotes ?? null,
    sourceText: panel.source_text,
  }
}

export function useStoryboardState({
  projectId,
  episodeId,
  initialStoryboards,
  clips,
}: UseStoryboardStateProps) {
  const queryClient = useQueryClient()
  const localStoryboards = useMemo(
    () => sortStoryboardsByClipOrder(initialStoryboards, clips),
    [clips, initialStoryboards],
  )
  const clipById = useMemo(() => new Map(clips.map((clip) => [clip.id, clip])), [clips])

  const setLocalStoryboards = useCallback<React.Dispatch<React.SetStateAction<NovelPromotionStoryboard[]>>>(
    (nextStoryboardsOrUpdater) => {
      const resolveNextStoryboards = (previousStoryboards: NovelPromotionStoryboard[]) => (
        typeof nextStoryboardsOrUpdater === 'function'
          ? (nextStoryboardsOrUpdater as (previous: NovelPromotionStoryboard[]) => NovelPromotionStoryboard[])(previousStoryboards)
          : nextStoryboardsOrUpdater
      )

      queryClient.setQueryData(queryKeys.episodeData(projectId, episodeId), (previous: unknown) => {
        if (!previous || typeof previous !== 'object') return previous
        const episode = previous as { storyboards?: NovelPromotionStoryboard[] }
        const previousStoryboards = Array.isArray(episode.storyboards) ? episode.storyboards : []
        const nextStoryboards = resolveNextStoryboards(previousStoryboards)
        if (nextStoryboards === previousStoryboards) return previous
        return {
          ...episode,
          storyboards: nextStoryboards,
        }
      })

      queryClient.setQueryData(queryKeys.storyboards.all(episodeId), (previous: unknown) => {
        if (!previous || typeof previous !== 'object') return previous
        const payload = previous as { storyboards?: NovelPromotionStoryboard[] }
        const previousStoryboards = Array.isArray(payload.storyboards) ? payload.storyboards : []
        const nextStoryboards = resolveNextStoryboards(previousStoryboards)
        if (nextStoryboards === previousStoryboards) return previous
        return {
          ...payload,
          storyboards: nextStoryboards,
        }
      })
    },
    [episodeId, projectId, queryClient],
  )

  const [expandedClips, setExpandedClips] = useState<Set<string>>(new Set())
  const [panelEdits, setPanelEdits] = useState<Record<string, PanelEditData>>({})

  // Keep latest panel edits for async callbacks without adding unstable deps.
  const panelEditsRef = useRef<Record<string, PanelEditData>>({})
  panelEditsRef.current = panelEdits

  const textPanelsByStoryboardId = useMemo(() => {
    const panelsByStoryboardId = new Map<string, StoryboardPanel[]>()

    localStoryboards.forEach((storyboard) => {
      const panels = getStoryboardPanels(storyboard)
      const sortedPanels = panels.length > 1
        ? [...panels].sort((a, b) => (a.panelIndex || 0) - (b.panelIndex || 0))
        : panels

      panelsByStoryboardId.set(storyboard.id, sortedPanels.map(toStoryboardPanel))
    })

    return panelsByStoryboardId
  }, [localStoryboards])

  const panelImagesByStoryboardId = useMemo(() => {
    const imagesByStoryboardId = new Map<string, Array<string | null>>()

    textPanelsByStoryboardId.forEach((panels, storyboardId) => {
      imagesByStoryboardId.set(storyboardId, panels.map((panel) => panel.imageUrl || null))
    })

    return imagesByStoryboardId
  }, [textPanelsByStoryboardId])

  const basePanelEditDataById = useMemo(() => {
    const panelEditDataById = new Map<string, PanelEditData>()

    textPanelsByStoryboardId.forEach((panels) => {
      panels.forEach((panel) => {
        panelEditDataById.set(panel.id, toPanelEditData(panel))
      })
    })

    return panelEditDataById
  }, [textPanelsByStoryboardId])

  useEffect(() => {
    setPanelEdits((previous) => {
      let changed = false
      const next: Record<string, PanelEditData> = {}

      for (const [panelId, currentEdit] of Object.entries(previous)) {
        const latestBase = basePanelEditDataById.get(panelId)
        if (!latestBase) {
          changed = true
          continue
        }

        const syncedEdit =
          currentEdit.panelIndex !== latestBase.panelIndex || currentEdit.panelNumber !== latestBase.panelNumber
            ? {
              ...currentEdit,
              panelIndex: latestBase.panelIndex,
              panelNumber: latestBase.panelNumber,
            }
            : currentEdit

        if (syncedEdit !== currentEdit) {
          changed = true
        }

        next[panelId] = syncedEdit
      }

      return changed ? next : previous
    })
  }, [basePanelEditDataById])

  const getClipInfo = useCallback((clipId: string) => clipById.get(clipId), [clipById])

  const getPanelImages = useCallback(
    (storyboard: NovelPromotionStoryboard): Array<string | null> => panelImagesByStoryboardId.get(storyboard.id) ?? [],
    [panelImagesByStoryboardId],
  )

  const getTextPanels = useCallback(
    (storyboard: NovelPromotionStoryboard): StoryboardPanel[] => textPanelsByStoryboardId.get(storyboard.id) ?? [],
    [textPanelsByStoryboardId],
  )

  const getPanelEditData = useCallback((panel: StoryboardPanel): PanelEditData => {
    return panelEdits[panel.id] ?? basePanelEditDataById.get(panel.id) ?? toPanelEditData(panel)
  }, [basePanelEditDataById, panelEdits])

  const updatePanelEdit = useCallback((panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => {
    setPanelEdits((previous) => {
      const currentData = previous[panelId] ?? basePanelEditDataById.get(panelId) ?? toPanelEditData(panel)
      const nextData = { ...currentData, ...updates }
      const hasChanged = Object.keys(updates).some((key) => {
        const typedKey = key as keyof PanelEditData
        return currentData[typedKey] !== nextData[typedKey]
      })
      if (!hasChanged) return previous
      return {
        ...previous,
        [panelId]: nextData,
      }
    })
  }, [basePanelEditDataById])

  const toggleExpandedClip = useCallback((storyboardId: string) => {
    setExpandedClips((previous) => {
      const next = new Set(previous)
      if (next.has(storyboardId)) {
        next.delete(storyboardId)
      } else {
        next.add(storyboardId)
      }
      return next
    })
  }, [])

  const sortedStoryboards = useMemo(() => localStoryboards, [localStoryboards])
  const totalPanels = useMemo(() => computeTotalPanels(localStoryboards), [localStoryboards])
  const storyboardStartIndex = useMemo(() => computeStoryboardStartIndex(sortedStoryboards), [sortedStoryboards])

  return {
    localStoryboards,
    setLocalStoryboards,
    sortedStoryboards,
    expandedClips,
    toggleExpandedClip,
    panelEdits,
    setPanelEdits,
    panelEditsRef,
    getClipInfo,
    getPanelImages,
    getTextPanels,
    getPanelEditData,
    updatePanelEdit,
    formatClipTitle,
    totalPanels,
    storyboardStartIndex,
  }
}
