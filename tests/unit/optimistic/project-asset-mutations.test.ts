import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, Location, Project } from '@/types/project'
import type { AssetSummary, CharacterAssetSummary, LocationAssetSummary } from '@/lib/assets/contracts'
import type { ProjectAssetsData } from '@/lib/query/hooks/useProjectAssets'
import { queryKeys } from '@/lib/query/keys'
import { MockQueryClient } from '../../helpers/mock-query-client'

let queryClient = new MockQueryClient()
const useQueryClientMock = vi.fn(() => queryClient)
const useMutationMock = vi.fn((options: unknown) => options)

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useRef: <T,>(value: T) => ({ current: value }),
  }
})

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => useQueryClientMock(),
  useMutation: (options: unknown) => useMutationMock(options),
}))

vi.mock('@/lib/query/mutations/mutation-shared', async () => {
  const actual = await vi.importActual<typeof import('@/lib/query/mutations/mutation-shared')>(
    '@/lib/query/mutations/mutation-shared',
  )
  return {
    ...actual,
    requestJsonWithError: vi.fn(),
    requestVoidWithError: vi.fn(),
    invalidateQueryTemplates: vi.fn(),
  }
})

import {
  useDeleteProjectCharacter,
  useSelectProjectCharacterImage,
} from '@/lib/query/mutations/character-base-mutations'
import { useSelectProjectLocationImage } from '@/lib/query/mutations/location-image-mutations'

interface SelectProjectCharacterMutation {
  onMutate: (variables: {
    characterId: string
    appearanceId: string
    imageIndex: number | null
  }) => Promise<unknown>
  onError: (error: unknown, variables: unknown, context: unknown) => void
}

interface DeleteProjectCharacterMutation {
  onMutate: (characterId: string) => Promise<unknown>
  onError: (error: unknown, characterId: string, context: unknown) => void
}

interface SelectProjectLocationMutation {
  onMutate: (variables: {
    locationId: string
    imageIndex: number | null
  }) => Promise<unknown>
  onError: (error: unknown, variables: unknown, context: unknown) => void
}

function buildCharacter(selectedIndex: number | null): Character {
  return {
    id: 'character-1',
    name: 'Hero',
    appearances: [{
      id: 'appearance-1',
      appearanceIndex: 0,
      changeReason: 'default',
      description: null,
      descriptions: null,
      imageUrl: selectedIndex === null ? null : `img-${selectedIndex}`,
      imageUrls: ['img-0', 'img-1', 'img-2'],
      previousImageUrl: null,
      previousImageUrls: [],
      previousDescription: null,
      previousDescriptions: null,
      selectedIndex,
    }],
  }
}

function buildAssets(selectedIndex: number | null): ProjectAssetsData {
  return {
    characters: [buildCharacter(selectedIndex)],
    locations: [] as Location[],
    props: [],
  }
}

function buildProject(selectedIndex: number | null): Project {
  return {
    novelPromotionData: {
      characters: [buildCharacter(selectedIndex)],
      locations: [],
      props: [],
    },
  } as unknown as Project
}

function buildUnifiedCharacterAssets(selectedIndex: number | null): AssetSummary[] {
  const character: CharacterAssetSummary = {
    id: 'character-1',
    scope: 'project',
    kind: 'character',
    family: 'visual',
    name: 'Hero',
    folderId: null,
    capabilities: {
      canGenerate: true,
      canSelectRender: true,
      canRevertRender: true,
      canModifyRender: true,
      canUploadRender: true,
      canBindVoice: true,
      canCopyFromGlobal: true,
    },
    taskRefs: [],
    taskState: { isRunning: false, lastError: null },
    introduction: null,
    profileData: null,
    profileConfirmed: true,
    profileTaskRefs: [],
    profileTaskState: { isRunning: false, lastError: null },
    voice: {
      voiceType: null,
      voiceId: null,
      customVoiceUrl: null,
      media: null,
    },
    variants: [{
      id: 'appearance-1',
      index: 0,
      label: 'default',
      description: null,
      selectionState: {
        selectedRenderIndex: selectedIndex,
      },
      taskRefs: [],
      taskState: { isRunning: false, lastError: null },
      renders: ['img-0', 'img-1', 'img-2'].map((imageUrl, index) => ({
        id: `render-${index}`,
        index,
        imageUrl,
        media: null,
        isSelected: selectedIndex === index,
        previousImageUrl: null,
        previousMedia: null,
        taskRefs: [],
        taskState: { isRunning: false, lastError: null },
      })),
    }],
  }
  return [character]
}

function buildUnifiedLocationAssets(selectedIndex: number | null): AssetSummary[] {
  const location: LocationAssetSummary = {
    id: 'location-1',
    scope: 'project',
    kind: 'location',
    family: 'visual',
    name: 'Cliff',
    folderId: null,
    capabilities: {
      canGenerate: true,
      canSelectRender: true,
      canRevertRender: true,
      canModifyRender: true,
      canUploadRender: true,
      canBindVoice: false,
      canCopyFromGlobal: true,
    },
    taskRefs: [],
    taskState: { isRunning: false, lastError: null },
    summary: null,
    selectedVariantId: selectedIndex === null ? null : `variant-${selectedIndex}`,
    variants: [0, 1, 2].map((index) => ({
      id: `variant-${index}`,
      index,
      label: `option-${index}`,
      description: null,
      selectionState: {
        selectedRenderIndex: index === selectedIndex ? 0 : null,
      },
      taskRefs: [],
      taskState: { isRunning: false, lastError: null },
      renders: [{
        id: `location-render-${index}`,
        index: 0,
        imageUrl: `location-img-${index}`,
        media: null,
        isSelected: index === selectedIndex,
        previousImageUrl: null,
        previousMedia: null,
        taskRefs: [],
        taskState: { isRunning: false, lastError: null },
      }],
    })),
  }
  return [location]
}

describe('project asset optimistic mutations', () => {
  beforeEach(() => {
    queryClient = new MockQueryClient()
    useQueryClientMock.mockClear()
    useMutationMock.mockClear()
  })

  it('optimistically selects project character image and ignores stale rollback', async () => {
    const projectId = 'project-1'
    const assetsKey = queryKeys.projectAssets.all(projectId)
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'project', projectId })
    const unifiedCharacterKey = queryKeys.assets.list({ scope: 'project', projectId, kind: 'character' })
    const projectKey = queryKeys.projectData(projectId)
    queryClient.seedQuery(assetsKey, buildAssets(0))
    queryClient.seedQuery(unifiedAssetsKey, buildUnifiedCharacterAssets(0))
    queryClient.seedQuery(unifiedCharacterKey, buildUnifiedCharacterAssets(0))
    queryClient.seedQuery(projectKey, buildProject(0))

    const mutation = useSelectProjectCharacterImage(projectId) as unknown as SelectProjectCharacterMutation
    const firstVariables = {
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      imageIndex: 1,
    }
    const secondVariables = {
      characterId: 'character-1',
      appearanceId: 'appearance-1',
      imageIndex: 2,
    }

    const firstContext = await mutation.onMutate(firstVariables)
    const afterFirst = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const afterFirstUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const afterFirstFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedCharacterKey)
    expect(afterFirst?.characters[0]?.appearances[0]?.selectedIndex).toBe(1)
    expect((afterFirstUnified?.[0] as CharacterAssetSummary | undefined)?.variants[0]?.selectionState.selectedRenderIndex).toBe(1)
    expect((afterFirstFiltered?.[0] as CharacterAssetSummary | undefined)?.variants[0]?.renders[1]?.isSelected).toBe(true)

    const secondContext = await mutation.onMutate(secondVariables)
    const afterSecond = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const afterSecondUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterSecond?.characters[0]?.appearances[0]?.selectedIndex).toBe(2)
    expect((afterSecondUnified?.[0] as CharacterAssetSummary | undefined)?.variants[0]?.selectionState.selectedRenderIndex).toBe(2)

    mutation.onError(new Error('first failed'), firstVariables, firstContext)
    const afterStaleError = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const afterStaleUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterStaleError?.characters[0]?.appearances[0]?.selectedIndex).toBe(2)
    expect((afterStaleUnified?.[0] as CharacterAssetSummary | undefined)?.variants[0]?.selectionState.selectedRenderIndex).toBe(2)

    mutation.onError(new Error('second failed'), secondVariables, secondContext)
    const afterLatestRollback = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const afterLatestUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterLatestRollback?.characters[0]?.appearances[0]?.selectedIndex).toBe(1)
    expect((afterLatestUnified?.[0] as CharacterAssetSummary | undefined)?.variants[0]?.selectionState.selectedRenderIndex).toBe(1)
  })

  it('optimistically deletes project character and restores on error', async () => {
    const projectId = 'project-1'
    const assetsKey = queryKeys.projectAssets.all(projectId)
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'project', projectId })
    const projectKey = queryKeys.projectData(projectId)
    queryClient.seedQuery(assetsKey, buildAssets(0))
    queryClient.seedQuery(unifiedAssetsKey, buildUnifiedCharacterAssets(0))
    queryClient.seedQuery(projectKey, buildProject(0))

    const mutation = useDeleteProjectCharacter(projectId) as unknown as DeleteProjectCharacterMutation
    const context = await mutation.onMutate('character-1')

    const afterDeleteAssets = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const afterDeleteUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterDeleteAssets?.characters).toHaveLength(0)
    expect(afterDeleteUnified).toEqual([])

    const afterDeleteProject = queryClient.getQueryData<Project>(projectKey)
    expect(afterDeleteProject?.novelPromotionData?.characters ?? []).toHaveLength(0)

    mutation.onError(new Error('delete failed'), 'character-1', context)

    const rolledBackAssets = queryClient.getQueryData<ProjectAssetsData>(assetsKey)
    const rolledBackUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(rolledBackAssets?.characters).toHaveLength(1)
    expect(rolledBackAssets?.characters[0]?.id).toBe('character-1')
    expect(rolledBackUnified).toHaveLength(1)
  })

  it('optimistically selects project location image in unified asset caches', async () => {
    const projectId = 'project-1'
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'project', projectId })
    const projectKey = queryKeys.projectData(projectId)
    queryClient.seedQuery(unifiedAssetsKey, buildUnifiedLocationAssets(0))
    queryClient.seedQuery(projectKey, {
      novelPromotionData: {
        characters: [],
        locations: [{
          id: 'location-1',
          name: 'Cliff',
          summary: null,
          selectedImageId: 'location-image-0',
          images: [0, 1, 2].map((index) => ({
            id: `location-image-${index}`,
            imageIndex: index,
            description: null,
            imageUrl: `location-img-${index}`,
            previousImageUrl: null,
            previousDescription: null,
            isSelected: index === 0,
          })),
        }],
        props: [],
      },
    } as unknown as Project)

    const mutation = useSelectProjectLocationImage(projectId) as unknown as SelectProjectLocationMutation
    await mutation.onMutate({
      locationId: 'location-1',
      imageIndex: 2,
    })

    const afterSelectUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const selectedLocation = afterSelectUnified?.[0] as LocationAssetSummary | undefined
    expect(selectedLocation?.selectedVariantId).toBe('variant-2')
    expect(selectedLocation?.variants[2]?.renders[0]?.isSelected).toBe(true)
  })
})
