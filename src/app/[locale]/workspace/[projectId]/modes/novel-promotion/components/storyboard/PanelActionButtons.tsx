'use client'
import React from 'react'
import { useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'

interface PanelActionButtonsProps {
    onInsertPanel: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    onVariant: () => void
    disabled?: boolean
    hasImage: boolean
}

export default function PanelActionButtons({
    onInsertPanel,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    onVariant,
    disabled,
    hasImage
}: PanelActionButtonsProps) {
    const t = useTranslations('storyboard')
    const baseButtonClass = `
        group relative flex h-8 w-8 items-center justify-center rounded-[8px]
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

    const actionButtonClass = (isDisabled: boolean) => `
        ${baseButtonClass}
        ${isDisabled ? disabledButtonClass : enabledButtonClass}
    `

    return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-2 shadow-[0_14px_32px_rgba(15,23,42,0.28)] backdrop-blur-sm">
            <button
                onClick={onMoveUp}
                disabled={disabled || !canMoveUp}
                className={actionButtonClass(Boolean(disabled || !canMoveUp))}
                title={t('panelActions.moveUp')}
            >
                <AppIcon name="chevronUp" className="h-4 w-4" />
            </button>

            <button
                onClick={onMoveDown}
                disabled={disabled || !canMoveDown}
                className={actionButtonClass(Boolean(disabled || !canMoveDown))}
                title={t('panelActions.moveDown')}
            >
                <AppIcon name="chevronDown" className="h-4 w-4" />
            </button>

            <button
                onClick={onInsertPanel}
                disabled={disabled}
                className={actionButtonClass(Boolean(disabled))}
                title={t('panelActions.insertHere')}
            >
                <AppIcon name="plus" className="h-4 w-4" />
            </button>

            <button
                onClick={onVariant}
                disabled={disabled || !hasImage}
                className={actionButtonClass(Boolean(disabled || !hasImage))}
                title={hasImage ? t('panelActions.generateVariant') : t('panelActions.needImage')}
            >
                <AppIcon name="videoAlt" className="h-4 w-4" />
            </button>
        </div>
    )
}
