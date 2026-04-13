import { prisma } from '@/lib/prisma'
import { safeParseJsonObject } from '@/lib/json-repair'
import { findProjectBaseById } from '@/lib/projects/project-read'

export type AnyObj = Record<string, unknown>

export function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readRequiredString(value: unknown, field: string): string {
  const text = readText(value).trim()
  if (!text) {
    throw new Error(`${field} is required`)
  }
  return text
}

export function parseVisualResponse(responseText: string): AnyObj {
  return safeParseJsonObject(responseText) as AnyObj
}

export async function resolveProjectModel(projectId: string) {
  const project = await findProjectBaseById(projectId)
  const novelPromotionData = await prisma.novelPromotionProject.findUnique({
    where: { projectId },
    select: {
      id: true,
      analysisModel: true,
    },
  })
  if (!project) throw new Error('Project not found')
  if (!novelPromotionData) throw new Error('Novel promotion data not found')
  if (!novelPromotionData.analysisModel) throw new Error('璇峰厛鍦ㄩ」鐩缃腑閰嶇疆鍒嗘瀽妯″瀷')
  return {
    id: project.id,
    novelPromotionData,
  }
}
