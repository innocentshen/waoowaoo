import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { resolveMediaRef } from '@/lib/media/service'
import {
  moveUrlsIntoPanelImageHistory,
  parseStringArrayJson,
} from '@/lib/novel-promotion/panel-image-history'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuth(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { novelData } = authResult

  const body = await request.json()
  const targetPanelId = typeof body?.targetPanelId === 'string' ? body.targetPanelId : ''
  const sourcePanelId = typeof body?.sourcePanelId === 'string' ? body.sourcePanelId : ''

  if (!targetPanelId || !sourcePanelId || targetPanelId === sourcePanelId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panelWhere = {
    storyboard: {
      episode: {
        novelPromotionProjectId: novelData.id,
      },
    },
  }

  const [targetPanel, sourcePanel] = await Promise.all([
    prisma.novelPromotionPanel.findFirst({
      where: {
        id: targetPanelId,
        ...panelWhere,
      },
      select: {
        id: true,
        imageUrl: true,
        imageMediaId: true,
        previousImageUrl: true,
        previousImageMediaId: true,
        candidateImages: true,
        imageHistory: true,
      },
    }),
    prisma.novelPromotionPanel.findFirst({
      where: {
        id: sourcePanelId,
        ...panelWhere,
      },
      select: {
        id: true,
        imageUrl: true,
        imageMediaId: true,
      },
    }),
  ])

  if (!targetPanel || !sourcePanel) {
    throw new ApiError('NOT_FOUND')
  }

  if (!sourcePanel.imageUrl && !sourcePanel.imageMediaId) {
    throw new ApiError('INVALID_PARAMS')
  }

  await prisma.novelPromotionPanel.update({
    where: { id: targetPanel.id },
    data: {
      previousImageUrl: targetPanel.imageUrl || targetPanel.previousImageUrl || null,
      previousImageMediaId: targetPanel.imageMediaId || targetPanel.previousImageMediaId || null,
      imageUrl: sourcePanel.imageUrl || null,
      imageMediaId: sourcePanel.imageMediaId || null,
      candidateImages: null,
      imageHistory: moveUrlsIntoPanelImageHistory({
        rawHistory: targetPanel.imageHistory,
        currentImageUrl: targetPanel.imageUrl,
        nextImageUrl: sourcePanel.imageUrl || null,
        extraUrls: parseStringArrayJson(targetPanel.candidateImages).filter((candidate) => !candidate.startsWith('PENDING:')),
      }).serialized,
    },
  })

  const sourceImageMedia = await resolveMediaRef(sourcePanel.imageMediaId, sourcePanel.imageUrl)

  return NextResponse.json({
    success: true,
    panelId: targetPanel.id,
    sourcePanelId: sourcePanel.id,
    imageUrl: sourceImageMedia?.url || sourcePanel.imageUrl || null,
  })
})
