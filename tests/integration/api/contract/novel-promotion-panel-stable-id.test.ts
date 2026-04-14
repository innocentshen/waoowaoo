import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    project: { id: 'project-1', userId: 'user-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findUnique: vi.fn(async () => ({ id: 'panel-1' })),
    update: vi.fn(async () => ({ id: 'panel-1' })),
    create: vi.fn(async () => ({ id: 'panel-1' })),
  },
  novelPromotionStoryboard: {
    findUnique: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  },
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

describe('api contract - novel promotion panel stable id updates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionPanel.findUnique.mockResolvedValue({ id: 'panel-1' })
  })

  it('accepts PUT updates addressed by panel id without storyboard coordinates', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/panel/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/panel',
      method: 'PUT',
      body: {
        id: 'panel-1',
        description: 'updated description',
        actingNotes: {
          beats: ['pause', 'look left'],
        },
      },
    })

    const res = await mod.PUT(req, { params: Promise.resolve({ projectId: 'project-1' }) })

    expect(res.status).toBe(200)
    expect(prismaMock.novelPromotionPanel.update).toHaveBeenCalledWith({
      where: { id: 'panel-1' },
      data: {
        description: 'updated description',
        actingNotes: JSON.stringify({
          beats: ['pause', 'look left'],
        }),
      },
    })
    expect(prismaMock.novelPromotionStoryboard.findUnique).not.toHaveBeenCalled()
  })
})
