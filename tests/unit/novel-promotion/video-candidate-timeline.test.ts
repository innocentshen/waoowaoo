import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VideoCandidateTimeline from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/VideoCandidateTimeline'

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

vi.mock('@/components/ui/primitives/GlassModalShell', () => ({
  default: ({
    open,
    title,
    children,
    footer,
  }: {
    open?: boolean
    title?: string
    children?: React.ReactNode
    footer?: React.ReactNode
  }) => (open === false ? null : React.createElement('div', null, title, children, footer)),
}))

vi.mock('@/components/ui/config-modals/ModelCapabilityDropdown', () => ({
  ModelCapabilityDropdown: () => React.createElement('div', null, 'model-dropdown'),
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/runtime/hooks/usePanelVideoModel', () => ({
  usePanelVideoModel: () => ({
    selectedModel: 'grok::video',
    handleModelChange: () => undefined,
    setSelectedModel: () => undefined,
    generationOptions: {},
    capabilityFields: [],
    setCapabilityValue: () => undefined,
    missingCapabilityFields: [],
    videoModelOptions: [],
  }),
}))

function t(key: string, values?: Record<string, unknown>) {
  if (key === 'panelCard.aiGeneratePrompt') return 'AI生成'
  if (key === 'panelCard.useCandidate') return '设为当前'
  if (key === 'panelCard.download') return '下载'
  if (key === 'panelCard.deleteCandidate') return '删除'
  if (key === 'panelCard.cancel') return '取消'
  if (key === 'panelCard.candidateViewerTitle') return `候选 ${String(values?.count ?? '')}`
  if (key === 'panelCard.shot') return `镜头 ${String(values?.number ?? '')}`
  if (key === 'panelCard.normalGenerationMode') return '常规生成'
  if (key === 'panelCard.currentVideo') return '当前'
  if (key === 'panelCard.videoCandidateLabel') return `候选 ${String(values?.count ?? '')}`
  if (key === 'panelCard.candidateMetaModel') return '模型'
  if (key === 'panelCard.candidateMetaDuration') return '时长'
  if (key === 'panelCard.candidateMetaStatus') return '状态'
  if (key === 'panelCard.regenerate') return '重新生成'
  if (key === 'panelCard.generating') return '生成中...'
  if (key === 'panelCard.selectModel') return '选择模型'
  if (key === 'panelCard.videoCountOption') return `${String(values?.count ?? '')} 个`
  if (key === 'promptModal.promptLabel') return '视频提示词'
  if (key === 'promptModal.duration') return '秒'
  if (key === 'promptModal.aiGenerateTitle') return 'AI生成视频提示词'
  if (key === 'promptModal.aiGenerateDescription') return '按要求生成视频提示词'
  if (key === 'promptModal.aiInstructionLabel') return 'AI修改要求'
  if (key === 'promptModal.aiGeneratePlaceholder') return '请输入要求'
  if (key === 'promptModal.aiGenerateAction') return '生成草稿'
  if (key === 'promptModal.aiResultLabel') return '最终提示词'
  if (key === 'promptModal.aiResultHint') return '可继续编辑'
  if (key === 'promptModal.aiResultPlaceholder') return '这里显示AI结果'
  if (key === 'promptModal.applyPromptAction') return '确认使用'
  return key
}

describe('VideoCandidateTimeline', () => {
  it('renders AI entry and all viewer action buttons in the candidate modal', () => {
    Reflect.set(globalThis, 'React', React)
    const html = renderToStaticMarkup(
      React.createElement(VideoCandidateTimeline, {
        showInlineTimeline: false,
        t,
        panelNumber: 1,
        panelImageUrl: 'https://example.com/frame.jpg',
        panelDuration: 8,
        durationUnitLabel: '秒',
        promptLabel: '视频提示词',
        items: [
          {
            id: 'candidate-1',
            videoUrl: 'https://example.com/video-1.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-10T00:00:00.000Z',
            model: 'grok-video',
            prompt: 'prompt-1',
            isSelected: false,
          },
        ],
        previewCandidateId: null,
        viewerPanels: [
          {
            panelId: 'panel-1',
            panelKey: 'sb-1-0',
            panelNumber: 1,
            storyboardId: 'sb-1',
            panelIndex: 0,
            imageUrl: 'https://example.com/frame.jpg',
            imagePrompt: '仓库园区夜景',
            duration: 8,
            prompt: '道路向内延伸',
            promptField: 'videoPrompt',
            defaultVideoModel: 'grok::video',
            isLinked: false,
            isLastFrame: false,
            nextPanel: null,
            items: [
              {
                id: 'candidate-1',
                videoUrl: 'https://example.com/video-1.mp4',
                generationMode: 'normal',
                createdAt: '2026-04-10T00:00:00.000Z',
                model: 'grok-video',
                prompt: 'prompt-1',
                isSelected: false,
              },
            ],
          },
        ],
        viewerPanelIndex: 0,
        viewerState: { panelIndex: 0, candidateId: 'candidate-1' },
        defaultVideoModel: 'grok::video',
        capabilityOverrides: {},
        userVideoModels: [],
        videoGenerationCount: 1,
        onVideoGenerationCountChange: () => undefined,
        onGenerateVideo: () => undefined,
        onUpdateReferenceSelection: () => undefined,
        onUpdatePanelVideoModel: () => undefined,
        onUpdateVideoGenerationOptions: () => undefined,
        flModel: '',
        flModelOptions: [],
        flGenerationOptions: {},
        flCapabilityFields: [],
        flMissingCapabilityFields: [],
        onFlModelChange: () => undefined,
        onFlCapabilityChange: () => undefined,
        onGenerateFirstLastFrame: () => undefined,
        onUpdateViewerPrompt: () => undefined,
        onSaveViewerPrompt: async () => undefined,
        onGeneratePromptByAi: async () => '生成后的提示词',
        handlePreviewVideoCandidate: () => undefined,
        handleClearPreviewVideoCandidate: () => undefined,
        handleSelectVideoCandidate: async () => undefined,
        handleDeleteVideoCandidate: async () => undefined,
        handleDownloadVideoCandidate: async () => undefined,
        onSelectVideoCandidateForPanel: async () => undefined,
        onDeleteVideoCandidateForPanel: async () => undefined,
        openViewerForPanel: () => undefined,
        closeViewer: () => undefined,
        onStopPlayback: () => undefined,
      }),
    )

    expect(html).toContain('sparkles')
    expect(html).toContain('设为当前')
    expect(html).toContain('下载')
    expect(html).toContain('删除')
    expect(html).toContain('取消')
  })
})
