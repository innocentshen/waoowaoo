import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'

const handlersMock = vi.hoisted(() => ({
  handleModifyAppearanceTask: vi.fn(),
  handleModifyLocationTask: vi.fn(),
  handleModifyPropTask: vi.fn(),
  handleModifyShotPromptTask: vi.fn(),
  handleGeneratePanelVideoPromptTask: vi.fn(),
  handleAnalyzeShotVariantsTask: vi.fn(),
}))

vi.mock('@/lib/workers/handlers/shot-ai-prompt', () => ({
  handleModifyAppearanceTask: handlersMock.handleModifyAppearanceTask,
  handleModifyLocationTask: handlersMock.handleModifyLocationTask,
  handleModifyPropTask: handlersMock.handleModifyPropTask,
  handleModifyShotPromptTask: handlersMock.handleModifyShotPromptTask,
  handleGeneratePanelVideoPromptTask: handlersMock.handleGeneratePanelVideoPromptTask,
}))

vi.mock('@/lib/workers/handlers/shot-ai-variants', () => ({
  handleAnalyzeShotVariantsTask: handlersMock.handleAnalyzeShotVariantsTask,
}))

import { handleShotAITask } from '@/lib/workers/handlers/shot-ai-tasks'

function buildJob(type: TaskJobData['type'], payload: Record<string, unknown>): Job<TaskJobData> {
  return {
    data: {
      taskId: 'task-1',
      type,
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      targetType: 'NovelPromotionPanel',
      targetId: 'panel-1',
      payload,
      userId: 'user-1',
    },
  } as unknown as Job<TaskJobData>
}

describe('worker shot-ai-tasks behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlersMock.handleModifyAppearanceTask.mockResolvedValue({ type: 'appearance' })
    handlersMock.handleModifyLocationTask.mockResolvedValue({ type: 'location' })
    handlersMock.handleModifyPropTask.mockResolvedValue({ type: 'prop' })
    handlersMock.handleModifyShotPromptTask.mockResolvedValue({ type: 'shot-prompt' })
    handlersMock.handleGeneratePanelVideoPromptTask.mockResolvedValue({ type: 'video-prompt' })
    handlersMock.handleAnalyzeShotVariantsTask.mockResolvedValue({ type: 'variants' })
  })

  it('AI_MODIFY_APPEARANCE -> routes to appearance handler with payload', async () => {
    const payload = { characterId: 'char-1', appearanceId: 'app-1' }
    const job = buildJob(TASK_TYPE.AI_MODIFY_APPEARANCE, payload)

    const result = await handleShotAITask(job)

    expect(result).toEqual({ type: 'appearance' })
    expect(handlersMock.handleModifyAppearanceTask).toHaveBeenCalledWith(job, payload)
  })

  it('AI_MODIFY_LOCATION / AI_MODIFY_SHOT_PROMPT / ANALYZE_SHOT_VARIANTS route correctly', async () => {
    const locationPayload = { locationId: 'loc-1' }
    const locationJob = buildJob(TASK_TYPE.AI_MODIFY_LOCATION, locationPayload)
    await handleShotAITask(locationJob)
    expect(handlersMock.handleModifyLocationTask).toHaveBeenCalledWith(locationJob, locationPayload)

    const shotPayload = { currentPrompt: 'old prompt', modifyInstruction: 'new angle' }
    const shotJob = buildJob(TASK_TYPE.AI_MODIFY_SHOT_PROMPT, shotPayload)
    await handleShotAITask(shotJob)
    expect(handlersMock.handleModifyShotPromptTask).toHaveBeenCalledWith(shotJob, shotPayload)
    expect(handlersMock.handleGeneratePanelVideoPromptTask).not.toHaveBeenCalled()

    const videoPromptPayload = { mode: 'videoPrompt', panelId: 'panel-1', modifyInstruction: 'make timing more explicit' }
    const videoPromptJob = buildJob(TASK_TYPE.AI_MODIFY_SHOT_PROMPT, videoPromptPayload)
    await handleShotAITask(videoPromptJob)
    expect(handlersMock.handleGeneratePanelVideoPromptTask).toHaveBeenCalledWith(videoPromptJob, videoPromptPayload)

    const variantPayload = { panelId: 'panel-1' }
    const variantJob = buildJob(TASK_TYPE.ANALYZE_SHOT_VARIANTS, variantPayload)
    await handleShotAITask(variantJob)
    expect(handlersMock.handleAnalyzeShotVariantsTask).toHaveBeenCalledWith(variantJob, variantPayload)
  })

  it('unsupported type -> throws explicit error', async () => {
    const job = buildJob(TASK_TYPE.IMAGE_CHARACTER, {})
    await expect(handleShotAITask(job)).rejects.toThrow('Unsupported shot AI task type')
  })
})
