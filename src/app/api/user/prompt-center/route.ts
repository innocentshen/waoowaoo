import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-errors'
import { isErrorResponse, requireUserAuth } from '@/lib/api-auth'
import { listPromptCenterItems } from '@/lib/prompt-center/service'

export const GET = apiHandler(async () => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult

  return NextResponse.json({
    items: listPromptCenterItems(),
  })
})
