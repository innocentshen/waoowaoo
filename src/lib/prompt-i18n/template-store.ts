import { PROMPT_CATALOG } from './catalog'
import type { PromptId } from './prompt-ids'
import type { PromptLocale } from './types'
import { PromptI18nError } from './errors'
import { getEffectivePromptTemplate } from '@/lib/prompt-center/service'

export function getPromptTemplate(promptId: PromptId, locale: PromptLocale): string {
  const entry = PROMPT_CATALOG[promptId]
  if (!entry) {
    throw new PromptI18nError(
      'PROMPT_ID_UNREGISTERED',
      promptId,
      `Prompt is not registered: ${promptId}`,
    )
  }
  try {
    return getEffectivePromptTemplate(promptId, locale)
  } catch {
    throw new PromptI18nError(
      'PROMPT_TEMPLATE_NOT_FOUND',
      promptId,
      `Prompt template not found for promptId=${promptId}, locale=${locale}`,
      { locale },
    )
  }
}
