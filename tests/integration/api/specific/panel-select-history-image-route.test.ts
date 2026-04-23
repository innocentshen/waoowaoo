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
    candidateImages: JSON.stringify(['cos/candidate-2.png']),
    imageHistory: JSON.stringify([
      { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
      { url: 'cos/history-2.png', timestamp: '2026-04-23T09:00:00.000Z' },
    ]),
  },
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findFirst: vi.fn(async () => routeState.panel),
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
  const mod = await import('@/app/api/novel-promotion/[projectId]/panel/select-history-image/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/panel/select-history-image',
    method: 'POST',
    body,
  })
  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - panel select history image route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T10:30:00.000Z'))
    routeState.panel = {
      id: 'panel-1',
      imageUrl: 'cos/current.png',
      candidateImages: JSON.stringify(['cos/candidate-2.png']),
      imageHistory: JSON.stringify([
        { url: 'cos/history-1.png', timestamp: '2026-04-23T08:00:00.000Z' },
        { url: 'cos/history-2.png', timestamp: '2026-04-23T09:00:00.000Z' },
      ]),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('switches back to a history image and rotates the current image back into history', async () => {
    const res = await invokeRoute({
      panelId: 'panel-1',
      selectedImageUrl: 'cos/history-1.png',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { imageUrl: string; cosKey: string; success: boolean }
    expect(body).toEqual({
      success: true,
      imageUrl: 'signed:cos/history-1.png',
      cosKey: 'cos/history-1.png',
    })

    const updateCall = prismaMock.novelPromotionPanel.update.mock.calls.at(0) as unknown[] | undefined
    expect(updateCall).toBeDefined()
    const updateArgs = updateCall?.[0] as {
      data: { imageHistory: string | null; imageUrl: string; candidateImages: null }
    }
    expect(updateArgs.data.imageUrl).toBe('cos/history-1.png')
    expect(updateArgs.data.candidateImages).toBeNull()
    expect(parsePanelImageHistory(updateArgs.data.imageHistory)).toEqual([
      { url: 'cos/history-2.png', timestamp: '2026-04-23T09:00:00.000Z' },
      { url: 'cos/current.png', timestamp: '2026-04-23T10:30:00.000Z' },
      { url: 'cos/candidate-2.png', timestamp: '2026-04-23T10:30:00.000Z' },
    ])
  })
})
