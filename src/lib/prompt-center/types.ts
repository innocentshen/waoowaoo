import type { PromptId } from '@/lib/prompt-i18n'
import type { PromptLocale } from '@/lib/prompt-i18n/types'
import type { AssistantPromptId } from '@/lib/assistant-platform/prompt-catalog'

export type PromptCenterEntryKind = 'prompt-i18n' | 'assistant-system'
export type PromptCenterSource = 'builtin' | 'override'
export type PromptCenterWorkflowStageMode = 'sequential' | 'parallel'
export type PromptCenterConsumerKind = 'worker-handler' | 'workflow-helper' | 'assistant-skill' | 'ui-hook'

export type PromptCenterRegistryEntry = {
  key: string
  storageId: string
  kind: PromptCenterEntryKind
  title: string
  promptId: PromptId | AssistantPromptId
  locale?: PromptLocale
  sourcePath: string
  variableKeys: readonly string[]
  trimOnLoad: boolean
}

export type PromptCenterVersionManifest = {
  id: string
  version: number
  createdAt: string
  createdBy: string | null
  note: string | null
  contentFile: string
}

export type PromptCenterManifest = {
  key: string
  storageId: string
  activeVersionId: string | null
  updatedAt: string
  versions: PromptCenterVersionManifest[]
}

export type PromptCenterVersionDetail = PromptCenterVersionManifest & {
  content: string
  isActive: boolean
}

export type PromptCenterItemSummary = {
  key: string
  storageId: string
  kind: PromptCenterEntryKind
  title: string
  promptId: string
  locale?: PromptLocale
  sourcePath: string
  variableKeys: readonly string[]
  source: PromptCenterSource
  activeVersionId: string | null
  activeVersionNumber: number | null
  updatedAt: string | null
}

export type PromptCenterRelatedItem = {
  key: string
  title: string
  promptId: string
  locale?: PromptLocale
  kind: PromptCenterEntryKind
  sourcePath: string
}

export type PromptCenterConsumer = {
  id: string
  title: string
  description: string
  sourcePath: string
  kind: PromptCenterConsumerKind
}

export type PromptCenterWorkflowStage = {
  id: string
  title: string
  description: string
  mode: PromptCenterWorkflowStageMode
  prompts: PromptCenterRelatedItem[]
  containsCurrent: boolean
}

export type PromptCenterWorkflow = {
  id: string
  title: string
  description: string
  entryPath: string
  stages: PromptCenterWorkflowStage[]
}

export type PromptCenterRelationships = {
  familyId: string
  familyTitle: string
  familyDescription: string
  upstream: PromptCenterRelatedItem[]
  parallel: PromptCenterRelatedItem[]
  downstream: PromptCenterRelatedItem[]
  sameFamily: PromptCenterRelatedItem[]
  consumers: PromptCenterConsumer[]
  workflows: PromptCenterWorkflow[]
}

export type PromptCenterItemDetail = PromptCenterItemSummary & {
  builtinContent: string
  effectiveContent: string
  versions: PromptCenterVersionDetail[]
  relationships: PromptCenterRelationships | null
}

export type PromptCenterMutationActor = {
  id: string
  label?: string | null
}
