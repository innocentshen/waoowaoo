'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { VideoPanelCardShellProps } from '../types'
import { EMPTY_RUNNING_VOICE_LINE_IDS } from './shared'
import { usePanelTaskStatus } from './hooks/usePanelTaskStatus'
import { usePanelVideoModel } from './hooks/usePanelVideoModel'
import { usePanelPlayer } from './hooks/usePanelPlayer'
import { usePanelPromptEditor } from './hooks/usePanelPromptEditor'
import { usePanelVoiceManager } from './hooks/usePanelVoiceManager'
import { usePanelLipSync } from './hooks/usePanelLipSync'

export function useVideoPanelActions({
  panel,
  panelIndex,
  defaultVideoModel,
  capabilityOverrides,
  videoRatio = '16:9',
  userVideoModels,
  projectId,
  episodeId,
  runningVoiceLineIds = EMPTY_RUNNING_VOICE_LINE_IDS,
  matchedVoiceLines = [],
  onLipSync,
  showLipSyncVideo,
  onToggleLipSyncVideo,
  isLinked,
  isLastFrame,
  nextPanel,
  prevPanel,
  hasNext,
  flModel,
  flModelOptions,
  flGenerationOptions,
  flCapabilityFields,
  flMissingCapabilityFields,
  flCustomPrompt,
  defaultFlPrompt,
  defaultOptimizeInstruction,
  localPrompt,
  isSavingPrompt,
  onUpdateLocalPrompt,
  onSavePrompt,
  onGeneratePromptByAi,
  onGeneratePromptByAiForViewer,
  onGenerateVideo,
  referenceOptions,
  referenceSelection,
  onUpdateReferenceSelection,
  videoGenerationCount,
  onVideoGenerationCountChange,
  viewerPanelIndex,
  onOpenViewerForPanel,
  onUpdateViewerPrompt,
  onSaveViewerPrompt,
  onSelectVideoCandidate,
  onDeleteVideoCandidate,
  onDownloadVideoCandidate,
  onUpdatePanelVideoModel,
  onUpdateVideoGenerationOptions,
  onToggleLink,
  onFlModelChange,
  onFlCapabilityChange,
  onFlCustomPromptChange,
  onResetFlPrompt,
  onGenerateFirstLastFrame,
  onPreviewImage,
}: VideoPanelCardShellProps) {
  const t = useTranslations('video')
  const tCommon = useTranslations('common')
  const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
  const promptField = isLinked ? 'firstLastFramePrompt' : 'videoPrompt'
  const isFirstLastFrameOutput = panel.videoGenerationMode === 'firstlastframe' && !!panel.videoUrl
  const [previewCandidateId, setPreviewCandidateId] = useState<string | null>(null)
  const previewCandidate = useMemo(
    () => panel.videoCandidates?.find((candidate) => candidate.id === previewCandidateId) || null,
    [panel.videoCandidates, previewCandidateId],
  )

  useEffect(() => {
    if (!previewCandidateId) return
    if (panel.videoCandidates?.some((candidate) => candidate.id === previewCandidateId)) return
    setPreviewCandidateId(null)
  }, [panel.videoCandidates, previewCandidateId])

  const visibleBaseVideoUrl = (() => {
    if (previewCandidate?.videoUrl) return previewCandidate.videoUrl
    if (isLinked) return isFirstLastFrameOutput ? panel.videoUrl : undefined
    if (isLastFrame) return undefined
    return panel.videoUrl
  })()
  const hasVisibleBaseVideo = !!visibleBaseVideoUrl

  const taskStatus = usePanelTaskStatus({
    panel,
    hasVisibleBaseVideo,
    tCommon: (key: string) => tCommon(key as never),
  })
  const preferredSelection = useMemo(
    () => (videoRatio ? { aspectRatio: videoRatio } : undefined),
    [videoRatio],
  )

  const videoModel = usePanelVideoModel({
    defaultVideoModel,
    capabilityOverrides,
    userVideoModels,
    preferredSelection,
    onPersistSelectedModel: (modelKey) => onUpdatePanelVideoModel(panel.storyboardId, panel.panelIndex, modelKey),
    onPersistGenerationOptions: onUpdateVideoGenerationOptions,
  })

  const player = usePanelPlayer({
    videoRatio,
    imageUrl: panel.imageUrl,
    videoUrl: visibleBaseVideoUrl,
    lipSyncVideoUrl: panel.lipSyncVideoUrl,
    previewVideoUrl: previewCandidate?.videoUrl,
    showLipSyncVideo,
    onPreviewImage,
  })

  const handleUpdateLocalPrompt = useCallback((value: string) => {
    if (onUpdateLocalPrompt) {
      onUpdateLocalPrompt(value)
      return
    }

    onUpdateViewerPrompt?.(panelKey, value, promptField)
    if (isLinked) {
      onFlCustomPromptChange(panelKey, value)
    }
  }, [isLinked, onFlCustomPromptChange, onUpdateLocalPrompt, onUpdateViewerPrompt, panelKey, promptField])

  const handleSavePrompt = useCallback((value: string) => {
    if (onSavePrompt) {
      return onSavePrompt(value)
    }
    if (!onSaveViewerPrompt) {
      return Promise.resolve()
    }

    return onSaveViewerPrompt(panel.storyboardId, panel.panelIndex, panelKey, value, promptField)
  }, [onSavePrompt, onSaveViewerPrompt, panel.panelIndex, panel.storyboardId, panelKey, promptField])

  const boundGeneratePromptByAi = useMemo(() => {
    if (onGeneratePromptByAi) return onGeneratePromptByAi
    const panelId = panel.panelId
    if (!panelId || !onGeneratePromptByAiForViewer || (isLinked && !nextPanel?.panelId)) {
      return undefined
    }

    return (modifyInstruction: string, currentVideoPrompt: string) => onGeneratePromptByAiForViewer({
      panelId,
      lastPanelId: isLinked ? nextPanel?.panelId : undefined,
      currentPrompt: panel.textPanel?.imagePrompt,
      currentVideoPrompt,
      modifyInstruction,
    })
  }, [
    isLinked,
    nextPanel?.panelId,
    onGeneratePromptByAi,
    onGeneratePromptByAiForViewer,
    panel.panelId,
    panel.textPanel?.imagePrompt,
  ])

  const promptEditor = usePanelPromptEditor({
    localPrompt,
    onUpdateLocalPrompt: handleUpdateLocalPrompt,
    onSavePrompt: handleSavePrompt,
    onGeneratePromptByAi: boundGeneratePromptByAi,
    defaultOptimizeInstruction,
  })

  const voiceManager = usePanelVoiceManager({
    projectId,
    episodeId,
    matchedVoiceLines,
    runningVoiceLineIds,
    audioFailedMessage: t('panelCard.error.audioFailed'),
  })

  const lipSync = usePanelLipSync({
    panel,
    matchedVoiceLines,
    onLipSync,
  })

  const showLipSyncSection = voiceManager.hasMatchedVoiceLines
  const canLipSync = hasVisibleBaseVideo && voiceManager.hasMatchedAudio && !taskStatus.isLipSyncTaskRunning
  const handlePreviewVideoCandidate = useCallback((candidateId: string) => {
    setPreviewCandidateId((current) => current === candidateId ? null : candidateId)
  }, [])

  const handleClearPreviewVideoCandidate = useCallback(() => {
    setPreviewCandidateId(null)
  }, [])

  const handleSelectVideoCandidate = useCallback(async (candidateId: string) => {
    if (!panel.panelId || !onSelectVideoCandidate) return
    await onSelectVideoCandidate(panel.panelId, candidateId)
    setPreviewCandidateId(null)
  }, [onSelectVideoCandidate, panel.panelId])

  const handleDeleteVideoCandidate = useCallback(async (candidateId: string) => {
    if (!panel.panelId || !onDeleteVideoCandidate) return
    await onDeleteVideoCandidate(panel.panelId, candidateId)
    setPreviewCandidateId((current) => current === candidateId ? null : current)
  }, [onDeleteVideoCandidate, panel.panelId])

  const handleDownloadVideoCandidate = useCallback(async (videoUrl: string, fileName: string) => {
    if (!onDownloadVideoCandidate) return
    await onDownloadVideoCandidate(videoUrl, fileName)
  }, [onDownloadVideoCandidate])

  const handleOpenViewerForCurrentPanel = useCallback((candidateId?: string) => {
    if (!onOpenViewerForPanel || typeof viewerPanelIndex !== 'number' || viewerPanelIndex < 0) return
    const fallbackCandidateId = candidateId
      || previewCandidate?.id
      || panel.videoCandidates?.find((candidate) => candidate.isSelected)?.id
      || panel.videoCandidates?.[0]?.id
    onOpenViewerForPanel(viewerPanelIndex, fallbackCandidateId)
  }, [onOpenViewerForPanel, panel.videoCandidates, previewCandidate?.id, viewerPanelIndex])

  return {
    t,
    tCommon,
    panel,
    panelIndex,
    panelKey,
    media: {
      showLipSyncVideo,
      onToggleLipSyncVideo,
      onPreviewImage,
      baseVideoUrl: visibleBaseVideoUrl,
      currentVideoUrl: player.currentVideoUrl,
      previewCandidateId,
    },
    taskStatus,
    videoModel,
    player,
    promptEditor: {
      ...promptEditor,
      localPrompt,
      isSavingPrompt,
    },
    voiceManager,
    lipSync,
    layout: {
      isLinked,
      isLastFrame,
      nextPanel,
      prevPanel,
      hasNext,
      flModel,
      flModelOptions,
      flGenerationOptions,
      flCapabilityFields,
      flMissingCapabilityFields,
      flCustomPrompt,
      defaultFlPrompt,
      videoRatio,
    },
    actions: {
      onGenerateVideo,
      referenceOptions,
      referenceSelection,
      onUpdateReferenceSelection,
      onSelectVideoCandidate,
      onDeleteVideoCandidate,
      onUpdatePanelVideoModel,
      onUpdateVideoGenerationOptions,
      onToggleLink,
      onFlModelChange,
      onFlCapabilityChange,
      onFlCustomPromptChange,
      onResetFlPrompt,
      onGenerateFirstLastFrame,
    },
    computed: {
      showLipSyncSection,
      canLipSync,
      hasVisibleBaseVideo,
    },
    candidates: {
      count: panel.videoCandidates?.length || 0,
      videoGenerationCount,
      previewCandidateId,
      previewCandidate,
      items: panel.videoCandidates || [],
      viewerPanelIndex: typeof viewerPanelIndex === 'number' ? viewerPanelIndex : -1,
      defaultVideoModel,
      capabilityOverrides,
      userVideoModels: userVideoModels || [],
      onUpdateViewerPrompt,
      onSaveViewerPrompt,
      onGeneratePromptByAiForViewer,
      handlePreviewVideoCandidate,
      handleClearPreviewVideoCandidate,
      handleSelectVideoCandidate,
      handleDeleteVideoCandidate,
      handleDownloadVideoCandidate,
      handleOpenViewerForCurrentPanel,
      onVideoGenerationCountChange,
    },
  }
}

export type VideoPanelRuntime = ReturnType<typeof useVideoPanelActions>
