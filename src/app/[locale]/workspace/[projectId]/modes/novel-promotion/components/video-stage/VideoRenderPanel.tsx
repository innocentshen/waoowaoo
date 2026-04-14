import { getAspectRatioConfig } from '@/lib/constants'
import { useCallback, useMemo, useState, type MutableRefObject } from 'react'
import { useTranslations } from 'next-intl'
import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'
import {
  VideoPanelCard,
  type VideoPanel,
  type VideoModelOption,
  type MatchedVoiceLine,
  type FirstLastFrameParams,
  type VideoGenerationOptions,
  type VideoCandidateViewerPanel,
  type VideoOperationRequest,
  type VideoReferenceSelection,
} from '../video'
import VideoCandidateTimeline from '../video/panel-card/VideoCandidateTimeline'
import type { PromptField } from '@/lib/novel-promotion/stages/video-stage-runtime/useVideoPromptState'
import { useProjectAssets } from '@/lib/query/hooks/useProjectAssets'
import { buildPanelVideoReferenceOptions } from '../video/reference-options'

const EMPTY_MATCHED_VOICE_LINES: MatchedVoiceLine[] = []
const CONTENT_VISIBILITY_CARD_STYLE = {
  contentVisibility: 'auto',
  containIntrinsicSize: '560px',
} as const
const NOOP_STOP_PLAYBACK = () => undefined

async function noopCandidateMutation() {
  return undefined
}

interface VideoRenderPanelProps {
  allPanels: VideoPanel[]
  linkedPanels: Map<string, boolean>
  highlightedPanelKey: string | null
  panelRefs: MutableRefObject<Map<string, HTMLDivElement>>
  videoRatio: string
  defaultVideoModel: string
  capabilityOverrides: CapabilitySelections
  userVideoModels?: VideoModelOption[]
  projectId: string
  episodeId: string
  runningVoiceLineIds: Set<string>
  panelVoiceLines: Map<string, MatchedVoiceLine[]>
  panelVideoPreference: Map<string, boolean>
  savingPrompts: Set<string>
  flModel: string
  flModelOptions: VideoModelOption[]
  flGenerationOptions: VideoGenerationOptions
  flCapabilityFields: Array<{
    field: string
    label: string
    options: CapabilityValue[]
    disabledOptions?: CapabilityValue[]
    value: CapabilityValue | undefined
  }>
  flMissingCapabilityFields: string[]
  flCustomPrompts: Map<string, string>
  defaultOptimizeInstruction: string
  onGenerateVideo: (
    storyboardId: string,
    panelIndex: number,
    videoModel?: string,
    firstLastFrame?: FirstLastFrameParams,
    generationOptions?: VideoGenerationOptions,
    videoOperation?: VideoOperationRequest,
    referenceSelection?: VideoReferenceSelection,
    panelId?: string,
    count?: number,
  ) => Promise<void>
  panelReferenceSelections: Map<string, VideoReferenceSelection>
  onUpdateReferenceSelection: (panelKey: string, selection: VideoReferenceSelection) => void
  videoGenerationCount: number
  onVideoGenerationCountChange: (count: number) => void
  onSelectVideoCandidate?: (panelId: string, candidateId: string) => Promise<void>
  onDeleteVideoCandidate?: (panelId: string, candidateId: string) => Promise<void>
  onDownloadVideoCandidate?: (videoUrl: string, fileName: string) => Promise<void>
  onUpdatePanelVideoModel: (storyboardId: string, panelIndex: number, model: string) => Promise<void>
  onUpdateVideoGenerationOptions: (modelKey: string, generationOptions: VideoGenerationOptions) => void
  onLipSync: (storyboardId: string, panelIndex: number, voiceLineId: string, panelId?: string) => Promise<void>
  onToggleLink: (panelKey: string, storyboardId: string, panelIndex: number) => Promise<void>
  onFlModelChange: (model: string) => void
  onFlCapabilityChange: (field: string, rawValue: string) => void
  onFlCustomPromptChange: (key: string, value: string) => void
  onResetFlPrompt: (key: string) => void
  onGenerateFirstLastFrame: (
    firstStoryboardId: string,
    firstPanelIndex: number,
    lastStoryboardId: string,
    lastPanelIndex: number,
    panelKey: string,
    generationOptions?: VideoGenerationOptions,
    referenceSelection?: VideoReferenceSelection,
    firstPanelId?: string,
    count?: number,
  ) => Promise<void>
  onPreviewImage: (imageUrl: string | null) => void
  onToggleLipSyncVideo: (key: string, value: boolean) => void
  getNextPanel: (currentIndex: number) => VideoPanel | null
  isLinkedAsLastFrame: (currentIndex: number) => boolean
  getDefaultFlPrompt: (firstPrompt?: string, lastPrompt?: string) => string
  getLocalPrompt: (panelKey: string, externalPrompt?: string, field?: PromptField) => string
  updateLocalPrompt: (panelKey: string, value: string, field?: PromptField) => void
  savePrompt: (
    storyboardId: string,
    panelIndex: number,
    panelKey: string,
    value: string,
    field?: PromptField,
  ) => Promise<void>
  onGeneratePromptByAi?: (params: {
    panelId: string
    lastPanelId?: string
    currentPrompt?: string
    currentVideoPrompt: string
    modifyInstruction: string
  }) => Promise<string>
}

export default function VideoRenderPanel({
  allPanels,
  linkedPanels,
  highlightedPanelKey,
  panelRefs,
  videoRatio,
  defaultVideoModel,
  capabilityOverrides,
  userVideoModels,
  projectId,
  episodeId,
  runningVoiceLineIds,
  panelVoiceLines,
  panelVideoPreference,
  savingPrompts,
  flModel,
  flModelOptions,
  flGenerationOptions,
  flCapabilityFields,
  flMissingCapabilityFields,
  flCustomPrompts,
  defaultOptimizeInstruction,
  onGenerateVideo,
  panelReferenceSelections,
  onUpdateReferenceSelection,
  videoGenerationCount,
  onVideoGenerationCountChange,
  onSelectVideoCandidate,
  onDeleteVideoCandidate,
  onDownloadVideoCandidate,
  onUpdatePanelVideoModel,
  onUpdateVideoGenerationOptions,
  onLipSync,
  onToggleLink,
  onFlModelChange,
  onFlCapabilityChange,
  onFlCustomPromptChange,
  onResetFlPrompt,
  onGenerateFirstLastFrame,
  onPreviewImage,
  onToggleLipSyncVideo,
  getNextPanel,
  isLinkedAsLastFrame,
  getDefaultFlPrompt,
  getLocalPrompt,
  updateLocalPrompt,
  savePrompt,
  onGeneratePromptByAi,
}: VideoRenderPanelProps) {
  const t = useTranslations('video')
  const [viewerState, setViewerState] = useState<{ panelIndex: number; candidateId?: string } | null>(null)
  const projectAssetsQuery = useProjectAssets(projectId)

  const panelReferenceOptions = useMemo(() => {
    const projectCharacters = projectAssetsQuery.data?.characters || []
    const projectLocations = projectAssetsQuery.data?.locations || []
    const projectProps = projectAssetsQuery.data?.props || []
    return new Map(
      allPanels.map((panel) => [
        `${panel.storyboardId}-${panel.panelIndex}`,
        buildPanelVideoReferenceOptions({
          panel,
          characters: projectCharacters,
          locations: projectLocations,
          props: projectProps,
        }),
      ]),
    )
  }, [allPanels, projectAssetsQuery.data?.characters, projectAssetsQuery.data?.locations, projectAssetsQuery.data?.props])

  const viewerPanels = useMemo(() => {
    return allPanels
      .map<VideoCandidateViewerPanel>((panel, index) => {
        const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
        const isLinked = linkedPanels.get(panelKey) || false
        const isLastFrame = isLinkedAsLastFrame(index)
        const nextPanel = getNextPanel(index)
        const promptField: VideoCandidateViewerPanel['promptField'] = isLinked ? 'firstLastFramePrompt' : 'videoPrompt'
        const nextPanelKey = nextPanel ? `${nextPanel.storyboardId}-${nextPanel.panelIndex}` : null
        const currentBasePrompt = getLocalPrompt(panelKey, panel.textPanel?.video_prompt, 'videoPrompt')
        const nextBasePrompt = nextPanelKey
          ? getLocalPrompt(nextPanelKey, nextPanel?.textPanel?.video_prompt, 'videoPrompt')
          : undefined
        const defaultFlPrompt = getDefaultFlPrompt(currentBasePrompt, nextBasePrompt)
        const externalPrompt = isLinked
          ? (flCustomPrompts.get(panelKey) || panel.firstLastFramePrompt || defaultFlPrompt)
          : panel.textPanel?.video_prompt

        return {
          storyboardId: panel.storyboardId,
          panelIndex: panel.panelIndex,
          panelId: panel.panelId,
          panelKey,
          panelNumber: index + 1,
          imageUrl: panel.imageUrl || null,
          imagePrompt: panel.textPanel?.imagePrompt || null,
          duration: panel.textPanel?.duration ?? null,
          prompt: getLocalPrompt(panelKey, externalPrompt, promptField),
          promptField,
          defaultVideoModel: panel.videoModel || defaultVideoModel,
          isLinked,
          isLastFrame,
          isSavingPrompt: savingPrompts.has(`${promptField}:${panelKey}`),
          referenceSelection: panelReferenceSelections.get(panelKey) || {},
          referenceOptions: panelReferenceOptions.get(panelKey) || {
            characters: [],
            locations: [],
            props: [],
          },
          nextPanel: nextPanel
            ? {
              panelId: nextPanel.panelId,
              panelKey: `${nextPanel.storyboardId}-${nextPanel.panelIndex}`,
              storyboardId: nextPanel.storyboardId,
              panelIndex: nextPanel.panelIndex,
            }
            : null,
          items: panel.videoCandidates || [],
        }
      })
      .filter((panel) => panel.items.length > 0)
  }, [
    allPanels,
    defaultVideoModel,
    getDefaultFlPrompt,
    getLocalPrompt,
    getNextPanel,
    isLinkedAsLastFrame,
    linkedPanels,
    panelReferenceOptions,
    panelReferenceSelections,
    savingPrompts,
  ])

  const viewerPanelIndexByKey = useMemo(() => {
    return new Map(viewerPanels.map((panel, index) => [panel.panelKey, index] as const))
  }, [viewerPanels])
  const activeViewerPanel = viewerState ? viewerPanels[viewerState.panelIndex] || null : null

  const handleOpenViewerForPanel = useCallback((panelIndex: number, candidateId?: string) => {
    if (panelIndex < 0 || panelIndex >= viewerPanels.length) return
    setViewerState({ panelIndex, candidateId })
  }, [viewerPanels])

  const handleCloseViewer = useCallback(() => {
    setViewerState(null)
  }, [])

  return (
    <>
      <div className={`grid gap-4 ${getAspectRatioConfig(videoRatio).isVertical
        ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {allPanels.map((panel, idx) => {
          const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
          const isLinked = linkedPanels.get(panelKey) || false
          const isLastFrame = isLinkedAsLastFrame(idx)
          const nextPanel = getNextPanel(idx)
          const prevPanel = idx > 0 ? allPanels[idx - 1] : null
          const hasNext = idx < allPanels.length - 1
          const promptField: PromptField = isLinked ? 'firstLastFramePrompt' : 'videoPrompt'
          const currentBasePrompt = getLocalPrompt(panelKey, panel.textPanel?.video_prompt, 'videoPrompt')
          const nextPanelKey = nextPanel ? `${nextPanel.storyboardId}-${nextPanel.panelIndex}` : null
          const nextBasePrompt = nextPanelKey
            ? getLocalPrompt(nextPanelKey, nextPanel?.textPanel?.video_prompt, 'videoPrompt')
            : undefined
          const defaultFlPrompt = getDefaultFlPrompt(currentBasePrompt, nextBasePrompt)
          const externalPrompt = isLinked
            ? (flCustomPrompts.get(panelKey) || panel.firstLastFramePrompt || defaultFlPrompt)
            : panel.textPanel?.video_prompt
          const localPrompt = getLocalPrompt(panelKey, externalPrompt, promptField)
          const isSavingPrompt = savingPrompts.has(`${promptField}:${panelKey}`)

          return (
            <div
              key={panelKey}
              ref={(element) => {
                if (element) panelRefs.current.set(panelKey, element)
                else panelRefs.current.delete(panelKey)
              }}
              style={CONTENT_VISIBILITY_CARD_STYLE}
              className={`transition-all duration-500 ${highlightedPanelKey === panelKey
                ? 'ring-4 ring-[var(--glass-stroke-focus)] ring-offset-2 ring-offset-[var(--glass-bg-canvas)] rounded-2xl scale-[1.02]'
                : ''
              }`}
            >
              <VideoPanelCard
                panel={panel}
                panelIndex={idx}
                defaultVideoModel={defaultVideoModel}
                capabilityOverrides={capabilityOverrides}
                videoRatio={videoRatio}
                userVideoModels={userVideoModels}
                projectId={projectId}
                episodeId={episodeId}
                runningVoiceLineIds={runningVoiceLineIds}
                matchedVoiceLines={panelVoiceLines.get(panelKey) || EMPTY_MATCHED_VOICE_LINES}
                onLipSync={onLipSync}
                showLipSyncVideo={panelVideoPreference.get(panelKey) ?? true}
                onToggleLipSyncVideo={onToggleLipSyncVideo}
                isLinked={isLinked}
                isLastFrame={isLastFrame}
                nextPanel={nextPanel}
                prevPanel={prevPanel}
                hasNext={hasNext}
                flModel={flModel}
                flModelOptions={flModelOptions}
                flGenerationOptions={flGenerationOptions}
                flCapabilityFields={flCapabilityFields}
                flMissingCapabilityFields={flMissingCapabilityFields}
                flCustomPrompt={flCustomPrompts.get(panelKey) || panel.firstLastFramePrompt || ''}
                defaultFlPrompt={defaultFlPrompt}
                defaultOptimizeInstruction={defaultOptimizeInstruction}
                localPrompt={localPrompt}
                isSavingPrompt={isSavingPrompt}
                onGeneratePromptByAiForViewer={onGeneratePromptByAi}
                onGenerateVideo={onGenerateVideo}
                referenceOptions={panelReferenceOptions.get(panelKey)}
                referenceSelection={panelReferenceSelections.get(panelKey) || {}}
                onUpdateReferenceSelection={onUpdateReferenceSelection}
                videoGenerationCount={videoGenerationCount}
                onVideoGenerationCountChange={onVideoGenerationCountChange}
                viewerPanelIndex={viewerPanelIndexByKey.get(panelKey) ?? -1}
                onOpenViewerForPanel={handleOpenViewerForPanel}
                onUpdateViewerPrompt={updateLocalPrompt}
                onSaveViewerPrompt={savePrompt}
                onSelectVideoCandidate={onSelectVideoCandidate}
                onDeleteVideoCandidate={onDeleteVideoCandidate}
                onDownloadVideoCandidate={onDownloadVideoCandidate}
                onUpdatePanelVideoModel={onUpdatePanelVideoModel}
                onUpdateVideoGenerationOptions={onUpdateVideoGenerationOptions}
                onToggleLink={onToggleLink}
                onFlModelChange={onFlModelChange}
                onFlCapabilityChange={onFlCapabilityChange}
                onFlCustomPromptChange={onFlCustomPromptChange}
                onResetFlPrompt={onResetFlPrompt}
                onGenerateFirstLastFrame={onGenerateFirstLastFrame}
                onPreviewImage={onPreviewImage}
              />
            </div>
          )
        })}
      </div>

      <VideoCandidateTimeline
        showInlineTimeline={false}
        t={t as (key: string, values?: Record<string, unknown>) => string}
        panelNumber={activeViewerPanel?.panelNumber ?? 1}
        panelImageUrl={activeViewerPanel?.imageUrl}
        panelDuration={activeViewerPanel?.duration}
        durationUnitLabel={t('promptModal.duration')}
        promptLabel={t('promptModal.promptLabel')}
        items={activeViewerPanel?.items ?? []}
        previewCandidateId={null}
        viewerPanels={viewerPanels}
        viewerPanelIndex={viewerState?.panelIndex ?? -1}
        viewerState={viewerState}
        defaultVideoModel={defaultVideoModel}
        videoRatio={videoRatio}
        capabilityOverrides={capabilityOverrides}
        userVideoModels={userVideoModels}
        videoGenerationCount={videoGenerationCount}
        onVideoGenerationCountChange={onVideoGenerationCountChange}
        onGenerateVideo={onGenerateVideo}
        onUpdateReferenceSelection={onUpdateReferenceSelection}
        onUpdatePanelVideoModel={onUpdatePanelVideoModel}
        onUpdateVideoGenerationOptions={onUpdateVideoGenerationOptions}
        flModel={flModel}
        flModelOptions={flModelOptions}
        flGenerationOptions={flGenerationOptions}
        flCapabilityFields={flCapabilityFields}
        flMissingCapabilityFields={flMissingCapabilityFields}
        onFlModelChange={onFlModelChange}
        onFlCapabilityChange={onFlCapabilityChange}
        onGenerateFirstLastFrame={onGenerateFirstLastFrame}
        onUpdateViewerPrompt={updateLocalPrompt}
        onSaveViewerPrompt={savePrompt}
        onGeneratePromptByAi={onGeneratePromptByAi}
        handlePreviewVideoCandidate={NOOP_STOP_PLAYBACK}
        handleClearPreviewVideoCandidate={NOOP_STOP_PLAYBACK}
        handleSelectVideoCandidate={noopCandidateMutation}
        handleDeleteVideoCandidate={noopCandidateMutation}
        handleDownloadVideoCandidate={onDownloadVideoCandidate}
        onSelectVideoCandidateForPanel={onSelectVideoCandidate}
        onDeleteVideoCandidateForPanel={onDeleteVideoCandidate}
        openViewerForPanel={handleOpenViewerForPanel}
        closeViewer={handleCloseViewer}
        onStopPlayback={NOOP_STOP_PLAYBACK}
      />
    </>
  )
}
