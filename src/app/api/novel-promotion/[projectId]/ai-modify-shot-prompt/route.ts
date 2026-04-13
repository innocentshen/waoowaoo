import { NextRequest } from 'next/server'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params
  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const mode = typeof body?.mode === 'string' ? body.mode.trim() : ''
  const currentPrompt = typeof body?.currentPrompt === 'string' ? body.currentPrompt.trim() : ''
  const modifyInstruction = typeof body?.modifyInstruction === 'string' ? body.modifyInstruction.trim() : ''
  const panelId = typeof body?.panelId === 'string' ? body.panelId.trim() : ''
  const episodeId = typeof body?.episodeId === 'string' ? body.episodeId.trim() : ''

  const isVideoPromptMode = mode === 'videoPrompt'
  if (!modifyInstruction) {
    throw new ApiError('INVALID_PARAMS')
  }
  if (isVideoPromptMode) {
    if (!panelId) {
      throw new ApiError('INVALID_PARAMS')
    }
  } else if (!currentPrompt) {
    throw new ApiError('INVALID_PARAMS')
  }
  const dedupePrefix = isVideoPromptMode ? 'ai_generate_video_prompt' : 'ai_modify_shot_prompt'

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    episodeId: episodeId || null,
    type: TASK_TYPE.AI_MODIFY_SHOT_PROMPT,
    targetType: panelId ? 'NovelPromotionPanel' : 'NovelPromotionProject',
    targetId: panelId || projectId,
    routePath: `/api/novel-promotion/${projectId}/ai-modify-shot-prompt`,
    body,
    dedupeKey: panelId ? `${dedupePrefix}:${panelId}` : `${dedupePrefix}:${projectId}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
