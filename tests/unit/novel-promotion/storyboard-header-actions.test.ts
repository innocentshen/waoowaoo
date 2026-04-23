import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import StoryboardHeader from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/StoryboardHeader'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: ({ name }: { name: string }) => React.createElement('span', null, name),
}))

vi.mock('@/components/task/TaskStatusInline', () => ({
  __esModule: true,
  default: ({ state }: { state: { labelKey?: string | null } | null }) =>
    React.createElement('span', null, state?.labelKey || 'task-status'),
}))

vi.mock('@/components/ui/primitives', () => ({
  GlassSurface: ({ children }: { children: React.ReactNode }) => React.createElement('section', null, children),
  GlassChip: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
  GlassButton: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
}))

describe('StoryboardHeader terminate actions', () => {
  it('renders the terminate-all action while panel image tasks are running', () => {
    const markup = renderToStaticMarkup(
      React.createElement(StoryboardHeader, {
        totalSegments: 2,
        totalPanels: 8,
        isDownloadingImages: false,
        runningCount: 3,
        cancelableRunningCount: 3,
        pendingPanelCount: 5,
        isBatchSubmitting: false,
        isCancelingAllPanelImageTasks: false,
        onDownloadAllImages: () => undefined,
        onGenerateAllPanels: () => undefined,
        onCancelAllRunningPanels: () => undefined,
        onBack: () => undefined,
      }),
    )

    expect(markup).toContain('header.terminateAll')
    expect(markup).toContain('closeMd')
  })

  it('hides the terminate-all action when nothing is running', () => {
    const markup = renderToStaticMarkup(
      React.createElement(StoryboardHeader, {
        totalSegments: 2,
        totalPanels: 8,
        isDownloadingImages: false,
        runningCount: 0,
        cancelableRunningCount: 0,
        pendingPanelCount: 5,
        isBatchSubmitting: false,
        isCancelingAllPanelImageTasks: false,
        onDownloadAllImages: () => undefined,
        onGenerateAllPanels: () => undefined,
        onCancelAllRunningPanels: () => undefined,
        onBack: () => undefined,
      }),
    )

    expect(markup).not.toContain('header.terminateAll')
  })
})
