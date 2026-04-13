'use client'

import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { useProjectAssets, type ProjectAssetsData } from '@/lib/query/hooks'

const EMPTY_PROJECT_ASSETS: ProjectAssetsData = {
    characters: [],
    locations: [],
    props: [],
}

const AssetStageProjectAssetsContext = createContext<ProjectAssetsData | null>(null)

function normalizeProjectAssets(data: Partial<ProjectAssetsData> | null | undefined): ProjectAssetsData {
    return {
        characters: data?.characters ?? [],
        locations: data?.locations ?? [],
        props: data?.props ?? [],
    }
}

export function AssetStageProjectAssetsProvider({
    children,
    value,
}: PropsWithChildren<{ value: ProjectAssetsData }>) {
    return (
        <AssetStageProjectAssetsContext.Provider value={value}>
            {children}
        </AssetStageProjectAssetsContext.Provider>
    )
}

export function useAssetStageProjectAssets(projectId: string | null) {
    const contextValue = useContext(AssetStageProjectAssetsContext)
    const assetsQuery = useProjectAssets(contextValue ? null : projectId)

    const normalizedContextValue = useMemo(
        () => (contextValue ? normalizeProjectAssets(contextValue) : null),
        [contextValue],
    )
    const normalizedQueryValue = useMemo(
        () => normalizeProjectAssets(assetsQuery.data),
        [assetsQuery.data],
    )

    return normalizedContextValue ?? normalizedQueryValue ?? EMPTY_PROJECT_ASSETS
}
