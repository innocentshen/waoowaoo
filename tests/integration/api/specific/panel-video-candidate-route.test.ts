import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

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
    videoUrl: 'cos/current.mp4',
    videoGenerationMode: 'normal',
    lipSyncVideoUrl: 'cos/lipsync.mp4',
    videoCandidates: JSON.stringify([
      {
        id: 'current',
        videoUrl: 'cos/current.mp4',
        generationMode: 'normal',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
      {
        id: 'alt',
        videoUrl: 'cos/alt.mp4',
        generationMode: 'firstlastframe',
        createdAt: '2026-04-09T00:00:00.000Z',
      },
    ]),
  },
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findFirst: vi.fn(async () => routeState.panel),
    update: vi.fn(async () => undefined),
  },
}))

const deleteObjectsMock = vi.hoisted(() => vi.fn(async () => undefined))
const resolveStorageKeyMock = vi.hoisted(() => vi.fn(async (value: string) => value.replace(/^cos\//, '')))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/storage', () => ({
  deleteObjects: deleteObjectsMock,
}))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))

async function invokeRoute(body: Record<string, unknown>) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/panel/video-candidate/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/panel/video-candidate',
    method: 'POST',
    body,
  })
  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - panel video candidate route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.panel = {
      id: 'panel-1',
      videoUrl: 'cos/current.mp4',
      videoGenerationMode: 'normal',
      lipSyncVideoUrl: 'cos/lipsync.mp4',
      videoCandidates: JSON.stringify([
        {
          id: 'current',
          videoUrl: 'cos/current.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-08T00:00:00.000Z',
        },
        {
          id: 'alt',
          videoUrl: 'cos/alt.mp4',
          generationMode: 'firstlastframe',
          createdAt: '2026-04-09T00:00:00.000Z',
        },
      ]),
    }
  })

  it('selects a saved candidate and clears lip-sync output', async () => {
    const res = await invokeRoute({
      panelId: 'panel-1',
      candidateId: 'alt',
      action: 'select',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { selectedCandidateId: string; videoUrl: string }
    expect(body).toEqual({
      selectedCandidateId: 'alt',
      videoUrl: 'cos/alt.mp4',
      success: true,
    })

    expect(prismaMock.novelPromotionPanel.update).toHaveBeenCalledWith({
      where: { id: 'panel-1' },
      data: {
        videoCandidates: JSON.stringify([
          {
            id: 'current',
            videoUrl: 'cos/current.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
            model: null,
            prompt: null,
            meta: null,
          },
          {
            id: 'alt',
            videoUrl: 'cos/alt.mp4',
            generationMode: 'firstlastframe',
            createdAt: '2026-04-09T00:00:00.000Z',
            model: null,
            prompt: null,
            meta: null,
          },
        ]),
        videoUrl: 'cos/alt.mp4',
        videoGenerationMode: 'firstlastframe',
        lipSyncVideoUrl: null,
        lipSyncVideoMediaId: null,
        lipSyncTaskId: null,
      },
    })
  })

  it('deletes a candidate, falls back to the remaining selected video, and deletes the file', async () => {
    const res = await invokeRoute({
      panelId: 'panel-1',
      candidateId: 'current',
      action: 'delete',
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { deletedCandidateId: string; nextSelectedCandidateId: string | null }
    expect(body).toEqual({
      success: true,
      deletedCandidateId: 'current',
      nextSelectedCandidateId: 'alt',
    })

    expect(prismaMock.novelPromotionPanel.update).toHaveBeenCalledTimes(1)
    const firstUpdateCall = prismaMock.novelPromotionPanel.update.mock.calls.at(0) as [{
      where: { id: string }
      data: {
        videoCandidates: string | null
        videoUrl: string | null
        videoGenerationMode: string | null
        lipSyncVideoUrl?: string | null
        lipSyncVideoMediaId?: string | null
        lipSyncTaskId?: string | null
      }
    }] | undefined
    expect(firstUpdateCall).toBeDefined()
    const updateArgs = firstUpdateCall![0]
    expect(updateArgs).toEqual({
      where: { id: 'panel-1' },
      data: {
        videoCandidates: JSON.stringify([
          {
            id: 'alt',
            videoUrl: 'cos/alt.mp4',
            generationMode: 'firstlastframe',
            createdAt: '2026-04-09T00:00:00.000Z',
            model: null,
            prompt: null,
            meta: null,
          },
        ]),
        videoUrl: 'cos/alt.mp4',
        videoGenerationMode: 'firstlastframe',
        lipSyncVideoUrl: null,
        lipSyncVideoMediaId: null,
        lipSyncTaskId: null,
      },
    })
    expect(deleteObjectsMock).toHaveBeenCalledWith(['current.mp4'])
  })
})
