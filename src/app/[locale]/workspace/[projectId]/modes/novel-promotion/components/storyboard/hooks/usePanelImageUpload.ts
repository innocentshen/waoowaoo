'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { NovelPromotionStoryboard } from '@/types/project'
import { extractErrorMessage } from '@/lib/errors/extract'
import {
  getStoryboardPanels,
  isAbortError,
  updatePanelByIdInStoryboards,
} from './image-generation-runtime'

interface UploadPanelMutationLike {
  mutateAsync: (payload: { panelId: string; file: File }) => Promise<unknown>
}

interface UploadPanelImageResult {
  imageUrl?: string
}

interface UsePanelImageUploadParams {
  localStoryboards: NovelPromotionStoryboard[]
  setLocalStoryboards: React.Dispatch<React.SetStateAction<NovelPromotionStoryboard[]>>
  uploadPanelMutation: UploadPanelMutationLike
  setUploadingPanels: React.Dispatch<React.SetStateAction<Set<string>>>
  onSilentRefresh?: (() => void | Promise<void>) | null
  refreshEpisode: () => void
  refreshStoryboards: () => void
}

export function usePanelImageUpload({
  localStoryboards,
  setLocalStoryboards,
  uploadPanelMutation,
  setUploadingPanels,
  onSilentRefresh,
  refreshEpisode,
  refreshStoryboards,
}: UsePanelImageUploadParams) {
  const t = useTranslations('storyboard')

  const uploadPanelImage = useCallback(async (panelId: string, file: File) => {
    const panel = localStoryboards
      .flatMap((storyboard) => getStoryboardPanels(storyboard))
      .find((item) => item.id === panelId)

    if (!panel) {
      alert(t('messages.panelNotFound'))
      return
    }

    setUploadingPanels((previous) => new Set(previous).add(panelId))

    try {
      const data = await uploadPanelMutation.mutateAsync({ panelId, file })
      const result = (data || {}) as UploadPanelImageResult

      if (result.imageUrl) {
        setLocalStoryboards((previous) =>
          updatePanelByIdInStoryboards(previous, panelId, (currentPanel) => ({
            ...currentPanel,
            imageUrl: result.imageUrl as string,
            previousImageUrl: currentPanel.imageUrl || currentPanel.previousImageUrl || null,
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
    } catch (error: unknown) {
      if (isAbortError(error)) return
      alert(
        t('image.uploadFailedError', {
          error: extractErrorMessage(error, t('common.unknownError')),
        }),
      )
    } finally {
      setUploadingPanels((previous) => {
        const next = new Set(previous)
        next.delete(panelId)
        return next
      })
    }
  }, [
    localStoryboards,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
    setLocalStoryboards,
    setUploadingPanels,
    t,
    uploadPanelMutation,
  ])

  return {
    uploadPanelImage,
  }
}
