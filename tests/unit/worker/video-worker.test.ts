import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'

type WorkerProcessor = (job: Job<TaskJobData>) => Promise<unknown>

type PanelRow = {
  id: string
  videoUrl: string | null
  videoCandidates: string | null
  videoGenerationMode: string | null
  imageUrl: string | null
  videoPrompt: string | null
  description: string | null
  characters?: string | null
  location?: string | null
  props?: string | null
  firstLastFramePrompt: string | null
  duration: number | null
  updatedAt: Date
}

const workerState = vi.hoisted(() => ({
  processor: null as WorkerProcessor | null,
}))

const reportTaskProgressMock = vi.hoisted(() => vi.fn(async () => undefined))
const withTaskLifecycleMock = vi.hoisted(() =>
  vi.fn(async (job: Job<TaskJobData>, handler: WorkerProcessor) => await handler(job)),
)

const utilsMock = vi.hoisted(() => ({
  assertTaskActive: vi.fn(async () => undefined),
  getProjectModels: vi.fn(async () => ({ videoRatio: '16:9' })),
  resolveLipSyncVideoSource: vi.fn(async () => 'https://provider.example/lipsync.mp4'),
  resolveVideoSourceFromGeneration: vi.fn<
    (...args: unknown[]) => Promise<{ url: string; actualVideoTokens?: number; downloadHeaders?: Record<string, string> }>
  >(async () => ({ url: 'https://provider.example/video.mp4' })),
  toSignedUrlIfCos: vi.fn((url: string | null) => (url ? `https://signed.example/${url}` : null)),
  uploadVideoSourceToCos: vi.fn(async () => 'cos/lip-sync/video.mp4'),
}))
const mediaMock = vi.hoisted(() => ({
  normalizeToBase64ForGeneration: vi.fn(async (input: string) => input),
}))
const configServiceMock = vi.hoisted(() => ({
  getUserWorkflowConcurrencyConfig: vi.fn(async () => ({
    analysis: 5,
    image: 5,
    video: 5,
  })),
}))
const concurrencyGateMock = vi.hoisted(() => ({
  withUserConcurrencyGate: vi.fn(async <T>(input: {
    run: () => Promise<T>
  }) => await input.run()),
}))
const imageTaskSharedMock = vi.hoisted(() => ({
  findCharacterByName: vi.fn((characters: Array<{ name: string }>, referenceName: string) =>
    characters.find((character) => character.name === referenceName)),
  parseImageUrls: vi.fn((value: string | null | undefined) => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }),
  parsePanelCharacterReferences: vi.fn((value: string | null | undefined) => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }),
  parseNamedReferenceList: vi.fn((value: string | null | undefined) => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }),
  resolveNovelData: vi.fn(async () => ({
    characters: [] as Array<Record<string, unknown>>,
    locations: [] as Array<Record<string, unknown>>,
    props: [] as Array<Record<string, unknown>>,
  })),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(async () => undefined),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  novelPromotionVoiceLine: {
    findUnique: vi.fn(),
  },
}))

vi.mock('bullmq', () => ({
  Queue: class {
    constructor(name: string) {
      void name
    }

    async add() {
      return { id: 'job-1' }
    }

    async getJob() {
      return null
    }
  },
  Worker: class {
    constructor(name: string, processor: WorkerProcessor) {
      void name
      workerState.processor = processor
    }
  },
}))

vi.mock('@/lib/redis', () => ({ queueRedis: {} }))
vi.mock('@/lib/workers/shared', () => ({
  reportTaskProgress: reportTaskProgressMock,
  withTaskLifecycle: withTaskLifecycleMock,
}))
vi.mock('@/lib/workers/utils', () => utilsMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/outbound-image', () => mediaMock)
vi.mock('@/lib/model-capabilities/lookup', () => ({
  resolveBuiltinCapabilitiesByModelKey: vi.fn(() => ({ video: { firstlastframe: true } })),
}))
vi.mock('@/lib/model-config-contract', () => ({
  parseModelKeyStrict: vi.fn((value: string) => {
    const [provider = 'fal', modelId = 'unknown-model'] = value.split('::')
    return { provider, modelId, modelKey: value }
  }),
}))
vi.mock('@/lib/api-config', () => ({
  getProviderConfig: vi.fn(async () => ({ apiKey: 'api-key' })),
}))
vi.mock('@/lib/config-service', () => configServiceMock)
vi.mock('@/lib/workers/user-concurrency-gate', () => concurrencyGateMock)
vi.mock('@/lib/workers/handlers/image-task-handler-shared', () => imageTaskSharedMock)

function buildPanel(overrides?: Partial<PanelRow>): PanelRow {
  return {
    id: 'panel-1',
    videoUrl: 'cos/base-video.mp4',
    videoCandidates: null,
    videoGenerationMode: 'normal',
    imageUrl: 'cos/panel-image.png',
    videoPrompt: 'panel prompt',
    description: 'panel description',
    characters: null,
    location: null,
    props: null,
    firstLastFramePrompt: null,
    duration: 5,
    updatedAt: new Date('2026-04-09T00:00:00.000Z'),
    ...(overrides || {}),
  }
}

function buildJob(params: {
  type: TaskJobData['type']
  payload?: Record<string, unknown>
  targetType?: string
  targetId?: string
}): Job<TaskJobData> {
  return {
    data: {
      taskId: 'task-1',
      type: params.type,
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      targetType: params.targetType ?? 'NovelPromotionPanel',
      targetId: params.targetId ?? 'panel-1',
      payload: params.payload ?? {},
      userId: 'user-1',
    },
  } as unknown as Job<TaskJobData>
}

describe('worker video processor behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    workerState.processor = null

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValue(buildPanel())
    prismaMock.novelPromotionPanel.findFirst.mockResolvedValue(buildPanel())
    prismaMock.novelPromotionVoiceLine.findUnique.mockResolvedValue({
      id: 'line-1',
      audioUrl: 'cos/line-1.mp3',
      audioDuration: 1200,
    })
    mediaMock.normalizeToBase64ForGeneration.mockImplementation(async (input: string) => input)

    const mod = await import('@/lib/workers/video.worker')
    mod.createVideoWorker()
  })

  it('fails explicitly when payload.videoModel is missing', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {},
    })

    await expect(processor!(job)).rejects.toThrow('VIDEO_MODEL_REQUIRED: payload.videoModel is required')
  })

  it('passes download headers through to COS upload for provider videos', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    utilsMock.resolveVideoSourceFromGeneration.mockResolvedValueOnce({
      url: 'https://provider.example/video.mp4',
      downloadHeaders: {
        Authorization: 'Bearer oa-key',
      },
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'openai-compatible:oa-1::sora-2',
        generationOptions: {
          duration: 8,
          resolution: '720p',
        },
      },
    })

    await processor!(job)

    expect(utilsMock.uploadVideoSourceToCos).toHaveBeenCalledWith(
      'https://provider.example/video.mp4',
      'panel-video',
      'panel-1',
      {
        Authorization: 'Bearer oa-key',
      },
    )
    expect(prismaMock.novelPromotionPanel.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'panel-1',
        updatedAt: new Date('2026-04-09T00:00:00.000Z'),
      },
      data: expect.objectContaining({
        videoUrl: 'cos/base-video.mp4',
        videoGenerationMode: 'normal',
      }),
    })
  })

  it('returns actual video tokens from the provider response', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    utilsMock.resolveVideoSourceFromGeneration.mockResolvedValueOnce({
      url: 'https://provider.example/video.mp4',
      actualVideoTokens: 108000,
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'ark::doubao-seedance-2-0-260128',
        generationOptions: {
          duration: 5,
          resolution: '720p',
        },
      },
    })

    const result = await processor!(job) as { panelId: string; videoUrl: string; actualVideoTokens: number }
    expect(result).toEqual({
      panelId: 'panel-1',
      videoUrl: 'cos/lip-sync/video.mp4',
      actualVideoTokens: 108000,
    })
  })

  it('collects selected character, location, and prop references for video generation', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default', slot: 'center' },
        ]),
        location: 'Safe House',
        props: 'Ancient Sword',
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Safe House',
          images: [
            {
              isSelected: true,
              description: 'industrial loft with rain-streaked windows',
              imageUrl: 'cos/location-reference.png',
            },
          ],
        },
      ],
      props: [
        {
          name: 'Ancient Sword',
          summary: 'weathered bronze blade',
          images: [
            {
              isSelected: true,
              description: 'weathered bronze blade with a leather-wrapped hilt',
              imageUrl: 'cos/prop-reference.png',
            },
          ],
        },
      ],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'fal::seedance/video',
        referenceSelection: {
          includeCharacters: true,
          includeLocation: true,
          includeProps: true,
        },
      },
    })

    await processor!(job)

    expect(utilsMock.resolveVideoSourceFromGeneration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        referenceImages: [
          'https://signed.example/cos/hero-reference.png',
          'https://signed.example/cos/location-reference.png',
          'https://signed.example/cos/prop-reference.png',
        ],
        options: expect.objectContaining({
          prompt: expect.stringContaining('Character references:'),
        }),
      }),
    )
    const generationCall = utilsMock.resolveVideoSourceFromGeneration.mock.calls.at(-1)?.[1] as {
      options?: { prompt?: string }
    } | undefined
    expect(generationCall?.options?.prompt).toContain('Location references:')
    expect(generationCall?.options?.prompt).toContain('Prop references:')
    expect(generationCall?.options?.prompt).toContain('black coat, calm expression')
    expect(generationCall?.options?.prompt).toContain('industrial loft with rain-streaked windows')
    expect(generationCall?.options?.prompt).toContain('weathered bronze blade with a leather-wrapped hilt')
  })

  it('uses only explicitly selected related assets when fine-grained references are provided', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default' },
          { name: 'Villain', appearance: 'armored' },
        ]),
        location: JSON.stringify(['Safe House', 'Rooftop']),
        props: JSON.stringify(['Ancient Sword', 'Gold Coin']),
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
        {
          name: 'Villain',
          appearances: [
            {
              changeReason: 'armored',
              descriptions: JSON.stringify(['silver armor, scar across left eye']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/villain-reference.png']),
              imageUrl: 'cos/villain-reference.png',
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Safe House',
          images: [
            {
              isSelected: true,
              description: 'industrial loft with rain-streaked windows',
              imageUrl: 'cos/location-safe-house.png',
            },
          ],
        },
        {
          name: 'Rooftop',
          images: [
            {
              isSelected: true,
              description: 'windy rooftop overlooking the city skyline',
              imageUrl: 'cos/location-rooftop.png',
            },
          ],
        },
      ],
      props: [
        {
          name: 'Ancient Sword',
          images: [
            {
              isSelected: true,
              description: 'weathered bronze blade with a leather-wrapped hilt',
              imageUrl: 'cos/prop-sword.png',
            },
          ],
        },
        {
          name: 'Gold Coin',
          images: [
            {
              isSelected: true,
              description: 'worn coin with a dragon emblem',
              imageUrl: 'cos/prop-coin.png',
            },
          ],
        },
      ],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'fal::seedance/video',
        referenceSelection: {
          includeCharacters: true,
          includeLocation: true,
          includeProps: true,
          characters: [{ name: 'Villain', appearance: 'armored' }],
          locations: ['Rooftop'],
          props: ['Gold Coin'],
        },
      },
    })

    await processor!(job)

    const generationCall = (utilsMock.resolveVideoSourceFromGeneration.mock.calls as Array<unknown[]>).at(-1)?.[1] as {
      referenceImages?: string[]
      options?: { prompt?: string }
    } | undefined

    expect(generationCall?.referenceImages).toEqual([
      'https://signed.example/cos/villain-reference.png',
      'https://signed.example/cos/location-rooftop.png',
      'https://signed.example/cos/prop-coin.png',
    ])
    expect(generationCall?.options?.prompt).toContain('silver armor, scar across left eye')
    expect(generationCall?.options?.prompt).toContain('windy rooftop overlooking the city skyline')
    expect(generationCall?.options?.prompt).toContain('worn coin with a dragon emblem')
    expect(generationCall?.options?.prompt).not.toContain('black coat, calm expression')
    expect(generationCall?.options?.prompt).not.toContain('industrial loft with rain-streaked windows')
    expect(generationCall?.options?.prompt).not.toContain('weathered bronze blade with a leather-wrapped hilt')
  })

  it('keeps official grok related-asset generation on panel-image input and moves extra refs into prompt constraints', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default', slot: 'center' },
        ]),
        location: 'Safe House',
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Safe House',
          images: [
            {
              isSelected: true,
              description: 'industrial loft with rain-streaked windows',
              imageUrl: 'cos/location-reference.png',
            },
          ],
        },
      ],
      props: [],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'grok::grok-imagine-video',
        referenceSelection: {
          includeCharacters: true,
          includeLocation: true,
        },
      },
    })

    await processor!(job)

    const generationCall = utilsMock.resolveVideoSourceFromGeneration.mock.calls.at(-1)?.[1] as
      | {
        imageUrl?: string
        referenceImages?: string[]
        options?: { prompt?: string; generationMode?: string }
      }
      | undefined

    expect(generationCall?.imageUrl).toBe('https://signed.example/cos/panel-image.png')
    expect(generationCall?.referenceImages).toBeUndefined()
    expect(generationCall?.options?.generationMode).toBe('normal')
    expect(generationCall?.options?.prompt).toContain('Character references:')
    expect(generationCall?.options?.prompt).toContain('Location references:')
  })

  it('appends generated videos to videoCandidates instead of overwriting the selected video', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        videoUrl: 'cos/base-video.mp4',
        videoCandidates: JSON.stringify([
          {
            id: 'existing',
            videoUrl: 'cos/base-video.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
        ]),
      }),
    )

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'fal::seedance/video',
      },
    })

    await processor!(job)

    expect(prismaMock.novelPromotionPanel.updateMany).toHaveBeenCalledTimes(1)
    const firstUpdateCall = prismaMock.novelPromotionPanel.updateMany.mock.calls.at(0) as [{
      data: {
        videoUrl: string | null
        videoGenerationMode: string | null
        videoCandidates: string | null
      }
    }] | undefined
    expect(firstUpdateCall).toBeDefined()
    const updateArgs = firstUpdateCall![0]
    expect(updateArgs.data.videoUrl).toBe('cos/base-video.mp4')
    expect(updateArgs.data.videoGenerationMode).toBe('normal')
    const serialized = updateArgs.data.videoCandidates as string
    const candidates = JSON.parse(serialized) as Array<{ videoUrl: string }>
    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.videoUrl)).toEqual([
      'cos/base-video.mp4',
      'cos/lip-sync/video.mp4',
    ])
  })

  it('submits edit-video generation from the selected source candidate and stores lineage metadata', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default' },
        ]),
        videoCandidates: JSON.stringify([
          {
            id: 'source',
            videoUrl: 'cos/base-video.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
        ]),
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
      ],
      locations: [],
      props: [],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'grok::grok-imagine-video',
        referenceSelection: {
          includeCharacters: true,
        },
        videoOperation: {
          mode: 'edit',
          sourceCandidateId: 'source',
          instruction: 'make the camera drift left',
        },
      },
    })

    await processor!(job)

    expect(utilsMock.resolveVideoSourceFromGeneration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        modelId: 'grok::grok-imagine-video',
        videoUrl: 'https://signed.example/cos/base-video.mp4',
        options: expect.objectContaining({
          prompt: expect.stringContaining('make the camera drift left'),
          generationMode: 'edit',
        }),
      }),
    )
    const generationCall = utilsMock.resolveVideoSourceFromGeneration.mock.calls.at(-1)?.[1] as {
      referenceImages?: string[]
      options?: { prompt?: string }
    } | undefined
    expect(generationCall?.referenceImages).toBeUndefined()
    expect(generationCall?.options?.prompt).toContain('Character references:')

    const updateArgs = (prismaMock.novelPromotionPanel.updateMany.mock.calls as Array<Array<{
      data?: {
        videoCandidates?: string | null
      }
    }>>).at(-1)?.[0]
    const candidates = JSON.parse(String(updateArgs?.data?.videoCandidates)) as Array<{
      generationMode: string
      meta?: {
        sourceCandidateId?: string | null
        sourceGenerationMode?: string | null
        referenceHandling?: string | null
        requestedReferenceImageCount?: number | null
        sentReferenceImageCount?: number | null
      }
    }>
    expect(candidates.at(-1)).toEqual(expect.objectContaining({
      generationMode: 'edit',
      meta: expect.objectContaining({
        sourceCandidateId: 'source',
        sourceGenerationMode: 'normal',
        referenceHandling: 'prompt_only_provider_constraint',
        requestedReferenceImageCount: 1,
        sentReferenceImageCount: 0,
      }),
    }))
  })

  it('rejects Grok edit requests when the source video exceeds the documented duration limit', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        duration: 5,
        videoCandidates: JSON.stringify([
          {
            id: 'base',
            videoUrl: 'cos/base-video.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
          {
            id: 'extended',
            videoUrl: 'cos/extended-video.mp4',
            generationMode: 'extend',
            createdAt: '2026-04-09T00:00:00.000Z',
            meta: {
              sourceCandidateId: 'base',
              sourceGenerationMode: 'normal',
              extendDuration: 4,
            },
          },
        ]),
      }),
    )

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'grok::grok-imagine-video',
        videoOperation: {
          mode: 'edit',
          sourceCandidateId: 'extended',
          instruction: 'tighten the motion',
        },
      },
    })

    await expect(processor!(job)).rejects.toThrow('GROK_VIDEO_EDIT_SOURCE_DURATION_UNSUPPORTED')
    expect(utilsMock.resolveVideoSourceFromGeneration).not.toHaveBeenCalled()
  })

  it('fails when the lip-sync panel is missing', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(null)
    const job = buildJob({
      type: TASK_TYPE.LIP_SYNC,
      payload: { voiceLineId: 'line-1' },
      targetId: 'panel-missing',
    })

    await expect(processor!(job)).rejects.toThrow('Lip-sync panel not found')
  })

  it('persists lip-sync video output and clears lipSyncTaskId', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.LIP_SYNC,
      payload: {
        voiceLineId: 'line-1',
        lipSyncModel: 'fal::lipsync-model',
      },
      targetId: 'panel-1',
    })

    const result = await processor!(job) as { panelId: string; voiceLineId: string; lipSyncVideoUrl: string }
    expect(result).toEqual({
      panelId: 'panel-1',
      voiceLineId: 'line-1',
      lipSyncVideoUrl: 'cos/lip-sync/video.mp4',
    })

    expect(utilsMock.resolveLipSyncVideoSource).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-1',
        modelKey: 'fal::lipsync-model',
        audioDurationMs: 1200,
        videoDurationMs: 5000,
      }),
    )

    expect(prismaMock.novelPromotionPanel.update).toHaveBeenCalledWith({
      where: { id: 'panel-1' },
      data: {
        lipSyncVideoUrl: 'cos/lip-sync/video.mp4',
        lipSyncTaskId: null,
      },
    })
  })

  it('throws for unsupported task types', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const unsupportedJob = buildJob({
      type: TASK_TYPE.AI_CREATE_CHARACTER,
    })

    await expect(processor!(unsupportedJob)).rejects.toThrow('Unsupported video task type')
  })

  it('keeps official grok normal generation in image-to-video mode even when references are selected', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default', slot: 'center' },
        ]),
        location: JSON.stringify(['Safe House']),
        props: JSON.stringify(['Ancient Sword']),
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Safe House',
          images: [
            {
              isSelected: true,
              description: 'industrial loft with rain-streaked windows',
              imageUrl: 'cos/location-reference.png',
            },
          ],
        },
      ],
      props: [
        {
          name: 'Ancient Sword',
          summary: 'weathered bronze blade',
          images: [
            {
              isSelected: true,
              description: 'weathered bronze blade with a leather-wrapped hilt',
              imageUrl: 'cos/prop-reference.png',
            },
          ],
        },
      ],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'grok::grok-imagine-video',
        referenceSelection: {
          includeCharacters: true,
          includeLocation: true,
          includeProps: true,
        },
      },
    })

    await processor!(job)

    const generationCall = utilsMock.resolveVideoSourceFromGeneration.mock.calls.at(-1)?.[1] as
      | {
        imageUrl?: string
        referenceImages?: string[]
        options?: { prompt?: string; aspectRatio?: string; generationMode?: string }
      }
      | undefined
    expect(generationCall?.imageUrl).toBe('https://signed.example/cos/panel-image.png')
    expect(generationCall?.referenceImages).toBeUndefined()
    expect(generationCall?.options?.prompt).toContain('Reference consistency constraints:')
    expect(generationCall?.options?.aspectRatio).toBe('16:9')
    expect(generationCall?.options?.generationMode).toBe('normal')

    const latestUpdateCall = prismaMock.novelPromotionPanel.updateMany.mock.calls.at(-1) as Array<{
      data?: {
        videoCandidates?: string | null
      }
    }> | undefined
    const persistedPayload = latestUpdateCall?.[0]?.data
    const parsedCandidates = persistedPayload?.videoCandidates ? JSON.parse(persistedPayload.videoCandidates) : []
    const latestCandidate = parsedCandidates.at(-1)
    expect(latestCandidate?.meta).toEqual(expect.objectContaining({
      referenceHandling: 'prompt_only_provider_constraint',
      requestedReferenceImageCount: 3,
      sentReferenceImageCount: 0,
    }))
  })

  it('keeps grok2api normal generation in single-input image-to-video mode even when references are selected', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default', slot: 'center' },
        ]),
        location: JSON.stringify(['Safe House']),
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/hero-reference.png']),
              imageUrl: 'cos/hero-reference.png',
            },
          ],
        },
      ],
      locations: [
        {
          name: 'Safe House',
          images: [
            {
              isSelected: true,
              description: 'industrial loft with rain-streaked windows',
              imageUrl: 'cos/location-reference.png',
            },
          ],
        },
      ],
      props: [],
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'openai-compatible:oa-1::grok-imagine-video',
        referenceSelection: {
          includeCharacters: true,
          includeLocation: true,
        },
      },
    })

    await processor!(job)

    const generationCall = utilsMock.resolveVideoSourceFromGeneration.mock.calls.at(-1)?.[1] as
      | {
        imageUrl?: string
        referenceImages?: string[]
        options?: { prompt?: string; aspectRatio?: string; generationMode?: string }
      }
      | undefined
    expect(generationCall?.imageUrl).toBe('https://signed.example/cos/panel-image.png')
    expect(generationCall?.referenceImages).toBeUndefined()
    expect(generationCall?.options?.prompt).toContain('Reference consistency constraints:')
    expect(generationCall?.options?.aspectRatio).toBe('16:9')
    expect(generationCall?.options?.generationMode).toBe('normal')

    const latestUpdateCall = prismaMock.novelPromotionPanel.updateMany.mock.calls.at(-1) as Array<{
      data?: {
        videoCandidates?: string | null
      }
    }> | undefined
    const persistedPayload = latestUpdateCall?.[0]?.data
    const parsedCandidates = persistedPayload?.videoCandidates ? JSON.parse(persistedPayload.videoCandidates) : []
    const latestCandidate = parsedCandidates.at(-1)
    expect(latestCandidate?.meta).toEqual(expect.objectContaining({
      referenceHandling: 'prompt_only_provider_single_input',
      requestedReferenceImageCount: 2,
      sentReferenceImageCount: 0,
    }))
  })

  it('rejects grok2api video edit requests with an explicit provider capability error', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'openai-compatible:oa-1::grok-imagine-video',
        videoOperation: {
          mode: 'edit',
          sourceCandidateId: 'source',
          instruction: 'make the camera drift left',
        },
      },
    })

    await expect(processor!(job)).rejects.toThrow('GROK2API_VIDEO_OPERATION_UNSUPPORTED: edit')
    expect(utilsMock.resolveVideoSourceFromGeneration).not.toHaveBeenCalled()
  })

  it('tracks failed reference normalization counts in candidate metadata', async () => {
    const processor = workerState.processor
    expect(processor).toBeTruthy()

    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce(
      buildPanel({
        characters: JSON.stringify([
          { name: 'Hero', appearance: 'default', slot: 'center' },
        ]),
      }),
    )
    imageTaskSharedMock.resolveNovelData.mockResolvedValueOnce({
      characters: [
        {
          name: 'Hero',
          appearances: [
            {
              changeReason: 'default',
              descriptions: JSON.stringify(['black coat, calm expression']),
              selectedIndex: 0,
              description: null,
              imageUrls: JSON.stringify(['cos/bad-reference.png']),
              imageUrl: 'cos/bad-reference.png',
            },
          ],
        },
      ],
      locations: [],
      props: [],
    })
    mediaMock.normalizeToBase64ForGeneration.mockImplementation(async (input: string) => {
      if (input === 'https://signed.example/cos/bad-reference.png') {
        throw new Error('normalize failed')
      }
      return input
    })

    const job = buildJob({
      type: TASK_TYPE.VIDEO_PANEL,
      payload: {
        videoModel: 'grok::grok-imagine-video',
        referenceSelection: {
          includeCharacters: true,
        },
      },
    })

    await processor!(job)

    const latestUpdateCall = prismaMock.novelPromotionPanel.updateMany.mock.calls.at(-1) as Array<{
      data?: {
        videoCandidates?: string | null
      }
    }> | undefined
    const persistedPayload = latestUpdateCall?.[0]?.data
    const parsedCandidates = persistedPayload?.videoCandidates ? JSON.parse(persistedPayload.videoCandidates) : []
    const latestCandidate = parsedCandidates.at(-1)
    expect(latestCandidate?.meta).toEqual(expect.objectContaining({
      referenceHandling: 'prompt_only_reference_unavailable',
      requestedReferenceImageCount: 1,
      sentReferenceImageCount: 0,
      failedReferenceImageCount: 1,
    }))
  })
})
