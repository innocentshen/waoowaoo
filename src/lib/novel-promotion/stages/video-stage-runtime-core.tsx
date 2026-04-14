'use client'

import { logError as _ulogError } from '@/lib/logging/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  VideoToolbar,
  type VideoGenerationOptionValue,
  type VideoGenerationOptions,
  type VideoModelOption,
  type VideoReferenceSelection,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video'
import {
  isVideoReferenceSelectionEmpty,
  normalizeVideoReferenceSelection,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/reference-selection'
import { AppIcon } from '@/components/ui/icons'
import {
  useAiGenerateProjectVideoPrompt,
  useDeleteProjectPanelVideoCandidate,
  useDownloadRemoteBlob,
  useListProjectEpisodeVideoUrls,
  useMatchedVoiceLines,
  useSelectProjectPanelVideoCandidate,
  useUpdateProjectPanelLink,
} from '@/lib/query/hooks'
import { useLipSync } from '@/lib/query/hooks/useStoryboards'
import ImagePreviewModal from '@/components/ui/ImagePreviewModal'
import { ModelCapabilityDropdown } from '@/components/ui/config-modals/ModelCapabilityDropdown'
import VideoTimelinePanel from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video-stage/VideoTimelinePanel'
import VideoRenderPanel from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video-stage/VideoRenderPanel'
import type { VideoStageShellProps } from './video-stage-runtime/types'
import type { CapabilitySelections } from '@/lib/model-config-contract'
import {
  type EffectiveVideoCapabilityDefinition,
  normalizeVideoGenerationSelections,
  resolveEffectiveVideoCapabilityDefinitions,
  resolveEffectiveVideoCapabilityFields,
} from '@/lib/model-capabilities/video-effective'
import { projectVideoPricingTiersByFixedSelections } from '@/lib/model-pricing/video-tier'
import { useVideoTaskStates } from './video-stage-runtime/useVideoTaskStates'
import { useVideoPanelsProjection } from './video-stage-runtime/useVideoPanelsProjection'
import { useVideoPromptState, type PromptField } from './video-stage-runtime/useVideoPromptState'
import { useVideoPanelLinking } from './video-stage-runtime/useVideoPanelLinking'
import { useVideoVoiceLines } from './video-stage-runtime/useVideoVoiceLines'
import { useVideoDownloadAll } from './video-stage-runtime/useVideoDownloadAll'
import { useVideoStageUiState } from './video-stage-runtime/useVideoStageUiState'
import { useVideoPanelViewport } from './video-stage-runtime/useVideoPanelViewport'
import { useVideoFirstLastFrameFlow } from './video-stage-runtime/useVideoFirstLastFrameFlow'
import { filterNormalVideoModelOptions } from '@/lib/model-capabilities/video-model-options'
import { getErrorMessage } from './video-stage-runtime/utils'
import {
  buildVideoSubmissionKey,
  createVideoSubmissionBaseline,
  shouldResolveVideoSubmissionLock,
  type VideoSubmissionBaseline,
} from './video-stage-runtime/immediate-video-submission'
import {
  VIDEO_GENERATION_COUNT_STORAGE_KEY,
  getVideoGenerationCountOptions,
  normalizeVideoGenerationCount,
} from '@/lib/video-generation/count'

export type { VideoStageShellProps } from './video-stage-runtime/types'

type BatchCapabilityDefinition = EffectiveVideoCapabilityDefinition

interface BatchCapabilityField {
  field: string
  label: string
  labelKey?: string
  unitKey?: string
  options: VideoGenerationOptionValue[]
  disabledOptions?: VideoGenerationOptionValue[]
}

function toFieldLabel(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function readStoredVideoSelectionForModel(
  overrides: CapabilitySelections,
  modelKey: string,
): VideoGenerationOptions {
  if (!modelKey) return {}
  const rawSelection = overrides[modelKey]
  if (!rawSelection || typeof rawSelection !== 'object' || Array.isArray(rawSelection)) return {}

  const selection: VideoGenerationOptions = {}
  for (const [field, value] of Object.entries(rawSelection)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    selection[field] = value
  }
  return selection
}

function replaceStoredVideoSelectionForModel(
  overrides: CapabilitySelections,
  modelKey: string,
  selection: VideoGenerationOptions,
): CapabilitySelections {
  if (!modelKey) return overrides

  const nextOverrides: CapabilitySelections = { ...overrides }
  const normalizedSelection: Record<string, string | number | boolean> = {}
  for (const [field, value] of Object.entries(selection)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    normalizedSelection[field] = value
  }

  if (Object.keys(normalizedSelection).length === 0) {
    delete nextOverrides[modelKey]
    return nextOverrides
  }

  nextOverrides[modelKey] = normalizedSelection
  return nextOverrides
}

export function useVideoStageRuntime({
  projectId,
  episodeId,
  storyboards,
  clips,
  defaultVideoModel,
  capabilityOverrides,
  videoRatio = '16:9',
  userVideoModels,
  onUpdateProjectConfig,
  onGenerateVideo,
  onGenerateAllVideos,
  onBack,
  onUpdateVideoPrompt,
  onUpdatePanelVideoModel,
  onOpenAssetLibraryForCharacter,
  onEnterEditor,
}: VideoStageShellProps) {
  const t = useTranslations('video')

  const {
    panelVideoPreference,
    voiceLinesExpanded,
    previewImage,
    setPreviewImage,
    toggleVoiceLinesExpanded,
    toggleLipSyncVideo,
    closePreviewImage,
  } = useVideoStageUiState()

  const {
    panelRefs,
    highlightedPanelKey,
    locateVoiceLinePanel,
  } = useVideoPanelViewport()

  const lipSyncMutation = useLipSync(projectId, episodeId)
  const listEpisodeVideoUrlsMutation = useListProjectEpisodeVideoUrls(projectId)
  const updatePanelLinkMutation = useUpdateProjectPanelLink(projectId)
  const generateVideoPromptMutation = useAiGenerateProjectVideoPrompt(projectId)
  const selectVideoCandidateMutation = useSelectProjectPanelVideoCandidate(projectId, episodeId)
  const deleteVideoCandidateMutation = useDeleteProjectPanelVideoCandidate(projectId, episodeId)
  const downloadRemoteBlobMutation = useDownloadRemoteBlob()
  const matchedVoiceLinesQuery = useMatchedVoiceLines(projectId, episodeId)

  const { panelVideoStates, panelLipStates } = useVideoTaskStates({
    projectId,
    storyboards,
  })
  const { allPanels } = useVideoPanelsProjection({
    storyboards,
    clips,
    panelVideoStates,
    panelLipStates,
  })

  const {
    savingPrompts,
    getLocalPrompt,
    updateLocalPrompt,
    savePrompt,
  } = useVideoPromptState({
    allPanels,
    onUpdateVideoPrompt,
  })

  const { linkedPanels, handleToggleLink } = useVideoPanelLinking({
    allPanels,
    updatePanelLinkMutation,
  })

  const {
    panelVoiceLines,
    allVoiceLines,
    runningVoiceLineIds,
    reloadVoiceLines,
  } = useVideoVoiceLines({
    projectId,
    matchedVoiceLinesQuery,
  })

  const {
    isDownloading,
    videosWithUrl,
    handleDownloadAllVideos,
  } = useVideoDownloadAll({
    episodeId,
    t: (key) => t(key as never),
    allPanels,
    panelVideoPreference,
    listEpisodeVideoUrlsMutation,
    downloadRemoteBlobMutation,
  })

  const allVideoModelOptions = useMemo(
    () => userVideoModels || [],
    [userVideoModels],
  )
  const normalVideoModelOptions = useMemo(
    () => filterNormalVideoModelOptions(allVideoModelOptions),
    [allVideoModelOptions],
  )

  const safeTranslate = useCallback((key: string | undefined, fallback = ''): string => {
    if (!key) return fallback
    try {
      return t(key as never)
    } catch {
      return fallback
    }
  }, [t])

  const renderCapabilityLabel = useCallback((field: {
    field: string
    label: string
    labelKey?: string
    unitKey?: string
  }): string => {
    const labelText = safeTranslate(field.labelKey, safeTranslate(`capability.${field.field}`, field.label))
    const unitText = safeTranslate(field.unitKey)
    return unitText ? `${labelText} (${unitText})` : labelText
  }, [safeTranslate])

  const defaultOptimizeInstruction = useMemo(
    () => t('stage.defaultOptimizeInstruction'),
    [t],
  )

  const [isBatchConfigOpen, setIsBatchConfigOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isOptimizingAllPrompts, setIsOptimizingAllPrompts] = useState(false)
  const [isSubmittingVideoBatch, setIsSubmittingVideoBatch] = useState(false)
  const [submittingVideoPanelKeys, setSubmittingVideoPanelKeys] = useState<Set<string>>(new Set())
  const [submittingVideoBaselines, setSubmittingVideoBaselines] = useState<Map<string, VideoSubmissionBaseline>>(new Map())
  const [videoGenerationCount, setVideoGenerationCountState] = useState(1)
  const [batchSelectedModel, setBatchSelectedModel] = useState('')
  const [batchGenerationOptions, setBatchGenerationOptions] = useState<VideoGenerationOptions>({})
  const [panelReferenceSelections, setPanelReferenceSelections] = useState<Map<string, VideoReferenceSelection>>(new Map())
  const [batchReferenceSelection, setBatchReferenceSelection] = useState<VideoReferenceSelection>({
    includeCharacters: false,
    includeLocation: false,
    includeProps: false,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const storedValue = window.localStorage.getItem(VIDEO_GENERATION_COUNT_STORAGE_KEY)
      setVideoGenerationCountState(normalizeVideoGenerationCount(storedValue))
    } catch {
      setVideoGenerationCountState(1)
    }
  }, [])

  const setVideoGenerationCount = useCallback((value: number) => {
    const normalized = normalizeVideoGenerationCount(value)
    setVideoGenerationCountState(normalized)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(VIDEO_GENERATION_COUNT_STORAGE_KEY, String(normalized))
    } catch {
      // ignore storage write failures
    }
  }, [])

  const persistVideoGenerationSelection = useCallback((modelKey: string, selection: VideoGenerationOptions) => {
    if (!modelKey) return
    const nextOverrides = replaceStoredVideoSelectionForModel(capabilityOverrides, modelKey, selection)
    void onUpdateProjectConfig('capabilityOverrides', nextOverrides)
  }, [capabilityOverrides, onUpdateProjectConfig])

  const updatePanelReferenceSelection = useCallback((panelKey: string, selection: VideoReferenceSelection) => {
    setPanelReferenceSelections((previous) => {
      const nextSelection = normalizeVideoReferenceSelection(selection)
      if (isVideoReferenceSelectionEmpty(nextSelection)) {
        if (!previous.has(panelKey)) return previous
        const next = new Map(previous)
        next.delete(panelKey)
        return next
      }

      const current = previous.get(panelKey)
      if (JSON.stringify(current || {}) === JSON.stringify(nextSelection)) {
        return previous
      }

      const next = new Map(previous)
      next.set(panelKey, nextSelection)
      return next
    })
  }, [])

  useEffect(() => {
    if (normalVideoModelOptions.length === 0) {
      if (batchSelectedModel) setBatchSelectedModel('')
      return
    }
    if (normalVideoModelOptions.some((model) => model.value === batchSelectedModel)) return

    const nextDefault = normalVideoModelOptions.some((model) => model.value === defaultVideoModel)
      ? defaultVideoModel
      : (normalVideoModelOptions[0]?.value || '')
    setBatchSelectedModel(nextDefault)
  }, [normalVideoModelOptions, batchSelectedModel, defaultVideoModel])

  const selectedBatchModelOption = useMemo<VideoModelOption | undefined>(
    () => normalVideoModelOptions.find((option) => option.value === batchSelectedModel),
    [normalVideoModelOptions, batchSelectedModel],
  )
  const batchPricingTiers = useMemo(
    () => projectVideoPricingTiersByFixedSelections({
      tiers: selectedBatchModelOption?.videoPricingTiers ?? [],
      fixedSelections: {
        generationMode: 'normal',
      },
    }),
    [selectedBatchModelOption?.videoPricingTiers],
  )

  const batchCapabilityDefinitions = useMemo<BatchCapabilityDefinition[]>(() => {
    return resolveEffectiveVideoCapabilityDefinitions({
      videoCapabilities: selectedBatchModelOption?.capabilities?.video,
      pricingTiers: batchPricingTiers,
    })
  }, [batchPricingTiers, selectedBatchModelOption?.capabilities?.video])

  const selectedBatchModelOverrides = useMemo(
    () => readStoredVideoSelectionForModel(capabilityOverrides, batchSelectedModel),
    [batchSelectedModel, capabilityOverrides],
  )
  const selectedBatchModelOverridesSignature = useMemo(
    () => JSON.stringify(selectedBatchModelOverrides),
    [selectedBatchModelOverrides],
  )
  const preferredBatchSelection = useMemo<VideoGenerationOptions>(() => {
    const nextSelection: VideoGenerationOptions = {}
    if (videoRatio) {
      nextSelection.aspectRatio = videoRatio
    }
    return nextSelection
  }, [videoRatio])

  useEffect(() => {
    setBatchGenerationOptions(normalizeVideoGenerationSelections({
      definitions: batchCapabilityDefinitions,
      pricingTiers: batchPricingTiers,
      selection: selectedBatchModelOverrides,
      preferredSelection: preferredBatchSelection,
    }))
  }, [
    batchCapabilityDefinitions,
    batchPricingTiers,
    preferredBatchSelection,
    selectedBatchModelOverrides,
    selectedBatchModelOverridesSignature,
  ])

  useEffect(() => {
    setBatchGenerationOptions((previous) => {
      return normalizeVideoGenerationSelections({
        definitions: batchCapabilityDefinitions,
        pricingTiers: batchPricingTiers,
        selection: previous,
        preferredSelection: preferredBatchSelection,
      })
    })
  }, [batchCapabilityDefinitions, batchPricingTiers, preferredBatchSelection])

  const batchEffectiveCapabilityFields = useMemo(
    () => resolveEffectiveVideoCapabilityFields({
      definitions: batchCapabilityDefinitions,
      pricingTiers: batchPricingTiers,
      selection: batchGenerationOptions,
      preferredSelection: preferredBatchSelection,
    }),
    [batchCapabilityDefinitions, batchGenerationOptions, batchPricingTiers, preferredBatchSelection],
  )

  const batchEffectiveFieldMap = useMemo(
    () => new Map(batchEffectiveCapabilityFields.map((field) => [field.field, field])),
    [batchEffectiveCapabilityFields],
  )
  const batchDefinitionFieldMap = useMemo(
    () => new Map(batchCapabilityDefinitions.map((definition) => [definition.field, definition])),
    [batchCapabilityDefinitions],
  )

  const batchCapabilityFields = useMemo<BatchCapabilityField[]>(() => {
    return batchCapabilityDefinitions.map((definition) => {
      const effectiveField = batchEffectiveFieldMap.get(definition.field)
      const enabledOptions = effectiveField?.options ?? []
      return {
        field: definition.field,
        label: toFieldLabel(definition.field),
        labelKey: definition.fieldI18n?.labelKey,
        unitKey: definition.fieldI18n?.unitKey,
        options: definition.options as VideoGenerationOptionValue[],
        disabledOptions: (definition.options as VideoGenerationOptionValue[])
          .filter((option) => !enabledOptions.includes(option)),
      }
    })
  }, [batchCapabilityDefinitions, batchEffectiveFieldMap])

  const batchMissingCapabilityFields = useMemo(
    () => batchEffectiveCapabilityFields
      .filter((field) => field.options.length === 0 || field.value === undefined)
      .map((field) => field.field),
    [batchEffectiveCapabilityFields],
  )

  const handleBatchModelChange = useCallback((modelKey: string) => {
    setBatchSelectedModel(modelKey)
    void onUpdateProjectConfig('videoModel', modelKey)
  }, [onUpdateProjectConfig])

  const setBatchCapabilityValue = useCallback((field: string, rawValue: string) => {
    if (!batchSelectedModel) return
    const capabilityDefinition = batchDefinitionFieldMap.get(field)
    if (!capabilityDefinition || capabilityDefinition.options.length === 0) return
    const sample = capabilityDefinition.options[0]
    const parsedValue =
      typeof sample === 'number'
        ? Number(rawValue)
        : typeof sample === 'boolean'
          ? rawValue === 'true'
          : rawValue
    if (!capabilityDefinition.options.includes(parsedValue)) return
    const nextSelection = normalizeVideoGenerationSelections({
      definitions: batchCapabilityDefinitions,
      pricingTiers: batchPricingTiers,
      selection: {
        ...batchGenerationOptions,
        [field]: parsedValue,
      },
      pinnedFields: [field],
      preferredSelection: preferredBatchSelection,
    })
    setBatchGenerationOptions(nextSelection)
    persistVideoGenerationSelection(batchSelectedModel, nextSelection)
  }, [
    batchCapabilityDefinitions,
    batchDefinitionFieldMap,
    batchGenerationOptions,
    batchPricingTiers,
    batchSelectedModel,
    persistVideoGenerationSelection,
    preferredBatchSelection,
  ])

  const handleLipSync = useCallback(async (
    storyboardId: string,
    panelIndex: number,
    voiceLineId: string,
    panelId?: string,
  ) => {
    try {
      await lipSyncMutation.mutateAsync({
        storyboardId,
        panelIndex,
        voiceLineId,
        panelId,
      })
    } catch (error: unknown) {
      _ulogError('Lip sync error:', error)
      throw error
    }
  }, [lipSyncMutation])

  const panelBySubmissionKey = useMemo(() => {
    const next = new Map<string, (typeof allPanels)[number]>()
    for (const panel of allPanels) {
      next.set(buildVideoSubmissionKey(panel), panel)
    }
    return next
  }, [allPanels])

  const handleGenerateVideoWithImmediateLock = useCallback(async (
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
      mode: 'edit' | 'extend'
      sourceCandidateId: string
      instruction: string
      extendDuration?: number
    },
    referenceSelection?: VideoReferenceSelection,
    panelId?: string,
    count?: number,
  ) => {
    if (isSubmittingVideoBatch) return

    const panelKey = buildVideoSubmissionKey({ panelId, storyboardId, panelIndex })
    const currentPanel = panelBySubmissionKey.get(panelKey)
    if (currentPanel?.videoTaskRunning || submittingVideoPanelKeys.has(panelKey)) return

    setSubmittingVideoPanelKeys((previous) => {
      if (previous.has(panelKey)) return previous
      const next = new Set(previous)
      next.add(panelKey)
      return next
    })
    if (currentPanel) {
      setSubmittingVideoBaselines((previous) => {
        const next = new Map(previous)
        next.set(panelKey, createVideoSubmissionBaseline(currentPanel))
        return next
      })
    }

    try {
      await onGenerateVideo(
        storyboardId,
        panelIndex,
        videoModel,
        firstLastFrame,
        generationOptions,
        videoOperation,
        referenceSelection,
        panelId,
        count,
      )
    } catch (error) {
      setSubmittingVideoPanelKeys((previous) => {
        if (!previous.has(panelKey)) return previous
        const next = new Set(previous)
        next.delete(panelKey)
        return next
      })
      setSubmittingVideoBaselines((previous) => {
        if (!previous.has(panelKey)) return previous
        const next = new Map(previous)
        next.delete(panelKey)
        return next
      })
      throw error
    }
  }, [
    isSubmittingVideoBatch,
    onGenerateVideo,
    panelBySubmissionKey,
    submittingVideoPanelKeys,
  ])

  const {
    flModel,
    flModelOptions,
    flGenerationOptions,
    flCapabilityFields,
    flMissingCapabilityFields,
    flCustomPrompts,
    setFlModel,
    setFlCapabilityValue,
    setFlCustomPrompt,
    resetFlCustomPrompt,
    handleGenerateFirstLastFrame,
    getDefaultFlPrompt,
    getNextPanel,
    isLinkedAsLastFrame,
  } = useVideoFirstLastFrameFlow({
    allPanels,
    linkedPanels,
    videoModelOptions: allVideoModelOptions,
    videoRatio,
    onGenerateVideo: handleGenerateVideoWithImmediateLock,
    t: (key) => t(key as never),
  })

  useEffect(() => {
    if (submittingVideoPanelKeys.size === 0) return

    const now = Date.now()
    setSubmittingVideoPanelKeys((previous) => {
      let changed = false
      const next = new Set(previous)
      for (const key of previous) {
        if (!shouldResolveVideoSubmissionLock(panelBySubmissionKey.get(key), submittingVideoBaselines.get(key), now)) {
          continue
        }
        next.delete(key)
        changed = true
      }
      return changed ? next : previous
    })
    setSubmittingVideoBaselines((previous) => {
      let changed = false
      const next = new Map(previous)
      for (const key of previous.keys()) {
        if (submittingVideoPanelKeys.has(key) && !shouldResolveVideoSubmissionLock(panelBySubmissionKey.get(key), previous.get(key), now)) {
          continue
        }
        next.delete(key)
        changed = true
      }
      return changed ? next : previous
    })
  }, [panelBySubmissionKey, submittingVideoBaselines, submittingVideoPanelKeys])

  useEffect(() => {
    if (!isSubmittingVideoBatch || allPanels.some((panel) => panel.videoTaskRunning)) {
      if (isSubmittingVideoBatch && allPanels.some((panel) => panel.videoTaskRunning)) {
        setIsSubmittingVideoBatch(false)
      }
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsSubmittingVideoBatch(false)
    }, 90_000)
    return () => window.clearTimeout(timeoutId)
  }, [allPanels, isSubmittingVideoBatch])

  const handleGenerateAllVideosWithImmediateLock = useCallback(async (options?: Parameters<typeof onGenerateAllVideos>[0]) => {
    if (isSubmittingVideoBatch) return
    setIsSubmittingVideoBatch(true)
    try {
      await onGenerateAllVideos(options)
    } catch (error) {
      setIsSubmittingVideoBatch(false)
      throw error
    }
  }, [isSubmittingVideoBatch, onGenerateAllVideos])

  const projectedPanels = useMemo(() => (
    allPanels.map((panel) => {
      const panelKey = buildVideoSubmissionKey(panel)
      if (!isSubmittingVideoBatch && !submittingVideoPanelKeys.has(panelKey)) return panel
      return {
        ...panel,
        videoTaskRunning: true,
      }
    })
  ), [allPanels, isSubmittingVideoBatch, submittingVideoPanelKeys])

  const runningCount = projectedPanels.filter((panel) => panel.videoTaskRunning || panel.lipSyncTaskRunning).length
  const failedCount = allPanels.filter((panel) => !!panel.videoErrorMessage || !!panel.lipSyncErrorMessage).length
  const isAnyTaskRunning = runningCount > 0 || isSubmittingVideoBatch
  const canSubmitBatchGenerate = !!batchSelectedModel && batchMissingCapabilityFields.length === 0

  const handleOpenBatchGenerateModal = useCallback(() => {
    if (isAnyTaskRunning) return
    setIsBatchConfigOpen(true)
  }, [isAnyTaskRunning])

  const handleCloseBatchGenerateModal = useCallback(() => {
    setIsBatchConfigOpen(false)
  }, [])

  const handleConfirmBatchGenerate = useCallback(async () => {
    if (!canSubmitBatchGenerate || isConfirming) return

    setIsConfirming(true)
    try {
      await handleGenerateAllVideosWithImmediateLock({
        videoModel: batchSelectedModel,
        count: videoGenerationCount,
        generationOptions: batchGenerationOptions,
        referenceSelection: batchReferenceSelection,
      })
      setIsBatchConfigOpen(false)
    } finally {
      setIsConfirming(false)
    }
  }, [
    batchGenerationOptions,
    batchReferenceSelection,
    batchSelectedModel,
    canSubmitBatchGenerate,
    handleGenerateAllVideosWithImmediateLock,
    isConfirming,
  ])

  const requestVideoPromptByAi = useCallback(async (params: {
    panelId: string
    lastPanelId?: string
    currentPrompt?: string
    currentVideoPrompt: string
    modifyInstruction: string
  }, options?: {
    showAlert?: boolean
  }) => {
    try {
      const result = await generateVideoPromptMutation.mutateAsync(params)
      const generatedVideoPrompt = result.generatedVideoPrompt?.trim()
      if (!generatedVideoPrompt) {
        throw new Error(t('stage.error.generatePromptFailed'))
      }
      return generatedVideoPrompt
    } catch (error) {
      if (options?.showAlert !== false) {
        alert(`${t('stage.error.generatePromptFailed')}: ${getErrorMessage(error) || t('errors.unknownError')}`)
      }
      throw error
    }
  }, [generateVideoPromptMutation, t])

  const handleGeneratePromptByAi = useCallback(async (params: {
    panelId: string
    lastPanelId?: string
    currentPrompt?: string
    currentVideoPrompt: string
    modifyInstruction: string
  }) => {
    return requestVideoPromptByAi(params)
  }, [requestVideoPromptByAi])

  const optimizablePromptTargets = useMemo(() => {
    return allPanels.flatMap((panel, index) => {
      const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
      const isLinked = linkedPanels.get(panelKey) || false
      const isLastFrame = isLinkedAsLastFrame(index)
      if (isLastFrame && !isLinked) return []
      if (!panel.panelId) return []

      const promptField: PromptField = isLinked ? 'firstLastFramePrompt' : 'videoPrompt'
      const nextPanel = getNextPanel(index)
      if (isLinked && !nextPanel?.panelId) return []

      const nextPanelKey = nextPanel ? `${nextPanel.storyboardId}-${nextPanel.panelIndex}` : null
      const currentBasePrompt = getLocalPrompt(panelKey, panel.textPanel?.video_prompt, 'videoPrompt')
      const nextBasePrompt = nextPanelKey
        ? getLocalPrompt(nextPanelKey, nextPanel?.textPanel?.video_prompt, 'videoPrompt')
        : undefined
      const defaultFlPrompt = getDefaultFlPrompt(currentBasePrompt, nextBasePrompt)
      const externalPrompt = isLinked
        ? (flCustomPrompts.get(panelKey) || panel.firstLastFramePrompt || defaultFlPrompt)
        : panel.textPanel?.video_prompt
      const currentVideoPrompt = getLocalPrompt(panelKey, externalPrompt, promptField).trim()
      if (!currentVideoPrompt) return []

      return [{
        panel,
        panelKey,
        promptField,
        currentVideoPrompt,
        lastPanelId: isLinked ? nextPanel?.panelId : undefined,
      }]
    })
  }, [
    allPanels,
    flCustomPrompts,
    getDefaultFlPrompt,
    getLocalPrompt,
    getNextPanel,
    isLinkedAsLastFrame,
    linkedPanels,
  ])

  const canOptimizePrompts = optimizablePromptTargets.length > 0

  const handleOptimizeAllPrompts = useCallback(async () => {
    if (isAnyTaskRunning || isOptimizingAllPrompts) return
    if (optimizablePromptTargets.length === 0) {
      alert(t('toolbar.noPromptsToOptimize'))
      return
    }

    setIsOptimizingAllPrompts(true)
    let optimizedCount = 0
    let failedCount = 0

    try {
      for (const target of optimizablePromptTargets) {
        const {
          panel,
          panelKey,
          promptField,
          currentVideoPrompt,
          lastPanelId,
        } = target
        const hadPreviousFlCustomPrompt = flCustomPrompts.has(panelKey)
        const previousFlCustomPrompt = flCustomPrompts.get(panelKey) || ''

        try {
          const generatedPrompt = await requestVideoPromptByAi({
            panelId: panel.panelId!,
            lastPanelId,
            currentPrompt: panel.textPanel?.imagePrompt,
            currentVideoPrompt,
            modifyInstruction: defaultOptimizeInstruction,
          }, { showAlert: false })

          updateLocalPrompt(panelKey, generatedPrompt, promptField)
          if (promptField === 'firstLastFramePrompt') {
            setFlCustomPrompt(panelKey, generatedPrompt)
          }

          await onUpdateVideoPrompt(panel.storyboardId, panel.panelIndex, generatedPrompt, promptField)
          optimizedCount += 1
        } catch (error) {
          failedCount += 1
          updateLocalPrompt(panelKey, currentVideoPrompt, promptField)
          if (promptField === 'firstLastFramePrompt') {
            if (hadPreviousFlCustomPrompt) setFlCustomPrompt(panelKey, previousFlCustomPrompt)
            else resetFlCustomPrompt(panelKey)
          }
          _ulogError('Batch optimize video prompt failed:', error)
        }
      }

      if (failedCount > 0) {
        alert(t('toolbar.optimizeAllPromptsPartial', { optimizedCount, failedCount }))
        return
      }

      alert(t('toolbar.optimizeAllPromptsComplete', { count: optimizedCount }))
    } finally {
      setIsOptimizingAllPrompts(false)
    }
  }, [
    defaultOptimizeInstruction,
    flCustomPrompts,
    isAnyTaskRunning,
    isOptimizingAllPrompts,
    onUpdateVideoPrompt,
    optimizablePromptTargets,
    requestVideoPromptByAi,
    resetFlCustomPrompt,
    setFlCustomPrompt,
    t,
    updateLocalPrompt,
  ])

  const handleSelectVideoCandidate = useCallback(async (panelId: string, candidateId: string) => {
    try {
      await selectVideoCandidateMutation.mutateAsync({ panelId, candidateId })
    } catch (error) {
      alert(`${t('stage.error.selectVideoCandidateFailed')}: ${getErrorMessage(error) || t('errors.unknownError')}`)
      throw error
    }
  }, [selectVideoCandidateMutation, t])

  const handleDeleteVideoCandidate = useCallback(async (panelId: string, candidateId: string) => {
    try {
      await deleteVideoCandidateMutation.mutateAsync({ panelId, candidateId })
    } catch (error) {
      alert(`${t('stage.error.deleteVideoCandidateFailed')}: ${getErrorMessage(error) || t('errors.unknownError')}`)
      throw error
    }
  }, [deleteVideoCandidateMutation, t])

  const handleDownloadVideoCandidate = useCallback(async (videoUrl: string, fileName: string) => {
    try {
      const blob = await downloadRemoteBlobMutation.mutateAsync(videoUrl)
      const objectUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      window.URL.revokeObjectURL(objectUrl)
      document.body.removeChild(anchor)
    } catch (error) {
      alert(`${t('stage.downloadFailed')}: ${getErrorMessage(error) || t('errors.unknownError')}`)
      throw error
    }
  }, [downloadRemoteBlobMutation, t])

  return (
    <div className="space-y-6 pb-20">
      <VideoToolbar
        totalPanels={projectedPanels.length}
        runningCount={runningCount}
        videosWithUrl={videosWithUrl}
        failedCount={failedCount}
        isAnyTaskRunning={isAnyTaskRunning}
        isDownloading={isDownloading}
        isOptimizingPrompts={isOptimizingAllPrompts}
        canOptimizePrompts={canOptimizePrompts}
        onOptimizeAllPrompts={() => { void handleOptimizeAllPrompts() }}
        onGenerateAll={handleOpenBatchGenerateModal}
        onDownloadAll={handleDownloadAllVideos}
        onBack={onBack}
        onEnterEditor={onEnterEditor}
        videosReady={videosWithUrl > 0}
      />

      <VideoTimelinePanel
        projectId={projectId}
        episodeId={episodeId}
        allVoiceLines={allVoiceLines}
        expanded={voiceLinesExpanded}
        onToggleExpanded={toggleVoiceLinesExpanded}
        onReloadVoiceLines={reloadVoiceLines}
        onLocateVoiceLine={locateVoiceLinePanel}
        onOpenAssetLibraryForCharacter={onOpenAssetLibraryForCharacter}
      />

      <VideoRenderPanel
        allPanels={projectedPanels}
        linkedPanels={linkedPanels}
        highlightedPanelKey={highlightedPanelKey}
        panelRefs={panelRefs}
        videoRatio={videoRatio}
        defaultVideoModel={defaultVideoModel}
        capabilityOverrides={capabilityOverrides}
        userVideoModels={normalVideoModelOptions}
        projectId={projectId}
        episodeId={episodeId}
        runningVoiceLineIds={runningVoiceLineIds}
        panelVoiceLines={panelVoiceLines}
        panelVideoPreference={panelVideoPreference}
        savingPrompts={savingPrompts}
        flModel={flModel}
        flModelOptions={flModelOptions}
        flGenerationOptions={flGenerationOptions}
        flCapabilityFields={flCapabilityFields}
        flMissingCapabilityFields={flMissingCapabilityFields}
        flCustomPrompts={flCustomPrompts}
        defaultOptimizeInstruction={defaultOptimizeInstruction}
        onGenerateVideo={handleGenerateVideoWithImmediateLock}
        panelReferenceSelections={panelReferenceSelections}
        onUpdateReferenceSelection={updatePanelReferenceSelection}
        videoGenerationCount={videoGenerationCount}
        onVideoGenerationCountChange={setVideoGenerationCount}
        onSelectVideoCandidate={handleSelectVideoCandidate}
        onDeleteVideoCandidate={handleDeleteVideoCandidate}
        onDownloadVideoCandidate={handleDownloadVideoCandidate}
        onUpdatePanelVideoModel={onUpdatePanelVideoModel}
        onLipSync={handleLipSync}
        onToggleLink={handleToggleLink}
        onFlModelChange={setFlModel}
        onFlCapabilityChange={setFlCapabilityValue}
        onFlCustomPromptChange={setFlCustomPrompt}
        onResetFlPrompt={resetFlCustomPrompt}
        onGenerateFirstLastFrame={handleGenerateFirstLastFrame}
        onPreviewImage={setPreviewImage}
        onToggleLipSyncVideo={toggleLipSyncVideo}
        getNextPanel={getNextPanel}
        isLinkedAsLastFrame={isLinkedAsLastFrame}
        getDefaultFlPrompt={getDefaultFlPrompt}
        getLocalPrompt={getLocalPrompt}
        updateLocalPrompt={updateLocalPrompt}
        savePrompt={savePrompt}
        onGeneratePromptByAi={handleGeneratePromptByAi}
        onUpdateVideoGenerationOptions={persistVideoGenerationSelection}
      />

      {isBatchConfigOpen && (
        <div
          className="fixed inset-0 z-[120] glass-overlay flex items-center justify-center p-4"
          onClick={handleCloseBatchGenerateModal}
        >
          <div
            className="glass-surface-modal w-full max-w-2xl p-5 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[var(--glass-text-primary)]">
                {t('toolbar.batchConfigTitle')}
              </h3>
              <p className="text-sm text-[var(--glass-text-tertiary)]">
                {t('toolbar.batchConfigDesc')}
              </p>
            </div>

            <ModelCapabilityDropdown
              models={normalVideoModelOptions}
              value={batchSelectedModel || undefined}
              onModelChange={handleBatchModelChange}
              capabilityFields={batchCapabilityFields.map((field) => ({
                field: field.field,
                label: renderCapabilityLabel(field),
                options: field.options,
                disabledOptions: field.disabledOptions,
              }))}
              capabilityOverrides={batchGenerationOptions}
              onCapabilityChange={(field, rawValue) => setBatchCapabilityValue(field, rawValue)}
              placeholder={t('panelCard.selectModel')}
            />

            <div className="flex items-center justify-between rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-[var(--glass-text-primary)]">
                  {t('panelCard.videoCountLabel')}
                </div>
                <div className="text-xs text-[var(--glass-text-tertiary)]">
                  {t('panelCard.videoCountHint')}
                </div>
              </div>
              <select
                value={String(videoGenerationCount)}
                onChange={(event) => setVideoGenerationCount(Number(event.target.value))}
                className="glass-select-base min-w-[96px] rounded-lg px-3 py-2 text-sm"
              >
                {getVideoGenerationCountOptions().map((option) => (
                  <option key={option} value={option}>
                    {t('panelCard.videoCountOption', { count: option })}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-4 py-3">
              <div className="text-sm font-medium text-[var(--glass-text-primary)]">
                {t('panelCard.referenceAssetsLabel')}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--glass-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={batchReferenceSelection.includeCharacters === true}
                    onChange={(event) => setBatchReferenceSelection((previous) => ({
                      ...previous,
                      includeCharacters: event.target.checked,
                    }))}
                    className="h-4 w-4 rounded border border-[var(--glass-stroke-base)] bg-transparent accent-[var(--glass-accent-from)]"
                  />
                  <span>{t('panelCard.referenceCharacters')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--glass-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={batchReferenceSelection.includeLocation === true}
                    onChange={(event) => setBatchReferenceSelection((previous) => ({
                      ...previous,
                      includeLocation: event.target.checked,
                    }))}
                    className="h-4 w-4 rounded border border-[var(--glass-stroke-base)] bg-transparent accent-[var(--glass-accent-from)]"
                  />
                  <span>{t('panelCard.referenceLocation')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--glass-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={batchReferenceSelection.includeProps === true}
                    onChange={(event) => setBatchReferenceSelection((previous) => ({
                      ...previous,
                      includeProps: event.target.checked,
                    }))}
                    className="h-4 w-4 rounded border border-[var(--glass-stroke-base)] bg-transparent accent-[var(--glass-accent-from)]"
                  />
                  <span>{t('panelCard.referenceProps')}</span>
                </label>
              </div>
              <div className="mt-2 text-xs text-[var(--glass-text-tertiary)]">
                {t('panelCard.referenceAssetsHint')}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCloseBatchGenerateModal}
                className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm font-medium"
              >
                {t('panelCard.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmBatchGenerate() }}
                disabled={!canSubmitBatchGenerate || isConfirming}
                className="glass-btn-base glass-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isConfirming ? (
                  <>
                    <AppIcon name="loader" className="animate-spin h-4 w-4" />
                    <span>{t('toolbar.confirming')}</span>
                  </>
                ) : (
                  <span>{t('toolbar.confirmGenerateAll')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={closePreviewImage} />}
    </div>
  )
}
