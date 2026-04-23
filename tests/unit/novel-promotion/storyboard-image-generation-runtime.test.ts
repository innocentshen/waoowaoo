import { describe, expect, it } from 'vitest'
import {
  clearPanelImageTaskStateInStoryboards,
  getRunningPanelImageTaskIdMap,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/storyboard/hooks/image-generation-runtime'
import type { NovelPromotionStoryboard } from '@/types/project'

describe('storyboard image generation runtime helpers', () => {
  it('collects only running panel image task ids', () => {
    const storyboards = [
      {
        id: 'sb-1',
        panels: [
          { id: 'panel-1', imageTaskRunning: true, imageTaskId: 'task-1' },
          { id: 'panel-2', imageTaskRunning: true, imageTaskId: 'optimistic:NovelPromotionPanel:panel-2:abc' },
          { id: 'panel-3', imageTaskRunning: false, imageTaskId: 'task-3' },
        ],
      },
    ] as NovelPromotionStoryboard[]

    const runningTaskIds = getRunningPanelImageTaskIdMap(storyboards)

    expect(Array.from(runningTaskIds.entries())).toEqual([['panel-1', 'task-1']])
  })

  it('clears only the targeted panel image task runtime state', () => {
    const storyboards = [
      {
        id: 'sb-1',
        panels: [
          {
            id: 'panel-1',
            imageTaskRunning: true,
            imageTaskId: 'task-1',
            imageTaskIntent: 'generate',
          },
          {
            id: 'panel-2',
            imageTaskRunning: true,
            imageTaskId: 'task-2',
            imageTaskIntent: 'regenerate',
          },
        ],
      },
    ] as NovelPromotionStoryboard[]

    const nextStoryboards = clearPanelImageTaskStateInStoryboards(storyboards, ['panel-2'])
    const firstPanel = nextStoryboards[0].panels?.[0]
    const secondPanel = nextStoryboards[0].panels?.[1]

    expect(firstPanel?.imageTaskRunning).toBe(true)
    expect(firstPanel?.imageTaskId).toBe('task-1')
    expect(firstPanel?.imageTaskIntent).toBe('generate')
    expect(secondPanel?.imageTaskRunning).toBe(false)
    expect(secondPanel?.imageTaskId).toBeNull()
    expect(secondPanel?.imageTaskIntent).toBeNull()
  })
})
