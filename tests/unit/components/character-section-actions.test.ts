import * as React from 'react'
import { createElement } from 'react'
import type { ComponentProps, ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import CharacterSection from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/CharacterSection'

const useProjectAssetsMock = vi.hoisted(() => vi.fn())
const characterCardMock = vi.hoisted(() => vi.fn((_props?: unknown) => null))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/AssetStageProjectAssetsContext', () => ({
  useAssetStageProjectAssets: (projectId: string | null) => useProjectAssetsMock(projectId),
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/CharacterCard', () => ({
  __esModule: true,
  default: (props: unknown) => characterCardMock(props),
}))

vi.mock('@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/assets/CharacterProfileCard', () => ({
  __esModule: true,
  default: () => null,
}))

vi.mock('@/types/character-profile', () => ({
  parseProfileData: () => null,
}))

vi.mock('@/components/task/TaskStatusInline', () => ({
  __esModule: true,
  default: () => null,
}))

vi.mock('@/lib/task/presentation', () => ({
  resolveTaskPresentationState: () => null,
}))

vi.mock('@/components/ui/icons', () => ({
  AppIcon: (props: { name?: string; className?: string }) =>
    createElement('span', { 'data-icon': props.name, className: props.className }),
}))

const messages = {
  assets: {
    stage: {
      characterAssets: 'Characters',
      counts: '{characterCount} characters, {appearanceCount} looks',
      pendingProfilesBanner: 'Pending profiles',
      pendingProfilesHint: 'Confirm profile settings',
      confirmAll: 'Confirm all',
    },
    toolbar: {
      generateAll: 'Generate all',
    },
    character: {
      add: 'Add character',
      assetCount: '{count} looks',
      copyFromGlobal: 'Import from library',
      delete: 'Delete character',
    },
  },
} as const

function renderWithIntl(node: ReactElement) {
  const providerProps: ComponentProps<typeof NextIntlClientProvider> = {
    locale: 'en',
    messages: messages as unknown as AbstractIntlMessages,
    timeZone: 'Asia/Shanghai',
    children: node,
  }

  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, providerProps),
  )
}

describe('CharacterSection actions', () => {
  it('renders import and delete actions stacked vertically with the import icon', () => {
    Reflect.set(globalThis, 'React', React)
    useProjectAssetsMock.mockReturnValue({
      characters: [
        {
          id: 'character-1',
          name: 'Suit Hero',
          introduction: null,
          appearances: [
            {
              id: 'appearance-1',
              appearanceIndex: 0,
              changeReason: 'default',
              imageUrl: null,
              imageUrls: [],
              selectedIndex: null,
            },
          ],
        },
      ],
      locations: [],
      props: [],
    })

    const html = renderWithIntl(
      createElement(CharacterSection, {
        projectId: 'project-1',
        activeTaskKeys: new Set<string>(),
        onClearTaskKey: () => undefined,
        onRegisterTransientTaskKey: () => undefined,
        isAnalyzingAssets: false,
        onGenerateAll: () => undefined,
        generateAllButtonLabel: 'Generate all',
        isGenerateAllDisabled: false,
        onAddCharacter: () => undefined,
        onDeleteCharacter: () => undefined,
        onDeleteAppearance: () => undefined,
        onEditAppearance: () => undefined,
        handleGenerateImage: async () => undefined,
        onSelectImage: () => undefined,
        onConfirmSelection: () => undefined,
        onRegenerateSingle: async () => undefined,
        onRegenerateGroup: async () => undefined,
        onUndo: () => undefined,
        onImageClick: () => undefined,
        onImageEdit: () => undefined,
        onVoiceChange: () => undefined,
        onVoiceDesign: () => undefined,
        onVoiceSelectFromHub: () => undefined,
        onCopyFromGlobal: () => undefined,
        getAppearances: (character) => character.appearances,
        unconfirmedCharacters: [],
        isConfirmingCharacter: () => false,
        deletingCharacterId: null,
        batchConfirming: false,
        batchConfirmingState: null,
        onBatchConfirm: () => undefined,
        onEditProfile: () => undefined,
        onConfirmProfile: () => undefined,
        onUseExistingProfile: () => undefined,
        onDeleteProfile: () => undefined,
      }),
    )

    expect(html).toContain('Import from library')
    expect(html).toContain('Delete character')
    expect(html).toContain('Generate all')
    expect(html).toContain('data-icon="arrowDownCircle"')
    expect(html).toContain('flex flex-col items-end gap-1.5')
  })
})
