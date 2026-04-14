'use client'
import { useTranslations } from 'next-intl'

import { memo, useCallback, useMemo } from 'react'
import ScreenplayDisplay from './ScreenplayDisplay'
import { StoryboardPanel } from './hooks/useStoryboardState'
import StoryboardGroupHeader from './StoryboardGroupHeader'
import StoryboardGroupActions from './StoryboardGroupActions'
import StoryboardPanelList from './StoryboardPanelList'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import TaskStatusOverlay from '@/components/task/TaskStatusOverlay'
import { useStoryboardGroupTaskErrors } from './hooks/useStoryboardGroupTaskErrors'
import { useStoryboardInsertVariantRuntime } from './hooks/useStoryboardInsertVariantRuntime'
import StoryboardGroupFailedAlert from './StoryboardGroupFailedAlert'
import StoryboardGroupDialogs from './StoryboardGroupDialogs'
import type { StoryboardGroupProps } from './StoryboardGroup.types'
import { AppIcon } from '@/components/ui/icons'

function areStoryboardGroupPropsEqual(previous: StoryboardGroupProps, next: StoryboardGroupProps) {
  if (
    previous.storyboard !== next.storyboard ||
    previous.clip !== next.clip ||
    previous.sbIndex !== next.sbIndex ||
    previous.totalStoryboards !== next.totalStoryboards ||
    previous.textPanels !== next.textPanels ||
    previous.storyboardStartIndex !== next.storyboardStartIndex ||
    previous.videoRatio !== next.videoRatio ||
    previous.isExpanded !== next.isExpanded ||
    previous.isSubmittingStoryboardTask !== next.isSubmittingStoryboardTask ||
    previous.isSelectingCandidate !== next.isSelectingCandidate ||
    previous.isSubmittingStoryboardTextTask !== next.isSubmittingStoryboardTextTask ||
    previous.hasAnyImage !== next.hasAnyImage ||
    previous.failedError !== next.failedError ||
    previous.savingPanels !== next.savingPanels ||
    previous.deletingPanelIds !== next.deletingPanelIds ||
    previous.movingPanelId !== next.movingPanelId ||
    previous.creatingPanelAfterId !== next.creatingPanelAfterId ||
    previous.creatingPanelStoryboardId !== next.creatingPanelStoryboardId ||
    previous.isCreatingPanel !== next.isCreatingPanel ||
    previous.saveStateByPanel !== next.saveStateByPanel ||
    previous.hasUnsavedByPanel !== next.hasUnsavedByPanel ||
    previous.uploadingPanels !== next.uploadingPanels ||
    previous.modifyingPanels !== next.modifyingPanels ||
    previous.submittingPanelImageIds !== next.submittingPanelImageIds ||
    previous.movingClipId !== next.movingClipId ||
    previous.insertingAfterPanelId !== next.insertingAfterPanelId ||
    previous.projectId !== next.projectId ||
    previous.episodeId !== next.episodeId ||
    previous.submittingVariantPanelId !== next.submittingVariantPanelId
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

function StoryboardGroup({
  storyboard,
  clip,
  sbIndex,
  totalStoryboards,
  textPanels,
  storyboardStartIndex,
  videoRatio,
  isExpanded,
  panelEdits,
  panelCandidateIndex,
  isSubmittingStoryboardTask,
  isSelectingCandidate,
  isSubmittingStoryboardTextTask,
  hasAnyImage,
  failedError,
  savingPanels,
  deletingPanelIds,
  movingPanelId,
  creatingPanelAfterId,
  creatingPanelStoryboardId,
  isCreatingPanel,
  saveStateByPanel,
  hasUnsavedByPanel,
  uploadingPanels,
  modifyingPanels,
  submittingPanelImageIds,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onRegenerateText,
  onAddPanel,
  onInsertBetween,
  onMovePanel,
  onDeleteStoryboard,
  onGenerateAllIndividually,
  onPreviewImage,
  onCloseError,
  getPanelEditData,
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
  getPanelCandidates,
  onSelectPanelCandidateIndex,
  onConfirmPanelCandidate,
  onCancelPanelCandidate,
  formatClipTitle,
  movingClipId,
  onInsertPanel,
  insertingAfterPanelId,
  projectId,
  episodeId,
  onPanelVariant,
  submittingVariantPanelId,
}: StoryboardGroupProps) {
  const t = useTranslations('storyboard')

  const {
    insertModalOpen,
    insertAfterPanel,
    nextPanelForInsert,
    variantModalPanel,
    handleOpenInsertModal,
    handleCloseInsertModal,
    handleInsert,
    handleOpenVariantModal,
    handleCloseVariantModal,
    handleVariant,
  } = useStoryboardInsertVariantRuntime({
    storyboardId: storyboard.id,
    textPanels,
    onInsertPanel,
    onPanelVariant,
  })

  const {
    panelTaskErrorMap,
    clearPanelTaskError,
  } = useStoryboardGroupTaskErrors({
    projectId,
    episodeId,
  })

  const isPanelTaskRunning = useCallback(
    (panel: StoryboardPanel) => {
      const taskIntent = (panel as StoryboardPanel & { imageTaskIntent?: string }).imageTaskIntent
      if (taskIntent === 'modify') return false

      const isTaskRunning = Boolean((panel as StoryboardPanel & { imageTaskRunning?: boolean }).imageTaskRunning)
      const isSubmitting = submittingPanelImageIds.has(panel.id)
      if (isTaskRunning || isSubmitting) return true

      const taskError = panelTaskErrorMap.get(panel.id)
      if (taskError) return false

      return false
    },
    [panelTaskErrorMap, submittingPanelImageIds],
  )

  const currentRunningCount = textPanels.filter(isPanelTaskRunning).length
  const pendingCount = textPanels.filter((panel) => !panel.imageUrl && !isPanelTaskRunning(panel)).length

  const groupOverlayState = useMemo(() => {
    if (!isSubmittingStoryboardTask && !isSelectingCandidate) return null
    return resolveTaskPresentationState({
      phase: 'processing',
      intent: isSelectingCandidate ? 'process' : hasAnyImage ? 'regenerate' : 'generate',
      resource: 'image',
      hasOutput: hasAnyImage,
    })
  }, [hasAnyImage, isSelectingCandidate, isSubmittingStoryboardTask])

  const handleRegeneratePanelImage = useCallback(
    (panelId: string, count?: number, force?: boolean) => {
      clearPanelTaskError(panelId)
      onRegeneratePanelImage(panelId, count, force)
    },
    [clearPanelTaskError, onRegeneratePanelImage],
  )

  return (
    <div
      className={`glass-surface-elevated p-6 relative ${failedError ? 'border-2 border-[var(--glass-stroke-danger)] bg-[var(--glass-danger-ring)]' : ''}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1280px' }}
    >
      {failedError && (
        <StoryboardGroupFailedAlert
          failedError={failedError}
          title={`警告 ${t('group.failed')}`}
          closeTitle={t('common.cancel')}
          onClose={onCloseError}
        />
      )}

      {(isSubmittingStoryboardTask || isSelectingCandidate) && (
        <TaskStatusOverlay
          state={groupOverlayState}
          className="z-10 rounded-lg bg-[var(--glass-bg-surface-modal)]/90"
        />
      )}

      <div className="mb-4 pb-2 flex items-start justify-between">
        <StoryboardGroupHeader
          clip={clip}
          sbIndex={sbIndex}
          totalStoryboards={totalStoryboards}
          movingClipId={movingClipId}
          storyboardClipId={storyboard.clipId}
          formatClipTitle={formatClipTitle}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
        <StoryboardGroupActions
          hasAnyImage={hasAnyImage}
          isSubmittingStoryboardTask={isSubmittingStoryboardTask}
          isSubmittingStoryboardTextTask={isSubmittingStoryboardTextTask}
          currentRunningCount={currentRunningCount}
          pendingCount={pendingCount}
          onRegenerateText={onRegenerateText}
          onGenerateAllIndividually={onGenerateAllIndividually}
          onAddPanel={onAddPanel}
          onDeleteStoryboard={onDeleteStoryboard}
          isCreatingPanel={isCreatingPanel}
        />
      </div>

      {clip && (
        <div className="mb-4">
          <button
            onClick={onToggleExpand}
            className="glass-btn-base glass-btn-soft rounded-xl px-3 py-2 text-sm"
          >
            <AppIcon name="chevronRightMd" className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            <span>{clip.screenplay ? t('panel.stylePrompt') : t('panel.sourceText')}</span>
          </button>
          {isExpanded && (
            <div className="mt-2 glass-surface-soft p-2">
              {clip.screenplay ? (
                <ScreenplayDisplay screenplay={clip.screenplay} originalContent={clip.content} />
              ) : (
                <div className="whitespace-pre-wrap p-3 text-sm text-[var(--glass-text-secondary)]">
                  {clip.content}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <StoryboardPanelList
        storyboardId={storyboard.id}
        textPanels={textPanels}
        storyboardStartIndex={storyboardStartIndex}
        videoRatio={videoRatio}
        panelEdits={panelEdits}
        panelCandidateIndex={panelCandidateIndex}
        isSubmittingStoryboardTextTask={isSubmittingStoryboardTextTask}
        savingPanels={savingPanels}
        deletingPanelIds={deletingPanelIds}
        saveStateByPanel={saveStateByPanel}
        hasUnsavedByPanel={hasUnsavedByPanel}
        uploadingPanels={uploadingPanels}
        modifyingPanels={modifyingPanels}
        panelTaskErrorMap={panelTaskErrorMap}
        isPanelTaskRunning={isPanelTaskRunning}
        getPanelEditData={getPanelEditData}
        getPanelCandidates={getPanelCandidates}
        onPanelUpdate={onPanelUpdate}
        onPanelDelete={onPanelDelete}
        onOpenCharacterPicker={onOpenCharacterPicker}
        onOpenLocationPicker={onOpenLocationPicker}
        onRemoveCharacter={onRemoveCharacter}
        onRemoveLocation={onRemoveLocation}
        onRetryPanelSave={onRetryPanelSave}
        onRegeneratePanelImage={handleRegeneratePanelImage}
        onUploadPanelImage={onUploadPanelImage}
        onOpenSourcePanelPicker={onOpenSourcePanelPicker}
        onOpenEditModal={onOpenEditModal}
        onOpenAIDataModal={onOpenAIDataModal}
        onSelectPanelCandidateIndex={onSelectPanelCandidateIndex}
        onConfirmPanelCandidate={onConfirmPanelCandidate}
        onCancelPanelCandidate={onCancelPanelCandidate}
        onClearPanelTaskError={clearPanelTaskError}
        onPreviewImage={onPreviewImage}
        onInsertBetween={onInsertBetween}
        onInsertAfter={handleOpenInsertModal}
        onMoveUp={(panelId) => onMovePanel(panelId, 'up')}
        onMoveDown={(panelId) => onMovePanel(panelId, 'down')}
        onVariant={handleOpenVariantModal}
        isInsertDisabled={(panelId) =>
          isSubmittingStoryboardTextTask ||
          isCreatingPanel ||
          creatingPanelAfterId === panelId ||
          movingPanelId === panelId ||
          insertingAfterPanelId === panelId ||
          submittingVariantPanelId === panelId
        }
        isMoveDisabled={(panelId) =>
          isSubmittingStoryboardTextTask ||
          isCreatingPanel ||
          creatingPanelAfterId === panelId ||
          movingPanelId === panelId ||
          insertingAfterPanelId === panelId ||
          submittingVariantPanelId === panelId
        }
      />

      <StoryboardGroupDialogs
        insertAfterPanel={insertAfterPanel}
        nextPanelForInsert={nextPanelForInsert}
        insertModalOpen={insertModalOpen}
        insertingAfterPanelId={insertingAfterPanelId}
        onCloseInsertModal={handleCloseInsertModal}
        onInsert={handleInsert}
        variantModalPanel={variantModalPanel}
        projectId={projectId}
        submittingVariantPanelId={submittingVariantPanelId}
        onCloseVariantModal={handleCloseVariantModal}
        onVariant={handleVariant}
      />
    </div>
  )
}

export default memo(StoryboardGroup, areStoryboardGroupPropsEqual)
