import { describe, expect, it, vi } from 'vitest'
import {
  PANEL_IMAGE_HISTORY_LIMIT,
  moveUrlsIntoPanelImageHistory,
  parsePanelImageHistory,
} from '@/lib/novel-promotion/panel-image-history'

describe('panel image history helpers', () => {
  it('dedupes entries and keeps only the latest 15', () => {
    const now = '2026-04-23T10:00:00.000Z'
    const rawHistory = JSON.stringify(
      Array.from({ length: PANEL_IMAGE_HISTORY_LIMIT + 2 }, (_, index) => ({
        url: `cos/history-${index}.png`,
        timestamp: `2026-04-23T09:${String(index).padStart(2, '0')}:00.000Z`,
      })),
    )

    const result = moveUrlsIntoPanelImageHistory({
      rawHistory,
      extraUrls: ['cos/history-5.png', 'cos/history-new.png'],
      timestamp: now,
    })

    const urls = parsePanelImageHistory(result.serialized).map((entry) => entry.url)
    expect(urls).toHaveLength(PANEL_IMAGE_HISTORY_LIMIT)
    expect(urls.at(-1)).toBe('cos/history-new.png')
    expect(urls.filter((url) => url === 'cos/history-5.png')).toHaveLength(1)
    expect(urls).not.toContain('cos/history-0.png')
  })

  it('moves current and unselected generated images into history while removing the new current image', () => {
    vi.setSystemTime(new Date('2026-04-23T12:00:00.000Z'))

    const result = moveUrlsIntoPanelImageHistory({
      rawHistory: JSON.stringify([
        { url: 'cos/history-a.png', timestamp: '2026-04-23T08:00:00.000Z' },
        { url: 'cos/history-b.png', timestamp: '2026-04-23T09:00:00.000Z' },
      ]),
      currentImageUrl: 'cos/current.png',
      nextImageUrl: 'cos/history-a.png',
      extraUrls: ['cos/candidate-1.png', 'cos/history-a.png', 'cos/candidate-2.png'],
    })

    expect(parsePanelImageHistory(result.serialized)).toEqual([
      { url: 'cos/history-b.png', timestamp: '2026-04-23T09:00:00.000Z' },
      { url: 'cos/current.png', timestamp: '2026-04-23T12:00:00.000Z' },
      { url: 'cos/candidate-1.png', timestamp: '2026-04-23T12:00:00.000Z' },
      { url: 'cos/candidate-2.png', timestamp: '2026-04-23T12:00:00.000Z' },
    ])

    vi.useRealTimers()
  })
})
