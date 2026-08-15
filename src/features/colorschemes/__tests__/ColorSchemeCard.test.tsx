import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  ColorSchemeCatalogEntry,
  ColorSchemeDisplayInfo,
} from '@/shared/types'
import { ColorSchemeCard } from '../components/ColorSchemeCard'

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []

  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  unobserve(): void {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

function makeCatalogEntry(
  overrides?: Partial<ColorSchemeCatalogEntry>,
): ColorSchemeCatalogEntry {
  return {
    id: 'tokyonight-night',
    name: 'Tokyo Night',
    repoUrl: 'https://github.com/folke/tokyonight.nvim',
    description: 'A cool dark colorscheme',
    variant: 'dark',
    vimColorscheme: 'tokyonight-night',
    pluginRepo: 'https://github.com/folke/tokyonight.nvim',
    tags: ['dark'],
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      lineNumber: '#888888',
      lineHighlight: '#111111',
      selection: '#222222',
      cursor: '#ffffff',
      tokens: {
        comment: '#888888',
        keyword: '#ff00ff',
        string: '#00ff00',
        number: '#ffff00',
        function: '#00ffff',
        variable: '#ffffff',
        type: '#ff8800',
        constant: '#ff0000',
        operator: '#cccccc',
        punctuation: '#aaaaaa',
      },
      ui: {
        statusLine: '#111111',
        statusLineText: '#ffffff',
        tabLine: '#111111',
        tabLineText: '#ffffff',
        tabLineSel: '#222222',
        tabLineSelText: '#ffffff',
        border: '#333333',
      },
    },
    ...overrides,
  }
}

function makeDisplayInfo(
  catalogOverrides?: Partial<ColorSchemeCatalogEntry>,
): ColorSchemeDisplayInfo {
  return {
    status: 'available',
    catalog: makeCatalogEntry(catalogOverrides),
    pluginSchemaId: 'tokyonight',
  }
}

describe('ColorSchemeCard', () => {
  it('renders seeded repository metadata for bundled themes', () => {
    render(
      <ColorSchemeCard
        displayInfo={makeDisplayInfo()}
        isActive={false}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
        onSetActive={vi.fn()}
      />,
    )

    expect(screen.getByText('folke')).toBeInTheDocument()
    expect(screen.getByText('8,149')).toBeInTheDocument()
    expect(screen.getByText(/Created/)).toBeInTheDocument()
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
    expect(screen.getByText(/Metadata refreshed/)).toBeInTheDocument()
  })

  it('omits snapshot-backed metadata fields when bundled metadata is missing', () => {
    render(
      <ColorSchemeCard
        displayInfo={makeDisplayInfo({
          repoUrl: 'https://github.com/example/custom-theme.nvim',
          pluginRepo: 'https://github.com/example/custom-theme.nvim',
        })}
        isActive={false}
        onInstall={vi.fn()}
        onUninstall={vi.fn()}
        onSetActive={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Metadata refreshed/)).toBeNull()
    expect(screen.queryByText('folke')).toBeNull()
    expect(screen.queryByText(/Created/)).toBeNull()
  })
})
