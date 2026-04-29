'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ModelCapabilityDropdown } from '@/components/ui/config-modals/ModelCapabilityDropdown'
import { resolvePreferredCapabilityDefault } from '@/lib/model-capabilities/defaults'
import type {
  CapabilitySelections,
  CapabilityValue,
  ModelCapabilities,
} from '@/lib/model-config-contract'

interface ImageModelOption {
  value: string
  label: string
  provider?: string
  providerName?: string
  capabilities?: ModelCapabilities
}

interface CapabilityFieldDefinition {
  field: string
  options: CapabilityValue[]
  label: string
}

interface StoryboardImageModelSelectorProps {
  models: ImageModelOption[]
  value?: string
  videoRatio: string
  capabilityOverrides: CapabilitySelections
  onUpdateProjectConfig: (key: string, value: unknown) => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isCapabilityValue(value: unknown): value is CapabilityValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function toFieldLabel(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function parseBySample(input: string, sample: CapabilityValue): CapabilityValue {
  if (typeof sample === 'number') return Number(input)
  if (typeof sample === 'boolean') return input === 'true'
  return input
}

function extractImageCapabilityFields(capabilities: ModelCapabilities | undefined): CapabilityFieldDefinition[] {
  const imageCapabilities = capabilities?.image
  if (!isRecord(imageCapabilities)) return []

  return Object.entries(imageCapabilities)
    .filter((entry): entry is [string, CapabilityValue[]] => {
      const [key, value] = entry
      return key.endsWith('Options')
        && Array.isArray(value)
        && value.length > 0
        && value.every(isCapabilityValue)
    })
    .map(([key, options]) => {
      const field = key.slice(0, -'Options'.length)
      return {
        field,
        options,
        label: toFieldLabel(field),
      }
    })
}

function readCapabilitySelectionForModel(
  overrides: CapabilitySelections | undefined,
  modelKey: string | undefined,
): Record<string, CapabilityValue> {
  if (!modelKey || !overrides) return {}
  const rawSelection = overrides[modelKey]
  if (!isRecord(rawSelection)) return {}

  const selection: Record<string, CapabilityValue> = {}
  for (const [field, value] of Object.entries(rawSelection)) {
    if (isCapabilityValue(value)) {
      selection[field] = value
    }
  }
  return selection
}

function getSelectionSignature(selection: Record<string, CapabilityValue>): string {
  return JSON.stringify(
    Object.entries(selection).sort(([leftField], [rightField]) => leftField.localeCompare(rightField)),
  )
}

function areSelectionsEqual(
  left: Record<string, CapabilityValue>,
  right: Record<string, CapabilityValue>,
): boolean {
  const leftKeys = Object.keys(left)
  if (leftKeys.length !== Object.keys(right).length) return false
  return leftKeys.every((key) => left[key] === right[key])
}

function resolveCapabilityDefaultValue(
  field: string,
  options: CapabilityValue[],
  videoRatio: string,
): CapabilityValue | undefined {
  if (field === 'aspectRatio' && options.includes(videoRatio)) return videoRatio
  return resolvePreferredCapabilityDefault(field, options)
}

function buildSelectionWithDefaults(
  model: ImageModelOption | undefined,
  videoRatio: string,
  currentSelection: Record<string, CapabilityValue>,
): Record<string, CapabilityValue> {
  const fields = extractImageCapabilityFields(model?.capabilities)
  if (fields.length === 0) return currentSelection

  const nextSelection = { ...currentSelection }
  for (const field of fields) {
    if (nextSelection[field.field] !== undefined) continue
    const defaultValue = resolveCapabilityDefaultValue(field.field, field.options, videoRatio)
    if (defaultValue !== undefined) {
      nextSelection[field.field] = defaultValue
    }
  }
  return nextSelection
}

function replaceCapabilitySelectionForModel(
  overrides: CapabilitySelections,
  modelKey: string,
  selection: Record<string, CapabilityValue>,
): CapabilitySelections {
  const nextOverrides: CapabilitySelections = { ...overrides }
  if (Object.keys(selection).length === 0) {
    delete nextOverrides[modelKey]
    return nextOverrides
  }
  nextOverrides[modelKey] = selection
  return nextOverrides
}

function isModelCompatibleWithVideoRatio(model: ImageModelOption, videoRatio: string): boolean {
  const aspectRatioOptions = model.capabilities?.image?.aspectRatioOptions
  if (!Array.isArray(aspectRatioOptions) || aspectRatioOptions.length === 0) return true
  return aspectRatioOptions.includes(videoRatio)
}

export default function StoryboardImageModelSelector({
  models,
  value,
  videoRatio,
  capabilityOverrides,
  onUpdateProjectConfig,
}: StoryboardImageModelSelectorProps) {
  const t = useTranslations('configModal')
  const [optimisticModel, setOptimisticModel] = useState(value || '')
  const [optimisticSelection, setOptimisticSelection] = useState<Record<string, CapabilityValue> | null>(null)

  useEffect(() => {
    setOptimisticModel(value || '')
    setOptimisticSelection(null)
  }, [value])

  const modelOptions = useMemo(
    () => models.map((model) => ({
      ...model,
      disabled: !isModelCompatibleWithVideoRatio(model, videoRatio),
    })),
    [models, videoRatio],
  )

  const selectedModel = useMemo(
    () => models.find((model) => model.value === optimisticModel),
    [models, optimisticModel],
  )
  const capabilityFields = useMemo(
    () => extractImageCapabilityFields(selectedModel?.capabilities),
    [selectedModel?.capabilities],
  )
  const externalSelection = useMemo(
    () => readCapabilitySelectionForModel(capabilityOverrides, optimisticModel),
    [capabilityOverrides, optimisticModel],
  )
  const externalSelectionSignature = useMemo(
    () => getSelectionSignature(externalSelection),
    [externalSelection],
  )
  const activeSelection = optimisticSelection ?? externalSelection

  useEffect(() => {
    if ((value || '') === optimisticModel) {
      setOptimisticSelection(null)
    }
  }, [externalSelectionSignature, optimisticModel, value])

  const persistSelectionForModel = useCallback((modelKey: string, selection: Record<string, CapabilityValue>) => {
    const nextOverrides = replaceCapabilitySelectionForModel(capabilityOverrides, modelKey, selection)
    void onUpdateProjectConfig('capabilityOverrides', nextOverrides)
  }, [capabilityOverrides, onUpdateProjectConfig])

  const handleModelChange = useCallback((modelKey: string) => {
    const nextModel = models.find((model) => model.value === modelKey)
    const currentSelection = readCapabilitySelectionForModel(capabilityOverrides, modelKey)
    const nextSelection = buildSelectionWithDefaults(nextModel, videoRatio, currentSelection)

    setOptimisticModel(modelKey)
    setOptimisticSelection(nextSelection)
    void onUpdateProjectConfig('storyboardModel', modelKey)
    if (!areSelectionsEqual(currentSelection, nextSelection)) {
      persistSelectionForModel(modelKey, nextSelection)
    }
  }, [
    capabilityOverrides,
    models,
    onUpdateProjectConfig,
    persistSelectionForModel,
    videoRatio,
  ])

  const handleCapabilityChange = useCallback((field: string, rawValue: string, sample: CapabilityValue) => {
    if (!optimisticModel) return
    const definition = capabilityFields.find((item) => item.field === field)
    if (!definition || definition.options.length === 0) return

    const nextSelection = { ...activeSelection }
    if (!rawValue) {
      delete nextSelection[field]
    } else {
      const parsedValue = parseBySample(rawValue, sample)
      if (!definition.options.includes(parsedValue)) return
      nextSelection[field] = parsedValue
    }

    setOptimisticSelection(nextSelection)
    persistSelectionForModel(optimisticModel, nextSelection)
  }, [
    activeSelection,
    capabilityFields,
    optimisticModel,
    persistSelectionForModel,
  ])

  if (models.length === 0) return null

  return (
    <div className="w-full min-w-[260px] max-w-[340px] space-y-1">
      <div className="text-[11px] font-medium text-[var(--glass-text-tertiary)]">
        {t('storyboardModel')}
      </div>
      <ModelCapabilityDropdown
        compact
        models={modelOptions}
        value={optimisticModel || undefined}
        onModelChange={handleModelChange}
        capabilityFields={capabilityFields}
        capabilityOverrides={activeSelection}
        onCapabilityChange={handleCapabilityChange}
        placeholder={t('pleaseSelect')}
      />
    </div>
  )
}
