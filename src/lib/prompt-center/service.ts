import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  buildAssistantPromptCenterKey,
  buildPromptCenterKey,
  getPromptCenterRegistryEntry,
  listPromptCenterRegistryEntries,
} from './registry'
import { buildPromptCenterRelationships } from './relations'
import type {
  PromptCenterItemDetail,
  PromptCenterItemSummary,
  PromptCenterManifest,
  PromptCenterMutationActor,
  PromptCenterRegistryEntry,
  PromptCenterVersionDetail,
  PromptCenterVersionManifest,
} from './types'
import type { AssistantPromptId } from '@/lib/assistant-platform/prompt-catalog'
import type { PromptId } from '@/lib/prompt-i18n'
import type { PromptLocale } from '@/lib/prompt-i18n/types'

type OverrideSnapshot = {
  manifest: PromptCenterManifest
  manifestMtimeMs: number
  activeVersion: PromptCenterVersionManifest | null
  activeContent: string | null
}

const builtinPromptCache = new Map<string, string>()
const overrideSnapshotCache = new Map<string, OverrideSnapshot | null>()

function getPromptCenterRootDir() {
  const overrideDir = process.env.PROMPT_CENTER_DATA_DIR?.trim()
  if (overrideDir) return path.resolve(overrideDir)
  return path.resolve(process.cwd(), 'data', 'prompt-center')
}

function getPromptEntryDir(entry: PromptCenterRegistryEntry) {
  return path.join(getPromptCenterRootDir(), entry.storageId)
}

function getPromptManifestPath(entry: PromptCenterRegistryEntry) {
  return path.join(getPromptEntryDir(entry), 'manifest.json')
}

function getPromptVersionDir(entry: PromptCenterRegistryEntry) {
  return path.join(getPromptEntryDir(entry), 'versions')
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function ensurePromptEntryDirs(entry: PromptCenterRegistryEntry) {
  fs.mkdirSync(getPromptVersionDir(entry), { recursive: true })
}

function readVersionContent(entry: PromptCenterRegistryEntry, version: PromptCenterVersionManifest) {
  const versionPath = path.join(getPromptVersionDir(entry), version.contentFile)
  return fs.readFileSync(versionPath, 'utf8')
}

function formatPromptContent(entry: PromptCenterRegistryEntry, content: string) {
  return entry.trimOnLoad ? content.trim() : content
}

function readBuiltinPromptContent(entry: PromptCenterRegistryEntry) {
  const cached = builtinPromptCache.get(entry.key)
  if (cached !== undefined) return cached

  const filePath = path.resolve(process.cwd(), entry.sourcePath)
  const content = formatPromptContent(entry, fs.readFileSync(filePath, 'utf8'))
  builtinPromptCache.set(entry.key, content)
  return content
}

function readOverrideSnapshot(entry: PromptCenterRegistryEntry): OverrideSnapshot | null {
  const manifestPath = getPromptManifestPath(entry)
  let manifestStat: fs.Stats
  try {
    manifestStat = fs.statSync(manifestPath)
  } catch {
    overrideSnapshotCache.delete(entry.key)
    return null
  }

  const cached = overrideSnapshotCache.get(entry.key)
  if (cached && cached.manifestMtimeMs === manifestStat.mtimeMs) {
    return cached
  }

  const manifest = readJsonFile<PromptCenterManifest>(manifestPath)
  if (!manifest || manifest.key !== entry.key || manifest.storageId !== entry.storageId) {
    overrideSnapshotCache.delete(entry.key)
    return null
  }

  const activeVersion = manifest.activeVersionId
    ? manifest.versions.find((item) => item.id === manifest.activeVersionId) || null
    : null
  const activeContent = activeVersion ? formatPromptContent(entry, readVersionContent(entry, activeVersion)) : null

  const snapshot: OverrideSnapshot = {
    manifest,
    manifestMtimeMs: manifestStat.mtimeMs,
    activeVersion,
    activeContent,
  }
  overrideSnapshotCache.set(entry.key, snapshot)
  return snapshot
}

function getPromptDetailFromEntry(entry: PromptCenterRegistryEntry): PromptCenterItemDetail {
  const builtinContent = readBuiltinPromptContent(entry)
  const snapshot = readOverrideSnapshot(entry)
  const versions: PromptCenterVersionDetail[] = snapshot
    ? snapshot.manifest.versions
      .slice()
      .sort((left, right) => right.version - left.version)
      .map((version) => ({
        ...version,
        content: formatPromptContent(entry, readVersionContent(entry, version)),
        isActive: version.id === snapshot.manifest.activeVersionId,
      }))
    : []

  return {
    key: entry.key,
    storageId: entry.storageId,
    kind: entry.kind,
    title: entry.title,
    promptId: entry.promptId,
    locale: entry.locale,
    sourcePath: entry.sourcePath,
    variableKeys: entry.variableKeys,
    source: snapshot?.activeContent != null ? 'override' : 'builtin',
    activeVersionId: snapshot?.activeVersion?.id || null,
    activeVersionNumber: snapshot?.activeVersion?.version || null,
    updatedAt: snapshot?.manifest.updatedAt || null,
    builtinContent,
    effectiveContent: snapshot?.activeContent ?? builtinContent,
    versions,
    relationships: buildPromptCenterRelationships(entry),
  }
}

function upsertManifest(
  entry: PromptCenterRegistryEntry,
  updater: (manifest: PromptCenterManifest) => PromptCenterManifest,
) {
  ensurePromptEntryDirs(entry)
  const existing = readJsonFile<PromptCenterManifest>(getPromptManifestPath(entry))
  const next = updater(existing || {
    key: entry.key,
    storageId: entry.storageId,
    activeVersionId: null,
    updatedAt: new Date(0).toISOString(),
    versions: [],
  })
  writeJsonFile(getPromptManifestPath(entry), next)
  overrideSnapshotCache.delete(entry.key)
}

function normalizeEditableContent(entry: PromptCenterRegistryEntry, content: string) {
  const normalized = formatPromptContent(entry, content)
  if (!normalized.trim()) {
    throw new Error('PROMPT_CENTER_EMPTY_CONTENT')
  }
  return normalized
}

function resolveActorLabel(actor?: PromptCenterMutationActor | null) {
  if (!actor) return null
  return actor.label?.trim() || actor.id
}

export function clearPromptCenterCaches() {
  builtinPromptCache.clear()
  overrideSnapshotCache.clear()
}

export function listPromptCenterItems(): PromptCenterItemSummary[] {
  return listPromptCenterRegistryEntries().map((entry) => {
    const detail = getPromptDetailFromEntry(entry)
    return {
      key: detail.key,
      storageId: detail.storageId,
      kind: detail.kind,
      title: detail.title,
      promptId: detail.promptId,
      locale: detail.locale,
      sourcePath: detail.sourcePath,
      variableKeys: detail.variableKeys,
      source: detail.source,
      activeVersionId: detail.activeVersionId,
      activeVersionNumber: detail.activeVersionNumber,
      updatedAt: detail.updatedAt,
    }
  })
}

export function getPromptCenterItem(key: string): PromptCenterItemDetail | null {
  const entry = getPromptCenterRegistryEntry(key)
  if (!entry) return null
  return getPromptDetailFromEntry(entry)
}

export function getEffectivePromptContentByKey(key: string): string {
  const entry = getPromptCenterRegistryEntry(key)
  if (!entry) {
    throw new Error(`PROMPT_CENTER_UNREGISTERED: ${key}`)
  }
  const snapshot = readOverrideSnapshot(entry)
  return snapshot?.activeContent ?? readBuiltinPromptContent(entry)
}

export function getEffectivePromptTemplate(promptId: PromptId, locale: PromptLocale) {
  return getEffectivePromptContentByKey(buildPromptCenterKey(promptId, locale))
}

export function getEffectiveAssistantSystemPrompt(promptId: AssistantPromptId) {
  return getEffectivePromptContentByKey(buildAssistantPromptCenterKey(promptId))
}

export function savePromptCenterVersion(
  key: string,
  input: {
    content: string
    note?: string | null
    actor?: PromptCenterMutationActor | null
  },
) {
  const entry = getPromptCenterRegistryEntry(key)
  if (!entry) {
    throw new Error(`PROMPT_CENTER_UNREGISTERED: ${key}`)
  }

  const normalizedContent = normalizeEditableContent(entry, input.content)
  const current = getPromptDetailFromEntry(entry)
  const builtinContent = current.builtinContent
  if (normalizedContent === builtinContent) {
    return resetPromptCenterItem(key)
  }
  if (current.source === 'override' && normalizedContent === current.effectiveContent) {
    return current
  }

  const actorLabel = resolveActorLabel(input.actor)
  const note = input.note?.trim() || null

  upsertManifest(entry, (manifest) => {
    const nextVersion = manifest.versions.reduce((max, item) => Math.max(max, item.version), 0) + 1
    const id = randomUUID()
    const contentFile = `v${String(nextVersion).padStart(4, '0')}_${id}.txt`
    const versionPath = path.join(getPromptVersionDir(entry), contentFile)
    fs.writeFileSync(versionPath, normalizedContent, 'utf8')

    return {
      ...manifest,
      activeVersionId: id,
      updatedAt: new Date().toISOString(),
      versions: [
        ...manifest.versions,
        {
          id,
          version: nextVersion,
          createdAt: new Date().toISOString(),
          createdBy: actorLabel,
          note,
          contentFile,
        },
      ],
    }
  })

  return getPromptDetailFromEntry(entry)
}

export function activatePromptCenterVersion(key: string, versionId: string) {
  const entry = getPromptCenterRegistryEntry(key)
  if (!entry) {
    throw new Error(`PROMPT_CENTER_UNREGISTERED: ${key}`)
  }

  const current = getPromptDetailFromEntry(entry)
  const target = current.versions.find((item) => item.id === versionId)
  if (!target) {
    throw new Error(`PROMPT_CENTER_VERSION_NOT_FOUND: ${versionId}`)
  }
  if (current.activeVersionId === versionId) {
    return current
  }

  upsertManifest(entry, (manifest) => ({
    ...manifest,
    activeVersionId: versionId,
    updatedAt: new Date().toISOString(),
  }))

  return getPromptDetailFromEntry(entry)
}

export function resetPromptCenterItem(key: string) {
  const entry = getPromptCenterRegistryEntry(key)
  if (!entry) {
    throw new Error(`PROMPT_CENTER_UNREGISTERED: ${key}`)
  }

  const manifestPath = getPromptManifestPath(entry)
  if (!fs.existsSync(manifestPath)) {
    return getPromptDetailFromEntry(entry)
  }

  upsertManifest(entry, (manifest) => ({
    ...manifest,
    activeVersionId: null,
    updatedAt: new Date().toISOString(),
  }))

  return getPromptDetailFromEntry(entry)
}
