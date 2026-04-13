import { NextRequest, NextResponse } from 'next/server'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { TASK_TYPE } from '@/lib/task/types'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { detectEpisodeMarkers, splitByMarkers } from '@/lib/episode-marker-detector'

/**
 * AI 分集 API（任务化）
 */
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await params
  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json().catch(() => ({}))
  const content = typeof body?.content === 'string' ? body.content : ''

  if (!content) {
    throw new ApiError('INVALID_PARAMS')
  }
  if (content.length < 100) {
    throw new ApiError('INVALID_PARAMS')
  }

  const markerResult = detectEpisodeMarkers(content)
  if (markerResult.hasMarkers && markerResult.matches.length >= 2) {
    return NextResponse.json({
      success: true,
      method: 'markers',
      markerType: markerResult.markerType,
      episodes: splitByMarkers(content, markerResult),
    })
  }

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId: session.user.id,
    projectId,
    type: TASK_TYPE.EPISODE_SPLIT_LLM,
    targetType: 'NovelPromotionProject',
    targetId: projectId,
    routePath: `/api/novel-promotion/${projectId}/episodes/split`,
    body: { content },
    dedupeKey: `episode_split_llm:${projectId}:${content.length}`})
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
