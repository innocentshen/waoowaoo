'use client'
import React from 'react'
import { logInfo as _ulogInfo } from '@/lib/logging/core'
import { useRef, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import ImageGenerationInlineCountButton from '@/components/image-generation/ImageGenerationInlineCountButton'
import { getImageGenerationCountOptions } from '@/lib/image-generation/count'
import { useImageGenerationCount } from '@/lib/image-generation/use-image-generation-count'
import { AI_EDIT_BUTTON_CLASS, AI_EDIT_ICON_CLASS } from '@/components/ui/ai-edit-style'
import AISparklesIcon from '@/components/ui/icons/AISparklesIcon'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import { parsePanelImageHistory } from '@/lib/novel-promotion/panel-image-history'

interface ImageSectionActionButtonsProps {
  panelId: string
  imageUrl: string | null
  imageHistory?: string | null
  previousImageUrl?: string | null
  isSubmittingPanelImageTask: boolean
  canCancelPanelImageTask: boolean
  isCancelingPanelImageTask: boolean
  isUploading: boolean
  isModifying: boolean
  onRegeneratePanelImage: (panelId: string, count?: number, force?: boolean) => void
  onCancelPanelImageTask: (panelId: string) => Promise<boolean>
  onUploadImage: (panelId: string, file: File) => Promise<void>
  onOpenSourcePanelPicker: () => void
  onOpenHistoryPanelPicker: () => void
  onOpenEditModal: () => void
  onOpenAIDataModal: () => void
  onUndo?: (panelId: string) => void
  triggerPulse: () => void
}

export default function ImageSectionActionButtons({
  panelId,
  imageUrl,
  imageHistory,
  previousImageUrl,
  isSubmittingPanelImageTask,
  canCancelPanelImageTask,
  isCancelingPanelImageTask,
  isUploading,
  isModifying,
  onRegeneratePanelImage,
  onCancelPanelImageTask,
  onUploadImage,
  onOpenSourcePanelPicker,
  onOpenHistoryPanelPicker,
  onOpenEditModal,
  onOpenAIDataModal,
  onUndo,
  triggerPulse,
}: ImageSectionActionButtonsProps) {
  const t = useTranslations('storyboard')
  const { count, setCount } = useImageGenerationCount('storyboard-candidates')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const historyCount = parsePanelImageHistory(imageHistory).length
  const uploadPendingState = isUploading
    ? resolveTaskPresentationState({
      phase: 'processing',
      intent: 'process',
      resource: 'image',
      hasOutput: !!imageUrl,
    })
    : null

  const handleTriggerUpload = () => {
    if (isUploading || isSubmittingPanelImageTask || isModifying || isCancelingPanelImageTask) return
    fileInputRef.current?.click()
  }

  const handleOpenSourcePanelPicker = () => {
    if (isUploading || isSubmittingPanelImageTask || isModifying || isCancelingPanelImageTask) return
    onOpenSourcePanelPicker()
  }

  const handleOpenHistoryPanelPicker = () => {
    if (historyCount === 0 || isUploading || isSubmittingPanelImageTask || isModifying || isCancelingPanelImageTask) return
    onOpenHistoryPanelPicker()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    void Promise.resolve(onUploadImage(panelId, file)).finally(() => {
      input.value = ''
    })
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className={`absolute top-9 left-2 z-20 transition-opacity ${isSubmittingPanelImageTask || isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="relative glass-surface-modal border border-[var(--glass-stroke-base)] rounded-lg p-0.5">
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleTriggerUpload}
              disabled={isSubmittingPanelImageTask || isModifying || isUploading || isCancelingPanelImageTask}
              className="glass-btn-base glass-btn-secondary flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 disabled:opacity-50"
              title={imageUrl ? t('image.uploadReplace') : t('image.upload')}
            >
              {isUploading ? (
                <TaskStatusInline state={uploadPendingState} className="[&_span]:sr-only [&_svg]:text-current" />
              ) : (
                <AppIcon name="upload" className="w-2.5 h-2.5" />
              )}
              <span>{t('image.upload')}</span>
            </button>

            <button
              onClick={handleOpenSourcePanelPicker}
              disabled={isSubmittingPanelImageTask || isModifying || isUploading || isCancelingPanelImageTask}
              className="glass-btn-base glass-btn-secondary flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 disabled:opacity-50"
              title={t('image.chooseShot')}
            >
              <AppIcon name="copy" className="w-2.5 h-2.5" />
              <span>{t('image.chooseShot')}</span>
            </button>

            {historyCount > 0 && (
              <button
                onClick={handleOpenHistoryPanelPicker}
                disabled={isSubmittingPanelImageTask || isModifying || isUploading || isCancelingPanelImageTask}
                className="glass-btn-base glass-btn-secondary flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 disabled:opacity-50"
                title={t('image.historyTitle')}
              >
                <AppIcon name="clock" className="w-2.5 h-2.5" />
                <span>{t('image.history')}</span>
                <span className="opacity-70">{historyCount}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 transition-opacity ${isSubmittingPanelImageTask || isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="relative glass-surface-modal border border-[var(--glass-stroke-base)] rounded-lg p-0.5">
          <div className="flex items-center gap-0.5">
            <ImageGenerationInlineCountButton
              prefix={
                <>
                  <AppIcon name="refresh" className="w-2.5 h-2.5" />
                  <span>{isSubmittingPanelImageTask ? t('image.forceRegenerate') : t('panel.regenerate')}</span>
                </>
              }
              suffix={<span>{t('image.generateCountSuffix')}</span>}
              value={count}
              options={getImageGenerationCountOptions('storyboard-candidates')}
              onValueChange={setCount}
              onClick={() => {
                _ulogInfo('[ImageSection] 🔄 左下角重新生成按钮被点击')
                _ulogInfo('[ImageSection] isSubmittingPanelImageTask:', isSubmittingPanelImageTask)
                _ulogInfo('[ImageSection] 将传递 force:', isSubmittingPanelImageTask)
                triggerPulse()
                onRegeneratePanelImage(panelId, count, isSubmittingPanelImageTask)
              }}
              disabled={isUploading || isCancelingPanelImageTask}
              ariaLabel={t('image.selectCount')}
              className={`glass-btn-base glass-btn-secondary flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 ${isSubmittingPanelImageTask || isUploading ? 'opacity-75' : ''}`}
              selectClassName="appearance-none bg-transparent border-0 pl-0 pr-3 text-[10px] font-semibold text-[var(--glass-text-primary)] outline-none cursor-pointer leading-none transition-colors"
              labelClassName="inline-flex items-center gap-0.5"
            />

            <button
              onClick={onOpenAIDataModal}
              className={`glass-btn-base glass-btn-secondary flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 ${isSubmittingPanelImageTask || isModifying || isUploading ? 'opacity-75' : ''}`}
              title={t('aiData.viewData')}
            >
              <AppIcon name="chart" className="w-2.5 h-2.5" />
              <span>{t('aiData.viewData')}</span>
            </button>

            {isSubmittingPanelImageTask && canCancelPanelImageTask && (
              <button
                onClick={() => {
                  void onCancelPanelImageTask(panelId)
                }}
                disabled={isCancelingPanelImageTask || isUploading || isModifying}
                className="glass-btn-base glass-btn-danger flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 disabled:opacity-50"
                title={t('image.terminate')}
              >
                {isCancelingPanelImageTask ? (
                  <>
                    <AppIcon name="loader" className="w-2.5 h-2.5 animate-spin" />
                    <span>{t('image.terminating')}</span>
                  </>
                ) : (
                  <>
                    <AppIcon name="closeMd" className="w-2.5 h-2.5" />
                    <span>{t('image.terminate')}</span>
                  </>
                )}
              </button>
            )}
            {imageUrl && (
              <button
                onClick={onOpenEditModal}
                className={`glass-btn-base h-6 w-6 rounded-full flex items-center justify-center transition-all active:scale-95 ${AI_EDIT_BUTTON_CLASS} ${isSubmittingPanelImageTask || isModifying || isUploading ? 'opacity-75' : ''}`}
                title={t('image.editImage')}
              >
                <AISparklesIcon className={`w-2.5 h-2.5 ${AI_EDIT_ICON_CLASS}`} />
              </button>
            )}

            {previousImageUrl && onUndo && (
              <>
                <div className="w-px h-3 bg-[var(--glass-stroke-base)]" />
                <button
                  onClick={() => onUndo(panelId)}
                  disabled={isSubmittingPanelImageTask || isUploading}
                  className="glass-btn-base glass-btn-secondary flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] transition-all active:scale-95 disabled:opacity-50"
                  title={t('assets.image.undo')}
                >
                  <span>{t('assets.image.undo')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
