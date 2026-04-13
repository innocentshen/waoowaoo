import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { requireProjectAuthLight, requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { getProjectModelConfig, getUserModelConfig } from '@/lib/config-service'
import { maybeSubmitLLMTask } from '@/lib/llm-observe/route-task'
import { TASK_TYPE } from '@/lib/task/types'

export const POST = apiHandler(async (request: NextRequest) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  if (!prompt) {
    throw new ApiError('INVALID_PARAMS')
  }

  let userId = ''
  let analysisModel: string | null = null

  if (projectId) {
    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult
    userId = authResult.session.user.id
    const projectConfig = await getProjectModelConfig(projectId, userId)
    analysisModel = projectConfig.analysisModel
  } else {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    userId = authResult.session.user.id
    const userConfig = await getUserModelConfig(userId)
    analysisModel = userConfig.analysisModel
  }

  if (!analysisModel) {
    throw new ApiError('MISSING_CONFIG')
  }

  const dedupeDigest = createHash('sha1')
    .update(`${userId}:${projectId || 'home'}:home-story-expand:${prompt}`)
    .digest('hex')
    .slice(0, 16)

  const asyncTaskResponse = await maybeSubmitLLMTask({
    request,
    userId,
    projectId: projectId || 'home-ai-write',
    type: TASK_TYPE.AI_STORY_EXPAND,
    targetType: 'HomeAiStoryExpand',
    targetId: projectId || userId,
    routePath: '/api/user/ai-story-expand',
    body: {
      prompt,
      analysisModel,
    },
    dedupeKey: `home_ai_story_expand:${dedupeDigest}`,
    priority: 1,
  })
  if (asyncTaskResponse) return asyncTaskResponse

  throw new ApiError('INVALID_PARAMS')
})
