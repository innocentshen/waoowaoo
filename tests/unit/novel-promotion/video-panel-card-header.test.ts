import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VideoPanelCardHeader from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/VideoPanelCardHeader'
import type { VideoPanelRuntime } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/runtime/videoPanelRuntimeCore'

vi.mock('@/components/task/TaskStatusOverlay', () => ({
  default: () => React.createElement('div', null, 'task-overlay'),
}))

vi.mock('@/components/media/MediaImageWithLoading', () => ({
  MediaImageWithLoading: ({ alt }: { alt: string }) => React.createElement('div', null, alt),
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

function createRuntime(overrides: Partial<VideoPanelRuntime> = {}): VideoPanelRuntime {
  const t = (key: string, values?: Record<string, unknown>) => {
    if (key === 'panelCard.shot') return `Shot ${String(values?.number ?? '')}`
    if (key === 'panelCard.currentVideo') return 'Current'
    if (key === 'panelCard.previewingCandidate') return 'Previewing'
    if (key === 'panelCard.backToCurrent') return 'Back to current'
    if (key === 'panelCard.original') return 'Original'
    if (key === 'panelCard.synced') return 'Synced'
    if (key === 'panelCard.openCandidateViewer') return 'Open viewer'
    if (key === 'panelCard.download') return 'Download'
    if (key === 'firstLastFrame.unlinkAction') return 'Unlink next shot'
    if (key === 'firstLastFrame.linkToNext') return 'Link to next shot'
    return key
  }

  const runtime = {
    t,
    tCommon: (key: string) => key,
    panel: {
      storyboardId: 'sb-1',
      panelIndex: 0,
      panelId: 'panel-1',
      imageUrl: 'https://example.com/frame-1.jpg',
      videoUrl: 'https://example.com/video-1.mp4',
      videoGenerationMode: 'normal',
      lipSyncVideoUrl: null,
      videoCandidates: [
        {
          id: 'candidate-1',
          videoUrl: 'https://example.com/video-1.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:00:00.000Z',
          model: 'grok-video',
          prompt: 'prompt-1',
          isSelected: true,
        },
        {
          id: 'candidate-2',
          videoUrl: 'https://example.com/video-2.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:01:00.000Z',
          model: 'grok-video',
          prompt: 'prompt-2',
          isSelected: false,
        },
      ],
    },
    panelIndex: 0,
    panelKey: 'sb-1-0',
    media: {
      showLipSyncVideo: false,
      onToggleLipSyncVideo: () => undefined,
      onPreviewImage: () => undefined,
      baseVideoUrl: 'https://example.com/video-1.mp4',
      currentVideoUrl: 'https://example.com/video-2.mp4',
    },
    taskStatus: {
      isVideoTaskRunning: false,
      isLipSyncTaskRunning: false,
      taskRunningVideoLabel: 'Generating',
      overlayPresentation: null,
      panelErrorDisplay: null,
    },
    videoModel: {
      selectedModel: 'grok::video',
      setSelectedModel: () => undefined,
      handleModelChange: () => undefined,
      capabilityFields: [],
      generationOptions: {},
      setCapabilityValue: () => undefined,
      missingCapabilityFields: [],
      videoModelOptions: [],
    },
    player: {
      cssAspectRatio: '9:16',
      isPlaying: false,
      videoRef: { current: null },
      currentVideoUrl: 'https://example.com/video-2.mp4',
      handlePlayClick: async () => undefined,
      handlePreviewImage: () => undefined,
      setIsPlaying: () => undefined,
    },
    promptEditor: {},
    voiceManager: {},
    lipSync: {},
    layout: {
      hasNext: false,
      isLinked: false,
      isLastFrame: false,
    },
    actions: {
      onGenerateVideo: () => undefined,
      referenceSelection: {},
      onToggleLink: () => undefined,
    },
    candidates: {
      count: 2,
      videoGenerationCount: 2,
      previewCandidateId: 'candidate-2',
      previewCandidate: {
        id: 'candidate-2',
        videoUrl: 'https://example.com/video-2.mp4',
        generationMode: 'normal',
        createdAt: '2026-04-09T00:01:00.000Z',
        model: 'grok-video',
        prompt: 'prompt-2',
        isSelected: false,
      },
      items: [
        {
          id: 'candidate-1',
          videoUrl: 'https://example.com/video-1.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:00:00.000Z',
          model: 'grok-video',
          prompt: 'prompt-1',
          isSelected: true,
        },
        {
          id: 'candidate-2',
          videoUrl: 'https://example.com/video-2.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:01:00.000Z',
          model: 'grok-video',
          prompt: 'prompt-2',
          isSelected: false,
        },
      ],
      handlePreviewVideoCandidate: () => undefined,
      handleClearPreviewVideoCandidate: () => undefined,
      handleSelectVideoCandidate: async () => undefined,
      handleDeleteVideoCandidate: async () => undefined,
      handleDownloadVideoCandidate: async () => undefined,
      handleOpenViewerForCurrentPanel: () => undefined,
      onVideoGenerationCountChange: () => undefined,
    },
  }

  return {
    ...runtime,
    ...overrides,
  } as unknown as VideoPanelRuntime
}

describe('VideoPanelCardHeader', () => {
  it('renders quick candidate switcher in the preview area', () => {
    const markup = renderToStaticMarkup(
      React.createElement(VideoPanelCardHeader, {
        runtime: createRuntime(),
      }),
    )

    expect(markup).toContain('Previewing')
    expect(markup).toContain('Back to current')
    expect(markup).toContain('2/2')
    expect(markup).toContain('chevronLeft')
    expect(markup).toContain('chevronRight')
    expect(markup).toContain('download')
  })

  it('renders a high-contrast link button when the next shot exists', () => {
    const baseRuntime = createRuntime()
    const markup = renderToStaticMarkup(
      React.createElement(VideoPanelCardHeader, {
        runtime: createRuntime({
          layout: {
            ...baseRuntime.layout,
            hasNext: true,
            isLinked: false,
            isLastFrame: false,
          },
        }),
      }),
    )

    expect(markup).toContain('aria-label="Link to next shot"')
    expect(markup).toContain('absolute right-2 top-1/2 z-30 -translate-y-1/2 opacity-0')
    expect(markup).toContain('group-hover/video-header:opacity-100')
    expect(markup).toContain('h-9 w-9')
    expect(markup).toContain('link')
  })

  it('hides the link button while the video is actively playing', () => {
    const baseRuntime = createRuntime()
    const markup = renderToStaticMarkup(
      React.createElement(VideoPanelCardHeader, {
        runtime: createRuntime({
          layout: {
            ...baseRuntime.layout,
            hasNext: true,
            isLinked: false,
            isLastFrame: false,
          },
          player: {
            ...baseRuntime.player,
            isPlaying: true,
          },
        }),
      }),
    )

    expect(markup).not.toContain('aria-label="Link to next shot"')
  })
})
