type PromptDisplayText = {
  title: string
  summary: string
  feature: string
}

type PromptDisplayLocale = 'zh' | 'en'

type PromptDisplayEntry = {
  zh: PromptDisplayText
  en: PromptDisplayText
}

const PROMPT_DISPLAY_CATALOG: Record<string, PromptDisplayEntry> = {
  character_image_to_description: {
    zh: {
      title: '角色参考图解析',
      summary: '把参考图片解析成可编辑的角色描述，供后续角色设定或角色图生成使用。',
      feature: '角色参考图',
    },
    en: {
      title: 'Character Reference Analysis',
      summary: 'Analyzes a reference image into an editable character description for later character setup or image generation.',
      feature: 'Character Reference',
    },
  },
  character_reference_to_sheet: {
    zh: {
      title: '角色设定图生成提示词',
      summary: '基于角色描述组装角色设定图或角色立绘提示词。',
      feature: '角色参考图',
    },
    en: {
      title: 'Character Sheet Prompt',
      summary: 'Builds the final character-sheet prompt from a character description.',
      feature: 'Character Reference',
    },
  },
  np_agent_acting_direction: {
    zh: {
      title: '分镜表演调度',
      summary: '为每个镜头补充角色动作、表情和表演指令。',
      feature: '剧本转分镜',
    },
    en: {
      title: 'Acting Direction',
      summary: 'Adds character actions, expressions, and performance notes to each storyboard shot.',
      feature: 'Script To Storyboard',
    },
  },
  np_agent_character_profile: {
    zh: {
      title: '角色档案提取',
      summary: '从故事文本中抽取角色档案、关系和关键设定。',
      feature: '故事转剧本 / 全局分析',
    },
    en: {
      title: 'Character Profile Extraction',
      summary: 'Extracts character profiles, relationships, and key settings from story text.',
      feature: 'Story To Script / Global Analysis',
    },
  },
  np_agent_character_visual: {
    zh: {
      title: '角色视觉描述',
      summary: '把结构化角色档案转成可用于出图的视觉描述。',
      feature: '角色资产',
    },
    en: {
      title: 'Character Visual Prompt',
      summary: 'Turns structured character profile data into a visual description for image generation.',
      feature: 'Character Assets',
    },
  },
  np_agent_cinematographer: {
    zh: {
      title: '分镜摄影设计',
      summary: '为每个镜头补充景别、机位、镜头运动和摄影语言。',
      feature: '剧本转分镜',
    },
    en: {
      title: 'Cinematography Design',
      summary: 'Adds shot size, camera position, movement, and cinematography language to each panel.',
      feature: 'Script To Storyboard',
    },
  },
  np_agent_clip: {
    zh: {
      title: '片段拆分',
      summary: '把长文本拆成可执行的剧情片段，为后续剧本转换做准备。',
      feature: '故事转剧本',
    },
    en: {
      title: 'Clip Breakdown',
      summary: 'Splits long-form story text into executable clips before screenplay conversion.',
      feature: 'Story To Script',
    },
  },
  np_agent_shot_variant_analysis: {
    zh: {
      title: '镜头变体分析',
      summary: '分析当前镜头的构图和拍法，提炼变体所需的控制要素。',
      feature: '镜头变体',
    },
    en: {
      title: 'Shot Variant Analysis',
      summary: 'Analyzes the current shot composition and camera language before generating variants.',
      feature: 'Shot Variants',
    },
  },
  np_agent_shot_variant_generate: {
    zh: {
      title: '镜头变体生成',
      summary: '根据变体目标生成新的镜头描述和出图提示词。',
      feature: '镜头变体',
    },
    en: {
      title: 'Shot Variant Generation',
      summary: 'Generates a new shot description and image prompt from the target variant goals.',
      feature: 'Shot Variants',
    },
  },
  np_agent_storyboard_detail: {
    zh: {
      title: '分镜细化',
      summary: '在已有分镜规划基础上补齐画面细节、场景信息和镜头描述。',
      feature: '剧本转分镜',
    },
    en: {
      title: 'Storyboard Detail',
      summary: 'Fills in scene detail, visual cues, and shot descriptions after storyboard planning.',
      feature: 'Script To Storyboard',
    },
  },
  np_agent_storyboard_insert: {
    zh: {
      title: '插帧分镜',
      summary: '根据前后镜头和用户指令插入一个新的中间分镜。',
      feature: '分镜编辑',
    },
    en: {
      title: 'Storyboard Insert',
      summary: 'Inserts a new middle panel from surrounding storyboard context and user instructions.',
      feature: 'Storyboard Editing',
    },
  },
  np_agent_storyboard_plan: {
    zh: {
      title: '分镜规划',
      summary: '先按剧情节奏把剧本规划成一组初版分镜。',
      feature: '剧本转分镜',
    },
    en: {
      title: 'Storyboard Planning',
      summary: 'Creates the first-pass storyboard structure from screenplay pacing and asset context.',
      feature: 'Script To Storyboard',
    },
  },
  np_ai_story_expand: {
    zh: {
      title: '故事扩写',
      summary: '把简短故事梗概扩写成更完整的剧情文本。',
      feature: '故事预处理',
    },
    en: {
      title: 'Story Expansion',
      summary: 'Expands a short story idea into a fuller narrative draft.',
      feature: 'Story Prep',
    },
  },
  np_character_create: {
    zh: {
      title: '角色创建',
      summary: '根据用户输入生成初版角色描述，用于角色资产创建。',
      feature: '角色资产',
    },
    en: {
      title: 'Character Creation',
      summary: 'Generates a first-pass character description from user input.',
      feature: 'Character Assets',
    },
  },
  np_character_description_update: {
    zh: {
      title: '角色描述更新',
      summary: '结合修改指令和参考图，对已有角色描述做定向更新。',
      feature: '角色资产',
    },
    en: {
      title: 'Character Description Update',
      summary: 'Applies targeted character-description updates using edit instructions and optional image context.',
      feature: 'Character Assets',
    },
  },
  np_character_modify: {
    zh: {
      title: '角色提示词修改',
      summary: '在保留角色主体设定的前提下，重写角色描述或外观提示词。',
      feature: '角色资产 / 镜头编辑',
    },
    en: {
      title: 'Character Prompt Modify',
      summary: 'Rewrites character descriptions or appearance prompts while preserving the core character setup.',
      feature: 'Character Assets / Shot Editing',
    },
  },
  np_character_regenerate: {
    zh: {
      title: '角色重生成',
      summary: '在已有角色基础上重新生成一版新的角色描述。',
      feature: '角色资产',
    },
    en: {
      title: 'Character Regenerate',
      summary: 'Regenerates a fresh character description from an existing character baseline.',
      feature: 'Character Assets',
    },
  },
  np_episode_split: {
    zh: {
      title: '章节拆分',
      summary: '把长篇文本拆分为章节或集数，便于后续逐段处理。',
      feature: '故事预处理',
    },
    en: {
      title: 'Episode Split',
      summary: 'Splits long-form content into chapters or episodes for later processing.',
      feature: 'Story Prep',
    },
  },
  np_image_prompt_modify: {
    zh: {
      title: '镜头提示词修改',
      summary: '针对单个镜头现有图像提示词做定向重写。',
      feature: '镜头编辑',
    },
    en: {
      title: 'Shot Prompt Modify',
      summary: 'Performs targeted rewrites on an existing image prompt for a single shot.',
      feature: 'Shot Editing',
    },
  },
  np_video_prompt_generate: {
    zh: {
      title: '视频提示词生成',
      summary: '根据镜头文案、静态提示词、时长和用户要求，生成可直接用于视频模型的连续运动提示词。',
      feature: '视频生成',
    },
    en: {
      title: 'Video Prompt Generation',
      summary: 'Builds a motion-ready video prompt from shot context, static prompt, duration, and user direction.',
      feature: 'Video Generation',
    },
  },
  np_location_create: {
    zh: {
      title: '场景创建',
      summary: '根据用户输入生成初版场景描述，用于场景资产创建。',
      feature: '场景资产',
    },
    en: {
      title: 'Location Creation',
      summary: 'Generates a first-pass location description from user input.',
      feature: 'Location Assets',
    },
  },
  np_location_description_update: {
    zh: {
      title: '场景描述更新',
      summary: '结合修改指令和参考图，对已有场景描述做定向更新。',
      feature: '场景资产',
    },
    en: {
      title: 'Location Description Update',
      summary: 'Applies targeted location-description updates using edit instructions and optional image context.',
      feature: 'Location Assets',
    },
  },
  np_location_modify: {
    zh: {
      title: '场景提示词修改',
      summary: '在保留场景主体设定的前提下，重写场景描述或画面提示词。',
      feature: '场景资产 / 镜头编辑',
    },
    en: {
      title: 'Location Prompt Modify',
      summary: 'Rewrites location descriptions or scene prompts while preserving the core setting.',
      feature: 'Location Assets / Shot Editing',
    },
  },
  np_location_regenerate: {
    zh: {
      title: '场景重生成',
      summary: '在已有场景基础上重新生成一版新的场景描述。',
      feature: '场景资产',
    },
    en: {
      title: 'Location Regenerate',
      summary: 'Regenerates a fresh location description from an existing baseline.',
      feature: 'Location Assets',
    },
  },
  np_prop_description_update: {
    zh: {
      title: '道具描述更新',
      summary: '更新道具描述，用于道具资产或镜头内元素调整。',
      feature: '道具资产 / 镜头编辑',
    },
    en: {
      title: 'Prop Description Update',
      summary: 'Updates prop descriptions for asset management or shot-level element adjustments.',
      feature: 'Prop Assets / Shot Editing',
    },
  },
  np_screenplay_conversion: {
    zh: {
      title: '剧情转剧本',
      summary: '把片段内容转换成结构化剧本，供后续分镜使用。',
      feature: '故事转剧本',
    },
    en: {
      title: 'Screenplay Conversion',
      summary: 'Converts clip content into structured screenplay output for downstream storyboard work.',
      feature: 'Story To Script',
    },
  },
  np_select_prop: {
    zh: {
      title: '道具提取',
      summary: '从文本中筛选和归纳需要出现的道具。',
      feature: '故事转剧本 / 全局分析',
    },
    en: {
      title: 'Prop Extraction',
      summary: 'Selects and summarizes the props that need to appear from source text.',
      feature: 'Story To Script / Global Analysis',
    },
  },
  np_select_location: {
    zh: {
      title: '场景提取',
      summary: '从文本中筛选和归纳需要出现的场景。',
      feature: '故事转剧本 / 全局分析',
    },
    en: {
      title: 'Location Extraction',
      summary: 'Selects and summarizes the locations that need to appear from source text.',
      feature: 'Story To Script / Global Analysis',
    },
  },
  np_single_panel_image: {
    zh: {
      title: '单镜头出图提示词',
      summary: '根据单个分镜的结构化信息生成最终出图提示词。',
      feature: '分镜出图',
    },
    en: {
      title: 'Single Panel Image Prompt',
      summary: 'Builds the final image prompt from a single storyboard panel and its structured context.',
      feature: 'Storyboard Image',
    },
  },
  np_storyboard_edit: {
    zh: {
      title: '分镜整体编辑',
      summary: '用于整体修改某段分镜内容或重新组织分镜表达。',
      feature: '分镜编辑',
    },
    en: {
      title: 'Storyboard Edit',
      summary: 'Edits a storyboard block at a higher level or reorganizes how the storyboard is expressed.',
      feature: 'Storyboard Editing',
    },
  },
  np_voice_analysis: {
    zh: {
      title: '台词与声线分析',
      summary: '从剧情和分镜中分析人物台词、声线和配音方向。',
      feature: '配音分析',
    },
    en: {
      title: 'Voice Analysis',
      summary: 'Analyzes dialogue, voice tone, and dubbing direction from story and storyboard context.',
      feature: 'Voice Analysis',
    },
  },
  'api-config-template': {
    zh: {
      title: 'API 配置助手',
      summary: '内置助手系统提示词，用来指导用户生成和保存 API 模板配置。',
      feature: 'API 配置',
    },
    en: {
      title: 'API Config Assistant',
      summary: 'Built-in assistant system prompt that guides users through generating and saving API template settings.',
      feature: 'API Configuration',
    },
  },
  tutorial: {
    zh: {
      title: '教程助手',
      summary: '内置助手系统提示词，用来输出平台使用教程或引导说明。',
      feature: '引导教程',
    },
    en: {
      title: 'Tutorial Assistant',
      summary: 'Built-in assistant system prompt that provides tutorial and onboarding guidance.',
      feature: 'Tutorial',
    },
  },
}

function normalizeLocale(locale: string): PromptDisplayLocale {
  return locale.startsWith('zh') ? 'zh' : 'en'
}

export function getPromptDisplayText(
  promptId: string,
  locale: string,
  fallbackTitle?: string,
): PromptDisplayText {
  const entry = PROMPT_DISPLAY_CATALOG[promptId]
  if (!entry) {
    return {
      title: fallbackTitle || promptId,
      summary: locale.startsWith('zh')
        ? '当前提示词暂未补充用途说明。'
        : 'No localized usage note has been added for this prompt yet.',
      feature: locale.startsWith('zh') ? '未分类功能点' : 'Unclassified Feature',
    }
  }
  return entry[normalizeLocale(locale)]
}
