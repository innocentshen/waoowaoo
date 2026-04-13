import { beforeEach, describe, expect, it } from 'vitest'
import {
  listBuiltinCapabilityCatalog,
  resetBuiltinCapabilityCatalogCacheForTest,
} from '@/lib/model-capabilities/catalog'

describe('runtime capability catalog loading', () => {
  beforeEach(() => {
    resetBuiltinCapabilityCatalogCacheForTest()
  })

  it('ignores example capability files at runtime', () => {
    const entries = listBuiltinCapabilityCatalog()

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((entry) => entry.provider === 'example-provider')).toBe(false)
  })
})
