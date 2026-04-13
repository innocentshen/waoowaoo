import type { Job } from 'bullmq'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { resolveProjectModelCapabilityGenerationOptions } from '@/lib/config-service'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import type { ReasoningEffort } from '@/lib/llm/types'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import type { TaskJobData } from '@/lib/task/types'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'

function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return value === 'minimal' || value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh'
}

export async function handleAiStoryExpandTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const promptInput = readText(payload.prompt).trim()
  const analysisModel = readText(payload.analysisModel).trim()

  if (!promptInput) {
    throw new Error('prompt is required')
  }
  if (!analysisModel) {
    throw new Error('analysisModel is required')
  }

  const prompt = buildPrompt({
    promptId: PROMPT_IDS.NP_AI_STORY_EXPAND,
    locale: job.data.locale,
    variables: {
      input: promptInput,
    },
  })
  const llmCapabilityOptions = await resolveProjectModelCapabilityGenerationOptions({
    projectId: job.data.projectId || 'home-ai-write',
    userId: job.data.userId,
    modelType: 'llm',
    modelKey: analysisModel,
  })
  const reasoningEffort = isReasoningEffort(llmCapabilityOptions.reasoningEffort)
    ? llmCapabilityOptions.reasoningEffort
    : undefined

  await reportTaskProgress(job, 25, {
    stage: 'ai_story_expand_prepare',
    stageLabel: '准备故事扩写参数',
    displayMode: 'loading',
  })
  await assertTaskActive(job, 'ai_story_expand_prepare')

  const streamContext = createWorkerLLMStreamContext(job, 'ai_story_expand')
  const streamCallbacks = createWorkerLLMStreamCallbacks(job, streamContext)

  const completion = await withInternalLLMStreamCallbacks(
    streamCallbacks,
    async () =>
      await executeAiTextStep({
        userId: job.data.userId,
        model: analysisModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        reasoningEffort,
        projectId: job.data.projectId || 'home-ai-write',
        action: 'ai_story_expand',
        meta: {
          stepId: 'ai_story_expand',
          stepTitle: '故事扩写',
          stepIndex: 1,
          stepTotal: 1,
        },
      }),
  )
  await streamCallbacks.flush()
  await assertTaskActive(job, 'ai_story_expand_persist')

  const expandedText = completion.text.trim()
  if (!expandedText) {
    throw new Error('AI story expand response is empty')
  }

  await reportTaskProgress(job, 96, {
    stage: 'ai_story_expand_done',
    stageLabel: '故事扩写已完成',
    displayMode: 'loading',
  })

  return {
    expandedText,
  }
}
