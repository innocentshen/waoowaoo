import React, { useEffect, useState } from 'react'
import TaskStatusOverlay from '@/components/task/TaskStatusOverlay'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import type { VideoPanelRuntime } from './hooks/useVideoPanelActions'
import { AppIcon } from '@/components/ui/icons'

interface VideoPanelCardHeaderProps {
  runtime: VideoPanelRuntime
}

function buildQuickDownloadName({
  panelNumber,
  candidateIndex,
  generationMode,
  isPreviewingCandidate,
  isSynced,
}: {
  panelNumber: number
  candidateIndex: number
  generationMode: 'normal' | 'firstlastframe' | 'edit' | 'extend'
  isPreviewingCandidate: boolean
  isSynced: boolean
}) {
  const suffixes: string[] = []

  if (isSynced) {
    suffixes.push('synced')
  } else if (isPreviewingCandidate) {
    suffixes.push(`candidate_${String(candidateIndex + 1).padStart(2, '0')}`)
  }

  if (generationMode === 'firstlastframe') {
    suffixes.push('first-last-frame')
  } else if (generationMode === 'edit') {
    suffixes.push('edit')
  } else if (generationMode === 'extend') {
    suffixes.push('extend')
  }

  const baseName = `shot_${String(panelNumber).padStart(3, '0')}`
  return `${[baseName, ...suffixes].join('_')}.mp4`
}

export default function VideoPanelCardHeader({ runtime }: VideoPanelCardHeaderProps) {
  const {
    t,
    panel,
    panelIndex,
    panelKey,
    layout,
    media,
    taskStatus,
    videoModel,
    player,
    actions,
    candidates,
  } = runtime

  const [errorDismissed, setErrorDismissed] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isDownloadingCurrent, setIsDownloadingCurrent] = useState(false)

  useEffect(() => {
    setErrorDismissed(false)
  }, [taskStatus.panelErrorDisplay?.message])

  useEffect(() => {
    if (player.isPlaying) {
      setShowTooltip(false)
    }
  }, [player.isPlaying])

  const hasVisibleBaseVideo = !!media.baseVideoUrl
  const showFirstLastFrameSwitch = layout.hasNext
  const candidateItems = candidates.items
  const candidateCount = candidateItems.length
  const activeCandidateIndex = candidateItems.findIndex((candidate) => (
    candidates.previewCandidate ? candidate.id === candidates.previewCandidate.id : candidate.isSelected
  ))
  const activeCandidate = activeCandidateIndex >= 0 ? candidateItems[activeCandidateIndex] : null
  const displayCandidateIndex = candidateCount > 0 ? (activeCandidateIndex >= 0 ? activeCandidateIndex + 1 : 1) : 0
  const canQuickSwitchCandidates = candidateCount > 1
  const isShowingSyncedVideo = !candidates.previewCandidate && media.showLipSyncVideo && !!panel.lipSyncVideoUrl
  const currentVideoGenerationMode = (
    candidates.previewCandidate?.generationMode
    || activeCandidate?.generationMode
    || panel.videoGenerationMode
    || 'normal'
  )
  const canQuickDownload = !!media.currentVideoUrl
  const linkActionLabel = layout.isLinked ? t('firstLastFrame.unlinkAction') : t('firstLastFrame.linkToNext')
  const quickDownloadFileName = canQuickDownload
    ? buildQuickDownloadName({
      panelNumber: panelIndex + 1,
      candidateIndex: Math.max(activeCandidateIndex, 0),
      generationMode: currentVideoGenerationMode,
      isPreviewingCandidate: !!candidates.previewCandidate,
      isSynced: isShowingSyncedVideo,
    })
    : null

  const handleQuickSwitchCandidate = (direction: -1 | 1) => {
    if (candidateCount === 0) return
    const baseIndex = activeCandidateIndex >= 0 ? activeCandidateIndex : 0
    const nextIndex = (baseIndex + direction + candidateCount) % candidateCount
    const nextCandidate = candidateItems[nextIndex]
    if (!nextCandidate) return
    if (nextCandidate.isSelected) {
      candidates.handleClearPreviewVideoCandidate()
    } else {
      candidates.handlePreviewVideoCandidate(nextCandidate.id)
    }
    player.setIsPlaying(false)
  }

  const handleQuickDownload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!media.currentVideoUrl || !quickDownloadFileName || isDownloadingCurrent) return
    player.setIsPlaying(false)
    setIsDownloadingCurrent(true)
    try {
      await candidates.handleDownloadVideoCandidate(media.currentVideoUrl, quickDownloadFileName)
    } finally {
      setIsDownloadingCurrent(false)
    }
  }

  return (
    <div className="group/video-header relative flex items-center justify-center bg-[var(--glass-bg-muted)]" style={{ aspectRatio: player.cssAspectRatio }}>
      {hasVisibleBaseVideo && player.isPlaying ? (
        <video
          ref={player.videoRef}
          key={`video-${panel.storyboardId}-${panel.panelIndex}-${media.currentVideoUrl}`}
          src={media.currentVideoUrl}
          controls
          playsInline
          className="h-full w-full object-contain bg-black"
          onEnded={() => player.setIsPlaying(false)}
        />
      ) : hasVisibleBaseVideo ? (
        <div
          className="group relative h-full w-full cursor-pointer"
          onClick={() => void player.handlePlayClick()}
        >
          <MediaImageWithLoading
            src={panel.imageUrl || ''}
            alt={t('panelCard.shot', { number: panelIndex + 1 })}
            containerClassName="h-full w-full bg-black"
            className="h-full w-full object-contain bg-black"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--glass-overlay)] transition-colors group-hover:bg-[var(--glass-overlay)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--glass-bg-surface-strong)] shadow-lg transition-transform group-hover:scale-110">
              <AppIcon name="play" className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      ) : panel.imageUrl ? (
        <MediaImageWithLoading
          src={panel.imageUrl}
          alt={t('panelCard.shot', { number: panelIndex + 1 })}
          containerClassName="h-full w-full bg-[var(--glass-bg-muted)]"
          className={`h-full w-full object-contain bg-[var(--glass-bg-muted)] ${media.onPreviewImage ? 'cursor-zoom-in' : ''}`}
          onClick={media.onPreviewImage ? player.handlePreviewImage : undefined}
        />
      ) : (
        <AppIcon name="playCircle" className="h-16 w-16 text-[var(--glass-text-tertiary)]" />
      )}

      <div className="absolute left-2 top-2 rounded bg-[var(--glass-overlay)] px-2 py-0.5 text-xs font-medium text-white">
        {panelIndex + 1}
      </div>

      {showFirstLastFrameSwitch && !player.isPlaying && (
        <div className="pointer-events-none absolute right-2 top-1/2 z-30 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover/video-header:pointer-events-auto group-hover/video-header:opacity-100 group-focus-within/video-header:pointer-events-auto group-focus-within/video-header:opacity-100">
          <div className="relative">
            <button
              type="button"
              title={linkActionLabel}
              aria-label={linkActionLabel}
              onClick={(event) => {
                event.stopPropagation()
                actions.onToggleLink(panelKey, panel.storyboardId, panel.panelIndex)
              }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 ${
                layout.isLinked
                  ? 'border-amber-100 bg-[linear-gradient(135deg,rgba(250,204,21,0.98),rgba(245,158,11,0.94))] text-slate-950 shadow-[0_10px_28px_rgba(245,158,11,0.42)]'
                  : 'border-amber-100 bg-[linear-gradient(135deg,rgba(253,224,71,0.98),rgba(250,204,21,0.94))] text-slate-950 shadow-[0_10px_24px_rgba(245,158,11,0.35)] hover:brightness-105'
              }`}
            >
              <AppIcon name={layout.isLinked ? 'unplug' : 'link'} className="h-4 w-4" />
            </button>

            {showTooltip && (
              <div className="pointer-events-none absolute right-full top-1/2 z-50 mr-2 -translate-y-1/2">
                <div className="relative whitespace-nowrap rounded-lg border border-white/15 bg-[rgba(15,23,42,0.92)] px-3 py-1.5 text-xs font-medium text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)] backdrop-blur-sm">
                  {linkActionLabel}
                  <div className="absolute left-full top-1/2 h-0 w-0 -translate-y-1/2 border-b-4 border-l-4 border-t-4 border-b-transparent border-l-[rgba(15,23,42,0.92)] border-t-transparent" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute right-2 top-2 z-20 flex max-w-[calc(100%-3rem)] flex-col items-end gap-2">
        {panel.lipSyncVideoUrl && hasVisibleBaseVideo && !candidates.previewCandidate ? (
          <div
            className="flex cursor-pointer items-center rounded-full bg-[var(--glass-overlay)] p-0.5"
            onClick={(event) => {
              event.stopPropagation()
              media.onToggleLipSyncVideo(panelKey, !media.showLipSyncVideo)
              player.setIsPlaying(false)
            }}
          >
            <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${!media.showLipSyncVideo ? 'bg-[var(--glass-tone-success-fg)] text-white' : 'text-[var(--glass-text-tertiary)] hover:text-white'}`}>
              {t('panelCard.original')}
            </div>
            <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${media.showLipSyncVideo ? 'bg-[var(--glass-accent-from)] text-white' : 'text-[var(--glass-text-tertiary)] hover:text-white'}`}>
              {t('panelCard.synced')}
            </div>
          </div>
        ) : null}

        {(canQuickSwitchCandidates || candidates.previewCandidate) && (
          <div className="flex items-center gap-1 rounded-full bg-[var(--glass-overlay)] px-1.5 py-1 text-white shadow-[var(--glass-shadow-sm)]">
            {candidateCount > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  candidates.handleOpenViewerForCurrentPanel()
                  player.setIsPlaying(false)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                title={t('panelCard.openCandidateViewer')}
              >
                <AppIcon name="eye" className="h-3.5 w-3.5" />
              </button>
            )}
            {canQuickSwitchCandidates && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleQuickSwitchCandidate(-1)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <AppIcon name="chevronLeft" className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="min-w-[68px] px-2 text-center">
              <div className="text-[10px] font-medium leading-none">
                {candidates.previewCandidate ? t('panelCard.previewingCandidate') : t('panelCard.currentVideo')}
              </div>
              {candidateCount > 0 && (
                <div className="mt-0.5 text-[10px] text-white/75">
                  {displayCandidateIndex}/{candidateCount}
                </div>
              )}
            </div>
            {canQuickSwitchCandidates && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleQuickSwitchCandidate(1)
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <AppIcon name="chevronRight" className="h-3.5 w-3.5" />
              </button>
            )}
            {candidates.previewCandidate && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  candidates.handleClearPreviewVideoCandidate()
                  player.setIsPlaying(false)
                }}
                className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-white/25"
              >
                {t('panelCard.backToCurrent')}
              </button>
            )}
          </div>
        )}
      </div>

      {canQuickDownload && (
        <button
          type="button"
          onClick={(event) => { void handleQuickDownload(event) }}
          disabled={isDownloadingCurrent}
          title={t('panelCard.download')}
          aria-label={t('panelCard.download')}
          className="absolute bottom-2 left-2 z-20 rounded-full bg-[var(--glass-overlay)] p-2 text-white transition-all hover:bg-[var(--glass-overlay-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon
            name={isDownloadingCurrent ? 'loader' : 'download'}
            className={`h-4 w-4 ${isDownloadingCurrent ? 'animate-spin' : ''}`}
          />
        </button>
      )}

      {!layout.isLinked && !layout.isLastFrame && (hasVisibleBaseVideo || taskStatus.isVideoTaskRunning) && (
        <button
          onClick={() =>
            actions.onGenerateVideo(
              panel.storyboardId,
              panel.panelIndex,
              videoModel.selectedModel,
              undefined,
              videoModel.generationOptions,
              undefined,
              actions.referenceSelection,
              panel.panelId,
              candidates.videoGenerationCount,
            )}
          disabled={
            taskStatus.isVideoTaskRunning
            || !videoModel.selectedModel
            || videoModel.missingCapabilityFields.length > 0
          }
          className="absolute bottom-2 right-2 z-20 rounded-full bg-[var(--glass-overlay)] p-2 text-white transition-all hover:bg-[var(--glass-overlay-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AppIcon name="refresh" className="h-4 w-4" />
        </button>
      )}

      {(taskStatus.isVideoTaskRunning || taskStatus.isLipSyncTaskRunning) && (
        <TaskStatusOverlay state={taskStatus.overlayPresentation} className="z-10" />
      )}

      {taskStatus.panelErrorDisplay && !taskStatus.isVideoTaskRunning && !taskStatus.isLipSyncTaskRunning && !errorDismissed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--glass-tone-danger-bg)] p-4">
          <button
            onClick={(event) => {
              event.stopPropagation()
              setErrorDismissed(true)
            }}
            className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-xs text-white transition-colors hover:bg-black/50"
          >
            <AppIcon name="close" className="h-3 w-3" />
          </button>
          <span className="break-all text-center text-xs text-white">{taskStatus.panelErrorDisplay.message}</span>
        </div>
      )}
    </div>
  )
}
