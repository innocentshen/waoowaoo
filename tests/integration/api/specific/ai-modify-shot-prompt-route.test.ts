import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { TASK_TYPE } from '@/lib/task/types'
import { buildMockRequest } from '../../../helpers/request'

const authState = vi.hoisted(() => ({
  authenticated: true,
}))

const maybeSubmitLLMTaskMock = vi.hoisted(() =>
  vi.fn<typeof import('@/lib/llm-observe/route-task').maybeSubmitLLMTask>(async () => NextResponse.json({
    success: true,
    async: true,
    taskId: 'task-1',
    runId: null,
    status: 'queued',
    deduped: false,
  })),
)

vi.mock('@/lib/api-auth', () => {
  const unauthorized = () => new Response(
    JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  )

  return {
    isErrorResponse: (value: unknown) => value instanceof Response,
    requireProjectAuth: async (projectId: string) => {
      if (!authState.authenticated) return unauthorized()
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1' },
      }
    },
  }
})

vi.mock('@/lib/llm-observe/route-task', () => ({
  maybeSubmitLLMTask: maybeSubmitLLMTaskMock,
}))

describe('api specific - ai modify shot prompt route', () => {
  const routeContext = { params: Promise.resolve({ projectId: 'project-1' }) }

  beforeEach(() => {
    vi.clearAllMocks()
    authState.authenticated = true
    maybeSubmitLLMTaskMock.mockResolvedValue(
      NextResponse.json({
        success: true,
        async: true,
        taskId: 'task-1',
        runId: null,
        status: 'queued',
        deduped: false,
      }),
    )
  })

  it('accepts videoPrompt mode without currentPrompt and uses video prompt dedupe key', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-shot-prompt/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-shot-prompt',
      method: 'POST',
      body: {
        mode: 'videoPrompt',
        panelId: 'panel-1',
        modifyInstruction: 'make the motion timing clearer',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.async).toBe(true)
    expect(maybeSubmitLLMTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      type: TASK_TYPE.AI_MODIFY_SHOT_PROMPT,
      targetType: 'NovelPromotionPanel',
      targetId: 'panel-1',
      dedupeKey: 'ai_generate_video_prompt:panel-1',
      projectId: 'project-1',
      userId: 'user-1',
    }))
  })

  it('rejects videoPrompt mode when panelId is missing', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/ai-modify-shot-prompt/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/ai-modify-shot-prompt',
      method: 'POST',
      body: {
        mode: 'videoPrompt',
        modifyInstruction: 'make the motion timing clearer',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_PARAMS')
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })
})
