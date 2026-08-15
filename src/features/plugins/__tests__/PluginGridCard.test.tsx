import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import {
  InstalledPluginGridCard,
  PluginGridCard,
  type ValidPluginDisplayInfo,
} from '../components/PluginGridCard'

// ============================================
// Test Helpers
// ============================================

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'telescope-nvim',
    pluginName: 'telescope.nvim',
    pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
    version: '1.0.0',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeInstalled(overrides?: Partial<InstalledPlugin>): InstalledPlugin {
  return {
    schemaId: 'telescope-nvim',
    enabled: true,
    config: {},
    addedAt: Date.now(),
    ...overrides,
  }
}

function makeInstalledDisplayInfo(
  schemaOverrides?: Partial<PluginSchema>,
  installedOverrides?: Partial<InstalledPlugin>,
): ValidPluginDisplayInfo {
  const schema = makeSchema(schemaOverrides)
  const installed = makeInstalled({
    schemaId: schema.id,
    ...installedOverrides,
  })
  return { status: 'installed', schema, source: 'builtin', installed }
}

function makeAvailableDisplayInfo(
  schemaOverrides?: Partial<PluginSchema>,
): ValidPluginDisplayInfo {
  return {
    status: 'available',
    schema: makeSchema(schemaOverrides),
    source: 'global',
  }
}

// ============================================
// PluginGridCard (browse/click variant)
// ============================================

describe('PluginGridCard', () => {
  it('renders plugin name', () => {
    const displayInfo = makeAvailableDisplayInfo({
      pluginName: 'telescope.nvim',
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('telescope.nvim')).toBeInTheDocument()
  })

  it('renders author name from schema.author field', () => {
    const displayInfo = makeAvailableDisplayInfo({ author: 'nvim-telescope' })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('nvim-telescope')).toBeInTheDocument()
  })

  it('renders built-in snapshot author when available', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'available',
      schema: makeSchema({
        pluginRepo: 'https://github.com/folke/tokyonight.nvim',
      }),
      source: 'builtin',
    }
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('folke')).toBeInTheDocument()
  })

  it('does not fall back to schema.author for built-in plugins when snapshot data is missing', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'available',
      schema: makeSchema({
        author: 'stale-author',
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      source: 'builtin',
    }
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.queryByText('stale-author')).toBeNull()
  })

  it('renders formatted star count', () => {
    const displayInfo = makeAvailableDisplayInfo({
      stars: 16400,
      pluginRepo: 'https://github.com/example/custom.nvim',
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('16.4k')).toBeInTheDocument()
  })

  it('does not fall back to built-in schema stars when snapshot data is missing', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'available',
      schema: makeSchema({
        stars: 1234,
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      source: 'builtin',
    }
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.queryByText('1.2k')).toBeNull()
  })

  it('does not render star count when stars is undefined', () => {
    const displayInfo = makeAvailableDisplayInfo({
      stars: undefined,
      pluginRepo: 'https://github.com/example/custom.nvim',
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.queryByText(/k$/)).toBeNull()
  })

  it('renders category badge when category is set (and plugin has schema content)', () => {
    // A plugin with category AND schema content (options) is not schema-less
    const displayInfo = makeAvailableDisplayInfo({
      category: 'navigation',
      options: [
        {
          type: 'boolean',
          key: 'show_hidden',
          label: 'Show Hidden',
          default: false,
        },
      ],
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('Navigation')).toBeInTheDocument()
  })

  it('renders "No schema" badge for schema-less plugins (no options/functions/commands)', () => {
    // Schema-less: no options, no functions, no commands
    const displayInfo = makeAvailableDisplayInfo({ category: undefined })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('No schema')).toBeInTheDocument()
  })

  it('renders "Uncategorized" when category is absent but plugin has schema content', () => {
    const displayInfo = makeAvailableDisplayInfo({
      category: undefined,
      options: [
        {
          type: 'boolean',
          key: 'show_hidden',
          label: 'Show Hidden',
          default: false,
        },
      ],
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
  })

  it('renders version', () => {
    const displayInfo = makeAvailableDisplayInfo({ version: '2.3.1' })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('v2.3.1')).toBeInTheDocument()
  })

  it('renders tagline when present', () => {
    const displayInfo = makeAvailableDisplayInfo({
      tagline: 'Highly extensible fuzzy finder',
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(
      screen.getByText('Highly extensible fuzzy finder'),
    ).toBeInTheDocument()
  })

  it('renders description as fallback when tagline is absent', () => {
    const displayInfo = makeAvailableDisplayInfo({
      description: 'A fuzzy finder plugin',
    })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('A fuzzy finder plugin')).toBeInTheDocument()
  })

  it('renders "No description available" when neither tagline nor description', () => {
    // makeSchema base has no tagline or description — use defaults
    const displayInfo = makeAvailableDisplayInfo()
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('No description available')).toBeInTheDocument()
  })

  it('renders source badge', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'available',
      schema: makeSchema(),
      source: 'global',
    }
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    expect(screen.getByText('global')).toBeInTheDocument()
  })

  it('shows installed indicator when plugin is installed', () => {
    const displayInfo = makeInstalledDisplayInfo()
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    // The enabled indicator should be present (title="Enabled")
    const indicator = document.querySelector('[title="Enabled"]')
    expect(indicator).not.toBeNull()
  })

  it('shows disabled indicator when plugin is installed but disabled', () => {
    const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: false })
    render(<PluginGridCard displayInfo={displayInfo} onClick={vi.fn()} />)
    const indicator = document.querySelector('[title="Disabled"]')
    expect(indicator).not.toBeNull()
  })

  it('calls onClick with schema id when card is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const displayInfo = makeAvailableDisplayInfo({ id: 'my-plugin' })
    render(<PluginGridCard displayInfo={displayInfo} onClick={onClick} />)

    const card = screen.getByRole('button')
    await user.click(card)
    expect(onClick).toHaveBeenCalledWith('my-plugin')
  })

  it('calls onClick when Enter key is pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const displayInfo = makeAvailableDisplayInfo({ id: 'my-plugin' })
    render(<PluginGridCard displayInfo={displayInfo} onClick={onClick} />)

    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledWith('my-plugin')
  })
})

// ============================================
// InstalledPluginGridCard (installed tab variant)
// ============================================

describe('InstalledPluginGridCard', () => {
  it('renders plugin name', () => {
    const displayInfo = makeInstalledDisplayInfo({ pluginName: 'mason.nvim' })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('mason.nvim')).toBeInTheDocument()
  })

  it('renders author name', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'installed',
      schema: makeSchema({
        author: 'williamboman',
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      source: 'global',
      installed: makeInstalled(),
    }
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('williamboman')).toBeInTheDocument()
  })

  it('renders star count', () => {
    const displayInfo: ValidPluginDisplayInfo = {
      status: 'installed',
      schema: makeSchema({
        stars: 8200,
        pluginRepo: 'https://github.com/example/custom.nvim',
      }),
      source: 'global',
      installed: makeInstalled(),
    }
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('8.2k')).toBeInTheDocument()
  })

  it('renders category badge when plugin has schema content', () => {
    // A plugin with category AND schema content (options) is not schema-less
    const displayInfo = makeInstalledDisplayInfo({
      category: 'lsp',
      options: [
        {
          type: 'boolean',
          key: 'auto_install',
          label: 'Auto Install',
          default: true,
        },
      ],
    })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('LSP & Completion')).toBeInTheDocument()
  })

  it('renders "No schema" badge for schema-less installed plugins', () => {
    // Schema-less: no options, no functions, no commands
    const displayInfo = makeInstalledDisplayInfo({ category: undefined })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('No schema')).toBeInTheDocument()
  })

  it('shows "Disable" button when plugin is enabled', () => {
    const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: true })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('Disable')).toBeInTheDocument()
  })

  it('shows "Enable" button when plugin is disabled', () => {
    const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: false })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByText('Enable')).toBeInTheDocument()
  })

  it('calls onToggle when toggle button is clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: true })
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={onToggle}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )

    await user.click(screen.getByText('Disable'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('calls onUninstall when uninstall button is clicked', async () => {
    const user = userEvent.setup()
    const onUninstall = vi.fn()
    const displayInfo = makeInstalledDisplayInfo()
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={onUninstall}
        onConfigure={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Uninstall plugin'))
    expect(onUninstall).toHaveBeenCalledOnce()
  })

  it('calls onConfigure when configure button is clicked', async () => {
    const user = userEvent.setup()
    const onConfigure = vi.fn()
    const displayInfo = makeInstalledDisplayInfo()
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={onConfigure}
      />,
    )

    await user.click(screen.getByLabelText('Configure plugin'))
    expect(onConfigure).toHaveBeenCalledOnce()
  })

  it('renders action buttons for installed plugins', () => {
    const displayInfo = makeInstalledDisplayInfo()
    render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Configure plugin')).toBeInTheDocument()
    expect(screen.getByLabelText('Uninstall plugin')).toBeInTheDocument()
  })

  it('applies reduced opacity when plugin is disabled', () => {
    const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: false })
    const { container } = render(
      <InstalledPluginGridCard
        displayInfo={displayInfo}
        onToggle={vi.fn()}
        onUninstall={vi.fn()}
        onConfigure={vi.fn()}
      />,
    )
    // The card should have opacity-60 class when disabled
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('opacity-60')
  })
})
