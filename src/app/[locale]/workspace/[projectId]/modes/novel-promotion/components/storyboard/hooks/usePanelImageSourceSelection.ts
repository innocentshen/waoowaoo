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

interface SelectPanelSourceMutationLike {
  mutateAsync: (payload: { targetPanelId: string; sourcePanelId: string }) => Promise<unknown>
}

interface SelectPanelSourceResult {
  imageUrl?: string | null
}

interface UsePanelImageSourceSelectionParams {
  localStoryboards: NovelPromotionStoryboard[]
  setLocalStoryboards: React.Dispatch<React.SetStateAction<NovelPromotionStoryboard[]>>
  selectPanelSourceMutation: SelectPanelSourceMutationLike
  setUploadingPanels: React.Dispatch<React.SetStateAction<Set<string>>>
  onSilentRefresh?: (() => void | Promise<void>) | null
  refreshEpisode: () => void
  refreshStoryboards: () => void
}

export function usePanelImageSourceSelection({
  localStoryboards,
  setLocalStoryboards,
  selectPanelSourceMutation,
  setUploadingPanels,
  onSilentRefresh,
  refreshEpisode,
  refreshStoryboards,
}: UsePanelImageSourceSelectionParams) {
  const t = useTranslations('storyboard')

  const selectPanelSourceImage = useCallback(async (targetPanelId: string, sourcePanelId: string): Promise<boolean> => {
    const targetPanel = localStoryboards
      .flatMap((storyboard) => getStoryboardPanels(storyboard))
      .find((panel) => panel.id === targetPanelId)

    if (!targetPanel) {
      alert(t('messages.panelNotFound'))
      return false
    }

    setUploadingPanels((previous) => new Set(previous).add(targetPanelId))

    try {
      const data = await selectPanelSourceMutation.mutateAsync({ targetPanelId, sourcePanelId })
      const result = (data || {}) as SelectPanelSourceResult

      if (result.imageUrl) {
        setLocalStoryboards((previous) =>
          updatePanelByIdInStoryboards(previous, targetPanelId, (currentPanel) => ({
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
      return true
    } catch (error: unknown) {
      if (isAbortError(error)) return false
      alert(
        t('image.chooseShotFailedError', {
          error: extractErrorMessage(error, t('common.unknownError')),
        }),
      )
      return false
    } finally {
      setUploadingPanels((previous) => {
        const next = new Set(previous)
        next.delete(targetPanelId)
        return next
      })
    }
  }, [
    localStoryboards,
    onSilentRefresh,
    refreshEpisode,
    refreshStoryboards,
    selectPanelSourceMutation,
    setLocalStoryboards,
    setUploadingPanels,
    t,
  ])

  return {
    selectPanelSourceImage,
  }
}
