import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/icons'
import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import { ModelCapabilityDropdown } from '@/components/ui/config-modals/ModelCapabilityDropdown'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { getVideoGenerationCountOptions } from '@/lib/video-generation/count'
import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'
import { filterVideoModelOptionsByGenerationMode } from '@/lib/model-capabilities/video-model-options'
import VideoReferenceSelector from '../VideoReferenceSelector'
import type {
  VideoCandidate,
  VideoCandidateViewerPanel,
  VideoGenerationOptions,
  VideoOperationMode,
  VideoModelOption,
  VideoReferenceSelection,
} from '../types'
import { usePanelVideoModel } from './runtime/hooks/usePanelVideoModel'

type TranslateFn = (key: string, values?: Record<string, unknown>) => string
type ViewerActionMode = 'regenerate' | VideoOperationMode

type VideoCandidateItem = VideoCandidate

interface VideoCandidateTimelineProps {
  showInlineTimeline?: boolean
  t: TranslateFn
  panelNumber: number
  panelImageUrl?: string | null
  panelDuration?: number | null
  durationUnitLabel: string
  promptLabel: string
  items: VideoCandidateItem[]
  previewCandidateId: string | null
  viewerPanels?: VideoCandidateViewerPanel[]
  viewerPanelIndex?: number
  viewerState: { panelIndex: number; candidateId?: string } | null
  defaultVideoModel: string
  videoRatio?: string
  capabilityOverrides?: CapabilitySelections
  userVideoModels?: VideoModelOption[]
  videoGenerationCount: number
  onVideoGenerationCountChange: (count: number) => void
  onGenerateVideo: (
    storyboardId: string,
    panelIndex: number,
    videoModel?: string,
    firstLastFrame?: {
      lastFrameStoryboardId: string
      lastFramePanelIndex: number
      flModel: string
      customPrompt?: string
    },
    generationOptions?: VideoGenerationOptions,
    videoOperation?: {
      mode: VideoOperationMode
      sourceCandidateId: string
      instruction: string
      extendDuration?: number
    },
    referenceSelection?: VideoReferenceSelection,
    panelId?: string,
    count?: number,
  ) => void | Promise<void>
  onUpdateReferenceSelection: (panelKey: string, selection: VideoReferenceSelection) => void
  onUpdatePanelVideoModel: (storyboardId: string, panelIndex: number, model: string) => void | Promise<void>
  onUpdateVideoGenerationOptions: (modelKey: string, generationOptions: VideoGenerationOptions) => void
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
  onFlModelChange: (model: string) => void
  onFlCapabilityChange: (field: string, rawValue: string) => void
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
  ) => void | Promise<void>
  onUpdateViewerPrompt?: (
    panelKey: string,
    value: string,
    field?: 'videoPrompt' | 'firstLastFramePrompt',
  ) => void
  onSaveViewerPrompt?: (
    storyboardId: string,
    panelIndex: number,
    panelKey: string,
    value: string,
    field?: 'videoPrompt' | 'firstLastFramePrompt',
  ) => Promise<void>
  onGeneratePromptByAi?: (params: {
    panelId: string
    lastPanelId?: string
    currentPrompt?: string
    currentVideoPrompt: string
    modifyInstruction: string
  }) => Promise<string>
  handlePreviewVideoCandidate: (candidateId: string) => void
  handleClearPreviewVideoCandidate: () => void
  handleSelectVideoCandidate: (candidateId: string) => Promise<void>
  handleDeleteVideoCandidate: (candidateId: string) => Promise<void>
  handleDownloadVideoCandidate?: (videoUrl: string, fileName: string) => Promise<void>
  onSelectVideoCandidateForPanel?: (panelId: string, candidateId: string) => Promise<void>
  onDeleteVideoCandidateForPanel?: (panelId: string, candidateId: string) => Promise<void>
  openViewerForPanel: (panelIndex: number, candidateId?: string) => void
  closeViewer: () => void
  onStopPlayback: () => void
}

function getGenerationModeLabel(t: TranslateFn, mode: string) {
  if (mode === 'firstlastframe') return t('panelCard.firstLastFrameGenerationMode')
  if (mode === 'edit') return t('panelCard.editGenerationMode')
  if (mode === 'extend') return t('panelCard.extendGenerationMode')
  return t('panelCard.normalGenerationMode')
}

function buildCandidateDownloadName(panelNumber: number, candidateIndex: number, generationMode: string) {
  const modeSuffix = generationMode === 'firstlastframe'
    ? '_first-last-frame'
    : generationMode === 'edit'
      ? '_edit'
      : generationMode === 'extend'
        ? '_extend'
        : ''
  return `shot_${String(panelNumber).padStart(3, '0')}_candidate_${String(candidateIndex + 1).padStart(2, '0')}${modeSuffix}.mp4`
}

function resolveDefaultViewerCandidateId(panel: Pick<VideoCandidateViewerPanel, 'items'>): string | null {
  return panel.items.find((candidate) => candidate.isSelected)?.id || panel.items[0]?.id || null
}

function resolveViewerCandidate(
  panel: Pick<VideoCandidateViewerPanel, 'items'> | null,
  candidateId?: string,
) {
  if (!panel) return null
  if (candidateId) {
    const matched = panel.items.find((candidate) => candidate.id === candidateId)
    if (matched) return matched
  }
  return panel.items.find((candidate) => candidate.isSelected) || panel.items[0] || null
}

function resolvePreferredModelKey(
  defaultModel: string,
  options: VideoModelOption[],
): string {
  if (options.some((option) => option.value === defaultModel)) return defaultModel
  return options[0]?.value || ''
}

export default function VideoCandidateTimeline({
  showInlineTimeline = true,
  t,
  panelNumber,
  panelImageUrl,
  panelDuration,
  durationUnitLabel,
  promptLabel,
  items,
  viewerPanels,
  viewerPanelIndex,
  viewerState,
  defaultVideoModel,
  videoRatio,
  capabilityOverrides,
  userVideoModels,
  videoGenerationCount,
  onVideoGenerationCountChange,
  onGenerateVideo,
  onUpdateReferenceSelection,
  onUpdatePanelVideoModel,
  onUpdateVideoGenerationOptions,
  flModel,
  flModelOptions,
  flGenerationOptions,
  flCapabilityFields,
  flMissingCapabilityFields,
  onFlModelChange,
  onFlCapabilityChange,
  onGenerateFirstLastFrame,
  onUpdateViewerPrompt,
  onSaveViewerPrompt,
  onGeneratePromptByAi,
  handleSelectVideoCandidate,
  handleDownloadVideoCandidate,
  onSelectVideoCandidateForPanel,
  onDeleteVideoCandidateForPanel,
  openViewerForPanel,
  closeViewer,
  onStopPlayback,
}: VideoCandidateTimelineProps) {
  const [draftPrompt, setDraftPrompt] = useState('')
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiDraftPrompt, setAiDraftPrompt] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [isAiApplying, setIsAiApplying] = useState(false)
  const [viewerActionMode, setViewerActionMode] = useState<ViewerActionMode>('regenerate')
  const [editInstruction, setEditInstruction] = useState('')
  const [extendInstruction, setExtendInstruction] = useState('')
  const [extendDuration, setExtendDuration] = useState(4)
  const normalizedViewerPanels = useMemo<VideoCandidateViewerPanel[]>(() => {
    const availableViewerPanels = (viewerPanels || []).filter((panel) => panel.items.length > 0)
    if (availableViewerPanels.length > 0) return availableViewerPanels
    return [{
      panelKey: `panel-${panelNumber}`,
      panelNumber,
      storyboardId: 'standalone',
      panelIndex: 0,
      imageUrl: panelImageUrl || null,
      duration: panelDuration ?? null,
      prompt: '',
      promptField: 'videoPrompt',
      defaultVideoModel,
      isLinked: false,
      isLastFrame: false,
      referenceSelection: {},
      referenceOptions: {
        characters: [],
        locations: [],
        props: [],
      },
      nextPanel: null,
      items,
    }]
  }, [defaultVideoModel, items, panelDuration, panelImageUrl, panelNumber, viewerPanels])

  const currentViewerPanelIndex = (
    typeof viewerPanelIndex === 'number'
    && viewerPanelIndex >= 0
    && viewerPanelIndex < normalizedViewerPanels.length
  )
    ? viewerPanelIndex
    : 0

  useEffect(() => {
    if (!viewerState) return
    if (normalizedViewerPanels.length === 0) {
      closeViewer()
      return
    }
    if (viewerState.panelIndex < normalizedViewerPanels.length) return
    const fallbackIndex = normalizedViewerPanels.length - 1
    const fallbackPanel = normalizedViewerPanels[fallbackIndex]
    openViewerForPanel(fallbackIndex, resolveDefaultViewerCandidateId(fallbackPanel) || undefined)
  }, [closeViewer, normalizedViewerPanels, openViewerForPanel, viewerState])

  const viewerPanel = viewerState ? normalizedViewerPanels[viewerState.panelIndex] || null : null
  const viewerPanelResetKey = viewerPanel
    ? `${viewerPanel.panelKey}:${viewerPanel.promptField}:${viewerPanel.isLinked ? 'linked' : 'normal'}:${viewerPanel.isLastFrame ? 'last' : 'active'}`
    : null
  const viewerPanelResetSnapshotRef = useRef<{ key: string | null; prompt: string }>({
    key: null,
    prompt: '',
  })
  if (viewerPanelResetSnapshotRef.current.key !== viewerPanelResetKey) {
    viewerPanelResetSnapshotRef.current = {
      key: viewerPanelResetKey,
      prompt: viewerPanel?.prompt || '',
    }
  }
  const viewerCandidate = useMemo(
    () => resolveViewerCandidate(viewerPanel, viewerState?.candidateId),
    [viewerPanel, viewerState?.candidateId],
  )
  const viewerCandidateIndex = viewerPanel && viewerCandidate
    ? viewerPanel.items.findIndex((candidate) => candidate.id === viewerCandidate.id)
    : -1
  const previousViewerPanel = viewerState && viewerState.panelIndex > 0
    ? normalizedViewerPanels[viewerState.panelIndex - 1] || null
    : null
  const nextViewerPanel = viewerState && viewerState.panelIndex < normalizedViewerPanels.length - 1
    ? normalizedViewerPanels[viewerState.panelIndex + 1] || null
    : null

  useEffect(() => {
    if (!viewerPanelResetKey) return
    const { prompt } = viewerPanelResetSnapshotRef.current
    setDraftPrompt(prompt)
    setIsAiModalOpen(false)
    setAiInstruction('')
    setAiDraftPrompt(prompt)
    setViewerActionMode('regenerate')
    setEditInstruction('')
    setExtendInstruction('')
    setExtendDuration(4)
  }, [viewerPanelResetKey])
  const preferredSelection = useMemo(
    () => (videoRatio ? { aspectRatio: videoRatio } : undefined),
    [videoRatio],
  )

  const viewerVideoModel = usePanelVideoModel({
    defaultVideoModel: viewerPanel?.defaultVideoModel || defaultVideoModel,
    capabilityOverrides,
    userVideoModels,
    preferredSelection,
    onPersistSelectedModel: (modelKey) => {
      if (!viewerPanel) return
      void onUpdatePanelVideoModel(viewerPanel.storyboardId, viewerPanel.panelIndex, modelKey)
    },
    onPersistGenerationOptions: onUpdateVideoGenerationOptions,
  })
  const editModelOptions = useMemo(
    () => filterVideoModelOptionsByGenerationMode(userVideoModels || [], 'edit'),
    [userVideoModels],
  )
  const extendModelOptions = useMemo(
    () => filterVideoModelOptionsByGenerationMode(userVideoModels || [], 'extend'),
    [userVideoModels],
  )
  const [editModel, setEditModel] = useState('')
  const [extendModel, setExtendModel] = useState('')

  useEffect(() => {
    setEditModel((current) => current && editModelOptions.some((option) => option.value === current)
      ? current
      : resolvePreferredModelKey(viewerPanel?.defaultVideoModel || defaultVideoModel, editModelOptions))
  }, [defaultVideoModel, editModelOptions, viewerPanel?.defaultVideoModel])

  useEffect(() => {
    setExtendModel((current) => current && extendModelOptions.some((option) => option.value === current)
      ? current
      : resolvePreferredModelKey(viewerPanel?.defaultVideoModel || defaultVideoModel, extendModelOptions))
  }, [defaultVideoModel, extendModelOptions, viewerPanel?.defaultVideoModel])

  const safeTranslate = (key: string | undefined, fallback = ''): string => {
    if (!key) return fallback
    try {
      return t(key as never)
    } catch {
      return fallback
    }
  }

  const renderCapabilityLabel = (field: {
    field: string
    label: string
    labelKey?: string
    unitKey?: string
  }): string => {
    const labelText = safeTranslate(field.labelKey, safeTranslate(`capability.${field.field}`, field.label))
    const unitText = safeTranslate(field.unitKey)
    return unitText ? `${labelText} (${unitText})` : labelText
  }

  const isPromptDirty = (viewerPanel?.prompt || '') !== draftPrompt
  const canAiGeneratePrompt = !!viewerPanel?.panelId
    && !!onGeneratePromptByAi
    && (!viewerPanel.isLinked || !!viewerPanel.nextPanel?.panelId)
  const isAiBusy = isAiGenerating || isAiApplying
  const canEditPrompt = !!viewerPanel && !viewerPanel.isLastFrame
  const canSavePrompt = canEditPrompt
    && !!onUpdateViewerPrompt
    && !!onSaveViewerPrompt
    && isPromptDirty
    && !isSavingPrompt
    && !isRegenerating
    && !isAiBusy
  const showSelectViewerCandidate = !!viewerCandidate
  const canSelectViewerCandidate = !!viewerCandidate
    && !viewerCandidate.isSelected
    && (
      (!!viewerPanel?.panelId && !!onSelectVideoCandidateForPanel)
      || viewerState?.panelIndex === currentViewerPanelIndex
    )
  const canDeleteViewerCandidate = !!viewerCandidate && !!viewerPanel?.panelId && !!onDeleteVideoCandidateForPanel
  const canRegenerateNormal = !!viewerPanel
    && !viewerPanel.isLinked
    && !viewerPanel.isLastFrame
    && !!viewerVideoModel.selectedModel
    && viewerVideoModel.missingCapabilityFields.length === 0
  const canRegenerateFirstLastFrame = !!viewerPanel
    && viewerPanel.isLinked
    && !viewerPanel.isLastFrame
    && !!viewerPanel.nextPanel
    && !!flModel
    && flMissingCapabilityFields.length === 0
  const canRegenerate = !isSavingPrompt && !isRegenerating && (canRegenerateNormal || canRegenerateFirstLastFrame)
  const canSubmitEdit = !!viewerPanel
    && !!viewerCandidate
    && !!editModel
    && !!editInstruction.trim()
    && !isSavingPrompt
    && !isRegenerating
    && !isAiBusy
  const canSubmitExtend = !!viewerPanel
    && !!viewerCandidate
    && !!extendModel
    && !!extendInstruction.trim()
    && extendDuration > 0
    && !isSavingPrompt
    && !isRegenerating
    && !isAiBusy
  const sourceViewerCandidateIndex = viewerPanel && viewerCandidate?.meta?.sourceCandidateId
    ? viewerPanel.items.findIndex((candidate) => candidate.id === viewerCandidate.meta?.sourceCandidateId)
    : -1
  const viewerActionCount = [
    showSelectViewerCandidate,
    !!viewerCandidate && !!handleDownloadVideoCandidate,
    canDeleteViewerCandidate,
    true,
  ].filter(Boolean).length

  const renderReferenceSelectionControls = () => {
    if (!viewerPanel) return null
    return (
      <VideoReferenceSelector
        t={t}
        selection={viewerPanel.referenceSelection}
        options={viewerPanel.referenceOptions}
        onChange={(nextSelection) => onUpdateReferenceSelection(viewerPanel.panelKey, nextSelection)}
      />
    )
  }

  async function persistPromptDraft() {
    if (!viewerPanel || !onUpdateViewerPrompt || !onSaveViewerPrompt || !canEditPrompt) return false
    setIsSavingPrompt(true)
    try {
      onUpdateViewerPrompt(viewerPanel.panelKey, draftPrompt, viewerPanel.promptField)
      await onSaveViewerPrompt(
        viewerPanel.storyboardId,
        viewerPanel.panelIndex,
        viewerPanel.panelKey,
        draftPrompt,
        viewerPanel.promptField,
      )
      return true
    } finally {
      setIsSavingPrompt(false)
    }
  }

  function handleOpenAiModal() {
    if (!canAiGeneratePrompt || isAiBusy) return
    setAiInstruction('')
    setAiDraftPrompt(draftPrompt || viewerPanel?.prompt || '')
    setIsAiModalOpen(true)
  }

  function handleCloseAiModal() {
    if (isAiBusy) return
    setIsAiModalOpen(false)
  }

  async function handleAiGenerate() {
    if (!viewerPanel?.panelId || !onGeneratePromptByAi || isAiBusy) return false
    const instruction = aiInstruction.trim()
    if (!instruction) return false

    setIsAiGenerating(true)
    try {
      const basePrompt = (aiDraftPrompt.trim() || draftPrompt.trim() || viewerPanel.prompt || '').trim()
      const generatedPrompt = (await onGeneratePromptByAi({
        panelId: viewerPanel.panelId,
        lastPanelId: viewerPanel.isLinked ? viewerPanel.nextPanel?.panelId : undefined,
        currentPrompt: viewerPanel.imagePrompt || undefined,
        currentVideoPrompt: basePrompt,
        modifyInstruction: instruction,
      })).trim()
      if (!generatedPrompt) return false
      setDraftPrompt(generatedPrompt)
      setAiDraftPrompt(generatedPrompt)
      return true
    } finally {
      setIsAiGenerating(false)
    }
  }

  async function handleApplyAiPrompt() {
    const finalPrompt = aiDraftPrompt.trim()
    if (!finalPrompt || isAiBusy) return false

    setIsAiApplying(true)
    try {
      setDraftPrompt(finalPrompt)
      if (viewerPanel && onUpdateViewerPrompt && onSaveViewerPrompt && canEditPrompt) {
        onUpdateViewerPrompt(viewerPanel.panelKey, finalPrompt, viewerPanel.promptField)
        await onSaveViewerPrompt(
          viewerPanel.storyboardId,
          viewerPanel.panelIndex,
          viewerPanel.panelKey,
          finalPrompt,
          viewerPanel.promptField,
        )
      }
      setIsAiModalOpen(false)
      setAiInstruction('')
      return true
    } finally {
      setIsAiApplying(false)
    }
  }

  async function handleViewerSelect() {
    if (!viewerPanel || !viewerCandidate || !canSelectViewerCandidate) return
    onStopPlayback()
    if (viewerPanel.panelId && onSelectVideoCandidateForPanel) {
      await onSelectVideoCandidateForPanel(viewerPanel.panelId, viewerCandidate.id)
      return
    }
    await handleSelectVideoCandidate(viewerCandidate.id)
  }

  async function handleViewerDelete() {
    if (!viewerPanel || !viewerCandidate || !viewerPanel.panelId || !onDeleteVideoCandidateForPanel) return
    onStopPlayback()
    await onDeleteVideoCandidateForPanel(viewerPanel.panelId, viewerCandidate.id)
    if (viewerPanel.items.length <= 1) {
      closeViewer()
    }
  }

  async function handleViewerDownload() {
    if (!viewerPanel || !viewerCandidate || !handleDownloadVideoCandidate) return
    onStopPlayback()
    const fileName = buildCandidateDownloadName(
      viewerPanel.panelNumber,
      Math.max(0, viewerCandidateIndex),
      viewerCandidate.generationMode,
    )
    await handleDownloadVideoCandidate(viewerCandidate.videoUrl, fileName)
  }

  async function handleViewerRegenerate() {
    if (!viewerPanel || !canRegenerate) return
    setIsRegenerating(true)
    try {
      if (isPromptDirty && canEditPrompt) {
        await persistPromptDraft()
      }

      if (viewerPanel.isLinked && viewerPanel.nextPanel) {
        await Promise.resolve(onGenerateFirstLastFrame(
          viewerPanel.storyboardId,
          viewerPanel.panelIndex,
          viewerPanel.nextPanel.storyboardId,
          viewerPanel.nextPanel.panelIndex,
          viewerPanel.panelKey,
          flGenerationOptions,
          viewerPanel.referenceSelection,
          viewerPanel.panelId,
          videoGenerationCount,
        ))
        return
      }

      await Promise.resolve(onGenerateVideo(
        viewerPanel.storyboardId,
        viewerPanel.panelIndex,
        viewerVideoModel.selectedModel,
        undefined,
        viewerVideoModel.generationOptions,
        undefined,
        viewerPanel.referenceSelection,
        viewerPanel.panelId,
        videoGenerationCount,
      ))
    } finally {
      setIsRegenerating(false)
    }
  }

  async function handleViewerVideoOperation(mode: VideoOperationMode) {
    if (!viewerPanel || !viewerCandidate) return
    const selectedModel = mode === 'edit' ? editModel : extendModel
    const instruction = mode === 'edit' ? editInstruction.trim() : extendInstruction.trim()
    if (!selectedModel || !instruction) return

    setIsRegenerating(true)
    try {
      if (isPromptDirty && canEditPrompt) {
        await persistPromptDraft()
      }

      await Promise.resolve(onGenerateVideo(
        viewerPanel.storyboardId,
        viewerPanel.panelIndex,
        selectedModel,
        undefined,
        mode === 'extend' ? { duration: extendDuration } : undefined,
        {
          mode,
          sourceCandidateId: viewerCandidate.id,
          instruction,
          ...(mode === 'extend' ? { extendDuration } : {}),
        },
        viewerPanel.referenceSelection,
        viewerPanel.panelId,
        1,
      ))
    } finally {
      setIsRegenerating(false)
    }
  }

  if (items.length === 0 && !viewerState) return null

  return (
    <>
      {showInlineTimeline ? null : null}

      <GlassModalShell
        open={!!viewerCandidate}
        onClose={closeViewer}
        title={viewerCandidate ? t('panelCard.candidateViewerTitle', {
          count: Math.max(1, viewerCandidateIndex + 1),
        }) : t('panelCard.openCandidateViewer')}
        description={viewerCandidate && viewerPanel
          ? `${t('panelCard.shot', { number: viewerPanel.panelNumber })} / ${getGenerationModeLabel(t, viewerCandidate.generationMode)}`
          : undefined}
        size="xl"
      >
        {viewerCandidate && viewerPanel && (
          <div className="space-y-4">
            {normalizedViewerPanels.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => previousViewerPanel && openViewerForPanel(viewerState!.panelIndex - 1, resolveDefaultViewerCandidateId(previousViewerPanel) || undefined)}
                  disabled={!previousViewerPanel}
                  className="glass-btn-base glass-btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t('panelCard.shot', { number: previousViewerPanel?.panelNumber || viewerPanel.panelNumber })}
                >
                  <AppIcon name="chevronLeft" className="h-4 w-4" />
                </button>

                <div className="app-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                  {normalizedViewerPanels.map((panelItem, index) => {
                    const isActive = index === viewerState?.panelIndex
                    const defaultCandidate = resolveViewerCandidate(panelItem)
                    return (
                      <button
                        key={panelItem.panelKey}
                        type="button"
                        onClick={() => openViewerForPanel(index, resolveDefaultViewerCandidateId(panelItem) || undefined)}
                        className={`flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${isActive
                          ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)] shadow-[0_10px_24px_rgba(59,130,246,0.14)]'
                          : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] hover:border-[var(--glass-stroke-focus)]/50'
                          }`}
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-black">
                          {panelItem.imageUrl ? (
                            // Thumbnail sources can be signed or remote media URLs, so keep a plain img here.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={panelItem.imageUrl}
                              alt={t('panelCard.shot', { number: panelItem.panelNumber })}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/80">
                              <AppIcon name="film" className="h-4 w-4" />
                            </div>
                          )}
                          <span className="absolute right-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                            {panelItem.items.length}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--glass-text-primary)]">
                            {t('panelCard.shot', { number: panelItem.panelNumber })}
                          </div>
                          <div className="text-[11px] text-[var(--glass-text-tertiary)]">
                            {defaultCandidate ? getGenerationModeLabel(t, defaultCandidate.generationMode) : '--'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => nextViewerPanel && openViewerForPanel(viewerState!.panelIndex + 1, resolveDefaultViewerCandidateId(nextViewerPanel) || undefined)}
                  disabled={!nextViewerPanel}
                  className="glass-btn-base glass-btn-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t('panelCard.shot', { number: nextViewerPanel?.panelNumber || viewerPanel.panelNumber })}
                >
                  <AppIcon name="chevronRight" className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-[22px] border border-[var(--glass-stroke-base)] bg-black shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
              <video
                src={viewerCandidate.videoUrl}
                poster={viewerPanel.imageUrl || undefined}
                controls
                autoPlay
                playsInline
                className="max-h-[44vh] w-full bg-black object-contain sm:max-h-[50vh] lg:max-h-[54vh]"
              />
            </div>

            {viewerPanel.items.length > 1 && (
              <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-3">
                <div className="app-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {viewerPanel.items.map((candidate, index) => {
                    const isActive = candidate.id === viewerCandidate.id
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => openViewerForPanel(viewerState!.panelIndex, candidate.id)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors ${isActive
                          ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                          : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-stroke-focus)]/50'
                          }`}
                      >
                        <span>{t('panelCard.videoCandidateLabel', { count: index + 1 })}</span>
                        {candidate.isSelected && (
                          <span className="rounded-full bg-[var(--glass-accent-from)] px-2 py-0.5 text-[10px] font-medium text-white">
                            {t('panelCard.currentVideo')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
              <div className="flex h-full flex-col rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--glass-text-tertiary)]">
                    {promptLabel}
                  </div>
                  <div className="flex items-center gap-2">
                    {canAiGeneratePrompt && (
                      <button
                        type="button"
                        onClick={handleOpenAiModal}
                        disabled={isAiBusy}
                        title={t('panelCard.aiGeneratePrompt')}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--glass-stroke-focus)]/50 bg-[linear-gradient(135deg,rgba(59,130,246,0.95),rgba(124,58,237,0.92))] text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] transition-transform hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <AppIcon name={isAiBusy ? 'loader' : 'sparkles'} className={`h-3.5 w-3.5 ${isAiBusy ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    {canSavePrompt && (
                      <button
                        type="button"
                        onClick={() => { void persistPromptDraft() }}
                        className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs"
                      >
                        {t('panelCard.save')}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  disabled={!canEditPrompt || isSavingPrompt || isRegenerating || isAiBusy}
                  rows={2}
                  className="glass-textarea-base app-scrollbar mt-3 min-h-[11rem] flex-1 w-full resize-none px-3 py-3 text-sm leading-5"
                />
              </div>

              <div className="flex h-full flex-col gap-3">
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-3">
                  <div className="space-y-3 text-sm text-[var(--glass-text-secondary)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.candidateMetaModel')}</span>
                      <span className="text-right font-medium text-[var(--glass-text-primary)]">
                        {viewerCandidate.model || getGenerationModeLabel(t, viewerCandidate.generationMode)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.shot', { number: viewerPanel.panelNumber })}</span>
                      <span className="font-medium text-[var(--glass-text-primary)]">
                        {viewerCandidateIndex >= 0 ? t('panelCard.videoCandidateLabel', { count: viewerCandidateIndex + 1 }) : '--'}
                      </span>
                    </div>
                    {viewerPanel.duration ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.candidateMetaDuration')}</span>
                        <span className="font-medium text-[var(--glass-text-primary)]">
                          {viewerPanel.duration}{durationUnitLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.candidateMetaStatus')}</span>
                      <span className="font-medium text-[var(--glass-text-primary)]">
                        {viewerCandidate.isSelected ? t('panelCard.currentVideo') : getGenerationModeLabel(t, viewerCandidate.generationMode)}
                      </span>
                    </div>
                    {sourceViewerCandidateIndex >= 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.candidateMetaSource')}</span>
                        <span className="font-medium text-[var(--glass-text-primary)]">
                          {t('panelCard.videoCandidateLabel', { count: sourceViewerCandidateIndex + 1 })}
                        </span>
                      </div>
                    )}
                    {typeof viewerCandidate.meta?.extendDuration === 'number' && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[var(--glass-text-tertiary)]">{t('panelCard.candidateMetaExtendDuration')}</span>
                        <span className="font-medium text-[var(--glass-text-primary)]">
                          +{viewerCandidate.meta.extendDuration}{durationUnitLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!viewerPanel.isLastFrame && (
                  <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-3">
                    <div className="space-y-3">
                      <SegmentedControl
                        value={viewerActionMode}
                        onChange={setViewerActionMode}
                        options={[
                          { value: 'regenerate', label: t('panelCard.regenerate') },
                          { value: 'edit', label: t('panelCard.edit') },
                          { value: 'extend', label: t('panelCard.extend') },
                        ]}
                        className="!bg-[var(--glass-bg-muted)]"
                      />

                      {viewerActionMode === 'regenerate' ? (
                        <>
                          {viewerPanel.isLinked && viewerPanel.nextPanel ? (
                            <ModelCapabilityDropdown
                              models={flModelOptions}
                              value={flModel || undefined}
                              onModelChange={onFlModelChange}
                              capabilityFields={flCapabilityFields.map((field) => ({
                                field: field.field,
                                label: field.label,
                                options: field.options,
                                disabledOptions: field.disabledOptions,
                              }))}
                              capabilityOverrides={flGenerationOptions}
                              onCapabilityChange={(field, rawValue) => onFlCapabilityChange(field, rawValue)}
                              placeholder={t('panelCard.selectModel')}
                            />
                          ) : (
                            <ModelCapabilityDropdown
                              models={viewerVideoModel.videoModelOptions}
                              value={viewerVideoModel.selectedModel || undefined}
                              onModelChange={viewerVideoModel.handleModelChange}
                              capabilityFields={viewerVideoModel.capabilityFields.map((field) => ({
                                field: field.field,
                                label: renderCapabilityLabel(field),
                                options: field.options,
                                disabledOptions: field.disabledOptions,
                              }))}
                              capabilityOverrides={viewerVideoModel.generationOptions}
                              onCapabilityChange={(field, rawValue) => viewerVideoModel.setCapabilityValue(field, rawValue)}
                              placeholder={t('panelCard.selectModel')}
                            />
                          )}
                          {renderReferenceSelectionControls()}
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
                            <button
                              type="button"
                              onClick={() => { void handleViewerRegenerate() }}
                              disabled={!canRegenerate}
                              className="glass-btn-base glass-btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isRegenerating ? t('panelCard.generating') : t('panelCard.regenerate')}
                            </button>
                            <select
                              value={String(videoGenerationCount)}
                              onChange={(event) => onVideoGenerationCountChange(Number(event.target.value))}
                              className="glass-select-base w-full rounded-lg px-3 py-2.5 text-sm"
                            >
                              {getVideoGenerationCountOptions().map((option) => (
                                <option key={option} value={option}>
                                  {t('panelCard.videoCountOption', { count: option })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : viewerActionMode === 'edit' ? (
                        <>
                          <div className="rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-3 py-2 text-xs text-[var(--glass-text-secondary)]">
                            {t('panelCard.operationSourceCandidate', {
                              count: Math.max(viewerCandidateIndex + 1, 1),
                            })}
                          </div>
                          <ModelCapabilityDropdown
                            models={editModelOptions}
                            value={editModel || undefined}
                            onModelChange={(modelKey) => {
                              setEditModel(modelKey)
                              if (viewerPanel) {
                                void onUpdatePanelVideoModel(viewerPanel.storyboardId, viewerPanel.panelIndex, modelKey)
                              }
                            }}
                            capabilityFields={[]}
                            capabilityOverrides={{}}
                            onCapabilityChange={() => undefined}
                            placeholder={t('panelCard.selectModel')}
                          />
                          {renderReferenceSelectionControls()}
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-[var(--glass-text-tertiary)]">
                              {t('panelCard.operationInstruction')}
                            </div>
                            <textarea
                              value={editInstruction}
                              onChange={(event) => setEditInstruction(event.target.value)}
                              rows={4}
                              placeholder={t('panelCard.editInstructionPlaceholder')}
                              className="glass-textarea-base app-scrollbar w-full resize-none px-3 py-3 text-sm leading-5"
                              disabled={isRegenerating}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => { void handleViewerVideoOperation('edit') }}
                            disabled={!canSubmitEdit}
                            className="glass-btn-base glass-btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRegenerating ? t('panelCard.generating') : t('panelCard.generateEditVersion')}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-3 py-2 text-xs text-[var(--glass-text-secondary)]">
                            {t('panelCard.operationSourceCandidate', {
                              count: Math.max(viewerCandidateIndex + 1, 1),
                            })}
                          </div>
                          <ModelCapabilityDropdown
                            models={extendModelOptions}
                            value={extendModel || undefined}
                            onModelChange={(modelKey) => {
                              setExtendModel(modelKey)
                              if (viewerPanel) {
                                void onUpdatePanelVideoModel(viewerPanel.storyboardId, viewerPanel.panelIndex, modelKey)
                              }
                            }}
                            capabilityFields={[]}
                            capabilityOverrides={{}}
                            onCapabilityChange={() => undefined}
                            placeholder={t('panelCard.selectModel')}
                          />
                          {renderReferenceSelectionControls()}
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-[var(--glass-text-tertiary)]">
                              {t('panelCard.operationInstruction')}
                            </div>
                            <textarea
                              value={extendInstruction}
                              onChange={(event) => setExtendInstruction(event.target.value)}
                              rows={4}
                              placeholder={t('panelCard.extendInstructionPlaceholder')}
                              className="glass-textarea-base app-scrollbar w-full resize-none px-3 py-3 text-sm leading-5"
                              disabled={isRegenerating}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-[var(--glass-text-tertiary)]">
                              {t('panelCard.extendDuration')}
                            </div>
                            <select
                              value={String(extendDuration)}
                              onChange={(event) => setExtendDuration(Number(event.target.value))}
                              className="glass-select-base w-full rounded-lg px-3 py-2.5 text-sm"
                              disabled={isRegenerating}
                            >
                              {[2, 4, 6, 8, 10].map((option) => (
                                <option key={option} value={option}>
                                  +{option}{durationUnitLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => { void handleViewerVideoOperation('extend') }}
                            disabled={!canSubmitExtend}
                            className="glass-btn-base glass-btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRegenerating ? t('panelCard.generating') : t('panelCard.generateExtendVersion')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-auto rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-3">
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${Math.max(viewerActionCount, 1)}, minmax(0, 1fr))` }}
                  >
                    {showSelectViewerCandidate && (
                      <button
                        type="button"
                        onClick={() => { void handleViewerSelect() }}
                        disabled={!canSelectViewerCandidate}
                        className="glass-btn-base glass-btn-secondary min-w-0 whitespace-nowrap px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('panelCard.useCandidate')}
                      </button>
                    )}
                    {viewerCandidate && handleDownloadVideoCandidate && (
                      <button
                        type="button"
                        onClick={() => { void handleViewerDownload() }}
                        className="glass-btn-base glass-btn-primary flex min-w-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-sm"
                      >
                        <AppIcon name="download" className="h-4 w-4" />
                        <span>{t('panelCard.download')}</span>
                      </button>
                    )}
                    {canDeleteViewerCandidate && (
                      <button
                        type="button"
                        onClick={() => { void handleViewerDelete() }}
                        className="glass-btn-base glass-btn-secondary min-w-0 whitespace-nowrap px-3 py-2 text-sm text-[var(--glass-tone-danger-fg)]"
                      >
                        {t('panelCard.deleteCandidate')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeViewer}
                      className="glass-btn-base glass-btn-secondary min-w-0 whitespace-nowrap px-3 py-2 text-sm"
                    >
                      {t('panelCard.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassModalShell>

      <GlassModalShell
        open={isAiModalOpen}
        onClose={handleCloseAiModal}
        title={t('promptModal.aiGenerateTitle')}
        description={t('promptModal.aiGenerateDescription')}
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseAiModal}
              disabled={isAiBusy}
              className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('panelCard.cancel')}
            </button>
            <button
              type="button"
              onClick={() => { void handleAiGenerate() }}
              disabled={isAiBusy || !aiInstruction.trim()}
              className="glass-btn-base glass-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
            >
              {isAiGenerating ? (
                <>
                  <AppIcon name="loader" className="w-4 h-4 animate-spin" />
                  <span>{t('panelCard.generating')}</span>
                </>
              ) : (
                <>
                  <AppIcon name="sparkles" className="w-4 h-4" />
                  <span>{t('promptModal.aiGenerateAction')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => { void handleApplyAiPrompt() }}
              disabled={isAiBusy || !aiDraftPrompt.trim()}
              className="glass-btn-base glass-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
            >
              {isAiApplying ? (
                <>
                  <AppIcon name="loader" className="w-4 h-4 animate-spin" />
                  <span>{t('panelCard.save')}</span>
                </>
              ) : (
                <>
                  <AppIcon name="edit" className="w-4 h-4" />
                  <span>{t('promptModal.applyPromptAction')}</span>
                </>
              )}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--glass-text-tertiary)]">
              {t('promptModal.aiInstructionLabel')}
            </label>
            <textarea
              value={aiInstruction}
              onChange={(event) => setAiInstruction(event.target.value)}
              placeholder={t('promptModal.aiGeneratePlaceholder')}
              className="glass-textarea-base app-scrollbar h-28 w-full resize-none px-4 py-3 text-sm"
              disabled={isAiBusy}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-xs font-medium text-[var(--glass-text-tertiary)]">
                {t('promptModal.aiResultLabel')}
              </label>
              <span className="text-[11px] text-[var(--glass-text-tertiary)]">
                {t('promptModal.aiResultHint')}
              </span>
            </div>
            <textarea
              value={aiDraftPrompt}
              onChange={(event) => setAiDraftPrompt(event.target.value)}
              placeholder={t('promptModal.aiResultPlaceholder')}
              className="glass-textarea-base app-scrollbar h-40 w-full resize-none px-4 py-3 text-sm"
              disabled={isAiBusy}
            />
          </div>
        </div>
      </GlassModalShell>
    </>
  )
}
