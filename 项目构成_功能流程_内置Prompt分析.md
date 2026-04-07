# 当前项目构成、功能流程与内置 Prompt 分析

## 1. 项目定位

从代码结构和数据模型看，这个项目本质上是一套 **AI 小说推文 / 短剧视频生产工作台**。它不是单点的“文生图”或“文生视频”工具，而是把以下几类能力串成了一条生产线：

- 输入小说原文、梗概或片段，创建项目和分集
- 用 AI 扩写故事、智能拆分章节 / 集数
- 分析角色、场景、道具等素材
- 把故事拆成 clip，再转成结构化 screenplay
- 从 screenplay 继续生成 storyboard / panel / shot
- 基于分镜生成图片、视频、配音、口型同步
- 提供全局素材库，复用角色 / 场景 / 道具 / 声线
- 提供任务队列、运行流、事件流和失败重试机制

可以把它理解为：**面向小说改编短视频 / 漫改视频 / 推文视频的 AI 生产平台**。

---

## 2. 项目整体构成

## 2.1 技术栈概览

从 `package.json` 和 `src` 目录可见，当前项目采用的是一套典型的全栈 Web 架构：

- 前端：Next.js 15、React 19、Tailwind CSS 4、Radix UI
- 服务端：Next.js App Router API Routes
- 数据层：Prisma + MySQL / PostgreSQL 风格 ORM 模型
- 异步任务：BullMQ + Redis
- 鉴权与用户：NextAuth
- 国际化：next-intl
- 多模型接入：OpenAI 兼容网关、Gemini、OpenRouter、Ark、Bailian、MiniMax、Fal、SiliconFlow 等
- 媒体能力：图片、视频、音频、Lip Sync、Remotion 编辑器
- 运行治理：Task Runtime + Graph Run Runtime + SSE / 流式事件

这说明它不是“纯前端 Demo”，而是一个带完整后台任务体系、模型配置体系和持久化数据结构的生产型项目。

## 2.2 顶层目录职责

根目录主要可以分成几块：

- `src/app`
  - Next.js 页面与 API 路由，承担 UI 页面、项目页、工作台页、用户配置页和各类接口入口
- `src/components`
  - 通用 UI 组件、输入组件、任务展示组件、语音相关组件等
- `src/features`
  - 偏业务型的大功能模块，目前最明显的是视频编辑器
- `src/lib`
  - 项目核心业务逻辑所在，包括生成器、工作流、运行时、任务处理器、Prompt 系统、素材处理等
- `prisma`
  - 数据模型定义，能直接看出项目的业务对象与关系
- `lib/prompts`
  - 内置 Prompt 模板，区分中英文版本
- `messages`
  - UI 国际化文案
- `tests`
  - 单测、集成测试、系统测试、回归测试、契约测试等
- `scripts`
  - 守护、检查、构建和校验脚本

## 2.3 核心业务模块分层

从代码职责看，可以抽成下面这几层：

### 1) 页面与交互层

主要在：

- `src/app/[locale]/home`
- `src/app/[locale]/workspace`
- `src/app/[locale]/workspace/[projectId]`
- `src/app/[locale]/workspace/asset-hub`
- `src/app/[locale]/profile`

这一层负责：

- 项目创建、项目列表
- 工作台阶段切换
- 资产库管理
- 模型 / API 配置
- 任务进度和运行状态展示

### 2) 业务编排层

主要在：

- `src/lib/novel-promotion`
- `src/app/[locale]/workspace/[projectId]/modes/novel-promotion`
- `src/lib/home`

这一层负责：

- 把“故事 -> 剧本 -> 分镜 -> 视频 / 配音”串成统一工作流
- 定义阶段导航、自动运行、状态就绪判断
- 管理项目内素材与全局素材的协同

### 3) Prompt 与 LLM 调用层

主要在：

- `src/lib/prompt-i18n`
- `lib/prompts/novel-promotion`
- `lib/prompts/character-reference`
- `src/lib/assistant-platform`

这一层负责：

- 加载 Prompt 模板
- 根据语言切换中英文 Prompt
- 组装变量并渲染最终 Prompt
- 支撑业务工作流 Prompt 和助手类系统 Prompt

### 4) 任务与运行时层

主要在：

- `src/lib/task`
- `src/lib/workers`
- `src/lib/run-runtime`
- `src/lib/workflow-engine`

这一层负责：

- 提交异步任务
- 消费任务队列
- 维护 run / step / event / artifact
- 做取消、重试、恢复和依赖失效传播

### 5) 模型与生成器适配层

主要在：

- `src/lib/generators`
- `src/lib/generator-api.ts`
- `src/lib/model-gateway`
- `src/lib/providers`

这一层负责：

- 按能力路由到不同服务商
- 屏蔽图片 / 视频 / 音频供应商差异
- 支持官方模式和 OpenAI 兼容模式

### 6) 数据与资产层

主要在：

- `prisma/schema.prisma`
- `src/lib/assets`
- `src/lib/storage`
- `src/lib/media`

这一层负责：

- 持久化项目、分集、分镜、镜头、配音、素材
- 保存媒体文件、引用图、生成结果
- 支撑项目级资产和全局素材库

---

## 3. 数据模型反映出的业务能力

`prisma/schema.prisma` 基本上把产品能力全暴露出来了。核心对象如下。

## 3.1 项目与分集

- `Project`
- `NovelPromotionProject`
- `NovelPromotionEpisode`

说明项目支持：

- 用户创建多个项目
- 每个项目下有多个 episode
- 每个 episode 绑定原始小说文本或导入文本

## 3.2 故事拆解与分镜

- `NovelPromotionClip`
- `NovelPromotionStoryboard`
- `NovelPromotionPanel`
- `NovelPromotionShot`

说明项目支持：

- 先把故事拆成 clip
- 每个 clip 下生成 storyboard
- storyboard 下有多个 panel
- shot 级别可以继续扩展镜头信息

## 3.3 角色 / 场景 / 素材

- `NovelPromotionCharacter`
- `CharacterAppearance`
- `NovelPromotionLocation`
- `LocationImage`
- `MediaObject`

说明项目支持：

- 角色的人设和视觉描述
- 场景及场景图
- 角色多套形象 / 参考图
- 各类媒体对象统一管理

## 3.4 配音与音色

- `NovelPromotionVoiceLine`
- `VoicePreset`
- `GlobalVoice`

说明项目支持：

- 从故事 / 分镜分析出台词
- 绑定说话角色、情绪、强度
- 保存音色预设并复用

## 3.5 全局资产库

- `GlobalAssetFolder`
- `GlobalCharacter`
- `GlobalCharacterAppearance`
- `GlobalLocation`
- `GlobalLocationImage`

说明项目除了“项目内资产”外，还支持一个 **跨项目复用的全局素材库**。

## 3.6 任务与运行治理

- `Task`
- `TaskEvent`
- `GraphRun`
- `GraphStep`
- `GraphStepAttempt`
- `GraphEvent`
- `GraphCheckpoint`
- `GraphArtifact`

说明项目不是简单同步调用模型，而是：

- 有独立任务队列
- 有运行图和步骤级记录
- 有产物归档
- 有失败重试与依赖回滚

## 3.7 计费与资源消耗

- `UserBalance`
- `BalanceFreeze`
- `BalanceTransaction`
- `UsageCost`

说明平台已经考虑到了商业化或内部成本结算。

---

## 4. 当前支持的主要功能点

下面按用户真实使用路径来归纳。

## 4.1 首页快速创建项目

入口：

- `src/app/[locale]/home/page.tsx`
- `src/lib/home/create-project-launch.ts`
- `src/lib/home/ai-story-expand.ts`

支持能力：

- 直接输入故事文本创建项目
- 选择视频比例 `videoRatio`
- 选择美术风格 `artStyle`
- “AI 帮我写”先扩写故事，再落到项目
- 创建项目后自动创建首集，并跳转工作台
- 可带 `autoRun=storyToScript` 自动触发首轮流程

结论：这是一个 **快速开片入口**，目的是把用户尽快送进生产流程。

## 4.2 工作台与阶段式生产

主入口：

- `src/app/[locale]/workspace/[projectId]/page.tsx`
- `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/NovelPromotionWorkspace.tsx`

当前主流程阶段大致是：

- `config`
- `script`
- `storyboard`
- `videos`
- `voice`
- `editor`（代码里存在，但主导航里标记为 coming soon）

其中当前真正接入主舞台渲染的阶段是：

- `config`
- `script`
- `storyboard`
- `videos`
- `voice`

说明：

- 项目已经有较完整的生产链路
- 视频编辑器能力已经开发到一定程度，但暂未完全开放为主路径

## 4.3 分集导入与智能拆分

关键模块：

- `SmartImportWizard`
- `episodes/split-by-markers`
- `episodes/split`
- `episodes/batch`

支持能力：

- 输入长篇文本后自动检测章节 / 分集标记
- 如果能识别明显 marker，则按 marker 无 AI 拆分
- 如果 marker 不明显，则走 LLM 拆分
- 批量创建多个 episode
- 导入后可继续分析资产

这块说明产品考虑过真实小说文本通常很长，不能只靠“手动新建单集”。

## 4.4 故事转剧本 Story to Script

关键接口 / 处理器：

- `story-to-script-stream`
- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/story-to-script/orchestrator.ts`

这一阶段实际做的事情很多，不只是“生成剧本”：

- 分析角色
- 分析场景
- 分析道具
- 拆分 clip
- 把 clip 转成结构化 screenplay

所以更准确地说，这一步是：

**把原始故事文本转成“可继续生产”的结构化中间层。**

## 4.5 项目资产分析与生成

关键模块：

- `analyze-novel.ts`
- `analyze-global.ts`
- `asset-utils/ai-design.ts`
- `character-profile.ts`
- `reference-to-character.ts`

支持能力：

- 从文本中抽取角色 / 场景 / 道具
- 基于描述生成角色设定
- 基于确认的人设生成视觉外观描述
- 基于参考图提炼角色描述
- 从参考角色继续生成角色三视图 / 形象图
- 对全局素材库做项目级统一分析

这说明素材系统不是纯手填，而是支持“文本抽取 + AI 设计 + 图参考回流”三种来源。

## 4.6 Script to Storyboard 分镜生成

关键接口 / 处理器：

- `script-to-storyboard-stream`
- `src/lib/workers/handlers/script-to-storyboard.ts`
- `src/lib/novel-promotion/script-to-storyboard/orchestrator.ts`

当前分镜生成是分阶段的：

### Phase 1: 分镜规划

- 先确定每个 clip 拆成多少 panel
- 每个 panel 的剧情推进点是什么

### Phase 2: 影视化强化

- 一条链负责摄影 / 镜头语言
- 一条链负责表演 / 动作指令

### Phase 3: 细化成最终分镜

- 输出更完整的 panel 文本
- 生成更适合图像 / 视频生成的描述字段

### 附带 voice analysis

- 可顺手把对白、说话人、情绪也一起提出来

这部分是整个产品最核心的“内容加工中枢”。

## 4.7 分镜编辑与镜头级微调

关键模块：

- `components/storyboard/index.tsx`
- `text.worker.ts`
- `storyboard-prompt-mutations.ts`

支持能力：

- 编辑 panel 文案
- 添加 panel
- 插入 panel
- 删除 panel
- 删除 storyboard
- 调整 panel 顺序或分组
- 重新生成 storyboard 文本
- AI 分析镜头变体
- AI 修改 shot prompt
- 选择角色 / 场景绑定到镜头
- 查看候选图、确认或取消候选图

这说明系统并不是“一键生成后不能改”，而是支持 **分镜级人工介入**。

## 4.8 单镜头图片生成

关键模块：

- `panel-image-task-handler.ts`
- `NP_SINGLE_PANEL_IMAGE`

支持能力：

- 基于 panel 当前上下文生成图片
- 自动拼入角色描述、场景描述、镜头信息、表演指令、摄影规则
- 支持多候选图
- 支持保留旧图、挑选候选图
- 支持生成前后的描述同步

这里的关键不是“能出图”，而是 **Prompt 组装上下文很完整**，已经明显偏向生产工具而不是简单玩具。

## 4.9 Shot Prompt AI 修改与镜头变体

关键模块：

- `shot-ai-prompt-shot.ts`
- `shot-ai-variants.ts`
- `panel-variant-task-handler.ts`

支持能力：

- 根据用户一句话要求修改当前镜头 prompt
- 根据当前 panel 图像分析可替代镜头方案
- 生成镜头变体图

这块属于 **镜头导演台** 能力，解决的是“初稿可用，但不够理想”的问题。

## 4.10 视频生成与视频阶段

关键模块：

- `video-stage-runtime-core.tsx`
- 视频任务相关 worker 与 mutation

从运行时代码可以确认，视频阶段支持：

- 按 panel 生成视频
- 批量选择视频模型
- 本地编辑 / 保存视频 prompt
- 下载全部视频
- 首尾帧相关流程
- Lip Sync 流程
- 语音与 panel 的联动

说明视频阶段已经不是单一“生成按钮”，而是带批处理和联动能力。

## 4.11 配音与语音阶段

关键模块：

- `voice-stage-runtime`
- `voice-analyze.ts`

支持能力：

- 从故事 / 分镜分析出台词
- 识别说话角色
- 提取情绪和强度
- 生成 voice lines
- 绑定角色声线 / 音色
- 播放和管理台词

这意味着系统能把“剧情层”延伸到“声音层”。

## 4.12 资产库 Asset Hub

入口：

- `src/app/[locale]/workspace/asset-hub/page.tsx`

支持能力：

- 统一管理角色 / 场景 / 道具 / 声线
- 文件夹分类
- 新建和编辑素材
- 图片编辑
- AI 修改描述
- 语音设计
- 素材下载

这块是对“项目工作台”的补充，适合先建设素材宇宙，再服务多个项目复用。

## 4.13 模型与 API 配置

关键模块：

- `src/app/[locale]/profile/page.tsx`
- `src/app/api/user/api-config/route.ts`

支持能力：

- 配置各类服务商密钥
- 配置默认模型
- 配置各能力默认 provider / model
- 配置并发限制
- 支持自定义 OpenAI-compatible / Gemini-compatible provider

当前可见接入面覆盖：

- LLM
- Image
- Video
- Audio
- Lip Sync

说明系统设计目标是 **多供应商能力编排平台**，而不是某一家模型的绑定前端。

## 4.14 内置助手能力

关键模块：

- `src/lib/assistant-platform`
- `src/app/api/user/assistant/chat/route.ts`

当前已看到的助手技能主要是：

- `api-config-template`
- `tutorial`

作用更偏向：

- 教用户配置 OpenAI 兼容媒体模型模板
- 提供教程 / 指导类回答

## 4.15 已实现但未完全接线的能力

从代码看，有一些模块已经存在，但不属于当前主路径：

- `PromptsStage`
- Prompt 编辑相关页面与组件
- `editor` 视频编辑器阶段
- `NP_CHARACTER_REGENERATE`
- `NP_LOCATION_REGENERATE`
- `NP_STORYBOARD_EDIT`

这说明项目还在演进中，有一部分能力属于：

- 已开发
- 半接线
- 预留给后续版本

---

## 5. 主功能流程如何串通

这部分是项目最关键的分析。

## 5.1 用户主链路

用户最典型的一条路径是：

1. 在首页输入故事梗概或正文
2. 可选“AI 帮我写”扩写
3. 创建项目与首集
4. 跳转到 workspace，并自动触发 `storyToScript`
5. 系统分析角色 / 场景 / 道具，并拆分 clip、生成 screenplay
6. 用户进入 `script` 阶段检查结果
7. 继续触发 `scriptToStoryboard`
8. 系统生成 storyboard / panels / 摄影 / 表演 / 细化描述 / 可选台词
9. 用户在 `storyboard` 阶段逐镜头调整
10. 基于 panel 生成图片或镜头变体
11. 进入 `videos` 阶段生成视频、编辑视频 prompt、做 lip sync
12. 进入 `voice` 阶段生成人声、绑定音色
13. 后续进入编辑器做最终编排（代码已具备基础，但主入口未完全开放）

这条链路非常清晰：  
**故事文本 -> 结构化剧本 -> 结构化分镜 -> 媒体生成 -> 后期编辑**

## 5.2 首页创建到项目落地的串接

由 `create-project-launch.ts` 可知，这一步实际串了三次 API：

1. `POST /api/projects`
   - 先创建基础项目
2. `PATCH /api/novel-promotion/{projectId}`
   - 保存视频比例和风格
3. `POST /api/novel-promotion/{projectId}/episodes`
   - 创建第一集并写入小说文本

然后跳转：

- `/workspace/{projectId}?episode={episodeId}&autoRun=storyToScript`

也就是说：

- 首页只是入口
- 真正的工作流从 workspace 才开始
- `autoRun` 参数是把“创建”和“首次 AI 生产”串起来的关键

## 5.3 Smart Import 的串接方式

长文导入时，流程大致是：

1. 用户贴入长文本
2. 系统先尝试检测章节 marker
3. 若 marker 明确，则直接按 marker 切段
4. 若 marker 不明确，则提交 `EPISODE_SPLIT_LLM`
5. LLM 返回分集边界后，批量创建 episode
6. 后续可以继续触发资产分析和分镜生产

所以 Smart Import 的目的不是替代主流程，而是把“超长文本整理成多个可生产单元”。

## 5.4 Story to Script 的内部串接

`story-to-script.ts` 的内部逻辑基本可以概括为：

1. 读取当前 episode 文本
2. 用角色 Prompt 分析角色
3. 用场景 Prompt 分析 locations
4. 用道具 Prompt 分析 props
5. 用 clip Prompt 拆分故事段落
6. 对每个 clip 用 screenplay Prompt 转换成结构化剧本
7. 保存中间产物、步骤事件和 artifact

这里的关键点：

- 它先产出“结构化中间层”
- 后面的 storyboard、voice、video 都依赖这个中间层

所以 story-to-script 是整个工作流的第一条核心骨架。

## 5.5 Script to Storyboard 的内部串接

`script-to-storyboard.ts` 则是第二条核心骨架，步骤更像“多 agent 协作”：

1. phase1：先做 storyboard plan
2. phase2-cine：补摄影和镜头语言
3. phase2-acting：补动作和表演指令
4. phase3：合并细化成最终 panel 描述
5. voice analysis：可选提取对白与情绪
6. 持久化 storyboard、panel、voiceLine

所以这个项目的 storyboard 不是一步 Prompt 直接吐完，而是：

**规划 -> 镜头语言 -> 表演 -> 细化 -> 语音分析**

这使得结果更适合继续做图片 / 视频 / 配音。

## 5.6 分镜到图片 / 视频 / 配音的串接

panel 生成完成后，后续链路大致分三支：

### 支路 A：图片

- panel 的上下文被组装成 `NP_SINGLE_PANEL_IMAGE`
- 生成多候选图
- 用户挑选候选图并固化结果

### 支路 B：视频

- 使用 panel 的图像 / prompt / 镜头信息
- 选择视频模型
- 可做 lip sync、首尾帧等扩展

### 支路 C：配音

- 根据 `NP_VOICE_ANALYSIS` 先拿到台词结构
- 再在 voice 阶段做声音生成和绑定

所以 panel 是内容生产线里的核心分叉点。

## 5.7 项目资产与全局资产的串接

资产体系是双层的：

### 项目资产

- 服务单个项目当前故事
- 跟随 episode / clip / storyboard 使用

### 全局资产

- 存在 `asset-hub`
- 可跨项目复用
- 支持统一设计角色 / 场景 / 音色

这意味着用户既可以：

- 先写故事再抽资产

也可以：

- 先建设素材宇宙，再套进多个项目

## 5.8 UI、API、Worker、Run Runtime 的串接

这套项目真正成熟的地方，在于它不是把模型调用直接写在按钮事件里，而是用了完整的异步运行结构：

### 第一步：前端触发 API

例如：

- `story-to-script-stream`
- `script-to-storyboard-stream`

### 第二步：API 提交任务 / run

接口不直接重活计算，而是：

- 创建 run
- 提交任务
- 绑定 runId

### 第三步：BullMQ Worker 执行

Worker 按任务类型取出任务，执行对应 handler。

### 第四步：Run Runtime 记录过程

运行过程中会记录：

- step
- event
- artifact
- checkpoint
- 尝试次数

### 第五步：前端订阅流式状态

UI 通过 stream / SSE 拿到进度、日志和完成状态，再刷新页面数据。

这套机制的价值在于：

- 长任务可视化
- 可重试
- 可取消
- 可回放运行痕迹
- 有中间产物，便于调试和治理

---

## 6. 内置 Prompt 系统怎么组织

当前项目里有两类 Prompt 系统。

## 6.1 业务 Prompt 系统

主要代码：

- `src/lib/prompt-i18n/catalog.ts`
- `src/lib/prompt-i18n/prompt-ids.ts`
- `src/lib/prompt-i18n/template-store.ts`
- `src/lib/prompt-i18n/build-prompt.ts`

对应模板目录：

- `lib/prompts/novel-promotion`
- `lib/prompts/character-reference`

特点：

- 每个 Prompt 有一个稳定的 `PromptId`
- 模板文件按 `zh` / `en` 区分
- 支持变量声明和模板渲染
- 运行前会校验模板变量是否匹配 catalog

这套系统的作用是：  
**让业务 Prompt 成为可维护、可国际化、可回归测试的工程资产。**

## 6.2 助手系统 Prompt

主要代码：

- `src/lib/assistant-platform/system-prompts.ts`
- `src/lib/assistant-platform/registry.ts`

对应模板目录：

- `lib/prompts/skills`

特点：

- 用于平台内置 AI 助手
- 更偏“教程 / 配置助理 / 工具助理”
- 不直接参与 story-to-script 这类主生产链

---

## 7. 内置 Prompt 清单与用途

下面按实际代码使用情况逐个说明。

## 7.1 角色参考与形象类

### `CHARACTER_IMAGE_TO_DESCRIPTION`

位置：

- `lib/prompts/character-reference/character-image-to-description.{zh,en}.txt`

用途：

- 把角色参考图转成文字外观描述
- 用于从图反推角色视觉特征

调用位置：

- `src/lib/workers/handlers/reference-to-character.ts`

### `CHARACTER_REFERENCE_TO_SHEET`

位置：

- `lib/prompts/character-reference/character-reference-to-sheet.{zh,en}.txt`

用途：

- 把角色参考信息进一步整理成“角色设定图 / 三视图 / 角色板”的生成指令

调用位置：

- `src/lib/workers/handlers/reference-to-character.ts`

### `NP_AGENT_CHARACTER_PROFILE`

位置：

- `lib/prompts/novel-promotion/agent-character-profile.{zh,en}.txt`

用途：

- 从故事文本里抽取角色档案
- 生成结构化人设信息

调用位置：

- `src/lib/workers/handlers/analyze-novel.ts`
- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/global/analyze-global-prompt.ts`

### `NP_AGENT_CHARACTER_VISUAL`

位置：

- `lib/prompts/novel-promotion/agent-character-visual.{zh,en}.txt`

用途：

- 把确认后的人设信息转成更适合视觉生成的角色外观描述

调用位置：

- `src/lib/workers/handlers/character-profile.ts`

### `NP_CHARACTER_CREATE`

位置：

- `lib/prompts/novel-promotion/character-create.{zh,en}.txt`

用途：

- 用户在资产库中输入角色设计需求后，生成结构化角色设计描述

调用位置：

- `src/lib/asset-utils/ai-design.ts`

### `NP_CHARACTER_MODIFY`

位置：

- `lib/prompts/novel-promotion/character-modify.{zh,en}.txt`

用途：

- 基于已有角色描述，按用户指令做增量修改

调用位置：

- `src/lib/workers/handlers/asset-hub-ai-modify.ts`
- `src/lib/workers/handlers/shot-ai-prompt-appearance.ts`

### `NP_CHARACTER_DESCRIPTION_UPDATE`

位置：

- `lib/prompts/novel-promotion/character-description-update.{zh,en}.txt`

用途：

- 当角色图经过编辑或参考图变化后，同步更新角色文字描述

调用位置：

- `src/lib/workers/handlers/modify-description-sync.ts`

### `NP_CHARACTER_REGENERATE`

位置：

- `lib/prompts/novel-promotion/character-regenerate.{zh,en}.txt`

用途：

- 从命名看，目标是重生成人物描述或重建角色设定

当前状态：

- 已注册到 Prompt catalog
- 目前未检索到主流程中的实际调用
- 更像预留 / 历史 Prompt

## 7.2 场景与道具类

### `NP_SELECT_LOCATION`

位置：

- `lib/prompts/novel-promotion/select-location.{zh,en}.txt`

用途：

- 从故事文本中提取和筛选场景

调用位置：

- `src/lib/workers/handlers/analyze-novel.ts`
- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/global/analyze-global-prompt.ts`

### `NP_LOCATION_CREATE`

位置：

- `lib/prompts/novel-promotion/location-create.{zh,en}.txt`

用途：

- 根据用户描述生成场景设计信息

调用位置：

- `src/lib/asset-utils/ai-design.ts`

### `NP_LOCATION_MODIFY`

位置：

- `lib/prompts/novel-promotion/location-modify.{zh,en}.txt`

用途：

- 对已有场景描述进行 AI 修改

调用位置：

- `src/lib/workers/handlers/asset-hub-ai-modify.ts`
- `src/lib/workers/handlers/shot-ai-prompt-location.ts`

### `NP_LOCATION_DESCRIPTION_UPDATE`

位置：

- `lib/prompts/novel-promotion/location-description-update.{zh,en}.txt`

用途：

- 在图片编辑后，反向同步更新场景描述

调用位置：

- `src/lib/workers/handlers/modify-description-sync.ts`

### `NP_LOCATION_REGENERATE`

位置：

- `lib/prompts/novel-promotion/location-regenerate.{zh,en}.txt`

用途：

- 从命名看是用于重新生成场景描述或设定

当前状态：

- 已注册
- 目前未检索到主流程实际调用

### `NP_SELECT_PROP`

位置：

- `lib/prompts/novel-promotion/select-prop.{zh,en}.txt`

用途：

- 从故事中提取和筛选道具

调用位置：

- `src/lib/workers/handlers/analyze-novel.ts`
- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/global/analyze-global-prompt.ts`

### `NP_PROP_DESCRIPTION_UPDATE`

位置：

- `lib/prompts/novel-promotion/prop-description-update.{zh,en}.txt`

用途：

- 更新道具描述
- 在一些路径里也承担道具 AI 修改 Prompt 的作用

调用位置：

- `src/lib/workers/handlers/modify-description-sync.ts`
- `src/lib/workers/handlers/asset-hub-ai-modify.ts`
- `src/lib/workers/handlers/shot-ai-prompt-prop.ts`

## 7.3 故事拆解与剧本类

### `NP_AI_STORY_EXPAND`

位置：

- `lib/prompts/novel-promotion/ai-story-expand.{zh,en}.txt`

用途：

- 在首页“AI 帮我写”场景下，把一个简短创意扩写成更完整故事

调用位置：

- `src/lib/home/ai-story-expand.ts`

### `NP_EPISODE_SPLIT`

位置：

- `lib/prompts/novel-promotion/episode-split.{zh,en}.txt`

用途：

- 把长文本智能拆成多个 episode

调用位置：

- `src/lib/workers/handlers/episode-split.ts`

### `NP_AGENT_CLIP`

位置：

- `lib/prompts/novel-promotion/agent-clip.{zh,en}.txt`

用途：

- 把故事文本拆成 clip 级别的结构单元

调用位置：

- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/story-to-script/clips-build.ts`

### `NP_SCREENPLAY_CONVERSION`

位置：

- `lib/prompts/novel-promotion/screenplay-conversion.{zh,en}.txt`

用途：

- 把 clip 内容转换成结构化 screenplay

调用位置：

- `src/lib/workers/handlers/story-to-script.ts`
- `src/lib/novel-promotion/story-to-script/screenplay-convert.ts`

## 7.4 分镜规划与镜头细化类

### `NP_AGENT_STORYBOARD_PLAN`

位置：

- `lib/prompts/novel-promotion/agent-storyboard-plan.{zh,en}.txt`

用途：

- story-to-script 之后的第一阶段分镜规划
- 决定一个 clip 如何切成多个 panel

调用位置：

- `src/lib/workers/handlers/script-to-storyboard.ts`

### `NP_AGENT_CINEMATOGRAPHER`

位置：

- `lib/prompts/novel-promotion/agent-cinematographer.{zh,en}.txt`

用途：

- 给分镜补摄影机语言、景别、机位和画面组织方式

调用位置：

- `src/lib/workers/handlers/script-to-storyboard.ts`

### `NP_AGENT_ACTING_DIRECTION`

位置：

- `lib/prompts/novel-promotion/agent-acting-direction.{zh,en}.txt`

用途：

- 给分镜补动作和表演指令

调用位置：

- `src/lib/workers/handlers/script-to-storyboard.ts`

### `NP_AGENT_STORYBOARD_DETAIL`

位置：

- `lib/prompts/novel-promotion/agent-storyboard-detail.{zh,en}.txt`

用途：

- 汇总前面几个阶段的结果，输出更完整的最终 panel 描述

调用位置：

- `src/lib/workers/handlers/script-to-storyboard.ts`

### `NP_AGENT_STORYBOARD_INSERT`

位置：

- `lib/prompts/novel-promotion/agent-storyboard-insert.{zh,en}.txt`

用途：

- 在已有 panel 前后文之间插入新的镜头

调用位置：

- `src/lib/workers/text.worker.ts`

### `NP_STORYBOARD_EDIT`

位置：

- `lib/prompts/novel-promotion/storyboard-edit.{zh,en}.txt`

用途：

- 从命名看，目标是 AI 编辑已有 storyboard 文本

当前状态：

- Prompt 已存在
- 当前主流程里未检索到明确调用
- 更像预留给 Prompt Stage 或后续编辑面板

## 7.5 镜头 Prompt、图片生成与镜头变体类

### `NP_SINGLE_PANEL_IMAGE`

位置：

- `lib/prompts/novel-promotion/single-panel-image.{zh,en}.txt`

用途：

- 把单个 panel 的完整上下文拼装成最终图片生成 Prompt

上下文通常包括：

- panel 文本
- 镜头信息
- 角色外观
- 场景信息
- 表演和摄影规则
- 原始故事片段

调用位置：

- `src/lib/workers/handlers/panel-image-task-handler.ts`

### `NP_IMAGE_PROMPT_MODIFY`

位置：

- `lib/prompts/novel-promotion/image-prompt-modify.{zh,en}.txt`

用途：

- 用户给一句修改指令后，重写当前镜头的 image / video prompt

调用位置：

- `src/lib/workers/handlers/shot-ai-prompt-shot.ts`

### `NP_AGENT_SHOT_VARIANT_ANALYSIS`

位置：

- `lib/prompts/novel-promotion/agent-shot-variant-analysis.{zh,en}.txt`

用途：

- 分析当前镜头还能如何换角度、换镜头方案、换表现方式

调用位置：

- `src/lib/workers/handlers/shot-ai-variants.ts`

### `NP_AGENT_SHOT_VARIANT_GENERATE`

位置：

- `lib/prompts/novel-promotion/agent-shot-variant-generate.{zh,en}.txt`

用途：

- 在用户选定一种变体方向后，生成对应变体的最终 Prompt / 图像结果

调用位置：

- `src/lib/workers/handlers/panel-variant-task-handler.ts`

## 7.6 配音分析类

### `NP_VOICE_ANALYSIS`

位置：

- `lib/prompts/novel-promotion/voice-analysis.{zh,en}.txt`

用途：

- 从故事 / 剧本 / 分镜中抽取台词
- 识别角色、说话内容、情绪、强度、所属 panel

调用位置：

- `src/lib/workers/handlers/script-to-storyboard.ts`
- `src/lib/workers/handlers/voice-analyze.ts`

## 7.7 助手系统 Prompt

### `api-config-template.system.txt`

位置：

- `lib/prompts/skills/api-config-template.system.txt`

用途：

- 指导内置助手帮助用户配置 OpenAI-compatible 媒体模型模板

调用位置：

- `src/lib/assistant-platform/skills/api-config-template.ts`

### `tutorial.system.txt`

位置：

- `lib/prompts/skills/tutorial.system.txt`

用途：

- 平台教程型助手 Prompt

调用位置：

- `src/lib/assistant-platform/skills/tutorial.ts`

---

## 8. Prompt 体系的实际价值

这个项目的 Prompt 不是零散字符串，而是被工程化管理了。价值主要有四点：

## 8.1 Prompt 被业务解耦了

- 业务代码不直接内嵌长 Prompt
- Prompt 模板独立放在 `lib/prompts`
- 更容易维护、对比和迭代

## 8.2 Prompt 支持多语言

- 同一个 PromptId 可映射到 `zh` / `en`
- 工作流结果天然支持中英文生产语境

## 8.3 Prompt 被纳入校验和回归体系

从脚本可以看到项目专门有：

- `check:prompt-i18n`
- `check:prompt-i18n-regression`
- `check:prompt-ab-regression`
- `check:prompt-json-canary`

说明 Prompt 已经被视作核心生产资产，而不是“随手改的文案”。

## 8.4 Prompt 与工作流步骤是一一对应的

尤其是主链路里，几乎每个阶段都有专门 Prompt：

- 角色分析
- 场景分析
- 道具分析
- clip 切分
- screenplay 转换
- 分镜规划
- 摄影强化
- 表演强化
- 分镜细化
- 图像 Prompt 改写
- 镜头变体分析
- 台词分析

这也是为什么这个项目的工作流可控性比“一次性大 Prompt 全吐”更高。

---

## 9. 当前项目的整体判断

综合代码结构、数据模型、任务系统和 Prompt 体系，可以得出几个结论。

## 9.1 它已经不是 Demo，而是生产型工作台

依据：

- 有完整数据库模型
- 有任务队列和运行图
- 有多阶段工作流
- 有素材库和用户配置
- 有测试和 Prompt 校验脚本

## 9.2 核心竞争力在“结构化中间层”

不是简单地输入一句话直接出视频，而是先构建：

- clip
- screenplay
- storyboard
- panel
- voice line

这个中间层使它能支持编辑、重试、局部再生成和多媒体联动。

## 9.3 角色 / 场景 / 分镜 / 视频 / 配音已经形成闭环

也就是说，当前产品主线已经具备：

- 文本输入
- 资产抽取
- 剧本生成
- 分镜生成
- 图片 / 视频 / 配音生产

这是一个完整闭环，而不是散点功能集合。

## 9.4 编辑器和 Prompt 编辑台是下一步可强化点

目前能看到：

- 编辑器能力存在
- Prompt Stage 能力存在
- 但主导航未完全开放

这通常意味着项目已经完成主生产链，正在往“更强人工控制”和“更强后期编排”演进。

---

## 10. 一句话总结

这个项目是一套以 **小说文本为起点**、以 **结构化剧本与分镜为中枢**、以 **图片 / 视频 / 配音生成** 为落点，并由 **任务运行时 + Prompt 工程体系 + 全局素材库** 支撑的 AI 视频内容生产平台。

