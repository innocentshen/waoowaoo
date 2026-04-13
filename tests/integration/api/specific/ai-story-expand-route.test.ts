import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { TASK_TYPE } from '@/lib/task/types'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireUserAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  requireProjectAuthLight: vi.fn(async (projectId: string) => ({
    session: { user: { id: 'user-1' } },
    project: { id: projectId, userId: 'user-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const configMock = vi.hoisted(() => ({
  getUserModelConfig: vi.fn(async () => ({
    analysisModel: 'openai-compatible::user-analysis-model',
  })),
  getProjectModelConfig: vi.fn(async () => ({
    analysisModel: 'openai-compatible::project-analysis-model',
  })),
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

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/config-service', () => configMock)
vi.mock('@/lib/llm-observe/route-task', () => ({
  maybeSubmitLLMTask: maybeSubmitLLMTaskMock,
}))

describe('api specific - ai story expand route', () => {
  const routeContext = { params: Promise.resolve({}) }

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.requireUserAuth.mockResolvedValue({
      session: { user: { id: 'user-1' } },
    })
    authMock.requireProjectAuthLight.mockImplementation(async (projectId: string) => ({
      session: { user: { id: 'user-1' } },
      project: { id: projectId, userId: 'user-1' },
    }))
    configMock.getUserModelConfig.mockResolvedValue({
      analysisModel: 'openai-compatible::user-analysis-model',
    })
    configMock.getProjectModelConfig.mockResolvedValue({
      analysisModel: 'openai-compatible::project-analysis-model',
    })
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

  it('prefers project analysisModel when projectId is provided', async () => {
    const mod = await import('@/app/api/user/ai-story-expand/route')
    const req = buildMockRequest({
      path: '/api/user/ai-story-expand',
      method: 'POST',
      body: {
        prompt: 'expand prompt',
        projectId: 'project-1',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.async).toBe(true)
    expect(authMock.requireProjectAuthLight).toHaveBeenCalledWith('project-1')
    expect(authMock.requireUserAuth).not.toHaveBeenCalled()
    expect(configMock.getProjectModelConfig).toHaveBeenCalledWith('project-1', 'user-1')
    expect(configMock.getUserModelConfig).not.toHaveBeenCalled()
    expect(maybeSubmitLLMTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      projectId: 'project-1',
      type: TASK_TYPE.AI_STORY_EXPAND,
      body: expect.objectContaining({
        prompt: 'expand prompt',
        analysisModel: 'openai-compatible::project-analysis-model',
      }),
    }))
  })

  it('falls back to user analysisModel outside project workspace', async () => {
    const mod = await import('@/app/api/user/ai-story-expand/route')
    const req = buildMockRequest({
      path: '/api/user/ai-story-expand',
      method: 'POST',
      body: {
        prompt: 'expand prompt',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.async).toBe(true)
    expect(authMock.requireUserAuth).toHaveBeenCalled()
    expect(authMock.requireProjectAuthLight).not.toHaveBeenCalled()
    expect(configMock.getUserModelConfig).toHaveBeenCalledWith('user-1')
    expect(configMock.getProjectModelConfig).not.toHaveBeenCalled()
    expect(maybeSubmitLLMTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      projectId: 'home-ai-write',
      type: TASK_TYPE.AI_STORY_EXPAND,
      body: expect.objectContaining({
        prompt: 'expand prompt',
        analysisModel: 'openai-compatible::user-analysis-model',
      }),
    }))
  })
})
