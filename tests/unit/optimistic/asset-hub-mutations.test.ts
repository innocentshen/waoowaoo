import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalCharacter, GlobalLocation } from '@/lib/query/hooks/useGlobalAssets'
import type { AssetSummary } from '@/lib/assets/contracts'
import { createIdleTaskState } from '@/lib/assets/contracts'
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
  }
})

vi.mock('@/lib/query/mutations/asset-hub-mutations-shared', async () => {
  const actual = await vi.importActual<typeof import('@/lib/query/mutations/asset-hub-mutations-shared')>(
    '@/lib/query/mutations/asset-hub-mutations-shared',
  )
  return {
    ...actual,
    invalidateGlobalCharacters: vi.fn(),
    invalidateGlobalLocations: vi.fn(),
  }
})

import {
  useDeleteCharacter,
  useSelectCharacterImage,
} from '@/lib/query/mutations/asset-hub-character-mutations'
import {
  useDeleteLocation as useDeleteAssetHubLocation,
  useSelectLocationImage,
} from '@/lib/query/mutations/asset-hub-location-mutations'

interface SelectCharacterMutation {
  onMutate: (variables: {
    characterId: string
    appearanceIndex: number
    imageIndex: number | null
  }) => Promise<unknown>
  onError: (error: unknown, variables: unknown, context: unknown) => void
}

interface DeleteLocationMutation {
  onMutate: (locationId: string) => Promise<unknown>
  onError: (error: unknown, locationId: string, context: unknown) => void
}

interface DeleteCharacterMutation {
  onMutate: (characterId: string) => Promise<unknown>
  onError: (error: unknown, characterId: string, context: unknown) => void
}

interface SelectLocationMutation {
  onMutate: (variables: {
    locationId: string
    imageIndex: number | null
    confirm?: boolean
  }) => Promise<unknown>
  onError: (error: unknown, variables: unknown, context: unknown) => void
}

function buildGlobalCharacter(selectedIndex: number | null): GlobalCharacter {
  return {
    id: 'character-1',
    name: 'Hero',
    folderId: 'folder-1',
    customVoiceUrl: null,
    appearances: [{
      id: 'appearance-1',
      appearanceIndex: 0,
      changeReason: 'default',
      artStyle: 'realistic',
      description: null,
      descriptionSource: null,
      imageUrl: selectedIndex === null ? null : `img-${selectedIndex}`,
      imageUrls: ['img-0', 'img-1', 'img-2'],
      selectedIndex,
      previousImageUrl: null,
      previousImageUrls: [],
      imageTaskRunning: false,
    }],
  }
}

function buildGlobalLocation(id: string): GlobalLocation {
  return {
    id,
    name: `Location ${id}`,
    summary: null,
    folderId: 'folder-1',
    artStyle: 'realistic',
    images: [{
      id: `${id}-img-0`,
      imageIndex: 0,
      description: null,
      imageUrl: null,
      previousImageUrl: null,
      isSelected: true,
      imageTaskRunning: false,
    }],
  }
}

function buildUnifiedCharacterAsset(selectedIndex: number | null): AssetSummary {
  return {
    id: 'character-1',
    scope: 'global',
    kind: 'character',
    family: 'visual',
    name: 'Hero',
    folderId: 'folder-1',
    capabilities: {
      canGenerate: true,
      canSelectRender: true,
      canRevertRender: true,
      canModifyRender: true,
      canUploadRender: true,
      canBindVoice: true,
      canCopyFromGlobal: false,
    },
    taskRefs: [],
    taskState: createIdleTaskState(),
    variants: [{
      id: 'appearance-1',
      index: 0,
      label: 'default',
      description: null,
      selectionState: {
        selectedRenderIndex: selectedIndex,
      },
      renders: [
        {
          id: 'appearance-1:0',
          index: 0,
          imageUrl: 'img-0',
          media: null,
          isSelected: selectedIndex === 0,
          previousImageUrl: null,
          previousMedia: null,
          taskRefs: [],
          taskState: createIdleTaskState(),
        },
        {
          id: 'appearance-1:1',
          index: 1,
          imageUrl: 'img-1',
          media: null,
          isSelected: selectedIndex === 1,
          previousImageUrl: null,
          previousMedia: null,
          taskRefs: [],
          taskState: createIdleTaskState(),
        },
        {
          id: 'appearance-1:2',
          index: 2,
          imageUrl: 'img-2',
          media: null,
          isSelected: selectedIndex === 2,
          previousImageUrl: null,
          previousMedia: null,
          taskRefs: [],
          taskState: createIdleTaskState(),
        },
      ],
      taskRefs: [],
      taskState: createIdleTaskState(),
    }],
    introduction: null,
    profileData: null,
    profileConfirmed: null,
    profileTaskRefs: [],
    profileTaskState: createIdleTaskState(),
    voice: {
      voiceType: null,
      voiceId: null,
      customVoiceUrl: null,
      media: null,
    },
  }
}

function buildUnifiedLocationAsset(
  kind: 'location' | 'prop',
  selectedIndex: number | null,
  assetId?: string,
): AssetSummary {
  return {
    id: assetId ?? `${kind}-1`,
    scope: 'global',
    kind,
    family: 'visual',
    name: kind === 'prop' ? 'Lantern' : 'Cliff',
    folderId: 'folder-1',
    capabilities: {
      canGenerate: true,
      canSelectRender: true,
      canRevertRender: true,
      canModifyRender: true,
      canUploadRender: true,
      canBindVoice: false,
      canCopyFromGlobal: false,
    },
    taskRefs: [],
    taskState: createIdleTaskState(),
    summary: null,
    selectedVariantId: selectedIndex === null ? null : `${kind}-variant-${selectedIndex}`,
    variants: [0, 1, 2].map((index) => ({
      id: `${kind}-variant-${index}`,
      index,
      label: `option-${index}`,
      description: null,
      selectionState: {
        selectedRenderIndex: index === selectedIndex ? 0 : null,
      },
      renders: [{
        id: `${kind}-render-${index}`,
        index: 0,
        imageUrl: `${kind}-img-${index}`,
        media: null,
        isSelected: index === selectedIndex,
        previousImageUrl: null,
        previousMedia: null,
        taskRefs: [],
        taskState: createIdleTaskState(),
      }],
      taskRefs: [],
      taskState: createIdleTaskState(),
    })),
  }
}

describe('asset hub optimistic mutations', () => {
  beforeEach(() => {
    queryClient = new MockQueryClient()
    useQueryClientMock.mockClear()
    useMutationMock.mockClear()
  })

  it('updates all character query caches optimistically and ignores stale rollback', async () => {
    const allCharactersKey = queryKeys.globalAssets.characters()
    const folderCharactersKey = queryKeys.globalAssets.characters('folder-1')
    const unifiedCharactersKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: null })
    queryClient.seedQuery(allCharactersKey, [buildGlobalCharacter(0)])
    queryClient.seedQuery(folderCharactersKey, [buildGlobalCharacter(0)])
    queryClient.seedQuery(unifiedCharactersKey, [buildUnifiedCharacterAsset(0)])

    const mutation = useSelectCharacterImage() as unknown as SelectCharacterMutation
    const firstVariables = {
      characterId: 'character-1',
      appearanceIndex: 0,
      imageIndex: 1,
    }
    const secondVariables = {
      characterId: 'character-1',
      appearanceIndex: 0,
      imageIndex: 2,
    }

    const firstContext = await mutation.onMutate(firstVariables)
    const afterFirstAll = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    const afterFirstFolder = queryClient.getQueryData<GlobalCharacter[]>(folderCharactersKey)
    const afterFirstUnified = queryClient.getQueryData<AssetSummary[]>(unifiedCharactersKey)
    expect(afterFirstAll?.[0]?.appearances[0]?.selectedIndex).toBe(1)
    expect(afterFirstFolder?.[0]?.appearances[0]?.selectedIndex).toBe(1)
    expect(afterFirstUnified?.[0]?.kind).toBe('character')
    if (afterFirstUnified?.[0]?.kind === 'character') {
      expect(afterFirstUnified[0].variants[0].selectionState.selectedRenderIndex).toBe(1)
      expect(afterFirstUnified[0].variants[0].renders[1]?.isSelected).toBe(true)
    }

    const secondContext = await mutation.onMutate(secondVariables)
    const afterSecondAll = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    const afterSecondUnified = queryClient.getQueryData<AssetSummary[]>(unifiedCharactersKey)
    expect(afterSecondAll?.[0]?.appearances[0]?.selectedIndex).toBe(2)
    expect(afterSecondUnified?.[0]?.kind).toBe('character')
    if (afterSecondUnified?.[0]?.kind === 'character') {
      expect(afterSecondUnified[0].variants[0].selectionState.selectedRenderIndex).toBe(2)
      expect(afterSecondUnified[0].variants[0].renders[2]?.isSelected).toBe(true)
    }

    mutation.onError(new Error('first failed'), firstVariables, firstContext)
    const afterStaleError = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    expect(afterStaleError?.[0]?.appearances[0]?.selectedIndex).toBe(2)

    mutation.onError(new Error('second failed'), secondVariables, secondContext)
    const afterLatestRollback = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    const afterLatestUnifiedRollback = queryClient.getQueryData<AssetSummary[]>(unifiedCharactersKey)
    expect(afterLatestRollback?.[0]?.appearances[0]?.selectedIndex).toBe(1)
    expect(afterLatestUnifiedRollback?.[0]?.kind).toBe('character')
    if (afterLatestUnifiedRollback?.[0]?.kind === 'character') {
      expect(afterLatestUnifiedRollback[0].variants[0].selectionState.selectedRenderIndex).toBe(1)
      expect(afterLatestUnifiedRollback[0].variants[0].renders[1]?.isSelected).toBe(true)
    }
  })

  it('optimistically removes character from unified caches and restores on error', async () => {
    const allCharactersKey = queryKeys.globalAssets.characters()
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: null })
    const unifiedCharactersKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: 'character' })
    queryClient.seedQuery(allCharactersKey, [buildGlobalCharacter(0)])
    queryClient.seedQuery(unifiedAssetsKey, [buildUnifiedCharacterAsset(0)])
    queryClient.seedQuery(unifiedCharactersKey, [buildUnifiedCharacterAsset(0)])

    const mutation = useDeleteCharacter() as unknown as DeleteCharacterMutation
    const context = await mutation.onMutate('character-1')

    const afterDeleteAll = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    const afterDeleteUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const afterDeleteFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedCharactersKey)
    expect(afterDeleteAll).toEqual([])
    expect(afterDeleteUnified).toEqual([])
    expect(afterDeleteFiltered).toEqual([])

    mutation.onError(new Error('delete failed'), 'character-1', context)

    const rolledBackAll = queryClient.getQueryData<GlobalCharacter[]>(allCharactersKey)
    const rolledBackUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const rolledBackFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedCharactersKey)
    expect(rolledBackAll?.map((item) => item.id)).toEqual(['character-1'])
    expect(rolledBackUnified).toHaveLength(1)
    expect(rolledBackFiltered).toHaveLength(1)
  })

  it('optimistically selects prop image in unified caches and ignores stale rollback', async () => {
    const locationCacheKey = queryKeys.globalAssets.locations()
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: null })
    const unifiedPropsKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: 'prop' })
    queryClient.seedQuery(locationCacheKey, [buildGlobalLocation('loc-1')])
    queryClient.seedQuery(unifiedAssetsKey, [buildUnifiedLocationAsset('prop', 0)])
    queryClient.seedQuery(unifiedPropsKey, [buildUnifiedLocationAsset('prop', 0)])

    const mutation = useSelectLocationImage('prop') as unknown as SelectLocationMutation
    const firstVariables = {
      locationId: 'prop-1',
      imageIndex: 1,
    }
    const secondVariables = {
      locationId: 'prop-1',
      imageIndex: 2,
    }

    const firstContext = await mutation.onMutate(firstVariables)
    const afterFirstLocationCache = queryClient.getQueryData<GlobalLocation[]>(locationCacheKey)
    const afterFirstUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const afterFirstFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedPropsKey)
    expect(afterFirstLocationCache?.map((item) => item.id)).toEqual(['loc-1'])
    expect(afterFirstUnified?.[0]?.kind).toBe('prop')
    if (afterFirstUnified?.[0]?.kind === 'prop') {
      expect(afterFirstUnified[0].selectedVariantId).toBe('prop-variant-1')
      expect(afterFirstUnified[0].variants[1]?.renders[0]?.isSelected).toBe(true)
    }
    expect(afterFirstFiltered?.[0]?.kind).toBe('prop')
    if (afterFirstFiltered?.[0]?.kind === 'prop') {
      expect(afterFirstFiltered[0].selectedVariantId).toBe('prop-variant-1')
    }

    const secondContext = await mutation.onMutate(secondVariables)
    const afterSecondUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterSecondUnified?.[0]?.kind).toBe('prop')
    if (afterSecondUnified?.[0]?.kind === 'prop') {
      expect(afterSecondUnified[0].selectedVariantId).toBe('prop-variant-2')
      expect(afterSecondUnified[0].variants[2]?.renders[0]?.isSelected).toBe(true)
    }

    mutation.onError(new Error('first failed'), firstVariables, firstContext)
    const afterStaleUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterStaleUnified?.[0]?.kind).toBe('prop')
    if (afterStaleUnified?.[0]?.kind === 'prop') {
      expect(afterStaleUnified[0].selectedVariantId).toBe('prop-variant-2')
    }

    mutation.onError(new Error('second failed'), secondVariables, secondContext)
    const afterLatestUnifiedRollback = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    expect(afterLatestUnifiedRollback?.[0]?.kind).toBe('prop')
    if (afterLatestUnifiedRollback?.[0]?.kind === 'prop') {
      expect(afterLatestUnifiedRollback[0].selectedVariantId).toBe('prop-variant-1')
      expect(afterLatestUnifiedRollback[0].variants[1]?.renders[0]?.isSelected).toBe(true)
    }
  })

  it('optimistically removes location and restores on error', async () => {
    const allLocationsKey = queryKeys.globalAssets.locations()
    const folderLocationsKey = queryKeys.globalAssets.locations('folder-1')
    const unifiedAssetsKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: null })
    const unifiedLocationsKey = queryKeys.assets.list({ scope: 'global', folderId: null, kind: 'location' })
    queryClient.seedQuery(allLocationsKey, [buildGlobalLocation('loc-1'), buildGlobalLocation('loc-2')])
    queryClient.seedQuery(folderLocationsKey, [buildGlobalLocation('loc-1')])
    queryClient.seedQuery(unifiedAssetsKey, [buildUnifiedLocationAsset('location', 0, 'loc-1')])
    queryClient.seedQuery(unifiedLocationsKey, [buildUnifiedLocationAsset('location', 0, 'loc-1')])

    const mutation = useDeleteAssetHubLocation() as unknown as DeleteLocationMutation
    const context = await mutation.onMutate('loc-1')

    const afterDeleteAll = queryClient.getQueryData<GlobalLocation[]>(allLocationsKey)
    const afterDeleteFolder = queryClient.getQueryData<GlobalLocation[]>(folderLocationsKey)
    const afterDeleteUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const afterDeleteFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedLocationsKey)
    expect(afterDeleteAll?.map((item) => item.id)).toEqual(['loc-2'])
    expect(afterDeleteFolder).toEqual([])
    expect(afterDeleteUnified).toEqual([])
    expect(afterDeleteFiltered).toEqual([])

    mutation.onError(new Error('delete failed'), 'loc-1', context)

    const rolledBackAll = queryClient.getQueryData<GlobalLocation[]>(allLocationsKey)
    const rolledBackFolder = queryClient.getQueryData<GlobalLocation[]>(folderLocationsKey)
    const rolledBackUnified = queryClient.getQueryData<AssetSummary[]>(unifiedAssetsKey)
    const rolledBackFiltered = queryClient.getQueryData<AssetSummary[]>(unifiedLocationsKey)
    expect(rolledBackAll?.map((item) => item.id)).toEqual(['loc-1', 'loc-2'])
    expect(rolledBackFolder?.map((item) => item.id)).toEqual(['loc-1'])
    expect(rolledBackUnified).toHaveLength(1)
    expect(rolledBackFiltered).toHaveLength(1)
  })
})
