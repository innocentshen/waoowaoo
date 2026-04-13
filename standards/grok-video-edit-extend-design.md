# Grok Video Edit / Extend Technical Design

## 1. Background

Current novel-promotion video generation is modeled as two product-visible modes:

- `normal`: generate a video from the current panel image
- `firstlastframe`: generate a transition video from the current panel image to the next panel image

This matches the current runtime and worker assumptions:

- the video worker always starts from `panel.imageUrl`
- candidate metadata only distinguishes `normal` and `firstlastframe`
- the viewer can only "regenerate" from image inputs

However, Grok already supports video editing and extension at the API level:

- image-to-video: `POST /v1/videos/generations`
- video edit: `POST /v1/videos/edits`
- video extend: `POST /v1/videos/extensions`

Relevant xAI constraints from the official docs:

- edit keeps the input video's duration / aspect ratio / resolution, capped at 720p
- edit input video must be `.mp4`, max input length 8.7s
- extend input video must be `.mp4`, input duration 2-15s
- extend `duration` means added duration only, allowed range 2-10s

Official references:

- https://docs.x.ai/developers/model-capabilities/video/generation

This document defines the V1 product and technical design for adding:

- `Edit Current Video`
- `Extend Current Video`

The design is intentionally scoped to fit the current panel/candidate architecture.

## 2. Goals

### V1 goals

- Add video edit / extend as operations on an existing panel video candidate
- Keep the main panel card workflow unchanged when a panel has no video yet
- Reuse the existing candidate viewer instead of creating a new workspace or modal stack
- Keep all outputs inside the current panel's candidate list
- Minimize schema churn; avoid Prisma migration in V1 if possible
- Implement Grok official provider first

### Non-goals

- Batch edit / batch extend
- Upload arbitrary external videos into the video stage
- Cross-panel source video selection
- Auto-overwrite the selected panel video after edit / extend
- Provider parity for all vendors in V1
- Support for `openai-compatible::grok-imagine-1.0-video` in V1 unless its template path is separately verified

## 3. Product UX

## 3.1 Entry point

- If a panel has no generated video: keep the current UI unchanged
- If a panel has one or more video candidates: the user opens the existing candidate viewer
- The selected candidate in the viewer becomes the source video for edit / extend

Why this is the right entry point:

- the user always knows which video version is being edited
- candidate lineage stays local to the panel
- no new global source-video picker is needed

## 3.2 Candidate viewer layout

Upgrade the existing right-side "regenerate" block in the viewer into a mode switch:

- `Re-generate`
- `Edit`
- `Extend`

Behavior by tab:

- `Re-generate`
  - existing behavior
  - if panel is linked, keep first-last-frame flow
  - otherwise regenerate from panel image
- `Edit`
  - source is the currently selected viewer candidate
  - prompt field becomes an edit instruction field
  - model list only shows models that support `edit`
- `Extend`
  - source is the currently selected viewer candidate
  - prompt field describes what happens next
  - duration field represents added duration only
  - model list only shows models that support `extend`

## 3.3 Form details

### Re-generate tab

- Keep existing prompt editor behavior
- Keep current model capability dropdown behavior
- Keep current generate count selector

### Edit tab

Fields:

- `Source video`
  - read-only
  - example: `Candidate 2 · 6s · current`
- `Edit instruction`
  - textarea
  - not persisted into panel `videoPrompt`
- `Model`
  - only `generationModeOptions` containing `edit`
- `Advanced options`
  - collapsed by default
  - no duration/aspect ratio/resolution controls for Grok

Primary CTA:

- `Generate Edited Version`

Validation:

- source candidate must exist
- instruction must be non-empty
- source video length must satisfy provider constraints if known

### Extend tab

Fields:

- `Source video`
  - read-only
- `Continuation instruction`
  - textarea
- `Added duration`
  - options: `2s / 4s / 6s / 8s / 10s`
  - default `6s`
- `Model`
  - only `generationModeOptions` containing `extend`

Primary CTA:

- `Generate Extended Version`

Validation:

- source candidate must exist
- instruction must be non-empty
- added duration must be within the model capability range

## 3.4 Result behavior

Both edit and extend outputs are appended as new candidates on the same panel.

They never auto-replace the currently selected panel video.

New candidate labels:

- `Normal`
- `First/Last Frame`
- `Edit`
- `Extend`

Viewer metadata should display:

- generation mode
- model
- source candidate
- added duration for extend

If the source candidate is no longer resolvable, show a degraded label:

- `Source candidate unavailable`

## 3.5 Prompt persistence

Panel-level prompts remain:

- `videoPrompt`
- `firstLastFramePrompt`

Edit / extend instructions are not panel prompts. They are operation drafts only.

V1 rule:

- store edit / extend drafts in client runtime state only
- do not write them back to `NovelPromotionPanel`

Rationale:

- panel prompt describes the shot itself
- edit / extend instruction describes a one-off transformation
- mixing them will make regeneration semantics ambiguous

## 4. Capability model

## 4.1 Generation mode enum

Extend the runtime union from:

```ts
type VideoGenerationMode = 'normal' | 'firstlastframe'
```

to:

```ts
type VideoGenerationMode = 'normal' | 'firstlastframe' | 'edit' | 'extend'
```

Affected areas:

- UI types
- candidate metadata
- panel `videoGenerationMode`
- task policy / billing metadata

## 4.2 Capability catalog

For V1, only official Grok should advertise the new modes.

Proposed catalog change:

```json
{
  "provider": "grok",
  "modelId": "grok-imagine-video",
  "capabilities": {
    "video": {
      "generationModeOptions": ["normal", "edit", "extend"],
      "durationOptions": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      "resolutionOptions": ["480p", "720p"],
      "firstlastframe": false,
      "supportGenerateAudio": false
    }
  }
}
```

V1 should not change the `openai-compatible::grok-imagine-1.0-video` catalog entry unless its concrete template path for edit / extend is separately verified.

## 4.3 UI filtering rules

Current helper functions are too narrow because they only understand:

- normal
- firstlastframe

Add a generic helper:

```ts
function supportsVideoGenerationMode(model, mode: VideoGenerationMode): boolean
```

Use it to drive:

- panel-card normal regenerate model list
- first-last-frame model list
- candidate viewer edit model list
- candidate viewer extend model list

## 5. Data model

## 5.1 No Prisma migration in V1

V1 should avoid a database migration.

Reasons:

- `videoGenerationMode` is already stored as `String?`
- `videoCandidates` is already stored as JSON string

The required changes can be absorbed at the type and parser layer.

## 5.2 Candidate JSON shape

Current candidate records should be extended, not replaced.

Proposed stored candidate shape:

```ts
interface StoredPanelVideoCandidate {
  id: string
  videoUrl: string
  generationMode: 'normal' | 'firstlastframe' | 'edit' | 'extend'
  createdAt: string
  model?: string | null
  prompt?: string | null
  meta?: {
    sourceCandidateId?: string | null
    sourceGenerationMode?: 'normal' | 'firstlastframe' | 'edit' | 'extend' | null
    extendDuration?: number | null
  } | null
}
```

Notes:

- `prompt` remains generic and stores the submitted edit / extend instruction
- `meta.sourceCandidateId` preserves lineage
- `meta.extendDuration` is only used for `extend`

Existing parser / serializer code must preserve `meta`.

## 5.3 Panel selected mode

`NovelPromotionPanel.videoGenerationMode` should be allowed to hold:

- `normal`
- `firstlastframe`
- `edit`
- `extend`

This is a code-level type expansion only in V1.

## 6. API design

## 6.1 Keep the existing route

Do not add a new route in V1.

Continue using:

- `POST /api/novel-promotion/[projectId]/generate-video`

Reason:

- keeps task, billing, auth, overlay, and invalidation behavior centralized

## 6.2 Request body extension

Keep existing fields for legacy flows:

```json
{
  "storyboardId": "...",
  "panelIndex": 0,
  "videoModel": "grok::grok-imagine-video",
  "generationOptions": {},
  "firstLastFrame": { "...": "..." }
}
```

Add a new optional envelope:

```ts
interface VideoOperationInput {
  mode: 'edit' | 'extend'
  sourceCandidateId: string
  instruction: string
  extendDuration?: number
}
```

Full request body shape:

```ts
interface GenerateVideoRequest {
  storyboardId: string
  panelIndex: number
  videoModel: string
  count?: number
  generationOptions?: Record<string, string | number | boolean>
  firstLastFrame?: {
    lastFrameStoryboardId: string
    lastFramePanelIndex: number
    flModel: string
    customPrompt?: string
  }
  videoOperation?: {
    mode: 'edit' | 'extend'
    sourceCandidateId: string
    instruction: string
    extendDuration?: number
  }
}
```

## 6.3 Validation rules

Request validation:

- `firstLastFrame` and `videoOperation` cannot coexist
- batch generation cannot use `videoOperation`
- `videoOperation.mode=edit`
  - `extendDuration` must be absent
- `videoOperation.mode=extend`
  - `extendDuration` is required
- source candidate must exist on the target panel

Capability validation:

- `generationMode=edit` requires selected model to support `edit`
- `generationMode=extend` requires selected model to support `extend`

Provider validation:

- for Grok edit, reject duration / aspect ratio / resolution overrides
- for Grok extend, allow duration only; reject aspect ratio / resolution overrides

## 7. Worker design

## 7.1 Resolve source input by mode

Refactor `generateVideoForPanel()` into a mode-based flow:

- `normal`
  - source input: panel image
- `firstlastframe`
  - source input: panel image + next panel image
- `edit`
  - source input: source candidate video
- `extend`
  - source input: source candidate video

Proposed intermediate input type:

```ts
type VideoSourceInput =
  | { mode: 'normal'; imageUrl: string; prompt: string }
  | { mode: 'firstlastframe'; imageUrl: string; lastFrameImageUrl: string; prompt: string }
  | { mode: 'edit'; sourceVideoUrl: string; prompt: string }
  | { mode: 'extend'; sourceVideoUrl: string; prompt: string; extendDuration: number }
```

## 7.2 Source candidate resolution

For `edit` and `extend`:

1. load the panel
2. parse `panel.videoCandidates`
3. locate candidate by `sourceCandidateId`
4. convert its stored URL / COS key into a signed URL
5. submit to the provider

Fallback behavior:

- if candidate is missing, fail fast
- do not fall back to current selected `videoUrl`

Reason:

- silent fallback would make the result lineage incorrect

## 7.3 Billing metadata

Current task policy always settles video generation with:

- `generationMode = normal | firstlastframe`
- `containsVideoInput = false`

This must change.

Proposed policy:

- `normal` and `firstlastframe`
  - `containsVideoInput = false`
- `edit` and `extend`
  - `containsVideoInput = true`

The selection object passed into pricing resolution should include:

```ts
{
  generationMode: 'edit' | 'extend',
  containsVideoInput: true
}
```

If a pricing tier for `edit` / `extend` is not defined for a model, route validation should reject the combination before task submission.

## 8. Generator abstraction changes

## 8.1 Problem

Current generic video generator interface assumes every video task starts from an image:

```ts
interface VideoGenerateParams {
  userId: string
  imageUrl: string
  prompt?: string
  options?: GenerateOptions
}
```

That is no longer sufficient.

## 8.2 Proposed shape

Refactor the generic video input contract to support both image and video sources:

```ts
interface VideoGenerateParams {
  userId: string
  imageUrl?: string
  videoUrl?: string
  prompt?: string
  options?: GenerateOptions & {
    generationMode?: 'normal' | 'firstlastframe' | 'edit' | 'extend'
  }
}
```

Contract rules:

- `normal` requires `imageUrl`
- `firstlastframe` requires `imageUrl` and `lastFrameImageUrl`
- `edit` requires `videoUrl`
- `extend` requires `videoUrl` and `duration`

This is the cleanest long-term direction and should be implemented instead of faking edit / extend through image-only APIs.

## 8.3 Worker utility refactor

`resolveVideoSourceFromGeneration()` should accept:

```ts
{
  userId: string
  modelId: string
  imageUrl?: string
  videoUrl?: string
  options?: {
    prompt?: string
    duration?: number
    resolution?: string
    aspectRatio?: string
    generateAudio?: boolean
    lastFrameImageUrl?: string
    generationMode?: 'normal' | 'firstlastframe' | 'edit' | 'extend'
  }
}
```

Capability resolution should use the explicit `generationMode`.

Provider-specific request options should strip unsupported fields by mode.

## 9. Grok provider design

## 9.1 Official Grok routes

V1 provider routing:

- `normal`
  - `POST /videos/generations`
  - body may include `image`, `prompt`, `duration`, `aspect_ratio`, `resolution`
- `edit`
  - `POST /videos/edits`
  - body should include `video_url` and `prompt`
- `extend`
  - `POST /videos/extensions`
  - body should include `video: { url }`, `prompt`, `duration`

This endpoint split should be explicit in `src/lib/providers/grok/video.ts`.

## 9.2 Option rules by mode

### normal

Allowed:

- `prompt`
- `duration`
- `resolution`
- `aspectRatio`
- `imageUrl`

Rejected:

- `lastFrameImageUrl`
- `videoUrl`

### edit

Allowed:

- `prompt`
- `videoUrl`

Rejected:

- `duration`
- `resolution`
- `aspectRatio`
- `lastFrameImageUrl`
- `imageUrl`

### extend

Allowed:

- `prompt`
- `videoUrl`
- `duration`

Rejected:

- `resolution`
- `aspectRatio`
- `lastFrameImageUrl`
- `imageUrl`

## 9.3 Model scope

V1 implementation target:

- `provider = grok`
- `modelId = grok-imagine-video`

Do not broaden V1 to openai-compatible Grok until the concrete template format for edit / extend is confirmed.

## 10. Frontend implementation map

## 10.1 Types

Update:

- `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/types.ts`
- `src/lib/novel-promotion/video-candidates.ts`
- `src/types/project.ts`

Changes:

- extend `VideoGenerationMode`
- extend candidate metadata to preserve `meta`

## 10.2 Candidate viewer

Primary implementation file:

- `src/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/VideoCandidateTimeline.tsx`

Changes:

- add tab state for `regenerate | edit | extend`
- add edit / extend form blocks
- add source candidate metadata display
- add model filtering by mode
- keep current regenerate flow untouched

## 10.3 Runtime draft state

Add a new lightweight runtime hook:

- `useVideoOperationDrafts`

Suggested shape:

```ts
type VideoOperationDraftMode = 'edit' | 'extend'

interface VideoOperationDraft {
  instruction: string
  extendDuration?: number
  model?: string
  generationOptions?: Record<string, string | number | boolean>
}
```

Storage key:

- `panelKey + mode`

This state should live above `VideoCandidateTimeline` so drafts survive viewer close/reopen within the page session.

## 10.4 Query hook

Extend:

- `src/lib/query/hooks/useStoryboards.ts`

Changes:

- allow `videoOperation`
- keep existing legacy payload behavior

## 10.5 Route

Extend:

- `src/app/api/novel-promotion/[projectId]/generate-video/route.ts`

Changes:

- parse `videoOperation`
- derive mode from `videoOperation` before capability validation
- reject invalid combinations
- reject batch usage

## 10.6 Worker

Extend:

- `src/lib/workers/video.worker.ts`
- `src/lib/workers/utils.ts`

Changes:

- resolve candidate video source
- route by generation mode
- submit `containsVideoInput = true` for edit / extend flows

## 10.7 Provider

Extend:

- `src/lib/providers/grok/video.ts`
- `src/lib/generators/grok.ts`
- `src/lib/generators/base.ts`
- `src/lib/generator-api.ts`

Changes:

- support video-based inputs
- dispatch to `/videos/edits` and `/videos/extensions`

## 10.8 Billing and capabilities

Extend:

- `src/lib/billing/task-policy.ts`
- `src/lib/billing/cost.ts`
- `src/lib/model-capabilities/video-model-options.ts`
- `standards/capabilities/image-video.catalog.json`
- `standards/pricing/image-video.pricing.json`

Changes:

- support `edit` / `extend`
- support `containsVideoInput = true`
- add Grok capability + pricing combinations

## 10.9 i18n

Update at minimum:

- `messages/zh/*.json`
- `messages/en/*.json`

New keys:

- candidate viewer tab labels
- source video labels
- edit / extend CTA text
- validation and unsupported mode error strings

## 11. Phase plan

## Phase 1

- official Grok only
- candidate viewer tabs
- edit / extend single-panel flow
- no Prisma migration

## Phase 2

- provider expansion
- optional upload/external source video entry
- richer candidate lineage UI

## 12. Testing plan

## 12.1 Unit

- candidate parser preserves `meta`
- route validation rejects invalid combinations
- source candidate lookup fails correctly
- capability helpers filter models correctly by mode
- billing metadata sets `containsVideoInput` correctly

## 12.2 Integration

- `generate-video` legacy normal flow still works
- `generate-video` first-last-frame flow still works
- edit request creates a new candidate with `generationMode=edit`
- extend request creates a new candidate with `generationMode=extend`
- selecting an edited / extended candidate updates panel `videoGenerationMode`

## 12.3 Manual QA

- generate first candidate from image
- open viewer
- edit candidate
- extend edited candidate
- switch among candidates
- set edited / extended candidate as current
- delete source candidate after generating child candidate and verify degraded lineage display

## 13. Key decisions

- The correct product entry for Grok edit / extend is the candidate viewer, not the empty panel card
- `normal` remains the existing image-to-video flow and should not be renamed in V1
- Edit / extend prompts are operation drafts, not panel prompts
- V1 should target official Grok only
- V1 should avoid Prisma migration by extending candidate JSON metadata and existing string mode fields
