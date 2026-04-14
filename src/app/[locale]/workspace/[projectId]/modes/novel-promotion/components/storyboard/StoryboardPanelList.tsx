'use client'

import { memo, useMemo } from 'react'
import { NovelPromotionPanel } from '@/types/project'
import { StoryboardPanel } from './hooks/useStoryboardState'
import { PanelEditData } from '../PanelEditForm'
import { ASPECT_RATIO_CONFIGS } from '@/lib/constants'
import PanelCard from './PanelCard'
import InsertPanelButton from './InsertPanelButton'
import type { PanelSaveState } from './hooks/usePanelCrudActions'

const VERTICAL_PANEL_STYLE = {
  contentVisibility: 'auto',
  containIntrinsicSize: '520px',
} as const

const HORIZONTAL_PANEL_STYLE = {
  contentVisibility: 'auto',
  containIntrinsicSize: '420px',
} as const

interface StoryboardPanelListProps {
  storyboardId: string
  textPanels: StoryboardPanel[]
  storyboardStartIndex: number
  videoRatio: string
  panelEdits: Record<string, PanelEditData>
  panelCandidateIndex: Map<string, unknown>
  isSubmittingStoryboardTextTask: boolean
  savingPanels: Set<string>
  deletingPanelIds: Set<string>
  saveStateByPanel: Record<string, PanelSaveState>
  hasUnsavedByPanel: Set<string>
  uploadingPanels: Set<string>
  modifyingPanels: Set<string>
  panelTaskErrorMap: Map<string, { taskId: string; message: string }>
  isPanelTaskRunning: (panel: StoryboardPanel) => boolean
  getPanelEditData: (panel: StoryboardPanel) => PanelEditData
  getPanelCandidates: (panel: NovelPromotionPanel) => { candidates: string[]; selectedIndex: number } | null
  onPanelUpdate: (panelId: string, panel: StoryboardPanel, updates: Partial<PanelEditData>) => void
  onPanelDelete: (panelId: string) => void
  onOpenCharacterPicker: (panelId: string) => void
  onOpenLocationPicker: (panelId: string) => void
  onRemoveCharacter: (panel: StoryboardPanel, index: number) => void
  onRemoveLocation: (panel: StoryboardPanel) => void
  onRetryPanelSave: (panelId: string) => void
  onRegeneratePanelImage: (panelId: string, count?: number, force?: boolean) => void
  onUploadPanelImage: (panelId: string, file: File) => Promise<void>
  onOpenSourcePanelPicker: (panelId: string) => void
  onOpenEditModal: (panelIndex: number) => void
  onOpenAIDataModal: (panelIndex: number) => void
  onSelectPanelCandidateIndex: (panelId: string, index: number) => void
  onConfirmPanelCandidate: (panelId: string, imageUrl: string) => Promise<void>
  onCancelPanelCandidate: (panelId: string) => void
  onClearPanelTaskError: (panelId: string) => void
  onPreviewImage: (url: string) => void
  onInsertBetween: (panelId: string) => void
  onInsertAfter: (panelIndex: number) => void
  onMoveUp: (panelId: string) => void
  onMoveDown: (panelId: string) => void
  onVariant: (panelIndex: number) => void
  isInsertDisabled: (panelId: string) => boolean
  isMoveDisabled: (panelId: string) => boolean
}

function areStoryboardPanelListPropsEqual(previous: StoryboardPanelListProps, next: StoryboardPanelListProps) {
  if (
    previous.storyboardId !== next.storyboardId ||
    previous.textPanels !== next.textPanels ||
    previous.storyboardStartIndex !== next.storyboardStartIndex ||
    previous.videoRatio !== next.videoRatio ||
    previous.isSubmittingStoryboardTextTask !== next.isSubmittingStoryboardTextTask ||
    previous.savingPanels !== next.savingPanels ||
    previous.deletingPanelIds !== next.deletingPanelIds ||
    previous.saveStateByPanel !== next.saveStateByPanel ||
    previous.hasUnsavedByPanel !== next.hasUnsavedByPanel ||
    previous.uploadingPanels !== next.uploadingPanels ||
    previous.modifyingPanels !== next.modifyingPanels ||
    previous.panelTaskErrorMap !== next.panelTaskErrorMap
  ) {
    return false
  }

  for (const panel of next.textPanels) {
    if (previous.panelEdits[panel.id] !== next.panelEdits[panel.id]) {
      return false
    }
    if (previous.panelCandidateIndex.get(panel.id) !== next.panelCandidateIndex.get(panel.id)) {
      return false
    }
  }

  return true
}

function StoryboardPanelList(props: StoryboardPanelListProps) {
  const {
    storyboardId,
    textPanels,
    storyboardStartIndex,
    videoRatio,
    isSubmittingStoryboardTextTask,
    savingPanels,
    deletingPanelIds,
    saveStateByPanel,
    hasUnsavedByPanel,
    uploadingPanels,
    modifyingPanels,
    panelTaskErrorMap,
    isPanelTaskRunning,
    getPanelEditData,
    getPanelCandidates,
    onPanelUpdate,
    onPanelDelete,
    onOpenCharacterPicker,
    onOpenLocationPicker,
    onRemoveCharacter,
    onRemoveLocation,
    onRetryPanelSave,
    onRegeneratePanelImage,
    onUploadPanelImage,
    onOpenSourcePanelPicker,
    onOpenEditModal,
    onOpenAIDataModal,
    onSelectPanelCandidateIndex,
    onConfirmPanelCandidate,
    onCancelPanelCandidate,
    onClearPanelTaskError,
    onPreviewImage,
    onInsertBetween,
    onInsertAfter,
    onMoveUp,
    onMoveDown,
    onVariant,
    isInsertDisabled,
    isMoveDisabled,
  } = props

  const displayImages = useMemo(() => textPanels.map((panel) => panel.imageUrl || null), [textPanels])
  const isVertical = ASPECT_RATIO_CONFIGS[videoRatio]?.isVertical ?? false

  return (
    <div className={`grid gap-4 ${isVertical ? 'grid-cols-5' : 'grid-cols-3'} ${isSubmittingStoryboardTextTask ? 'opacity-50 pointer-events-none' : ''}`}>
      {textPanels.map((panel, index) => {
        const imageUrl = displayImages[index]
        const globalPanelNumber = storyboardStartIndex + index + 1
        const isPanelModifying =
          modifyingPanels.has(panel.id) ||
          Boolean(
            (panel as StoryboardPanel & { imageTaskRunning?: boolean; imageTaskIntent?: string }).imageTaskRunning &&
            (panel as StoryboardPanel & { imageTaskIntent?: string }).imageTaskIntent === 'modify',
          )
        const isPanelDeleting = deletingPanelIds.has(panel.id)
        const panelSaveState = saveStateByPanel[panel.id]
        const isPanelSaving = savingPanels.has(panel.id) || panelSaveState?.status === 'saving'
        const hasUnsavedChanges = hasUnsavedByPanel.has(panel.id) || panelSaveState?.status === 'error'
        const panelSaveError = panelSaveState?.errorMessage || null
        const panelTaskRunning = isPanelTaskRunning(panel)
        const taskError = panelTaskErrorMap.get(panel.id)
        const panelFailedError = taskError?.message || null
        const panelData = getPanelEditData(panel)
        const panelCandidateData = getPanelCandidates(panel as unknown as NovelPromotionPanel)

        return (
          <div
            key={panel.id || index}
            className="relative group/panel flex h-full flex-col"
            style={{
              zIndex: textPanels.length - index,
              ...(isVertical ? VERTICAL_PANEL_STYLE : HORIZONTAL_PANEL_STYLE),
            }}
          >
            <div className="flex-1">
              <PanelCard
                panel={panel}
                panelData={panelData}
                imageUrl={imageUrl}
                globalPanelNumber={globalPanelNumber}
                storyboardId={storyboardId}
                videoRatio={videoRatio}
                isSaving={isPanelSaving}
                hasUnsavedChanges={hasUnsavedChanges}
                saveErrorMessage={panelSaveError}
                isDeleting={isPanelDeleting}
                isUploadingImage={uploadingPanels.has(panel.id)}
                isModifying={isPanelModifying}
                isSubmittingPanelImageTask={panelTaskRunning}
                failedError={panelFailedError}
                candidateData={panelCandidateData}
                onUpdate={(updates) => onPanelUpdate(panel.id, panel, updates)}
                onDelete={() => onPanelDelete(panel.id)}
                onOpenCharacterPicker={() => onOpenCharacterPicker(panel.id)}
                onOpenLocationPicker={() => onOpenLocationPicker(panel.id)}
                onRetrySave={() => onRetryPanelSave(panel.id)}
                onRemoveCharacter={(characterIndex) => onRemoveCharacter(panel, characterIndex)}
                onRemoveLocation={() => onRemoveLocation(panel)}
                onRegeneratePanelImage={onRegeneratePanelImage}
                onUploadImage={onUploadPanelImage}
                onOpenSourcePanelPicker={() => onOpenSourcePanelPicker(panel.id)}
                onOpenEditModal={() => onOpenEditModal(index)}
                onOpenAIDataModal={() => onOpenAIDataModal(index)}
                onSelectCandidateIndex={onSelectPanelCandidateIndex}
                onConfirmCandidate={onConfirmPanelCandidate}
                onCancelCandidate={onCancelPanelCandidate}
                onClearError={() => onClearPanelTaskError(panel.id)}
                onPreviewImage={onPreviewImage}
                onInsertAfter={() => onInsertAfter(index)}
                onMoveUp={() => onMoveUp(panel.id)}
                onMoveDown={() => onMoveDown(panel.id)}
                canMoveUp={index > 0}
                canMoveDown={index < textPanels.length - 1}
                onVariant={() => onVariant(index)}
                isInsertDisabled={isInsertDisabled(panel.id)}
                isMoveDisabled={isMoveDisabled(panel.id)}
              />
            </div>

            {index < textPanels.length - 1 && (
              <div className="flex justify-center py-3">
                <InsertPanelButton
                  onClick={() => onInsertBetween(panel.id)}
                  disabled={isInsertDisabled(panel.id)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default memo(StoryboardPanelList, areStoryboardPanelListPropsEqual)
