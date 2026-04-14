'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { NovelPromotionStoryboard } from '@/types/project'
import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import { GlassButton } from '@/components/ui/primitives'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'

export interface StoryboardSourceOptionGroup extends NovelPromotionStoryboard {
  sourceClipTitle: string
}

interface SourcePanelOption {
  id: string
  imageUrl: string
  panelNumber: number
  shotType: string
  description: string
  clipTitle: string
}

interface SelectStoryboardPanelImageModalProps {
  open: boolean
  targetPanelId: string | null
  storyboards: StoryboardSourceOptionGroup[]
  videoRatio: string
  isLoading?: boolean
  onClose: () => void
  onSelect: (sourcePanelId: string) => Promise<void>
}

export default function SelectStoryboardPanelImageModal({
  open,
  targetPanelId,
  storyboards,
  videoRatio,
  isLoading = false,
  onClose,
  onSelect,
}: SelectStoryboardPanelImageModalProps) {
  const t = useTranslations('storyboard')
  const [pendingSourcePanelId, setPendingSourcePanelId] = useState<string | null>(null)
  const aspectRatio = videoRatio.replace(':', ' / ')

  const options = useMemo<SourcePanelOption[]>(() => {
    if (!targetPanelId) return []

    const nextOptions: SourcePanelOption[] = []
    for (const storyboard of storyboards) {
      const panels = Array.isArray(storyboard.panels) ? storyboard.panels : []
      for (const panel of panels) {
        if (panel.id === targetPanelId || !panel.imageUrl) continue
        nextOptions.push({
          id: panel.id,
          imageUrl: panel.imageUrl,
          panelNumber: panel.panelNumber ?? panel.panelIndex + 1,
          shotType: panel.shotType || t('panel.noShotType'),
          description: panel.description || '',
          clipTitle: storyboard.sourceClipTitle,
        })
      }
    }
    return nextOptions
  }, [storyboards, t, targetPanelId])

  const handleSelect = async (sourcePanelId: string) => {
    setPendingSourcePanelId(sourcePanelId)
    try {
      await onSelect(sourcePanelId)
    } finally {
      setPendingSourcePanelId(null)
    }
  }

  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
      size="xl"
      title={t('image.chooseShotTitle')}
      description={t('image.chooseShotDescription')}
      footer={(
        <div className="flex justify-end">
          <GlassButton variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </GlassButton>
        </div>
      )}
    >
      {options.length === 0 && isLoading ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)] p-6 text-center">
          <AppIcon name="imagePreview" className="h-8 w-8 text-[var(--glass-text-tertiary)]" />
          <p className="text-sm text-[var(--glass-text-secondary)]">{t('common.loading')}</p>
        </div>
      ) : options.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)] p-6 text-center">
          <AppIcon name="imagePreview" className="h-8 w-8 text-[var(--glass-text-tertiary)]" />
          <p className="text-sm text-[var(--glass-text-secondary)]">{t('image.noOtherShots')}</p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((option) => {
              const isPending = pendingSourcePanelId === option.id
              return (
                <div
                  key={option.id}
                  className="glass-surface-soft flex flex-col gap-3 rounded-2xl border border-[var(--glass-stroke-base)] p-3"
                >
                  <div className="relative overflow-hidden rounded-xl bg-[var(--glass-bg-surface-strong)]" style={{ aspectRatio }}>
                    <MediaImageWithLoading
                      src={option.imageUrl}
                      alt={t('variant.shotNum', { number: option.panelNumber })}
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      sizes="(max-width: 1280px) 50vw, 33vw"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="glass-chip glass-chip-neutral px-2 py-0.5 text-xs font-medium">
                        {t('variant.shotNum', { number: option.panelNumber })}
                      </span>
                      <span className="glass-chip glass-chip-info px-2 py-0.5 text-xs">
                        {option.shotType}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[var(--glass-text-primary)] line-clamp-1">{option.clipTitle}</p>
                    {option.description ? (
                      <p className="text-xs text-[var(--glass-text-secondary)] line-clamp-2">{option.description}</p>
                    ) : null}
                  </div>

                  <GlassButton
                    variant="secondary"
                    onClick={() => handleSelect(option.id)}
                    disabled={!!pendingSourcePanelId}
                    className="w-full"
                  >
                    {isPending ? t('common.loading') : t('image.useThisShot')}
                  </GlassButton>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </GlassModalShell>
  )
}
