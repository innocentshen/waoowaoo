import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { serializeStructuredJsonField } from '@/lib/novel-promotion/panel-ai-data-sync'

type PanelShiftTx = Pick<typeof prisma, 'novelPromotionPanel'>

function parseNullableNumberField(value: unknown): number | null {
  if (value === null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  throw new ApiError('INVALID_PARAMS')
}

function toStructuredJsonField(value: unknown, fieldName: string): string | null {
  try {
    return serializeStructuredJsonField(value, fieldName)
  } catch (error) {
    const message = error instanceof Error ? error.message : `${fieldName} must be valid JSON`
    throw new ApiError('INVALID_PARAMS', { message })
  }
}

async function shiftPanelsForInsert(
  tx: PanelShiftTx,
  storyboardId: string,
  insertAfterIndex: number,
) {
  const maxPanel = await tx.novelPromotionPanel.findFirst({
    where: { storyboardId },
    orderBy: { panelIndex: 'desc' },
    select: { panelIndex: true },
  })
  const maxPanelIndex = maxPanel?.panelIndex ?? -1
  const offset = maxPanelIndex + 1000

  await tx.novelPromotionPanel.updateMany({
    where: {
      storyboardId,
      panelIndex: { gt: insertAfterIndex },
    },
    data: {
      panelIndex: { increment: offset },
      panelNumber: { increment: offset },
    },
  })

  await tx.novelPromotionPanel.updateMany({
    where: {
      storyboardId,
      panelIndex: { gt: insertAfterIndex + offset },
    },
    data: {
      panelIndex: { decrement: offset - 1 },
      panelNumber: { decrement: offset - 1 },
    },
  })
}

/**
 * POST /api/novel-promotion/[projectId]/panel
 * Create a new panel. When `insertAfterPanelId` is provided, insert it after that panel.
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const {
    storyboardId,
    insertAfterPanelId,
    shotType,
    cameraMove,
    description,
    location,
    characters,
    props,
    srtStart,
    srtEnd,
    duration,
    videoPrompt,
    firstLastFramePrompt,
  } = body

  if (!storyboardId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: storyboardId },
    include: {
      panels: {
        orderBy: { panelIndex: 'desc' },
        take: 1,
      },
    },
  })

  if (!storyboard) {
    throw new ApiError('NOT_FOUND')
  }

  let insertAfterPanelIndex: number | null = null
  if (typeof insertAfterPanelId === 'string' && insertAfterPanelId.trim()) {
    const insertAfterPanel = await prisma.novelPromotionPanel.findUnique({
      where: { id: insertAfterPanelId },
      select: {
        id: true,
        storyboardId: true,
        panelIndex: true,
      },
    })

    if (!insertAfterPanel || insertAfterPanel.storyboardId !== storyboardId) {
      throw new ApiError('INVALID_PARAMS')
    }

    insertAfterPanelIndex = insertAfterPanel.panelIndex
  }

  const newPanel = await prisma.$transaction(async (tx) => {
    const maxPanelIndex = storyboard.panels.length > 0 ? storyboard.panels[0].panelIndex : -1
    const nextPanelIndex = insertAfterPanelIndex === null ? maxPanelIndex + 1 : insertAfterPanelIndex + 1

    if (insertAfterPanelIndex !== null) {
      await shiftPanelsForInsert(tx, storyboardId, insertAfterPanelIndex)
    }

    const created = await tx.novelPromotionPanel.create({
      data: {
        storyboardId,
        panelIndex: nextPanelIndex,
        panelNumber: nextPanelIndex + 1,
        shotType: shotType ?? null,
        cameraMove: cameraMove ?? null,
        description: description ?? null,
        location: location ?? null,
        characters: characters ?? null,
        props: props ?? null,
        srtStart: srtStart ?? null,
        srtEnd: srtEnd ?? null,
        duration: duration ?? null,
        videoPrompt: videoPrompt ?? null,
        firstLastFramePrompt: firstLastFramePrompt ?? null,
      },
    })

    const panelCount = await tx.novelPromotionPanel.count({
      where: { storyboardId },
    })

    await tx.novelPromotionStoryboard.update({
      where: { id: storyboardId },
      data: { panelCount },
    })

    return created
  })

  return NextResponse.json({ success: true, panel: newPanel })
})

/**
 * DELETE /api/novel-promotion/[projectId]/panel
 * Delete a panel and compact the remaining order.
 */
export const DELETE = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const panelId = searchParams.get('panelId')

  if (!panelId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const panel = await prisma.novelPromotionPanel.findUnique({
    where: { id: panelId },
  })

  if (!panel) {
    throw new ApiError('NOT_FOUND')
  }

  const storyboardId = panel.storyboardId

  await prisma.$transaction(async (tx) => {
    await tx.novelPromotionPanel.delete({
      where: { id: panelId },
    })

    const deletedPanelIndex = panel.panelIndex
    const maxPanel = await tx.novelPromotionPanel.findFirst({
      where: { storyboardId },
      orderBy: { panelIndex: 'desc' },
      select: { panelIndex: true },
    })
    const maxPanelIndex = maxPanel?.panelIndex ?? -1
    const offset = maxPanelIndex + 1000

    await tx.novelPromotionPanel.updateMany({
      where: {
        storyboardId,
        panelIndex: { gt: deletedPanelIndex },
      },
      data: {
        panelIndex: { increment: offset },
        panelNumber: { increment: offset },
      },
    })

    await tx.novelPromotionPanel.updateMany({
      where: {
        storyboardId,
        panelIndex: { gt: deletedPanelIndex + offset },
      },
      data: {
        panelIndex: { decrement: offset + 1 },
        panelNumber: { decrement: offset + 1 },
      },
    })

    const panelCount = await tx.novelPromotionPanel.count({
      where: { storyboardId },
    })

    await tx.novelPromotionStoryboard.update({
      where: { id: storyboardId },
      data: { panelCount },
    })
  }, {
    maxWait: 15000,
    timeout: 30000,
  })

  return NextResponse.json({ success: true })
})

/**
 * PATCH /api/novel-promotion/[projectId]/panel
 * Supports lightweight panel updates and panel reordering.
 */
export const PATCH = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const panelModel = prisma.novelPromotionPanel as unknown as {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
  const { action, panelId, storyboardId, panelIndex, videoPrompt, firstLastFramePrompt } = body

  if (action === 'move') {
    const direction = body?.direction
    if (!panelId || (direction !== 'up' && direction !== 'down')) {
      throw new ApiError('INVALID_PARAMS')
    }

    const panel = await prisma.novelPromotionPanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        storyboardId: true,
        panelIndex: true,
      },
    })

    if (!panel) {
      throw new ApiError('NOT_FOUND')
    }

    const adjacentPanel = await prisma.novelPromotionPanel.findUnique({
      where: {
        storyboardId_panelIndex: {
          storyboardId: panel.storyboardId,
          panelIndex: direction === 'up' ? panel.panelIndex - 1 : panel.panelIndex + 1,
        },
      },
      select: {
        id: true,
        panelIndex: true,
      },
    })

    if (!adjacentPanel) {
      return NextResponse.json({ success: true, moved: false })
    }

    await prisma.$transaction(async (tx) => {
      await tx.novelPromotionPanel.update({
        where: { id: panel.id },
        data: {
          panelIndex: -1,
          panelNumber: 0,
        },
      })

      await tx.novelPromotionPanel.update({
        where: { id: adjacentPanel.id },
        data: {
          panelIndex: panel.panelIndex,
          panelNumber: panel.panelIndex + 1,
        },
      })

      await tx.novelPromotionPanel.update({
        where: { id: panel.id },
        data: {
          panelIndex: adjacentPanel.panelIndex,
          panelNumber: adjacentPanel.panelIndex + 1,
        },
      })

      await tx.novelPromotionStoryboard.update({
        where: { id: panel.storyboardId },
        data: { updatedAt: new Date() },
      })
    })

    return NextResponse.json({ success: true, moved: true })
  }

  if (panelId) {
    const panel = await prisma.novelPromotionPanel.findUnique({
      where: { id: panelId },
    })

    if (!panel) {
      throw new ApiError('NOT_FOUND')
    }

    const updateData: {
      videoPrompt?: string | null
      firstLastFramePrompt?: string | null
    } = {}
    if (videoPrompt !== undefined) updateData.videoPrompt = videoPrompt
    if (firstLastFramePrompt !== undefined) updateData.firstLastFramePrompt = firstLastFramePrompt

    await prisma.novelPromotionPanel.update({
      where: { id: panelId },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  }

  if (!storyboardId || panelIndex === undefined) {
    throw new ApiError('INVALID_PARAMS')
  }

  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: storyboardId },
  })

  if (!storyboard) {
    throw new ApiError('NOT_FOUND')
  }

  const updateData: {
    videoPrompt?: string | null
    firstLastFramePrompt?: string | null
  } = {}
  if (videoPrompt !== undefined) {
    updateData.videoPrompt = videoPrompt
  }
  if (firstLastFramePrompt !== undefined) {
    updateData.firstLastFramePrompt = firstLastFramePrompt
  }

  const updatedPanel = await prisma.novelPromotionPanel.updateMany({
    where: {
      storyboardId,
      panelIndex,
    },
    data: updateData,
  })

  if (updatedPanel.count === 0) {
    await panelModel.create({
      data: {
        storyboardId,
        panelIndex,
        panelNumber: panelIndex + 1,
        imageUrl: null,
        videoPrompt: videoPrompt ?? null,
        firstLastFramePrompt: firstLastFramePrompt ?? null,
      },
    })
  }

  return NextResponse.json({ success: true })
})

/**
 * PUT /api/novel-promotion/[projectId]/panel
 * Update a full panel payload. Prefer updating by stable panel id when available.
 */
export const PUT = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const body = await request.json()
  const panelModel = prisma.novelPromotionPanel as unknown as {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>
  }
  const {
    id,
    storyboardId,
    panelIndex,
    panelNumber,
    shotType,
    cameraMove,
    description,
    location,
    characters,
    props,
    srtStart,
    srtEnd,
    duration,
    videoPrompt,
    firstLastFramePrompt,
    actingNotes,
    photographyRules,
  } = body

  if ((!storyboardId || panelIndex === undefined) && typeof id !== 'string') {
    throw new ApiError('INVALID_PARAMS')
  }

  const updateData: {
    panelNumber?: number | null
    shotType?: string | null
    cameraMove?: string | null
    description?: string | null
    location?: string | null
    characters?: string | null
    props?: string | null
    srtStart?: number | null
    srtEnd?: number | null
    duration?: number | null
    videoPrompt?: string | null
    firstLastFramePrompt?: string | null
    actingNotes?: string | null
    photographyRules?: string | null
  } = {}

  if (panelNumber !== undefined) updateData.panelNumber = panelNumber
  if (shotType !== undefined) updateData.shotType = shotType
  if (cameraMove !== undefined) updateData.cameraMove = cameraMove
  if (description !== undefined) updateData.description = description
  if (location !== undefined) updateData.location = location
  if (characters !== undefined) updateData.characters = characters
  if (props !== undefined) updateData.props = props
  if (srtStart !== undefined) updateData.srtStart = parseNullableNumberField(srtStart)
  if (srtEnd !== undefined) updateData.srtEnd = parseNullableNumberField(srtEnd)
  if (duration !== undefined) updateData.duration = parseNullableNumberField(duration)
  if (videoPrompt !== undefined) updateData.videoPrompt = videoPrompt
  if (firstLastFramePrompt !== undefined) updateData.firstLastFramePrompt = firstLastFramePrompt
  if (actingNotes !== undefined) {
    updateData.actingNotes = toStructuredJsonField(actingNotes, 'actingNotes')
  }
  if (photographyRules !== undefined) {
    updateData.photographyRules = toStructuredJsonField(photographyRules, 'photographyRules')
  }

  if (typeof id === 'string' && id.trim()) {
    const existingPanelById = await prisma.novelPromotionPanel.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingPanelById) {
      throw new ApiError('NOT_FOUND')
    }

    const { panelNumber: _ignoredPanelNumber, ...updateDataById } = updateData

    await prisma.novelPromotionPanel.update({
      where: { id },
      data: updateDataById,
    })

    return NextResponse.json({ success: true })
  }

  const storyboard = await prisma.novelPromotionStoryboard.findUnique({
    where: { id: storyboardId },
  })

  if (!storyboard) {
    throw new ApiError('NOT_FOUND')
  }

  const existingPanel = await prisma.novelPromotionPanel.findUnique({
    where: {
      storyboardId_panelIndex: {
        storyboardId,
        panelIndex,
      },
    },
  })

  if (existingPanel) {
    await prisma.novelPromotionPanel.update({
      where: { id: existingPanel.id },
      data: updateData,
    })
  } else {
    await panelModel.create({
      data: {
        storyboardId,
        panelIndex,
        panelNumber: panelNumber ?? panelIndex + 1,
        shotType: shotType ?? null,
        cameraMove: cameraMove ?? null,
        description: description ?? null,
        location: location ?? null,
        characters: characters ?? null,
        props: props ?? null,
        srtStart: srtStart ?? null,
        srtEnd: srtEnd ?? null,
        duration: duration ?? null,
        videoPrompt: videoPrompt ?? null,
        firstLastFramePrompt: firstLastFramePrompt ?? null,
        actingNotes: actingNotes !== undefined ? toStructuredJsonField(actingNotes, 'actingNotes') : null,
        photographyRules: photographyRules !== undefined ? toStructuredJsonField(photographyRules, 'photographyRules') : null,
      },
    })
  }

  const panelCount = await prisma.novelPromotionPanel.count({
    where: { storyboardId },
  })

  await prisma.novelPromotionStoryboard.update({
    where: { id: storyboardId },
    data: { panelCount },
  })

  return NextResponse.json({ success: true })
})
