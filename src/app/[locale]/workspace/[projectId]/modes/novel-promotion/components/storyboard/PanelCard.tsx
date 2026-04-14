'use client'

import React from 'react'
import { memo } from 'react'
import { useTranslations } from 'next-intl'
import PanelEditForm, { PanelEditData } from '../PanelEditForm'
import ImageSection from './ImageSection'
import PanelActionButtons from './PanelActionButtons'
import { StoryboardPanel } from './hooks/useStoryboardState'
import { GlassSurface } from '@/components/ui/primitives'
import { AppIcon } from '@/components/ui/icons'

interface PanelCandidateData {
  candidates: string[]
  selectedIndex: number
}

interface PanelCardProps {
  panel: StoryboardPanel
  panelData: PanelEditData
  imageUrl: string | null
  globalPanelNumber: number
  storyboardId: string
  videoRatio: string
  isSaving: boolean
  hasUnsavedChanges?: boolean
  saveErrorMessage?: string | null
  isDeleting: boolean
  isUploadingImage: boolean
  isModifying: boolean
  isSubmittingPanelImageTask: boolean
  failedError: string | null
  candidateData: PanelCandidateData | null
  previousImageUrl?: string | null
  onUpdate: (updates: Partial<PanelEditData>) => void
  onDelete: () => void
  onOpenCharacterPicker: () => void
  onOpenLocationPicker: () => void
  onRetrySave?: () => void
  onRemoveCharacter: (index: number) => void
  onRemoveLocation: () => void
  onRegeneratePanelImage: (panelId: string, count?: number, force?: boolean) => void
  onUploadImage: (panelId: string, file: File) => Promise<void>
  onOpenSourcePanelPicker: () => void
  onOpenEditModal: () => void
  onOpenAIDataModal: () => void
  onSelectCandidateIndex: (panelId: string, index: number) => void
  onConfirmCandidate: (panelId: string, imageUrl: string) => Promise<void>
  onCancelCandidate: (panelId: string) => void
  onClearError: () => void
  onUndo?: (panelId: string) => void
  onPreviewImage?: (url: string) => void
  onInsertAfter?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  onVariant?: () => void
  isInsertDisabled?: boolean
  isMoveDisabled?: boolean
}

function areCandidateDataEqual(previous: PanelCandidateData | null, next: PanelCandidateData | null) {
  if (previous === next) return true
  if (!previous || !next) return previous === next
  if (previous.selectedIndex !== next.selectedIndex) return false
  if (previous.candidates.length !== next.candidates.length) return false

  return previous.candidates.every((candidate, index) => candidate === next.candidates[index])
}

function arePanelCardPropsEqual(previous: PanelCardProps, next: PanelCardProps) {
  return (
    previous.panel === next.panel &&
    previous.panelData === next.panelData &&
    previous.imageUrl === next.imageUrl &&
    previous.globalPanelNumber === next.globalPanelNumber &&
    previous.storyboardId === next.storyboardId &&
    previous.videoRatio === next.videoRatio &&
    previous.isSaving === next.isSaving &&
    previous.hasUnsavedChanges === next.hasUnsavedChanges &&
    previous.saveErrorMessage === next.saveErrorMessage &&
    previous.isDeleting === next.isDeleting &&
    previous.isUploadingImage === next.isUploadingImage &&
    previous.isModifying === next.isModifying &&
    previous.isSubmittingPanelImageTask === next.isSubmittingPanelImageTask &&
    previous.failedError === next.failedError &&
    areCandidateDataEqual(previous.candidateData, next.candidateData) &&
    previous.previousImageUrl === next.previousImageUrl &&
    previous.isInsertDisabled === next.isInsertDisabled &&
    previous.canMoveUp === next.canMoveUp &&
    previous.canMoveDown === next.canMoveDown &&
    previous.isMoveDisabled === next.isMoveDisabled
  )
}

function PanelCard({
  panel,
  panelData,
  imageUrl,
  globalPanelNumber,
  storyboardId,
  videoRatio,
  isSaving,
  hasUnsavedChanges = false,
  saveErrorMessage = null,
  isDeleting,
  isUploadingImage,
  isModifying,
  isSubmittingPanelImageTask,
  failedError,
  candidateData,
  previousImageUrl,
  onUpdate,
  onDelete,
  onOpenCharacterPicker,
  onOpenLocationPicker,
  onRetrySave,
  onRemoveCharacter,
  onRemoveLocation,
  onRegeneratePanelImage,
  onUploadImage,
  onOpenSourcePanelPicker,
  onOpenEditModal,
  onOpenAIDataModal,
  onSelectCandidateIndex,
  onConfirmCandidate,
  onCancelCandidate,
  onClearError,
  onUndo,
  onPreviewImage,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onVariant,
  isInsertDisabled,
  isMoveDisabled,
}: PanelCardProps) {
  const t = useTranslations('storyboard')

  return (
    <GlassSurface
      variant="elevated"
      padded={false}
      className="relative h-full overflow-visible transition-all hover:shadow-[var(--glass-shadow-md)] group/card"
      data-storyboard-id={storyboardId}
    >
      {!isModifying && !isDeleting && (
        <button
          onClick={onDelete}
          className="absolute -top-2 -right-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity bg-[var(--glass-tone-danger-fg)] hover:bg-[var(--glass-tone-danger-fg)] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-md"
          title={t('panelActions.deleteShot')}
        >
          <AppIcon name="closeMd" className="h-3 w-3" />
        </button>
      )}

      <div className="relative group/panel-image">
        <ImageSection
          panelId={panel.id}
          imageUrl={imageUrl}
          globalPanelNumber={globalPanelNumber}
          shotType={panel.shot_type}
          videoRatio={videoRatio}
          isDeleting={isDeleting}
          isUploadingImage={isUploadingImage}
          isModifying={isModifying}
          isSubmittingPanelImageTask={isSubmittingPanelImageTask}
          failedError={failedError}
          candidateData={candidateData}
          previousImageUrl={previousImageUrl}
          onRegeneratePanelImage={onRegeneratePanelImage}
          onUploadImage={onUploadImage}
          onOpenSourcePanelPicker={onOpenSourcePanelPicker}
          onOpenEditModal={onOpenEditModal}
          onOpenAIDataModal={onOpenAIDataModal}
          onSelectCandidateIndex={onSelectCandidateIndex}
          onConfirmCandidate={onConfirmCandidate}
          onCancelCandidate={onCancelCandidate}
          onClearError={onClearError}
          onUndo={onUndo}
          onPreviewImage={onPreviewImage}
        />

        {(onInsertAfter || onVariant || onMoveUp || onMoveDown) && (
          <div className="pointer-events-none absolute right-2 top-1/2 z-30 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover/panel-image:pointer-events-auto group-hover/panel-image:opacity-100 group-focus-within/panel-image:pointer-events-auto group-focus-within/panel-image:opacity-100">
            <PanelActionButtons
              onInsertPanel={onInsertAfter || (() => {})}
              onMoveUp={onMoveUp || (() => {})}
              onMoveDown={onMoveDown || (() => {})}
              canMoveUp={canMoveUp ?? false}
              canMoveDown={canMoveDown ?? false}
              onVariant={onVariant || (() => {})}
              disabled={isInsertDisabled || isMoveDisabled}
              hasImage={!!imageUrl}
            />
          </div>
        )}
      </div>

      <div className="p-3">
        <PanelEditForm
          panelData={panelData}
          isSaving={isSaving}
          saveStatus={hasUnsavedChanges ? 'error' : (isSaving ? 'saving' : 'idle')}
          saveErrorMessage={saveErrorMessage}
          onRetrySave={onRetrySave}
          onUpdate={onUpdate}
          onOpenCharacterPicker={onOpenCharacterPicker}
          onOpenLocationPicker={onOpenLocationPicker}
          onRemoveCharacter={onRemoveCharacter}
          onRemoveLocation={onRemoveLocation}
        />
      </div>
    </GlassSurface>
  )
}

export default memo(PanelCard, arePanelCardPropsEqual)
