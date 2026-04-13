import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteObjects } from '@/lib/storage'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import {
  removePanelVideoCandidate,
  selectPanelVideoCandidate,
} from '@/lib/novel-promotion/video-candidates'

type CandidateAction = 'select' | 'delete'

function normalizeAction(value: unknown): CandidateAction {
  return value === 'delete' ? 'delete' : 'select'
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const panelId = typeof body?.panelId === 'string' ? body.panelId.trim() : ''
  const candidateId = typeof body?.candidateId === 'string' ? body.candidateId.trim() : ''
  const action = normalizeAction(body?.action)

  if (!panelId || !candidateId) {
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
      videoUrl: true,
      videoCandidates: true,
      videoGenerationMode: true,
      lipSyncVideoUrl: true,
    },
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  if (action === 'select') {
    const selection = selectPanelVideoCandidate(panel, candidateId)
    if (!selection) {
      throw new ApiError('INVALID_PARAMS')
    }

    await prisma.novelPromotionPanel.update({
      where: { id: panel.id },
      data: {
        videoCandidates: selection.serialized,
        videoUrl: selection.selectedCandidate.videoUrl,
        videoGenerationMode: selection.selectedCandidate.generationMode,
        lipSyncVideoUrl: null,
        lipSyncVideoMediaId: null,
        lipSyncTaskId: null,
      },
    })

    return NextResponse.json({
      success: true,
      selectedCandidateId: selection.selectedCandidate.id,
      videoUrl: selection.selectedCandidate.videoUrl,
    })
  }

  const removal = removePanelVideoCandidate(panel, candidateId)
  if (!removal) {
    throw new ApiError('INVALID_PARAMS')
  }

  const shouldClearLipSync = removal.selectedChanged
  await prisma.novelPromotionPanel.update({
    where: { id: panel.id },
    data: {
      videoCandidates: removal.serialized,
      videoUrl: removal.selectedCandidate?.videoUrl || null,
      videoGenerationMode: removal.selectedCandidate?.generationMode || null,
      ...(shouldClearLipSync
        ? {
          lipSyncVideoUrl: null,
          lipSyncVideoMediaId: null,
          lipSyncTaskId: null,
        }
        : {}),
    },
  })

  const removedStorageKey = await resolveStorageKeyFromMediaValue(removal.removedCandidate.videoUrl)
  if (removedStorageKey) {
    await deleteObjects([removedStorageKey])
  }

  return NextResponse.json({
    success: true,
    deletedCandidateId: removal.removedCandidate.id,
    nextSelectedCandidateId: removal.selectedCandidate?.id || null,
  })
})
