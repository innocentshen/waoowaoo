'use client'

import { useQueryClient } from '@tanstack/react-query'
import { logError as _ulogError } from '@/lib/logging/core'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { NovelPromotionStoryboard } from '@/types/project'
import { apiFetch } from '@/lib/api-fetch'
import { queryKeys } from '@/lib/query/keys'
import { clearTaskTargetOverlay } from '@/lib/query/task-target-overlay'
import { extractErrorMessage } from '@/lib/errors/extract'
import { usePanelCandidates } from './usePanelCandidates'
import {
  useClearProjectStoryboardError,
  useRefreshProjectAssets,
  useRefreshEpisodeData,
  useRefreshStoryboards,
  useRegenerateProjectPanelImage,
  useSelectProjectStoryboardSourceImage,
  useUploadProjectStoryboardPanelImage,
  useModifyProjectStoryboardImage,
  useDownloadProjectImages,
  useSelectProjectPanelHistoryImage,
} from '@/lib/query/hooks'
import {
  clearPanelImageTaskStateInStoryboards,
  getRunningPanelImageTaskIdMap,
  getStoryboardPanels,
  reconcileModifyingPanelIds,
  reconcileSubmittingPanelImageIds,
  updatePanelByIdInStoryboards,
} from './image-generation-runtime'
import { usePanelImageRegeneration } from './usePanelImageRegeneration'
import { usePanelImageUpload } from './usePanelImageUpload'
import { usePanelImageSourceSelection } from './usePanelImageSourceSelection'
import { usePanelImageModification } from './usePanelImageModification'
import { usePanelImageDownload } from './usePanelImageDownload'

export interface SelectedAsset {
  id: string
  name: string
  type: 'character' | 'location'
  imageUrl: string | null
  appearanceId?: number
  appearanceName?: string
}

interface UseStoryboardImageGenerationProps {
  projectId: string
  episodeId?: string
  localStoryboards: NovelPromotionStoryboard[]
  setLocalStoryboards: React.Dispatch<React.SetStateAction<NovelPromotionStoryboard[]>>
}

export function useStoryboardImageGeneration({
  projectId,
  episodeId,
  localStoryboards,
  setLocalStoryboards,
}: UseStoryboardImageGenerationProps) {
  const t = useTranslations('storyboard')
  const onSilentRefresh = useRefreshProjectAssets(projectId)
  const refreshEpisode = useRefreshEpisodeData(projectId, episodeId ?? null)
  const refreshStoryboards = useRefreshStoryboards(episodeId ?? null)
  const regeneratePanelMutation = useRegenerateProjectPanelImage(projectId)
  const selectPanelSourceMutation = useSelectProjectStoryboardSourceImage(projectId)
  const selectPanelHistoryMutation = useSelectProjectPanelHistoryImage(projectId)
  const uploadPanelMutation = useUploadProjectStoryboardPanelImage(projectId)
  const modifyPanelMutation = useModifyProjectStoryboardImage(projectId)
  const downloadImagesMutation = useDownloadProjectImages(projectId)
  const clearStoryboardErrorMutation = useClearProjectStoryboardError(projectId)
  const queryClient = useQueryClient()

  const submittingStoryboardIds = useMemo(
    () => new Set<string>(
      localStoryboards
        .filter((storyboard) => storyboard.storyboardTaskRunning)
        .map((storyboard) => storyboard.id),
    ),
    [localStoryboards],
  )

  const [submittingPanelImageIds, setSubmittingPanelImageIds] = useState<Set<string>>(new Set())
  const [selectingCandidateIds] = useState<Set<string>>(new Set())
  const [editingPanel, setEditingPanel] = useState<{ storyboardId: string; panelIndex: number } | null>(null)
  const [uploadingPanels, setUploadingPanels] = useState<Set<string>>(new Set())
  const [modifyingPanels, setModifyingPanels] = useState<Set<string>>(new Set())
  const [cancelingPanelImageIds, setCancelingPanelImageIds] = useState<Set<string>>(new Set())
  const [isCancelingAllPanelImageTasks, setIsCancelingAllPanelImageTasks] = useState(false)
  const [isDownloadingImages, setIsDownloadingImages] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const runningPanelImageTaskIds = useMemo(
    () => getRunningPanelImageTaskIdMap(localStoryboards),
    [localStoryboards],
  )
  const cancelablePanelImageTaskIds = useMemo(
    () => new Set(runningPanelImageTaskIds.keys()),
    [runningPanelImageTaskIds],
  )

  const {
    panelCandidateIndex,
    setPanelCandidateIndex,
    getPanelCandidates,
    ensurePanelCandidatesInitialized,
    selectPanelCandidateIndex,
    confirmPanelCandidate,
    cancelPanelCandidate,
  } = usePanelCandidates({
    projectId,
    episodeId,
    onConfirmed: (panelId, confirmedImageUrl) => {
      setLocalStoryboards((previousStoryboards) =>
        previousStoryboards.map((storyboard) => {
          const panels = getStoryboardPanels(storyboard)
          let changed = false
          const updatedPanels = panels.map((panel) => {
            if (panel.id !== panelId) return panel
            changed = true
            return {
              ...panel,
              imageUrl: confirmedImageUrl ?? panel.imageUrl,
              candidateImages: null,
              imageTaskRunning: false,
            }
          })
          return changed ? { ...storyboard, panels: updatedPanels } : storyboard
        }),
      )
    },
  })

  useEffect(() => {
    localStoryboards.forEach((storyboard) => {
      getStoryboardPanels(storyboard).forEach((panel) => {
        ensurePanelCandidatesInitialized(panel)
      })
    })
  }, [ensurePanelCandidatesInitialized, localStoryboards])

  useEffect(() => {
    if (submittingPanelImageIds.size === 0) return
    setSubmittingPanelImageIds((previousIds) =>
      reconcileSubmittingPanelImageIds(previousIds, localStoryboards),
    )
  }, [localStoryboards, submittingPanelImageIds.size])

  useEffect(() => {
    if (modifyingPanels.size === 0) return
    setModifyingPanels((previousIds) => reconcileModifyingPanelIds(previousIds, localStoryboards))
  }, [localStoryboards, modifyingPanels.size])

  const { regeneratePanelImage, regenerateAllPanelsIndividually } = usePanelImageRegeneration({
    localStoryboards,
    setLocalStoryboards,
    submittingPanelImageIds,
    setSubmittingPanelImageIds,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
    regeneratePanelMutation,
    selectPanelCandidateIndex,
  })

  const { modifyPanelImage } = usePanelImageModification({
    localStoryboards,
    setLocalStoryboards,
    modifyPanelMutation,
    setModifyingPanels,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
  })

  const { uploadPanelImage } = usePanelImageUpload({
    localStoryboards,
    setLocalStoryboards,
    uploadPanelMutation,
    setUploadingPanels,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
  })

  const { selectPanelSourceImage } = usePanelImageSourceSelection({
    localStoryboards,
    setLocalStoryboards,
    selectPanelSourceMutation,
    setUploadingPanels,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
  })

  const selectPanelHistoryImage = useCallback(async (panelId: string, selectedImageUrl: string): Promise<boolean> => {
    const panel = localStoryboards
      .flatMap((storyboard) => getStoryboardPanels(storyboard))
      .find((item) => item.id === panelId)

    if (!panel) {
      return false
    }

    try {
      const data = await selectPanelHistoryMutation.mutateAsync({ panelId, selectedImageUrl })
      const result = (data || {}) as { imageUrl?: string | null }

      if (result.imageUrl) {
        setLocalStoryboards((previous) =>
          updatePanelByIdInStoryboards(previous, panelId, (currentPanel) => ({
            ...currentPanel,
            imageUrl: result.imageUrl as string,
            candidateImages: null,
            imageTaskRunning: false,
            imageErrorMessage: null,
          })),
        )
      }

      if (onSilentRefresh) {
        await onSilentRefresh()
      }
      refreshEpisode()
      refreshStoryboards()
      return true
    } catch (error: unknown) {
      alert(
        t('image.historyFailedError', {
          error: extractErrorMessage(error, t('common.unknownError')),
        }),
      )
      return false
    }
  }, [
    localStoryboards,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
    selectPanelHistoryMutation,
    setLocalStoryboards,
    t,
  ])

  const { downloadAllImages } = usePanelImageDownload({
    localStoryboards,
    downloadImagesMutation,
    setIsDownloadingImages,
  })

  const cancelPanelImageTasks = useCallback(async (panelIds: Iterable<string>) => {
    const targetPanelIds = Array.from(new Set(panelIds)).filter((panelId) => {
      return runningPanelImageTaskIds.has(panelId) && !cancelingPanelImageIds.has(panelId)
    })

    if (targetPanelIds.length === 0) return []

    setCancelingPanelImageIds((previous) => {
      const next = new Set(previous)
      targetPanelIds.forEach((panelId) => next.add(panelId))
      return next
    })

    try {
      const results = await Promise.allSettled(
        targetPanelIds.map(async (panelId) => {
          const taskId = runningPanelImageTaskIds.get(panelId)
          if (!taskId) throw new Error(`Missing running task id for panel ${panelId}`)

          const response = await apiFetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            const message =
              payload && typeof payload === 'object' && typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
                ? (payload as { error: { message: string } }).error.message
                : `Cancel image task failed: ${taskId}`
            throw new Error(message)
          }

          return panelId
        }),
      )

      const cancelledPanelIds = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      )

      if (cancelledPanelIds.length > 0) {
        cancelledPanelIds.forEach((panelId) => {
          clearTaskTargetOverlay(queryClient, {
            projectId,
            targetType: 'NovelPromotionPanel',
            targetId: panelId,
          })
        })

        setLocalStoryboards((previousStoryboards) =>
          clearPanelImageTaskStateInStoryboards(previousStoryboards, cancelledPanelIds),
        )

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.targetStatesAll(projectId), exact: false }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId), exact: false }),
        ])
        refreshEpisode()
        refreshStoryboards()
      }

      results.forEach((result) => {
        if (result.status === 'rejected') {
          _ulogError('[cancelPanelImageTasks] failed:', result.reason)
        }
      })

      return cancelledPanelIds
    } finally {
      setCancelingPanelImageIds((previous) => {
        const next = new Set(previous)
        targetPanelIds.forEach((panelId) => next.delete(panelId))
        return next
      })
    }
  }, [
    cancelingPanelImageIds,
    projectId,
    queryClient,
    refreshEpisode,
    refreshStoryboards,
    runningPanelImageTaskIds,
    setLocalStoryboards,
  ])

  const cancelPanelImageTask = useCallback(async (panelId: string) => {
    const [cancelledPanelId] = await cancelPanelImageTasks([panelId])
    return cancelledPanelId === panelId
  }, [cancelPanelImageTasks])

  const cancelAllRunningPanelImageTasks = useCallback(async () => {
    setIsCancelingAllPanelImageTasks(true)
    try {
      return await cancelPanelImageTasks(runningPanelImageTaskIds.keys())
    } finally {
      setIsCancelingAllPanelImageTasks(false)
    }
  }, [cancelPanelImageTasks, runningPanelImageTaskIds])

  const clearStoryboardError = useCallback(async (storyboardId: string) => {
    let snapshot: NovelPromotionStoryboard[] | null = null
    setLocalStoryboards((previousStoryboards) =>
      {
        snapshot = previousStoryboards
        return previousStoryboards.map((storyboard) =>
        storyboard.id === storyboardId ? { ...storyboard, lastError: null } : storyboard,
      )
      },
    )

    try {
      await clearStoryboardErrorMutation.mutateAsync({ storyboardId })
      if (onSilentRefresh) {
        await onSilentRefresh()
      }
      refreshEpisode()
      refreshStoryboards()
    } catch (error: unknown) {
      if (snapshot) {
        setLocalStoryboards(snapshot)
      }
      _ulogError('[clearStoryboardError] persist failed:', error)
    }
  }, [
    clearStoryboardErrorMutation,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
    setLocalStoryboards,
  ])

  return {
    submittingStoryboardIds,
    submittingPanelImageIds,
    selectingCandidateIds,
    panelCandidateIndex,
    setPanelCandidateIndex,
    editingPanel,
    setEditingPanel,
    uploadingPanels,
    modifyingPanels,
    cancelablePanelImageTaskIds,
    cancelingPanelImageIds,
    isCancelingAllPanelImageTasks,
    isDownloadingImages,
    previewImage,
    setPreviewImage,
    regeneratePanelImage,
    uploadPanelImage,
    selectPanelSourceImage,
    selectPanelHistoryImage,
    regenerateAllPanelsIndividually,
    selectPanelCandidate: confirmPanelCandidate,
    selectPanelCandidateIndex,
    cancelPanelCandidate,
    getPanelCandidates,
    modifyPanelImage,
    downloadAllImages,
    cancelPanelImageTask,
    cancelAllRunningPanelImageTasks,
    clearStoryboardError,
  }
}
