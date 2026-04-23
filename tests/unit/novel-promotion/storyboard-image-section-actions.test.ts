import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ImageSectionActionButtons from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/ImageSectionActionButtons'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

vi.mock('@/components/task/TaskStatusInline', () => ({
  __esModule: true,
  default: () => React.createElement('span', null, 'task-status'),
}))

vi.mock('@/components/image-generation/ImageGenerationInlineCountButton', () => ({
  __esModule: true,
  default: ({ prefix, disabled }: { prefix: React.ReactNode; disabled?: boolean }) =>
    React.createElement('button', { disabled }, prefix),
}))

vi.mock('@/components/ui/icons/AISparklesIcon', () => ({
  __esModule: true,
  default: () => React.createElement('span', null, 'ai-sparkles'),
}))

vi.mock('@/lib/image-generation/use-image-generation-count', () => ({
  useImageGenerationCount: () => ({
    count: 1,
    setCount: () => undefined,
  }),
}))

vi.mock('@/lib/image-generation/count', () => ({
  getImageGenerationCountOptions: () => [1, 2, 3],
}))

describe('ImageSectionActionButtons terminate action', () => {
  it('renders the terminate button while a panel image task is running', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ImageSectionActionButtons, {
        panelId: 'panel-1',
        imageUrl: null,
        imageHistory: null,
        previousImageUrl: null,
        isSubmittingPanelImageTask: true,
        canCancelPanelImageTask: true,
        isCancelingPanelImageTask: false,
        isUploading: false,
        isModifying: false,
        onRegeneratePanelImage: () => undefined,
        onCancelPanelImageTask: async () => true,
        onUploadImage: async () => undefined,
        onOpenSourcePanelPicker: () => undefined,
        onOpenHistoryPanelPicker: () => undefined,
        onOpenEditModal: () => undefined,
        onOpenAIDataModal: () => undefined,
        triggerPulse: () => undefined,
      }),
    )

    expect(markup).toContain('image.terminate')
    expect(markup).toContain('closeMd')
  })

  it('does not render the terminate button when the running task is not cancelable', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ImageSectionActionButtons, {
        panelId: 'panel-1',
        imageUrl: null,
        imageHistory: null,
        previousImageUrl: null,
        isSubmittingPanelImageTask: true,
        canCancelPanelImageTask: false,
        isCancelingPanelImageTask: false,
        isUploading: false,
        isModifying: false,
        onRegeneratePanelImage: () => undefined,
        onCancelPanelImageTask: async () => true,
        onUploadImage: async () => undefined,
        onOpenSourcePanelPicker: () => undefined,
        onOpenHistoryPanelPicker: () => undefined,
        onOpenEditModal: () => undefined,
        onOpenAIDataModal: () => undefined,
        triggerPulse: () => undefined,
      }),
    )

    expect(markup).not.toContain('image.terminate')
  })

  it('renders the history button when the panel has saved history images', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ImageSectionActionButtons, {
        panelId: 'panel-1',
        imageUrl: 'cos/current.png',
        imageHistory: JSON.stringify([
          { url: 'cos/history-1.png', timestamp: '2026-04-23T10:00:00.000Z' },
        ]),
        previousImageUrl: null,
        isSubmittingPanelImageTask: false,
        canCancelPanelImageTask: false,
        isCancelingPanelImageTask: false,
        isUploading: false,
        isModifying: false,
        onRegeneratePanelImage: () => undefined,
        onCancelPanelImageTask: async () => true,
        onUploadImage: async () => undefined,
        onOpenSourcePanelPicker: () => undefined,
        onOpenHistoryPanelPicker: () => undefined,
        onOpenEditModal: () => undefined,
        onOpenAIDataModal: () => undefined,
        triggerPulse: () => undefined,
      }),
    )

    expect(markup).toContain('image.history')
    expect(markup).toContain('clock')
  })
})
