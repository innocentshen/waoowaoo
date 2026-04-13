import type {
  VideoPanel,
  MatchedVoiceLine,
  VideoModelOption,
  FirstLastFrameParams,
  VideoGenerationOptions,
  VideoOperationRequest,
  VideoReferenceOptions,
  VideoReferenceSelection,
} from '../types'
import type { CapabilitySelections, CapabilityValue } from '@/lib/model-config-contract'

export interface VideoPanelCardShellProps {
  panel: VideoPanel
  panelIndex: number
  defaultVideoModel: string
  capabilityOverrides: CapabilitySelections
  videoRatio?: string
  userVideoModels?: VideoModelOption[]
  projectId: string
  episodeId?: string
  runningVoiceLineIds?: Set<string>
  matchedVoiceLines?: MatchedVoiceLine[]
  onLipSync?: (storyboardId: string, panelIndex: number, voiceLineId: string, panelId?: string) => Promise<void>
  showLipSyncVideo: boolean
  onToggleLipSyncVideo: (panelKey: string, value: boolean) => void
  isLinked: boolean
  isLastFrame: boolean
  nextPanel: VideoPanel | null
  prevPanel: VideoPanel | null
  hasNext: boolean
  flModel: string
  flModelOptions: VideoModelOption[]
  flGenerationOptions: VideoGenerationOptions
  flCapabilityFields: Array<{
    field: string
    label: string
    options: CapabilityValue[]
    disabledOptions?: CapabilityValue[]
    value: CapabilityValue | undefined
  }>
  flMissingCapabilityFields: string[]
  flCustomPrompt: string
  defaultFlPrompt: string
  defaultOptimizeInstruction?: string
  localPrompt: string
  isSavingPrompt: boolean
  onUpdateLocalPrompt?: (value: string) => void
  onSavePrompt?: (value: string) => Promise<void>
  onGeneratePromptByAi?: (modifyInstruction: string, currentVideoPrompt: string) => Promise<string>
  onGeneratePromptByAiForViewer?: (params: {
    panelId: string
    lastPanelId?: string
    currentPrompt?: string
    currentVideoPrompt: string
    modifyInstruction: string
  }) => Promise<string>
  onGenerateVideo: (
    storyboardId: string,
    panelIndex: number,
    videoModel?: string,
    firstLastFrame?: FirstLastFrameParams,
    generationOptions?: VideoGenerationOptions,
    videoOperation?: VideoOperationRequest,
    referenceSelection?: VideoReferenceSelection,
    panelId?: string,
    count?: number,
  ) => void
  referenceOptions?: VideoReferenceOptions
  referenceSelection: VideoReferenceSelection
  onUpdateReferenceSelection: (panelKey: string, selection: VideoReferenceSelection) => void
  videoGenerationCount: number
  onVideoGenerationCountChange: (count: number) => void
  viewerPanelIndex?: number
  onOpenViewerForPanel?: (panelIndex: number, candidateId?: string) => void
  onUpdateViewerPrompt?: (
    panelKey: string,
    value: string,
    field?: 'videoPrompt' | 'firstLastFramePrompt',
  ) => void
  onSaveViewerPrompt?: (
    storyboardId: string,
    panelIndex: number,
    panelKey: string,
    value: string,
    field?: 'videoPrompt' | 'firstLastFramePrompt',
  ) => Promise<void>
  onSelectVideoCandidate?: (panelId: string, candidateId: string) => Promise<void>
  onDeleteVideoCandidate?: (panelId: string, candidateId: string) => Promise<void>
  onDownloadVideoCandidate?: (videoUrl: string, fileName: string) => Promise<void>
  onUpdatePanelVideoModel: (storyboardId: string, panelIndex: number, model: string) => void
  onUpdateVideoGenerationOptions: (modelKey: string, generationOptions: VideoGenerationOptions) => void
  onToggleLink: (panelKey: string, storyboardId: string, panelIndex: number) => void
  onFlModelChange: (model: string) => void
  onFlCapabilityChange: (field: string, rawValue: string) => void
  onFlCustomPromptChange: (panelKey: string, value: string) => void
  onResetFlPrompt: (panelKey: string) => void
  onGenerateFirstLastFrame: (
    firstStoryboardId: string,
    firstPanelIndex: number,
    lastStoryboardId: string,
    lastPanelIndex: number,
    panelKey: string,
    generationOptions?: VideoGenerationOptions,
    referenceSelection?: VideoReferenceSelection,
    firstPanelId?: string,
    count?: number,
  ) => void
  onPreviewImage?: (imageUrl: string) => void
}
