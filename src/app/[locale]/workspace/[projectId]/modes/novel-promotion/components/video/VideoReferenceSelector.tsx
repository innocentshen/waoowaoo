'use client'

import React, { useEffect, useState } from 'react'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import type {
  VideoReferenceCharacter,
  VideoReferenceCharacterOption,
  VideoReferenceNamedOption,
  VideoReferenceOptions,
  VideoReferenceSelection,
} from './types'
import {
  buildVideoReferenceCharacterKey,
  normalizeVideoReferenceSelection,
  resolveSelectedCharacterReferences,
  resolveSelectedNamedReferences,
} from './reference-selection'

type TranslateFn = (key: string, values?: Record<string, unknown>) => string
type ReferenceTabKey = 'characters' | 'locations' | 'props'

interface VideoReferenceSelectorProps {
  t: TranslateFn
  selection?: VideoReferenceSelection
  options?: VideoReferenceOptions
  onChange: (selection: VideoReferenceSelection) => void
}

function buildFallbackLabel(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?'
}

function renderFallbackThumb(label: string) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(14,116,144,0.22))] text-xs font-semibold text-[var(--glass-text-primary)]">
      {buildFallbackLabel(label)}
    </div>
  )
}

function buildReferenceCategoryLabel(tabKey: ReferenceTabKey, t: TranslateFn): string {
  const translated = tabKey === 'characters'
    ? t('panelCard.referenceCharacters')
    : tabKey === 'locations'
      ? t('panelCard.referenceLocation')
      : t('panelCard.referenceProps')
  const compactLabel = translated
    .replace(/^关联/, '')
    .replace(/^related\s+/i, '')
    .replace(/^reference\s+/i, '')
    .trim()
  if (!compactLabel) {
    return tabKey === 'characters' ? 'Characters' : tabKey === 'locations' ? 'Scene' : 'Props'
  }
  return compactLabel.charAt(0).toLocaleUpperCase() + compactLabel.slice(1)
}

export default function VideoReferenceSelector({
  t,
  selection,
  options,
  onChange,
}: VideoReferenceSelectorProps) {
  const normalizedSelection = normalizeVideoReferenceSelection(selection)
  const selectedCharacters = resolveSelectedCharacterReferences(normalizedSelection, options)
  const selectedLocations = resolveSelectedNamedReferences(
    normalizedSelection.includeLocation,
    normalizedSelection.locations,
    options?.locations,
  )
  const selectedProps = resolveSelectedNamedReferences(
    normalizedSelection.includeProps,
    normalizedSelection.props,
    options?.props,
  )
  const characterOptions = options?.characters || []
  const locationOptions = options?.locations || []
  const propOptions = options?.props || []

  const updateSelection = (nextSelection: VideoReferenceSelection) => {
    onChange(normalizeVideoReferenceSelection(nextSelection))
  }

  const setCharacterSelection = (enabled: boolean, values: VideoReferenceCharacter[]) => {
    updateSelection({
      ...normalizedSelection,
      includeCharacters: enabled,
      characters: enabled ? values : [],
    })
  }

  const setNamedSelection = (
    field: 'locations' | 'props',
    includeField: 'includeLocation' | 'includeProps',
    enabled: boolean,
    values: string[],
  ) => {
    updateSelection({
      ...normalizedSelection,
      [includeField]: enabled,
      [field]: enabled ? values : [],
    })
  }

  const toggleCharacterCategory = (enabled: boolean) => {
    const nextValues = enabled
      ? (options?.characters || []).map((option) => (
        option.appearance
          ? { name: option.name, appearance: option.appearance }
          : { name: option.name }
      ))
      : []
    setCharacterSelection(enabled, nextValues)
  }

  const toggleNamedCategory = (
    field: 'locations' | 'props',
    includeField: 'includeLocation' | 'includeProps',
    enabled: boolean,
    categoryOptions: VideoReferenceNamedOption[] | undefined,
  ) => {
    setNamedSelection(
      field,
      includeField,
      enabled,
      enabled ? (categoryOptions || []).map((option) => option.name) : [],
    )
  }

  const toggleCharacterOption = (option: VideoReferenceCharacterOption) => {
    const key = option.key
    const exists = selectedCharacters.some((item) => buildVideoReferenceCharacterKey(item) === key)
    const nextValues = exists
      ? selectedCharacters.filter((item) => buildVideoReferenceCharacterKey(item) !== key)
      : [
        ...selectedCharacters,
        option.appearance ? { name: option.name, appearance: option.appearance } : { name: option.name },
      ]
    setCharacterSelection(nextValues.length > 0, nextValues)
  }

  const toggleNamedOption = (
    field: 'locations' | 'props',
    includeField: 'includeLocation' | 'includeProps',
    currentValues: string[],
    option: VideoReferenceNamedOption,
  ) => {
    const exists = currentValues.some((value) => value.trim().toLowerCase() === option.name.trim().toLowerCase())
    const nextValues = exists
      ? currentValues.filter((value) => value.trim().toLowerCase() !== option.name.trim().toLowerCase())
      : [...currentValues, option.name]
    setNamedSelection(field, includeField, nextValues.length > 0, nextValues)
  }

  const characterDisplayOptions = characterOptions.length > 0
    ? characterOptions.map((option) => ({
      key: option.key,
      label: option.label,
      imageUrl: option.imageUrl,
      description: option.description,
      selected: selectedCharacters.some((item) => buildVideoReferenceCharacterKey(item) === option.key),
      onToggle: () => toggleCharacterOption(option),
    }))
    : selectedCharacters.map((item) => {
      const label = item.appearance ? `${item.name} / ${item.appearance}` : item.name
      return {
        key: buildVideoReferenceCharacterKey(item),
        label,
        imageUrl: null,
        description: null,
        selected: true,
        onToggle: () => setCharacterSelection(
          selectedCharacters.length > 1,
          selectedCharacters.filter((candidate) => buildVideoReferenceCharacterKey(candidate) !== buildVideoReferenceCharacterKey(item)),
        ),
      }
    })

  const locationDisplayOptions = locationOptions.length > 0
    ? locationOptions.map((option) => ({
      key: option.key,
      label: option.name,
      imageUrl: option.imageUrl,
      description: option.description,
      selected: selectedLocations.some((value) => value.trim().toLowerCase() === option.name.trim().toLowerCase()),
      onToggle: () => toggleNamedOption('locations', 'includeLocation', selectedLocations, option),
    }))
    : selectedLocations.map((location) => ({
      key: location.trim().toLowerCase(),
      label: location,
      imageUrl: null,
      description: null,
      selected: true,
      onToggle: () => setNamedSelection(
        'locations',
        'includeLocation',
        selectedLocations.length > 1,
        selectedLocations.filter((value) => value.trim().toLowerCase() !== location.trim().toLowerCase()),
      ),
    }))

  const propDisplayOptions = propOptions.length > 0
    ? propOptions.map((option) => ({
      key: option.key,
      label: option.name,
      imageUrl: option.imageUrl,
      description: option.description,
      selected: selectedProps.some((value) => value.trim().toLowerCase() === option.name.trim().toLowerCase()),
      onToggle: () => toggleNamedOption('props', 'includeProps', selectedProps, option),
    }))
    : selectedProps.map((prop) => ({
      key: prop.trim().toLowerCase(),
      label: prop,
      imageUrl: null,
      description: null,
      selected: true,
      onToggle: () => setNamedSelection(
        'props',
        'includeProps',
        selectedProps.length > 1,
        selectedProps.filter((value) => value.trim().toLowerCase() !== prop.trim().toLowerCase()),
      ),
    }))

  const preferredTab: ReferenceTabKey = normalizedSelection.includeCharacters || characterDisplayOptions.length > 0
    ? 'characters'
    : normalizedSelection.includeLocation || locationDisplayOptions.length > 0
      ? 'locations'
      : normalizedSelection.includeProps || propDisplayOptions.length > 0
        ? 'props'
        : 'characters'
  const [activeTab, setActiveTab] = useState<ReferenceTabKey>(() => preferredTab)
  const characterLabel = buildReferenceCategoryLabel('characters', t)
  const locationLabel = buildReferenceCategoryLabel('locations', t)
  const propLabel = buildReferenceCategoryLabel('props', t)

  const tabs: Array<{
    key: ReferenceTabKey
    label: string
    checked: boolean
    selectedCount: number
    totalCount: number
    onToggleCategory: (enabled: boolean) => void
    displayOptions: Array<{
      key: string
      label: string
      imageUrl?: string | null
      description?: string | null
      selected: boolean
      onToggle: () => void
    }>
  }> = [
    {
      key: 'characters',
      label: characterLabel,
      checked: normalizedSelection.includeCharacters === true,
      selectedCount: selectedCharacters.length,
      totalCount: characterDisplayOptions.length,
      onToggleCategory: toggleCharacterCategory,
      displayOptions: characterDisplayOptions,
    },
    {
      key: 'locations',
      label: locationLabel,
      checked: normalizedSelection.includeLocation === true,
      selectedCount: selectedLocations.length,
      totalCount: locationDisplayOptions.length,
      onToggleCategory: (enabled) => toggleNamedCategory('locations', 'includeLocation', enabled, locationOptions),
      displayOptions: locationDisplayOptions,
    },
    {
      key: 'props',
      label: propLabel,
      checked: normalizedSelection.includeProps === true,
      selectedCount: selectedProps.length,
      totalCount: propDisplayOptions.length,
      onToggleCategory: (enabled) => toggleNamedCategory('props', 'includeProps', enabled, propOptions),
      displayOptions: propDisplayOptions,
    },
  ]

  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0]
  const currentTabCount = Math.max(currentTab.totalCount, currentTab.selectedCount)
  const activeTabNeedsFallback = currentTab.totalCount === 0 && !currentTab.checked

  useEffect(() => {
    if (!activeTabNeedsFallback || preferredTab === activeTab) return
    setActiveTab(preferredTab)
  }, [activeTab, activeTabNeedsFallback, preferredTab])

  const renderOptionCard = (
    option: {
      key: string
      label: string
      imageUrl?: string | null
      description?: string | null
    },
    selected: boolean,
    onToggle: () => void,
  ) => (
    <button
      key={option.key}
      type="button"
      onClick={onToggle}
      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
        selected
          ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)]'
          : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] hover:border-[var(--glass-stroke-focus)]/60'
      }`}
    >
      {option.imageUrl ? (
        <MediaImageWithLoading
          src={option.imageUrl}
          alt={option.label}
          containerClassName="h-14 w-14 shrink-0 rounded-xl"
          className="h-14 w-14 object-cover"
        />
      ) : renderFallbackThumb(option.label)}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-[var(--glass-text-primary)]">
          {option.label}
        </div>
        {option.description ? (
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--glass-text-tertiary)]">
            {option.description}
          </div>
        ) : null}
      </div>
    </button>
  )

  return (
    <div className="rounded-xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-3 py-2">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex min-w-0 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                  : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] text-[var(--glass-text-secondary)] hover:border-[var(--glass-stroke-focus)]/60'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 text-xs text-[var(--glass-text-secondary)]">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={currentTab.checked}
                onChange={(event) => currentTab.onToggleCategory(event.target.checked)}
                className="h-4 w-4 rounded border border-[var(--glass-stroke-base)] bg-transparent accent-[var(--glass-accent-from)]"
              />
              <span>{currentTab.label}</span>
            </span>
            <span className="text-[10px] text-[var(--glass-text-tertiary)]">
              {currentTab.selectedCount}/{currentTabCount}
            </span>
          </label>
          {currentTab.displayOptions.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {currentTab.displayOptions.map((option) => renderOptionCard(
                {
                  key: option.key,
                  label: option.label,
                  imageUrl: option.imageUrl,
                  description: option.description,
                },
                option.selected,
                option.onToggle,
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-4 text-[11px] text-[var(--glass-text-tertiary)]">
              {t('panelCard.referenceAssetsHint')}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-[var(--glass-text-tertiary)]">
        {t('panelCard.referenceAssetsHint')}
      </div>
    </div>
  )
}
