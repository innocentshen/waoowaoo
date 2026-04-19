// 视频阶段共享类型定义
import type { ModelCapabilities } from '@/lib/model-config-contract'
import type { VideoPricingTier } from '@/lib/model-pricing/video-tier'

// 用户视频模型选项
export interface VideoModelOption {
  value: string
  label: string
  provider?: string
  providerName?: string
  disabled?: boolean
  capabilities?: ModelCapabilities
  videoPricingTiers?: VideoPricingTier[]
}

export type VideoGenerationMode = 'normal' | 'firstlastframe' | 'edit' | 'extend'
export type VideoOperationMode = Extract<VideoGenerationMode, 'edit' | 'extend'>

export interface VideoCandidateMeta {
  sourceCandidateId?: string | null
  sourceGenerationMode?: VideoGenerationMode | null
  extendDuration?: number | null
  referenceHandling?: string | null
  requestedReferenceImageCount?: number | null
  sentReferenceImageCount?: number | null
  failedReferenceImageCount?: number | null
}

export interface VideoReferenceCharacter {
  name: string
  appearance?: string
}

export interface VideoReferenceCharacterOption extends VideoReferenceCharacter {
  key: string
  label: string
  imageUrl?: string | null
  description?: string | null
}

export interface VideoReferenceNamedOption {
  key: string
  name: string
  imageUrl?: string | null
  description?: string | null
}

export interface VideoReferenceOptions {
  characters: VideoReferenceCharacterOption[]
  locations: VideoReferenceNamedOption[]
  props: VideoReferenceNamedOption[]
}

export interface VideoCandidate {
  id: string
  videoUrl: string
  generationMode: VideoGenerationMode
  createdAt: string
  model?: string | null
  prompt?: string | null
  meta?: VideoCandidateMeta | null
  isSelected: boolean
}

export interface VideoCandidateViewerPanel {
  panelId?: string
  panelKey: string
  panelNumber: number
  storyboardId: string
  panelIndex: number
  imageUrl?: string | null
  imagePrompt?: string | null
  duration?: number | null
  prompt: string
  promptField: 'videoPrompt' | 'firstLastFramePrompt'
  defaultVideoModel: string
  isLinked: boolean
  isLastFrame: boolean
  isSavingPrompt?: boolean
  referenceSelection?: VideoReferenceSelection
  referenceOptions?: VideoReferenceOptions
  nextPanel?: {
    panelId?: string
    panelKey: string
    storyboardId: string
    panelIndex: number
  } | null
  items: VideoCandidate[]
}

export interface TextPanel {
  panel_number: number
  shot_type: string
  camera_move?: string
  description: string
  characters?: Array<string | { name?: string; appearance?: string }>
  location?: string
  locations?: string[]
  props?: string[]
  text_segment?: string
  duration?: number
  video_prompt?: string
  imagePrompt?: string
  videoModel?: string
}

export interface Panel {
  id?: string
  panelIndex: number
  panelNumber?: number | null
  shotType?: string | null
  cameraMove?: string | null
  description?: string | null
  characters?: string | null
  location?: string | null
  props?: string | null
  textSegment?: string | null
  srtSegment?: string | null  // SRT 原文片段
  duration?: number | null
  imagePrompt?: string | null
  imageUrl?: string | null  // 图片URL
  videoPrompt?: string | null
  firstLastFramePrompt?: string | null
  videoUrl?: string | null
  videoCandidates?: VideoCandidate[] | null
  videoGenerationMode?: VideoGenerationMode | null
  videoModel?: string | null
  linkedToNextPanel?: boolean | null
  videoTaskRunning?: boolean | null
  videoErrorMessage?: string | null  // 视频生成错误消息
  videoErrorCode?: string | null
  imageTaskRunning?: boolean | null
  // 口型同步相关
  lipSyncVideoUrl?: string | null
  lipSyncTaskRunning?: boolean | null
  lipSyncErrorMessage?: string | null  // 口型同步错误消息
  lipSyncErrorCode?: string | null
}

export interface Storyboard {
  id: string
  clipId?: string | null
  panels?: Panel[]
  clip?: {
    start: number
    end: number
    summary: string
  }
}

export interface Clip {
  id: string
  start: number
  end: number
  summary: string
}

export interface VideoPanel {
  panelId?: string  // 任务目标ID
  storyboardId: string
  panelIndex: number
  textPanel?: TextPanel
  firstLastFramePrompt?: string
  imageUrl?: string
  videoUrl?: string
  videoCandidates?: VideoCandidate[]
  videoGenerationMode?: VideoGenerationMode
  videoTaskRunning?: boolean
  videoErrorMessage?: string  // 视频生成错误消息
  videoErrorCode?: string
  videoModel?: string
  linkedToNextPanel?: boolean
  // 口型同步相关
  lipSyncVideoUrl?: string
  lipSyncTaskRunning?: boolean
  lipSyncTaskId?: string
  lipSyncErrorMessage?: string  // 口型同步错误消息
  lipSyncErrorCode?: string
}

// 匹配的配音信息
export interface MatchedVoiceLine {
  id: string
  lineIndex: number
  speaker: string
  content: string
  audioUrl?: string
  audioDuration?: number
  emotionStrength?: number
}

export interface FirstLastFrameParams {
  lastFrameStoryboardId: string
  lastFramePanelIndex: number
  flModel: string
  customPrompt?: string
}

export interface VideoOperationRequest {
  mode: VideoOperationMode
  sourceCandidateId: string
  instruction: string
  extendDuration?: number
}

export interface VideoReferenceSelection {
  includeCharacters?: boolean
  includeLocation?: boolean
  includeProps?: boolean
  characters?: VideoReferenceCharacter[]
  locations?: string[]
  props?: string[]
}

export type VideoGenerationOptionValue = string | number | boolean
export type VideoGenerationOptions = Record<string, VideoGenerationOptionValue>

export interface BatchVideoGenerationParams {
  videoModel: string
  count?: number
  generationOptions?: VideoGenerationOptions
  referenceSelection?: VideoReferenceSelection
}
