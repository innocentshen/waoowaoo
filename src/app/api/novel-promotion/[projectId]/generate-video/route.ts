import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { BillingOperationError } from '@/lib/billing/errors'
import { hasPanelVideoOutput } from '@/lib/task/has-output'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { parseModelKeyStrict, type CapabilityValue } from '@/lib/model-config-contract'
import {
  resolveBuiltinCapabilitiesByModelKey,
} from '@/lib/model-capabilities/lookup'
import { resolveBuiltinPricing } from '@/lib/model-pricing/lookup'
import { resolveProjectModelCapabilityGenerationOptions } from '@/lib/config-service'
import { normalizeVideoGenerationCount } from '@/lib/video-generation/count'
import { createScopedLogger } from '@/lib/logging/core'

const videoSubmitLogger = createScopedLogger({
  module: 'api.novel-promotion.video',
  action: 'video.submit.request',
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toVideoRuntimeSelections(value: unknown): Record<string, CapabilityValue> {
  if (!isRecord(value)) return {}
  const selections: Record<string, CapabilityValue> = {}
  for (const [field, raw] of Object.entries(value)) {
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      selections[field] = raw
    }
  }
  return selections
}

type VideoGenerationMode = 'normal' | 'firstlastframe' | 'edit' | 'extend'

function resolveVideoGenerationMode(payload: unknown): VideoGenerationMode {
  if (!isRecord(payload)) return 'normal'
  const videoOperation = isRecord(payload.videoOperation) ? payload.videoOperation : null
  if (videoOperation?.mode === 'edit' || videoOperation?.mode === 'extend') {
    return videoOperation.mode
  }
  return isRecord(payload.firstLastFrame) ? 'firstlastframe' : 'normal'
}

function isSeedance2Model(modelKey: string): boolean {
  const parsed = parseModelKeyStrict(modelKey)
  if (!parsed) return false
  return parsed.provider === 'ark'
    && (
      parsed.modelId === 'doubao-seedance-2-0-260128'
      || parsed.modelId === 'doubao-seedance-2-0-fast-260128'
    )
}

function resolveVideoModelKeyFromPayload(payload: Record<string, unknown>): string | null {
  const firstLast = isRecord(payload.firstLastFrame) ? payload.firstLastFrame : null
  if (firstLast && typeof firstLast.flModel === 'string' && parseModelKeyStrict(firstLast.flModel)) {
    return firstLast.flModel
  }
  if (typeof payload.videoModel === 'string' && parseModelKeyStrict(payload.videoModel)) {
    return payload.videoModel
  }
  return null
}

function requireVideoModelKeyFromPayload(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.videoModel !== 'string' || !parseModelKeyStrict(payload.videoModel)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_MODEL_REQUIRED',
      field: 'videoModel',
    })
  }
  return payload.videoModel
}

function normalizeVideoReferenceCharacters(value: unknown): Array<{ name: string; appearance?: string }> {
  if (!Array.isArray(value)) return []

  const normalized: Array<{ name: string; appearance?: string }> = []
  const seen = new Set<string>()

  for (const item of value) {
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
}

function normalizeVideoReferenceNames(value: unknown): string[] {
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

function normalizeVideoReferenceSelection(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined

  const characters = normalizeVideoReferenceCharacters(value.characters)
  const locations = normalizeVideoReferenceNames(value.locations)
  const props = normalizeVideoReferenceNames(value.props)

  const includeCharacters = value.includeCharacters === true || characters.length > 0
  const includeLocation = value.includeLocation === true || locations.length > 0
  const includeProps = value.includeProps === true || props.length > 0
  if (!includeCharacters && !includeLocation && !includeProps) return undefined

  return {
    ...(includeCharacters ? { includeCharacters: true } : {}),
    ...(includeLocation ? { includeLocation: true } : {}),
    ...(includeProps ? { includeProps: true } : {}),
    ...(characters.length > 0 ? { characters } : {}),
    ...(locations.length > 0 ? { locations } : {}),
    ...(props.length > 0 ? { props } : {}),
  }
}

function normalizeVideoPayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}

  const next: Record<string, unknown> = { ...value }
  const referenceSelection = normalizeVideoReferenceSelection(value.referenceSelection)
  if (referenceSelection) {
    next.referenceSelection = referenceSelection
  } else {
    delete next.referenceSelection
  }
  return next
}

function validateFirstLastFrameModel(input: unknown) {
  if (input === undefined || input === null) return
  if (!isRecord(input)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'FIRSTLASTFRAME_PAYLOAD_INVALID',
      field: 'firstLastFrame',
    })
  }

  const flModel = input.flModel
  if (typeof flModel !== 'string' || !parseModelKeyStrict(flModel)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'FIRSTLASTFRAME_MODEL_INVALID',
      field: 'firstLastFrame.flModel',
    })
  }

  const capabilities = resolveBuiltinCapabilitiesByModelKey('video', flModel)
  if (capabilities?.video?.firstlastframe !== true) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'FIRSTLASTFRAME_MODEL_UNSUPPORTED',
      field: 'firstLastFrame.flModel',
    })
  }
}

async function validateVideoCapabilityCombination(input: {
  payload: unknown
  projectId: string
  userId: string
}): Promise<Record<string, CapabilityValue> | null> {
  const payload = input.payload
  if (!isRecord(payload)) return null
  const modelKey = resolveVideoModelKeyFromPayload(payload)
  if (!modelKey) return null

  // Skip validation for models not in the built-in capability catalog
  const builtinCaps = resolveBuiltinCapabilitiesByModelKey('video', modelKey)
  if (!builtinCaps) return null

  const runtimeSelections = toVideoRuntimeSelections(payload.generationOptions)
  runtimeSelections.generationMode = resolveVideoGenerationMode(payload)

  let resolvedOptions: Record<string, CapabilityValue>
  try {
    resolvedOptions = await resolveProjectModelCapabilityGenerationOptions({
      projectId: input.projectId,
      userId: input.userId,
      modelType: 'video',
      modelKey,
      runtimeSelections,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_CAPABILITY_COMBINATION_UNSUPPORTED',
      field: 'generationOptions',
      details: {
        model: modelKey,
        selections: runtimeSelections,
        message,
      },
    })
  }

  const resolution = resolveBuiltinPricing({
    apiType: 'video',
    model: modelKey,
    selections: {
      ...resolvedOptions,
      ...(isSeedance2Model(modelKey)
        ? { containsVideoInput: runtimeSelections.generationMode === 'edit' || runtimeSelections.generationMode === 'extend' }
        : {}),
    },
  })
  if (resolution.status === 'missing_capability_match') {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_CAPABILITY_COMBINATION_UNSUPPORTED',
      field: 'generationOptions',
      details: {
        model: modelKey,
        selections: resolvedOptions,
      },
    })
  }

  return resolvedOptions
}

function buildResolvedVideoGenerationOptions(
  rawOptions: unknown,
  resolvedOptions: Record<string, CapabilityValue> | null,
): Record<string, CapabilityValue> | undefined {
  const runtimeSelections = toVideoRuntimeSelections(rawOptions)
  const nextOptions: Record<string, CapabilityValue> = {}

  for (const [field, value] of Object.entries(resolvedOptions || {})) {
    if (field === 'generationMode') continue
    nextOptions[field] = value
  }

  for (const [field, value] of Object.entries(runtimeSelections)) {
    if (field === 'generationMode') continue
    nextOptions[field] = value
  }

  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined
}

function buildVideoPanelBillingInfoOrThrow(payload: unknown) {
  try {
    return buildDefaultTaskBillingInfo(TASK_TYPE.VIDEO_PANEL, isRecord(payload) ? payload : null)
  } catch (error) {
    if (
      error instanceof BillingOperationError
      && (
        error.code === 'BILLING_UNKNOWN_VIDEO_CAPABILITY_COMBINATION'
        || error.code === 'BILLING_UNKNOWN_VIDEO_RESOLUTION'
      )
    ) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'VIDEO_CAPABILITY_COMBINATION_UNSUPPORTED',
        field: 'generationOptions',
      })
    }
    // Model not in built-in pricing catalog — allow task to proceed;
    // actual billing will be resolved downstream where billing mode is checked.
    if (
      error instanceof BillingOperationError
      && error.code === 'BILLING_UNKNOWN_MODEL'
    ) {
      return null
    }
    throw error
  }
}

function validateVideoOperation(input: unknown) {
  if (input === undefined || input === null) return
  if (!isRecord(input)) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_INVALID',
      field: 'videoOperation',
    })
  }

  const mode = input.mode
  if (mode !== 'edit' && mode !== 'extend') {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_MODE_INVALID',
      field: 'videoOperation.mode',
    })
  }

  const sourceCandidateId = typeof input.sourceCandidateId === 'string' ? input.sourceCandidateId.trim() : ''
  if (!sourceCandidateId) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_SOURCE_CANDIDATE_REQUIRED',
      field: 'videoOperation.sourceCandidateId',
    })
  }

  const instruction = typeof input.instruction === 'string' ? input.instruction.trim() : ''
  if (!instruction) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_INSTRUCTION_REQUIRED',
      field: 'videoOperation.instruction',
    })
  }

  if (mode === 'edit' && input.extendDuration !== undefined) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_EXTEND_DURATION_UNEXPECTED',
      field: 'videoOperation.extendDuration',
    })
  }

  if (
    mode === 'extend'
    && (typeof input.extendDuration !== 'number' || !Number.isFinite(input.extendDuration) || input.extendDuration <= 0)
  ) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_EXTEND_DURATION_REQUIRED',
      field: 'videoOperation.extendDuration',
    })
  }
}

function buildSingleVideoTaskPayload(
  payload: Record<string, unknown>,
  params: {
    requestSeed: string
    requestedCount: number
    sequence: number
  },
) {
  return {
    ...payload,
    count: 1,
    requestedCount: params.requestedCount,
    candidateBatchId: params.requestSeed,
    candidateSequence: params.sequence,
  }
}

function buildVideoTaskDedupeKey(
  panelId: string,
  params: {
    requestSeed: string
    requestedCount: number
    sequence: number
  },
) {
  if (params.requestedCount <= 1) return `video_panel:${panelId}`
  return `video_panel:${panelId}:${params.requestSeed}:${params.sequence}`
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolvePanelVideoPromptForLog(
  payload: Record<string, unknown>,
  panel: {
    videoPrompt: string | null
    firstLastFramePrompt: string | null
    description: string | null
  },
) {
  const videoOperation = isRecord(payload.videoOperation) ? payload.videoOperation : null
  const firstLastFrame = isRecord(payload.firstLastFrame) ? payload.firstLastFrame : null

  const candidates = [
    { source: 'videoOperation.instruction', prompt: readTrimmedString(videoOperation?.instruction) },
    { source: 'firstLastFrame.customPrompt', prompt: readTrimmedString(firstLastFrame?.customPrompt) },
    { source: 'panel.firstLastFramePrompt', prompt: firstLastFrame ? readTrimmedString(panel.firstLastFramePrompt) : '' },
    { source: 'payload.customPrompt', prompt: readTrimmedString(payload.customPrompt) },
    { source: 'panel.videoPrompt', prompt: readTrimmedString(panel.videoPrompt) },
    { source: 'panel.description', prompt: readTrimmedString(panel.description) },
  ]
  return candidates.find((candidate) => candidate.prompt) || { source: null, prompt: '' }
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = normalizeVideoPayload(await request.json())
  requireVideoModelKeyFromPayload(body)
  const locale = resolveRequiredTaskLocale(request, body)
  const isBatch = body?.all === true
  const requestedCount = normalizeVideoGenerationCount(body?.count)
  const requestId = getRequestId(request) || undefined
  const requestSeed = requestId || randomUUID()

  validateFirstLastFrameModel(body?.firstLastFrame)
  validateVideoOperation(body?.videoOperation)
  if (body?.firstLastFrame && body?.videoOperation) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_WITH_FIRSTLASTFRAME_UNSUPPORTED',
      field: 'videoOperation',
    })
  }
  if (body?.videoOperation && requestedCount > 1) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'VIDEO_OPERATION_BATCH_UNSUPPORTED',
      field: 'count',
    })
  }
  const resolvedGenerationOptions = await validateVideoCapabilityCombination({
    payload: body,
    projectId,
    userId: session.user.id,
  })
  const effectiveGenerationOptions = buildResolvedVideoGenerationOptions(
    body.generationOptions,
    resolvedGenerationOptions,
  )
  const taskBody: Record<string, unknown> = {
    ...body,
    ...(effectiveGenerationOptions ? { generationOptions: effectiveGenerationOptions } : {}),
  }
  videoSubmitLogger.info({
    audit: true,
    requestId,
    projectId,
    userId: session.user.id,
    message: 'video generation submit payload',
    details: {
      isBatch,
      requestedCount,
      generationMode: resolveVideoGenerationMode(taskBody),
      videoModel: resolveVideoModelKeyFromPayload(taskBody),
      payload: taskBody,
    },
  })

  if (isBatch) {
    if (taskBody.videoOperation) {
      throw new ApiError('INVALID_PARAMS', {
        code: 'VIDEO_OPERATION_ALL_UNSUPPORTED',
        field: 'videoOperation',
      })
    }
    const episodeId = typeof taskBody.episodeId === 'string' ? taskBody.episodeId : ''
    if (!episodeId) {
      throw new ApiError('INVALID_PARAMS')
    }

    const panels = await prisma.novelPromotionPanel.findMany({
      where: {
        storyboard: { episodeId },
        imageUrl: { not: null },
        OR: [
          { videoUrl: null },
          { videoUrl: '' },
        ],
      },
      select: { id: true },
    })

    if (panels.length === 0) {
      return NextResponse.json({ tasks: [], total: 0 })
    }

    const panelInputs = await Promise.all(
      panels.map(async (panel) => ({
        panelId: panel.id,
        hasOutputAtStart: await hasPanelVideoOutput(panel.id),
      })),
    )

    const results = await Promise.all(
      panelInputs.flatMap((panel) =>
        Array.from({ length: requestedCount }, (_unused, index) =>
          submitTask({
            userId: session.user.id,
            locale,
            requestId,
            projectId,
            episodeId,
            type: TASK_TYPE.VIDEO_PANEL,
            targetType: 'NovelPromotionPanel',
            targetId: panel.panelId,
            payload: withTaskUiPayload(
              buildSingleVideoTaskPayload(taskBody as Record<string, unknown>, {
                requestSeed,
                requestedCount,
                sequence: index,
              }),
              {
                hasOutputAtStart: panel.hasOutputAtStart,
              },
            ),
            dedupeKey: buildVideoTaskDedupeKey(panel.panelId, {
              requestSeed,
              requestedCount,
              sequence: index,
            }),
            billingInfo: buildVideoPanelBillingInfoOrThrow({
              ...(taskBody as Record<string, unknown>),
              count: 1,
            }),
          }),
        ),
      ),
    )

    videoSubmitLogger.info({
      audit: true,
      action: 'video.submit.task_result',
      requestId,
      projectId,
      userId: session.user.id,
      message: 'video generation task submit result',
      details: {
        isBatch: true,
        taskCount: results.length,
        results: results.map((result) => ({
          taskId: result.taskId,
          status: result.status,
          deduped: result.deduped === true,
        })),
      },
    })

    return NextResponse.json({ tasks: results, total: panels.length * requestedCount })
  }

  const storyboardId = taskBody.storyboardId
  const panelIndex = taskBody.panelIndex
  if (!storyboardId || panelIndex === undefined) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findFirst({
    where: { storyboardId, panelIndex: Number(panelIndex) },
    select: {
      id: true,
      imageUrl: true,
      videoPrompt: true,
      firstLastFramePrompt: true,
      description: true,
      videoUrl: true,
      videoCandidates: true,
      videoGenerationMode: true,
    },
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const resolvedPrompt = resolvePanelVideoPromptForLog(taskBody, panel)
  videoSubmitLogger.info({
    audit: true,
    action: 'video.submit.resolved_panel_input',
    requestId,
    projectId,
    userId: session.user.id,
    message: 'video generation resolved panel input',
    details: {
      panelId: panel.id,
      storyboardId,
      panelIndex: Number(panelIndex),
      generationMode: resolveVideoGenerationMode(taskBody),
      promptSource: resolvedPrompt.source,
      prompt: resolvedPrompt.prompt,
      imageUrl: panel.imageUrl,
      videoUrl: panel.videoUrl,
      videoGenerationMode: panel.videoGenerationMode,
      hasVideoCandidates: Boolean(panel.videoCandidates),
      rawPanelFields: {
        videoPrompt: panel.videoPrompt,
        firstLastFramePrompt: panel.firstLastFramePrompt,
        description: panel.description,
      },
    },
  })

  const hasOutputAtStart = await hasPanelVideoOutput(panel.id)

  const results = await Promise.all(
    Array.from({ length: requestedCount }, (_unused, index) =>
      submitTask({
        userId: session.user.id,
        locale,
        requestId,
        projectId,
        type: TASK_TYPE.VIDEO_PANEL,
        targetType: 'NovelPromotionPanel',
        targetId: panel.id,
        payload: withTaskUiPayload(
          buildSingleVideoTaskPayload(taskBody as Record<string, unknown>, {
            requestSeed,
            requestedCount,
            sequence: index,
          }),
          {
            hasOutputAtStart,
          },
        ),
        dedupeKey: buildVideoTaskDedupeKey(panel.id, {
          requestSeed,
          requestedCount,
          sequence: index,
        }),
        billingInfo: buildVideoPanelBillingInfoOrThrow({
          ...(taskBody as Record<string, unknown>),
          count: 1,
        }),
      }),
    ),
  )

  videoSubmitLogger.info({
    audit: true,
    action: 'video.submit.task_result',
    requestId,
    projectId,
    userId: session.user.id,
    message: 'video generation task submit result',
    details: {
      isBatch: false,
      panelId: panel.id,
      taskCount: results.length,
      results: results.map((result) => ({
        taskId: result.taskId,
        status: result.status,
        deduped: result.deduped === true,
      })),
    },
  })

  return NextResponse.json(
    requestedCount === 1
      ? results[0]
      : { tasks: results, total: requestedCount },
  )
})
