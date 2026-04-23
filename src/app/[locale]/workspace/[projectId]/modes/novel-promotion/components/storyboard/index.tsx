'use client'

import { useMemo } from 'react'
import { NovelPromotionStoryboard, NovelPromotionClip } from '@/types/project'
import { usePreviousEpisodeStoryboardSources, type StoryboardSourceStoryboard } from '@/lib/query/hooks'
import { CharacterPickerModal, LocationPickerModal } from '../PanelEditForm'
import ImageEditModal from './ImageEditModal'
import AIDataModal from './AIDataModal'
import ImagePreviewModal from '@/components/ui/ImagePreviewModal'
import SelectStoryboardPanelImageModal, { type StoryboardSourceOptionGroup } from './SelectStoryboardPanelImageModal'
import SelectPanelHistoryImageModal from './SelectPanelHistoryImageModal'
import StoryboardStageShell from './StoryboardStageShell'
import StoryboardToolbar from './StoryboardToolbar'
import StoryboardCanvas from './StoryboardCanvas'
import { useStoryboardStageController } from './hooks/useStoryboardStageController'
import { useStoryboardModalRuntime } from './hooks/useStoryboardModalRuntime'

interface StoryboardStageProps {
  projectId: string
  episodeId: string
  storyboards: NovelPromotionStoryboard[]
  clips: NovelPromotionClip[]
  videoRatio: string
  onBack: () => void
  onNext: () => void
  isTransitioning?: boolean
}

function formatSourceStoryboardClipTitle(storyboard: StoryboardSourceStoryboard): string {
  const clip = storyboard.clip
  if (!clip) return '-'
  if (clip.start !== undefined && clip.start !== null) {
    return `${clip.start}-${clip.end}`
  }
  if (clip.startText && clip.endText) {
    const startPreview = clip.startText.substring(0, 10)
    const endPreview = clip.endText.substring(0, 10)
    return `${startPreview}...~...${endPreview}`
  }
  return clip.id.slice(0, 8)
}

export default function StoryboardStage({
  projectId,
  episodeId,
  storyboards: initialStoryboards,
  clips,
  videoRatio,
  onBack,
  onNext,
  isTransitioning = false,
}: StoryboardStageProps) {
  const controller = useStoryboardStageController({
    projectId,
    episodeId,
    initialStoryboards,
    clips,
    isTransitioning,
  })

  const {
    localStoryboards,
    setLocalStoryboards,
    sortedStoryboards,
    expandedClips,
    toggleExpandedClip,
    panelEdits,
    getClipInfo,
    getTextPanels,
    getPanelEditData,
    updatePanelEdit,
    formatClipTitle,
    totalPanels,
    storyboardStartIndex,

    savingPanels,
    deletingPanelIds,
    movingPanelId,
    creatingPanelAfterId,
    creatingPanelStoryboardId,
    isCreatingPanel,
    saveStateByPanel,
    hasUnsavedByPanel,
    submittingStoryboardTextIds,
    addingStoryboardGroup,
    movingClipId,
    insertingAfterPanelId,
    savePanelWithData,
    addPanel,
    movePanel,
    deletePanel,
    deleteStoryboard,
    regenerateStoryboardText,
    addStoryboardGroup,
    moveStoryboardGroup,
    insertPanel,

    submittingVariantPanelId,
    generatePanelVariant,

    panelCandidateIndex,
    submittingStoryboardIds,
    submittingPanelImageIds,
    selectingCandidateIds,

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
    selectPanelCandidate,
    selectPanelCandidateIndex,
    cancelPanelCandidate,
    getPanelCandidates,
    downloadAllImages,
    cancelPanelImageTask,
    cancelAllRunningPanelImageTasks,
    clearStoryboardError,

    assetPickerPanel,
    setAssetPickerPanel,
    sourcePanelPickerPanelId,
    setSourcePanelPickerPanelId,
    historyPanelPickerPanelId,
    setHistoryPanelPickerPanelId,
    aiDataPanel,
    setAIDataPanel,
    isEpisodeBatchSubmitting,

    getDefaultAssetsForClip,
    handleEditSubmit,
    handlePanelUpdate,
    handleAddCharacter,
    handleSetLocation,
    handleRemoveCharacter,
    handleRemoveLocation,
    retrySave,

    updatePhotographyPlanMutation,
    updatePanelActingNotesMutation,

    addingStoryboardGroupState,
    transitioningState,
    runningCount,
    pendingPanelCount,
    handleGenerateAllPanels,
  } = controller

  const { data: previousStoryboardSourcesData, isLoading: isLoadingPreviousStoryboardSources } = usePreviousEpisodeStoryboardSources(
    projectId,
    episodeId,
    !!sourcePanelPickerPanelId,
  )

  const modalRuntime = useStoryboardModalRuntime({
    projectId,
    videoRatio,
    localStoryboards,
    editingPanel,
    setEditingPanel,
    assetPickerPanel,
    setAssetPickerPanel,
    aiDataPanel,
    setAIDataPanel,
    previewImage,
    setPreviewImage,
    getTextPanels,
    getPanelEditData,
    updatePanelEdit,
    savePanelWithData,
    getDefaultAssetsForClip,
    handleEditSubmit,
    handleAddCharacter,
    handleSetLocation,
    updatePhotographyPlanMutation,
    updatePanelActingNotesMutation,
  })

  const storyboardSourceOptions = useMemo<StoryboardSourceOptionGroup[]>(() => {
    const currentStoryboards = sortedStoryboards.map((storyboard) => ({
      ...storyboard,
      sourceClipTitle: formatClipTitle(getClipInfo(storyboard.clipId)),
    }))

    const previousStoryboards = (previousStoryboardSourcesData?.storyboards || []).map((storyboard: StoryboardSourceStoryboard) => {
      const clipTitle = formatSourceStoryboardClipTitle(storyboard)
      const episodeNumber = storyboard.episode?.episodeNumber
      return {
        ...storyboard,
        sourceClipTitle: episodeNumber ? `第${episodeNumber}集 · ${clipTitle}` : clipTitle,
      }
    })

    return [...currentStoryboards, ...previousStoryboards]
  }, [
    formatClipTitle,
    getClipInfo,
    previousStoryboardSourcesData?.storyboards,
    sortedStoryboards,
  ])

  const historyPickerPanel = useMemo(() => {
    if (!historyPanelPickerPanelId) return null

    for (const storyboard of localStoryboards) {
      const panels = Array.isArray(storyboard.panels) ? storyboard.panels : []
      const matched = panels.find((panel) => panel.id === historyPanelPickerPanelId)
      if (matched) return matched
    }

    return null
  }, [historyPanelPickerPanelId, localStoryboards])

  return (
      <StoryboardStageShell
        isTransitioning={isTransitioning}
        isNextDisabled={isTransitioning || localStoryboards.length === 0}
        transitioningState={transitioningState}
        onNext={onNext}
      >
        <StoryboardToolbar
          totalSegments={sortedStoryboards.length}
          totalPanels={totalPanels}
          isDownloadingImages={isDownloadingImages}
          runningCount={runningCount}
          cancelableRunningCount={cancelablePanelImageTaskIds.size}
          pendingPanelCount={pendingPanelCount}
          isBatchSubmitting={isEpisodeBatchSubmitting}
          isCancelingAllPanelImageTasks={isCancelingAllPanelImageTasks}
          addingStoryboardGroup={addingStoryboardGroup}
          addingStoryboardGroupState={addingStoryboardGroupState}
          onDownloadAllImages={downloadAllImages}
          onGenerateAllPanels={handleGenerateAllPanels}
          onCancelAllRunningPanels={cancelAllRunningPanelImageTasks}
          onAddStoryboardGroupAtStart={() => addStoryboardGroup(0)}
          onBack={onBack}
        />

        <StoryboardCanvas
          sortedStoryboards={sortedStoryboards}
          videoRatio={videoRatio}
          expandedClips={expandedClips}
          panelEdits={panelEdits}
          panelCandidateIndex={panelCandidateIndex}
          submittingStoryboardIds={submittingStoryboardIds}
          selectingCandidateIds={selectingCandidateIds}
          submittingStoryboardTextIds={submittingStoryboardTextIds}
          savingPanels={savingPanels}
          deletingPanelIds={deletingPanelIds}
          movingPanelId={movingPanelId}
          creatingPanelAfterId={creatingPanelAfterId}
          creatingPanelStoryboardId={creatingPanelStoryboardId}
          isCreatingPanel={isCreatingPanel}
          saveStateByPanel={saveStateByPanel}
          hasUnsavedByPanel={hasUnsavedByPanel}
          uploadingPanels={uploadingPanels}
          modifyingPanels={modifyingPanels}
          submittingPanelImageIds={submittingPanelImageIds}
          cancelablePanelImageTaskIds={cancelablePanelImageTaskIds}
          cancelingPanelImageIds={cancelingPanelImageIds}

          movingClipId={movingClipId}
          insertingAfterPanelId={insertingAfterPanelId}
          submittingVariantPanelId={submittingVariantPanelId}
          projectId={projectId}
          episodeId={episodeId}
          storyboardStartIndex={storyboardStartIndex}
          getClipInfo={getClipInfo}
          getTextPanels={getTextPanels}
          getPanelEditData={getPanelEditData}
          formatClipTitle={formatClipTitle}
          onToggleExpandedClip={toggleExpandedClip}
          onMoveStoryboardGroup={moveStoryboardGroup}
          onRegenerateStoryboardText={regenerateStoryboardText}
          onAddPanel={addPanel}
          onMovePanel={movePanel}
          onDeleteStoryboard={deleteStoryboard}
          onGenerateAllIndividually={regenerateAllPanelsIndividually}
          onPreviewImage={setPreviewImage}
          onCloseStoryboardError={clearStoryboardError}
          onPanelUpdate={handlePanelUpdate}
          onPanelDelete={deletePanel}
          onOpenCharacterPicker={(panelId) => setAssetPickerPanel({ panelId, type: 'character' })}
          onOpenLocationPicker={(panelId) => setAssetPickerPanel({ panelId, type: 'location' })}
          onRemoveCharacter={handleRemoveCharacter}
          onRemoveLocation={handleRemoveLocation}
          onRetryPanelSave={retrySave}
          onRegeneratePanelImage={regeneratePanelImage}
          onCancelPanelImageTask={cancelPanelImageTask}
          onUploadPanelImage={uploadPanelImage}
          onOpenSourcePanelPicker={setSourcePanelPickerPanelId}
          onOpenHistoryPanelPicker={setHistoryPanelPickerPanelId}
          onOpenEditModal={(storyboardId, panelIndex) => setEditingPanel({ storyboardId, panelIndex })}
          onOpenAIDataModal={(storyboardId, panelIndex) => setAIDataPanel({ storyboardId, panelIndex })}
          getPanelCandidates={getPanelCandidates}
          onSelectPanelCandidateIndex={selectPanelCandidateIndex}
          onConfirmPanelCandidate={selectPanelCandidate}
          onCancelPanelCandidate={cancelPanelCandidate}

          onInsertPanel={insertPanel}
          onPanelVariant={generatePanelVariant}
          addStoryboardGroup={addStoryboardGroup}
          addingStoryboardGroup={addingStoryboardGroup}
          setLocalStoryboards={setLocalStoryboards}
        />

        {modalRuntime.editingPanel && (
          <ImageEditModal
            projectId={modalRuntime.projectId}
            defaultAssets={modalRuntime.imageEditDefaults}
            onSubmit={modalRuntime.handleEditSubmit}
            onClose={modalRuntime.closeImageEditModal}
          />
        )}

        {modalRuntime.aiDataPanel && modalRuntime.aiDataRuntime && (
          <AIDataModal
            isOpen={true}
            onClose={modalRuntime.closeAIDataModal}
            syncKey={modalRuntime.aiDataRuntime.panel.id}
            panelNumber={modalRuntime.aiDataRuntime.panelData.panelNumber || modalRuntime.aiDataPanel.panelIndex + 1}
            shotType={modalRuntime.aiDataRuntime.panelData.shotType}
            cameraMove={modalRuntime.aiDataRuntime.panelData.cameraMove}
            description={modalRuntime.aiDataRuntime.panelData.description}
            location={modalRuntime.aiDataRuntime.panelData.location}
            characters={modalRuntime.aiDataRuntime.characters}
            videoPrompt={modalRuntime.aiDataRuntime.panelData.videoPrompt}
            photographyRules={modalRuntime.aiDataRuntime.photographyRules}
            actingNotes={modalRuntime.aiDataRuntime.actingNotes}
            videoRatio={modalRuntime.videoRatio}
            onSave={modalRuntime.handleSaveAIData}
          />
        )}

        {modalRuntime.previewImage && (
          <ImagePreviewModal imageUrl={modalRuntime.previewImage} onClose={modalRuntime.closePreviewImage} />
        )}

        {sourcePanelPickerPanelId && (
          <SelectStoryboardPanelImageModal
            open={!!sourcePanelPickerPanelId}
            targetPanelId={sourcePanelPickerPanelId}
            storyboards={storyboardSourceOptions}
            videoRatio={videoRatio}
            isLoading={isLoadingPreviousStoryboardSources}
            onClose={() => setSourcePanelPickerPanelId(null)}
            onSelect={async (sourcePanelId) => {
              if (!sourcePanelPickerPanelId) return
              const success = await selectPanelSourceImage(sourcePanelPickerPanelId, sourcePanelId)
              if (success) {
                setSourcePanelPickerPanelId(null)
              }
            }}
          />
        )}

        {historyPanelPickerPanelId && (
          <SelectPanelHistoryImageModal
            open={!!historyPanelPickerPanelId}
            imageHistory={historyPickerPanel?.imageHistory}
            currentImageUrl={historyPickerPanel?.imageUrl}
            videoRatio={videoRatio}
            onClose={() => setHistoryPanelPickerPanelId(null)}
            onSelect={async (selectedImageUrl) => {
              if (!historyPanelPickerPanelId) return
              const success = await selectPanelHistoryImage(historyPanelPickerPanelId, selectedImageUrl)
              if (success) {
                setHistoryPanelPickerPanelId(null)
              }
            }}
          />
        )}

        {modalRuntime.hasCharacterPicker && (
          <CharacterPickerModal
            projectId={projectId}
            currentCharacters={modalRuntime.pickerPanelRuntime ? getPanelEditData(modalRuntime.pickerPanelRuntime.panel).characters : []}
            onSelect={modalRuntime.handleAddCharacter}
            onClose={modalRuntime.closeAssetPicker}
          />
        )}

        {modalRuntime.hasLocationPicker && (
          <LocationPickerModal
            projectId={projectId}
            currentLocation={modalRuntime.pickerPanelRuntime ? getPanelEditData(modalRuntime.pickerPanelRuntime.panel).location || null : null}
            onSelect={modalRuntime.handleSetLocation}
            onClose={modalRuntime.closeAssetPicker}
          />
        )}
      </StoryboardStageShell>
  )
}
