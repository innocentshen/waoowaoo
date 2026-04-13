import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VideoPanelCardBody from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/VideoPanelCardBody'
import type { VideoPanelRuntime } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/runtime/videoPanelRuntimeCore'

vi.mock('@/components/task/TaskStatusInline', () => ({
  default: () => React.createElement('span', null, 'task-status'),
}))

vi.mock('@/components/ui/config-modals/ModelCapabilityDropdown', () => ({
  ModelCapabilityDropdown: () => React.createElement('div', null, 'model-dropdown'),
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

vi.mock('@/components/ui/primitives/GlassModalShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}))

function t(key: string, values?: Record<string, unknown>) {
  if (key === 'firstLastFrame.asLastFrameFor') return `As shot ${String(values?.number ?? '')} end frame`
  if (key === 'firstLastFrame.asFirstFrameFor') return `As shot ${String(values?.number ?? '')} first frame`
  if (key === 'firstLastFrame.generate') return 'Generate first/last-frame video'
  if (key === 'firstLastFrame.generated') return 'First/last-frame video ready'
  if (key === 'promptModal.promptLabel') return 'Video prompt'
  if (key === 'promptModal.placeholder') return 'Edit prompt'
  if (key === 'promptModal.aiInstructionLabel') return 'AI instruction'
  if (key === 'promptModal.aiResultLabel') return 'Final prompt'
  if (key === 'promptModal.aiResultHint') return 'You can refine it before applying'
  if (key === 'promptModal.aiGenerateTitle') return 'Generate prompt with AI'
  if (key === 'promptModal.aiGenerateDescription') return 'Generate a prompt draft'
  if (key === 'promptModal.aiGeneratePlaceholder') return 'Describe the change'
  if (key === 'promptModal.aiResultPlaceholder') return 'AI result appears here'
  if (key === 'promptModal.aiGenerateAction') return 'Generate draft'
  if (key === 'promptModal.applyPromptAction') return 'Apply prompt'
  if (key === 'promptModal.duration') return 's'
  if (key === 'panelCard.clickToEditPrompt') return 'Click to edit'
  if (key === 'panelCard.aiGeneratePrompt') return 'AI generate'
  if (key === 'panelCard.selectModel') return 'Select model'
  if (key === 'panelCard.generateVideo') return 'Generate video'
  if (key === 'panelCard.unknownShotType') return 'Unknown shot'
  if (key === 'panelCard.videoCountLabel') return 'Parallel videos'
  if (key === 'panelCard.videoCountOption') return `${String(values?.count ?? '')} videos`
  if (key === 'panelCard.cancel') return 'Cancel'
  if (key === 'panelCard.save') return 'Save'
  if (key === 'panelCard.generating') return 'Generating'
  if (key === 'panelCard.referenceAssetsLabel') return 'Reference'
  if (key === 'panelCard.referenceAssetsHint') return 'Optional reference assets.'
  if (key === 'panelCard.referenceCharacters') return 'Related characters'
  if (key === 'panelCard.referenceLocation') return 'Related scene'
  if (key === 'panelCard.referenceProps') return 'Related props'
  if (key === 'stage.hasSynced') return 'Generated'
  return key
}

function createRuntime(overrides: Partial<VideoPanelRuntime> = {}): VideoPanelRuntime {
  const runtime = {
    t,
    tCommon: (key: string) => key,
    panel: {
      storyboardId: 'sb-1',
      panelIndex: 2,
      panelId: 'panel-2',
      imageUrl: 'https://example.com/frame-2.jpg',
      videoUrl: null,
      videoGenerationMode: null,
      lipSyncVideoUrl: null,
      videoCandidates: [
        {
          id: 'candidate-1',
          videoUrl: 'https://example.com/video-1.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:00:00.000Z',
          model: 'veo-3.1',
          prompt: 'prompt-1',
          isSelected: true,
        },
      ],
      textPanel: {
        shot_type: 'Medium shot',
        description: 'Character stands in the center of the room.',
        duration: 3,
      },
    },
    panelIndex: 2,
    panelKey: 'sb-1-2',
    taskStatus: {
      isVideoTaskRunning: false,
      isLipSyncTaskRunning: false,
      taskRunningVideoLabel: 'Generating',
      lipSyncInlineState: null,
    },
    videoModel: {
      selectedModel: 'veo-3.1',
      setSelectedModel: () => undefined,
      handleModelChange: () => undefined,
      capabilityFields: [],
      generationOptions: {},
      setCapabilityValue: () => undefined,
      missingCapabilityFields: [],
      videoModelOptions: [],
    },
    promptEditor: {
      canAiGeneratePrompt: true,
      isEditing: false,
      editingPrompt: '',
      setEditingPrompt: () => undefined,
      isAiModalOpen: false,
      aiInstruction: '',
      setAiInstruction: () => undefined,
      aiDraftPrompt: 'Character turns into the next shot.',
      setAiDraftPrompt: () => undefined,
      isAiGenerating: false,
      isAiApplying: false,
      isAiBusy: false,
      handleStartEdit: () => undefined,
      handleSave: () => undefined,
      handleCancelEdit: () => undefined,
      handleOpenAiModal: () => undefined,
      handleCloseAiModal: () => undefined,
      handleAiGenerate: async () => false,
      handleApplyAiPrompt: async () => false,
      isSavingPrompt: false,
      localPrompt: 'Character turns into the next shot.',
    },
    voiceManager: {
      hasMatchedAudio: false,
      hasMatchedVoiceLines: false,
      audioGenerateError: null,
      localVoiceLines: [],
      isVoiceLineTaskRunning: () => false,
      handlePlayVoiceLine: () => undefined,
      handleGenerateAudio: async () => undefined,
      playingVoiceLineId: null,
    },
    lipSync: {
      handleStartLipSync: () => undefined,
      executingLipSync: false,
    },
    layout: {
      isLinked: true,
      isLastFrame: true,
      nextPanel: {
        storyboardId: 'sb-1',
        panelIndex: 3,
        imageUrl: 'https://example.com/frame-3.jpg',
      },
      prevPanel: {
        storyboardId: 'sb-1',
        panelIndex: 1,
        imageUrl: 'https://example.com/frame-1.jpg',
      },
      hasNext: true,
      flModel: 'veo-3.1',
      flModelOptions: [],
      flGenerationOptions: {},
      flCapabilityFields: [],
      flMissingCapabilityFields: [],
      flCustomPrompt: '',
      defaultFlPrompt: '',
      videoRatio: '9:16',
    },
    actions: {
      onGenerateVideo: () => undefined,
      referenceOptions: undefined,
      referenceSelection: {},
      onUpdateReferenceSelection: () => undefined,
      onSelectVideoCandidate: async () => undefined,
      onDeleteVideoCandidate: async () => undefined,
      onUpdatePanelVideoModel: () => undefined,
      onUpdateVideoGenerationOptions: () => undefined,
      onToggleLink: () => undefined,
      onFlModelChange: () => undefined,
      onFlCapabilityChange: () => undefined,
      onFlCustomPromptChange: () => undefined,
      onResetFlPrompt: () => undefined,
      onGenerateFirstLastFrame: () => undefined,
    },
    computed: {
      showLipSyncSection: false,
      canLipSync: false,
      hasVisibleBaseVideo: false,
    },
    candidates: {
      count: 1,
      videoGenerationCount: 3,
      previewCandidateId: null,
      previewCandidate: null,
      items: [
        {
          id: 'candidate-1',
          videoUrl: 'https://example.com/video-1.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-09T00:00:00.000Z',
          model: 'veo-3.1',
          prompt: 'prompt-1',
          isSelected: true,
        },
      ],
      handlePreviewVideoCandidate: () => undefined,
      handleClearPreviewVideoCandidate: () => undefined,
      handleSelectVideoCandidate: async () => undefined,
      handleDeleteVideoCandidate: async () => undefined,
      handleDownloadVideoCandidate: async () => undefined,
      onVideoGenerationCountChange: () => undefined,
    },
  }

  return {
    ...runtime,
    ...overrides,
  } as unknown as VideoPanelRuntime
}

describe('VideoPanelCardBody', () => {
  it('renders first-last-frame controls and compact reference labels for chained panels', () => {
    const markup = renderToStaticMarkup(
      React.createElement(VideoPanelCardBody, {
        runtime: createRuntime(),
      }),
    )

    expect(markup).toContain('As shot 2 end frame')
    expect(markup).toContain('As shot 4 first frame')
    expect(markup).toContain('Video prompt')
    expect(markup).toContain('sparkles')
    expect(markup).toContain('Generate first/last-frame video')
    expect(markup).toContain('Parallel videos')
    expect(markup).toContain('Characters')
    expect(markup).toContain('Scene')
    expect(markup).toContain('Props')
    expect(markup).not.toContain('Related characters')
  })

  it('renders compact reference labels for normal video panels', () => {
    const linkedRuntime = createRuntime()
    const markup = renderToStaticMarkup(
      React.createElement(VideoPanelCardBody, {
        runtime: createRuntime({
          layout: {
            ...linkedRuntime.layout,
            isLinked: false,
            isLastFrame: false,
            nextPanel: null,
            prevPanel: null,
            hasNext: false,
          },
          panel: {
            ...linkedRuntime.panel,
            videoUrl: 'https://example.com/video-1.mp4',
            videoGenerationMode: 'normal',
          },
        }),
      }),
    )

    expect(markup).toContain('Parallel videos')
    expect(markup).toContain('Generated')
    expect(markup).toContain('Scene')
    expect(markup).toContain('Props')
    expect(markup).toContain('model-dropdown')
  })
})
