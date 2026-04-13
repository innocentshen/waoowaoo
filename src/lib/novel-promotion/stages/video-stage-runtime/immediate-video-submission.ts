const VIDEO_SUBMISSION_TIMEOUT_MS = 90_000

export interface VideoSubmissionPanelSnapshot {
  panelId?: string
  storyboardId: string
  panelIndex: number
  videoUrl?: string | null
  videoCandidates?: Array<{ id: string; videoUrl: string; isSelected: boolean }> | null
  videoErrorMessage?: string | null
  videoTaskRunning?: boolean | null
}

export interface VideoSubmissionBaseline {
  signature: string
  startedAt: number
}

export function buildVideoSubmissionKey(panel: Pick<VideoSubmissionPanelSnapshot, 'panelId' | 'storyboardId' | 'panelIndex'>): string {
  return panel.panelId?.trim() || `${panel.storyboardId}:${panel.panelIndex}`
}

export function createVideoSubmissionBaseline(panel: VideoSubmissionPanelSnapshot): VideoSubmissionBaseline {
  return {
    signature: JSON.stringify({
      videoUrl: panel.videoUrl || null,
      videoCandidates: (panel.videoCandidates || []).map((candidate) => ({
        id: candidate.id,
        videoUrl: candidate.videoUrl,
        isSelected: candidate.isSelected,
      })),
      videoErrorMessage: panel.videoErrorMessage || null,
    }),
    startedAt: Date.now(),
  }
}

export function shouldResolveVideoSubmissionLock(
  panel: VideoSubmissionPanelSnapshot | undefined,
  baseline: VideoSubmissionBaseline | undefined,
  now: number,
): boolean {
  if (!panel || !baseline) return true
  if (now - baseline.startedAt > VIDEO_SUBMISSION_TIMEOUT_MS) return true
  if (panel.videoTaskRunning) return true

  const current = createVideoSubmissionBaseline(panel)
  return current.signature !== baseline.signature
}
