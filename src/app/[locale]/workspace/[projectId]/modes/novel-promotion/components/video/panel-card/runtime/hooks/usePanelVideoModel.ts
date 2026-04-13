import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  VideoGenerationMode,
  VideoModelOption,
  VideoGenerationOptionValue,
  VideoGenerationOptions,
} from '../../../types'
import type { CapabilitySelections } from '@/lib/model-config-contract'
import {
  normalizeVideoGenerationSelections,
  resolveEffectiveVideoCapabilityDefinitions,
  resolveEffectiveVideoCapabilityFields,
} from '@/lib/model-capabilities/video-effective'
import { filterVideoModelOptionsByGenerationMode } from '@/lib/model-capabilities/video-model-options'
import { projectVideoPricingTiersByFixedSelections } from '@/lib/model-pricing/video-tier'

interface UsePanelVideoModelParams {
  defaultVideoModel: string
  capabilityOverrides?: CapabilitySelections
  userVideoModels?: VideoModelOption[]
  fixedGenerationMode?: VideoGenerationMode
  onPersistSelectedModel?: (modelKey: string) => void
  onPersistGenerationOptions?: (modelKey: string, generationOptions: VideoGenerationOptions) => void
}

interface CapabilityField {
  field: string
  label: string
  labelKey?: string
  unitKey?: string
  optionLabelKeys?: Record<string, string>
  options: VideoGenerationOptionValue[]
  disabledOptions?: VideoGenerationOptionValue[]
  value: VideoGenerationOptionValue | undefined
}

type ResolvedModelConfig = {
  pricingTiers: ReturnType<typeof projectVideoPricingTiersByFixedSelections>
  capabilityDefinitions: ReturnType<typeof resolveEffectiveVideoCapabilityDefinitions>
}

const EMPTY_GENERATION_OPTIONS: VideoGenerationOptions = {}
const EMPTY_VIDEO_MODEL_OPTIONS: VideoModelOption[] = []
const EMPTY_RESOLVED_MODEL_CONFIG: ResolvedModelConfig = {
  pricingTiers: [],
  capabilityDefinitions: [],
}
const filteredVideoModelOptionsCache = new WeakMap<VideoModelOption[], Map<VideoGenerationMode, VideoModelOption[]>>()
const selectionCache = new WeakMap<CapabilitySelections, Map<string, VideoGenerationOptions>>()
const resolvedModelConfigCache = new WeakMap<VideoModelOption, Map<VideoGenerationMode, ResolvedModelConfig>>()

function toFieldLabel(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function parseByOptionType(
  input: string,
  sample: VideoGenerationOptionValue,
): VideoGenerationOptionValue {
  if (typeof sample === 'number') return Number(input)
  if (typeof sample === 'boolean') return input === 'true'
  return input
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isGenerationOptionValue(value: unknown): value is VideoGenerationOptionValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function readSelectionForModel(
  capabilityOverrides: CapabilitySelections | undefined,
  modelKey: string,
): VideoGenerationOptions {
  if (!modelKey || !capabilityOverrides) return EMPTY_GENERATION_OPTIONS

  const cachedSelections = selectionCache.get(capabilityOverrides)
  if (cachedSelections?.has(modelKey)) {
    return cachedSelections.get(modelKey) || EMPTY_GENERATION_OPTIONS
  }

  const rawSelection = capabilityOverrides[modelKey]
  if (!isRecord(rawSelection)) {
    if (cachedSelections) {
      cachedSelections.set(modelKey, EMPTY_GENERATION_OPTIONS)
    } else {
      selectionCache.set(capabilityOverrides, new Map([[modelKey, EMPTY_GENERATION_OPTIONS]]))
    }
    return EMPTY_GENERATION_OPTIONS
  }

  const selection: VideoGenerationOptions = {}
  for (const [field, value] of Object.entries(rawSelection)) {
    if (!isGenerationOptionValue(value)) continue
    selection[field] = value
  }
  if (cachedSelections) {
    cachedSelections.set(modelKey, selection)
  } else {
    selectionCache.set(capabilityOverrides, new Map([[modelKey, selection]]))
  }
  return selection
}

function getFilteredVideoModelOptions(
  userVideoModels: VideoModelOption[],
  fixedGenerationMode: VideoGenerationMode,
) {
  const cachedModes = filteredVideoModelOptionsCache.get(userVideoModels)
  if (cachedModes?.has(fixedGenerationMode)) {
    return cachedModes.get(fixedGenerationMode) || EMPTY_VIDEO_MODEL_OPTIONS
  }

  const filteredOptions = filterVideoModelOptionsByGenerationMode(userVideoModels, fixedGenerationMode)
  if (cachedModes) {
    cachedModes.set(fixedGenerationMode, filteredOptions)
  } else {
    filteredVideoModelOptionsCache.set(userVideoModels, new Map([[fixedGenerationMode, filteredOptions]]))
  }
  return filteredOptions
}

function getResolvedModelConfig(
  selectedOption: VideoModelOption | undefined,
  fixedGenerationMode: VideoGenerationMode,
): ResolvedModelConfig {
  if (!selectedOption) return EMPTY_RESOLVED_MODEL_CONFIG

  const cachedModes = resolvedModelConfigCache.get(selectedOption)
  if (cachedModes?.has(fixedGenerationMode)) {
    return cachedModes.get(fixedGenerationMode) || EMPTY_RESOLVED_MODEL_CONFIG
  }

  const pricingTiers = projectVideoPricingTiersByFixedSelections({
    tiers: selectedOption.videoPricingTiers ?? [],
    fixedSelections: {
      generationMode: fixedGenerationMode,
    },
  })
  const resolvedConfig: ResolvedModelConfig = {
    pricingTiers,
    capabilityDefinitions: resolveEffectiveVideoCapabilityDefinitions({
      videoCapabilities: selectedOption.capabilities?.video,
      pricingTiers,
    }).filter((definition) => definition.field !== 'generationMode'),
  }

  if (cachedModes) {
    cachedModes.set(fixedGenerationMode, resolvedConfig)
  } else {
    resolvedModelConfigCache.set(selectedOption, new Map([[fixedGenerationMode, resolvedConfig]]))
  }

  return resolvedConfig
}

export function usePanelVideoModel({
  defaultVideoModel,
  capabilityOverrides,
  userVideoModels,
  fixedGenerationMode = 'normal',
  onPersistSelectedModel,
  onPersistGenerationOptions,
}: UsePanelVideoModelParams) {
  const [selectedModel, setSelectedModel] = useState(defaultVideoModel || '')
  const [generationOptions, setGenerationOptions] = useState<VideoGenerationOptions>(() =>
    readSelectionForModel(capabilityOverrides, defaultVideoModel || ''),
  )
  const videoModelOptions = useMemo(
    () => getFilteredVideoModelOptions(userVideoModels ?? EMPTY_VIDEO_MODEL_OPTIONS, fixedGenerationMode),
    [fixedGenerationMode, userVideoModels],
  )
  const selectedOption = useMemo(
    () => videoModelOptions.find((option) => option.value === selectedModel),
    [selectedModel, videoModelOptions],
  )
  const resolvedModelConfig = useMemo(
    () => getResolvedModelConfig(selectedOption, fixedGenerationMode),
    [fixedGenerationMode, selectedOption],
  )
  const pricingTiers = resolvedModelConfig.pricingTiers

  useEffect(() => {
    setSelectedModel(defaultVideoModel || '')
  }, [defaultVideoModel])

  useEffect(() => {
    if (!selectedModel) {
      if (videoModelOptions.length > 0) {
        setSelectedModel(videoModelOptions[0].value)
      }
      return
    }
    if (videoModelOptions.some((option) => option.value === selectedModel)) return
    setSelectedModel(videoModelOptions[0]?.value || '')
  }, [selectedModel, videoModelOptions])

  const capabilityDefinitions = resolvedModelConfig.capabilityDefinitions

  const selectedModelOverrides = useMemo(
    () => readSelectionForModel(capabilityOverrides, selectedModel),
    [capabilityOverrides, selectedModel],
  )

  useEffect(() => {
    setGenerationOptions(normalizeVideoGenerationSelections({
      definitions: capabilityDefinitions,
      pricingTiers,
      selection: selectedModelOverrides,
    }))
  }, [selectedModel, capabilityDefinitions, pricingTiers, selectedModelOverrides])

  useEffect(() => {
    setGenerationOptions((previous) => normalizeVideoGenerationSelections({
      definitions: capabilityDefinitions,
      pricingTiers,
      selection: previous,
    }))
  }, [capabilityDefinitions, pricingTiers])

  const effectiveFields = useMemo(
    () => resolveEffectiveVideoCapabilityFields({
      definitions: capabilityDefinitions,
      pricingTiers,
      selection: generationOptions,
    }),
    [capabilityDefinitions, generationOptions, pricingTiers],
  )
  const missingCapabilityFields = useMemo(
    () => effectiveFields
      .filter((field) => field.options.length === 0 || field.value === undefined)
      .map((field) => field.field),
    [effectiveFields],
  )
  const effectiveFieldMap = useMemo(
    () => new Map(effectiveFields.map((field) => [field.field, field])),
    [effectiveFields],
  )
  const definitionFieldMap = useMemo(
    () => new Map(capabilityDefinitions.map((definition) => [definition.field, definition])),
    [capabilityDefinitions],
  )
  const capabilityFields: CapabilityField[] = useMemo(() => {
    return capabilityDefinitions.map((definition) => {
      const effectiveField = effectiveFieldMap.get(definition.field)
      const enabledOptions = effectiveField?.options ?? []
      return {
        field: definition.field,
        label: toFieldLabel(definition.field),
        labelKey: definition.fieldI18n?.labelKey,
        unitKey: definition.fieldI18n?.unitKey,
        optionLabelKeys: definition.fieldI18n?.optionLabelKeys,
        options: definition.options as VideoGenerationOptionValue[],
        disabledOptions: (definition.options as VideoGenerationOptionValue[])
          .filter((option) => !enabledOptions.includes(option)),
        value: effectiveField?.value as VideoGenerationOptionValue | undefined,
      }
    })
  }, [capabilityDefinitions, effectiveFieldMap])

  const handleModelChange = useCallback((modelKey: string) => {
    setSelectedModel(modelKey)
    onPersistSelectedModel?.(modelKey)
  }, [onPersistSelectedModel])

  const setCapabilityValue = useCallback((field: string, rawValue: string) => {
    if (!selectedModel) return
    const definitionField = definitionFieldMap.get(field)
    if (!definitionField || definitionField.options.length === 0) return
    const parsedValue = parseByOptionType(rawValue, definitionField.options[0])
    if (!definitionField.options.includes(parsedValue)) return
    const nextGenerationOptions = normalizeVideoGenerationSelections({
      definitions: capabilityDefinitions,
      pricingTiers,
      selection: {
        ...generationOptions,
        [field]: parsedValue,
      },
      pinnedFields: [field],
    })
    setGenerationOptions(nextGenerationOptions)
    onPersistGenerationOptions?.(selectedModel, nextGenerationOptions)
  }, [
    capabilityDefinitions,
    definitionFieldMap,
    generationOptions,
    onPersistGenerationOptions,
    pricingTiers,
    selectedModel,
  ])

  return {
    selectedModel,
    handleModelChange,
    setSelectedModel,
    generationOptions,
    capabilityFields,
    setCapabilityValue,
    missingCapabilityFields,
    videoModelOptions,
  }
}
