import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PanelCard from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/PanelCard'
import PanelActionButtons from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/PanelActionButtons'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

vi.mock('@/components/ui/primitives', () => ({
  GlassSurface: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/PanelEditForm', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'panel-edit-form'),
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/ImageSection', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'image-section'),
}))

describe('Storyboard panel action affordances', () => {
  it('renders high-contrast insert and variant buttons', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PanelActionButtons, {
        onInsertPanel: () => undefined,
        onVariant: () => undefined,
        disabled: false,
        hasImage: true,
      }),
    )

    expect(markup).toContain('rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)]')
    expect(markup).toContain('h-8 w-8')
    expect(markup).toContain('plus')
    expect(markup).toContain('videoAlt')
  })

  it('anchors the action group inside the panel edge and only reveals it on hover', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PanelCard, {
        panel: { id: 'panel-1', shot_type: 'Medium Shot' } as never,
        panelData: {} as never,
        imageUrl: 'https://example.com/panel.jpg',
        globalPanelNumber: 1,
        storyboardId: 'sb-1',
        videoRatio: '9:16',
        isSaving: false,
        hasUnsavedChanges: false,
        saveErrorMessage: null,
        isDeleting: false,
        isUploadingImage: false,
        isModifying: false,
        isSubmittingPanelImageTask: false,
        failedError: null,
        candidateData: null,
        previousImageUrl: null,
        onUpdate: () => undefined,
        onDelete: () => undefined,
        onOpenCharacterPicker: () => undefined,
        onOpenLocationPicker: () => undefined,
        onRetrySave: () => undefined,
        onRemoveCharacter: () => undefined,
        onRemoveLocation: () => undefined,
        onRegeneratePanelImage: () => undefined,
        onUploadImage: async () => undefined,
        onOpenSourcePanelPicker: () => undefined,
        onOpenEditModal: () => undefined,
        onOpenAIDataModal: () => undefined,
        onSelectCandidateIndex: () => undefined,
        onConfirmCandidate: async () => undefined,
        onCancelCandidate: () => undefined,
        onClearError: () => undefined,
        onUndo: () => undefined,
        onPreviewImage: () => undefined,
        onInsertAfter: () => undefined,
        onVariant: () => undefined,
        isInsertDisabled: false,
      }),
    )

    expect(markup).toContain('absolute right-2 top-1/2 z-30 -translate-y-1/2 opacity-0')
    expect(markup).toContain('group-hover/panel-image:opacity-100')
  })
})
