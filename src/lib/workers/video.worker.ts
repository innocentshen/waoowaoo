import { randomUUID } from 'node:crypto'
import { Worker, type Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { queueRedis } from '@/lib/redis'
import { QUEUE_NAME } from '@/lib/task/queues'
import { TASK_TYPE, type TaskJobData } from '@/lib/task/types'
import { getUserWorkflowConcurrencyConfig } from '@/lib/config-service'
import { reportTaskProgress, withTaskLifecycle } from './shared'
import { withUserConcurrencyGate } from './user-concurrency-gate'
import {
  assertTaskActive,
  getProjectModels,
  resolveLipSyncVideoSource,
  resolveVideoSourceFromGeneration,
  toSignedUrlIfCos,
  uploadVideoSourceToCos,
} from './utils'
import { normalizeToBase64ForGeneration } from '@/lib/media/outbound-image'
import { resolveBuiltinCapabilitiesByModelKey } from '@/lib/model-capabilities/lookup'
import { parseModelKeyStrict } from '@/lib/model-config-contract'
import { getProviderConfig } from '@/lib/api-config'
import {
  appendPanelVideoCandidate,
  estimatePanelVideoCandidateDurationSeconds,
  resolvePanelVideoCandidates,
  type PanelVideoCandidateMeta,
  type PanelVideoGenerationMode,
} from '@/lib/novel-promotion/video-candidates'
import { GROK_VIDEO_EDIT_MAX_SOURCE_DURATION_SECONDS } from '@/lib/providers/grok/shared'
import {
  findCharacterByName,
  parseNamedReferenceList,
  parseImageUrls,
  parsePanelCharacterReferences,
  resolveNovelData,
} from './handlers/image-task-handler-shared'

type AnyObj = Record<string, unknown>
type VideoOptionValue = string | number | boolean
type VideoOptionMap = Record<string, VideoOptionValue>
type VideoGenerationMode = PanelVideoGenerationMode
type PanelRecord = NonNullable<Awaited<ReturnType<typeof prisma.novelPromotionPanel.findUnique>>>
type VideoReferenceSelection = {
  includeCharacters: boolean
  includeLocation: boolean
  includeProps: boolean
  characters: Array<{ name: string; appearance?: string }>
  locations: string[]
  props: string[]
}

function isOfficialGrokVideoModel(modelKey: string): boolean {
  const parsed = parseModelKeyStrict(modelKey)
  return parsed?.provider === 'grok'
}

function toDurationMs(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return value > 1000 ? Math.round(value) : Math.round(value * 1000)
}

function formatDurationSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function readVideoReferenceSelection(payload: AnyObj): VideoReferenceSelection {
  const raw = payload.referenceSelection
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      includeCharacters: false,
      includeLocation: false,
      includeProps: false,
      characters: [],
      locations: [],
      props: [],
    }
  }

  const selection = raw as Record<string, unknown>
  const normalizeUniqueTextList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    const normalized: string[] = []
    const seen = new Set<string>()
    for (const item of value) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      normalized.push(trimmed)
    }
    return normalized
  }
  const characters = (() => {
    if (!Array.isArray(selection.characters)) return []
    const normalized: Array<{ name: string; appearance?: string }> = []
    const seen = new Set<string>()
    for (const item of selection.characters) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      if (!name) continue
      const appearance = typeof item.appearance === 'string' ? item.appearance.trim() : ''
      const key = `${name.toLowerCase()}::${appearance.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      normalized.push(appearance ? { name, appearance } : { name })
    }
    return normalized
  })()
  const locations = normalizeUniqueTextList(selection.locations)
  const props = normalizeUniqueTextList(selection.props)

  return {
    includeCharacters: selection.includeCharacters === true || characters.length > 0,
    includeLocation: selection.includeLocation === true || locations.length > 0,
    includeProps: selection.includeProps === true || props.length > 0,
    characters,
    locations,
    props,
  }
}

function parseDescriptionList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function pickAppearanceDescription(appearance: {
  descriptions?: string | null
  description?: string | null
  selectedIndex?: number | null
} | null | undefined): string | null {
  if (!appearance) return null
  const descriptions = parseDescriptionList(appearance.descriptions || null)
  if (descriptions.length > 0) {
    const selectedIndex = typeof appearance.selectedIndex === 'number' ? appearance.selectedIndex : 0
    const selected = descriptions[selectedIndex] || descriptions[0]
    if (selected && selected.trim()) return selected.trim()
  }
  if (typeof appearance.description === 'string' && appearance.description.trim()) {
    return appearance.description.trim()
  }
  return null
}

async function normalizeVideoReferenceImages(inputs: string[]): Promise<string[]> {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const input of inputs.slice(0, 6)) {
    const trimmed = input.trim()
    if (!trimmed) continue
    try {
      const normalizedImage = await normalizeToBase64ForGeneration(trimmed)
      if (!normalizedImage || seen.has(normalizedImage)) continue
      seen.add(normalizedImage)
      normalized.push(normalizedImage)
    } catch {
      // best effort only
    }
  }

  return normalized
}

async function collectPanelVideoReferenceContext(input: {
  projectId: string
  panel: PanelRecord
  selection: VideoReferenceSelection
}): Promise<{
  promptSuffix: string
  referenceImages: string[]
}> {
  if (!input.selection.includeCharacters && !input.selection.includeLocation && !input.selection.includeProps) {
    return {
      promptSuffix: '',
      referenceImages: [],
    }
  }

  const projectData = await resolveNovelData(input.projectId)
  const promptSections: string[] = []
  const rawReferenceImages: string[] = []
  const rawReferenceImageSet = new Set<string>()

  if (input.selection.includeCharacters) {
    const characterLines: string[] = []
    const panelCharacters = input.selection.characters.length > 0
      ? input.selection.characters.map((item) => ({ ...item, slot: undefined }))
      : parsePanelCharacterReferences(input.panel.characters)

    for (const characterRef of panelCharacters) {
      const character = findCharacterByName(projectData.characters || [], characterRef.name)
      if (!character) continue

      const appearances = character.appearances || []
      const matchedAppearance = characterRef.appearance
        ? appearances.find((appearance) => (appearance.changeReason || '').toLowerCase() === characterRef.appearance!.toLowerCase())
        : null
      const appearance = matchedAppearance || appearances[0] || null
      const description = pickAppearanceDescription(appearance)
      const slotText = typeof characterRef.slot === 'string' && characterRef.slot.trim()
        ? ` | slot: ${characterRef.slot.trim()}`
        : ''
      characterLines.push(`- ${character.name}${description ? `: ${description}` : ''}${slotText}`)

      if (!appearance) continue
      const imageUrls = parseImageUrls(appearance.imageUrls, 'characterAppearance.imageUrls')
      const selectedIndex = appearance.selectedIndex
      const selectedUrl = selectedIndex !== null && selectedIndex !== undefined ? imageUrls[selectedIndex] : null
      const key = selectedUrl || imageUrls[0] || appearance.imageUrl
      const signedUrl = toSignedUrlIfCos(key, 3600)
      if (signedUrl && !rawReferenceImageSet.has(signedUrl)) {
        rawReferenceImageSet.add(signedUrl)
        rawReferenceImages.push(signedUrl)
      }
    }

    if (characterLines.length > 0) {
      promptSections.push(`Character references:\n${characterLines.join('\n')}`)
    }
  }

  if (input.selection.includeLocation) {
    const locationLines: string[] = []
    const locationNames = input.selection.locations.length > 0
      ? input.selection.locations
      : parseNamedReferenceList(input.panel.location)

    for (const panelLocation of locationNames) {
      const location = (projectData.locations || []).find(
        (item) => item.name.toLowerCase().trim() === panelLocation.toLowerCase(),
      )
      const selectedImage = location?.images?.find((image) => image.isSelected) || location?.images?.[0]
      const description = selectedImage?.description?.trim() || location?.summary?.trim() || ''
      locationLines.push(`- ${location?.name || panelLocation}${description ? `: ${description}` : ''}`)

      const signedUrl = toSignedUrlIfCos(selectedImage?.imageUrl, 3600)
      if (signedUrl && !rawReferenceImageSet.has(signedUrl)) {
        rawReferenceImageSet.add(signedUrl)
        rawReferenceImages.push(signedUrl)
      }
    }

    if (locationLines.length > 0) {
      promptSections.push(`Location references:\n${locationLines.join('\n')}`)
    }
  }

  if (input.selection.includeProps) {
    const propLines: string[] = []
    const propNames = input.selection.props.length > 0
      ? input.selection.props
      : parseNamedReferenceList(input.panel.props)

    for (const propName of propNames) {
      const prop = (projectData.props || []).find(
        (item) => item.name.toLowerCase().trim() === propName.toLowerCase(),
      )
      const selectedImage = prop?.images?.find((image) => image.isSelected) || prop?.images?.[0]
      const description = selectedImage?.description?.trim() || prop?.summary?.trim() || ''
      propLines.push(`- ${prop?.name || propName}${description ? `: ${description}` : ''}`)

      const signedUrl = toSignedUrlIfCos(selectedImage?.imageUrl, 3600)
      if (signedUrl && !rawReferenceImageSet.has(signedUrl)) {
        rawReferenceImageSet.add(signedUrl)
        rawReferenceImages.push(signedUrl)
      }
    }

    if (propLines.length > 0) {
      promptSections.push(`Prop references:\n${propLines.join('\n')}`)
    }
  }

  const referenceImages = await normalizeVideoReferenceImages(rawReferenceImages)
  const promptSuffix = promptSections.length > 0
    ? [
      'Reference consistency constraints:',
      ...promptSections,
      'Use these selected references to keep identity and location continuity consistent with the current shot.',
    ].join('\n\n')
    : ''

  return {
    promptSuffix,
    referenceImages,
  }
}

function extractGenerationOptions(payload: AnyObj): VideoOptionMap {
  const fromEnvelope = payload.generationOptions
  if (!fromEnvelope || typeof fromEnvelope !== 'object' || Array.isArray(fromEnvelope)) {
    return {}
  }

  const next: VideoOptionMap = {}
  for (const [key, value] of Object.entries(fromEnvelope as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value
    }
  }
  return next
}

function parseVideoOperation(payload: AnyObj): {
  mode: Extract<VideoGenerationMode, 'edit' | 'extend'>
  sourceCandidateId: string
  instruction: string
  extendDuration?: number
} | null {
  const raw = payload.videoOperation
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const operation = raw as Record<string, unknown>

  const mode = operation.mode
  if (mode !== 'edit' && mode !== 'extend') {
    throw new Error('VIDEO_OPERATION_MODE_INVALID')
  }

  const sourceCandidateId = typeof operation.sourceCandidateId === 'string' ? operation.sourceCandidateId.trim() : ''
  if (!sourceCandidateId) {
    throw new Error('VIDEO_OPERATION_SOURCE_CANDIDATE_REQUIRED')
  }

  const instruction = typeof operation.instruction === 'string' ? operation.instruction.trim() : ''
  if (!instruction) {
    throw new Error('VIDEO_OPERATION_INSTRUCTION_REQUIRED')
  }

  const extendDuration = typeof operation.extendDuration === 'number' && Number.isFinite(operation.extendDuration)
    ? Math.round(operation.extendDuration)
    : undefined

  if (mode === 'extend' && (typeof extendDuration !== 'number' || extendDuration <= 0)) {
    throw new Error('VIDEO_OPERATION_EXTEND_DURATION_REQUIRED')
  }

  return {
    mode,
    sourceCandidateId,
    instruction,
    ...(typeof extendDuration === 'number' ? { extendDuration } : {}),
  }
}

async function fetchPanelByStoryboardIndex(storyboardId: string, panelIndex: number) {
  return await prisma.novelPromotionPanel.findFirst({
    where: {
      storyboardId,
      panelIndex,
    },
  })
}

async function getPanelForVideoTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj

  // 优先使用 targetType=NovelPromotionPanel 直接定位
  if (job.data.targetType === 'NovelPromotionPanel') {
    const panel = await prisma.novelPromotionPanel.findUnique({ where: { id: job.data.targetId } })
    if (!panel) throw new Error('Panel not found')
    return panel
  }

  // 兜底：通过 storyboardId + panelIndex 定位
  const storyboardId = payload.storyboardId
  const panelIndex = payload.panelIndex
  if (typeof storyboardId !== 'string' || !storyboardId || panelIndex === undefined || panelIndex === null) {
    throw new Error('Missing storyboardId/panelIndex for video task')
  }

  const panel = await fetchPanelByStoryboardIndex(storyboardId, Number(panelIndex))
  if (!panel) throw new Error('Panel not found by storyboardId/panelIndex')
  return panel
}

async function generateVideoForPanel(
  job: Job<TaskJobData>,
  panel: PanelRecord,
  payload: AnyObj,
  modelId: string,
  projectVideoRatio: string | null | undefined,
  generationOptions: VideoOptionMap,
): Promise<{
  cosKey: string
  generationMode: VideoGenerationMode
  prompt: string
  generationModel: string
  candidateMeta?: PanelVideoCandidateMeta | null
  actualVideoTokens?: number
}> {
  const firstLastFramePayload =
    typeof payload.firstLastFrame === 'object' && payload.firstLastFrame !== null
      ? (payload.firstLastFrame as AnyObj)
      : null
  const videoOperation = parseVideoOperation(payload)
  const firstLastCustomPrompt = typeof firstLastFramePayload?.customPrompt === 'string' ? firstLastFramePayload.customPrompt : null
  const persistedFirstLastPrompt = firstLastFramePayload ? panel.firstLastFramePrompt : null
  const customPrompt = typeof payload.customPrompt === 'string' ? payload.customPrompt : null
  const basePrompt = videoOperation?.instruction
    || firstLastCustomPrompt
    || persistedFirstLastPrompt
    || customPrompt
    || panel.videoPrompt
    || panel.description
  if (!basePrompt) {
    throw new Error(`Panel ${panel.id} has no video prompt`)
  }
  const referenceSelection = readVideoReferenceSelection(payload)
  const referenceContext = await collectPanelVideoReferenceContext({
    projectId: job.data.projectId,
    panel,
    selection: referenceSelection,
  })
  const prompt = [
    basePrompt,
    referenceContext.promptSuffix,
  ].filter(Boolean).join('\n\n')

  let sourceImageBase64: string | undefined
  let sourceVideoUrl: string | undefined
  let lastFrameImageBase64: string | undefined
  let referenceImagesForGeneration = referenceContext.referenceImages
  const generationMode: VideoGenerationMode = videoOperation?.mode || (firstLastFramePayload ? 'firstlastframe' : 'normal')
  const requestedGenerateAudio = typeof generationOptions.generateAudio === 'boolean'
    ? generationOptions.generateAudio
    : undefined
  let model = modelId
  let candidateMeta: PanelVideoCandidateMeta | null = null

  if (videoOperation) {
    const panelVideoCandidates = resolvePanelVideoCandidates({
      videoCandidates: typeof panel.videoCandidates === 'string' ? panel.videoCandidates : null,
      videoUrl: panel.videoUrl,
      videoGenerationMode: panel.videoGenerationMode,
    })
    const sourceCandidate = panelVideoCandidates.find((candidate) => candidate.id === videoOperation.sourceCandidateId)

    if (!sourceCandidate?.videoUrl) {
      throw new Error(`VIDEO_OPERATION_SOURCE_CANDIDATE_NOT_FOUND: ${videoOperation.sourceCandidateId}`)
    }

    if (videoOperation.mode === 'edit' && isOfficialGrokVideoModel(model)) {
      const estimatedSourceDuration = estimatePanelVideoCandidateDurationSeconds(
        panelVideoCandidates,
        sourceCandidate.id,
        panel.duration,
      )
      if (
        estimatedSourceDuration !== null
        && estimatedSourceDuration > GROK_VIDEO_EDIT_MAX_SOURCE_DURATION_SECONDS
      ) {
        throw new Error(
          `GROK_VIDEO_EDIT_SOURCE_DURATION_UNSUPPORTED: source video is ${formatDurationSeconds(estimatedSourceDuration)}s, but Grok video edit supports up to ${formatDurationSeconds(GROK_VIDEO_EDIT_MAX_SOURCE_DURATION_SECONDS)}s`,
        )
      }
    }

    sourceVideoUrl = toSignedUrlIfCos(sourceCandidate.videoUrl, 3600) || sourceCandidate.videoUrl
    if (!sourceVideoUrl) {
      throw new Error(`VIDEO_OPERATION_SOURCE_VIDEO_INVALID: ${videoOperation.sourceCandidateId}`)
    }

    if (videoOperation.mode === 'extend' && typeof videoOperation.extendDuration === 'number') {
      generationOptions.duration = videoOperation.extendDuration
    }

    candidateMeta = {
      sourceCandidateId: sourceCandidate.id,
      sourceGenerationMode: sourceCandidate.generationMode,
      ...(videoOperation.mode === 'extend' && typeof videoOperation.extendDuration === 'number'
        ? { extendDuration: videoOperation.extendDuration }
        : {}),
    }
  } else {
    if (!panel.imageUrl) {
      throw new Error(`Panel ${panel.id} has no imageUrl`)
    }
    const sourceImageUrl = toSignedUrlIfCos(panel.imageUrl, 3600)
    if (!sourceImageUrl) {
      throw new Error(`Panel ${panel.id} image url invalid`)
    }
    const normalizedPanelImage = await normalizeToBase64ForGeneration(sourceImageUrl)
    if (isOfficialGrokVideoModel(modelId) && !firstLastFramePayload && referenceContext.referenceImages.length > 0) {
      referenceImagesForGeneration = Array.from(new Set([
        normalizedPanelImage,
        ...referenceContext.referenceImages,
      ])).slice(0, 7)
    } else {
      sourceImageBase64 = normalizedPanelImage
    }
  }

  if (firstLastFramePayload) {
    model =
      typeof firstLastFramePayload.flModel === 'string' && firstLastFramePayload.flModel
        ? firstLastFramePayload.flModel
        : modelId
    const firstLastFrameCapabilities = resolveBuiltinCapabilitiesByModelKey('video', model)
    if (firstLastFrameCapabilities?.video?.firstlastframe !== true) {
      throw new Error(`VIDEO_FIRSTLASTFRAME_MODEL_UNSUPPORTED: ${model}`)
    }
    if (
      typeof firstLastFramePayload.lastFrameStoryboardId === 'string' &&
      firstLastFramePayload.lastFrameStoryboardId &&
      firstLastFramePayload.lastFramePanelIndex !== undefined
    ) {
      const lastPanel = await fetchPanelByStoryboardIndex(
        firstLastFramePayload.lastFrameStoryboardId,
        Number(firstLastFramePayload.lastFramePanelIndex),
      )
      if (lastPanel?.imageUrl) {
        const lastFrameUrl = toSignedUrlIfCos(lastPanel.imageUrl, 3600)
        if (lastFrameUrl) {
          lastFrameImageBase64 = await normalizeToBase64ForGeneration(lastFrameUrl)
        }
      }
    }
  }

  if (isOfficialGrokVideoModel(model) && (videoOperation || firstLastFramePayload)) {
    referenceImagesForGeneration = []
  }

  const generatedVideo = await resolveVideoSourceFromGeneration(job, {
    userId: job.data.userId,
    modelId: model,
    ...(sourceImageBase64 ? { imageUrl: sourceImageBase64 } : {}),
    ...(sourceVideoUrl ? { videoUrl: sourceVideoUrl } : {}),
    ...(referenceImagesForGeneration.length > 0 ? { referenceImages: referenceImagesForGeneration } : {}),
    options: {
      prompt,
      ...((!videoOperation && projectVideoRatio) ? { aspectRatio: projectVideoRatio } : {}),
      ...generationOptions,
      generationMode,
      ...(typeof requestedGenerateAudio === 'boolean' ? { generateAudio: requestedGenerateAudio } : {}),
      ...(lastFrameImageBase64 ? { lastFrameImageUrl: lastFrameImageBase64 } : {}),
    },
  })

  let downloadHeaders: Record<string, string> | undefined
  const videoSource = generatedVideo.url
  if (generatedVideo.downloadHeaders) {
    downloadHeaders = generatedVideo.downloadHeaders
  } else if (typeof videoSource === 'string') {
    const parsedModel = parseModelKeyStrict(model)
    const isGoogleDownloadUrl = videoSource.includes('generativelanguage.googleapis.com/')
      && videoSource.includes('/files/')
      && videoSource.includes(':download')
    if (parsedModel?.provider === 'google' && isGoogleDownloadUrl) {
      const { apiKey } = await getProviderConfig(job.data.userId, 'google')
      downloadHeaders = { 'x-goog-api-key': apiKey }
    }
  }

  const cosKey = await uploadVideoSourceToCos(videoSource, 'panel-video', panel.id, downloadHeaders)
  return {
    cosKey,
    generationMode,
    prompt,
    generationModel: model,
    candidateMeta,
    ...(typeof generatedVideo.actualVideoTokens === 'number'
      ? { actualVideoTokens: generatedVideo.actualVideoTokens }
      : {}),
  }
}

async function persistGeneratedPanelVideoCandidate(params: {
  panelId: string
  cosKey: string
  generationMode: VideoGenerationMode
  prompt: string
  generationModel: string
  candidateMeta?: PanelVideoCandidateMeta | null
}) {
  const candidate = {
    id: randomUUID(),
    videoUrl: params.cosKey,
    generationMode: params.generationMode,
    createdAt: new Date().toISOString(),
    model: params.generationModel,
    prompt: params.prompt,
    meta: params.candidateMeta || null,
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentPanel = await prisma.novelPromotionPanel.findUnique({
      where: { id: params.panelId },
      select: {
        id: true,
        updatedAt: true,
        videoUrl: true,
        videoCandidates: true,
        videoGenerationMode: true,
      },
    })

    if (!currentPanel) {
      throw new Error(`Panel not found while persisting generated video: ${params.panelId}`)
    }

    const nextState = appendPanelVideoCandidate(currentPanel, candidate)
    const updated = await prisma.novelPromotionPanel.updateMany({
      where: {
        id: currentPanel.id,
        updatedAt: currentPanel.updatedAt,
      },
      data: {
        videoCandidates: nextState.serialized,
        videoUrl: nextState.selectedVideoUrl,
        videoGenerationMode: nextState.selectedGenerationMode,
      },
    })

    if (updated.count === 1) {
      return {
        candidateId: candidate.id,
        selectedVideoUrl: nextState.selectedVideoUrl,
      }
    }
  }

  throw new Error(`Failed to persist generated panel video after retries: ${params.panelId}`)
}

async function handleVideoPanelTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj
  const projectModels = await getProjectModels(job.data.projectId, job.data.userId)

  const modelId = typeof payload.videoModel === 'string' ? payload.videoModel.trim() : ''
  if (!modelId) throw new Error('VIDEO_MODEL_REQUIRED: payload.videoModel is required')

  const panel = await getPanelForVideoTask(job)

  const generationOptions = extractGenerationOptions(payload)

  await reportTaskProgress(job, 10, {
    stage: 'generate_panel_video',
    panelId: panel.id,
  })

  const {
    cosKey,
    generationMode,
    prompt,
    generationModel,
    candidateMeta,
    actualVideoTokens,
  } = await generateVideoForPanel(
    job,
    panel,
    payload,
    modelId,
    projectModels.videoRatio,
    generationOptions,
  )

  await assertTaskActive(job, 'persist_panel_video')
  await persistGeneratedPanelVideoCandidate({
    panelId: panel.id,
    cosKey,
    generationMode,
    prompt,
    generationModel,
    candidateMeta,
  })

  return {
    panelId: panel.id,
    videoUrl: cosKey,
    ...(typeof actualVideoTokens === 'number' ? { actualVideoTokens } : {}),
  }
}

async function handleLipSyncTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as AnyObj
  const lipSyncModel = typeof payload.lipSyncModel === 'string' && payload.lipSyncModel.trim()
    ? payload.lipSyncModel.trim()
    : undefined

  let panel: PanelRecord | null = null
  if (job.data.targetType === 'NovelPromotionPanel') {
    panel = await prisma.novelPromotionPanel.findUnique({ where: { id: job.data.targetId } })
  }

  if (
    !panel &&
    typeof payload.storyboardId === 'string' &&
    payload.storyboardId &&
    payload.panelIndex !== undefined
  ) {
    panel = await fetchPanelByStoryboardIndex(payload.storyboardId, Number(payload.panelIndex))
  }

  if (!panel) throw new Error('Lip-sync panel not found')
  if (!panel.videoUrl) throw new Error('Panel has no base video')

  const voiceLineId = typeof payload.voiceLineId === 'string' ? payload.voiceLineId : null
  if (!voiceLineId) throw new Error('Lip-sync task missing voiceLineId')

  const voiceLine = await prisma.novelPromotionVoiceLine.findUnique({ where: { id: voiceLineId } })
  if (!voiceLine || !voiceLine.audioUrl) {
    throw new Error('Voice line or audioUrl not found')
  }

  const signedVideoUrl = toSignedUrlIfCos(panel.videoUrl, 7200)
  const signedAudioUrl = toSignedUrlIfCos(voiceLine.audioUrl, 7200)

  if (!signedVideoUrl || !signedAudioUrl) {
    throw new Error('Lip-sync input media url invalid')
  }

  await reportTaskProgress(job, 25, { stage: 'submit_lip_sync' })

  const source = await resolveLipSyncVideoSource(job, {
    userId: job.data.userId,
    videoUrl: signedVideoUrl,
    audioUrl: signedAudioUrl,
    audioDurationMs: typeof voiceLine.audioDuration === 'number' ? voiceLine.audioDuration : undefined,
    videoDurationMs: toDurationMs(panel.duration),
    modelKey: lipSyncModel,
  })

  await reportTaskProgress(job, 93, { stage: 'persist_lip_sync' })

  const cosKey = await uploadVideoSourceToCos(source, 'lip-sync', panel.id)

  await assertTaskActive(job, 'persist_lip_sync_video')
  await prisma.novelPromotionPanel.update({
    where: { id: panel.id },
    data: {
      lipSyncVideoUrl: cosKey,
      lipSyncTaskId: null,
    },
  })

  return {
    panelId: panel.id,
    voiceLineId,
    lipSyncVideoUrl: cosKey,
  }
}

async function processVideoTask(job: Job<TaskJobData>) {
  await reportTaskProgress(job, 5, { stage: 'received' })

  switch (job.data.type) {
    case TASK_TYPE.VIDEO_PANEL:
      return await handleVideoPanelTask(job)
    case TASK_TYPE.LIP_SYNC:
      return await handleLipSyncTask(job)
    default:
      throw new Error(`Unsupported video task type: ${job.data.type}`)
  }
}

export function createVideoWorker() {
  return new Worker<TaskJobData>(
    QUEUE_NAME.VIDEO,
    async (job) => await withTaskLifecycle(job, async (taskJob) => {
      const workflowConcurrency = await getUserWorkflowConcurrencyConfig(taskJob.data.userId)
      return await withUserConcurrencyGate({
        scope: 'video',
        userId: taskJob.data.userId,
        limit: workflowConcurrency.video,
        run: async () => await processVideoTask(taskJob),
      })
    }),
    {
      connection: queueRedis,
      concurrency: Number.parseInt(process.env.QUEUE_CONCURRENCY_VIDEO || '4', 10) || 4,
    },
  )
}
