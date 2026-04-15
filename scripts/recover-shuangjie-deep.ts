import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROJECT_ID = '411508ef-8469-4fa8-ac3b-7b1da1b9a3ab'
const PROJECT_NAME = '双界猎场'
const USER_ID = '29966099-3970-454d-88f3-45fab89bac65'

const STEP_TIMESTAMPS = {
  analyzeLocationsPrompt: '2026-04-13T15:44:53.679+08:00',
  analyzePropsOutput: '2026-04-13T15:45:42.456+08:00',
  analyzeLocationsOutput: '2026-04-13T15:46:14.551+08:00',
  analyzeCharactersOutput: '2026-04-13T15:49:34.783+08:00',
  splitClipsOutput: '2026-04-13T15:53:41.882+08:00',
  screenplay: {
    screenplay_clip_1: '2026-04-13T16:03:11.461+08:00',
    screenplay_clip_2: '2026-04-13T15:58:35.049+08:00',
    screenplay_clip_3: '2026-04-13T15:58:03.500+08:00',
  },
  phase3: {
    'clip_c5a5fc33-33e7-47cd-ad6f-302903a67c88_phase3_detail': '2026-04-13T16:53:28.429+08:00',
    'clip_becaa212-0473-4888-adbc-a6ca9367e543_phase3_detail': '2026-04-13T16:59:41.328+08:00',
    'clip_d0342bc4-bf95-4490-8e27-600189db1280_phase3_detail': '2026-04-13T16:58:48.225+08:00',
  },
  voiceAnalyzeOutput: '2026-04-13T17:02:02.206+08:00',
} as const

const CLIP_RECOVERY_ORDER = [
  {
    screenplayStepId: 'screenplay_clip_1',
    clipId: 'c5a5fc33-33e7-47cd-ad6f-302903a67c88',
    phase3StepId: 'clip_c5a5fc33-33e7-47cd-ad6f-302903a67c88_phase3_detail',
  },
  {
    screenplayStepId: 'screenplay_clip_2',
    clipId: 'becaa212-0473-4888-adbc-a6ca9367e543',
    phase3StepId: 'clip_becaa212-0473-4888-adbc-a6ca9367e543_phase3_detail',
  },
  {
    screenplayStepId: 'screenplay_clip_3',
    clipId: 'd0342bc4-bf95-4490-8e27-600189db1280',
    phase3StepId: 'clip_d0342bc4-bf95-4490-8e27-600189db1280_phase3_detail',
  },
] as const

const LOCATION_FALLBACKS: Record<string, { summary: string; description: string }> = {
  '公司会议室_异变状态': {
    summary: '赵启明首次异化爆发的公司会议室，冷白灯直照，会议桌周围弥漫灾变前夕的压迫感。',
    description: '「公司会议室_异变状态」公司会议室内冷白灯自上而下照在长桌与散乱座椅上，桌面残留会议痕迹，空气里带着异变爆发前的凝滞与压迫感。',
  },
  '公司技术部_异变状态': {
    summary: '员工与工位一同异化的公司技术部，桌面鼓起血肉，屏幕持续滚动陆沉的底层代码与实时生物数据。',
    description: '「公司技术部_异变状态」技术部通道向深处延伸，两侧办公桌表面鼓起血肉，屏幕冷光闪烁，整层楼像仍在运转的失控实验现场。',
  },
  '核心实验室_异变状态': {
    summary: '走廊尽头一地狼藉的核心实验室，通风管、百叶窗与出口构成封闭压迫的最终对峙空间。',
    description: '「核心实验室_异变状态」实验柜残骸与碎玻璃铺满地面，头顶通风管横贯上方，右侧百叶窗半开，出口被黑暗与异化气息笼罩。',
  },
}

const PROP_SEED = {
  name: '发光手环',
  summary: '银灰色金属手环，能够识别07号身份，启动时会从幽蓝转为猩红并投射全息提示。',
  description: '「发光手环」银灰色金属手环静卧在碎玻璃中，表面带着冷硬机械纹理，启动时会由幽蓝光芒切换为刺眼猩红。',
}

type JsonRecord = Record<string, unknown>

type LogEntry = {
  ts: string
  action?: string
  projectId?: string
  userId?: string
  details?: JsonRecord
}

type CharacterRecovery = {
  name: string
  introduction: string | null
  aliases: string[]
}

type SplitClip = {
  start: string
  end: string
  summary: string
  location: string | null
  characters: string[]
  props: string[]
}

type ScreenplayScene = {
  scene_number?: number
  heading?: JsonRecord
  description?: string
  characters?: string[]
  content?: JsonRecord[]
}

type ScreenplayOutput = {
  clip_id?: string
  original_text?: string
  scenes?: ScreenplayScene[]
}

type Phase3CharacterRef = {
  name?: string
  appearance?: string
}

type Phase3Panel = {
  panel_number?: number
  shot_type?: string
  camera_move?: string
  description?: string
  video_prompt?: string
  characters?: Phase3CharacterRef[]
  location?: string
  props?: string[]
  scene_type?: string
  source_text?: string
}

type VoiceLineOutput = {
  lineIndex?: number
  speaker?: string
  content?: string
  emotionStrength?: number
  matchedPanel?: {
    storyboardId?: string
    panelIndex?: number
  }
}

type LocationSeed = {
  name: string
  summary: string
  description: string
  assetKind: 'location' | 'prop'
}

type ClipRecovery = {
  clipId: string
  startText: string
  endText: string
  summary: string
  location: string | null
  characters: string[]
  props: string[]
  screenplay: ScreenplayOutput
  panels: Phase3Panel[]
}

type RecoveryPayload = {
  novelText: string
  characters: CharacterRecovery[]
  propsFromAnalysis: string[]
  locationsFromAnalysis: string[]
  locations: LocationSeed[]
  clips: ClipRecovery[]
  voiceLines: VoiceLineOutput[]
}

function readProjectLogs(): LogEntry[] {
  const logPath = join(process.cwd(), 'logs', 'app.log')
  const content = readFileSync(logPath, 'utf8')
  const lines = content.split(/\r?\n/).filter(Boolean)
  const rows: LogEntry[] = []

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as LogEntry
      if (parsed.projectId !== PROJECT_ID) continue
      rows.push(parsed)
    } catch {
      // Ignore malformed log lines.
    }
  }

  return rows
}

function findLogEntry(entries: LogEntry[], ts: string, action: string): LogEntry {
  const entry = entries.find((item) => item.ts === ts && item.action === action)
  if (!entry) {
    throw new Error(`Missing log entry ${action} @ ${ts}`)
  }
  return entry
}

function getNestedString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing string value for ${label}`)
  }
  return value
}

function parseRawTextJson<T>(entry: LogEntry, label: string): T {
  const rawText = (entry.details?.output as JsonRecord | undefined)?.rawText
  const raw = getNestedString(rawText, `${label}.rawText`)
  return JSON.parse(raw) as T
}

function parseNovelTextFromPrompt(entry: LogEntry): string {
  const input = entry.details?.input as JsonRecord | undefined
  const prompt = getNestedString(input?.prompt, 'analyze_locations.prompt')
  const match = prompt.match(/赵启明的脖子发出令人牙酸的骨裂声[\s\S]*?[「“"]?你终于肯回来看我了？[」”"]?/)
  if (!match) {
    throw new Error('Failed to extract novel text from analyze_locations prompt')
  }
  return match[0].trim()
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item).trim()).filter(Boolean)
}

function parseRecoveredCharacters(entry: LogEntry): CharacterRecovery[] {
  const obj = parseRawTextJson<JsonRecord>(entry, 'analyze_characters')
  const sourceRows = Array.isArray(obj.updated_characters) && obj.updated_characters.length > 0
    ? obj.updated_characters
    : Array.isArray(obj.new_characters)
      ? obj.new_characters
      : Array.isArray(obj.characters)
        ? obj.characters
        : []

  const rows: CharacterRecovery[] = []
  for (const item of sourceRows) {
    if (!item || typeof item !== 'object') continue
    const row = item as JsonRecord
    const name = asString(row.name).trim()
    if (!name) continue
    const introduction = asString(row.updated_introduction || row.introduction).trim() || null
    const aliases = asStringArray(row.updated_aliases ?? row.aliases)
    rows.push({ name, introduction, aliases })
  }

  if (rows.length === 0) {
    throw new Error('No recoverable characters found in analyze_characters output')
  }

  return rows
}

function parseSplitClips(entry: LogEntry): SplitClip[] {
  const rows = parseRawTextJson<unknown[]>(entry, 'split_clips')
  return rows.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`split_clips[${index}] is invalid`)
    }
    const row = item as JsonRecord
    const start = asString(row.start).trim()
    const end = asString(row.end).trim()
    const summary = asString(row.summary).trim()
    if (!start || !end || !summary) {
      throw new Error(`split_clips[${index}] is missing required fields`)
    }
    return {
      start,
      end,
      summary,
      location: asString(row.location).trim() || null,
      characters: asStringArray(row.characters),
      props: asStringArray(row.props),
    }
  })
}

function parseScreenplay(entry: LogEntry, label: string): ScreenplayOutput {
  const obj = parseRawTextJson<ScreenplayOutput>(entry, label)
  if (!obj || typeof obj !== 'object') {
    throw new Error(`Invalid screenplay payload for ${label}`)
  }
  if (!asString(obj.original_text).trim()) {
    throw new Error(`screenplay ${label} is missing original_text`)
  }
  return obj
}

function parsePhase3Panels(entry: LogEntry, label: string): Phase3Panel[] {
  const rows = parseRawTextJson<Phase3Panel[]>(entry, label)
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No phase3 panels found for ${label}`)
  }
  return rows
}

function parseVoiceLines(entry: LogEntry): VoiceLineOutput[] {
  const rows = parseRawTextJson<VoiceLineOutput[]>(entry, 'voice_analyze')
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No voice lines found in voice_analyze output')
  }
  return rows
}

function normalizeLocationDescription(name: string, description: string): string {
  const clean = description.trim()
  if (!clean) {
    return LOCATION_FALLBACKS[name]?.description ?? `「${name}」${name}的关键空间描述。`
  }
  return clean.startsWith(`「${name}」`) ? clean : `「${name}」${clean}`
}

function buildLocationSeeds(clips: ClipRecovery[]): LocationSeed[] {
  const names = new Set<string>()
  for (const clip of clips) {
    if (!clip.location) continue
    for (const part of clip.location.split(',')) {
      const name = part.trim()
      if (name) names.add(name)
    }
  }

  const seeds: LocationSeed[] = []
  for (const name of names) {
    const firstPanel = clips
      .flatMap((clip) => clip.panels)
      .find((panel) => asString(panel.location).trim() === name)
    const fallback = LOCATION_FALLBACKS[name] ?? {
      summary: `${name} 的恢复场景`,
      description: `「${name}」${name} 的关键空间描述。`,
    }
    seeds.push({
      name,
      summary: fallback.summary,
      description: normalizeLocationDescription(name, firstPanel?.description || fallback.description),
      assetKind: 'location',
    })
  }

  seeds.push({
    name: PROP_SEED.name,
    summary: PROP_SEED.summary,
    description: PROP_SEED.description,
    assetKind: 'prop',
  })

  return seeds
}

function buildRecoveryPayload(entries: LogEntry[]): RecoveryPayload {
  const analyzeLocationsPrompt = findLogEntry(
    entries,
    STEP_TIMESTAMPS.analyzeLocationsPrompt,
    'STORY_TO_SCRIPT_PROMPT:analyze_locations',
  )
  const analyzePropsOutput = findLogEntry(
    entries,
    STEP_TIMESTAMPS.analyzePropsOutput,
    'STORY_TO_SCRIPT_OUTPUT:analyze_props',
  )
  const analyzeLocationsOutput = findLogEntry(
    entries,
    STEP_TIMESTAMPS.analyzeLocationsOutput,
    'STORY_TO_SCRIPT_OUTPUT:analyze_locations',
  )
  const analyzeCharactersOutput = findLogEntry(
    entries,
    STEP_TIMESTAMPS.analyzeCharactersOutput,
    'STORY_TO_SCRIPT_OUTPUT:analyze_characters',
  )
  const splitClipsOutput = findLogEntry(
    entries,
    STEP_TIMESTAMPS.splitClipsOutput,
    'STORY_TO_SCRIPT_OUTPUT:split_clips',
  )
  const voiceAnalyzeOutput = findLogEntry(
    entries,
    STEP_TIMESTAMPS.voiceAnalyzeOutput,
    'SCRIPT_TO_STORYBOARD_OUTPUT:voice_analyze',
  )

  const novelText = parseNovelTextFromPrompt(analyzeLocationsPrompt)
  const characters = parseRecoveredCharacters(analyzeCharactersOutput)
  const propsPayload = parseRawTextJson<JsonRecord>(analyzePropsOutput, 'analyze_props')
  const locationsPayload = parseRawTextJson<JsonRecord>(analyzeLocationsOutput, 'analyze_locations')
  const splitClips = parseSplitClips(splitClipsOutput)

  if (splitClips.length !== CLIP_RECOVERY_ORDER.length) {
    throw new Error(`Expected ${CLIP_RECOVERY_ORDER.length} clips, got ${splitClips.length}`)
  }

  const clips: ClipRecovery[] = CLIP_RECOVERY_ORDER.map((meta, index) => {
    const splitClip = splitClips[index]
    const screenplayEntry = findLogEntry(
      entries,
      STEP_TIMESTAMPS.screenplay[meta.screenplayStepId],
      'STORY_TO_SCRIPT_OUTPUT:screenplay_conversion',
    )
    const phase3Entry = findLogEntry(
      entries,
      STEP_TIMESTAMPS.phase3[meta.phase3StepId],
      'SCRIPT_TO_STORYBOARD_OUTPUT:storyboard_phase3_detail',
    )
    const screenplay = parseScreenplay(screenplayEntry, meta.screenplayStepId)
    const panels = parsePhase3Panels(phase3Entry, meta.phase3StepId)
    return {
      clipId: meta.clipId,
      startText: splitClip.start,
      endText: splitClip.end,
      summary: splitClip.summary,
      location: splitClip.location,
      characters: splitClip.characters,
      props: splitClip.props,
      screenplay,
      panels,
    }
  })

  return {
    novelText,
    characters,
    propsFromAnalysis: asStringArray(propsPayload.props),
    locationsFromAnalysis: asStringArray(locationsPayload.locations),
    locations: buildLocationSeeds(clips),
    clips,
    voiceLines: parseVoiceLines(voiceAnalyzeOutput),
  }
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value)
}

async function recoverProject(payload: RecoveryPayload) {
  const novelProject = await prisma.novelPromotionProject.findUnique({
    where: { projectId: PROJECT_ID },
    include: {
      project: true,
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        select: { id: true },
      },
    },
  })

  if (!novelProject) {
    throw new Error(`Novel promotion project not found for ${PROJECT_ID}`)
  }
  if (novelProject.project.userId !== USER_ID) {
    throw new Error(`Project ${PROJECT_ID} is not owned by expected user ${USER_ID}`)
  }

  const episodeId = novelProject.episodes[0]?.id ?? randomUUID()
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: PROJECT_ID },
      data: {
        name: PROJECT_NAME,
        lastAccessedAt: now,
      },
    })

    await tx.novelPromotionCharacter.deleteMany({
      where: { novelPromotionProjectId: novelProject.id },
    })
    await tx.novelPromotionLocation.deleteMany({
      where: { novelPromotionProjectId: novelProject.id },
    })
    await tx.novelPromotionEpisode.deleteMany({
      where: { novelPromotionProjectId: novelProject.id },
    })

    const episode = await tx.novelPromotionEpisode.create({
      data: {
        id: episodeId,
        novelPromotionProjectId: novelProject.id,
        episodeNumber: 1,
        name: '第 1 集',
        novelText: payload.novelText,
      },
    })

    for (const character of payload.characters) {
      const created = await tx.novelPromotionCharacter.create({
        data: {
          novelPromotionProjectId: novelProject.id,
          name: character.name,
          aliases: character.aliases.length > 0 ? encodeJson(character.aliases) : null,
          introduction: character.introduction,
          profileConfirmed: false,
        },
      })

      const appearanceDescription = character.introduction || `${character.name} 的角色设定`
      await tx.characterAppearance.create({
        data: {
          characterId: created.id,
          appearanceIndex: 0,
          changeReason: '初始形象',
          description: appearanceDescription,
          descriptions: encodeJson([appearanceDescription]),
          imageUrls: encodeJson([]),
          previousImageUrls: encodeJson([]),
        },
      })
    }

    for (const location of payload.locations) {
      const createdLocation = await tx.novelPromotionLocation.create({
        data: {
          novelPromotionProjectId: novelProject.id,
          name: location.name,
          summary: location.summary,
          assetKind: location.assetKind,
        },
      })

      const createdImage = await tx.locationImage.create({
        data: {
          locationId: createdLocation.id,
          imageIndex: 0,
          description: location.description,
          availableSlots: '[]',
          isSelected: true,
        },
      })

      await tx.novelPromotionLocation.update({
        where: { id: createdLocation.id },
        data: { selectedImageId: createdImage.id },
      })
    }

    const panelIdByKey = new Map<string, string>()

    for (const clip of payload.clips) {
      const screenplay = {
        ...clip.screenplay,
        clip_id: clip.clipId,
        original_text: clip.screenplay.original_text || '',
      }

      await tx.novelPromotionClip.create({
        data: {
          id: clip.clipId,
          episodeId: episode.id,
          summary: clip.summary,
          location: clip.location,
          content: clip.screenplay.original_text || `${clip.startText}\n\n${clip.endText}`,
          characters: clip.characters.length > 0 ? encodeJson(clip.characters) : null,
          props: clip.props.length > 0 ? encodeJson(clip.props) : null,
          startText: clip.startText,
          endText: clip.endText,
          screenplay: encodeJson(screenplay),
        },
      })

      await tx.novelPromotionStoryboard.create({
        data: {
          id: clip.clipId,
          clipId: clip.clipId,
          episodeId: episode.id,
          panelCount: clip.panels.length,
          storyboardTextJson: encodeJson(clip.panels),
        },
      })

      for (let index = 0; index < clip.panels.length; index += 1) {
        const panel = clip.panels[index]
        const createdPanel = await tx.novelPromotionPanel.create({
          data: {
            storyboardId: clip.clipId,
            panelIndex: index,
            panelNumber: panel.panel_number ?? index + 1,
            shotType: asString(panel.shot_type).trim() || null,
            cameraMove: asString(panel.camera_move).trim() || null,
            description: asString(panel.description).trim() || null,
            videoPrompt: asString(panel.video_prompt).trim() || null,
            location: asString(panel.location).trim() || null,
            characters: Array.isArray(panel.characters) && panel.characters.length > 0 ? encodeJson(panel.characters) : null,
            props: Array.isArray(panel.props) && panel.props.length > 0 ? encodeJson(panel.props) : null,
            srtSegment: asString(panel.source_text).trim() || null,
            sceneType: asString(panel.scene_type).trim() || null,
          },
          select: {
            id: true,
            panelIndex: true,
          },
        })

        panelIdByKey.set(`${clip.clipId}:${createdPanel.panelIndex}`, createdPanel.id)
      }
    }

    for (const voiceLine of payload.voiceLines) {
      if (!Number.isFinite(voiceLine.lineIndex) || !voiceLine.lineIndex || voiceLine.lineIndex <= 0) {
        throw new Error(`Invalid voice line index: ${voiceLine.lineIndex}`)
      }
      const speaker = asString(voiceLine.speaker).trim()
      const content = asString(voiceLine.content).trim()
      if (!speaker || !content) {
        throw new Error(`Invalid voice line payload for line ${voiceLine.lineIndex}`)
      }

      const matchedStoryboardId = asString(voiceLine.matchedPanel?.storyboardId).trim() || null
      const matchedPanelIndex = Number.isFinite(voiceLine.matchedPanel?.panelIndex)
        ? Math.floor(voiceLine.matchedPanel!.panelIndex as number)
        : null
      const matchedPanelId = matchedStoryboardId !== null && matchedPanelIndex !== null
        ? panelIdByKey.get(`${matchedStoryboardId}:${matchedPanelIndex}`) || null
        : null

      if (matchedStoryboardId && matchedPanelIndex !== null && !matchedPanelId) {
        throw new Error(`Failed to resolve matched panel ${matchedStoryboardId}:${matchedPanelIndex}`)
      }

      const rawEmotion = Number(voiceLine.emotionStrength)
      const emotionStrength = Number.isFinite(rawEmotion)
        ? Math.min(1, Math.max(0.1, rawEmotion))
        : 0.4

      await tx.novelPromotionVoiceLine.create({
        data: {
          episodeId: episode.id,
          lineIndex: Math.floor(voiceLine.lineIndex),
          speaker,
          content,
          emotionStrength,
          matchedStoryboardId,
          matchedPanelIndex,
          matchedPanelId,
        },
      })
    }

    await tx.novelPromotionProject.update({
      where: { id: novelProject.id },
      data: {
        lastEpisodeId: episode.id,
        importStatus: 'completed',
      },
    })
  }, { timeout: 60_000 })

  return {
    projectInternalId: novelProject.id,
    episodeId,
  }
}

async function verifyRecovery(projectInternalId: string, episodeId: string) {
  const [project, clipCount, storyboardCount, panelCount, voiceCount, characterCount, locationCount] = await Promise.all([
    prisma.project.findUnique({
      where: { id: PROJECT_ID },
      select: {
        id: true,
        name: true,
        userId: true,
        lastAccessedAt: true,
      },
    }),
    prisma.novelPromotionClip.count({
      where: { episodeId },
    }),
    prisma.novelPromotionStoryboard.count({
      where: { episodeId },
    }),
    prisma.novelPromotionPanel.count({
      where: {
        storyboard: {
          episodeId,
        },
      },
    }),
    prisma.novelPromotionVoiceLine.count({
      where: { episodeId },
    }),
    prisma.novelPromotionCharacter.count({
      where: { novelPromotionProjectId: projectInternalId },
    }),
    prisma.novelPromotionLocation.count({
      where: { novelPromotionProjectId: projectInternalId },
    }),
  ])

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      episodeNumber: true,
      name: true,
      novelText: true,
    },
  })

  const voiceLines = await prisma.novelPromotionVoiceLine.findMany({
    where: { episodeId },
    orderBy: { lineIndex: 'asc' },
    select: {
      lineIndex: true,
      speaker: true,
      content: true,
      matchedStoryboardId: true,
      matchedPanelIndex: true,
    },
  })

  return {
    project,
    episode: episode
      ? {
        id: episode.id,
        episodeNumber: episode.episodeNumber,
        name: episode.name,
        novelTextLength: episode.novelText?.length ?? 0,
      }
      : null,
    counts: {
      clips: clipCount,
      storyboards: storyboardCount,
      panels: panelCount,
      voiceLines: voiceCount,
      characters: characterCount,
      locations: locationCount,
    },
    voiceLines,
  }
}

async function main() {
  const entries = readProjectLogs()
  const payload = buildRecoveryPayload(entries)

  const locationNames = payload.locations
    .filter((item) => item.assetKind === 'location')
    .map((item) => item.name)

  console.log(JSON.stringify({
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    recoveredNovelTextLength: payload.novelText.length,
    recoveredCharacters: payload.characters.map((item) => item.name),
    recoveredLocations: locationNames,
    recoveredProps: payload.locations.filter((item) => item.assetKind === 'prop').map((item) => item.name),
    clipIds: payload.clips.map((item) => item.clipId),
    panelCounts: payload.clips.map((item) => ({ clipId: item.clipId, panels: item.panels.length })),
    voiceLines: payload.voiceLines.length,
  }, null, 2))

  const result = await recoverProject(payload)
  const verification = await verifyRecovery(result.projectInternalId, result.episodeId)

  console.log(JSON.stringify({
    status: 'ok',
    verification,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
