'use client'

import { useTranslations } from 'next-intl'
/**
 * 资产确认阶段 - 小说推文模式专用
 * 包含TTS生成和资产分析
 * 
 * 重构说明 v2:
 * - 角色和场景操作函数已提取到 hooks/useCharacterActions 和 hooks/useLocationActions
 * - 批量生成逻辑已提取到 hooks/useBatchGeneration
 * - TTS/音色逻辑已提取到 hooks/useTTSGeneration
 * - 弹窗状态已提取到 hooks/useAssetModals
 * - 档案管理已提取到 hooks/useProfileManagement
 * - UI已拆分为 CharacterSection, LocationSection, AssetToolbar, AssetModals 组件
 */

import { useState, useCallback, useMemo } from 'react'
// 移除了 useRouter 导入，因为不再需要在组件中操作 URL
import { Character, CharacterAppearance, NovelPromotionClip } from '@/types/project'
import { useImageGenerationCount } from '@/lib/image-generation/use-image-generation-count'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import {
  useAssetActions,
  useGenerateProjectCharacterImage,
  useGenerateProjectLocationImage,
  useProjectAssets,
  useRefreshProjectAssets,
  useEpisodes,
  useEpisodeData,
  type ProjectAssetsData,
} from '@/lib/query/hooks'
import {
  getAllClipsAssets,
  fuzzyMatchLocation,
} from './script-view/clip-asset-utils'

// Hooks
import { useCharacterActions } from './assets/hooks/useCharacterActions'
import { useLocationActions } from './assets/hooks/useLocationActions'
import { useBatchGeneration } from './assets/hooks/useBatchGeneration'
import { useTTSGeneration } from './assets/hooks/useTTSGeneration'
import { useAssetModals } from './assets/hooks/useAssetModals'
import { useProfileManagement } from './assets/hooks/useProfileManagement'
import { useAssetsCopyFromHub } from './assets/hooks/useAssetsCopyFromHub'
import { useAssetsGlobalActions } from './assets/hooks/useAssetsGlobalActions'
import { useAssetsImageEdit } from './assets/hooks/useAssetsImageEdit'

// Components
import CharacterSection from './assets/CharacterSection'
import LocationSection from './assets/LocationSection'
import AssetToolbar from './assets/AssetToolbar'
import AssetFilterBar, { type AssetKindFilter } from './assets/AssetFilterBar'
import AssetsStageStatusOverlays from './assets/AssetsStageStatusOverlays'
import AssetsStageModals from './assets/AssetsStageModals'
import { AssetStageProjectAssetsProvider } from './assets/AssetStageProjectAssetsContext'

type AssetBatchKind = 'character' | 'location' | 'prop'

type SectionBatchProgressState = {
  submitting: boolean
  current: number
  total: number
}

type SectionBatchState = Record<AssetBatchKind, SectionBatchProgressState>

const createIdleBatchState = (): SectionBatchState => ({
  character: { submitting: false, current: 0, total: 0 },
  location: { submitting: false, current: 0, total: 0 },
  prop: { submitting: false, current: 0, total: 0 },
})

interface AssetsStageProps {
  projectId: string
  isAnalyzingAssets: boolean
  focusCharacterId?: string | null
  focusCharacterRequestId?: number
  // 🔥 通过 props 触发全局分析（避免 URL 参数竞态条件）
  triggerGlobalAnalyze?: boolean
  onGlobalAnalyzeComplete?: () => void
}

export default function AssetsStage({
  projectId,
  isAnalyzingAssets,
  focusCharacterId = null,
  focusCharacterRequestId = 0,
  triggerGlobalAnalyze = false,
  onGlobalAnalyzeComplete
}: AssetsStageProps) {
  const { data: projectAssets } = useProjectAssets(projectId)

  return (
    <AssetStageProjectAssetsProvider value={projectAssets}>
      <AssetsStageContent
        projectId={projectId}
        isAnalyzingAssets={isAnalyzingAssets}
        focusCharacterId={focusCharacterId}
        focusCharacterRequestId={focusCharacterRequestId}
        triggerGlobalAnalyze={triggerGlobalAnalyze}
        onGlobalAnalyzeComplete={onGlobalAnalyzeComplete}
        projectAssets={projectAssets}
      />
    </AssetStageProjectAssetsProvider>
  )
}

interface AssetsStageContentProps extends AssetsStageProps {
  projectAssets: ProjectAssetsData
}

function AssetsStageContent({
  projectId,
  isAnalyzingAssets,
  focusCharacterId = null,
  focusCharacterRequestId = 0,
  triggerGlobalAnalyze = false,
  onGlobalAnalyzeComplete,
  projectAssets,
}: AssetsStageContentProps) {
  const characters = projectAssets.characters
  const locations = projectAssets.locations
  const props = projectAssets.props
  const propAssetActions = useAssetActions({
    scope: 'project',
    projectId,
    kind: 'prop',
  })
  // 🔥 使用 React Query 刷新，替代 onRefresh prop
  const refreshAssets = useRefreshProjectAssets(projectId)
  const onRefresh = useCallback(() => { refreshAssets() }, [refreshAssets])

  // 🔥 V6.6 重构：使用 mutation hooks 替代 onGenerateImage prop
  const generateCharacterImage = useGenerateProjectCharacterImage(projectId)
  const generateLocationImage = useGenerateProjectLocationImage(projectId)

  // 🔥 内部图片生成函数 - 使用 mutation hooks 实现乐观更新
  const handleGenerateImage = useCallback(async (
    type: 'character' | 'location' | 'prop',
    id: string,
    appearanceId?: string,
    count?: number,
  ) => {
    if (type === 'character' && appearanceId) {
      await generateCharacterImage.mutateAsync({ characterId: id, appearanceId, count })
    } else if (type === 'location') {
      await generateLocationImage.mutateAsync({ locationId: id, count })
    } else if (type === 'prop') {
      await propAssetActions.generate({ id, count })
    }
  }, [generateCharacterImage, generateLocationImage, propAssetActions])

  const t = useTranslations('assets')
  const { count: characterGenerationCount } = useImageGenerationCount('character')
  const { count: locationGenerationCount } = useImageGenerationCount('location')
  // 计算资产总数
  const totalAppearances = characters.reduce((sum, character) => sum + (character.appearances?.length ?? 0), 0)
  const totalLocations = locations.length
  const totalProps = props.length
  const totalAssets = totalAppearances + totalLocations + totalProps

  // 本地 UI 状态
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  const [kindFilter, setKindFilter] = useState<AssetKindFilter>('all')
  const [episodeFilter, setEpisodeFilter] = useState<string | null>(null)
  const [sectionBatchState, setSectionBatchState] = useState<SectionBatchState>(() => createIdleBatchState())

  // 获取剧集列表
  const { episodes } = useEpisodes(projectId)
  const episodeOptions = useMemo(
    () => episodes.map((ep) => ({ id: ep.id, episodeNumber: ep.episodeNumber, name: ep.name })),
    [episodes],
  )

  // 分集筛选：获取选中集的 clips，解析出该集的资产名称
  const { data: episodeData } = useEpisodeData(projectId, episodeFilter)
  const episodeClips = useMemo(() => {
    if (!episodeFilter || !episodeData) return null
    return ((episodeData as { clips?: NovelPromotionClip[] }).clips) ?? null
  }, [episodeFilter, episodeData])

  // 按分集筛选资产 ID 集合
  const episodeAssetIds = useMemo(() => {
    if (!episodeClips) return null // null 表示不筛选
    const { allCharNames, allLocNames, allPropNames } = getAllClipsAssets(episodeClips)

    const charIds = new Set(
      characters
        .filter((c) => {
          const aliases = c.name.split('/').map((a) => a.trim())
          return aliases.some((alias) => allCharNames.has(alias)) || allCharNames.has(c.name)
        })
        .map((c) => c.id),
    )
    const locIds = new Set(
      locations
        .filter((l) => Array.from(allLocNames).some((clipLocName) => fuzzyMatchLocation(clipLocName, l.name)))
        .map((l) => l.id),
    )
    const propIds = new Set(
      props
        .filter((p) => Array.from(allPropNames).some((clipPropName) => clipPropName.toLowerCase() === p.name.toLowerCase()))
        .map((p) => p.id),
    )

    return { charIds, locIds, propIds }
  }, [episodeClips, characters, locations, props])

  // 最终展示的资产列表（先按分集、再按类型筛选）
  const filteredCharacters = useMemo(
    () => episodeAssetIds ? characters.filter((c) => episodeAssetIds.charIds.has(c.id)) : characters,
    [characters, episodeAssetIds],
  )
  const filteredLocations = useMemo(
    () => episodeAssetIds ? locations.filter((l) => episodeAssetIds.locIds.has(l.id)) : locations,
    [locations, episodeAssetIds],
  )
  const filteredProps = useMemo(
    () => episodeAssetIds ? props.filter((p) => episodeAssetIds.propIds.has(p.id)) : props,
    [props, episodeAssetIds],
  )

  // 筛选后的计数
  const filteredAppearances = filteredCharacters.reduce((sum, character) => sum + (character.appearances?.length ?? 0), 0)
  const filteredLocCount = filteredLocations.length
  const filteredPropCount = filteredProps.length
  const filteredTotal = filteredAppearances + filteredLocCount + filteredPropCount

  // 辅助：获取角色形象
  const getAppearances = useCallback((character: Character): CharacterAppearance[] => {
    return character.appearances || []
  }, [])

  // 显示提示
  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'error' = 'success', duration = 3000) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), duration)
  }, [])

  // === 使用提取的 Hooks ===

  // 🔥 V6.5 重构：hooks 现在内部订阅 useProjectAssets，不再需要传 characters/locations

  // 批量生成
  const {
    isBatchSubmitting,
    activeTaskKeys,
    registerTransientTaskKey,
    clearTransientTaskKey,
  } = useBatchGeneration({
    projectId,
    handleGenerateImage
  })

  const {
    isGlobalAnalyzing,
    globalAnalyzingState,
    handleGlobalAnalyze,
  } = useAssetsGlobalActions({
    projectId,
    triggerGlobalAnalyze,
    onGlobalAnalyzeComplete,
    onRefresh,
    showToast,
    t,
  })

  const {
    copyFromGlobalTarget,
    isGlobalCopyInFlight,
    handleCopyFromGlobal,
    handleCopyLocationFromGlobal,
    handleCopyPropFromGlobal,
    handleVoiceSelectFromHub,
    handleConfirmCopyFromGlobal,
    handleCloseCopyPicker,
  } = useAssetsCopyFromHub({
    projectId,
    onRefresh,
    showToast,
  })

  // 角色操作
  const {
    handleDeleteCharacter,
    handleDeleteAppearance,
    handleSelectCharacterImage,
    handleConfirmSelection,
    handleRegenerateSingleCharacter,
    handleRegenerateCharacterGroup
  } = useCharacterActions({
    projectId,
    showToast
  })

  // 场景操作
  const {
    handleDeleteLocation,
    handleSelectLocationImage,
    handleConfirmLocationSelection,
    handleRegenerateSingleLocation,
    handleRegenerateLocationGroup
  } = useLocationActions({
    projectId,
    showToast
  })
  const {
    handleDeleteLocation: handleDeleteProp,
    handleSelectLocationImage: handleSelectPropImage,
    handleConfirmLocationSelection: handleConfirmPropSelection,
    handleRegenerateSingleLocation: handleRegenerateSingleProp,
    handleRegenerateLocationGroup: handleRegeneratePropGroup,
  } = useLocationActions({
    projectId,
    assetType: 'prop',
    showToast,
  })

  // TTS/音色
  const {
    voiceDesignCharacter,
    handleVoiceChange,
    handleOpenVoiceDesign,
    handleVoiceDesignSave,
    handleCloseVoiceDesign
  } = useTTSGeneration({
    projectId
  })

  // 弹窗状态
  const {
    editingAppearance,
    editingLocation,
    editingProp,
    showAddCharacter,
    showAddLocation,
    showAddProp,
    imageEditModal,
    characterImageEditModal,
    setShowAddCharacter,
    setShowAddLocation,
    setShowAddProp,
    handleEditAppearance,
    handleEditLocation,
    handleEditProp,
    handleOpenLocationImageEdit,
    handleOpenCharacterImageEdit,
    closeEditingAppearance,
    closeEditingLocation,
    closeEditingProp,
    closeAddCharacter,
    closeAddLocation,
    closeAddProp,
    closeImageEditModal,
    closeCharacterImageEditModal
  } = useAssetModals({
    projectId
  })
  // 档案管理
  const {
    unconfirmedCharacters,
    isConfirmingCharacter,
    deletingCharacterId,
    batchConfirming,
    editingProfile,
    handleEditProfile,
    handleConfirmProfile,
    handleBatchConfirm,
    handleDeleteProfile,
    setEditingProfile
  } = useProfileManagement({
    projectId,
    showToast
  })
  const unconfirmedCharacterIds = useMemo(
    () => new Set(unconfirmedCharacters.map((character) => character.id)),
    [unconfirmedCharacters],
  )
  const visibleBatchCharacters = useMemo(
    () => filteredCharacters.filter((character) => !unconfirmedCharacterIds.has(character.id)),
    [filteredCharacters, unconfirmedCharacterIds],
  )
  const batchConfirmingState = batchConfirming
    ? resolveTaskPresentationState({
      phase: 'processing',
      intent: 'modify',
      resource: 'image',
      hasOutput: false,
    })
    : null

  const {
    handleUndoCharacter,
    handleUndoLocation,
    handleLocationImageEdit,
    handleCharacterImageEdit,
    handleUpdateAppearanceDescription,
    handleUpdateLocationDescription,
  } = useAssetsImageEdit({
    projectId,
    t,
    showToast,
    onRefresh,
    editingAppearance,
    editingLocation,
    imageEditModal,
    characterImageEditModal,
    closeEditingAppearance,
    closeEditingLocation,
    closeImageEditModal,
    closeCharacterImageEditModal,
  })

  const runSectionBatchGeneration = useCallback(async (
    kind: AssetBatchKind,
    tasks: Array<{ key: string; run: () => Promise<void> }>,
  ) => {
    if (tasks.length === 0) {
      showToast(t('toolbar.generateAllNoop'), 'warning')
      return
    }

    setSectionBatchState((prev) => ({
      ...prev,
      [kind]: {
        submitting: true,
        current: 0,
        total: tasks.length,
      },
    }))

    try {
      await Promise.allSettled(
        tasks.map(async (task) => {
          registerTransientTaskKey(task.key)
          try {
            await task.run()
          } catch {
            clearTransientTaskKey(task.key)
          } finally {
            setSectionBatchState((prev) => ({
              ...prev,
              [kind]: {
                submitting: true,
                current: Math.min(tasks.length, prev[kind].current + 1),
                total: tasks.length,
              },
            }))
          }
        }),
      )
    } finally {
      onRefresh()
      setSectionBatchState((prev) => ({
        ...prev,
        [kind]: {
          submitting: false,
          current: 0,
          total: 0,
        },
      }))
    }
  }, [clearTransientTaskKey, onRefresh, registerTransientTaskKey, showToast, t])

  const handleGenerateAllCharacters = useCallback(async () => {
    const tasks = visibleBatchCharacters.flatMap((character) =>
      getAppearances(character)
        .filter((appearance) => !appearance.imageUrl && !appearance.imageUrls?.length)
        .map((appearance) => ({
          key: `character-${character.id}-${appearance.appearanceIndex}-group`,
          run: () => handleGenerateImage('character', character.id, appearance.id, characterGenerationCount),
        })),
    )

    await runSectionBatchGeneration('character', tasks)
  }, [characterGenerationCount, getAppearances, handleGenerateImage, runSectionBatchGeneration, visibleBatchCharacters])

  const handleGenerateAllLocations = useCallback(async () => {
    const tasks = filteredLocations
      .filter((location) => !location.images?.some((image) => image.imageUrl))
      .map((location) => ({
        key: `location-${location.id}-group`,
        run: () => handleGenerateImage('location', location.id, undefined, locationGenerationCount),
      }))

    await runSectionBatchGeneration('location', tasks)
  }, [filteredLocations, handleGenerateImage, locationGenerationCount, runSectionBatchGeneration])

  const handleGenerateAllProps = useCallback(async () => {
    const tasks = filteredProps
      .filter((prop) => !prop.images?.some((image) => image.imageUrl))
      .map((prop) => ({
        key: `location-${prop.id}-group`,
        run: () => handleGenerateImage('prop', prop.id, undefined, locationGenerationCount),
      }))

    await runSectionBatchGeneration('prop', tasks)
  }, [filteredProps, handleGenerateImage, locationGenerationCount, runSectionBatchGeneration])

  const isAnySectionBatchSubmitting = Object.values(sectionBatchState).some((state) => state.submitting)

  const getGenerateAllButtonLabel = useCallback((kind: AssetBatchKind) => {
    const state = sectionBatchState[kind]
    if (!state.submitting) {
      return t('toolbar.generateAll')
    }

    return `${t('toolbar.generateAll')} ${state.current}/${state.total}`
  }, [sectionBatchState, t])

  return (
    <div className="space-y-4">
      <AssetsStageStatusOverlays
        toast={toast}
        onCloseToast={() => setToast(null)}
        isGlobalAnalyzing={isGlobalAnalyzing}
        globalAnalyzingState={globalAnalyzingState}
        globalAnalyzingTitle={t('toolbar.globalAnalyzing')}
        globalAnalyzingHint={t('toolbar.globalAnalyzingHint')}
        globalAnalyzingTip={t('toolbar.globalAnalyzingTip')}
      />

      {/* 资产工具栏 */}
      <AssetToolbar
        projectId={projectId}
        totalAssets={totalAssets}
        totalAppearances={totalAppearances}
        totalLocations={totalLocations}
        totalProps={totalProps}
        isBatchSubmitting={isBatchSubmitting}
        isAnalyzingAssets={isAnalyzingAssets}
        isGlobalAnalyzing={isGlobalAnalyzing}
        onGlobalAnalyze={handleGlobalAnalyze}
        episodeId={episodeFilter}
        onEpisodeChange={setEpisodeFilter}
        episodes={episodeOptions}
      />

      {/* 资产筛选栏 */}
      <AssetFilterBar
        kindFilter={kindFilter}
        onKindFilterChange={setKindFilter}
        counts={{
          all: filteredTotal,
          character: filteredAppearances,
          location: filteredLocCount,
          prop: filteredPropCount,
        }}
      />

      {(kindFilter === 'all' || kindFilter === 'character') && (
          <CharacterSection
            key="character"
            projectId={projectId}
            focusCharacterId={focusCharacterId}
            focusCharacterRequestId={focusCharacterRequestId}
            activeTaskKeys={activeTaskKeys}
            onClearTaskKey={clearTransientTaskKey}
            onRegisterTransientTaskKey={registerTransientTaskKey}
            isAnalyzingAssets={isAnalyzingAssets}
            onGenerateAll={() => { void handleGenerateAllCharacters() }}
            generateAllButtonLabel={getGenerateAllButtonLabel('character')}
            isGenerateAllDisabled={isAnySectionBatchSubmitting || isAnalyzingAssets || isGlobalAnalyzing}
            onAddCharacter={() => setShowAddCharacter(true)}
            onDeleteCharacter={handleDeleteCharacter}
            onDeleteAppearance={handleDeleteAppearance}
            onEditAppearance={handleEditAppearance}
            handleGenerateImage={handleGenerateImage}
            onSelectImage={handleSelectCharacterImage}
            onConfirmSelection={handleConfirmSelection}
            onRegenerateSingle={handleRegenerateSingleCharacter}
            onRegenerateGroup={handleRegenerateCharacterGroup}
            onUndo={handleUndoCharacter}
            onImageClick={setPreviewImage}
            onImageEdit={(charId, appIdx, imgIdx, name) => handleOpenCharacterImageEdit(charId, appIdx, imgIdx, name)}
            onVoiceChange={(characterId, customVoiceUrl) => handleVoiceChange(characterId, 'custom', characterId, customVoiceUrl)}
            onVoiceDesign={handleOpenVoiceDesign}
            onVoiceSelectFromHub={handleVoiceSelectFromHub}
            onCopyFromGlobal={handleCopyFromGlobal}
            getAppearances={getAppearances}
            filterIds={episodeAssetIds?.charIds ?? null}
            // 🔥 V7：待确认角色档案内嵌到 CharacterSection
            unconfirmedCharacters={unconfirmedCharacters}
            isConfirmingCharacter={isConfirmingCharacter}
            deletingCharacterId={deletingCharacterId}
            batchConfirming={batchConfirming}
            batchConfirmingState={batchConfirmingState}
            onBatchConfirm={handleBatchConfirm}
            onEditProfile={handleEditProfile}
            onConfirmProfile={handleConfirmProfile}
            onUseExistingProfile={handleCopyFromGlobal}
            onDeleteProfile={handleDeleteProfile}
          />
      )}
      {(kindFilter === 'all' || kindFilter === 'location') && (
          <LocationSection
            key="location"
            projectId={projectId}
            activeTaskKeys={activeTaskKeys}
            onClearTaskKey={clearTransientTaskKey}
            onRegisterTransientTaskKey={registerTransientTaskKey}
            onGenerateAll={() => { void handleGenerateAllLocations() }}
            generateAllButtonLabel={getGenerateAllButtonLabel('location')}
            isGenerateAllDisabled={isAnySectionBatchSubmitting || isAnalyzingAssets || isGlobalAnalyzing}
            onAddLocation={() => setShowAddLocation(true)}
            onDeleteLocation={handleDeleteLocation}
            onEditLocation={handleEditLocation}
            handleGenerateImage={handleGenerateImage}
            onSelectImage={handleSelectLocationImage}
            onConfirmSelection={handleConfirmLocationSelection}
            onRegenerateSingle={handleRegenerateSingleLocation}
            onRegenerateGroup={handleRegenerateLocationGroup}
            onUndo={handleUndoLocation}
            onImageClick={setPreviewImage}
            onImageEdit={(locId, imgIdx) => handleOpenLocationImageEdit(locId, imgIdx, 'location')}
            onCopyFromGlobal={handleCopyLocationFromGlobal}
            filterIds={episodeAssetIds?.locIds ?? null}
          />
      )}
      {(kindFilter === 'all' || kindFilter === 'prop') && (
          <LocationSection
            key="prop"
            projectId={projectId}
            assetType="prop"
            activeTaskKeys={activeTaskKeys}
            onClearTaskKey={clearTransientTaskKey}
            onRegisterTransientTaskKey={registerTransientTaskKey}
            onGenerateAll={() => { void handleGenerateAllProps() }}
            generateAllButtonLabel={getGenerateAllButtonLabel('prop')}
            isGenerateAllDisabled={isAnySectionBatchSubmitting || isAnalyzingAssets || isGlobalAnalyzing}
            onAddLocation={() => setShowAddProp(true)}
            onDeleteLocation={handleDeleteProp}
            onEditLocation={handleEditProp}
            handleGenerateImage={handleGenerateImage}
            onSelectImage={handleSelectPropImage}
            onConfirmSelection={handleConfirmPropSelection}
            onRegenerateSingle={handleRegenerateSingleProp}
            onRegenerateGroup={handleRegeneratePropGroup}
            onUndo={(propId) => {
              void propAssetActions.revertRender({ id: propId }).catch(() => undefined)
            }}
            onImageClick={setPreviewImage}
            onImageEdit={(propId, imgIdx) => handleOpenLocationImageEdit(propId, imgIdx, 'prop')}
            onCopyFromGlobal={handleCopyPropFromGlobal}
            filterIds={episodeAssetIds?.propIds ?? null}
          />
      )}

      <AssetsStageModals
        projectId={projectId}
        onRefresh={onRefresh}
        onClosePreview={() => setPreviewImage(null)}
        handleGenerateImage={handleGenerateImage}
        handleUpdateAppearanceDescription={handleUpdateAppearanceDescription}
        handleUpdateLocationDescription={handleUpdateLocationDescription}
        handleLocationImageEdit={handleLocationImageEdit}
        handleCharacterImageEdit={handleCharacterImageEdit}
        handleCloseVoiceDesign={handleCloseVoiceDesign}
        handleVoiceDesignSave={handleVoiceDesignSave}
        handleCloseCopyPicker={handleCloseCopyPicker}
        handleConfirmCopyFromGlobal={handleConfirmCopyFromGlobal}
        handleConfirmProfile={handleConfirmProfile}
        closeEditingAppearance={closeEditingAppearance}
        closeEditingLocation={closeEditingLocation}
        closeEditingProp={closeEditingProp}
        closeAddCharacter={closeAddCharacter}
        closeAddLocation={closeAddLocation}
        closeAddProp={closeAddProp}
        closeImageEditModal={closeImageEditModal}
        closeCharacterImageEditModal={closeCharacterImageEditModal}
        isConfirmingCharacter={isConfirmingCharacter}
        setEditingProfile={setEditingProfile}
        previewImage={previewImage}
        imageEditModal={imageEditModal}
        characterImageEditModal={characterImageEditModal}
        editingAppearance={editingAppearance}
        editingLocation={editingLocation}
        editingProp={editingProp}
        showAddCharacter={showAddCharacter}
        showAddLocation={showAddLocation}
        showAddProp={showAddProp}
        voiceDesignCharacter={voiceDesignCharacter}
        editingProfile={editingProfile}
        copyFromGlobalTarget={copyFromGlobalTarget}
        isGlobalCopyInFlight={isGlobalCopyInFlight}
      />
    </div>
  )
}
