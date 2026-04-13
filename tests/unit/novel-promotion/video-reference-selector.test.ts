import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import VideoReferenceSelector from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/VideoReferenceSelector'
import type {
  VideoReferenceOptions,
  VideoReferenceSelection,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/types'

vi.mock('@/components/media/MediaImageWithLoading', () => ({
  MediaImageWithLoading: ({ alt, src }: { alt: string; src: string }) => React.createElement('img', { alt, src }),
}))

function t(key: string) {
  if (key === 'panelCard.referenceAssetsLabel') return 'Reference'
  if (key === 'panelCard.referenceAssetsHint') return 'Optional reference assets.'
  if (key === 'panelCard.referenceCharacters') return 'Related characters'
  if (key === 'panelCard.referenceLocation') return 'Related scene'
  if (key === 'panelCard.referenceProps') return 'Related props'
  return key
}

describe('VideoReferenceSelector', () => {
  it('renders compact tab labels while only showing the active tab options', () => {
    Reflect.set(globalThis, 'React', React)

    const options: VideoReferenceOptions = {
      characters: [
        {
          key: 'alice::red-coat',
          name: 'Alice',
          appearance: 'red coat',
          label: 'Alice / red coat',
          imageUrl: 'https://example.com/alice.jpg',
          description: 'lead character',
        },
      ],
      locations: [
        {
          key: 'harbor-warehouse',
          name: 'Harbor Warehouse',
          imageUrl: 'https://example.com/harbor.jpg',
          description: 'night exterior',
        },
      ],
      props: [
        {
          key: 'copper-lantern',
          name: 'Copper Lantern',
          imageUrl: 'https://example.com/lantern.jpg',
          description: 'warm practical light',
        },
      ],
    }
    const selection: VideoReferenceSelection = {
      includeCharacters: true,
      includeLocation: true,
      includeProps: true,
      characters: [{ name: 'Alice', appearance: 'red coat' }],
      locations: ['Harbor Warehouse'],
      props: ['Copper Lantern'],
    }

    const html = renderToStaticMarkup(
      React.createElement(VideoReferenceSelector, {
        t,
        selection,
        options,
        onChange: () => undefined,
      }),
    )

    expect(html).toContain('Characters')
    expect(html).toContain('Scene')
    expect(html).toContain('Props')
    expect(html).not.toContain('Related characters')
    expect(html).toContain('Alice / red coat')
    expect(html).not.toContain('Harbor Warehouse')
    expect(html).not.toContain('Copper Lantern')
  })

  it('prefers the first non-empty tab on initial render', () => {
    Reflect.set(globalThis, 'React', React)

    const html = renderToStaticMarkup(
      React.createElement(VideoReferenceSelector, {
        t,
        selection: {
          includeLocation: true,
          locations: ['Moonlit Harbor'],
        },
        options: {
          characters: [],
          locations: [
            {
              key: 'moonlit-harbor',
              name: 'Moonlit Harbor',
              imageUrl: 'https://example.com/moonlit-harbor.jpg',
            },
          ],
          props: [],
        },
        onChange: () => undefined,
      }),
    )

    expect(html).toContain('Scene')
    expect(html).toContain('Moonlit Harbor')
    expect(html).not.toContain('Alice / red coat')
  })
})
