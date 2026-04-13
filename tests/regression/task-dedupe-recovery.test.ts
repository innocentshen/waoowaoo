import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'
import { createTask, tryUpdateTaskProgress } from '@/lib/task/service'
import { prisma } from '../helpers/prisma'
import { resetBillingState } from '../helpers/db-reset'
import { createQueuedTask, createTestProject, createTestUser } from '../helpers/billing-fixtures'

const reconcileMock = vi.hoisted(() => ({
  isJobAlive: vi.fn(async () => true),
}))

vi.mock('@/lib/task/reconcile', () => reconcileMock)

describe('regression - task dedupe recovery', () => {
  beforeEach(async () => {
    await resetBillingState()
    vi.clearAllMocks()
    reconcileMock.isJobAlive.mockResolvedValue(true)
  })

  it('replaces locale-less queued task instead of deduping forever', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    const stale = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
        targetType: 'NovelPromotionEpisode',
        targetId: 'episode-regression-1',
        status: TASK_STATUS.QUEUED,
        payload: { episodeId: 'episode-regression-1' },
        dedupeKey: 'script_to_storyboard_run:episode-regression-1',
        queuedAt: new Date(),
      },
    })

    const replacement = await createTask({
      userId: user.id,
      projectId: project.id,
      type: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
      targetType: 'NovelPromotionEpisode',
      targetId: 'episode-regression-1',
      payload: {
        episodeId: 'episode-regression-1',
        meta: { locale: 'zh' },
      },
      dedupeKey: 'script_to_storyboard_run:episode-regression-1',
    })

    expect(replacement.deduped).toBe(false)
    expect(replacement.task.id).not.toBe(stale.id)

    const failedStale = await prisma.task.findUnique({ where: { id: stale.id } })
    expect(failedStale).toMatchObject({
      status: TASK_STATUS.FAILED,
      errorCode: 'TASK_LOCALE_REQUIRED',
      dedupeKey: null,
    })
  })

  it('replaces orphaned queued task when queue job is gone', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    const orphan = await prisma.task.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: TASK_TYPE.VIDEO_PANEL,
        targetType: 'NovelPromotionPanel',
        targetId: 'panel-regression-1',
        status: TASK_STATUS.QUEUED,
        payload: {
          storyboardId: 'storyboard-regression-1',
          panelIndex: 1,
          meta: { locale: 'zh' },
        },
        dedupeKey: 'video_panel:panel-regression-1',
        queuedAt: new Date(),
      },
    })
    reconcileMock.isJobAlive.mockResolvedValue(false)

    const replacement = await createTask({
      userId: user.id,
      projectId: project.id,
      type: TASK_TYPE.VIDEO_PANEL,
      targetType: 'NovelPromotionPanel',
      targetId: 'panel-regression-1',
      payload: {
        storyboardId: 'storyboard-regression-1',
        panelIndex: 1,
        meta: { locale: 'zh' },
      },
      dedupeKey: 'video_panel:panel-regression-1',
    })

    expect(replacement.deduped).toBe(false)
    expect(replacement.task.id).not.toBe(orphan.id)

    const failedOrphan = await prisma.task.findUnique({ where: { id: orphan.id } })
    expect(failedOrphan).toMatchObject({
      status: TASK_STATUS.FAILED,
      errorCode: 'RECONCILE_ORPHAN',
      dedupeKey: null,
    })
  })

  it('preserves locale-bearing payload fields when progress updates task payload', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    const task = await createQueuedTask({
      id: 'video-progress-regression-1',
      userId: user.id,
      projectId: project.id,
      type: TASK_TYPE.VIDEO_PANEL,
      targetType: 'NovelPromotionPanel',
      targetId: 'panel-progress-regression-1',
      payload: {
        storyboardId: 'storyboard-progress-regression-1',
        panelIndex: 2,
        videoModel: 'seedance',
        generationOptions: {
          duration: 5,
          aspectRatio: '16:9',
        },
        meta: {
          locale: 'zh',
          runId: 'run-progress-regression-1',
        },
      },
    })

    const updated = await tryUpdateTaskProgress(task.id, 35, {
      stage: 'submitting',
      stageLabel: 'Submitting video task',
      trace: {
        requestId: 'req-progress-regression-1',
      },
      meta: {
        flowStageIndex: 2,
      },
    })

    expect(updated).toBe(true)

    const refreshed = await prisma.task.findUnique({ where: { id: task.id } })
    expect(refreshed).toMatchObject({
      progress: 35,
      payload: {
        storyboardId: 'storyboard-progress-regression-1',
        panelIndex: 2,
        videoModel: 'seedance',
        generationOptions: {
          duration: 5,
          aspectRatio: '16:9',
        },
        stage: 'submitting',
        stageLabel: 'Submitting video task',
        trace: {
          requestId: 'req-progress-regression-1',
        },
        meta: {
          locale: 'zh',
          runId: 'run-progress-regression-1',
          flowStageIndex: 2,
        },
      },
    })
  })
})
