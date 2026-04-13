import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  generateVideoMutateAsyncMock,
  batchGenerateVideosMutateAsyncMock,
  updateProjectPanelVideoPromptMutateAsyncMock,
  updateProjectClipMutateAsyncMock,
  updateProjectConfigMutateAsyncMock,
} = vi.hoisted(() => ({
  generateVideoMutateAsyncMock: vi.fn(),
  batchGenerateVideosMutateAsyncMock: vi.fn(),
  updateProjectPanelVideoPromptMutateAsyncMock: vi.fn(),
  updateProjectClipMutateAsyncMock: vi.fn(),
  updateProjectConfigMutateAsyncMock: vi.fn(),
}))

vi.mock('@/lib/query/hooks/useStoryboards', () => ({
  useGenerateVideo: () => ({
    mutateAsync: generateVideoMutateAsyncMock,
  }),
  useBatchGenerateVideos: () => ({
    mutateAsync: batchGenerateVideosMutateAsyncMock,
  }),
}))

vi.mock('@/lib/query/hooks', () => ({
  useUpdateProjectPanelVideoPrompt: () => ({
    mutateAsync: updateProjectPanelVideoPromptMutateAsyncMock,
  }),
  useUpdateProjectClip: () => ({
    mutateAsync: updateProjectClipMutateAsyncMock,
  }),
  useUpdateProjectConfig: () => ({
    mutateAsync: updateProjectConfigMutateAsyncMock,
  }),
}))

import { useWorkspaceVideoActions } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/hooks/useWorkspaceVideoActions'

describe('useWorkspaceVideoActions', () => {
  const originalAlert = globalThis.alert

  beforeEach(() => {
    generateVideoMutateAsyncMock.mockReset()
    batchGenerateVideosMutateAsyncMock.mockReset()
    updateProjectPanelVideoPromptMutateAsyncMock.mockReset()
    updateProjectClipMutateAsyncMock.mockReset()
    updateProjectConfigMutateAsyncMock.mockReset()
    globalThis.alert = vi.fn()
  })

  afterEach(() => {
    globalThis.alert = originalAlert
  })

  it('single video mutation fails -> rethrows error for immediate lock cleanup', async () => {
    generateVideoMutateAsyncMock.mockRejectedValueOnce(new Error('video submit failed'))

    const actions = useWorkspaceVideoActions({
      projectId: 'project-1',
      episodeId: 'episode-1',
      t: (key: string) => key,
    })

    await expect(
      actions.handleGenerateVideo('storyboard-1', 0, 'veo-3.1'),
    ).rejects.toThrow('video submit failed')

    expect(globalThis.alert).toHaveBeenCalledWith('execution.generationFailed: video submit failed')
  })

  it('forwards selected related-asset reference flags to the video mutation', async () => {
    generateVideoMutateAsyncMock.mockResolvedValueOnce({ success: true })

    const actions = useWorkspaceVideoActions({
      projectId: 'project-1',
      episodeId: 'episode-1',
      t: (key: string) => key,
    })

    await actions.handleGenerateVideo(
      'storyboard-1',
      0,
      'veo-3.1',
      undefined,
      { duration: 5 },
      undefined,
      {
        includeCharacters: true,
        includeLocation: false,
        includeProps: true,
        characters: [{ name: 'Hero', appearance: 'default' }],
        props: ['Ancient Sword'],
      },
      'panel-1',
      2,
    )

    expect(generateVideoMutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      storyboardId: 'storyboard-1',
      panelIndex: 0,
      panelId: 'panel-1',
      videoModel: 'veo-3.1',
      count: 2,
      referenceSelection: {
        includeCharacters: true,
        includeLocation: false,
        includeProps: true,
        characters: [{ name: 'Hero', appearance: 'default' }],
        props: ['Ancient Sword'],
      },
    }))
  })
})
