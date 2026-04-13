import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { activatePromptCenterVersion, getPromptCenterItem } from '@/lib/prompt-center/service'

type PromptCenterActivateBody = {
  versionId?: unknown
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ promptKey: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { promptKey } = await context.params
  const detail = getPromptCenterItem(promptKey)
  if (!detail) {
    throw new ApiError('NOT_FOUND')
  }

  const body = await request.json() as PromptCenterActivateBody
  if (typeof body.versionId !== 'string') {
    throw new ApiError('INVALID_PARAMS')
  }
  if (!detail.versions.some((version) => version.id === body.versionId)) {
    throw new ApiError('NOT_FOUND')
  }

  const item = activatePromptCenterVersion(promptKey, body.versionId)
  return NextResponse.json({ item })
})
