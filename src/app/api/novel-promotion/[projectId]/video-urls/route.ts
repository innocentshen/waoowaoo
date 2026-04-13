import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { resolvePanelVideoCandidates } from '@/lib/novel-promotion/video-candidates'

interface PanelData {
  panelIndex: number | null
  description: string | null
  videoUrl: string | null
  videoCandidates?: string | null
  videoGenerationMode?: string | null
  lipSyncVideoUrl: string | null
}

interface StoryboardData {
  id: string
  clipId: string
  panels?: PanelData[]
}

interface ClipData {
  id: string
}

interface EpisodeData {
  storyboards?: StoryboardData[]
  clips?: ClipData[]
}

interface DownloadableVideoCandidate {
  clipIndex: number
  panelIndex: number
  videoKey: string
  desc: string
  variantIndex: number
  isLipSync?: boolean
}

function toSafeFileStem(value: string | null | undefined) {
  return (value || '镜头').slice(0, 50).replace(/[\\/:*?"<>|]/g, '_')
}

function collectPanelDownloadables(panel: PanelData): DownloadableVideoCandidate[] {
  const safeDesc = toSafeFileStem(panel.description)
  const items: DownloadableVideoCandidate[] = resolvePanelVideoCandidates({
    videoCandidates: panel.videoCandidates || null,
    videoUrl: panel.videoUrl || null,
    videoGenerationMode: panel.videoGenerationMode || null,
  }).map((candidate, index) => ({
    clipIndex: 0,
    panelIndex: panel.panelIndex || 0,
    videoKey: candidate.videoUrl,
    desc: safeDesc,
    variantIndex: index + 1,
  }))

  if (panel.lipSyncVideoUrl) {
    items.push({
      clipIndex: 0,
      panelIndex: panel.panelIndex || 0,
      videoKey: panel.lipSyncVideoUrl,
      desc: safeDesc,
      variantIndex: items.length + 1,
      isLipSync: true,
    })
  }

  return items
}

export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const body = await request.json()
  const { episodeId } = body as {
    episodeId?: string
    panelPreferences?: Record<string, boolean>
  }

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const project = authResult.project

  let episodes: EpisodeData[] = []

  if (episodeId) {
    const episode = await prisma.novelPromotionEpisode.findUnique({
      where: { id: episodeId },
      include: {
        storyboards: {
          include: {
            panels: { orderBy: { panelIndex: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
        clips: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (episode) {
      episodes = [episode]
    }
  } else {
    const npData = await prisma.novelPromotionProject.findFirst({
      where: { projectId },
      include: {
        episodes: {
          include: {
            storyboards: {
              include: {
                panels: { orderBy: { panelIndex: 'asc' } },
              },
              orderBy: { createdAt: 'asc' },
            },
            clips: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })
    episodes = npData?.episodes || []
  }

  if (episodes.length === 0) {
    throw new ApiError('NOT_FOUND')
  }

  const allStoryboards: StoryboardData[] = []
  const allClips: ClipData[] = []
  for (const episode of episodes) {
    allStoryboards.push(...(episode.storyboards || []))
    allClips.push(...(episode.clips || []))
  }

  const videoCandidates: DownloadableVideoCandidate[] = []
  for (const storyboard of allStoryboards) {
    const clipIndex = allClips.findIndex((clip) => clip.id === storyboard.clipId)
    for (const panel of storyboard.panels || []) {
      collectPanelDownloadables(panel).forEach((candidate) => {
        videoCandidates.push({
          ...candidate,
          clipIndex: clipIndex >= 0 ? clipIndex : 999,
        })
      })
    }
  }

  videoCandidates.sort((left, right) => {
    if (left.clipIndex !== right.clipIndex) return left.clipIndex - right.clipIndex
    if (left.panelIndex !== right.panelIndex) return left.panelIndex - right.panelIndex
    if (!!left.isLipSync !== !!right.isLipSync) return left.isLipSync ? 1 : -1
    return left.variantIndex - right.variantIndex
  })

  const result = videoCandidates.map((video, index) => {
    const variantSuffix = video.isLipSync ? '_synced' : `_v${video.variantIndex}`
    const fileName = `${String(index + 1).padStart(3, '0')}_${video.desc}${variantSuffix}.mp4`
    const proxyUrl = `/api/novel-promotion/${projectId}/video-proxy?key=${encodeURIComponent(video.videoKey)}`
    return {
      index: index + 1,
      fileName,
      videoUrl: proxyUrl,
    }
  })

  if (result.length === 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  return NextResponse.json({
    projectName: project.name,
    videos: result,
  })
})
