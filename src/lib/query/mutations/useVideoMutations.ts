import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resolveTaskResponse } from '@/lib/task/client'
import { queryKeys } from '../keys'
import { invalidateQueryTemplates, requestJsonWithError, requestTaskResponseWithError } from './mutation-shared'

/**
 * 获取剧集可下载视频列表（项目）
 */
export function useListProjectEpisodeVideoUrls(projectId: string) {
  return useMutation({
    mutationFn: async (payload: {
      episodeId: string
      panelPreferences: Record<string, boolean>
    }) =>
      await requestJsonWithError(
        `/api/novel-promotion/${projectId}/video-urls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        '获取视频列表失败',
      ),
  })
}

/**
 * 更新 panel 首尾帧链接状态（项目）
 */
export function useUpdateProjectPanelLink(projectId: string) {
  return useMutation({
    mutationFn: async (payload: {
      storyboardId: string
      panelIndex: number
      linked: boolean
    }) =>
      await requestJsonWithError(
        `/api/novel-promotion/${projectId}/panel-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        '保存链接状态失败',
      ),
  })
}

/**
 * 更新 Panel 视频提示词
 */
export function useUpdateProjectPanelVideoPrompt(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      storyboardId,
      panelIndex,
      value,
      field = 'videoPrompt',
    }: {
      storyboardId: string
      panelIndex: number
      value: string
      field?: 'videoPrompt' | 'firstLastFramePrompt'
    }) =>
      await requestJsonWithError(
        `/api/novel-promotion/${projectId}/panel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyboardId,
            panelIndex,
            ...(field === 'firstLastFramePrompt'
              ? { firstLastFramePrompt: value }
              : { videoPrompt: value }),
          }),
        },
        'update failed',
      ),
    onSettled: () => {
      invalidateQueryTemplates(queryClient, [queryKeys.projectData(projectId)])
    },
  })
}

export function useAiGenerateProjectVideoPrompt(projectId: string) {
  return useMutation({
    mutationFn: async (payload: {
      panelId: string
      lastPanelId?: string
      currentPrompt?: string
      currentVideoPrompt?: string
      modifyInstruction: string
    }) => {
      const response = await requestTaskResponseWithError(
        `/api/novel-promotion/${projectId}/ai-modify-shot-prompt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            mode: 'videoPrompt',
          }),
        },
        'generate video prompt failed',
      )
      return await resolveTaskResponse<{
        generatedVideoPrompt: string
      }>(response)
    },
  })
}

export function useSelectProjectPanelVideoCandidate(projectId: string, episodeId?: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      panelId: string
      candidateId: string
    }) =>
      await requestJsonWithError(
        `/api/novel-promotion/${projectId}/panel/video-candidate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            action: 'select',
          }),
        },
        'select video candidate failed',
      ),
    onSettled: () => {
      invalidateQueryTemplates(queryClient, [queryKeys.projectData(projectId)])
      if (episodeId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.episodeData(projectId, episodeId) })
      }
    },
  })
}

export function useDeleteProjectPanelVideoCandidate(projectId: string, episodeId?: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      panelId: string
      candidateId: string
    }) =>
      await requestJsonWithError(
        `/api/novel-promotion/${projectId}/panel/video-candidate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            action: 'delete',
          }),
        },
        'delete video candidate failed',
      ),
    onSettled: () => {
      invalidateQueryTemplates(queryClient, [queryKeys.projectData(projectId)])
      if (episodeId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.episodeData(projectId, episodeId) })
      }
    },
  })
}
