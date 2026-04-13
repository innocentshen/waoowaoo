import { useCallback, useState } from 'react'

interface UsePanelPromptEditorParams {
  localPrompt: string
  onUpdateLocalPrompt: (value: string) => void
  onSavePrompt: (value: string) => Promise<void>
  onGeneratePromptByAi?: (modifyInstruction: string, currentVideoPrompt: string) => Promise<string>
  defaultOptimizeInstruction?: string
}

export function usePanelPromptEditor({
  localPrompt,
  onUpdateLocalPrompt,
  onSavePrompt,
  onGeneratePromptByAi,
  defaultOptimizeInstruction,
}: UsePanelPromptEditorParams) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(localPrompt)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiDraftPrompt, setAiDraftPrompt] = useState(localPrompt)
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [isAiApplying, setIsAiApplying] = useState(false)
  const [isQuickOptimizing, setIsQuickOptimizing] = useState(false)

  const canAiGeneratePrompt = typeof onGeneratePromptByAi === 'function'
  const canQuickOptimize = canAiGeneratePrompt && !!defaultOptimizeInstruction?.trim()
  const isAiBusy = isAiGenerating || isAiApplying || isQuickOptimizing

  const handleStartEdit = useCallback(() => {
    if (isAiBusy) return
    setEditingPrompt(localPrompt)
    setIsEditing(true)
  }, [isAiBusy, localPrompt])

  const handleSave = useCallback(async () => {
    if (isAiBusy) return
    onUpdateLocalPrompt(editingPrompt)
    setIsEditing(false)
    await onSavePrompt(editingPrompt)
  }, [editingPrompt, isAiBusy, onSavePrompt, onUpdateLocalPrompt])

  const handleCancelEdit = useCallback(() => {
    if (isAiBusy) return
    setEditingPrompt(localPrompt)
    setIsEditing(false)
  }, [isAiBusy, localPrompt])

  const handleOpenAiModal = useCallback(() => {
    if (!canAiGeneratePrompt || isAiBusy) return
    const currentPrompt = isEditing ? editingPrompt : localPrompt
    setAiInstruction('')
    setAiDraftPrompt(currentPrompt)
    setIsAiModalOpen(true)
  }, [canAiGeneratePrompt, editingPrompt, isAiBusy, isEditing, localPrompt])

  const handleCloseAiModal = useCallback(() => {
    if (isAiBusy) return
    setIsAiModalOpen(false)
  }, [isAiBusy])

  const handleAiGenerate = useCallback(async () => {
    const instruction = aiInstruction.trim()
    if (!instruction || !onGeneratePromptByAi || isAiBusy) return false

    setIsAiGenerating(true)
    try {
      const basePrompt = (aiDraftPrompt.trim() || (isEditing ? editingPrompt : localPrompt)).trim()
      const generatedPrompt = (await onGeneratePromptByAi(instruction, basePrompt)).trim()
      if (!generatedPrompt) return false
      setEditingPrompt(generatedPrompt)
      setAiDraftPrompt(generatedPrompt)
      return true
    } finally {
      setIsAiGenerating(false)
    }
  }, [
    aiDraftPrompt,
    aiInstruction,
    editingPrompt,
    isAiBusy,
    isEditing,
    localPrompt,
    onGeneratePromptByAi,
  ])

  const handleApplyAiPrompt = useCallback(async () => {
    const finalPrompt = aiDraftPrompt.trim()
    if (!finalPrompt || isAiBusy) return false

    setIsAiApplying(true)
    try {
      onUpdateLocalPrompt(finalPrompt)
      setEditingPrompt(finalPrompt)
      setIsEditing(false)
      await onSavePrompt(finalPrompt)
      setIsAiModalOpen(false)
      setAiInstruction('')
      return true
    } finally {
      setIsAiApplying(false)
    }
  }, [aiDraftPrompt, isAiBusy, onSavePrompt, onUpdateLocalPrompt])

  const handleQuickOptimize = useCallback(async () => {
    const instruction = defaultOptimizeInstruction?.trim()
    if (!instruction || !onGeneratePromptByAi || isAiBusy) return false

    setIsQuickOptimizing(true)
    try {
      const basePrompt = (
        (isEditing ? editingPrompt : '').trim()
        || aiDraftPrompt.trim()
        || localPrompt.trim()
      ).trim()
      const generatedPrompt = (await onGeneratePromptByAi(instruction, basePrompt)).trim()
      if (!generatedPrompt) return false

      onUpdateLocalPrompt(generatedPrompt)
      setEditingPrompt(generatedPrompt)
      setAiDraftPrompt(generatedPrompt)
      setAiInstruction('')
      setIsEditing(false)
      setIsAiModalOpen(false)
      await onSavePrompt(generatedPrompt)
      return true
    } finally {
      setIsQuickOptimizing(false)
    }
  }, [
    aiDraftPrompt,
    defaultOptimizeInstruction,
    editingPrompt,
    isAiBusy,
    isEditing,
    localPrompt,
    onGeneratePromptByAi,
    onSavePrompt,
    onUpdateLocalPrompt,
  ])

  return {
    canAiGeneratePrompt,
    canQuickOptimize,
    isEditing,
    editingPrompt,
    setEditingPrompt,
    isAiModalOpen,
    aiInstruction,
    setAiInstruction,
    aiDraftPrompt,
    setAiDraftPrompt,
    isAiGenerating,
    isAiApplying,
    isQuickOptimizing,
    isAiBusy,
    handleStartEdit,
    handleSave,
    handleCancelEdit,
    handleOpenAiModal,
    handleCloseAiModal,
    handleAiGenerate,
    handleApplyAiPrompt,
    handleQuickOptimize,
  }
}
