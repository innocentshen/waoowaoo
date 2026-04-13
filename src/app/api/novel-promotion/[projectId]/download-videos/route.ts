import { logInfo as _ulogInfo, logError as _ulogError } from '@/lib/logging/core'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import archiver from 'archiver'
import { getObjectBuffer, toFetchableUrl } from '@/lib/storage'
import { resolveStorageKeyFromMediaValue } from '@/lib/media/service'
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

interface VideoItem {
  description: string
  videoUrl: string
  clipIndex: number
  panelIndex: number
  variantIndex: number
  isLipSync?: boolean
}

function toSafeFileStem(value: string | null | undefined) {
  return (value || '镜头').slice(0, 50).replace(/[\\/:*?"<>|]/g, '_')
}

function collectPanelVideos(panel: PanelData): VideoItem[] {
  const description = toSafeFileStem(panel.description)
  const items: VideoItem[] = resolvePanelVideoCandidates({
    videoCandidates: panel.videoCandidates || null,
    videoUrl: panel.videoUrl || null,
    videoGenerationMode: panel.videoGenerationMode || null,
  }).map((candidate, index) => ({
    description,
    videoUrl: candidate.videoUrl,
    clipIndex: 0,
    panelIndex: panel.panelIndex || 0,
    variantIndex: index + 1,
  }))

  if (panel.lipSyncVideoUrl) {
    items.push({
      description,
      videoUrl: panel.lipSyncVideoUrl,
      clipIndex: 0,
      panelIndex: panel.panelIndex || 0,
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
  const { project } = authResult

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

  const videos: VideoItem[] = []
  for (const storyboard of allStoryboards) {
    const clipIndex = allClips.findIndex((clip) => clip.id === storyboard.clipId)
    for (const panel of storyboard.panels || []) {
      collectPanelVideos(panel).forEach((video) => {
        videos.push({
          ...video,
          clipIndex: clipIndex >= 0 ? clipIndex : 999,
        })
      })
    }
  }

  videos.sort((left, right) => {
    if (left.clipIndex !== right.clipIndex) return left.clipIndex - right.clipIndex
    if (left.panelIndex !== right.panelIndex) return left.panelIndex - right.panelIndex
    if (!!left.isLipSync !== !!right.isLipSync) return left.isLipSync ? 1 : -1
    return left.variantIndex - right.variantIndex
  })

  if (videos.length === 0) {
    throw new ApiError('INVALID_PARAMS')
  }

  _ulogInfo(`Preparing to download ${videos.length} videos for project ${projectId}`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  const archiveFinished = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', (error) => reject(error))
  })

  const chunks: Uint8Array[] = []
  archive.on('data', (chunk) => {
    chunks.push(chunk)
  })

  for (const [index, video] of videos.entries()) {
    try {
      _ulogInfo(`Downloading video ${index + 1}: ${video.videoUrl}`)

      let videoData: Buffer
      const storageKey = await resolveStorageKeyFromMediaValue(video.videoUrl)

      if (video.videoUrl.startsWith('http://') || video.videoUrl.startsWith('https://')) {
        const response = await fetch(toFetchableUrl(video.videoUrl))
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        videoData = Buffer.from(await response.arrayBuffer())
      } else if (storageKey) {
        videoData = await getObjectBuffer(storageKey)
      } else {
        const response = await fetch(toFetchableUrl(video.videoUrl))
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }
        videoData = Buffer.from(await response.arrayBuffer())
      }

      const variantSuffix = video.isLipSync ? '_synced' : `_v${video.variantIndex}`
      const fileName = `${String(index + 1).padStart(3, '0')}_${video.description}${variantSuffix}.mp4`
      archive.append(videoData, { name: fileName })
      _ulogInfo(`Added ${fileName} to archive`)
    } catch (error) {
      _ulogError(`Failed to download video ${index + 1}:`, error)
    }
  }

  await archive.finalize()
  await archiveFinished

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return new Response(result, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(project.name)}_videos.zip"`,
    },
  })
})
