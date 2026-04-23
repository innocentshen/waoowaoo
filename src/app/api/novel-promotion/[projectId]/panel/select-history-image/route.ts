import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { downloadAndUploadImage, generateUniqueKey, getSignedUrl, toFetchableUrl } from '@/lib/storage'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
import {
  moveUrlsIntoPanelImageHistory,
  parsePanelImageHistory,
  parseStringArrayJson,
} from '@/lib/novel-promotion/panel-image-history'

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const panelId = typeof body?.panelId === 'string' ? body.panelId.trim() : ''
  const selectedImageUrl = typeof body?.selectedImageUrl === 'string' ? body.selectedImageUrl.trim() : ''

  if (!panelId || !selectedImageUrl) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findFirst({
    where: {
      id: panelId,
      storyboard: {
        episode: {
          novelPromotionProject: {
            projectId,
          },
        },
      },
    },
    select: {
      id: true,
      imageUrl: true,
      candidateImages: true,
      imageHistory: true,
    },
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const selectedKey = await resolveStorageKeyFromMediaValue(selectedImageUrl)
  const historyRecords = (await Promise.all(parsePanelImageHistory(panel.imageHistory).map(async (entry) => ({
    ...entry,
    key: await resolveStorageKeyFromMediaValue(entry.url),
  }))))
    .filter((entry): entry is { url: string; timestamp: string; key: string } => !!entry.key)
  const matchedHistory = selectedKey
    ? historyRecords.find((entry) => entry.key === selectedKey)
    : null

  if (!matchedHistory) {
    throw new ApiError('INVALID_PARAMS')
  }

  let finalImageKey = matchedHistory.key
  const isReusableKey = !finalImageKey.startsWith('http://') && !finalImageKey.startsWith('https://') && !finalImageKey.startsWith('/')
  if (!isReusableKey) {
    const sourceUrl = toFetchableUrl(selectedImageUrl)
    const cosKey = generateUniqueKey(`panel-${panelId}-history`, 'png')
    finalImageKey = await downloadAndUploadImage(sourceUrl, cosKey)
  }

  const nextHistory = moveUrlsIntoPanelImageHistory({
    rawHistory: panel.imageHistory,
    currentImageUrl: panel.imageUrl,
    nextImageUrl: finalImageKey,
    extraUrls: parseStringArrayJson(panel.candidateImages).filter((candidate) => !candidate.startsWith('PENDING:')),
  })

  await prisma.novelPromotionPanel.update({
    where: { id: panel.id },
    data: {
      imageUrl: finalImageKey,
      imageHistory: nextHistory.serialized,
      candidateImages: null,
    },
  })

  return NextResponse.json({
    success: true,
    imageUrl: getSignedUrl(finalImageKey, 7 * 24 * 3600),
    cosKey: finalImageKey,
  })
})
