import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { buildPromptAssetContext } from '@/lib/assets/services/asset-prompt-context'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import type { TaskJobData } from '@/lib/task/types'
import { resolveAnalysisModel } from './shot-ai-persist'
import { runShotPromptCompletion } from './shot-ai-prompt-runtime'
import { parsePanelCharacterReferences, parseJsonStringArray, parseNamedReferenceList } from './image-task-handler-shared'
import { parseJsonObject, readRequiredString, readText, type AnyObj } from './shot-ai-prompt-utils'

const PANEL_PROMPT_CONTEXT_SELECT = {
  id: true,
  panelIndex: true,
  shotType: true,
  cameraMove: true,
  description: true,
  location: true,
  characters: true,
  props: true,
  srtSegment: true,
  duration: true,
  imagePrompt: true,
  videoPrompt: true,
  storyboard: {
    select: {
      clip: {
        select: {
          content: true,
          summary: true,
        },
      },
      episode: {
        select: {
          novelPromotionProject: {
            select: {
              projectId: true,
            },
          },
        },
      },
    },
  },
} as const

function readAssetKind(value: Record<string, unknown>): 'location' | 'prop' {
  return value.assetKind === 'prop' ? 'prop' : 'location'
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function normalizeSingleLine(value: string) {
  return value
    .replace(/\[开始输出\]|\[输出完成\]/g, ' ')
    .replace(/^```(?:json|text|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractGeneratedVideoPrompt(responseText: string) {
  const cleaned = responseText.trim()
  try {
    const parsed = parseJsonObject(cleaned)
    if (typeof parsed.video_prompt === 'string' && parsed.video_prompt.trim()) {
      return normalizeSingleLine(parsed.video_prompt)
    }
    if (typeof parsed.videoPrompt === 'string' && parsed.videoPrompt.trim()) {
      return normalizeSingleLine(parsed.videoPrompt)
    }
    if (typeof parsed.prompt === 'string' && parsed.prompt.trim()) {
      return normalizeSingleLine(parsed.prompt)
    }
  } catch {
    // fall back to raw text
  }
  return normalizeSingleLine(cleaned)
}

function formatDurationSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '3'
  const normalized = Number(value.toFixed(2))
  return Number.isInteger(normalized) ? String(normalized) : String(normalized)
}

function formatPresetList(values: string[]) {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
  return unique.length > 0 ? unique.map((value) => `@${value}`).join('、') : '无'
}

function formatSinglePreset(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized ? `@${normalized}` : '无'
}

function mergeCharacterPresetDetails(
  ...groups: Array<Array<{ name: string; appearance?: string; slot?: string }>>
) {
  const merged = new Map<string, { name: string; appearance?: string; slot?: string }>()
  for (const group of groups) {
    for (const item of group) {
      const key = normalizeName(item.name)
      if (!key || merged.has(key)) continue
      merged.set(key, item)
    }
  }
  return Array.from(merged.values())
}

function mergeStringPresets(...groups: string[][]) {
  const merged = new Map<string, string>()
  for (const group of groups) {
    for (const item of group) {
      const normalized = item.trim()
      const key = normalizeName(normalized)
      if (!key || merged.has(key)) continue
      merged.set(key, normalized)
    }
  }
  return Array.from(merged.values())
}

function formatCharacterPresetDetails(
  values: Array<{ name: string; appearance?: string; slot?: string }>,
) {
  if (values.length === 0) return '无'
  return values
    .map((item) => {
      const parts = [`@${item.name}`]
      if (item.appearance) parts.push(`形象：${item.appearance}`)
      if (item.slot) parts.push(`固定位置：${item.slot}`)
      return parts.join('，')
    })
    .join('\n')
}

function formatBlock(title: string, content: string) {
  const normalized = content.trim() || '无'
  return `${title}\n${normalized}`
}

function describeLocationAssets(
  locations: Array<{
    name: string
    images?: Array<{
      isSelected?: boolean
      description?: string | null
    }>
  }>,
  locationNames: string[],
) {
  const uniqueNames = mergeStringPresets(locationNames)
  if (uniqueNames.length === 0) return '无'

  return uniqueNames.map((name) => {
    const matched = locations.find((location) => normalizeName(location.name) === normalizeName(name))
    const selectedImage = matched?.images?.find((image) => image.isSelected) ?? matched?.images?.[0]
    const description = selectedImage?.description?.trim() || '无描述'
    return `【@${name}】${description}`
  }).join('\n')
}

function describePropAssets(
  props: Array<{
    name: string
    summary?: string | null
  }>,
  propNames: string[],
) {
  const uniqueNames = mergeStringPresets(propNames)
  if (uniqueNames.length === 0) return '无'

  return uniqueNames.map((name) => {
    const matched = props.find((prop) => normalizeName(prop.name) === normalizeName(name))
    const summary = matched?.summary?.trim() || '无描述'
    return `【@${name}】${summary}`
  }).join('\n')
}

function formatDialogueLines(
  lines: Array<{
    speaker: string
    content: string
  }>,
) {
  if (lines.length === 0) return 'None'
  return lines
    .map((line) => {
      const speaker = line.speaker.trim() || 'Unknown'
      const content = line.content.trim()
      return content ? `- ${speaker}: "${content}"` : ''
    })
    .filter(Boolean)
    .join('\n') || 'None'
}

export async function handleGeneratePanelVideoPromptTask(job: Job<TaskJobData>, payload: AnyObj) {
  const panelId = readRequiredString(payload.panelId, 'panelId')
  const lastPanelId = readText(payload.lastPanelId).trim()
  const userRequirement = readRequiredString(
    typeof payload.userInstruction === 'string' ? payload.userInstruction : payload.modifyInstruction,
    'modifyInstruction',
  )

  const [novelData, projectData, panel, nextPanel] = await Promise.all([
    resolveAnalysisModel(job.data.projectId, job.data.userId),
    prisma.novelPromotionProject.findUnique({
      where: { projectId: job.data.projectId },
      include: {
        characters: {
          include: {
            appearances: {
              orderBy: { appearanceIndex: 'asc' },
              select: {
                changeReason: true,
                descriptions: true,
                selectedIndex: true,
                description: true,
              },
            },
          },
        },
        locations: {
          include: {
            images: {
              orderBy: { imageIndex: 'asc' },
              select: {
                isSelected: true,
                description: true,
                availableSlots: true,
              },
            },
          },
        },
      },
    }),
    prisma.novelPromotionPanel.findUnique({
      where: { id: panelId },
      select: PANEL_PROMPT_CONTEXT_SELECT,
    }),
    lastPanelId
      ? prisma.novelPromotionPanel.findUnique({
        where: { id: lastPanelId },
        select: PANEL_PROMPT_CONTEXT_SELECT,
      })
      : Promise.resolve(null),
  ])

  if (!projectData) {
    throw new Error('Novel promotion project not found')
  }
  if (!panel || panel.storyboard.episode.novelPromotionProject?.projectId !== job.data.projectId) {
    throw new Error('Panel not found')
  }
  if (nextPanel && nextPanel.storyboard.episode.novelPromotionProject?.projectId !== job.data.projectId) {
    throw new Error('Last panel not found')
  }

  const matchedVoiceLines = await prisma.novelPromotionVoiceLine.findMany({
    where: {
      matchedPanelId: {
        in: nextPanel ? [panel.id, nextPanel.id] : [panel.id],
      },
    },
    select: {
      matchedPanelId: true,
      lineIndex: true,
      speaker: true,
      content: true,
    },
    orderBy: { lineIndex: 'asc' },
  })
  const panelDialogueLines = matchedVoiceLines.filter((line) => line.matchedPanelId === panel.id)
  const nextPanelDialogueLines = nextPanel
    ? matchedVoiceLines.filter((line) => line.matchedPanelId === nextPanel.id)
    : []

  const panelCharacters = parsePanelCharacterReferences(panel.characters)
  const panelProps = parseJsonStringArray(panel.props)
  const panelLocations = parseNamedReferenceList(panel.location)
  const panelLocation = panelLocations[0] || ''
  const nextPanelCharacters = nextPanel ? parsePanelCharacterReferences(nextPanel.characters) : []
  const nextPanelProps = nextPanel ? parseJsonStringArray(nextPanel.props) : []
  const nextPanelLocations = nextPanel ? parseNamedReferenceList(nextPanel.location) : []
  const nextPanelLocation = nextPanelLocations[0] || ''
  const mergedCharacters = mergeCharacterPresetDetails(panelCharacters, nextPanelCharacters)
  const mergedProps = mergeStringPresets(panelProps, nextPanelProps)
  const mergedLocations = mergeStringPresets(panelLocations, nextPanelLocations)
  const promptMode = nextPanel ? 'firstlastframe_transition' : 'single_panel'
  const locationAssets = (projectData.locations || [])
    .filter((item) => readAssetKind(item as unknown as Record<string, unknown>) !== 'prop')
    .map((item) => ({
      name: item.name,
      images: item.images,
    }))
  const propAssets = (projectData.locations || [])
    .filter((item) => readAssetKind(item as unknown as Record<string, unknown>) === 'prop')
    .map((item) => ({
      name: item.name,
      summary: item.summary,
    }))
  const assetContext = buildPromptAssetContext({
    characters: (projectData.characters || []).map((item) => ({
      name: item.name,
      introduction: item.introduction,
      appearances: item.appearances,
    })),
    locations: locationAssets,
    props: propAssets,
    clipCharacters: mergedCharacters,
    clipLocation: mergedLocations[0] || null,
    clipProps: mergedProps,
    locale: job.data.locale,
  })

  const finalPrompt = buildPrompt({
    promptId: PROMPT_IDS.NP_VIDEO_PROMPT_GENERATE,
    locale: job.data.locale,
    variables: {
      prompt_mode: promptMode,
      full_story_text:
        panel.storyboard.clip?.content?.trim()
        || panel.storyboard.clip?.summary?.trim()
        || panel.srtSegment?.trim()
        || panel.description?.trim()
        || '无',
      panel_story_text:
        [panel.srtSegment, panel.description]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
          .join('\n')
        || '无',
      image_prompt_input:
        readText(payload.currentPrompt).trim()
        || panel.imagePrompt?.trim()
        || '无',
      current_video_prompt:
        readText(payload.currentVideoPrompt).trim()
        || panel.videoPrompt?.trim()
        || '无',
      duration_seconds: formatDurationSeconds(panel.duration),
      panel_shot_type: panel.shotType?.trim() || '未提供',
      panel_camera_move: panel.cameraMove?.trim() || '未提供',
      panel_characters: formatCharacterPresetDetails(panelCharacters),
      panel_location: formatPresetList(panelLocations),
      panel_props: formatPresetList(panelProps),
      panel_dialogue_lines: formatDialogueLines(panelDialogueLines),
      next_panel_story_text:
        nextPanel
          ? [nextPanel.srtSegment, nextPanel.description]
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
            .join('\n') || '无'
          : '无',
      next_image_prompt_input: nextPanel?.imagePrompt?.trim() || '无',
      next_panel_shot_type: nextPanel?.shotType?.trim() || '无',
      next_panel_camera_move: nextPanel?.cameraMove?.trim() || '无',
      next_panel_characters: formatCharacterPresetDetails(nextPanelCharacters),
      next_panel_location: formatPresetList(nextPanelLocations),
      next_panel_props: formatPresetList(nextPanelProps),
      next_panel_dialogue_lines: formatDialogueLines(nextPanelDialogueLines),
      characters_description: [
        formatBlock('镜头人物预设：', formatPresetList(mergedCharacters.map((item) => item.name))),
        formatBlock('角色描述参考：', assetContext.fullDescriptionText),
        formatBlock('角色关系参考：', assetContext.charactersIntroductionText),
      ].join('\n\n'),
      location_description: [
        formatBlock('镜头场景预设：', formatPresetList(mergedLocations)),
        formatBlock('场景描述参考：', describeLocationAssets(locationAssets, mergedLocations)),
      ].join('\n\n'),
      props_description: [
        formatBlock('镜头物品预设：', formatPresetList(mergedProps)),
        formatBlock('物品描述参考：', describePropAssets(propAssets, mergedProps)),
      ].join('\n\n'),
      user_requirement: userRequirement,
    },
  })

  await reportTaskProgress(job, 20, {
    stage: 'ai_generate_video_prompt_prepare',
    stageLabel: '准备视频提示词生成',
    displayMode: 'detail',
  })
  await assertTaskActive(job, 'ai_generate_video_prompt_prepare')

  const responseText = await runShotPromptCompletion({
    job,
    model: novelData.analysisModel,
    prompt: finalPrompt,
    action: 'ai_generate_video_prompt',
    streamContextKey: 'ai_generate_video_prompt',
    streamStepId: 'ai_generate_video_prompt',
    streamStepTitle: '生成视频提示词',
  })
  await assertTaskActive(job, 'ai_generate_video_prompt_parse')

  const generatedVideoPrompt = extractGeneratedVideoPrompt(responseText)
  if (!generatedVideoPrompt) {
    throw new Error('Invalid video prompt response')
  }

  await reportTaskProgress(job, 96, {
    stage: 'ai_generate_video_prompt_done',
    stageLabel: '视频提示词生成完成',
    displayMode: 'detail',
  })

  return {
    success: true,
    generatedVideoPrompt,
  }
}
