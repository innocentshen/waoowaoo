import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    project: { id: 'project-1', userId: 'user-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const submitTaskMock = vi.hoisted(() =>
  vi.fn<typeof import('@/lib/task/submitter').submitTask>(async (input) => ({
    success: true,
    async: true,
    taskId: `task-${String(input.dedupeKey || 'unknown')}`,
    runId: null,
    status: 'queued',
    deduped: false,
  })),
)

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}))

const resolveLocaleMock = vi.hoisted(() => vi.fn(() => 'zh'))
const hasPanelVideoOutputMock = vi.hoisted(() => vi.fn(async () => false))
const billingMock = vi.hoisted(() =>
  vi.fn((_taskType: string, payload: unknown) => ({ mode: 'default', payload })),
)
const resolveProjectModelCapabilityGenerationOptionsMock = vi.hoisted(() =>
  vi.fn(async ({ runtimeSelections }: { runtimeSelections: Record<string, unknown> }) => runtimeSelections),
)
const resolveBuiltinCapabilitiesByModelKeyMock = vi.hoisted(() => vi.fn(() => null))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/task/submitter', () => ({ submitTask: submitTaskMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/task/resolve-locale', () => ({
  resolveRequiredTaskLocale: resolveLocaleMock,
}))
vi.mock('@/lib/task/has-output', () => ({
  hasPanelVideoOutput: hasPanelVideoOutputMock,
}))
vi.mock('@/lib/billing', () => ({
  buildDefaultTaskBillingInfo: billingMock,
}))
vi.mock('@/lib/model-config-contract', () => ({
  parseModelKeyStrict: vi.fn((value: string) => {
    if (!value) return null
    const [provider = 'fal', modelId = 'model-1'] = value.split('::')
    return { provider, modelId }
  }),
}))
vi.mock('@/lib/model-capabilities/lookup', () => ({
  resolveBuiltinCapabilitiesByModelKey: resolveBuiltinCapabilitiesByModelKeyMock,
}))
vi.mock('@/lib/model-pricing/lookup', () => ({
  resolveBuiltinPricing: vi.fn(() => ({ status: 'ok' })),
}))
vi.mock('@/lib/config-service', () => ({
  resolveProjectModelCapabilityGenerationOptions: resolveProjectModelCapabilityGenerationOptionsMock,
}))

async function invokeRoute(body: Record<string, unknown>) {
  const mod = await import('@/app/api/novel-promotion/[projectId]/generate-video/route')
  const req = buildMockRequest({
    path: '/api/novel-promotion/project-1/generate-video',
    method: 'POST',
    headers: {
      'x-request-id': 'req-seed',
    },
    body,
  })

  return await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
}

describe('api specific - generate video route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionPanel.findFirst.mockResolvedValue({ id: 'panel-1' })
    prismaMock.novelPromotionPanel.findMany.mockResolvedValue([
      { id: 'panel-1' },
      { id: 'panel-2' },
    ])
    resolveProjectModelCapabilityGenerationOptionsMock.mockImplementation(
      async ({ runtimeSelections }: { runtimeSelections: Record<string, unknown> }) => runtimeSelections,
    )
    resolveBuiltinCapabilitiesByModelKeyMock.mockReturnValue(null)
  })

  it('submits multiple single-panel tasks when count is greater than one', async () => {
    const res = await invokeRoute({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      videoModel: 'fal::seedance/video',
      count: 3,
      referenceSelection: {
        includeCharacters: true,
        includeProps: true,
        characters: [{ name: 'Hero', appearance: 'default' }],
        props: ['Ancient Sword'],
      },
      generationOptions: {
        resolution: '720p',
      },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as { total: number; tasks: Array<{ taskId: string }> }
    expect(json.total).toBe(3)
    expect(json.tasks).toHaveLength(3)
    expect(submitTaskMock).toHaveBeenCalledTimes(3)

    for (const [index, call] of submitTaskMock.mock.calls.entries()) {
      const payload = call[0].payload as Record<string, unknown>
      expect(call[0]).toEqual(expect.objectContaining({
        projectId: 'project-1',
        targetType: 'NovelPromotionPanel',
        targetId: 'panel-1',
        dedupeKey: `video_panel:panel-1:req-seed:${index}`,
      }))
      expect(payload).toEqual(expect.objectContaining({
        storyboardId: 'storyboard-1',
        panelIndex: 0,
        videoModel: 'fal::seedance/video',
        referenceSelection: {
          includeCharacters: true,
          includeProps: true,
          characters: [{ name: 'Hero', appearance: 'default' }],
          props: ['Ancient Sword'],
        },
        count: 1,
        requestedCount: 3,
        candidateBatchId: 'req-seed',
        candidateSequence: index,
      }))
    }

    expect(billingMock).toHaveBeenCalledTimes(3)
    for (const call of billingMock.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({
        count: 1,
      }))
    }
  })

  it('fans out batch generation per panel and per requested candidate count', async () => {
    const res = await invokeRoute({
      all: true,
      episodeId: 'episode-1',
      videoModel: 'fal::seedance/video',
      count: 2,
      referenceSelection: {
        includeLocation: true,
        includeProps: true,
      },
    })

    expect(res.status).toBe(200)
    const json = await res.json() as { total: number; tasks: Array<{ taskId: string }> }
    expect(json.total).toBe(4)
    expect(json.tasks).toHaveLength(4)
    expect(submitTaskMock).toHaveBeenCalledTimes(4)
    expect(submitTaskMock.mock.calls.map((call) => call[0].dedupeKey)).toEqual([
      'video_panel:panel-1:req-seed:0',
      'video_panel:panel-1:req-seed:1',
      'video_panel:panel-2:req-seed:0',
      'video_panel:panel-2:req-seed:1',
    ])
    for (const call of submitTaskMock.mock.calls) {
      expect(call[0].payload).toEqual(expect.objectContaining({
        referenceSelection: {
          includeLocation: true,
          includeProps: true,
        },
      }))
    }
  })

  it('submits edit-video payloads for a single candidate operation', async () => {
    const res = await invokeRoute({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      videoModel: 'grok::grok-imagine-video',
      videoOperation: {
        mode: 'edit',
        sourceCandidateId: 'candidate-1',
        instruction: 'make the movement more subtle',
      },
    })

    expect(res.status).toBe(200)
    expect(submitTaskMock).toHaveBeenCalledTimes(1)
    expect(submitTaskMock.mock.calls[0]?.[0]?.payload).toEqual(expect.objectContaining({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      videoOperation: {
        mode: 'edit',
        sourceCandidateId: 'candidate-1',
        instruction: 'make the movement more subtle',
      },
    }))
  })

  it('injects resolved aspect ratio into submitted payload and billing when the request omits it', async () => {
    resolveBuiltinCapabilitiesByModelKeyMock.mockReturnValue({ video: {} } as never)
    resolveProjectModelCapabilityGenerationOptionsMock.mockResolvedValue({
      aspectRatio: '9:16',
      resolution: '720p',
    })

    const res = await invokeRoute({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      videoModel: 'fal::seedance/video',
      generationOptions: {
        resolution: '720p',
      },
    })

    expect(res.status).toBe(200)
    const payload = submitTaskMock.mock.calls[0]?.[0]?.payload as Record<string, unknown>
    expect(payload).toEqual(expect.objectContaining({
      generationOptions: {
        aspectRatio: '9:16',
        resolution: '720p',
      },
    }))
    expect(billingMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      generationOptions: {
        aspectRatio: '9:16',
        resolution: '720p',
      },
    }))
  })

  it('rejects batched edit or extend requests before task submission', async () => {
    const res = await invokeRoute({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      videoModel: 'grok::grok-imagine-video',
      count: 2,
      videoOperation: {
        mode: 'extend',
        sourceCandidateId: 'candidate-1',
        instruction: 'continue forward',
        extendDuration: 4,
      },
    })

    expect(res.status).toBe(400)
    expect(submitTaskMock).not.toHaveBeenCalled()
  })
})
