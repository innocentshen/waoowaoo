import { describe, expect, it } from 'vitest'
import {
  appendPanelVideoCandidate,
  estimatePanelVideoCandidateDurationSeconds,
  removePanelVideoCandidate,
  resolvePanelVideoCandidates,
  selectPanelVideoCandidate,
} from '@/lib/novel-promotion/video-candidates'

describe('video candidates helpers', () => {
  it('treats the currently selected legacy video as a candidate', () => {
    const candidates = resolvePanelVideoCandidates({
      videoUrl: 'cos/current.mp4',
      videoGenerationMode: 'firstlastframe',
      videoCandidates: null,
    })

    expect(candidates).toEqual([
      expect.objectContaining({
        videoUrl: 'cos/current.mp4',
        generationMode: 'firstlastframe',
        isSelected: true,
      }),
    ])
  })

  it('appends a new candidate without replacing the selected base video', () => {
    const next = appendPanelVideoCandidate(
      {
        videoUrl: 'cos/current.mp4',
        videoGenerationMode: 'normal',
        videoCandidates: JSON.stringify([
          {
            id: 'current',
            videoUrl: 'cos/current.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
        ]),
      },
      {
        id: 'new-one',
        videoUrl: 'cos/new.mp4',
        generationMode: 'normal',
        createdAt: '2026-04-09T00:00:00.000Z',
      },
    )

    expect(next.selectedVideoUrl).toBe('cos/current.mp4')
    expect(next.selectedGenerationMode).toBe('normal')
    expect(next.candidates.map((candidate) => candidate.videoUrl)).toEqual([
      'cos/current.mp4',
      'cos/new.mp4',
    ])
  })

  it('selects a saved candidate by id', () => {
    const selection = selectPanelVideoCandidate(
      {
        videoUrl: 'cos/current.mp4',
        videoGenerationMode: 'normal',
        videoCandidates: JSON.stringify([
          {
            id: 'current',
            videoUrl: 'cos/current.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
          {
            id: 'alt',
            videoUrl: 'cos/alt.mp4',
            generationMode: 'firstlastframe',
            createdAt: '2026-04-09T00:00:00.000Z',
          },
        ]),
      },
      'alt',
    )

    expect(selection?.selectedCandidate.videoUrl).toBe('cos/alt.mp4')
    expect(selection?.selectedCandidate.generationMode).toBe('firstlastframe')
  })

  it('falls back to the latest remaining candidate when deleting the selected video', () => {
    const removal = removePanelVideoCandidate(
      {
        videoUrl: 'cos/current.mp4',
        videoGenerationMode: 'normal',
        videoCandidates: JSON.stringify([
          {
            id: 'older',
            videoUrl: 'cos/older.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-07T00:00:00.000Z',
          },
          {
            id: 'current',
            videoUrl: 'cos/current.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
          {
            id: 'latest',
            videoUrl: 'cos/latest.mp4',
            generationMode: 'firstlastframe',
            createdAt: '2026-04-09T00:00:00.000Z',
          },
        ]),
      },
      'current',
    )

    expect(removal?.removedCandidate.videoUrl).toBe('cos/current.mp4')
    expect(removal?.selectedChanged).toBe(true)
    expect(removal?.selectedCandidate?.videoUrl).toBe('cos/latest.mp4')
    expect(removal?.candidates.map((candidate) => candidate.id)).toEqual(['older', 'latest'])
  })

  it('preserves candidate lineage metadata for edit and extend outputs', () => {
    const next = appendPanelVideoCandidate(
      {
        videoUrl: 'cos/current.mp4',
        videoGenerationMode: 'normal',
        videoCandidates: JSON.stringify([
          {
            id: 'source',
            videoUrl: 'cos/current.mp4',
            generationMode: 'normal',
            createdAt: '2026-04-08T00:00:00.000Z',
          },
        ]),
      },
      {
        id: 'extended',
        videoUrl: 'cos/extended.mp4',
        generationMode: 'extend',
        createdAt: '2026-04-09T00:00:00.000Z',
        prompt: 'continue the motion',
        meta: {
          sourceCandidateId: 'source',
          sourceGenerationMode: 'normal',
          extendDuration: 4,
        },
      },
    )

    const resolved = resolvePanelVideoCandidates({
      videoUrl: next.selectedVideoUrl,
      videoGenerationMode: next.selectedGenerationMode,
      videoCandidates: next.serialized,
    })
    const extended = resolved.find((candidate) => candidate.id === 'extended')

    expect(extended?.generationMode).toBe('extend')
    expect(extended?.meta).toEqual({
      sourceCandidateId: 'source',
      sourceGenerationMode: 'normal',
      extendDuration: 4,
    })
  })

  it('estimates candidate duration through edit and extend lineage', () => {
    const candidates = resolvePanelVideoCandidates({
      videoUrl: 'cos/base.mp4',
      videoGenerationMode: 'normal',
      videoCandidates: JSON.stringify([
        {
          id: 'base',
          videoUrl: 'cos/base.mp4',
          generationMode: 'normal',
          createdAt: '2026-04-08T00:00:00.000Z',
        },
        {
          id: 'extended',
          videoUrl: 'cos/extended.mp4',
          generationMode: 'extend',
          createdAt: '2026-04-09T00:00:00.000Z',
          meta: {
            sourceCandidateId: 'base',
            sourceGenerationMode: 'normal',
            extendDuration: 4,
          },
        },
        {
          id: 'edited',
          videoUrl: 'cos/edited.mp4',
          generationMode: 'edit',
          createdAt: '2026-04-10T00:00:00.000Z',
          meta: {
            sourceCandidateId: 'extended',
            sourceGenerationMode: 'extend',
          },
        },
      ]),
    })

    expect(estimatePanelVideoCandidateDurationSeconds(candidates, 'base', 5)).toBe(5)
    expect(estimatePanelVideoCandidateDurationSeconds(candidates, 'extended', 5)).toBe(9)
    expect(estimatePanelVideoCandidateDurationSeconds(candidates, 'edited', 5)).toBe(9)
  })
})
