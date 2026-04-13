'use client'
import React from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'

/**
 * PanelActionButtons - 面板间操作按钮组
 * 包含两个按钮：
 * - + 插入分镜（原有功能）
 * - 镜头变体（新功能）
 */

interface PanelActionButtonsProps {
    onInsertPanel: () => void
    onVariant: () => void
    disabled?: boolean
    hasImage: boolean // 原镜头是否有图片（没图片不能做变体）
}

export default function PanelActionButtons({
    onInsertPanel,
    onVariant,
    disabled,
    hasImage
}: PanelActionButtonsProps) {
    const t = useTranslations('storyboard')
    const baseButtonClass = `
        group relative flex h-8 w-8 items-center justify-center rounded-full
        border border-white/70 bg-white/95 text-slate-950
        shadow-[0_8px_20px_rgba(15,23,42,0.28)] transition-all duration-200 ease-out
    `
    const enabledButtonClass = `
        hover:-translate-y-0.5 hover:border-amber-100
        hover:bg-[linear-gradient(135deg,rgba(253,224,71,0.98),rgba(250,204,21,0.94))]
        hover:text-slate-950 hover:shadow-[0_10px_24px_rgba(245,158,11,0.35)]
    `
    const disabledButtonClass = `
        border-white/15 bg-white/25 text-white/60 cursor-not-allowed shadow-none
    `

    return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-1.5 shadow-[0_14px_32px_rgba(15,23,42,0.28)] backdrop-blur-sm">
            {/* 插入分镜按钮 */}
            <button
                onClick={onInsertPanel}
                disabled={disabled}
                className={`
                    ${baseButtonClass}
                    ${disabled ? disabledButtonClass : enabledButtonClass}
                `}
                title={t('panelActions.insertHere')}
            >
                <AppIcon name="plus" className="h-4 w-4" />

                {/* Hover 时显示提示 */}
                <span className={`
                    absolute -top-8 left-1/2 -translate-x-1/2
                    rounded px-2 py-1 text-xs text-white bg-[rgba(15,23,42,0.92)]
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                    whitespace-nowrap pointer-events-none
                    ${disabled ? 'hidden' : ''}
                `}>
                    {t('panelActions.insertPanel')}
                </span>
            </button>

            {/* 镜头变体按钮 */}
            <button
                onClick={onVariant}
                disabled={disabled || !hasImage}
                className={`
                    ${baseButtonClass}
                    ${disabled || !hasImage ? disabledButtonClass : enabledButtonClass}
                `}
                title={hasImage ? t('panelActions.generateVariant') : t('panelActions.needImage')}
            >
                <AppIcon name="videoAlt" className="h-4 w-4" />

                {/* Hover 时显示提示 */}
                <span className={`
                    absolute -top-8 left-1/2 -translate-x-1/2
                    rounded px-2 py-1 text-xs text-white bg-[rgba(15,23,42,0.92)]
                    opacity-0 group-hover:opacity-100
                    transition-opacity duration-200
                    whitespace-nowrap pointer-events-none
                    ${disabled || !hasImage ? 'hidden' : ''}
                `}>
                    {t('panelActions.panelVariant')}
                </span>
            </button>
        </div>
    )
}
