import type { CapabilityValue } from '@/lib/model-config-contract'

function normalizeField(field: string): string {
  return field.trim().toLowerCase()
}

export function resolvePreferredCapabilityDefault(
  field: string,
  options: CapabilityValue[],
): CapabilityValue | undefined {
  if (options.length === 0) return undefined

  if (normalizeField(field) === 'reasoningeffort') {
    const hasExtraHigh = options.some((option) => option === 'xhigh')
    const mediumOption = options.find((option) => option === 'medium')
    if (hasExtraHigh && mediumOption !== undefined) {
      return mediumOption
    }
  }

  return options[0]
}
