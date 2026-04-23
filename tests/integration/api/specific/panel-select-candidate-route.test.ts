import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'
import { parsePanelImageHistory } from '@/lib/novel-promotion/panel-image-history'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    project: { id: 'project-1', userId: 'user-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const routeState = vi.hoisted(() => ({
  panel: {
    id: 'panel-1',
    imageUrl: 'cos/current.png',
    candidateImages: JSON.stringify([
      'cos/current.png',
      'cos/candidate-2.png',
      'cos/candidate-3.png',
    ]),
    imageHistory: JSON.stringify([
      { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
    ]),
  },
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findUnique: vi.fn(async () => routeState.panel),
    update: vi.fn(async () => undefined),
  },
}))

const resolveStorageKeyMock = vi.hoisted(() => vi.fn(async (value: string) => value))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/storage', () => ({
  getSignedUrl: vi.fn((value: string) => `signed:${value}`),
  generateUniqueKey: vi.fn(() => 'generated-key.png'),
  downloadAndUploadImage: vi.fn(async () => 'generated-key.png'),
  toFetchableUrl: vi.fn((value: string) => value),
}))

async function invokeRoute(body: Record<string, unknown>) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/panel/select-candidate/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/panel/select-candidate',
    method: 'POST',
    body,
  })
  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - panel select candidate route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T10:00:00.000Z'))
    routeState.panel = {
      id: 'panel-1',
      imageUrl: 'cos/current.png',
      candidateImages: JSON.stringify([
        'cos/current.png',
        'cos/candidate-2.png',
        'cos/candidate-3.png',
      ]),
      imageHistory: JSON.stringify([
        { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
      ]),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps unselected generated candidates in history when confirming a candidate', async () => {
    const res = await invokeRoute({
      panelId: 'panel-1',
      selectedImageUrl: 'cos/candidate-2.png',
      action: 'select',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { imageUrl: string; cosKey: string }
    expect(body).toEqual({
      success: true,
      imageUrl: 'signed:cos/candidate-2.png',
      cosKey: 'cos/candidate-2.png',
      message: '宸查€夋嫨鍥剧墖',
    })

    const updateCall = prismaMock.novelPromotionPanel.update.mock.calls.at(0) as unknown[] | undefined
    expect(updateCall).toBeDefined()
    const updateArgs = updateCall?.[0] as {
      data: { imageHistory: string | null; imageUrl: string; candidateImages: null }
    }
    expect(updateArgs.data.imageUrl).toBe('cos/candidate-2.png')
    expect(updateArgs.data.candidateImages).toBeNull()
    expect(parsePanelImageHistory(updateArgs.data.imageHistory)).toEqual([
      { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
      { url: 'cos/current.png', timestamp: '2026-04-23T10:00:00.000Z' },
      { url: 'cos/candidate-3.png', timestamp: '2026-04-23T10:00:00.000Z' },
    ])
  })

  it('moves cancelled generated candidates into history while keeping current image active', async () => {
    const res = await invokeRoute({
      panelId: 'panel-1',
      action: 'cancel',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)

    const updateCall = prismaMock.novelPromotionPanel.update.mock.calls.at(0) as unknown[] | undefined
    expect(updateCall).toBeDefined()
    const updateArgs = updateCall?.[0] as {
      data: { imageHistory: string | null; candidateImages: null }
    }
    expect(updateArgs.data.candidateImages).toBeNull()
    expect(parsePanelImageHistory(updateArgs.data.imageHistory)).toEqual([
      { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
      { url: 'cos/candidate-2.png', timestamp: '2026-04-23T10:00:00.000Z' },
      { url: 'cos/candidate-3.png', timestamp: '2026-04-23T10:00:00.000Z' },
    ])
  })
})
