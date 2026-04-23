import { TASK_TYPE } from '@/lib/task/types'

export const NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES = [
  TASK_TYPE.IMAGE_PANEL,
  TASK_TYPE.PANEL_VARIANT,
  TASK_TYPE.MODIFY_ASSET_IMAGE,
] as const

export const NOVEL_PROMOTION_PANEL_VIDEO_TASK_TYPES = [
  TASK_TYPE.VIDEO_PANEL,
] as const

export const NOVEL_PROMOTION_PANEL_LIP_SYNC_TASK_TYPES = [
  TASK_TYPE.LIP_SYNC,
] as const

const NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPE_SET = new Set<string>(
  NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPES,
)

export function isNovelPromotionPanelImageTaskType(taskType: string | null | undefined): boolean {
  return typeof taskType === 'string' && NOVEL_PROMOTION_PANEL_IMAGE_TASK_TYPE_SET.has(taskType)
}
