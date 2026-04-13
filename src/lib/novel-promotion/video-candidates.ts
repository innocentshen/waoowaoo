export type PanelVideoGenerationMode = 'normal' | 'firstlastframe' | 'edit' | 'extend'

export interface PanelVideoCandidateMeta {
  sourceCandidateId?: string | null
  sourceGenerationMode?: PanelVideoGenerationMode | null
  extendDuration?: number | null
}

export interface StoredPanelVideoCandidate {
  id: string
  videoUrl: string
  generationMode: PanelVideoGenerationMode
  createdAt: string
  model?: string | null
  prompt?: string | null
  meta?: PanelVideoCandidateMeta | null
}

export interface ResolvedPanelVideoCandidate extends StoredPanelVideoCandidate {
  isSelected: boolean
}

type CandidateDurationLike = {
  id: string
  generationMode: PanelVideoGenerationMode
  meta?: PanelVideoCandidateMeta | null
}

interface PanelVideoCandidateSource {
  videoCandidates?: string | null
  videoUrl?: string | null
  videoGenerationMode?: string | null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeGenerationMode(value: unknown): PanelVideoGenerationMode {
  if (value === 'firstlastframe' || value === 'edit' || value === 'extend') {
    return value
  }
  return 'normal'
}

function normalizeCandidateMeta(value: unknown): PanelVideoCandidateMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidateMeta = value as Record<string, unknown>
  const sourceCandidateId = isNonEmptyString(candidateMeta.sourceCandidateId)
    ? candidateMeta.sourceCandidateId.trim()
    : null
  const sourceGenerationMode = candidateMeta.sourceGenerationMode === undefined || candidateMeta.sourceGenerationMode === null
    ? null
    : normalizeGenerationMode(candidateMeta.sourceGenerationMode)
  const extendDuration = typeof candidateMeta.extendDuration === 'number' && Number.isFinite(candidateMeta.extendDuration)
    ? Math.round(candidateMeta.extendDuration)
    : null

  if (!sourceCandidateId && !sourceGenerationMode && extendDuration === null) return null

  return {
    ...(sourceCandidateId ? { sourceCandidateId } : {}),
    ...(sourceGenerationMode ? { sourceGenerationMode } : {}),
    ...(extendDuration !== null ? { extendDuration } : {}),
  }
}

function sanitizeCandidateId(raw: string) {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'candidate'
}

function buildSyntheticCandidateId(prefix: string, videoUrl: string, index = 0) {
  const suffix = sanitizeCandidateId(videoUrl).slice(-48) || `${index + 1}`
  return `${prefix}-${index + 1}-${suffix}`
}

function toStoredPanelVideoCandidate(
  value: unknown,
  index: number,
): StoredPanelVideoCandidate | null {
  if (typeof value === 'string') {
    const videoUrl = value.trim()
    if (!videoUrl) return null
    return {
      id: buildSyntheticCandidateId('legacy-video', videoUrl, index),
      videoUrl,
      generationMode: 'normal',
      createdAt: '',
      model: null,
      prompt: null,
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const videoUrl =
    typeof candidate.videoUrl === 'string'
      ? candidate.videoUrl.trim()
      : typeof candidate.url === 'string'
        ? candidate.url.trim()
        : ''
  if (!videoUrl) return null

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? candidate.id.trim()
        : buildSyntheticCandidateId('video-candidate', videoUrl, index),
    videoUrl,
    generationMode: normalizeGenerationMode(candidate.generationMode),
    createdAt:
      typeof candidate.createdAt === 'string'
        ? candidate.createdAt
        : '',
    model:
      typeof candidate.model === 'string'
        ? candidate.model
        : null,
    prompt:
      typeof candidate.prompt === 'string'
        ? candidate.prompt
        : null,
    meta: normalizeCandidateMeta(candidate.meta),
  }
}

function toStoredCandidateArray(
  value: unknown,
): StoredPanelVideoCandidate[] {
  if (!value) return []

  const parsed =
    typeof value === 'string'
      ? (() => {
        try {
          return JSON.parse(value)
        } catch {
          return []
        }
      })()
      : value

  if (!Array.isArray(parsed)) return []

  const deduped = new Map<string, StoredPanelVideoCandidate>()
  for (const [index, item] of parsed.entries()) {
    const candidate = toStoredPanelVideoCandidate(item, index)
    if (!candidate) continue
    if (deduped.has(candidate.id)) continue
    deduped.set(candidate.id, candidate)
  }
  return Array.from(deduped.values())
}

function ensureSelectedVideoIncluded(
  candidates: StoredPanelVideoCandidate[],
  selectedVideoUrl: string | null | undefined,
  selectedGenerationMode: string | null | undefined,
) {
  const normalizedSelectedUrl = typeof selectedVideoUrl === 'string' ? selectedVideoUrl.trim() : ''
  if (!normalizedSelectedUrl) return candidates
  if (candidates.some((candidate) => candidate.videoUrl === normalizedSelectedUrl)) return candidates

  return [
    ...candidates,
    {
      id: buildSyntheticCandidateId('selected-video', normalizedSelectedUrl, candidates.length),
      videoUrl: normalizedSelectedUrl,
      generationMode: normalizeGenerationMode(selectedGenerationMode),
      createdAt: '',
      model: null,
      prompt: null,
    },
  ]
}

function withoutSelectionFlag(candidate: ResolvedPanelVideoCandidate | StoredPanelVideoCandidate): StoredPanelVideoCandidate {
  const { id, videoUrl, generationMode, createdAt, model = null, prompt = null, meta = null } = candidate
  return {
    id,
    videoUrl,
    generationMode,
    createdAt,
    model,
    prompt,
    meta,
  }
}

function normalizeFiniteDuration(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function parseStoredPanelVideoCandidates(raw: unknown): StoredPanelVideoCandidate[] {
  return toStoredCandidateArray(raw)
}

export function resolvePanelVideoCandidates(
  source: PanelVideoCandidateSource,
): ResolvedPanelVideoCandidate[] {
  const baseCandidates = ensureSelectedVideoIncluded(
    toStoredCandidateArray(source.videoCandidates),
    source.videoUrl,
    source.videoGenerationMode,
  )
  const selectedVideoUrl = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : ''

  return baseCandidates.map((candidate) => ({
    ...candidate,
    isSelected: !!selectedVideoUrl && candidate.videoUrl === selectedVideoUrl,
  }))
}

export function estimatePanelVideoCandidateDurationSeconds(
  candidates: readonly CandidateDurationLike[],
  candidateId: string,
  baseDurationSeconds: number | null | undefined,
): number | null {
  const normalizedBaseDuration = normalizeFiniteDuration(baseDurationSeconds)
  if (!isNonEmptyString(candidateId)) return normalizedBaseDuration

  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const visited = new Set<string>()

  const resolveDuration = (currentId: string): number | null => {
    const candidate = byId.get(currentId)
    if (!candidate || visited.has(currentId)) return normalizedBaseDuration
    visited.add(currentId)

    const sourceCandidateId = isNonEmptyString(candidate.meta?.sourceCandidateId)
      ? candidate.meta.sourceCandidateId.trim()
      : ''
    const sourceDuration = sourceCandidateId ? resolveDuration(sourceCandidateId) : normalizedBaseDuration

    if (candidate.generationMode === 'extend') {
      const extendDuration = normalizeFiniteDuration(candidate.meta?.extendDuration)
      if (sourceDuration !== null && extendDuration !== null) {
        return sourceDuration + extendDuration
      }
    }

    return sourceDuration
  }

  return resolveDuration(candidateId)
}

export function serializePanelVideoCandidates(
  candidates: readonly StoredPanelVideoCandidate[],
): string | null {
  const normalized = candidates
    .map(withoutSelectionFlag)
    .filter((candidate) => isNonEmptyString(candidate.id) && isNonEmptyString(candidate.videoUrl))
  if (normalized.length === 0) return null
  return JSON.stringify(normalized)
}

export function appendPanelVideoCandidate(
  source: PanelVideoCandidateSource,
  candidate: StoredPanelVideoCandidate,
): {
  candidates: StoredPanelVideoCandidate[]
  serialized: string | null
  selectedVideoUrl: string | null
  selectedGenerationMode: PanelVideoGenerationMode | null
} {
  const currentCandidates = resolvePanelVideoCandidates(source).map(withoutSelectionFlag)
  const hasExistingCandidate = currentCandidates.some((item) => item.id === candidate.id || item.videoUrl === candidate.videoUrl)
  const nextCandidates = hasExistingCandidate
    ? currentCandidates
    : [...currentCandidates, withoutSelectionFlag(candidate)]

  const selectedVideoUrl =
    isNonEmptyString(source.videoUrl)
      ? source.videoUrl.trim()
      : candidate.videoUrl
  const selectedCandidate = nextCandidates.find((item) => item.videoUrl === selectedVideoUrl) || candidate

  return {
    candidates: nextCandidates,
    serialized: serializePanelVideoCandidates(nextCandidates),
    selectedVideoUrl,
    selectedGenerationMode: selectedCandidate?.generationMode || null,
  }
}

export function selectPanelVideoCandidate(
  source: PanelVideoCandidateSource,
  candidateId: string,
): {
  candidates: StoredPanelVideoCandidate[]
  serialized: string | null
  selectedCandidate: StoredPanelVideoCandidate
} | null {
  const candidates = resolvePanelVideoCandidates(source).map(withoutSelectionFlag)
  const selectedCandidate = candidates.find((candidate) => candidate.id === candidateId)
  if (!selectedCandidate) return null

  return {
    candidates,
    serialized: serializePanelVideoCandidates(candidates),
    selectedCandidate,
  }
}

export function removePanelVideoCandidate(
  source: PanelVideoCandidateSource,
  candidateId: string,
): {
  removedCandidate: StoredPanelVideoCandidate
  candidates: StoredPanelVideoCandidate[]
  serialized: string | null
  selectedCandidate: StoredPanelVideoCandidate | null
  selectedChanged: boolean
} | null {
  const candidates = resolvePanelVideoCandidates(source).map(withoutSelectionFlag)
  const removedCandidate = candidates.find((candidate) => candidate.id === candidateId)
  if (!removedCandidate) return null

  const nextCandidates = candidates.filter((candidate) => candidate.id !== candidateId)
  const currentSelectedVideoUrl = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : ''
  const removedWasSelected = !!currentSelectedVideoUrl && removedCandidate.videoUrl === currentSelectedVideoUrl

  const selectedCandidate = removedWasSelected
    ? (nextCandidates[nextCandidates.length - 1] || null)
    : (nextCandidates.find((candidate) => candidate.videoUrl === currentSelectedVideoUrl) || nextCandidates[nextCandidates.length - 1] || null)

  return {
    removedCandidate,
    candidates: nextCandidates,
    serialized: serializePanelVideoCandidates(nextCandidates),
    selectedCandidate,
    selectedChanged: removedWasSelected || !currentSelectedVideoUrl || (selectedCandidate?.videoUrl || null) !== currentSelectedVideoUrl,
  }
}

export function countPanelVideoCandidates(source: PanelVideoCandidateSource) {
  return resolvePanelVideoCandidates(source).length
}
