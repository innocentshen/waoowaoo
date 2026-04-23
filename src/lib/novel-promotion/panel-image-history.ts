export const PANEL_IMAGE_HISTORY_LIMIT = 15

export interface StoredPanelImageHistoryEntry {
  url: string
  timestamp: string
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeEntry(value: unknown): StoredPanelImageHistoryEntry | null {
  if (typeof value === 'string') {
    const url = normalizeUrl(value)
    return url ? { url, timestamp: '' } : null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const candidate = value as {
    url?: unknown
    timestamp?: unknown
    createdAt?: unknown
  }
  const url = normalizeUrl(candidate.url)
  if (!url) return null

  return {
    url,
    timestamp: normalizeTimestamp(candidate.timestamp ?? candidate.createdAt),
  }
}

export function parseStringArrayJson(raw: unknown): string[] {
  if (!raw) return []

  const parsed =
    typeof raw === 'string'
      ? (() => {
        try {
          return JSON.parse(raw)
        } catch {
          return []
        }
      })()
      : raw

  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => normalizeUrl(item))
    .filter((item): item is string => !!item)
}

export function parsePanelImageHistory(raw: unknown): StoredPanelImageHistoryEntry[] {
  if (!raw) return []

  const parsed =
    typeof raw === 'string'
      ? (() => {
        try {
          return JSON.parse(raw)
        } catch {
          return normalizeEntry(raw) ? [raw] : []
        }
      })()
      : raw

  if (!Array.isArray(parsed)) return []

  const deduped = new Map<string, StoredPanelImageHistoryEntry>()
  for (const item of parsed) {
    const entry = normalizeEntry(item)
    if (!entry) continue
    deduped.delete(entry.url)
    deduped.set(entry.url, entry)
  }

  return Array.from(deduped.values()).slice(-PANEL_IMAGE_HISTORY_LIMIT)
}

export function serializePanelImageHistory(
  entries: readonly StoredPanelImageHistoryEntry[],
): string | null {
  if (entries.length === 0) return null
  return JSON.stringify(entries)
}

function appendEntries(
  baseEntries: readonly StoredPanelImageHistoryEntry[],
  urls: readonly (string | null | undefined)[],
  timestamp: string,
) {
  const merged = [...baseEntries]
  for (const rawUrl of urls) {
    const url = normalizeUrl(rawUrl)
    if (!url) continue
    merged.push({ url, timestamp })
  }

  return parsePanelImageHistory(merged)
}

export function appendUrlsToPanelImageHistory(params: {
  rawHistory: unknown
  urls: readonly (string | null | undefined)[]
  timestamp?: string
}) {
  const timestamp = params.timestamp || new Date().toISOString()
  const entries = appendEntries(
    parsePanelImageHistory(params.rawHistory),
    params.urls,
    timestamp,
  )
  return {
    entries,
    serialized: serializePanelImageHistory(entries),
  }
}

export function moveUrlsIntoPanelImageHistory(params: {
  rawHistory: unknown
  currentImageUrl?: string | null
  nextImageUrl?: string | null
  extraUrls?: readonly (string | null | undefined)[]
  timestamp?: string
}) {
  const nextImageUrl = normalizeUrl(params.nextImageUrl)
  const baseEntries = parsePanelImageHistory(params.rawHistory).filter((entry) => entry.url !== nextImageUrl)
  const urls: Array<string | null | undefined> = []
  const currentImageUrl = normalizeUrl(params.currentImageUrl)
  if (currentImageUrl && currentImageUrl !== nextImageUrl) {
    urls.push(currentImageUrl)
  }
  if (params.extraUrls) {
    for (const url of params.extraUrls) {
      const normalized = normalizeUrl(url)
      if (!normalized || normalized === nextImageUrl) continue
      urls.push(normalized)
    }
  }

  const timestamp = params.timestamp || new Date().toISOString()
  const entries = appendEntries(baseEntries, urls, timestamp)
  return {
    entries,
    serialized: serializePanelImageHistory(entries),
  }
}
