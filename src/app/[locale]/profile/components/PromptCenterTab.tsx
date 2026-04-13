'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AppIcon } from '@/components/ui/icons'
import { getPromptDisplayText } from '@/lib/prompt-center/prompt-display'
import type {
  PromptCenterConsumer,
  PromptCenterItemDetail,
  PromptCenterItemSummary,
  PromptCenterRelatedItem,
  PromptCenterSource,
  PromptCenterVersionDetail,
} from '@/lib/prompt-center/types'

type PromptCenterListResponse = {
  items: PromptCenterItemSummary[]
  message?: string
}

type PromptCenterDetailResponse = {
  item: PromptCenterItemDetail
  message?: string
}

type PromptCenterView = 'editor' | 'history' | 'relationships'

function ViewToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active
        ? 'bg-[var(--glass-bg-surface-strong)] text-[var(--glass-text-primary)] shadow-[inset_0_0_0_1px_var(--glass-stroke-focus)]'
        : 'text-[var(--glass-text-secondary)] hover:bg-[var(--glass-bg-muted)] hover:text-[var(--glass-text-primary)]'
        }`}
    >
      {label}
    </button>
  )
}

function readResponseMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }
  return fallback
}

async function requestPromptCenter<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readResponseMessage(payload, 'Request failed'))
  }
  return payload as T
}

function toSummary(detail: PromptCenterItemDetail): PromptCenterItemSummary {
  return {
    key: detail.key,
    storageId: detail.storageId,
    kind: detail.kind,
    title: detail.title,
    promptId: detail.promptId,
    locale: detail.locale,
    sourcePath: detail.sourcePath,
    variableKeys: detail.variableKeys,
    source: detail.source,
    activeVersionId: detail.activeVersionId,
    activeVersionNumber: detail.activeVersionNumber,
    updatedAt: detail.updatedAt,
  }
}

function formatTime(value: string | null | undefined, locale: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatSnippet(content: string, maxLength = 120) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function countUniquePromptKeys(items: PromptCenterRelatedItem[]) {
  return new Set(items.map((item) => item.key)).size
}

export default function PromptCenterTab() {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [items, setItems] = useState<PromptCenterItemSummary[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<PromptCenterItemDetail | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [itemsLoading, setItemsLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<PromptCenterView>('editor')
  const [focusMode, setFocusMode] = useState(false)

  const getDisplayText = (promptId: string, fallbackTitle?: string) => (
    getPromptDisplayText(promptId, locale, fallbackTitle)
  )

  const filteredItems = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((item) => {
      const display = getDisplayText(item.promptId, item.title)
      return [item.title, item.key, item.promptId, item.sourcePath, item.locale, display.title, display.summary, display.feature]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
  }, [items, searchQuery, locale])

  const hasUnsavedChanges = !!detail && draftContent !== detail.effectiveContent
  const detailDisplay = detail ? getDisplayText(detail.promptId, detail.title) : null

  const applyDetail = (nextDetail: PromptCenterItemDetail) => {
    setDetail(nextDetail)
    setDraftContent(nextDetail.effectiveContent)
    setDraftNote('')
    setItems((current) => {
      const nextSummary = toSummary(nextDetail)
      if (!current.some((item) => item.key === nextSummary.key)) {
        return [nextSummary, ...current]
      }
      return current.map((item) => (item.key === nextSummary.key ? nextSummary : item))
    })
  }

  const loadItems = async () => {
    setItemsLoading(true)
    try {
      const payload = await requestPromptCenter<PromptCenterListResponse>('/api/user/prompt-center')
      setItems(payload.items)
      setSelectedKey((current) => {
        if (current && payload.items.some((item) => item.key === current)) {
          return current
        }
        return payload.items[0]?.key || null
      })
    } catch (error) {
      alert(error instanceof Error ? error.message : tc('unknownError'))
    } finally {
      setItemsLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [])

  useEffect(() => {
    if (!selectedKey) {
      setDetail(null)
      setDraftContent('')
      setDraftNote('')
      return
    }

    let active = true
    const run = async () => {
      setDetailLoading(true)
      try {
        const payload = await requestPromptCenter<PromptCenterDetailResponse>(
          `/api/user/prompt-center/${encodeURIComponent(selectedKey)}`,
        )
        if (!active) return
        setDetail(payload.item)
        setDraftContent(payload.item.effectiveContent)
        setDraftNote('')
      } catch (error) {
        if (!active) return
        alert(error instanceof Error ? error.message : tc('unknownError'))
      } finally {
        if (active) setDetailLoading(false)
      }
    }

    void run()
    return () => {
      active = false
    }
  }, [selectedKey, t])

  useEffect(() => {
    if (!focusMode) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusMode])

  const handleRefresh = async () => {
    setStatusMessage(null)
    await loadItems()
  }

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    setStatusMessage(null)
    try {
      const payload = await requestPromptCenter<PromptCenterDetailResponse>(
        `/api/user/prompt-center/${encodeURIComponent(detail.key)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: draftContent,
            note: draftNote,
          }),
        },
      )
      applyDetail(payload.item)
      setStatusMessage(t('promptCenter.saveSuccess'))
    } catch (error) {
      alert(error instanceof Error ? error.message : tc('unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!detail) return
    if (!window.confirm(t('promptCenter.confirmReset'))) return

    setSaving(true)
    setStatusMessage(null)
    try {
      const payload = await requestPromptCenter<PromptCenterDetailResponse>(
        `/api/user/prompt-center/${encodeURIComponent(detail.key)}/reset`,
        { method: 'POST' },
      )
      applyDetail(payload.item)
      setStatusMessage(t('promptCenter.resetSuccess'))
    } catch (error) {
      alert(error instanceof Error ? error.message : tc('unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const handleActivateVersion = async (version: PromptCenterVersionDetail) => {
    if (!detail) return
    setSaving(true)
    setStatusMessage(null)
    try {
      const payload = await requestPromptCenter<PromptCenterDetailResponse>(
        `/api/user/prompt-center/${encodeURIComponent(detail.key)}/activate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId: version.id }),
        },
      )
      applyDetail(payload.item)
      setStatusMessage(t('promptCenter.activateSuccess'))
      setActiveView('editor')
    } catch (error) {
      alert(error instanceof Error ? error.message : tc('unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const renderKindLabel = (kind: PromptCenterItemSummary['kind']) => (
    kind === 'assistant-system'
      ? t('promptCenter.kind.assistantSystem')
      : t('promptCenter.kind.promptI18n')
  )

  const renderSourceLabel = (source: PromptCenterSource) => (
    source === 'override'
      ? t('promptCenter.source.override')
      : t('promptCenter.source.builtin')
  )

  const renderConsumerKindLabel = (kind: PromptCenterConsumer['kind']) => {
    if (kind === 'assistant-skill') return t('promptCenter.consumerKinds.assistantSkill')
    if (kind === 'ui-hook') return t('promptCenter.consumerKinds.uiHook')
    if (kind === 'workflow-helper') return t('promptCenter.consumerKinds.workflowHelper')
    return t('promptCenter.consumerKinds.workerHandler')
  }

  const handleSelectRelatedPrompt = (item: PromptCenterRelatedItem) => {
    setStatusMessage(null)
    setSelectedKey(item.key)
  }

  const renderRelatedPromptSection = (
    title: string,
    description: string,
    items: PromptCenterRelatedItem[],
  ) => (
    <div className="rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">{description}</p>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const display = getDisplayText(item.promptId, item.title)
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectRelatedPrompt(item)}
                className="min-w-[220px] rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] px-3 py-2 text-left transition-colors hover:border-[var(--glass-stroke-focus)] hover:bg-[var(--glass-bg-surface-strong)]"
              >
                <div className="text-xs font-semibold text-[var(--glass-text-primary)]">{display.title}</div>
                <div className="mt-1 text-[11px] text-[var(--glass-text-secondary)]">{display.feature}</div>
                <div className="mt-1 text-[11px] text-[var(--glass-text-tertiary)]">
                  {item.promptId}
                  {item.locale ? ` | ${item.locale.toUpperCase()}` : ''}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-5 text-center text-sm text-[var(--glass-text-tertiary)]">
          {t('promptCenter.relationsEmpty')}
        </div>
      )}
    </div>
  )

  const renderVersionHistory = () => (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">
            {t('promptCenter.historyTitle')}
          </h3>
          <p className="mt-1 text-xs text-[var(--glass-text-tertiary)]">
            {t('promptCenter.historyDescription')}
          </p>
        </div>
        <span className="text-xs text-[var(--glass-text-tertiary)]">
          {t('promptCenter.historyCount', { count: detail?.versions.length || 0 })}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {detail?.versions.map((version) => (
          <div
            key={version.id}
            className={`rounded-2xl border p-4 ${version.isActive
              ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface-strong)]'
              : 'border-[var(--glass-stroke-base)]'
              }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--glass-text-primary)]">
                    {t('promptCenter.versionLabel', { version: version.version })}
                  </span>
                  {version.isActive ? (
                    <span className="rounded-full bg-[var(--glass-tone-info-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--glass-tone-info-fg)]">
                      {t('promptCenter.active')}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--glass-text-tertiary)]">
                  {formatTime(version.createdAt, locale)}
                  {version.createdBy ? ` · ${version.createdBy}` : ''}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftContent(version.content)
                    setStatusMessage(null)
                    setActiveView('editor')
                  }}
                  className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs"
                >
                  {t('promptCenter.loadToEditor')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleActivateVersion(version)}
                  className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs"
                  disabled={version.isActive || saving}
                >
                  {t('promptCenter.activate')}
                </button>
              </div>
            </div>

            {version.note ? (
              <div className="mt-2 text-xs text-[var(--glass-text-secondary)]">
                {t('promptCenter.notePrefix', { note: version.note })}
              </div>
            ) : null}

            <div className="mt-3 rounded-2xl bg-[var(--glass-bg-muted)] px-3 py-2 text-xs leading-5 text-[var(--glass-text-secondary)]">
              {formatSnippet(version.content) || '--'}
            </div>
          </div>
        ))}

        {detail?.versions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
            {t('promptCenter.historyEmpty')}
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--glass-stroke-base)] px-6 py-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AppIcon name="bookOpen" className="h-5 w-5 text-[var(--glass-text-secondary)]" />
            <h2 className="text-lg font-semibold text-[var(--glass-text-primary)]">
              {t('promptCenter.title')}
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--glass-text-secondary)]">
            {t('promptCenter.description')}
          </p>
          {statusMessage ? (
            <p className="text-xs font-medium text-[var(--glass-tone-success-fg)]">{statusMessage}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          className="glass-btn-base glass-btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
          disabled={itemsLoading || detailLoading}
        >
          <AppIcon name="refresh" className={`h-4 w-4 ${(itemsLoading || detailLoading) ? 'animate-spin' : ''}`} />
          {t('promptCenter.refresh')}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <section className="glass-surface-soft flex min-h-0 flex-col rounded-3xl border border-[var(--glass-stroke-base)] p-4">
          <label className="mb-3 flex items-center gap-2 rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-3 py-2">
            <AppIcon name="search" className="h-4 w-4 text-[var(--glass-text-tertiary)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('promptCenter.searchPlaceholder')}
              className="w-full bg-transparent text-sm text-[var(--glass-text-primary)] outline-none placeholder:text-[var(--glass-text-tertiary)]"
            />
          </label>

          <div className="mb-3 flex items-center justify-between px-1 text-xs text-[var(--glass-text-tertiary)]">
            <span>{itemsLoading ? t('promptCenter.loadingList') : t('promptCenter.listCount', { count: filteredItems.length })}</span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const selected = item.key === selectedKey
              const display = getDisplayText(item.promptId, item.title)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setStatusMessage(null)
                    setSelectedKey(item.key)
                  }}
                  className={`w-full rounded-2xl border p-3 text-left transition-all ${selected
                    ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface-strong)] shadow-[0_20px_40px_-30px_rgba(15,23,42,0.7)]'
                    : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] hover:border-[var(--glass-stroke-focus)] hover:bg-[var(--glass-bg-surface-strong)]'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--glass-text-primary)]">{display.title}</div>
                      <div className="mt-1 text-xs text-[var(--glass-text-secondary)]">{display.feature}</div>
                      <div className="mt-1 text-[11px] text-[var(--glass-text-tertiary)]">{item.title}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] ${item.source === 'override'
                      ? 'bg-[var(--glass-tone-warning-bg)] text-[var(--glass-tone-warning-fg)]'
                      : 'bg-[var(--glass-bg-muted)] text-[var(--glass-text-secondary)]'
                      }`}>
                      {renderSourceLabel(item.source)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--glass-text-tertiary)]">
                    <span>{renderKindLabel(item.kind)}</span>
                    {item.locale ? <span>{item.locale.toUpperCase()}</span> : null}
                    <span>{item.activeVersionNumber ? t('promptCenter.versionLabel', { version: item.activeVersionNumber }) : t('promptCenter.builtinVersion')}</span>
                  </div>

                  <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--glass-text-tertiary)]">
                    {display.summary}
                  </div>

                  <div className="mt-2 truncate text-[11px] text-[var(--glass-text-tertiary)]">
                    {item.sourcePath}
                  </div>
                </button>
              )
            })}

            {!itemsLoading && filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
                {t('promptCenter.empty')}
              </div>
            ) : null}
          </div>
        </section>

        <section className="glass-surface-soft flex min-h-0 flex-col rounded-3xl border border-[var(--glass-stroke-base)] p-5">
          {!detail || detailLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <AppIcon name="fileText" className="mb-3 h-10 w-10 text-[var(--glass-text-tertiary)]" />
              <p className="text-sm text-[var(--glass-text-secondary)]">
                {detailLoading ? t('promptCenter.loadingDetail') : t('promptCenter.emptyHint')}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                    {t('promptCenter.selectedPrompt')}
                  </div>
                  <div className="mt-1 text-base font-semibold text-[var(--glass-text-primary)]">
                    {detailDisplay?.title || detail.title}
                  </div>
                  <div className="mt-1 text-xs text-[var(--glass-text-secondary)]">
                    {detailDisplay?.feature || '--'}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--glass-text-tertiary)]">
                    {detail.title}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-full border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-1">
                    <ViewToggleButton
                      active={activeView === 'editor'}
                      onClick={() => setActiveView('editor')}
                      label={t('promptCenter.editorTab')}
                    />
                    <ViewToggleButton
                      active={activeView === 'history'}
                      onClick={() => setActiveView('history')}
                      label={t('promptCenter.historyTab')}
                    />
                    <ViewToggleButton
                      active={activeView === 'relationships'}
                      onClick={() => setActiveView('relationships')}
                      label={t('promptCenter.relationsTab')}
                    />
                  </div>

                  {activeView === 'editor' ? (
                    <button
                      type="button"
                      onClick={() => setFocusMode(true)}
                      className="glass-btn-base glass-btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <AppIcon name="monitor" className="h-4 w-4" />
                      {t('promptCenter.focusMode')}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-3">
                  <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.currentSource')}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${detail.source === 'override'
                      ? 'bg-[var(--glass-tone-warning-bg)] text-[var(--glass-tone-warning-fg)]'
                      : 'bg-[var(--glass-bg-muted)] text-[var(--glass-text-secondary)]'
                      }`}>
                      {renderSourceLabel(detail.source)}
                    </span>
                    <span className="text-xs text-[var(--glass-text-secondary)]">
                      {detail.activeVersionNumber
                        ? t('promptCenter.versionLabel', { version: detail.activeVersionNumber })
                        : t('promptCenter.builtinVersion')}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-3">
                  <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.pathLabel')}</div>
                  <div className="mt-2 break-all text-xs text-[var(--glass-text-secondary)]">{detail.sourcePath}</div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-3">
                  <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.variablesLabel')}</div>
                  <div className="mt-2 break-words text-xs text-[var(--glass-text-secondary)]">
                    {detail.variableKeys.length > 0 ? detail.variableKeys.join(', ') : '--'}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[220px,minmax(0,1fr)]">
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-3">
                  <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.featureLabel')}</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--glass-text-primary)]">
                    {detailDisplay?.feature || '--'}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-3">
                  <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.usageLabel')}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--glass-text-secondary)]">
                    {detailDisplay?.summary || '--'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-3 text-sm text-[var(--glass-text-secondary)]">
                {activeView === 'editor'
                  ? (detail.source === 'override' ? t('promptCenter.overrideWarning') : t('promptCenter.builtinHint'))
                  : activeView === 'history'
                    ? t('promptCenter.historyDescription')
                    : t('promptCenter.relationsHint')}
              </div>

              {activeView === 'editor' ? (
                <div className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--glass-text-primary)]">{detailDisplay?.title || detail.title}</div>
                    <div className="mt-1 text-xs text-[var(--glass-text-secondary)]">{detailDisplay?.summary || '--'}</div>
                    <div className="mt-1 text-[11px] text-[var(--glass-text-tertiary)]">
                      {detail.promptId}
                      {detail.locale ? ` · ${detail.locale.toUpperCase()}` : ''}
                      {' · '}
                      {renderKindLabel(detail.kind)}
                    </div>
                  </div>
                  {hasUnsavedChanges ? (
                    <span className="rounded-full bg-[var(--glass-tone-warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--glass-tone-warning-fg)]">
                      {t('promptCenter.unsaved')}
                    </span>
                  ) : null}
                </div>

                <textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  spellCheck={false}
                  className="min-h-[560px] w-full flex-1 rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] px-4 py-4 font-mono text-[13px] leading-6 text-[var(--glass-text-primary)] outline-none transition-colors focus:border-[var(--glass-stroke-focus)] lg:min-h-0"
                />

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
                  <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                    <label className="mb-2 block text-xs font-medium text-[var(--glass-text-tertiary)]">
                      {t('promptCenter.noteLabel')}
                    </label>
                    <input
                      value={draftNote}
                      onChange={(event) => setDraftNote(event.target.value)}
                      placeholder={t('promptCenter.notePlaceholder')}
                      className="w-full rounded-2xl border border-[var(--glass-stroke-base)] bg-transparent px-3 py-2 text-sm text-[var(--glass-text-primary)] outline-none placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-stroke-focus)]"
                    />
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!detail) return
                        setDraftContent(detail.effectiveContent)
                        setDraftNote('')
                        setStatusMessage(null)
                      }}
                      className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
                      disabled={!hasUnsavedChanges || saving}
                    >
                      {t('promptCenter.discardDraft')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReset()}
                      className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
                      disabled={detail.source === 'builtin' || saving}
                    >
                      {t('promptCenter.resetBuiltin')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      className="glass-btn-base glass-btn-primary px-4 py-2 text-sm"
                      disabled={saving || !draftContent.trim()}
                    >
                      {saving ? t('promptCenter.saving') : t('promptCenter.saveVersion')}
                    </button>
                  </div>
                </div>
              </div>
              ) : null}

              <div className={`mt-5 min-h-0 flex-1 flex-col rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4 ${activeView === 'history' ? 'flex' : 'hidden'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppIcon name="clock" className="h-4 w-4 text-[var(--glass-text-secondary)]" />
                    <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">
                      {t('promptCenter.historyTitle')}
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--glass-text-tertiary)]">
                    {t('promptCenter.historyCount', { count: detail.versions.length })}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {detail.versions.map((version) => (
                    <div
                      key={version.id}
                      className={`rounded-2xl border p-4 ${version.isActive
                        ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface-strong)]'
                        : 'border-[var(--glass-stroke-base)]'
                        }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--glass-text-primary)]">
                              {t('promptCenter.versionLabel', { version: version.version })}
                            </span>
                            {version.isActive ? (
                              <span className="rounded-full bg-[var(--glass-tone-info-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--glass-tone-info-fg)]">
                                {t('promptCenter.active')}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-[var(--glass-text-tertiary)]">
                            {formatTime(version.createdAt, locale)}
                            {version.createdBy ? ` · ${version.createdBy}` : ''}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftContent(version.content)
                              setStatusMessage(null)
                              setActiveView('editor')
                            }}
                            className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs"
                          >
                            {t('promptCenter.loadToEditor')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleActivateVersion(version)}
                            className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs"
                            disabled={version.isActive || saving}
                          >
                            {t('promptCenter.activate')}
                          </button>
                        </div>
                      </div>

                      {version.note ? (
                        <div className="mt-2 text-xs text-[var(--glass-text-secondary)]">
                          {t('promptCenter.notePrefix', { note: version.note })}
                        </div>
                      ) : null}

                      <div className="mt-3 rounded-2xl bg-[var(--glass-bg-muted)] px-3 py-2 text-xs leading-5 text-[var(--glass-text-secondary)]">
                        {formatSnippet(version.content) || '--'}
                      </div>
                    </div>
                  ))}

                  {detail.versions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
                      {t('promptCenter.historyEmpty')}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={`mt-5 min-h-0 flex-1 flex-col ${activeView === 'relationships' ? 'flex' : 'hidden'}`}>
                {detail.relationships ? (
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="grid gap-3 lg:grid-cols-4">
                      <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                        <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.familyLabel')}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--glass-text-primary)]">
                          {detail.relationships.familyTitle}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                        <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.workflowCountLabel')}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--glass-text-primary)]">
                          {detail.relationships.workflows.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                        <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.consumerCountLabel')}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--glass-text-primary)]">
                          {detail.relationships.consumers.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                        <div className="text-xs text-[var(--glass-text-tertiary)]">{t('promptCenter.upstreamCountLabel')}</div>
                        <div className="mt-2 text-sm font-semibold text-[var(--glass-text-primary)]">
                          {countUniquePromptKeys(detail.relationships.upstream)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr),minmax(340px,0.95fr)]">
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">
                                {t('promptCenter.workflowsTitle')}
                              </h3>
                              <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                                {t('promptCenter.workflowsDescription')}
                              </p>
                            </div>
                            <span className="rounded-full bg-[var(--glass-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--glass-text-secondary)]">
                              {detail.relationships.workflows.length}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {detail.relationships.workflows.map((workflow) => (
                              <div
                                key={workflow.id}
                                className="rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                                      {workflow.title}
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                                      {workflow.description}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-[var(--glass-bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--glass-text-secondary)]">
                                    {t('promptCenter.workflowEntry')}
                                  </span>
                                </div>

                                <div className="mt-2 break-all text-[11px] text-[var(--glass-text-tertiary)]">
                                  {workflow.entryPath}
                                </div>

                                <div className="mt-4 space-y-3">
                                  {workflow.stages.map((stage, index) => (
                                    <div
                                      key={stage.id}
                                      className={`rounded-2xl border p-4 ${stage.containsCurrent
                                        ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface)]'
                                        : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)]/70'
                                        }`}
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--glass-text-tertiary)]">
                                            {index + 1}
                                          </div>
                                          <div className="mt-1 text-sm font-semibold text-[var(--glass-text-primary)]">
                                            {stage.title}
                                          </div>
                                          <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                                            {stage.description}
                                          </p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${stage.containsCurrent
                                          ? 'bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                                          : 'bg-[var(--glass-bg-muted)] text-[var(--glass-text-secondary)]'
                                          }`}>
                                          {stage.mode === 'parallel'
                                            ? t('promptCenter.stageMode.parallel')
                                            : t('promptCenter.stageMode.sequential')}
                                        </span>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {stage.prompts.map((item) => {
                                          const isCurrent = item.key === detail.key
                                          return (
                                            <button
                                              key={item.key}
                                              type="button"
                                              onClick={() => handleSelectRelatedPrompt(item)}
                                              className={`min-w-[200px] rounded-2xl border px-3 py-2 text-left transition-colors ${isCurrent
                                                ? 'border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface-strong)]'
                                                : 'border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] hover:border-[var(--glass-stroke-focus)] hover:bg-[var(--glass-bg-surface-strong)]'
                                                }`}
                                            >
                                              <div className="text-xs font-semibold text-[var(--glass-text-primary)]">
                                                {getDisplayText(item.promptId, item.title).title}
                                              </div>
                                              <div className="mt-1 text-[11px] text-[var(--glass-text-secondary)]">
                                                {getDisplayText(item.promptId, item.title).feature}
                                              </div>
                                              <div className="mt-1 text-[11px] text-[var(--glass-text-tertiary)]">
                                                {item.promptId}
                                                {item.locale ? ` | ${item.locale.toUpperCase()}` : ''}
                                                {' | '}
                                                {renderKindLabel(item.kind)}
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {detail.relationships.workflows.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
                                {t('promptCenter.workflowsEmpty')}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">
                              {t('promptCenter.consumersTitle')}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                              {t('promptCenter.consumersDescription')}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {detail.relationships.consumers.map((consumer) => (
                              <div
                                key={consumer.id}
                                className="rounded-2xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] p-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                                      {consumer.title}
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                                      {consumer.description}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-[var(--glass-bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--glass-text-secondary)]">
                                    {renderConsumerKindLabel(consumer.kind)}
                                  </span>
                                </div>

                                <div className="mt-2 break-all text-[11px] text-[var(--glass-text-tertiary)]">
                                  {consumer.sourcePath}
                                </div>
                              </div>
                            ))}

                            {detail.relationships.consumers.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
                                {t('promptCenter.consumersEmpty')}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-3xl border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-surface)] p-4">
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-[var(--glass-text-primary)]">
                              {detail.relationships.familyTitle}
                            </h3>
                            <p className="mt-1 text-xs leading-5 text-[var(--glass-text-tertiary)]">
                              {detail.relationships.familyDescription}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-[var(--glass-tone-info-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--glass-tone-info-fg)]">
                              {renderKindLabel(detail.kind)}
                            </span>
                            {detail.locale ? (
                              <span className="rounded-full bg-[var(--glass-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--glass-text-secondary)]">
                                {detail.locale.toUpperCase()}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-[var(--glass-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--glass-text-secondary)]">
                              {detail.promptId}
                            </span>
                          </div>
                        </div>

                        {renderRelatedPromptSection(
                          t('promptCenter.upstreamTitle'),
                          t('promptCenter.upstreamDescription'),
                          detail.relationships.upstream,
                        )}

                        {renderRelatedPromptSection(
                          t('promptCenter.parallelTitle'),
                          t('promptCenter.parallelDescription'),
                          detail.relationships.parallel,
                        )}

                        {renderRelatedPromptSection(
                          t('promptCenter.downstreamTitle'),
                          t('promptCenter.downstreamDescription'),
                          detail.relationships.downstream,
                        )}

                        {renderRelatedPromptSection(
                          t('promptCenter.sameFamilyTitle'),
                          t('promptCenter.sameFamilyDescription'),
                          detail.relationships.sameFamily,
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--glass-stroke-base)] px-4 py-6 text-center text-sm text-[var(--glass-text-tertiary)]">
                    {t('promptCenter.relationsEmpty')}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>

    {focusMode && detail ? (
      <div className="fixed inset-0 z-[80] bg-[rgba(10,14,24,0.62)] backdrop-blur-sm">
        <div className="flex h-full w-full items-stretch justify-center p-4 lg:p-6">
          <div className="glass-surface-elevated flex h-full w-full max-w-[1600px] min-w-0 flex-col overflow-hidden rounded-[32px] border border-[var(--glass-stroke-focus)] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--glass-text-primary)]">
                  {t('promptCenter.focusMode')}
                </div>
                <div className="mt-1 text-xs text-[var(--glass-text-tertiary)]">
                  {detailDisplay?.title || detail.title}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFocusMode(false)}
                className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
              >
                {t('promptCenter.exitFocusMode')}
              </button>
            </div>

            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              spellCheck={false}
              className="min-h-0 w-full flex-1 rounded-[28px] border border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface-strong)] px-5 py-5 font-mono text-[14px] leading-7 text-[var(--glass-text-primary)] outline-none"
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr),auto]">
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--glass-text-tertiary)]">
                  {t('promptCenter.noteLabel')}
                </label>
                <input
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder={t('promptCenter.notePlaceholder')}
                  className="w-full rounded-2xl border border-[var(--glass-stroke-base)] bg-transparent px-3 py-2.5 text-sm text-[var(--glass-text-primary)] outline-none placeholder:text-[var(--glass-text-tertiary)] focus:border-[var(--glass-stroke-focus)]"
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraftContent(detail.effectiveContent)
                    setDraftNote('')
                    setStatusMessage(null)
                  }}
                  className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm"
                  disabled={!hasUnsavedChanges || saving}
                >
                  {t('promptCenter.discardDraft')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className="glass-btn-base glass-btn-primary px-4 py-2 text-sm"
                  disabled={saving || !draftContent.trim()}
                >
                  {saving ? t('promptCenter.saving') : t('promptCenter.saveVersion')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
