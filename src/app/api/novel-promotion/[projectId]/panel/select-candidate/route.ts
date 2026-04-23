import { logInfo as _ulogInfo } from '@/lib/logging/core'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSignedUrl, generateUniqueKey, downloadAndUploadImage, toFetchableUrl } from '@/lib/storage'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import {
  moveUrlsIntoPanelImageHistory,
  parseStringArrayJson,
} from '@/lib/novel-promotion/panel-image-history'

function parseUnknownArray(jsonValue: string | null): unknown[] {
  if (!jsonValue) return []
  try {
    const parsed = JSON.parse(jsonValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * POST /api/novel-promotion/[projectId]/panel/select-candidate
 * 缁熶竴鐨勫€欓€夊浘鐗囨搷浣?API
 *
 * action: 'select' - 閫夋嫨鍊欓€夊浘鐗囦綔涓烘渶缁堝浘鐗?
 * action: 'cancel' - 鍙栨秷閫夋嫨锛屾竻绌哄€欓€夊垪琛?
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const { panelId, selectedImageUrl, action = 'select' } = body

  if (!panelId) {
    throw new ApiError('INVALID_PARAMS')
  }

  if (action === 'cancel') {
    const panel = await prisma.novelPromotionPanel.findUnique({
      where: { id: panelId },
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

    const nextHistory = moveUrlsIntoPanelImageHistory({
      rawHistory: panel.imageHistory,
      nextImageUrl: panel.imageUrl,
      extraUrls: parseStringArrayJson(panel.candidateImages).filter((candidate) => !candidate.startsWith('PENDING:')),
    })

    await prisma.novelPromotionPanel.update({
      where: { id: panel.id },
      data: {
        candidateImages: null,
        imageHistory: nextHistory.serialized,
      },
    })

    return NextResponse.json({
      success: true,
      message: '宸插彇娑堥€夋嫨'
    })
  }

  if (!selectedImageUrl) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findUnique({
    where: { id: panelId }
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const candidateImages = parseUnknownArray(panel.candidateImages)
  const selectedCosKey = await resolveStorageKeyFromMediaValue(selectedImageUrl)
  const candidateRecords = (await Promise.all(candidateImages.map(async (candidate: unknown) => ({
    raw: typeof candidate === 'string' ? candidate : '',
    key: await resolveStorageKeyFromMediaValue(candidate),
  }))))
    .filter((candidate): candidate is { raw: string; key: string } => !!candidate.raw && !!candidate.key)
  const candidateKeys = candidateRecords.map((candidate) => candidate.key)
  const isValidCandidate = !!selectedCosKey && candidateKeys.includes(selectedCosKey)

  if (!isValidCandidate) {
    _ulogInfo(
      `[select-candidate] 閫夋嫨澶辫触: selectedCosKey=${selectedCosKey}, candidateKeys=${JSON.stringify(candidateKeys)}, candidateImages=${JSON.stringify(candidateImages)}`,
    )
    throw new ApiError('INVALID_PARAMS')
  }

  let finalImageKey = selectedCosKey as string
  const isReusableKey = !finalImageKey.startsWith('http://') && !finalImageKey.startsWith('https://') && !finalImageKey.startsWith('/')

  if (!isReusableKey) {
    const sourceUrl = toFetchableUrl(selectedImageUrl)
    const cosKey = generateUniqueKey(`panel-${panelId}-selected`, 'png')
    finalImageKey = await downloadAndUploadImage(sourceUrl, cosKey)
  }

  const signedUrl = getSignedUrl(finalImageKey, 7 * 24 * 3600)
  const nextHistory = moveUrlsIntoPanelImageHistory({
    rawHistory: panel.imageHistory,
    currentImageUrl: panel.imageUrl,
    nextImageUrl: finalImageKey,
    extraUrls: candidateRecords
      .filter((candidate) => candidate.key !== selectedCosKey)
      .map((candidate) => candidate.raw),
  })

  await prisma.novelPromotionPanel.update({
    where: { id: panelId },
    data: {
      imageUrl: finalImageKey,
      imageHistory: nextHistory.serialized,
      candidateImages: null
    }
  })

  return NextResponse.json({
    success: true,
    imageUrl: signedUrl,
    cosKey: finalImageKey,
    message: '宸查€夋嫨鍥剧墖'
  })
})
