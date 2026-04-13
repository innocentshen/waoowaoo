import { NextRequest, NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { getPromptCenterItem, savePromptCenterVersion } from '@/lib/prompt-center/service'

type PromptCenterSaveBody = {
  content?: unknown
  note?: unknown
}

function readRequiredContent(body: PromptCenterSaveBody) {
  if (typeof body.content !== 'string') {
    throw new ApiError('INVALID_PARAMS')
  }
  return body.content
}

function readOptionalNote(body: PromptCenterSaveBody) {
  return typeof body.note === 'string' ? body.note : null
}

export const GET = apiHandler(async (
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

  return NextResponse.json({ item: detail })
})

export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ promptKey: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  const { promptKey } = await context.params
  const existing = getPromptCenterItem(promptKey)
  if (!existing) {
    throw new ApiError('NOT_FOUND')
  }

  const body = await request.json() as PromptCenterSaveBody
  const content = readRequiredContent(body)
  const note = readOptionalNote(body)

  const item = savePromptCenterVersion(promptKey, {
    content,
    note,
    actor: {
      id: authResult.session.user.id,
      label: authResult.session.user.name || authResult.session.user.email || authResult.session.user.id,
    },
  })

  return NextResponse.json({ item })
})
