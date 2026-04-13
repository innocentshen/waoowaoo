import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query/keys'

const { invalidateQueriesMock } = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}))

import { useRefreshAll } from '@/lib/query/hooks/useProjectData'

describe('query refresh hooks', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset()
    invalidateQueriesMock.mockResolvedValue(undefined)
  })

  it('useRefreshAll waits for project and episode invalidations', async () => {
    const refresh = useRefreshAll('project-1', 'episode-1')

    await expect(refresh()).resolves.toBeUndefined()

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.projectData('project-1'),
    })
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.projectAssets.all('project-1'),
    })
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.episodeData('project-1', 'episode-1'),
    })
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: queryKeys.storyboards.all('episode-1'),
    })
  })
})
