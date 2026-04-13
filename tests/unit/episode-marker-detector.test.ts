import { describe, expect, it } from 'vitest'
import { detectEpisodeMarkers, splitByMarkers } from '@/lib/episode-marker-detector'

describe('episode marker detector', () => {
  it('detects markdown heading episode markers and splits without AI', () => {
    const content = [
      '## 第1集《崩溃日志》',
      '',
      '凌晨三点的办公室，陆沉是唯一一个还在工位上的人。',
      '',
      '## 第2集《血色工位》',
      '',
      '陆沉看见自己熟悉的工位正在咀嚼昨天还跟他一起吃饭的同事。',
      '',
      '## 第3集《第一次切回》',
      '',
      '虫群怪物扑上来的瞬间，手环弹出红色倒计时。',
    ].join('\n')

    const markerResult = detectEpisodeMarkers(content)

    expect(markerResult.hasMarkers).toBe(true)
    expect(markerResult.markerTypeKey).toBe('episode')
    expect(markerResult.matches).toHaveLength(3)
    expect(markerResult.matches.map((item) => item.episodeNumber)).toEqual([1, 2, 3])

    const episodes = splitByMarkers(content, markerResult)

    expect(episodes).toHaveLength(3)
    expect(episodes[0]?.content.startsWith('## 第1集《崩溃日志》')).toBe(true)
    expect(episodes[1]?.content.startsWith('## 第2集《血色工位》')).toBe(true)
    expect(episodes[2]?.content.startsWith('## 第3集《第一次切回》')).toBe(true)
  })
})
