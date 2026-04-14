import { resolveTaskErrorMessage } from './error-message'
import { apiFetch } from '@/lib/api-fetch'

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled'

export type TaskSnapshot = {
  id: string
  status: TaskStatus
  progress?: number | null
  result?: Record<string, unknown> | null
  errorMessage?: string | null
}

export type TaskSnapshotResponse = {
  success: boolean
  task?: TaskSnapshot | null
}

export type WaitTaskOptions = {
  intervalMs?: number
  timeoutMs?: number
  onTaskUpdate?: (task: TaskSnapshot) => void
}

function isRetriableTaskFetchError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.trim().toLowerCase()
  return (
    message === 'connection error.' ||
    message === 'connection error' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error')
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isAsyncTaskResponse(data: unknown): data is { async: true; taskId: string } {
  if (!data || typeof data !== 'object') return false
  const payload = data as Record<string, unknown>
  return payload.async === true && typeof payload.taskId === 'string' && payload.taskId.length > 0
}

export async function getTaskSnapshot(taskId: string) {
  const response = await apiFetch(`/api/tasks/${taskId}`, {
    method: 'GET',
    cache: 'no-store',
  })
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    throw new Error(resolveTaskErrorMessage(errorPayload, `Task fetch failed: ${taskId}`))
  }

  const payload = (await response.json()) as TaskSnapshotResponse
  const task = payload.task
  if (!task) {
    throw new Error(`Task not found: ${taskId}`)
  }
  return task
}

export async function waitForTaskResult(taskId: string, options: WaitTaskOptions = {}) {
  const intervalMs = options.intervalMs ?? 1500
  const timeoutMs = options.timeoutMs ?? 0
  const onTaskUpdate = options.onTaskUpdate
  const startedAt = Date.now()
  let transientFetchErrorCount = 0

  while (true) {
    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error(`Task timeout: ${taskId}`)
    }

    let task: TaskSnapshot
    try {
      task = await getTaskSnapshot(taskId)
      transientFetchErrorCount = 0
    } catch (error) {
      if (isRetriableTaskFetchError(error) && transientFetchErrorCount < 3) {
        transientFetchErrorCount += 1
        await sleep(intervalMs)
        continue
      }
      throw error
    }

    onTaskUpdate?.(task)

    if (task.status === 'completed') {
      return task.result || { success: true }
    }
    if (task.status === 'failed' || task.status === 'canceled') {
      throw new Error(resolveTaskErrorMessage(task, `Task ${task.status}`))
    }
    if (task.status !== 'queued' && task.status !== 'processing') {
      throw new Error(resolveTaskErrorMessage(task, `Task ${task.status}`))
    }

    await sleep(intervalMs)
  }
}

export async function resolveTaskResponse<T = Record<string, unknown>>(response: Response, options?: WaitTaskOptions) {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveTaskErrorMessage(data, 'Request failed'))
  }
  if (isAsyncTaskResponse(data)) {
    return await waitForTaskResult(data.taskId, options) as T
  }
  return (data || {}) as T
}
