import type { AssistantPromptId } from '@/lib/assistant-platform/prompt-catalog'
import { PROMPT_IDS, type PromptId } from '@/lib/prompt-i18n/prompt-ids'
import type { PromptLocale } from '@/lib/prompt-i18n/types'
import { findPromptCenterAssistantEntry, findPromptCenterPromptI18nEntry } from './registry'
import type {
  PromptCenterConsumer,
  PromptCenterRegistryEntry,
  PromptCenterRelatedItem,
  PromptCenterRelationships,
  PromptCenterWorkflow,
  PromptCenterWorkflowStageMode,
} from './types'

type PromptRelationTarget =
  | {
    kind: 'prompt-i18n'
    promptId: PromptId
  }
  | {
    kind: 'assistant-system'
    promptId: AssistantPromptId
  }

type PromptFamilyDefinition = {
  id: string
  title: string
  description: string
  targets: PromptRelationTarget[]
}

type PromptWorkflowStageDefinition = {
  id: string
  title: string
  description: string
  mode: PromptCenterWorkflowStageMode
  targets: PromptRelationTarget[]
}

type PromptWorkflowDefinition = {
  id: string
  title: string
  description: string
  entryPath: string
  stages: PromptWorkflowStageDefinition[]
}

const prompt = (promptId: PromptId): PromptRelationTarget => ({ kind: 'prompt-i18n', promptId })
const assistant = (promptId: AssistantPromptId): PromptRelationTarget => ({ kind: 'assistant-system', promptId })

function buildTargetId(target: PromptRelationTarget) {
  return `${target.kind}:${target.promptId}`
}

function isSameTarget(left: PromptRelationTarget, right: PromptRelationTarget) {
  return left.kind === right.kind && left.promptId === right.promptId
}

function getEntryTarget(entry: PromptCenterRegistryEntry): PromptRelationTarget {
  if (entry.kind === 'assistant-system') {
    return assistant(entry.promptId as AssistantPromptId)
  }
  return prompt(entry.promptId as PromptId)
}

const PROMPT_FAMILIES: PromptFamilyDefinition[] = [
  {
    id: 'character-reference',
    title: 'Character Reference',
    description: 'Turns reference images into reusable character sheet prompts.',
    targets: [
      prompt(PROMPT_IDS.CHARACTER_IMAGE_TO_DESCRIPTION),
      prompt(PROMPT_IDS.CHARACTER_REFERENCE_TO_SHEET),
    ],
  },
  {
    id: 'story-prep',
    title: 'Story Prep',
    description: 'Prepares raw story text before deeper screenplay or storyboard processing.',
    targets: [
      prompt(PROMPT_IDS.NP_AI_STORY_EXPAND),
      prompt(PROMPT_IDS.NP_EPISODE_SPLIT),
    ],
  },
  {
    id: 'story-to-script',
    title: 'Story To Script',
    description: 'Extracts structured assets, builds clips, and converts them into screenplay output.',
    targets: [
      prompt(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE),
      prompt(PROMPT_IDS.NP_SELECT_LOCATION),
      prompt(PROMPT_IDS.NP_SELECT_PROP),
      prompt(PROMPT_IDS.NP_AGENT_CLIP),
      prompt(PROMPT_IDS.NP_SCREENPLAY_CONVERSION),
    ],
  },
  {
    id: 'storyboard-pipeline',
    title: 'Storyboard Pipeline',
    description: 'Plans storyboard panels, adds direction, fills detail, and supports follow-up editing.',
    targets: [
      prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN),
      prompt(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER),
      prompt(PROMPT_IDS.NP_AGENT_ACTING_DIRECTION),
      prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL),
      prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_INSERT),
      prompt(PROMPT_IDS.NP_STORYBOARD_EDIT),
      prompt(PROMPT_IDS.NP_VOICE_ANALYSIS),
    ],
  },
  {
    id: 'asset-design',
    title: 'Asset Design',
    description: 'Creates initial character or location descriptions and turns profiles into visual prompts.',
    targets: [
      prompt(PROMPT_IDS.NP_CHARACTER_CREATE),
      prompt(PROMPT_IDS.NP_LOCATION_CREATE),
      prompt(PROMPT_IDS.NP_AGENT_CHARACTER_VISUAL),
    ],
  },
  {
    id: 'asset-maintenance',
    title: 'Asset Maintenance',
    description: 'Refines existing asset descriptions using direct edit instructions or regeneration tasks.',
    targets: [
      prompt(PROMPT_IDS.NP_CHARACTER_MODIFY),
      prompt(PROMPT_IDS.NP_LOCATION_MODIFY),
      prompt(PROMPT_IDS.NP_PROP_DESCRIPTION_UPDATE),
      prompt(PROMPT_IDS.NP_CHARACTER_DESCRIPTION_UPDATE),
      prompt(PROMPT_IDS.NP_LOCATION_DESCRIPTION_UPDATE),
      prompt(PROMPT_IDS.NP_CHARACTER_REGENERATE),
      prompt(PROMPT_IDS.NP_LOCATION_REGENERATE),
    ],
  },
  {
    id: 'shot-production',
    title: 'Shot Production',
    description: 'Analyzes shot variants, adjusts shot prompts, generates video motion prompts, and builds final panel image prompts.',
    targets: [
      prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_ANALYSIS),
      prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_GENERATE),
      prompt(PROMPT_IDS.NP_IMAGE_PROMPT_MODIFY),
      prompt(PROMPT_IDS.NP_VIDEO_PROMPT_GENERATE),
      prompt(PROMPT_IDS.NP_SINGLE_PANEL_IMAGE),
    ],
  },
  {
    id: 'assistant-platform',
    title: 'Assistant Platform',
    description: 'System prompts that power the built-in assistant skills in settings and onboarding flows.',
    targets: [
      assistant('api-config-template'),
      assistant('tutorial'),
    ],
  },
]

const PROMPT_WORKFLOWS: PromptWorkflowDefinition[] = [
  {
    id: 'reference-to-character',
    title: 'Reference To Character',
    description: 'Analyze uploaded reference images, then turn the result into a character-sheet generation prompt.',
    entryPath: 'src/lib/workers/handlers/reference-to-character.ts',
    stages: [
      {
        id: 'analyze-reference',
        title: 'Analyze Reference Images',
        description: 'Reads visual references and extracts a structured character description.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.CHARACTER_IMAGE_TO_DESCRIPTION)],
      },
      {
        id: 'build-sheet',
        title: 'Build Character Sheet Prompt',
        description: 'Converts the extracted description into the final sheet-generation prompt.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.CHARACTER_REFERENCE_TO_SHEET)],
      },
    ],
  },
  {
    id: 'story-expansion',
    title: 'Story Expansion',
    description: 'Expands a compact story brief into a richer narrative draft.',
    entryPath: 'src/lib/workers/handlers/ai-story-expand.ts',
    stages: [
      {
        id: 'expand-story',
        title: 'Expand Story',
        description: 'Generates a fuller story draft from the user brief.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AI_STORY_EXPAND)],
      },
    ],
  },
  {
    id: 'episode-split',
    title: 'Episode Split',
    description: 'Splits long content into episode-sized units for later production steps.',
    entryPath: 'src/lib/workers/handlers/episode-split.ts',
    stages: [
      {
        id: 'split-episode',
        title: 'Split Episodes',
        description: 'Breaks the input into multiple episode sections.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_EPISODE_SPLIT)],
      },
    ],
  },
  {
    id: 'analyze-global-assets',
    title: 'Analyze Global Assets',
    description: 'Runs a global pass over story content to extract reusable characters, locations, and props.',
    entryPath: 'src/lib/workers/handlers/analyze-global-prompt.ts',
    stages: [
      {
        id: 'extract-global-assets',
        title: 'Extract Asset Candidates',
        description: 'These prompts run as a coordinated analysis set over the same source text.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE),
          prompt(PROMPT_IDS.NP_SELECT_LOCATION),
          prompt(PROMPT_IDS.NP_SELECT_PROP),
        ],
      },
    ],
  },
  {
    id: 'analyze-novel-assets',
    title: 'Analyze Novel Assets',
    description: 'Runs the same extraction prompts inside the novel analysis worker.',
    entryPath: 'src/lib/workers/handlers/analyze-novel.ts',
    stages: [
      {
        id: 'extract-novel-assets',
        title: 'Extract Asset Candidates',
        description: 'These prompts run in parallel to infer characters, locations, and props from the novel.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE),
          prompt(PROMPT_IDS.NP_SELECT_LOCATION),
          prompt(PROMPT_IDS.NP_SELECT_PROP),
        ],
      },
    ],
  },
  {
    id: 'story-to-script',
    title: 'Story To Script',
    description: 'Converts story text into structured clips and screenplay blocks for later storyboard work.',
    entryPath: 'src/lib/workers/handlers/story-to-script.ts',
    stages: [
      {
        id: 'analyze-core-assets',
        title: 'Analyze Core Assets',
        description: 'Character, location, and prop prompts build the shared world context in parallel.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE),
          prompt(PROMPT_IDS.NP_SELECT_LOCATION),
          prompt(PROMPT_IDS.NP_SELECT_PROP),
        ],
      },
      {
        id: 'build-clips',
        title: 'Build Clips',
        description: 'Uses the analyzed world context to split the story into clip-level units.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_CLIP)],
      },
      {
        id: 'convert-screenplay',
        title: 'Convert Screenplay',
        description: 'Turns each clip into screenplay-friendly structured output.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_SCREENPLAY_CONVERSION)],
      },
    ],
  },
  {
    id: 'asset-design',
    title: 'Asset Design',
    description: 'Generates first-pass asset descriptions from freeform user ideas.',
    entryPath: 'src/lib/asset-utils/ai-design.ts',
    stages: [
      {
        id: 'design-assets',
        title: 'Generate Asset Drafts',
        description: 'Character and location draft prompts are selected based on the asset type.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_CHARACTER_CREATE),
          prompt(PROMPT_IDS.NP_LOCATION_CREATE),
        ],
      },
    ],
  },
  {
    id: 'character-visual',
    title: 'Character Visual',
    description: 'Turns confirmed character profile data into visual-generation guidance.',
    entryPath: 'src/lib/workers/handlers/character-profile.ts',
    stages: [
      {
        id: 'build-character-visual',
        title: 'Build Visual Prompt',
        description: 'Creates the character visual prompt from confirmed profile JSON.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_CHARACTER_VISUAL)],
      },
    ],
  },
  {
    id: 'asset-modify',
    title: 'Asset Modify',
    description: 'Applies user edit instructions to existing character, location, or prop descriptions.',
    entryPath: 'src/lib/workers/handlers/asset-hub-ai-modify.ts',
    stages: [
      {
        id: 'modify-assets',
        title: 'Modify Asset Prompts',
        description: 'The exact prompt is chosen by asset type before sending the edit request.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_CHARACTER_MODIFY),
          prompt(PROMPT_IDS.NP_LOCATION_MODIFY),
          prompt(PROMPT_IDS.NP_PROP_DESCRIPTION_UPDATE),
        ],
      },
    ],
  },
  {
    id: 'description-update',
    title: 'Description Update',
    description: 'Uses image context plus edit instructions to refresh existing asset descriptions.',
    entryPath: 'src/lib/workers/handlers/modify-description-sync.ts',
    stages: [
      {
        id: 'update-descriptions',
        title: 'Update Asset Descriptions',
        description: 'These prompts specialize description updates for character, location, and prop assets.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_CHARACTER_DESCRIPTION_UPDATE),
          prompt(PROMPT_IDS.NP_LOCATION_DESCRIPTION_UPDATE),
          prompt(PROMPT_IDS.NP_PROP_DESCRIPTION_UPDATE),
        ],
      },
    ],
  },
  {
    id: 'shot-variant',
    title: 'Shot Variant',
    description: 'Analyzes the current shot, then produces a new shot variant prompt from that analysis.',
    entryPath: 'src/lib/workers/handlers/panel-variant-task-handler.ts',
    stages: [
      {
        id: 'analyze-shot',
        title: 'Analyze Current Shot',
        description: 'Breaks down the existing panel into variant-ready attributes.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_ANALYSIS)],
      },
      {
        id: 'generate-shot-variant',
        title: 'Generate Shot Variant',
        description: 'Builds the final variant prompt from the analysis result and target style.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_GENERATE)],
      },
    ],
  },
  {
    id: 'script-to-storyboard',
    title: 'Script To Storyboard',
    description: 'Plans storyboard panels, adds camera and acting direction, then enriches details and voice.',
    entryPath: 'src/lib/workers/handlers/script-to-storyboard.ts',
    stages: [
      {
        id: 'storyboard-plan',
        title: 'Plan Storyboard',
        description: 'Builds the first-pass panel plan from screenplay and asset context.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN)],
      },
      {
        id: 'shot-direction',
        title: 'Add Shot Direction',
        description: 'Camera design and acting notes are produced as coordinated parallel stages.',
        mode: 'parallel',
        targets: [
          prompt(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER),
          prompt(PROMPT_IDS.NP_AGENT_ACTING_DIRECTION),
        ],
      },
      {
        id: 'storyboard-detail',
        title: 'Fill Storyboard Detail',
        description: 'Adds missing visual and production detail onto the planned storyboard panels.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL)],
      },
      {
        id: 'voice-analysis',
        title: 'Analyze Voice',
        description: 'Extracts voice direction once storyboard structure is already in place.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_VOICE_ANALYSIS)],
      },
    ],
  },
  {
    id: 'storyboard-insert',
    title: 'Storyboard Insert',
    description: 'Builds an in-between panel from surrounding storyboard context and user instructions.',
    entryPath: 'src/lib/workers/text.worker.ts',
    stages: [
      {
        id: 'insert-panel',
        title: 'Insert Panel',
        description: 'Synthesizes a new panel between existing storyboard panels.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_INSERT)],
      },
    ],
  },
  {
    id: 'panel-image',
    title: 'Panel Image',
    description: 'Generates a final image prompt for a single storyboard panel.',
    entryPath: 'src/lib/workers/handlers/panel-image-task-handler.ts',
    stages: [
      {
        id: 'generate-panel-image',
        title: 'Generate Panel Image Prompt',
        description: 'Uses storyboard text plus style parameters to create the image prompt.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_SINGLE_PANEL_IMAGE)],
      },
    ],
  },
  {
    id: 'shot-prompt-edit',
    title: 'Shot Prompt Edit',
    description: 'Refines an existing shot image prompt using user instructions and asset references.',
    entryPath: 'src/lib/workers/handlers/shot-ai-prompt-shot.ts',
    stages: [
      {
        id: 'edit-shot-prompt',
        title: 'Edit Shot Prompt',
        description: 'Rewrites the current image prompt while preserving relevant production context.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_IMAGE_PROMPT_MODIFY)],
      },
    ],
  },
  {
    id: 'video-prompt-generation',
    title: 'Video Prompt Generation',
    description: 'Builds a single-shot video prompt from panel context, asset presets, timing, and user direction.',
    entryPath: 'src/lib/workers/handlers/shot-ai-video-prompt.ts',
    stages: [
      {
        id: 'generate-video-prompt',
        title: 'Generate Video Prompt',
        description: 'Rewrites or creates a motion-ready video prompt while preserving the current panel context.',
        mode: 'sequential',
        targets: [prompt(PROMPT_IDS.NP_VIDEO_PROMPT_GENERATE)],
      },
    ],
  },
  {
    id: 'assistant-api-config',
    title: 'Assistant: API Config Template',
    description: 'Supplies the system prompt used by the API configuration assistant.',
    entryPath: 'src/lib/assistant-platform/skills/api-config-template.ts',
    stages: [
      {
        id: 'assistant-system-prompt',
        title: 'Assistant System Prompt',
        description: 'This system prompt defines how the assistant guides API template configuration.',
        mode: 'sequential',
        targets: [assistant('api-config-template')],
      },
    ],
  },
  {
    id: 'assistant-tutorial',
    title: 'Assistant: Tutorial',
    description: 'Supplies the system prompt used by the tutorial assistant skill.',
    entryPath: 'src/lib/assistant-platform/skills/tutorial.ts',
    stages: [
      {
        id: 'assistant-system-prompt',
        title: 'Assistant System Prompt',
        description: 'This system prompt defines the tutorial assistant behavior.',
        mode: 'sequential',
        targets: [assistant('tutorial')],
      },
    ],
  },
]

const PROMPT_CONSUMERS: Record<string, PromptCenterConsumer[]> = {
  [buildTargetId(prompt(PROMPT_IDS.CHARACTER_IMAGE_TO_DESCRIPTION))]: [
    {
      id: 'reference-to-character-image-analysis',
      title: 'Reference Image Analysis Worker',
      description: 'Analyzes uploaded reference images before character-sheet prompt generation.',
      sourcePath: 'src/lib/workers/handlers/reference-to-character.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.CHARACTER_REFERENCE_TO_SHEET))]: [
    {
      id: 'reference-to-character-sheet-builder',
      title: 'Reference To Character Worker',
      description: 'Builds the final character-sheet prompt after image analysis completes.',
      sourcePath: 'src/lib/workers/handlers/reference-to-character.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_ACTING_DIRECTION))]: [
    {
      id: 'script-to-storyboard-acting',
      title: 'Script To Storyboard Worker',
      description: 'Loads this prompt as the acting-direction phase in the storyboard pipeline.',
      sourcePath: 'src/lib/workers/handlers/script-to-storyboard.ts',
      kind: 'worker-handler',
    },
    {
      id: 'storyboard-phases-acting',
      title: 'Storyboard Phases Helper',
      description: 'Shared storyboard phase runner also uses this acting-direction template.',
      sourcePath: 'src/lib/storyboard-phases.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_CHARACTER_PROFILE))]: [
    {
      id: 'story-to-script-character-profile',
      title: 'Story To Script Worker',
      description: 'Uses this prompt to extract character profiles before clip generation.',
      sourcePath: 'src/lib/workers/handlers/story-to-script.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-global-character-profile',
      title: 'Analyze Global Prompt Loader',
      description: 'Loads this prompt as part of the global asset analysis set.',
      sourcePath: 'src/lib/workers/handlers/analyze-global-prompt.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-novel-character-profile',
      title: 'Analyze Novel Worker',
      description: 'Builds a character extraction request directly from novel content.',
      sourcePath: 'src/lib/workers/handlers/analyze-novel.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_CHARACTER_VISUAL))]: [
    {
      id: 'character-visual-worker',
      title: 'Character Profile Worker',
      description: 'Transforms confirmed character profile JSON into a visual-generation prompt.',
      sourcePath: 'src/lib/workers/handlers/character-profile.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_CINEMATOGRAPHER))]: [
    {
      id: 'script-to-storyboard-cinematographer',
      title: 'Script To Storyboard Worker',
      description: 'Loads this prompt as the camera and cinematography phase.',
      sourcePath: 'src/lib/workers/handlers/script-to-storyboard.ts',
      kind: 'worker-handler',
    },
    {
      id: 'storyboard-phases-cinematographer',
      title: 'Storyboard Phases Helper',
      description: 'Shared storyboard phase runner also uses this cinematography template.',
      sourcePath: 'src/lib/storyboard-phases.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_CLIP))]: [
    {
      id: 'story-to-script-clip',
      title: 'Story To Script Worker',
      description: 'Uses this prompt after asset analysis to split story text into clip units.',
      sourcePath: 'src/lib/workers/handlers/story-to-script.ts',
      kind: 'worker-handler',
    },
    {
      id: 'clips-build-worker',
      title: 'Clips Build Worker',
      description: 'Standalone clip builder also invokes this prompt directly.',
      sourcePath: 'src/lib/workers/handlers/clips-build.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_ANALYSIS))]: [
    {
      id: 'shot-variant-analysis-worker',
      title: 'Shot Variant Analysis Worker',
      description: 'Breaks down the current panel into variant-ready attributes.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-variants.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_SHOT_VARIANT_GENERATE))]: [
    {
      id: 'panel-variant-generator',
      title: 'Panel Variant Worker',
      description: 'Generates the final variant prompt from analyzed shot inputs.',
      sourcePath: 'src/lib/workers/handlers/panel-variant-task-handler.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_DETAIL))]: [
    {
      id: 'script-to-storyboard-detail',
      title: 'Script To Storyboard Worker',
      description: 'Uses this prompt to enrich storyboard panels after planning and direction.',
      sourcePath: 'src/lib/workers/handlers/script-to-storyboard.ts',
      kind: 'worker-handler',
    },
    {
      id: 'storyboard-phases-detail',
      title: 'Storyboard Phases Helper',
      description: 'Shared storyboard phase runner also uses this detail template.',
      sourcePath: 'src/lib/storyboard-phases.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_INSERT))]: [
    {
      id: 'storyboard-insert-worker',
      title: 'Text Worker Insert Panel Flow',
      description: 'Builds a new storyboard panel between previous and next panel context.',
      sourcePath: 'src/lib/workers/text.worker.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AGENT_STORYBOARD_PLAN))]: [
    {
      id: 'script-to-storyboard-plan',
      title: 'Script To Storyboard Worker',
      description: 'Loads this prompt for the first storyboard planning phase.',
      sourcePath: 'src/lib/workers/handlers/script-to-storyboard.ts',
      kind: 'worker-handler',
    },
    {
      id: 'storyboard-phases-plan',
      title: 'Storyboard Phases Helper',
      description: 'Shared storyboard phase runner also uses this planning template.',
      sourcePath: 'src/lib/storyboard-phases.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_AI_STORY_EXPAND))]: [
    {
      id: 'story-expand-worker',
      title: 'AI Story Expand Worker',
      description: 'Generates an expanded story draft from the initial user input.',
      sourcePath: 'src/lib/workers/handlers/ai-story-expand.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_CHARACTER_CREATE))]: [
    {
      id: 'asset-design-character-create',
      title: 'Asset Design Utility',
      description: 'Uses this prompt when the design request targets a character asset.',
      sourcePath: 'src/lib/asset-utils/ai-design.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_CHARACTER_DESCRIPTION_UPDATE))]: [
    {
      id: 'modify-description-character',
      title: 'Modify Description Sync',
      description: 'Applies image-guided edits to an existing character description.',
      sourcePath: 'src/lib/workers/handlers/modify-description-sync.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_CHARACTER_MODIFY))]: [
    {
      id: 'asset-hub-character-modify',
      title: 'Asset Hub AI Modify Worker',
      description: 'Uses this prompt for direct character description edits from the asset hub.',
      sourcePath: 'src/lib/workers/handlers/asset-hub-ai-modify.ts',
      kind: 'worker-handler',
    },
    {
      id: 'shot-character-modify',
      title: 'Shot Prompt Appearance Worker',
      description: 'Rewrites character appearance wording while editing shot prompts.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-prompt-appearance.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_EPISODE_SPLIT))]: [
    {
      id: 'episode-split-worker',
      title: 'Episode Split Worker',
      description: 'Splits long-form content into episode sections before later processing.',
      sourcePath: 'src/lib/workers/handlers/episode-split.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_IMAGE_PROMPT_MODIFY))]: [
    {
      id: 'shot-prompt-edit-worker',
      title: 'Shot Prompt Edit Worker',
      description: 'Refines an existing shot image prompt using edit instructions and asset context.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-prompt-shot.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_VIDEO_PROMPT_GENERATE))]: [
    {
      id: 'video-prompt-generation-worker',
      title: 'Video Prompt Generation Worker',
      description: 'Builds motion-ready panel video prompts from panel facts, asset presets, and user requirements.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-video-prompt.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_LOCATION_CREATE))]: [
    {
      id: 'asset-design-location-create',
      title: 'Asset Design Utility',
      description: 'Uses this prompt when the design request targets a location asset.',
      sourcePath: 'src/lib/asset-utils/ai-design.ts',
      kind: 'workflow-helper',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_LOCATION_DESCRIPTION_UPDATE))]: [
    {
      id: 'modify-description-location',
      title: 'Modify Description Sync',
      description: 'Applies image-guided edits to an existing location description.',
      sourcePath: 'src/lib/workers/handlers/modify-description-sync.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_LOCATION_MODIFY))]: [
    {
      id: 'asset-hub-location-modify',
      title: 'Asset Hub AI Modify Worker',
      description: 'Uses this prompt for direct location description edits from the asset hub.',
      sourcePath: 'src/lib/workers/handlers/asset-hub-ai-modify.ts',
      kind: 'worker-handler',
    },
    {
      id: 'shot-location-modify',
      title: 'Shot Prompt Location Worker',
      description: 'Rewrites location wording while editing shot prompts.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-prompt-location.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_PROP_DESCRIPTION_UPDATE))]: [
    {
      id: 'asset-hub-prop-modify',
      title: 'Asset Hub AI Modify Worker',
      description: 'Uses this prompt when prop descriptions are edited from the asset hub.',
      sourcePath: 'src/lib/workers/handlers/asset-hub-ai-modify.ts',
      kind: 'worker-handler',
    },
    {
      id: 'modify-description-prop',
      title: 'Modify Description Sync',
      description: 'Applies image-guided edits to an existing prop description.',
      sourcePath: 'src/lib/workers/handlers/modify-description-sync.ts',
      kind: 'worker-handler',
    },
    {
      id: 'shot-prop-modify',
      title: 'Shot Prompt Prop Worker',
      description: 'Rewrites prop wording while editing shot prompts.',
      sourcePath: 'src/lib/workers/handlers/shot-ai-prompt-prop.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_SCREENPLAY_CONVERSION))]: [
    {
      id: 'story-to-script-screenplay',
      title: 'Story To Script Worker',
      description: 'Uses this prompt to convert clip content into screenplay output.',
      sourcePath: 'src/lib/workers/handlers/story-to-script.ts',
      kind: 'worker-handler',
    },
    {
      id: 'screenplay-convert-worker',
      title: 'Screenplay Convert Worker',
      description: 'Standalone screenplay conversion flow also invokes this prompt directly.',
      sourcePath: 'src/lib/workers/handlers/screenplay-convert.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_SELECT_PROP))]: [
    {
      id: 'story-to-script-select-prop',
      title: 'Story To Script Worker',
      description: 'Extracts prop candidates as part of the story-to-script asset analysis stage.',
      sourcePath: 'src/lib/workers/handlers/story-to-script.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-global-select-prop',
      title: 'Analyze Global Prompt Loader',
      description: 'Loads this prompt inside the global asset analysis set.',
      sourcePath: 'src/lib/workers/handlers/analyze-global-prompt.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-novel-select-prop',
      title: 'Analyze Novel Worker',
      description: 'Builds a prop extraction request directly from novel content.',
      sourcePath: 'src/lib/workers/handlers/analyze-novel.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_SELECT_LOCATION))]: [
    {
      id: 'story-to-script-select-location',
      title: 'Story To Script Worker',
      description: 'Extracts location candidates as part of the story-to-script asset analysis stage.',
      sourcePath: 'src/lib/workers/handlers/story-to-script.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-global-select-location',
      title: 'Analyze Global Prompt Loader',
      description: 'Loads this prompt inside the global asset analysis set.',
      sourcePath: 'src/lib/workers/handlers/analyze-global-prompt.ts',
      kind: 'worker-handler',
    },
    {
      id: 'analyze-novel-select-location',
      title: 'Analyze Novel Worker',
      description: 'Builds a location extraction request directly from novel content.',
      sourcePath: 'src/lib/workers/handlers/analyze-novel.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_SINGLE_PANEL_IMAGE))]: [
    {
      id: 'panel-image-worker',
      title: 'Panel Image Worker',
      description: 'Generates a single-panel image prompt from storyboard JSON and style inputs.',
      sourcePath: 'src/lib/workers/handlers/panel-image-task-handler.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(prompt(PROMPT_IDS.NP_VOICE_ANALYSIS))]: [
    {
      id: 'script-to-storyboard-voice',
      title: 'Script To Storyboard Worker',
      description: 'Uses this prompt at the end of the storyboard pipeline to analyze voice direction.',
      sourcePath: 'src/lib/workers/handlers/script-to-storyboard.ts',
      kind: 'worker-handler',
    },
    {
      id: 'voice-analyze-worker',
      title: 'Voice Analyze Worker',
      description: 'Standalone voice analysis flow also invokes this prompt directly.',
      sourcePath: 'src/lib/workers/handlers/voice-analyze.ts',
      kind: 'worker-handler',
    },
  ],
  [buildTargetId(assistant('api-config-template'))]: [
    {
      id: 'assistant-api-config-skill',
      title: 'API Config Assistant Skill',
      description: 'Binds this system prompt to the api-config-template assistant runtime.',
      sourcePath: 'src/lib/assistant-platform/skills/api-config-template.ts',
      kind: 'assistant-skill',
    },
    {
      id: 'assistant-api-config-ui',
      title: 'Provider Card UI Hook',
      description: 'Starts assistant chat with the api-config-template assistant from provider settings.',
      sourcePath: 'src/app/[locale]/profile/components/api-config/provider-card/hooks/useProviderCardState.ts',
      kind: 'ui-hook',
    },
  ],
  [buildTargetId(assistant('tutorial'))]: [
    {
      id: 'assistant-tutorial-skill',
      title: 'Tutorial Assistant Skill',
      description: 'Binds this system prompt to the tutorial assistant runtime.',
      sourcePath: 'src/lib/assistant-platform/skills/tutorial.ts',
      kind: 'assistant-skill',
    },
  ],
}

const FAMILY_BY_TARGET = new Map<string, PromptFamilyDefinition>()
for (const family of PROMPT_FAMILIES) {
  for (const target of family.targets) {
    FAMILY_BY_TARGET.set(buildTargetId(target), family)
  }
}

const WORKFLOWS_BY_TARGET = new Map<string, PromptWorkflowDefinition[]>()
for (const workflow of PROMPT_WORKFLOWS) {
  for (const stage of workflow.stages) {
    for (const target of stage.targets) {
      const id = buildTargetId(target)
      const current = WORKFLOWS_BY_TARGET.get(id) || []
      current.push(workflow)
      WORKFLOWS_BY_TARGET.set(id, current)
    }
  }
}

function resolveTargetEntry(target: PromptRelationTarget, locale?: PromptLocale) {
  if (target.kind === 'assistant-system') {
    return findPromptCenterAssistantEntry(target.promptId)
  }
  if (!locale) return null
  return findPromptCenterPromptI18nEntry(target.promptId, locale)
}

function toRelatedItem(entry: PromptCenterRegistryEntry): PromptCenterRelatedItem {
  return {
    key: entry.key,
    title: entry.title,
    promptId: String(entry.promptId),
    locale: entry.locale,
    kind: entry.kind,
    sourcePath: entry.sourcePath,
  }
}

function resolveRelatedItem(target: PromptRelationTarget, locale?: PromptLocale) {
  const entry = resolveTargetEntry(target, locale)
  return entry ? toRelatedItem(entry) : null
}

function dedupeRelatedItems(items: PromptCenterRelatedItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.key)) return false
    seen.add(item.key)
    return true
  })
}

function excludeRelatedItems(items: PromptCenterRelatedItem[], excludedKeys: Set<string>) {
  return items.filter((item) => !excludedKeys.has(item.key))
}

export function buildPromptCenterRelationships(entry: PromptCenterRegistryEntry): PromptCenterRelationships {
  const currentTarget = getEntryTarget(entry)
  const targetId = buildTargetId(currentTarget)
  const locale = entry.kind === 'prompt-i18n' ? entry.locale : undefined
  const family = FAMILY_BY_TARGET.get(targetId)
  const workflows = WORKFLOWS_BY_TARGET.get(targetId) || []

  const upstreamItems: PromptCenterRelatedItem[] = []
  const parallelItems: PromptCenterRelatedItem[] = []
  const downstreamItems: PromptCenterRelatedItem[] = []

  const workflowDetails: PromptCenterWorkflow[] = workflows.map((workflow) => {
    const currentStageIndex = workflow.stages.findIndex((stage) =>
      stage.targets.some((target) => isSameTarget(target, currentTarget)),
    )

    const stages = workflow.stages.map((stage, index) => {
      const prompts = stage.targets
        .map((target) => resolveRelatedItem(target, locale))
        .filter((item): item is PromptCenterRelatedItem => item !== null)

      if (index < currentStageIndex) {
        upstreamItems.push(...prompts)
      } else if (index === currentStageIndex) {
        parallelItems.push(...prompts.filter((item) => item.key !== entry.key))
      } else if (index > currentStageIndex) {
        downstreamItems.push(...prompts)
      }

      return {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        mode: stage.mode,
        prompts,
        containsCurrent: index === currentStageIndex,
      }
    })

    return {
      id: workflow.id,
      title: workflow.title,
      description: workflow.description,
      entryPath: workflow.entryPath,
      stages,
    }
  })

  const dedupedUpstream = dedupeRelatedItems(upstreamItems)
  const dedupedParallel = dedupeRelatedItems(parallelItems)
  const dedupedDownstream = dedupeRelatedItems(downstreamItems)

  const familyItems = family
    ? family.targets
      .filter((target) => !isSameTarget(target, currentTarget))
      .map((target) => resolveRelatedItem(target, locale))
      .filter((item): item is PromptCenterRelatedItem => item !== null)
    : []

  const excludedFamilyKeys = new Set([
    ...dedupedUpstream.map((item) => item.key),
    ...dedupedParallel.map((item) => item.key),
    ...dedupedDownstream.map((item) => item.key),
  ])

  return {
    familyId: family?.id || (entry.kind === 'assistant-system' ? 'assistant-system' : 'unclassified'),
    familyTitle: family?.title || (entry.kind === 'assistant-system' ? 'Assistant Prompt' : 'Prompt Group'),
    familyDescription: family?.description || 'No additional family metadata is defined for this prompt yet.',
    upstream: dedupedUpstream,
    parallel: dedupedParallel,
    downstream: dedupedDownstream,
    sameFamily: excludeRelatedItems(dedupeRelatedItems(familyItems), excludedFamilyKeys),
    consumers: PROMPT_CONSUMERS[targetId] || [],
    workflows: workflowDetails,
  }
}
