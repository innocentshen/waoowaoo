import type {
  VideoReferenceCharacter,
  VideoReferenceNamedOption,
  VideoReferenceOptions,
  VideoReferenceSelection,
} from './types'

export function buildVideoReferenceCharacterKey(input: Pick<VideoReferenceCharacter, 'name' | 'appearance'>): string {
  const name = input.name.trim().toLowerCase()
  const appearance = input.appearance?.trim().toLowerCase() || ''
  return `${name}::${appearance}`
}

export function normalizeVideoReferenceCharacters(
  value: VideoReferenceSelection['characters'],
): VideoReferenceCharacter[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const normalized: VideoReferenceCharacter[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    if (!name) continue
    const appearance = typeof item.appearance === 'string' ? item.appearance.trim() : ''
    const nextItem = appearance ? { name, appearance } : { name }
    const key = buildVideoReferenceCharacterKey(nextItem)
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(nextItem)
  }

  return normalized
}

export function normalizeVideoReferenceNames(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(trimmed)
  }

  return normalized
}

export function normalizeVideoReferenceSelection(
  selection?: VideoReferenceSelection | null,
): VideoReferenceSelection {
  const includeCharacters = selection?.includeCharacters === true
  const includeLocation = selection?.includeLocation === true
  const includeProps = selection?.includeProps === true

  const characters = includeCharacters
    ? normalizeVideoReferenceCharacters(selection?.characters)
    : []
  const locations = includeLocation
    ? normalizeVideoReferenceNames(selection?.locations)
    : []
  const props = includeProps
    ? normalizeVideoReferenceNames(selection?.props)
    : []

  return {
    includeCharacters,
    includeLocation,
    includeProps,
    ...(characters.length > 0 ? { characters } : {}),
    ...(locations.length > 0 ? { locations } : {}),
    ...(props.length > 0 ? { props } : {}),
  }
}

export function isVideoReferenceSelectionEmpty(selection?: VideoReferenceSelection | null): boolean {
  return !selection?.includeCharacters
    && !selection?.includeLocation
    && !selection?.includeProps
}

export function resolveSelectedCharacterReferences(
  selection: VideoReferenceSelection | undefined,
  options: VideoReferenceOptions | undefined,
): VideoReferenceCharacter[] {
  if (selection?.includeCharacters !== true) return []
  const normalized = normalizeVideoReferenceCharacters(selection.characters)
  if (normalized.length > 0 || !options || options.characters.length === 0) return normalized
  return options.characters.map((option) => (
    option.appearance
      ? { name: option.name, appearance: option.appearance }
      : { name: option.name }
  ))
}

export function resolveSelectedNamedReferences(
  enabled: boolean | undefined,
  values: string[] | undefined,
  options: VideoReferenceNamedOption[] | undefined,
): string[] {
  if (enabled !== true) return []
  const normalized = normalizeVideoReferenceNames(values)
  if (normalized.length > 0 || !options || options.length === 0) return normalized
  return options.map((option) => option.name)
}
