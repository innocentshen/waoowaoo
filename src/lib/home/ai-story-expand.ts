import { resolveTaskResponse } from '@/lib/task/client'

interface ApiFetchLike {
  (input: string, init?: RequestInit): Promise<Response>
}

interface ExpandHomeStoryPayload {
  expandedText?: string
}

export interface ExpandHomeStoryParams {
  apiFetch: ApiFetchLike
  prompt: string
  projectId?: string
}

export interface ExpandHomeStoryResult {
  expandedText: string
}

export async function expandHomeStory({
  apiFetch,
  prompt,
  projectId,
}: ExpandHomeStoryParams): Promise<ExpandHomeStoryResult> {
  const normalizedProjectId = typeof projectId === 'string' ? projectId.trim() : ''
  const response = await apiFetch('/api/user/ai-story-expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      normalizedProjectId
        ? {
            prompt,
            projectId: normalizedProjectId,
          }
        : {
            prompt,
          },
    ),
  })

  const result = await resolveTaskResponse<ExpandHomeStoryPayload>(response)
  const expandedText = typeof result.expandedText === 'string' ? result.expandedText.trim() : ''
  if (!expandedText) {
    throw new Error('AI story expand response missing expandedText')
  }

  return {
    expandedText,
  }
}
