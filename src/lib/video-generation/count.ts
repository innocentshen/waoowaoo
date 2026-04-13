export const VIDEO_GENERATION_COUNT_STORAGE_KEY = 'video-count:candidates'

const VIDEO_GENERATION_COUNT_MIN = 1
const VIDEO_GENERATION_COUNT_MAX = 4
const VIDEO_GENERATION_COUNT_DEFAULT = 1

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeVideoGenerationCount(
  value: unknown,
  fallback = VIDEO_GENERATION_COUNT_DEFAULT,
): number {
  const numericValue = toFiniteNumber(value)
  const baseValue = numericValue === null ? fallback : Math.trunc(numericValue)
  if (baseValue < VIDEO_GENERATION_COUNT_MIN) return VIDEO_GENERATION_COUNT_MIN
  if (baseValue > VIDEO_GENERATION_COUNT_MAX) return VIDEO_GENERATION_COUNT_MAX
  return baseValue
}

export function getVideoGenerationCountOptions(): number[] {
  return Array.from(
    { length: VIDEO_GENERATION_COUNT_MAX - VIDEO_GENERATION_COUNT_MIN + 1 },
    (_value, index) => VIDEO_GENERATION_COUNT_MIN + index,
  )
}
