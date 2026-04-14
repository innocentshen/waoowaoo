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
  storyboard: {
    id: 'storyboard-1',
    panels: [{ panelIndex: 2 }],
  },
  panelById: new Map<string, { id: string; storyboardId: string; panelIndex: number }>(),
}))

const txSpy = vi.hoisted(() => ({
  findFirst: vi.fn(async () => ({ panelIndex: 2 })),
  updateMany: vi.fn(async () => ({ count: 1 })),
  create: vi.fn(async (args: { data: { panelIndex: number; panelNumber: number } }) => ({
    id: 'panel-new',
    ...args.data,
  })),
  count: vi.fn(async () => 4),
  storyboardUpdate: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionStoryboard: {
    findUnique: vi.fn(async () => routeState.storyboard),
    update: vi.fn(async () => ({})),
  },
  novelPromotionPanel: {
    findUnique: vi.fn(async (args: { where: { id?: string; storyboardId_panelIndex?: { storyboardId: string; panelIndex: number } } }) => {
      if (args.where.id) {
        return routeState.panelById.get(args.where.id) ?? null
      }
      const composite = args.where.storyboardId_panelIndex
      if (!composite) return null
      return Array.from(routeState.panelById.values()).find(
        (panel) => panel.storyboardId === composite.storyboardId && panel.panelIndex === composite.panelIndex,
      ) ?? null
    }),
  },
  $transaction: vi.fn(async (
    fn: (tx: {
      novelPromotionPanel: {
        findFirst: typeof txSpy.findFirst
        updateMany: typeof txSpy.updateMany
        create: typeof txSpy.create
        count: typeof txSpy.count
        update: typeof txSpy.update
      }
      novelPromotionStoryboard: {
        update: typeof txSpy.storyboardUpdate
      }
    }) => Promise<unknown>,
  ) => await fn({
    novelPromotionPanel: {
      findFirst: txSpy.findFirst,
      updateMany: txSpy.updateMany,
      create: txSpy.create,
      count: txSpy.count,
      update: txSpy.update,
    },
    novelPromotionStoryboard: {
      update: txSpy.storyboardUpdate,
    },
  })),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

async function invokePost(body: Record<string, unknown>) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/panel/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/panel',
    method: 'POST',
    body,
  })
  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

async function invokePatch(body: Record<string, unknown>) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/panel/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/panel',
    method: 'PATCH',
    body,
  })
  return await mod.PATCH(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - panel route ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.storyboard = {
      id: 'storyboard-1',
      panels: [{ panelIndex: 2 }],
    }
    routeState.panelById = new Map([
      ['panel-1', { id: 'panel-1', storyboardId: 'storyboard-1', panelIndex: 1 }],
      ['panel-2', { id: 'panel-2', storyboardId: 'storyboard-1', panelIndex: 2 }],
    ])
  })

  it('inserts a new panel after a target panel and shifts following indexes', async () => {
    const res = await invokePost({
      storyboardId: 'storyboard-1',
      insertAfterPanelId: 'panel-1',
      shotType: 'medium shot',
      description: 'new shot',
    })

    expect(res.status).toBe(200)
    expect(txSpy.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        storyboardId: 'storyboard-1',
        panelIndex: { gt: 1 },
      },
      data: {
        panelIndex: { increment: 1002 },
        panelNumber: { increment: 1002 },
      },
    })
    expect(txSpy.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        storyboardId: 'storyboard-1',
        panelIndex: { gt: 1003 },
      },
      data: {
        panelIndex: { decrement: 1001 },
        panelNumber: { decrement: 1001 },
      },
    })
    expect(txSpy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storyboardId: 'storyboard-1',
        panelIndex: 2,
        panelNumber: 3,
        shotType: 'medium shot',
        description: 'new shot',
      }),
    })
    expect(txSpy.storyboardUpdate).toHaveBeenCalledWith({
      where: { id: 'storyboard-1' },
      data: { panelCount: 4 },
    })
  })

  it('swaps the panel with its previous neighbor when moving up', async () => {
    routeState.panelById = new Map([
      ['panel-current', { id: 'panel-current', storyboardId: 'storyboard-1', panelIndex: 2 }],
      ['panel-prev', { id: 'panel-prev', storyboardId: 'storyboard-1', panelIndex: 1 }],
    ])

    const res = await invokePatch({
      action: 'move',
      panelId: 'panel-current',
      direction: 'up',
    })

    expect(res.status).toBe(200)
    expect(txSpy.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'panel-current' },
      data: {
        panelIndex: -1,
        panelNumber: 0,
      },
    })
    expect(txSpy.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'panel-prev' },
      data: {
        panelIndex: 2,
        panelNumber: 3,
      },
    })
    expect(txSpy.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'panel-current' },
      data: {
        panelIndex: 1,
        panelNumber: 2,
      },
    })
    expect(txSpy.storyboardUpdate).toHaveBeenCalledWith({
      where: { id: 'storyboard-1' },
      data: { updatedAt: expect.any(Date) },
    })
  })
})
