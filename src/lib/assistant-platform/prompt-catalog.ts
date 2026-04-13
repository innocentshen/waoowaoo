export type AssistantPromptId = 'api-config-template' | 'tutorial'

export const ASSISTANT_PROMPT_FILE_BY_ID: Record<AssistantPromptId, string> = {
  'api-config-template': 'api-config-template.system.txt',
  tutorial: 'tutorial.system.txt',
}

export const ASSISTANT_PROMPT_VARIABLE_KEYS: Record<AssistantPromptId, readonly string[]> = {
  'api-config-template': ['providerId'],
  tutorial: [],
}
