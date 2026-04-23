'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import { GlassButton } from '@/components/ui/primitives'
import { MediaImageWithLoading } from '@/components/media/MediaImageWithLoading'
import { AppIcon } from '@/components/ui/icons'
import { parsePanelImageHistory } from '@/lib/novel-promotion/panel-image-history'

interface SelectPanelHistoryImageModalProps {
  open: boolean
  imageHistory: string | null | undefined
  currentImageUrl?: string | null
  videoRatio: string
  onClose: () => void
  onSelect: (selectedImageUrl: string) => Promise<void>
}

export default function SelectPanelHistoryImageModal({
  open,
  imageHistory,
  currentImageUrl,
  videoRatio,
  onClose,
  onSelect,
}: SelectPanelHistoryImageModalProps) {
  const t = useTranslations('storyboard')
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const aspectRatio = videoRatio.replace(':', ' / ')

  const options = useMemo(() => {
    return parsePanelImageHistory(imageHistory)
      .filter((entry) => entry.url !== currentImageUrl)
      .slice()
      .reverse()
  }, [currentImageUrl, imageHistory])

  const handleSelect = async (selectedImageUrl: string) => {
    setPendingImageUrl(selectedImageUrl)
    try {
      await onSelect(selectedImageUrl)
    } finally {
      setPendingImageUrl(null)
    }
  }

  return (
    <GlassModalShell
      open={open}
      onClose={onClose}
      size="xl"
      title={t('image.historyTitle')}
      description={t('image.historyDescription')}
      footer={(
        <div className="flex justify-end">
          <GlassButton variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </GlassButton>
        </div>
      )}
    >
      {options.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface-strong)] p-6 text-center">
          <AppIcon name="imagePreview" className="h-8 w-8 text-[var(--glass-text-tertiary)]" />
          <p className="text-sm text-[var(--glass-text-secondary)]">{t('image.noHistory')}</p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((option, index) => {
              const isPending = pendingImageUrl === option.url
              return (
                <div
                  key={`${option.url}-${option.timestamp || index}`}
                  className="glass-surface-soft flex flex-col gap-3 rounded-2xl border border-[var(--glass-stroke-base)] p-3"
                >
                  <div className="relative overflow-hidden rounded-xl bg-[var(--glass-bg-surface-strong)]" style={{ aspectRatio }}>
                    <MediaImageWithLoading
                      src={option.url}
                      alt={t('image.historyItem', { count: options.length - index })}
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      sizes="(max-width: 1280px) 50vw, 33vw"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="glass-chip glass-chip-neutral px-2 py-0.5 text-xs font-medium">
                      {t('image.historyItem', { count: options.length - index })}
                    </span>
                  </div>

                  <GlassButton
                    variant="secondary"
                    onClick={() => handleSelect(option.url)}
                    disabled={!!pendingImageUrl}
                    className="w-full"
                  >
                    {isPending ? t('common.loading') : t('image.useThisHistory')}
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
