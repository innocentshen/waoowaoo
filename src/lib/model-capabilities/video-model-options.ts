import type { ModelCapabilities } from '@/lib/model-config-contract'

interface VideoModelCapabilityCarrier {
  capabilities?: ModelCapabilities
}

export type SupportedVideoGenerationMode = 'normal' | 'firstlastframe' | 'edit' | 'extend'

function readGenerationModeOptions(model: VideoModelCapabilityCarrier): string[] {
  const options = model.capabilities?.video?.generationModeOptions
  if (!Array.isArray(options)) return []
  return options.filter((value): value is string => typeof value === 'string')
}

export function supportsFirstLastFrame(model: VideoModelCapabilityCarrier): boolean {
  return model.capabilities?.video?.firstlastframe === true
}

export function isFirstLastFrameOnlyModel(model: VideoModelCapabilityCarrier): boolean {
  const generationModeOptions = readGenerationModeOptions(model)
  if (generationModeOptions.length === 0) return false
  return generationModeOptions.every((mode) => mode === 'firstlastframe')
}

export function supportsVideoGenerationMode(
  model: VideoModelCapabilityCarrier,
  mode: SupportedVideoGenerationMode,
): boolean {
  const generationModeOptions = readGenerationModeOptions(model)
  if (generationModeOptions.length === 0) {
    return mode === 'normal'
  }
  return generationModeOptions.includes(mode)
}

export function filterNormalVideoModelOptions<T extends VideoModelCapabilityCarrier>(models: T[]): T[] {
  return filterVideoModelOptionsByGenerationMode(models, 'normal')
}

export function filterVideoModelOptionsByGenerationMode<T extends VideoModelCapabilityCarrier>(
  models: T[],
  mode: SupportedVideoGenerationMode,
): T[] {
  return models.filter((model) => supportsVideoGenerationMode(model, mode))
}
