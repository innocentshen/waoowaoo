import type { AssistantPromptId } from './prompt-catalog'
import { getEffectiveAssistantSystemPrompt } from '@/lib/prompt-center/service'

function replacePromptVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, keyRaw: string) => {
    const key = keyRaw.trim()
    return vars[key] || ''
  })
}

export function renderAssistantSystemPrompt(
  promptId: AssistantPromptId,
  vars?: Record<string, string>,
): string {
  const template = getEffectiveAssistantSystemPrompt(promptId)
  if (!vars || Object.keys(vars).length === 0) return template
  return replacePromptVariables(template, vars)
}
