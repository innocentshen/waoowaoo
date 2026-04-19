import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'

const persistMock = vi.hoisted(() => ({
  resolveAnalysisModel: vi.fn(),
}))

const runtimeMock = vi.hoisted(() => ({
  runShotPromptCompletion: vi.fn(),
  reportTaskProgress: vi.fn(async () => undefined),
  assertTaskActive: vi.fn(async () => undefined),
}))

const promptMock = vi.hoisted(() => ({
  buildPrompt: vi.fn(() => 'video-final-prompt'),
  PROMPT_IDS: {
    NP_VIDEO_PROMPT_GENERATE: 'np_video_prompt_generate',
  },
}))

const assetContextMock = vi.hoisted(() => ({
  buildPromptAssetContext: vi.fn(() => ({
    fullDescriptionText: 'character details',
    charactersIntroductionText: 'relationship details',
    locationDescriptionText: 'location details',
    propsDescriptionText: 'props details',
  })),
}))

const panelSharedMock = vi.hoisted(() => ({
  parsePanelCharacterReferences: vi.fn(() => [
    { name: 'Hero', appearance: 'steady stance', slot: 'center' },
  ]),
  parseJsonStringArray: vi.fn(() => ['Countdown Phone']),
  parseNamedReferenceList: vi.fn((value: string | null | undefined) => {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
  novelPromotionPanel: {
    findUnique: vi.fn(),
  },
  novelPromotionVoiceLine: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/workers/handlers/shot-ai-persist', () => persistMock)
vi.mock('@/lib/workers/handlers/shot-ai-prompt-runtime', () => ({
  runShotPromptCompletion: runtimeMock.runShotPromptCompletion,
}))
vi.mock('@/lib/workers/shared', () => ({
  reportTaskProgress: runtimeMock.reportTaskProgress,
}))
vi.mock('@/lib/workers/utils', () => ({
  assertTaskActive: runtimeMock.assertTaskActive,
}))
vi.mock('@/lib/prompt-i18n', () => promptMock)
vi.mock('@/lib/assets/services/asset-prompt-context', () => assetContextMock)
vi.mock('@/lib/workers/handlers/image-task-handler-shared', () => panelSharedMock)
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { handleGeneratePanelVideoPromptTask } from '@/lib/workers/handlers/shot-ai-video-prompt'

function buildJob(payload: Record<string, unknown>): Job<TaskJobData> {
  return {
    data: {
      taskId: 'task-video-prompt-1',
      type: TASK_TYPE.AI_MODIFY_SHOT_PROMPT,
      locale: 'zh',
      projectId: 'project-1',
      episodeId: 'episode-1',
      targetType: 'NovelPromotionPanel',
      targetId: 'panel-1',
      payload,
      userId: 'user-1',
    },
  } as unknown as Job<TaskJobData>
}

describe('worker shot-ai-video-prompt behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    persistMock.resolveAnalysisModel.mockResolvedValue({ analysisModel: 'llm::analysis' })
    runtimeMock.runShotPromptCompletion.mockResolvedValue('[开始输出]\n(第0秒到1秒) @Hero拿起@Countdown Phone\n[输出完成]')
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({
      characters: [{ name: 'Hero', introduction: 'hero intro', appearances: [] }],
      locations: [{ name: 'Safe House', summary: 'hideout', images: [] }],
    })
    prismaMock.novelPromotionVoiceLine.findMany.mockResolvedValue([
      {
        matchedPanelId: 'panel-1',
        lineIndex: 1,
        speaker: 'Hero',
        content: 'We only have ten seconds.',
      },
    ])
    prismaMock.novelPromotionPanel.findUnique.mockResolvedValue({
      id: 'panel-1',
      panelIndex: 0,
      shotType: 'medium',
      cameraMove: 'push',
      description: 'A tense beat before action.',
      location: 'Safe House',
      characters: '[]',
      props: '[]',
      srtSegment: 'He checks the countdown.',
      duration: 4,
      imagePrompt: '@Hero holding @Countdown Phone',
      videoPrompt: 'old video prompt',
      storyboard: {
        clip: {
          content: 'Full story text',
          summary: 'Clip summary',
        },
        episode: {
          novelPromotionProject: {
            projectId: 'project-1',
          },
        },
      },
    })
  })

  it('missing panelId -> explicit error', async () => {
    const payload = { modifyInstruction: 'make the timing clearer' }
    const job = buildJob(payload)

    await expect(handleGeneratePanelVideoPromptTask(job, payload)).rejects.toThrow('panelId is required')
  })

  it('success -> returns single-line video prompt and uses dedicated action', async () => {
    const payload = {
      panelId: 'panel-1',
      currentPrompt: '@Hero still image prompt',
      currentVideoPrompt: 'old video prompt',
      modifyInstruction: 'make the timing clearer',
      mode: 'videoPrompt',
    }
    const job = buildJob(payload)

    const result = await handleGeneratePanelVideoPromptTask(job, payload)

    expect(promptMock.buildPrompt).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'np_video_prompt_generate',
      locale: 'zh',
      variables: expect.objectContaining({
        prompt_mode: 'single_panel',
        current_video_prompt: 'old video prompt',
        duration_seconds: '4',
        panel_dialogue_lines: '- Hero: \"We only have ten seconds.\"',
        next_panel_story_text: '无',
        next_panel_dialogue_lines: 'None',
        user_requirement: 'make the timing clearer',
      }),
    }))
    expect(runtimeMock.runShotPromptCompletion).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ai_generate_video_prompt',
      prompt: 'video-final-prompt',
    }))
    expect(result).toEqual({
      success: true,
      generatedVideoPrompt: '(第0秒到1秒) @Hero拿起@Countdown Phone',
    })
  })

  it('first-last-frame mode -> includes next panel context', async () => {
    panelSharedMock.parsePanelCharacterReferences
      .mockReturnValueOnce([{ name: 'Hero', appearance: 'steady stance', slot: 'center' }])
      .mockReturnValueOnce([{ name: 'Guard', appearance: 'blocking stance', slot: 'right' }])
    panelSharedMock.parseJsonStringArray
      .mockReturnValueOnce(['Countdown Phone'])
      .mockReturnValueOnce(['Metal Door'])

    prismaMock.novelPromotionPanel.findUnique
      .mockResolvedValueOnce({
        id: 'panel-1',
        panelIndex: 0,
        shotType: 'medium',
        cameraMove: 'push',
        description: 'A tense beat before action.',
        location: 'Safe House',
        characters: '[]',
        props: '[]',
        srtSegment: 'He checks the countdown.',
        duration: 4,
        imagePrompt: '@Hero holding @Countdown Phone',
        videoPrompt: 'old video prompt',
        storyboard: {
          clip: {
            content: 'Full story text',
            summary: 'Clip summary',
          },
          episode: {
            novelPromotionProject: {
              projectId: 'project-1',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'panel-2',
        panelIndex: 1,
        shotType: 'close',
        cameraMove: 'track',
        description: 'The guard blocks the exit.',
        location: 'Exit Corridor',
        characters: '[]',
        props: '[]',
        srtSegment: 'A guard steps into frame.',
        duration: 4,
        imagePrompt: '@Guard near @Metal Door',
        videoPrompt: 'next panel prompt',
        storyboard: {
          clip: {
            content: 'Full story text',
            summary: 'Clip summary',
          },
          episode: {
            novelPromotionProject: {
              projectId: 'project-1',
            },
          },
        },
      })

    prismaMock.novelPromotionProject.findUnique.mockResolvedValueOnce({
      characters: [
        { name: 'Hero', introduction: 'hero intro', appearances: [] },
        { name: 'Guard', introduction: 'guard intro', appearances: [] },
      ],
      locations: [
        { name: 'Safe House', summary: 'hideout', images: [{ isSelected: true, description: 'hideout room' }] },
        { name: 'Exit Corridor', summary: 'hallway', images: [{ isSelected: true, description: 'tight corridor' }] },
        { name: 'Countdown Phone', summary: 'phone', assetKind: 'prop' },
        { name: 'Metal Door', summary: 'door', assetKind: 'prop' },
      ],
    })
    prismaMock.novelPromotionVoiceLine.findMany.mockResolvedValueOnce([
      {
        matchedPanelId: 'panel-1',
        lineIndex: 1,
        speaker: 'Hero',
        content: 'Hold the door.',
      },
      {
        matchedPanelId: 'panel-2',
        lineIndex: 2,
        speaker: 'Guard',
        content: 'You are not leaving.',
      },
    ])

    const payload = {
      panelId: 'panel-1',
      lastPanelId: 'panel-2',
      currentPrompt: '@Hero still image prompt',
      currentVideoPrompt: 'bridge these two panels',
      modifyInstruction: 'make the bridge motion more obvious',
      mode: 'videoPrompt',
    }
    const job = buildJob(payload)

    await handleGeneratePanelVideoPromptTask(job, payload)

    expect(promptMock.buildPrompt).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        prompt_mode: 'firstlastframe_transition',
        panel_dialogue_lines: '- Hero: \"Hold the door.\"',
        next_panel_story_text: 'A guard steps into frame.\nThe guard blocks the exit.',
        next_panel_shot_type: 'close',
        next_panel_location: '@Exit Corridor',
        next_panel_props: '@Metal Door',
        next_panel_dialogue_lines: '- Guard: \"You are not leaving.\"',
      }),
    }))
  })

  it('parses structured location lists before building asset context', async () => {
    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce({
      id: 'panel-1',
      panelIndex: 0,
      shotType: 'medium',
      cameraMove: 'push',
      description: 'A tense beat before action.',
      location: JSON.stringify(['Safe House', 'Back Alley']),
      characters: '[]',
      props: '[]',
      srtSegment: 'He checks the countdown.',
      duration: 4,
      imagePrompt: '@Hero holding @Countdown Phone',
      videoPrompt: 'old video prompt',
      storyboard: {
        clip: {
          content: 'Full story text',
          summary: 'Clip summary',
        },
        episode: {
          novelPromotionProject: {
            projectId: 'project-1',
          },
        },
      },
    })

    const payload = {
      panelId: 'panel-1',
      currentPrompt: '@Hero still image prompt',
      currentVideoPrompt: 'old video prompt',
      modifyInstruction: 'make the timing clearer',
      mode: 'videoPrompt',
    }
    const job = buildJob(payload)

    await handleGeneratePanelVideoPromptTask(job, payload)

    expect(assetContextMock.buildPromptAssetContext).toHaveBeenCalledWith(expect.objectContaining({
      clipLocation: 'Safe House',
    }))
    expect(promptMock.buildPrompt).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        panel_location: '@Safe House、@Back Alley',
      }),
    }))
  })
})
