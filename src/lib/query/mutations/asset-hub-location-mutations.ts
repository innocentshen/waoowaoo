import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { AssetSummary } from '@/lib/assets/contracts'
import {
  clearTaskTargetOverlay,
  upsertTaskTargetOverlay,
} from '../task-target-overlay'
import { queryKeys } from '../keys'
import type { GlobalLocation } from '../hooks/useGlobalAssets'
import {
  requestJsonWithError,
  requestVoidWithError,
} from './mutation-shared'
import {
  GLOBAL_ASSET_PROJECT_ID,
  invalidateGlobalLocations,
} from './asset-hub-mutations-shared'

type LocationAssetKind = 'location' | 'prop'

interface SelectLocationImageContext {
  previousQueries: Array<{
    queryKey: readonly unknown[]
    data: GlobalLocation[] | undefined
  }>
  previousUnifiedQueries: Array<{
    queryKey: readonly unknown[]
    data: AssetSummary[] | undefined
  }>
  targetKey: string
  requestId: number
}

interface DeleteLocationContext {
  previousQueries: Array<{
    queryKey: readonly unknown[]
    data: GlobalLocation[] | undefined
  }>
  previousUnifiedQueries: Array<{
    queryKey: readonly unknown[]
    data: AssetSummary[] | undefined
  }>
}

function applyLocationSelection(
  locations: GlobalLocation[] | undefined,
  locationId: string,
  imageIndex: number | null,
): GlobalLocation[] | undefined {
  if (!locations) return locations
  return locations.map((location) => {
    if (location.id !== locationId) return location
    return {
      ...location,
      images: (location.images || []).map((image) => ({
        ...image,
        isSelected: imageIndex !== null && image.imageIndex === imageIndex,
      })),
    }
  })
}

function captureLocationQuerySnapshots(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient
    .getQueriesData<GlobalLocation[]>({
      queryKey: queryKeys.globalAssets.locations(),
      exact: false,
    })
    .map(([queryKey, data]) => ({ queryKey, data }))
}

function applyLocationSelectionToUnifiedAssets(
  assets: AssetSummary[] | undefined,
  locationId: string,
  imageIndex: number | null,
  kind: LocationAssetKind,
): AssetSummary[] | undefined {
  if (!assets) return assets
  return assets.map((asset) => {
    if (asset.kind !== kind || asset.id !== locationId) return asset
    const selectedVariantId = imageIndex === null
      ? null
      : asset.variants.find((variant) => variant.index === imageIndex)?.id ?? null
    return {
      ...asset,
      selectedVariantId,
      variants: asset.variants.map((variant) => ({
        ...variant,
        selectionState: {
          selectedRenderIndex: imageIndex !== null && variant.index === imageIndex ? 0 : null,
        },
        renders: variant.renders.map((render) => ({
          ...render,
          isSelected: imageIndex !== null && variant.index === imageIndex,
        })),
      })),
    }
  })
}

function removeLocationFromUnifiedAssets(
  assets: AssetSummary[] | undefined,
  locationId: string,
  kind: LocationAssetKind,
): AssetSummary[] | undefined {
  return assets?.filter((asset) => !(asset.kind === kind && asset.id === locationId))
}

function captureUnifiedAssetSnapshots(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient
    .getQueriesData<AssetSummary[]>({
      queryKey: queryKeys.assets.all('global'),
      exact: false,
    })
    .map(([queryKey, data]) => ({ queryKey, data }))
}

function restoreLocationQuerySnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: Array<{ queryKey: readonly unknown[]; data: GlobalLocation[] | undefined }>,
) {
  snapshots.forEach((snapshot) => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data)
  })
}

function restoreUnifiedAssetSnapshots(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshots: Array<{ queryKey: readonly unknown[]; data: AssetSummary[] | undefined }>,
) {
  snapshots.forEach((snapshot) => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data)
  })
}

export function useGenerateLocationImage(kind: LocationAssetKind = 'location') {
  const queryClient = useQueryClient()
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async ({
      locationId,
      artStyle,
      count,
      imageIndex,
    }: {
      locationId: string
      artStyle?: string
      count?: number
      imageIndex?: number
    }) => {
      return await requestJsonWithError(`/api/assets/${locationId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind,
          artStyle,
          count,
          ...(typeof imageIndex === 'number' ? { imageIndex } : {}),
        }),
      }, 'Failed to generate image')
    },
    onMutate: ({ locationId }) => {
      upsertTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalLocation',
        targetId: locationId,
        intent: 'generate',
      })
    },
    onError: (_error, { locationId }) => {
      clearTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalLocation',
        targetId: locationId,
      })
    },
    onSettled: invalidateLocations,
  })
}

export function useModifyLocationImage(kind: LocationAssetKind = 'location') {
  const queryClient = useQueryClient()
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async ({
      locationId,
      imageIndex,
      modifyPrompt,
      extraImageUrls,
    }: {
      locationId: string
      imageIndex: number
      modifyPrompt: string
      extraImageUrls?: string[]
    }) => {
      return await requestJsonWithError(`/api/assets/${locationId}/modify-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind,
          imageIndex,
          modifyPrompt,
          extraImageUrls,
        }),
      }, 'Failed to modify image')
    },
    onMutate: ({ locationId, imageIndex }) => {
      upsertTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalLocationImage',
        targetId: `${locationId}:${imageIndex}`,
        intent: 'modify',
      })
    },
    onError: (_error, { locationId, imageIndex }) => {
      clearTaskTargetOverlay(queryClient, {
        projectId: GLOBAL_ASSET_PROJECT_ID,
        targetType: 'GlobalLocationImage',
        targetId: `${locationId}:${imageIndex}`,
      })
    },
    onSettled: invalidateLocations,
  })
}

export function useSelectLocationImage(kind: LocationAssetKind = 'location') {
  const queryClient = useQueryClient()
  const latestRequestIdByTargetRef = useRef<Record<string, number>>({})
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async ({
      locationId,
      imageIndex,
      confirm = false,
    }: {
      locationId: string
      imageIndex: number | null
      confirm?: boolean
    }) => {
      return await requestJsonWithError(`/api/assets/${locationId}/select-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind,
          imageIndex,
          confirm,
        }),
      }, 'Failed to select image')
    },
    onMutate: async (variables): Promise<SelectLocationImageContext> => {
      const targetKey = variables.locationId
      const requestId = (latestRequestIdByTargetRef.current[targetKey] ?? 0) + 1
      latestRequestIdByTargetRef.current[targetKey] = requestId

      if (kind === 'location') {
        await queryClient.cancelQueries({
          queryKey: queryKeys.globalAssets.locations(),
          exact: false,
        })
      }
      await queryClient.cancelQueries({
        queryKey: queryKeys.assets.all('global'),
        exact: false,
      })
      const previousQueries = kind === 'location' ? captureLocationQuerySnapshots(queryClient) : []
      const previousUnifiedQueries = captureUnifiedAssetSnapshots(queryClient)

      if (kind === 'location') {
        queryClient.setQueriesData<GlobalLocation[] | undefined>(
          {
            queryKey: queryKeys.globalAssets.locations(),
            exact: false,
          },
          (previous) => applyLocationSelection(previous, variables.locationId, variables.imageIndex),
        )
      }
      queryClient.setQueriesData<AssetSummary[] | undefined>(
        {
          queryKey: queryKeys.assets.all('global'),
          exact: false,
        },
        (previous) => applyLocationSelectionToUnifiedAssets(previous, variables.locationId, variables.imageIndex, kind),
      )

      return {
        previousQueries,
        previousUnifiedQueries,
        targetKey,
        requestId,
      }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      const latestRequestId = latestRequestIdByTargetRef.current[context.targetKey]
      if (latestRequestId !== context.requestId) return
      restoreLocationQuerySnapshots(queryClient, context.previousQueries)
      restoreUnifiedAssetSnapshots(queryClient, context.previousUnifiedQueries)
    },
    onSettled: () => {
      void invalidateLocations()
    },
  })
}

export function useUndoLocationImage(kind: LocationAssetKind = 'location') {
  const queryClient = useQueryClient()
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async (locationId: string) => {
      return await requestJsonWithError(`/api/assets/${locationId}/revert-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'global',
          kind,
        }),
      }, 'Failed to undo image')
    },
    onSuccess: invalidateLocations,
  })
}

export function useUploadLocationImage() {
  const queryClient = useQueryClient()
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async ({
      file,
      locationId,
      labelText,
      imageIndex,
    }: {
      file: File
      locationId: string
      labelText: string
      imageIndex?: number
    }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'location')
      formData.append('id', locationId)
      formData.append('labelText', labelText)
      if (imageIndex !== undefined) {
        formData.append('imageIndex', imageIndex.toString())
      }

      return await requestJsonWithError('/api/asset-hub/upload-image', {
        method: 'POST',
        body: formData,
      }, 'Failed to upload image')
    },
    onSuccess: invalidateLocations,
  })
}

export function useDeleteLocation(kind: LocationAssetKind = 'location') {
  const queryClient = useQueryClient()
  const invalidateLocations = () => invalidateGlobalLocations(queryClient)

  return useMutation({
    mutationFn: async (locationId: string) => {
      await requestVoidWithError(
        `/api/asset-hub/locations/${locationId}`,
        { method: 'DELETE' },
        kind === 'prop' ? 'Failed to delete prop' : 'Failed to delete location',
      )
    },
    onMutate: async (locationId): Promise<DeleteLocationContext> => {
      if (kind === 'location') {
        await queryClient.cancelQueries({
          queryKey: queryKeys.globalAssets.locations(),
          exact: false,
        })
      }
      await queryClient.cancelQueries({
        queryKey: queryKeys.assets.all('global'),
        exact: false,
      })
      const previousQueries = kind === 'location' ? captureLocationQuerySnapshots(queryClient) : []
      const previousUnifiedQueries = captureUnifiedAssetSnapshots(queryClient)

      if (kind === 'location') {
        queryClient.setQueriesData<GlobalLocation[] | undefined>(
          {
            queryKey: queryKeys.globalAssets.locations(),
            exact: false,
          },
          (previous) => previous?.filter((location) => location.id !== locationId),
        )
      }
      queryClient.setQueriesData<AssetSummary[] | undefined>(
        {
          queryKey: queryKeys.assets.all('global'),
          exact: false,
        },
        (previous) => removeLocationFromUnifiedAssets(previous, locationId, kind),
      )

      return {
        previousQueries,
        previousUnifiedQueries,
      }
    },
    onError: (_error, _locationId, context) => {
      if (!context) return
      restoreLocationQuerySnapshots(queryClient, context.previousQueries)
      restoreUnifiedAssetSnapshots(queryClient, context.previousUnifiedQueries)
    },
    onSettled: invalidateLocations,
  })
}
