'use client'

import { useState } from 'react'

export function useStoryboardStageUiState() {
  const [assetPickerPanel, setAssetPickerPanel] = useState<{
    panelId: string
    type: 'character' | 'location'
  } | null>(null)

  const [sourcePanelPickerPanelId, setSourcePanelPickerPanelId] = useState<string | null>(null)
  const [historyPanelPickerPanelId, setHistoryPanelPickerPanelId] = useState<string | null>(null)

  const [aiDataPanel, setAIDataPanel] = useState<{
    storyboardId: string
    panelIndex: number
  } | null>(null)

  const [isEpisodeBatchSubmitting, setIsEpisodeBatchSubmitting] = useState(false)

  return {
    assetPickerPanel,
    setAssetPickerPanel,
    sourcePanelPickerPanelId,
    setSourcePanelPickerPanelId,
    historyPanelPickerPanelId,
    setHistoryPanelPickerPanelId,
    aiDataPanel,
    setAIDataPanel,
    isEpisodeBatchSubmitting,
    setIsEpisodeBatchSubmitting,
  }
}
