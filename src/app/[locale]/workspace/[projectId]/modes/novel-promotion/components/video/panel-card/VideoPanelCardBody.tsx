import React from 'react'
import TaskStatusInline from '@/components/task/TaskStatusInline'
import { resolveTaskPresentationState } from '@/lib/task/presentation'
import { ModelCapabilityDropdown } from '@/components/ui/config-modals/ModelCapabilityDropdown'
import { AppIcon } from '@/components/ui/icons'
import GlassModalShell from '@/components/ui/primitives/GlassModalShell'
import { getVideoGenerationCountOptions } from '@/lib/video-generation/count'
import type { VideoPanelRuntime } from './hooks/useVideoPanelActions'
import VideoReferenceSelector from '../VideoReferenceSelector'

interface VideoPanelCardBodyProps {
  runtime: VideoPanelRuntime
}

export default function VideoPanelCardBody({ runtime }: VideoPanelCardBodyProps) {
  const {
    t,
    tCommon,
    panel,
    panelIndex,
    panelKey,
    layout,
    actions,
    taskStatus,
    videoModel,
    promptEditor,
    voiceManager,
    lipSync,
    computed,
    candidates,
  } = runtime
  const safeTranslate = (key: string | undefined, fallback = ''): string => {
    if (!key) return fallback
    try {
      return t(key as never)
    } catch {
      return fallback
    }
  }

  const renderCapabilityLabel = (field: {
    field: string
    label: string
    labelKey?: string
    unitKey?: string
  }): string => {
    const labelText = safeTranslate(field.labelKey, safeTranslate(`capability.${field.field}`, field.label))
    const unitText = safeTranslate(field.unitKey)
    return unitText ? `${labelText} (${unitText})` : labelText
  }

  const isFirstLastFrameGenerated = panel.videoGenerationMode === 'firstlastframe' && !!panel.videoUrl
  const showsIncomingLinkBadge = layout.isLastFrame && !!layout.prevPanel
  const showsOutgoingLinkBadge = layout.isLinked && !!layout.nextPanel
  const showsPromptEditor = !layout.isLastFrame || layout.isLinked
  const showsFirstLastFrameActions = layout.isLinked && !!layout.nextPanel
  const referenceSelection = actions.referenceSelection || {}

  const renderReferenceSelectionControls = () => (
    <VideoReferenceSelector
      t={t as (key: string, values?: Record<string, unknown>) => string}
      selection={referenceSelection}
      options={actions.referenceOptions}
      onChange={(nextSelection) => actions.onUpdateReferenceSelection(panelKey, nextSelection)}
    />
  )

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="px-2 py-0.5 bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] rounded font-medium">{panel.textPanel?.shot_type || t('panelCard.unknownShotType')}</span>
        {panel.textPanel?.duration && <span className="text-[var(--glass-text-tertiary)]">{panel.textPanel.duration}{t('promptModal.duration')}</span>}
      </div>

      <p className="text-sm text-[var(--glass-text-secondary)] line-clamp-2">{panel.textPanel?.description}</p>

      <div className="mt-3 pt-3 border-t border-[var(--glass-stroke-base)]">
        {(showsIncomingLinkBadge || showsOutgoingLinkBadge) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {showsIncomingLinkBadge && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${showsOutgoingLinkBadge
                    ? 'bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                    : 'bg-[var(--glass-bg-muted)] text-[var(--glass-text-tertiary)] border border-[var(--glass-stroke-base)]'
                  }`}
              >
                <AppIcon name={showsOutgoingLinkBadge ? 'link' : 'unplug'} className="w-3 h-3" />
                {t('firstLastFrame.asLastFrameFor', { number: panelIndex })}
              </span>
            )}
            {showsOutgoingLinkBadge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]">
                <AppIcon name="link" className="w-3 h-3" />
                {t('firstLastFrame.asFirstFrameFor', { number: panelIndex + 2 })}
              </span>
            )}
          </div>
        )}

        {showsPromptEditor && (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[var(--glass-text-tertiary)]">{t('promptModal.promptLabel')}</span>
              <div className="flex items-center gap-1">
                {promptEditor.canAiGeneratePrompt && (
                  <button
                    type="button"
                    onClick={promptEditor.handleOpenAiModal}
                    disabled={promptEditor.isAiBusy || promptEditor.isSavingPrompt}
                    title={t('panelCard.aiGeneratePrompt')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--glass-stroke-focus)]/50 bg-[linear-gradient(135deg,rgba(59,130,246,0.95),rgba(124,58,237,0.92))] text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] transition-transform hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AppIcon name={promptEditor.isAiBusy ? 'loader' : 'sparkles'} className={`w-3.5 h-3.5 ${promptEditor.isAiBusy ? 'animate-spin' : ''}`} />
                    </button>
                )}
                {!promptEditor.isEditing && (
                  <button
                    type="button"
                    onClick={() => { void promptEditor.handleQuickOptimize() }}
                    disabled={!promptEditor.canQuickOptimize || promptEditor.isAiBusy || promptEditor.isSavingPrompt}
                    title={t('panelCard.optimizePrompt')}
                    className="text-[var(--glass-text-tertiary)] hover:text-[var(--glass-tone-info-fg)] transition-colors p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <AppIcon
                      name={promptEditor.isQuickOptimizing ? 'loader' : 'sparklesAlt'}
                      className={`w-3.5 h-3.5 ${promptEditor.isQuickOptimizing ? 'animate-spin' : ''}`}
                    />
                  </button>
                )}
              </div>
            </div>

            {promptEditor.isEditing ? (
              <div className="relative mb-3">
                <textarea
                  value={promptEditor.editingPrompt}
                  onChange={(event) => promptEditor.setEditingPrompt(event.target.value)}
                  autoFocus
                  className="app-scrollbar w-full min-h-[3.5rem] max-h-[7.25rem] resize-none overflow-y-auto rounded-lg border border-[var(--glass-stroke-focus)] bg-[var(--glass-bg-surface)] p-2 pr-16 text-[13px] leading-5 text-[var(--glass-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--glass-tone-info-fg)]"
                  rows={2}
                  placeholder={t('promptModal.placeholder')}
                  disabled={promptEditor.isAiBusy}
                />
                <div className="absolute right-1 top-1 flex flex-col gap-1">
                  <button onClick={promptEditor.handleSave} disabled={promptEditor.isSavingPrompt} className="px-2 py-1 text-[10px] bg-[var(--glass-accent-from)] text-white rounded">{promptEditor.isSavingPrompt ? '...' : t('panelCard.save')}</button>
                  <button onClick={promptEditor.handleCancelEdit} disabled={promptEditor.isSavingPrompt || promptEditor.isAiBusy} className="px-2 py-1 text-[10px] bg-[var(--glass-bg-muted)] text-[var(--glass-text-secondary)] rounded">{t('panelCard.cancel')}</button>
                </div>
              </div>
            ) : (
              <div onClick={promptEditor.isAiBusy ? undefined : promptEditor.handleStartEdit} className={`app-scrollbar min-h-[3.5rem] max-h-[7.25rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--glass-stroke-base)] bg-[var(--glass-bg-muted)] p-2 text-[13px] leading-5 text-[var(--glass-text-secondary)] ${promptEditor.isAiBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                {promptEditor.localPrompt || <span className="text-[var(--glass-text-tertiary)] italic">{t('panelCard.clickToEditPrompt')}</span>}
              </div>
            )}

            {promptEditor.canAiGeneratePrompt && (
              <GlassModalShell
                open={promptEditor.isAiModalOpen}
                onClose={promptEditor.handleCloseAiModal}
                title={t('promptModal.aiGenerateTitle')}
                description={t('promptModal.aiGenerateDescription')}
                size="md"
                footer={(
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={promptEditor.handleCloseAiModal}
                      disabled={promptEditor.isAiBusy}
                      className="glass-btn-base glass-btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('panelCard.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void promptEditor.handleAiGenerate() }}
                      disabled={promptEditor.isAiBusy || !promptEditor.aiInstruction.trim()}
                      className="glass-btn-base glass-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
                    >
                      {promptEditor.isAiGenerating ? (
                        <>
                          <AppIcon name="loader" className="w-4 h-4 animate-spin" />
                          <span>{t('panelCard.generating')}</span>
                        </>
                      ) : (
                        <>
                          <AppIcon name="sparkles" className="w-4 h-4" />
                          <span>{t('promptModal.aiGenerateAction')}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void promptEditor.handleApplyAiPrompt() }}
                      disabled={promptEditor.isAiBusy || !promptEditor.aiDraftPrompt.trim()}
                      className="glass-btn-base glass-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
                    >
                      {promptEditor.isAiApplying ? (
                        <>
                          <AppIcon name="loader" className="w-4 h-4 animate-spin" />
                          <span>{t('panelCard.save')}</span>
                        </>
                      ) : (
                        <>
                          <AppIcon name="edit" className="w-4 h-4" />
                          <span>{t('promptModal.applyPromptAction')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--glass-text-tertiary)]">
                      {t('promptModal.aiInstructionLabel')}
                    </label>
                    <textarea
                      value={promptEditor.aiInstruction}
                      onChange={(event) => promptEditor.setAiInstruction(event.target.value)}
                      placeholder={t('promptModal.aiGeneratePlaceholder')}
                      className="glass-textarea-base app-scrollbar h-28 w-full resize-none px-4 py-3 text-sm"
                      disabled={promptEditor.isAiBusy}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="block text-xs font-medium text-[var(--glass-text-tertiary)]">
                        {t('promptModal.aiResultLabel')}
                      </label>
                      <span className="text-[11px] text-[var(--glass-text-tertiary)]">
                        {t('promptModal.aiResultHint')}
                      </span>
                    </div>
                    <textarea
                      value={promptEditor.aiDraftPrompt}
                      onChange={(event) => promptEditor.setAiDraftPrompt(event.target.value)}
                      placeholder={t('promptModal.aiResultPlaceholder')}
                      className="glass-textarea-base app-scrollbar h-40 w-full resize-none px-4 py-3 text-sm"
                      disabled={promptEditor.isAiBusy}
                    />
                  </div>
                </div>
              </GlassModalShell>
            )}

            {showsFirstLastFrameActions ? (() => {
              const linkedNextPanel = layout.nextPanel!
              return (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                    <button
                      onClick={() => actions.onGenerateFirstLastFrame(
                        panel.storyboardId,
                        panel.panelIndex,
                        linkedNextPanel.storyboardId,
                        linkedNextPanel.panelIndex,
                        panelKey,
                        layout.flGenerationOptions,
                        actions.referenceSelection,
                        panel.panelId,
                        candidates.videoGenerationCount,
                      )}
                      disabled={
                        taskStatus.isVideoTaskRunning
                        || !panel.imageUrl
                        || !linkedNextPanel.imageUrl
                        || !layout.flModel
                        || layout.flMissingCapabilityFields.length > 0
                      }
                      className="w-full py-2 px-3 text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 bg-[var(--glass-accent-from)] text-white"
                    >
                      {isFirstLastFrameGenerated ? t('firstLastFrame.generated') : taskStatus.isVideoTaskRunning ? taskStatus.taskRunningVideoLabel : t('firstLastFrame.generate')}
                    </button>
                    <select
                      value={String(candidates.videoGenerationCount)}
                      onChange={(event) => candidates.onVideoGenerationCountChange(Number(event.target.value))}
                      className="glass-select-base w-full rounded-lg px-2 py-2 text-xs"
                      aria-label={t('panelCard.videoCountLabel')}
                    >
                      {getVideoGenerationCountOptions().map((option) => (
                        <option key={option} value={option}>
                          {t('panelCard.videoCountOption', { count: option })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <ModelCapabilityDropdown
                      compact
                      models={layout.flModelOptions}
                      value={layout.flModel || undefined}
                      onModelChange={actions.onFlModelChange}
                      capabilityFields={layout.flCapabilityFields.map((field) => ({
                        field: field.field,
                        label: field.label,
                        options: field.options,
                        disabledOptions: field.disabledOptions,
                      }))}
                      capabilityOverrides={layout.flGenerationOptions}
                      onCapabilityChange={(field, rawValue) => actions.onFlCapabilityChange(field, rawValue)}
                      placeholder={t('panelCard.selectModel')}
                    />
                  </div>
                  {renderReferenceSelectionControls()}
                </div>
              )
            })() : (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
                    <button
                      onClick={() =>
                        actions.onGenerateVideo(
                          panel.storyboardId,
                          panel.panelIndex,
                          videoModel.selectedModel,
                          undefined,
                          videoModel.generationOptions,
                          undefined,
                          actions.referenceSelection,
                          panel.panelId,
                          candidates.videoGenerationCount,
                        )}
                      disabled={
                        taskStatus.isVideoTaskRunning
                        || !panel.imageUrl
                        || !videoModel.selectedModel
                        || videoModel.missingCapabilityFields.length > 0
                      }
                      className="w-full py-2 px-3 text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 bg-[var(--glass-accent-from)] text-white"
                    >
                      {panel.videoUrl ? t('stage.hasSynced') : taskStatus.isVideoTaskRunning ? taskStatus.taskRunningVideoLabel : t('panelCard.generateVideo')}
                    </button>
                    <select
                      value={String(candidates.videoGenerationCount)}
                      onChange={(event) => candidates.onVideoGenerationCountChange(Number(event.target.value))}
                      className="glass-select-base w-full rounded-lg px-2 py-2 text-xs"
                      aria-label={t('panelCard.videoCountLabel')}
                    >
                      {getVideoGenerationCountOptions().map((option) => (
                        <option key={option} value={option}>
                          {t('panelCard.videoCountOption', { count: option })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <ModelCapabilityDropdown
                      compact
                      models={videoModel.videoModelOptions}
                      value={videoModel.selectedModel || undefined}
                      onModelChange={videoModel.handleModelChange}
                      capabilityFields={videoModel.capabilityFields.map((field) => ({
                        field: field.field,
                        label: renderCapabilityLabel(field),
                        options: field.options,
                        disabledOptions: field.disabledOptions,
                      }))}
                      capabilityOverrides={videoModel.generationOptions}
                      onCapabilityChange={(field, rawValue) => videoModel.setCapabilityValue(field, rawValue)}
                      placeholder={t('panelCard.selectModel')}
                    />
                  </div>
                  {renderReferenceSelectionControls()}
                </div>
                {computed.showLipSyncSection && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <button
                        onClick={computed.canLipSync ? lipSync.handleStartLipSync : undefined}
                        disabled={!computed.canLipSync || taskStatus.isLipSyncTaskRunning || lipSync.executingLipSync}
                        className="flex-1 py-1.5 text-xs rounded-lg transition-all flex items-center justify-center gap-1 bg-[var(--glass-accent-from)] text-white disabled:opacity-50"
                      >
                        {taskStatus.isLipSyncTaskRunning || lipSync.executingLipSync ? (
                          <TaskStatusInline state={taskStatus.lipSyncInlineState} className="text-white [&>span]:text-white [&_svg]:text-white" />
                        ) : (
                          <>{t('panelCard.lipSync')}</>
                        )}
                      </button>

                      {(taskStatus.isLipSyncTaskRunning || panel.lipSyncVideoUrl) && voiceManager.hasMatchedAudio && (
                        <button onClick={lipSync.handleStartLipSync} disabled={lipSync.executingLipSync} className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-[var(--glass-tone-warning-fg)] text-white">
                          {t('panelCard.redo')}
                        </button>
                      )}
                    </div>

                    {voiceManager.audioGenerateError && (
                      <div className="mt-1 p-1.5 bg-[var(--glass-tone-danger-bg)] border border-[var(--glass-stroke-danger)] rounded text-[10px] text-[var(--glass-tone-danger-fg)]">
                        {voiceManager.audioGenerateError}
                      </div>
                    )}

                    {voiceManager.localVoiceLines.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {voiceManager.localVoiceLines.map((voiceLine) => {
                          const isVoiceTaskRunning = voiceManager.isVoiceLineTaskRunning(voiceLine.id)
                          const voiceAudioRunningState = isVoiceTaskRunning
                            ? resolveTaskPresentationState({ phase: 'processing', intent: 'generate', resource: 'audio', hasOutput: !!voiceLine.audioUrl })
                            : null

                          return (
                            <div key={voiceLine.id} className="flex items-start gap-1.5 p-1.5 bg-[var(--glass-bg-muted)] rounded text-[10px]">
                              {voiceLine.audioUrl ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    voiceManager.handlePlayVoiceLine(voiceLine)
                                  }}
                                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors bg-[var(--glass-bg-muted)]"
                                  title={voiceManager.playingVoiceLineId === voiceLine.id ? t('panelCard.stopVoice') : t('panelCard.play')}
                                >
                                  <AppIcon name="play" className="w-3 h-3" />
                                </button>
                              ) : (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void voiceManager.handleGenerateAudio(voiceLine)
                                  }}
                                  disabled={isVoiceTaskRunning}
                                  className="flex-shrink-0 px-1.5 py-0.5 bg-[var(--glass-accent-from)] text-white rounded disabled:opacity-50"
                                  title={t('panelCard.generateAudio')}
                                >
                                  {isVoiceTaskRunning ? (
                                    <TaskStatusInline state={voiceAudioRunningState} className="text-white [&>span]:text-white [&_svg]:text-white" />
                                  ) : (
                                    tCommon('generate')
                                  )}
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-[var(--glass-text-tertiary)]">{voiceLine.speaker}: </span>
                                <span className="text-[var(--glass-text-secondary)]">&ldquo;{voiceLine.content}&rdquo;</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
