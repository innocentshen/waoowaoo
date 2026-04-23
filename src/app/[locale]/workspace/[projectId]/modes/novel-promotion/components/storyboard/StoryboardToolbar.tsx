'use client'

import { useTranslations } from 'next-intl'
import type { TaskPresentationState } from '@/lib/task/presentation'
import StoryboardHeader from './StoryboardHeader'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { AppIcon } from '@/components/ui/icons'
import { GlassButton } from '@/components/ui/primitives'

interface StoryboardToolbarProps {
  totalSegments: number
  totalPanels: number
  isDownloadingImages: boolean
  runningCount: number
  cancelableRunningCount: number
  pendingPanelCount: number
  isBatchSubmitting: boolean
  isCancelingAllPanelImageTasks: boolean
  addingStoryboardGroup: boolean
  addingStoryboardGroupState: TaskPresentationState | null
  onDownloadAllImages: () => Promise<void>
  onGenerateAllPanels: () => Promise<void>
  onCancelAllRunningPanels: () => Promise<unknown>
  onAddStoryboardGroupAtStart: () => void
  onBack: () => void
}

export default function StoryboardToolbar({
  totalSegments,
  totalPanels,
  isDownloadingImages,
  runningCount,
  cancelableRunningCount,
  pendingPanelCount,
  isBatchSubmitting,
  isCancelingAllPanelImageTasks,
  addingStoryboardGroup,
  addingStoryboardGroupState,
  onDownloadAllImages,
  onGenerateAllPanels,
  onCancelAllRunningPanels,
  onAddStoryboardGroupAtStart,
  onBack,
}: StoryboardToolbarProps) {
  const t = useTranslations('storyboard')
  return (
    <>
      <StoryboardHeader
        totalSegments={totalSegments}
        totalPanels={totalPanels}
        isDownloadingImages={isDownloadingImages}
        runningCount={runningCount}
        cancelableRunningCount={cancelableRunningCount}
        pendingPanelCount={pendingPanelCount}
        isBatchSubmitting={isBatchSubmitting}
        isCancelingAllPanelImageTasks={isCancelingAllPanelImageTasks}
        onDownloadAllImages={onDownloadAllImages}
        onGenerateAllPanels={onGenerateAllPanels}
        onCancelAllRunningPanels={onCancelAllRunningPanels}
        onBack={onBack}
      />

      <div className="flex justify-center">
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={onAddStoryboardGroupAtStart}
          disabled={addingStoryboardGroup}
          className="opacity-60 hover:opacity-100"
        >
          {addingStoryboardGroup ? (
            <TaskStatusInline state={addingStoryboardGroupState} />
          ) : (
            <>
              <AppIcon name="plusAlt" className="w-4 h-4" />
              <span>{t('group.addAtStart')}</span>
            </>
          )}
        </GlassButton>
      </div>
    </>
  )
}
