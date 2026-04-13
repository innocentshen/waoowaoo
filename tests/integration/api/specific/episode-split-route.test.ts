import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    project: { id: 'project-1', userId: 'user-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const maybeSubmitLLMTaskMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/llm-observe/route-task', () => ({
  maybeSubmitLLMTask: maybeSubmitLLMTaskMock,
}))

async function invokeRoute(content: string) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/episodes/split/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/episodes/split',
    method: 'POST',
    body: { content, async: true },
  })

  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - episode split route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    maybeSubmitLLMTaskMock.mockResolvedValue(null)
  })

  it('returns marker split directly for markdown episode headings without submitting an llm task', async () => {
    const content = [
      '## 第1集《崩溃日志》',
      '',
      '凌晨三点的办公室，陆沉是唯一一个还在工位上的人。他盯着屏幕上第27次重复的崩溃日志，每次都落在同一毫秒。',
      '',
      '## 第2集《血色工位》',
      '',
      '陆沉看见自己熟悉的工位正在咀嚼昨天还跟他一起吃饭的同事。整层楼的电脑都在跑他的代码，但输出结果全是他的生物数据。',
    ].join('\n')

    const response = await invokeRoute(content)

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      success: boolean
      method: string
      markerType: string
      episodes: Array<{ number: number; content: string }>
    }
    expect(payload.success).toBe(true)
    expect(payload.method).toBe('markers')
    expect(payload.markerType).toBe('第X集')
    expect(payload.episodes).toHaveLength(2)
    expect(payload.episodes[0]?.number).toBe(1)
    expect(payload.episodes[1]?.number).toBe(2)
    expect(maybeSubmitLLMTaskMock).not.toHaveBeenCalled()
  })
})
