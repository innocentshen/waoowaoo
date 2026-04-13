'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { logError as _ulogError } from '@/lib/logging/core'
import type { VideoPanel } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video'

export type PromptField = 'videoPrompt' | 'firstLastFramePrompt'

interface UseVideoPromptStateParams {
  allPanels: VideoPanel[]
  onUpdateVideoPrompt: (
    storyboardId: string,
    panelIndex: number,
    value: string,
    field?: PromptField,
  ) => Promise<void>
}

function buildPromptStateKey(panelKey: string, field: PromptField): string {
  return `${field}:${panelKey}`
}

export function useVideoPromptState({
  allPanels,
  onUpdateVideoPrompt,
}: UseVideoPromptStateParams) {
  const [panelPrompts, setPanelPrompts] = useState<Map<string, string>>(new Map())
  const [savingPrompts, setSavingPrompts] = useState<Set<string>>(new Set())
  const [dirtyPrompts, setDirtyPrompts] = useState<Set<string>>(new Set())

  const externalPromptMap = useMemo(() => {
    const next = new Map<string, string>()
    for (const panel of allPanels) {
      const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
      next.set(
        buildPromptStateKey(panelKey, 'videoPrompt'),
        panel.textPanel?.video_prompt || '',
      )
      next.set(
        buildPromptStateKey(panelKey, 'firstLastFramePrompt'),
        panel.firstLastFramePrompt || '',
      )
    }
    return next
  }, [allPanels])

  useEffect(() => {
    setPanelPrompts((previous) => {
      let next: Map<string, string> | null = null

      for (const [stateKey, value] of externalPromptMap) {
        if (dirtyPrompts.has(stateKey)) continue
        if (previous.get(stateKey) === value) continue
        if (!next) next = new Map(previous)
        next.set(stateKey, value)
      }

      for (const stateKey of previous.keys()) {
        if (externalPromptMap.has(stateKey)) continue
        if (!next) next = new Map(previous)
        next.delete(stateKey)
      }

      return next ?? previous
    })
  }, [dirtyPrompts, externalPromptMap])

  useEffect(() => {
    setDirtyPrompts((previous) => {
      if (previous.size === 0) return previous

      let next: Set<string> | null = null
      for (const stateKey of previous) {
        const externalPrompt = externalPromptMap.get(stateKey)
        const localPrompt = panelPrompts.get(stateKey)
        if (externalPrompt !== undefined && localPrompt !== undefined && externalPrompt !== localPrompt) {
          continue
        }
        if (!next) next = new Set(previous)
        next.delete(stateKey)
      }

      return next ?? previous
    })
  }, [externalPromptMap, panelPrompts])

  const getLocalPrompt = useCallback((
    panelKey: string,
    externalPrompt?: string,
    field: PromptField = 'videoPrompt',
  ): string => {
    const stateKey = buildPromptStateKey(panelKey, field)
    if (panelPrompts.has(stateKey)) {
      return panelPrompts.get(stateKey) || ''
    }
    return externalPrompt || ''
  }, [panelPrompts])

  const updateLocalPrompt = useCallback((
    panelKey: string,
    value: string,
    field: PromptField = 'videoPrompt',
  ) => {
    const stateKey = buildPromptStateKey(panelKey, field)
    setPanelPrompts((prev) => {
      if (prev.get(stateKey) === value) return prev
      const next = new Map(prev)
      next.set(stateKey, value)
      return next
    })
    setDirtyPrompts((prev) => {
      if (prev.has(stateKey)) return prev
      const next = new Set(prev)
      next.add(stateKey)
      return next
    })
  }, [])

  const savePrompt = useCallback(async (
    storyboardId: string,
    panelIndex: number,
    panelKey: string,
    value: string,
    field: PromptField = 'videoPrompt',
  ) => {
    const stateKey = buildPromptStateKey(panelKey, field)
    setSavingPrompts((prev) => new Set(prev).add(stateKey))
    try {
      await onUpdateVideoPrompt(storyboardId, panelIndex, value, field)
    } catch (error) {
      _ulogError('保存视频提示词失败:', error)
    } finally {
      setSavingPrompts((prev) => {
        const next = new Set(prev)
        next.delete(stateKey)
        return next
      })
    }
  }, [onUpdateVideoPrompt])

  return {
    savingPrompts,
    getLocalPrompt,
    updateLocalPrompt,
    savePrompt,
  }
}
