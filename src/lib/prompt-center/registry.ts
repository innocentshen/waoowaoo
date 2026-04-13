import path from 'path'
import { locales } from '@/i18n/routing'
import {
  ASSISTANT_PROMPT_FILE_BY_ID,
  ASSISTANT_PROMPT_VARIABLE_KEYS,
  type AssistantPromptId,
} from '@/lib/assistant-platform/prompt-catalog'
import { PROMPT_CATALOG } from '@/lib/prompt-i18n/catalog'
import type { PromptId } from '@/lib/prompt-i18n/prompt-ids'
import type { PromptLocale } from '@/lib/prompt-i18n/types'
import type { PromptCenterRegistryEntry } from './types'

function humanizeSegment(value: string) {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function createStorageId(kind: PromptCenterRegistryEntry['kind'], promptId: string, locale?: string) {
  const safeKind = kind.replace(/[^a-z0-9_-]/gi, '_')
  const safePromptId = promptId.replace(/[^a-z0-9_-]/gi, '_')
  return locale ? `${safeKind}_${safePromptId}_${locale}` : `${safeKind}_${safePromptId}`
}

export function buildPromptCenterKey(promptId: PromptId, locale: PromptLocale) {
  return `prompt-i18n:${promptId}:${locale}`
}

export function buildAssistantPromptCenterKey(promptId: AssistantPromptId) {
  return `assistant-system:${promptId}`
}

function buildPromptI18nEntries(): PromptCenterRegistryEntry[] {
  return Object.entries(PROMPT_CATALOG).flatMap(([promptId, entry]) =>
    locales.map((locale) => ({
      key: buildPromptCenterKey(promptId as PromptId, locale),
      storageId: createStorageId('prompt-i18n', promptId, locale),
      kind: 'prompt-i18n' as const,
      title: `${humanizeSegment(promptId)} (${locale.toUpperCase()})`,
      promptId: promptId as PromptId,
      locale,
      sourcePath: path.join('lib', 'prompts', `${entry.pathStem}.${locale}.txt`),
      variableKeys: entry.variableKeys,
      trimOnLoad: false,
    })),
  )
}

function buildAssistantEntries(): PromptCenterRegistryEntry[] {
  return Object.entries(ASSISTANT_PROMPT_FILE_BY_ID).map(([promptId, fileName]) => ({
    key: buildAssistantPromptCenterKey(promptId as AssistantPromptId),
    storageId: createStorageId('assistant-system', promptId),
    kind: 'assistant-system' as const,
    title: humanizeSegment(promptId),
    promptId: promptId as AssistantPromptId,
    sourcePath: path.join('lib', 'prompts', 'skills', fileName),
    variableKeys: ASSISTANT_PROMPT_VARIABLE_KEYS[promptId as AssistantPromptId] || [],
    trimOnLoad: true,
  }))
}

const PROMPT_CENTER_REGISTRY = [
  ...buildPromptI18nEntries(),
  ...buildAssistantEntries(),
].sort((left, right) => left.key.localeCompare(right.key))

const PROMPT_CENTER_REGISTRY_MAP = new Map(
  PROMPT_CENTER_REGISTRY.map((entry) => [entry.key, entry] as const),
)

const PROMPT_CENTER_PROMPT_I18N_MAP = new Map(
  PROMPT_CENTER_REGISTRY
    .filter((entry) => entry.kind === 'prompt-i18n' && entry.locale)
    .map((entry) => [`${entry.promptId}:${entry.locale}`, entry] as const),
)

const PROMPT_CENTER_ASSISTANT_MAP = new Map(
  PROMPT_CENTER_REGISTRY
    .filter((entry) => entry.kind === 'assistant-system')
    .map((entry) => [String(entry.promptId), entry] as const),
)

export function listPromptCenterRegistryEntries() {
  return PROMPT_CENTER_REGISTRY
}

export function getPromptCenterRegistryEntry(key: string) {
  return PROMPT_CENTER_REGISTRY_MAP.get(key) || null
}

export function findPromptCenterPromptI18nEntry(promptId: PromptId, locale: PromptLocale) {
  return PROMPT_CENTER_PROMPT_I18N_MAP.get(`${promptId}:${locale}`) || null
}

export function findPromptCenterAssistantEntry(promptId: AssistantPromptId) {
  return PROMPT_CENTER_ASSISTANT_MAP.get(promptId) || null
}
