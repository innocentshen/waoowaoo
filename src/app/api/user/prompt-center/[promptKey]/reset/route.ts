import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { getPromptCenterItem, resetPromptCenterItem } from '@/lib/prompt-center/service'

export const POST = apiHandler(async (
  _request: NextRequest,
  context: { params: Promise<{ promptKey: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { promptKey } = await context.params
  const detail = getPromptCenterItem(promptKey)
  if (!detail) {
    throw new ApiError('NOT_FOUND')
  }

  const item = resetPromptCenterItem(promptKey)
  return NextResponse.json({ item })
})
