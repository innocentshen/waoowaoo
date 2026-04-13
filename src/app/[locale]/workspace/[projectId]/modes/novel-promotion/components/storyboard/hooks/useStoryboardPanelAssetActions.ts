'use client'

import { useCallback, useMemo } from 'react'
import { Character, Location, NovelPromotionClip, NovelPromotionStoryboard } from '@/types/project'
import { PanelEditData } from '../../PanelEditForm'
import { SelectedAsset } from './useImageGeneration'
import { StoryboardPanel } from './useStoryboardState'
import { buildDefaultAssetsForClip } from './storyboard-panel-asset-utils'
import { useStoryboardBatchPanelGeneration } from './useStoryboardBatchPanelGeneration'

interface UseStoryboardPanelAssetActionsProps {
  clips: NovelPromotionClip[]
  characters: Character[]
  locations: Location[]
  localStoryboards: NovelPromotionStoryboard[]
  sortedStoryboards: NovelPromotionStoryboard[]
  submittingPanelImageIds: Set<string>
  editingPanel: { storyboardId: string; panelIndex: number } | null
  setEditingPanel: (panel: { storyboardId: string; panelIndex: number } | null) => void
  setIsEpisodeBatchSubmitting: (value: boolean) => void
  getTextPanels: (storyboard: NovelPromotionStoryboard) => StoryboardPanel[]
  getPanelEditData: (panel: StoryboardPanel) => PanelEditData
  updatePanelEdit: (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => void
  debouncedSave: (panelId: string, storyboardId: string) => void
  regeneratePanelImage: (panelId: string, count?: number, force?: boolean) => Promise<void>
  modifyPanelImage: (
    storyboardId: string,
    panelIndex: number,
    prompt: string,
    images: string[],
    assets: SelectedAsset[],
  ) => Promise<void>
  addCharacterToPanel: (
    panel: StoryboardPanel,
    characterName: string,
    appearance: string,
    storyboardId: string,
    getPanelEditData: (panel: StoryboardPanel) => PanelEditData,
    updatePanelEdit: (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => void,
  ) => void
  removeCharacterFromPanel: (
    panel: StoryboardPanel,
    index: number,
    storyboardId: string,
    getPanelEditData: (panel: StoryboardPanel) => PanelEditData,
    updatePanelEdit: (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => void,
  ) => void
  setPanelLocation: (
    panel: StoryboardPanel,
    locationName: string | null,
    storyboardId: string,
    updatePanelEdit: (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => void,
  ) => void
  assetPickerPanel: {
    panelId: string
    type: 'character' | 'location'
  } | null
  setAssetPickerPanel: (panel: { panelId: string; type: 'character' | 'location' } | null) => void
}

export function useStoryboardPanelAssetActions({
  clips,
  characters,
  locations,
  localStoryboards,
  sortedStoryboards,
  submittingPanelImageIds,
  editingPanel,
  setEditingPanel,
  setIsEpisodeBatchSubmitting,
  getTextPanels,
  getPanelEditData,
  updatePanelEdit,
  debouncedSave,
  regeneratePanelImage,
  modifyPanelImage,
  addCharacterToPanel,
  removeCharacterFromPanel,
  setPanelLocation,
  assetPickerPanel,
  setAssetPickerPanel,
}: UseStoryboardPanelAssetActionsProps) {
  const panelRuntimeById = useMemo(() => {
    const runtimeById = new Map<string, { storyboardId: string; panel: StoryboardPanel }>()

    localStoryboards.forEach((storyboard) => {
      getTextPanels(storyboard).forEach((panel) => {
        runtimeById.set(panel.id, { storyboardId: storyboard.id, panel })
      })
    })

    return runtimeById
  }, [getTextPanels, localStoryboards])

  const getDefaultAssetsForClip = useCallback(
    (clipId: string): SelectedAsset[] =>
      buildDefaultAssetsForClip({ clipId, clips, characters, locations }),
    [characters, clips, locations],
  )

  const handleEditSubmit = useCallback(
    async (prompt: string, images: string[], assets: SelectedAsset[]) => {
      if (!editingPanel) return
      const { storyboardId, panelIndex } = editingPanel
      setEditingPanel(null)
      await modifyPanelImage(storyboardId, panelIndex, prompt, images, assets)
    },
    [editingPanel, modifyPanelImage, setEditingPanel],
  )

  const handlePanelUpdate = useCallback(
    (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => {
      updatePanelEdit(panelId, panel, updates)
      const panelRuntime = panelRuntimeById.get(panelId)
      if (panelRuntime) {
        debouncedSave(panelId, panelRuntime.storyboardId)
      }
    },
    [debouncedSave, panelRuntimeById, updatePanelEdit],
  )

  const handleAddCharacter = useCallback(
    (characterName: string, appearance: string) => {
      if (!assetPickerPanel || assetPickerPanel.type !== 'character') return

      const panelRuntime = panelRuntimeById.get(assetPickerPanel.panelId)

      if (panelRuntime) {
        addCharacterToPanel(
          panelRuntime.panel,
          characterName,
          appearance,
          panelRuntime.storyboardId,
          getPanelEditData,
          updatePanelEdit,
        )
      }
      setAssetPickerPanel(null)
    },
    [
      addCharacterToPanel,
      assetPickerPanel,
      getPanelEditData,
      panelRuntimeById,
      setAssetPickerPanel,
      updatePanelEdit,
    ],
  )

  const handleSetLocation = useCallback(
    (locationName: string) => {
      if (!assetPickerPanel || assetPickerPanel.type !== 'location') return

      const panelRuntime = panelRuntimeById.get(assetPickerPanel.panelId)

      if (panelRuntime) {
        setPanelLocation(panelRuntime.panel, locationName, panelRuntime.storyboardId, updatePanelEdit)
      }
      setAssetPickerPanel(null)
    },
    [assetPickerPanel, panelRuntimeById, setAssetPickerPanel, setPanelLocation, updatePanelEdit],
  )

  const handleRemoveCharacter = useCallback(
    (panel: StoryboardPanel, index: number, storyboardId: string) => {
      removeCharacterFromPanel(panel, index, storyboardId, getPanelEditData, updatePanelEdit)
    },
    [getPanelEditData, removeCharacterFromPanel, updatePanelEdit],
  )

  const handleRemoveLocation = useCallback(
    (panel: StoryboardPanel, storyboardId: string) => {
      setPanelLocation(panel, null, storyboardId, updatePanelEdit)
    },
    [setPanelLocation, updatePanelEdit],
  )
  const { runningCount, pendingPanelCount, handleGenerateAllPanels } =
    useStoryboardBatchPanelGeneration({
      sortedStoryboards,
      submittingPanelImageIds,
      getTextPanels,
      regeneratePanelImage,
      setIsEpisodeBatchSubmitting,
    })

  return {
    getDefaultAssetsForClip,
    handleEditSubmit,
    handlePanelUpdate,
    handleAddCharacter,
    handleSetLocation,
    handleRemoveCharacter,
    handleRemoveLocation,
    runningCount,
    pendingPanelCount,
    handleGenerateAllPanels,
  }
}
