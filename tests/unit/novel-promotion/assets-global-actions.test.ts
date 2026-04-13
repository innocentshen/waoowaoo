import { describe, expect, it } from 'vitest'
import {
  isGlobalAnalyzeTaskRunning,
  resolveGlobalAnalyzeCompletion,
  shouldResumeGlobalAnalyzeFromTaskSnapshot,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/hooks/useAssetsGlobalActions'

describe('assets global actions task state helpers', () => {
  it('treats queued and processing analyze task as running', () => {
    expect(isGlobalAnalyzeTaskRunning({
      phase: 'queued',
      runningTaskId: 'task-1',
      lastError: null,
    })).toBe(true)

    expect(isGlobalAnalyzeTaskRunning({
      phase: 'processing',
      runningTaskId: 'task-1',
      lastError: null,
    })).toBe(true)
  })

  it('keeps completion idle when there is no previously running task', () => {
    expect(resolveGlobalAnalyzeCompletion(null, {
      phase: 'completed',
      runningTaskId: null,
      lastError: null,
    })).toEqual({
      status: 'idle',
      finishedTaskId: null,
      errorMessage: null,
    })
  })

  it('marks previously running task as succeeded once runtime state stops running', () => {
    expect(resolveGlobalAnalyzeCompletion('task-2', {
      phase: 'completed',
      runningTaskId: null,
      lastError: null,
    })).toEqual({
      status: 'succeeded',
      finishedTaskId: 'task-2',
      errorMessage: null,
    })
  })

  it('surfaces failed completion message from task state', () => {
    expect(resolveGlobalAnalyzeCompletion('task-3', {
      phase: 'failed',
      runningTaskId: null,
      lastError: {
        code: 'MODEL_NOT_CONFIGURED',
        message: 'No model configured',
      },
    })).toEqual({
      status: 'failed',
      finishedTaskId: 'task-3',
      errorMessage: 'No model configured',
    })
  })

  it('restores running state when task snapshot is still queued or processing', () => {
    expect(shouldResumeGlobalAnalyzeFromTaskSnapshot({
      status: 'queued',
    })).toBe(true)

    expect(shouldResumeGlobalAnalyzeFromTaskSnapshot({
      status: 'processing',
    })).toBe(true)

    expect(shouldResumeGlobalAnalyzeFromTaskSnapshot({
      status: 'completed',
    })).toBe(false)

    expect(shouldResumeGlobalAnalyzeFromTaskSnapshot(null)).toBe(false)
  })
})
