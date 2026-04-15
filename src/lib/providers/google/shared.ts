export interface GoogleClientConfig {
  apiKey: string
  baseUrl?: string
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeGoogleBaseUrl(baseUrl?: string): string | undefined {
  const normalized = readTrimmedString(baseUrl)
  if (!normalized) return undefined
  return normalized.replace(/\/+$/, '')
}

export function buildGoogleGenAIOptions(config: GoogleClientConfig) {
  const baseUrl = normalizeGoogleBaseUrl(config.baseUrl)
  if (!baseUrl) {
    return { apiKey: config.apiKey }
  }
  return {
    apiKey: config.apiKey,
    httpOptions: {
      baseUrl,
    },
  }
}
