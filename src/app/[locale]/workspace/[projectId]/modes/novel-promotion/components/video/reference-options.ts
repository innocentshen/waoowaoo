import type { Character, Location, Prop } from '@/types/project'
import { fuzzyMatchLocation } from '../script-view/clip-asset-utils'
import type {
  VideoPanel,
  VideoReferenceCharacterOption,
  VideoReferenceNamedOption,
  VideoReferenceOptions,
} from './types'
import { buildVideoReferenceCharacterKey } from './reference-selection'

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function splitAliases(value: string): string[] {
  return value
    .split('/')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function findCharacterByReference(characters: Character[], referenceName: string): Character | undefined {
  const target = normalizeName(referenceName)
  if (!target) return undefined

  const exact = characters.find((character) => normalizeName(character.name) === target)
  if (exact) return exact

  const targetAliases = splitAliases(referenceName)
  return characters.find((character) => {
    const aliases = new Set<string>([
      ...splitAliases(character.name),
      ...(character.aliases || []).map((alias) => normalizeName(alias)),
    ])
    return targetAliases.some((alias) => aliases.has(alias))
  })
}

function resolveAppearanceDescription(appearance: Character['appearances'][number] | undefined): string | null {
  if (!appearance) return null

  if (Array.isArray(appearance.descriptions) && appearance.descriptions.length > 0) {
    const selectedIndex = typeof appearance.selectedIndex === 'number' ? appearance.selectedIndex : 0
    return appearance.descriptions[selectedIndex] || appearance.descriptions[0] || null
  }

  return appearance.description || null
}

function resolveCharacterImageUrl(appearance: Character['appearances'][number] | undefined): string | null {
  if (!appearance) return null

  const selectedIndex = typeof appearance.selectedIndex === 'number' ? appearance.selectedIndex : 0
  return appearance.imageUrl || appearance.imageUrls[selectedIndex] || appearance.imageUrls[0] || null
}

function resolveNamedAssetImage(option: Location | Prop | undefined): { imageUrl: string | null; description: string | null } {
  if (!option) {
    return {
      imageUrl: null,
      description: null,
    }
  }

  const selectedImage = option.images.find((image) => image.isSelected) || option.images[0]
  return {
    imageUrl: selectedImage?.imageUrl || null,
    description: selectedImage?.description || option.summary || null,
  }
}

function pushUniqueNamedOption(target: VideoReferenceNamedOption[], option: VideoReferenceNamedOption) {
  if (target.some((item) => normalizeName(item.name) === normalizeName(option.name))) return
  target.push(option)
}

function pushUniqueCharacterOption(target: VideoReferenceCharacterOption[], option: VideoReferenceCharacterOption) {
  if (target.some((item) => item.key === option.key)) return
  target.push(option)
}

export function buildPanelVideoReferenceOptions(params: {
  panel: VideoPanel
  characters: Character[]
  locations: Location[]
  props: Prop[]
}): VideoReferenceOptions {
  const characterOptions: VideoReferenceCharacterOption[] = []
  const locationOptions: VideoReferenceNamedOption[] = []
  const propOptions: VideoReferenceNamedOption[] = []

  for (const entry of params.panel.textPanel?.characters || []) {
    const reference = typeof entry === 'string'
      ? { name: entry }
      : { name: entry.name || '', appearance: entry.appearance || undefined }
    const referenceName = reference.name.trim()
    if (!referenceName) continue

    const character = findCharacterByReference(params.characters, referenceName)
    const appearance = reference.appearance
      ? character?.appearances.find((item) => normalizeName(item.changeReason || '') === normalizeName(reference.appearance || ''))
      : character?.appearances[0]
    const resolvedName = character?.name || referenceName
    const resolvedAppearance = appearance?.changeReason || reference.appearance
    const label = resolvedAppearance ? `${resolvedName} · ${resolvedAppearance}` : resolvedName

    pushUniqueCharacterOption(characterOptions, {
      key: buildVideoReferenceCharacterKey({
        name: resolvedName,
        ...(resolvedAppearance ? { appearance: resolvedAppearance } : {}),
      }),
      name: resolvedName,
      ...(resolvedAppearance ? { appearance: resolvedAppearance } : {}),
      label,
      imageUrl: resolveCharacterImageUrl(appearance),
      description: resolveAppearanceDescription(appearance) || character?.introduction || null,
    })
  }

  for (const locationName of params.panel.textPanel?.locations || []) {
    const trimmed = locationName.trim()
    if (!trimmed) continue
    const location = params.locations.find((item) => fuzzyMatchLocation(trimmed, item.name))
    const assetImage = resolveNamedAssetImage(location)

    pushUniqueNamedOption(locationOptions, {
      key: normalizeName(trimmed),
      name: location?.name || trimmed,
      imageUrl: assetImage.imageUrl,
      description: assetImage.description,
    })
  }

  for (const propName of params.panel.textPanel?.props || []) {
    const trimmed = propName.trim()
    if (!trimmed) continue
    const prop = params.props.find((item) => normalizeName(item.name) === normalizeName(trimmed))
    const assetImage = resolveNamedAssetImage(prop)

    pushUniqueNamedOption(propOptions, {
      key: normalizeName(trimmed),
      name: prop?.name || trimmed,
      imageUrl: assetImage.imageUrl,
      description: assetImage.description,
    })
  }

  return {
    characters: characterOptions,
    locations: locationOptions,
    props: propOptions,
  }
}
