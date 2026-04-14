import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { attachMediaFieldsToProject } from '@/lib/media/attach'

const storyboardInclude = {
  clip: {
    select: {
      id: true,
      start: true,
      end: true,
      startText: true,
      endText: true,
      summary: true,
    },
  },
  episode: {
    select: {
      id: true,
      episodeNumber: true,
      name: true,
    },
  },
  panels: {
    orderBy: {
      panelIndex: 'asc' as const,
    },
  },
}

async function resolveTargetEpisodeId(projectId: string, episodeId: string | null, beforeEpisodeId: string | null) {
  if (beforeEpisodeId) {
    const projectData = await prisma.novelPromotionProject.findUnique({
      where: { projectId },
      select: { id: true },
    })

    if (!projectData) {
      throw new ApiError('NOT_FOUND')
    }

    const currentEpisode = await prisma.novelPromotionEpisode.findFirst({
      where: {
        id: beforeEpisodeId,
        novelPromotionProjectId: projectData.id,
      },
      select: {
        episodeNumber: true,
      },
    })

    if (!currentEpisode) {
      throw new ApiError('NOT_FOUND')
    }

    const previousEpisode = await prisma.novelPromotionEpisode.findFirst({
      where: {
        novelPromotionProjectId: projectData.id,
        episodeNumber: { lt: currentEpisode.episodeNumber },
      },
      orderBy: {
        episodeNumber: 'desc',
      },
      select: {
        id: true,
      },
    })

    return previousEpisode?.id ?? null
  }

  return episodeId
}

export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const episodeId = searchParams.get('episodeId')
  const beforeEpisodeId = searchParams.get('beforeEpisodeId')

  if (!episodeId && !beforeEpisodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const targetEpisodeId = await resolveTargetEpisodeId(projectId, episodeId, beforeEpisodeId)
  if (!targetEpisodeId) {
    return NextResponse.json({ storyboards: [] })
  }

  const storyboards = await prisma.novelPromotionStoryboard.findMany({
    where: { episodeId: targetEpisodeId },
    include: storyboardInclude,
    orderBy: { createdAt: 'asc' },
  })

  const withMedia = await attachMediaFieldsToProject({ storyboards })
  const processedStoryboards = withMedia.storyboards || storyboards

  return NextResponse.json({ storyboards: processedStoryboards })
})

export const PATCH = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json().catch(() => ({}))
  const storyboardId = typeof body?.storyboardId === 'string' ? body.storyboardId : ''
  if (!storyboardId) {
    throw new ApiError('INVALID_PARAMS')
  }

  await prisma.novelPromotionStoryboard.update({
    where: { id: storyboardId },
    data: { lastError: null },
  })

  return NextResponse.json({ success: true })
})
