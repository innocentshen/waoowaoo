import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderAssistantSystemPrompt } from '@/lib/assistant-platform/system-prompts'
import { getPromptTemplate, PROMPT_IDS } from '@/lib/prompt-i18n'
import {
  activatePromptCenterVersion,
  clearPromptCenterCaches,
  getPromptCenterItem,
  resetPromptCenterItem,
  savePromptCenterVersion,
} from '@/lib/prompt-center/service'

describe('prompt center service', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waoowaoo-prompt-center-'))
    process.env.PROMPT_CENTER_DATA_DIR = tempDir
    clearPromptCenterCaches()
  })

  afterEach(() => {
    clearPromptCenterCaches()
    delete process.env.PROMPT_CENTER_DATA_DIR
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('overrides prompt-i18n templates and can reset to builtin', () => {
    const key = 'prompt-i18n:np_select_prop:en'
    const builtin = getPromptTemplate(PROMPT_IDS.NP_SELECT_PROP, 'en')

    const saved = savePromptCenterVersion(key, {
      content: 'override select prop prompt',
      note: 'tighten filtering',
      actor: { id: 'user-1', label: 'tester' },
    })

    expect(saved.source).toBe('override')
    expect(saved.activeVersionNumber).toBe(1)
    expect(saved.versions).toHaveLength(1)
    expect(getPromptTemplate(PROMPT_IDS.NP_SELECT_PROP, 'en')).toBe('override select prop prompt')

    const reset = resetPromptCenterItem(key)
    expect(reset.source).toBe('builtin')
    expect(reset.activeVersionId).toBeNull()
    expect(getPromptTemplate(PROMPT_IDS.NP_SELECT_PROP, 'en')).toBe(builtin)
  })

  it('stores multiple versions and can activate an older assistant prompt version', () => {
    const key = 'assistant-system:api-config-template'

    const first = savePromptCenterVersion(key, {
      content: 'You are version one. provider={{providerId}}',
      note: 'v1',
      actor: { id: 'user-1', label: 'tester' },
    })
    const second = savePromptCenterVersion(key, {
      content: 'You are version two. provider={{providerId}}',
      note: 'v2',
      actor: { id: 'user-1', label: 'tester' },
    })

    expect(second.activeVersionNumber).toBe(2)
    expect(renderAssistantSystemPrompt('api-config-template', { providerId: 'demo' }))
      .toBe('You are version two. provider=demo')

    const firstVersion = first.versions[0]
    const activated = activatePromptCenterVersion(key, firstVersion.id)

    expect(activated.activeVersionId).toBe(firstVersion.id)
    expect(renderAssistantSystemPrompt('api-config-template', { providerId: 'demo' }))
      .toBe('You are version one. provider=demo')

    const detail = getPromptCenterItem(key)
    expect(detail?.versions).toHaveLength(2)
    expect(detail?.versions.find((item) => item.id === firstVersion.id)?.isActive).toBe(true)
    expect(detail?.relationships?.workflows.some((workflow) => workflow.id === 'assistant-api-config')).toBe(true)
  })

  it('returns workflow relationships for prompts so editors can inspect upstream and downstream links', () => {
    const detail = getPromptCenterItem('prompt-i18n:np_agent_acting_direction:zh')

    expect(detail?.relationships?.familyId).toBe('storyboard-pipeline')
    expect(detail?.relationships?.parallel.map((item) => item.promptId)).toContain(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER)
    expect(detail?.relationships?.upstream.map((item) => item.promptId)).toContain(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN)
    expect(detail?.relationships?.downstream.map((item) => item.promptId)).toContain(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL)
    expect(detail?.relationships?.workflows.some((workflow) => workflow.id === 'script-to-storyboard')).toBe(true)
    expect(detail?.relationships?.consumers.some((consumer) => consumer.sourcePath.endsWith('script-to-storyboard.ts'))).toBe(true)
  })
})
