import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getRepositoryMetadata } from '@/metadata'
import type {
  InstalledPlugin,
  PluginSchema,
  SchemaExCommand,
  SchemaFunction,
} from '@/shared/types'
import { PluginDetailModal } from '../components/PluginDetailModal'
import type { ValidPluginDisplayInfo } from '../components/PluginGridCard'

// ============================================
// Test Helpers
// ============================================

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'telescope-nvim',
    pluginName: 'telescope.nvim',
    pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
    version: '1.0.0',
    description: 'Highly extensible fuzzy finder',
    author: 'nvim-telescope',
    stars: 16400,
    category: 'navigation',
    tags: ['fuzzy', 'finder'],
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

function makeExCommand(overrides?: Partial<SchemaExCommand>): SchemaExCommand {
  return {
    name: 'Telescope',
    description: 'Open telescope picker',
    template: ':Telescope {picker}',
    example: ':Telescope find_files',
    sourceDoc: ':help telescope',
    ...overrides,
  }
}

function makeFunction(overrides?: Partial<SchemaFunction>): SchemaFunction {
  return {
    name: 'find_files',
    description: 'Find files in the current directory',
    params: [],
    luaCall: "require('telescope.builtin').find_files()",
    ...overrides,
  }
}

// Default no-op handlers
const defaultHandlers = {
  onInstall: vi.fn().mockResolvedValue(undefined),
  onUninstall: vi.fn().mockResolvedValue(undefined),
  onDeleteSchema: vi.fn().mockResolvedValue(undefined),
  onToggle: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
  onInstallOverrideChange: vi.fn().mockResolvedValue(undefined),
  onInstallOverrideClear: vi.fn().mockResolvedValue(undefined),
  onLuaIncludeChange: vi.fn(),
}

/**
 * Find the sidebar button element containing the given text.
 * "Commands" and "Functions" appear in both the sidebar and overview stats,
 * so we need to find the one that is inside a <button>.
 */
function findSidebarButton(text: string): HTMLButtonElement {
  const elements = screen.getAllByText(text)
  const buttonEl = elements
    .map((el) => el.closest('button'))
    .find((btn): btn is HTMLButtonElement => btn !== null)
  if (buttonEl === undefined) {
    throw new Error(`Could not find sidebar button with text: ${text}`)
  }
  return buttonEl
}

// ============================================
// Rendering
// ============================================

describe('PluginDetailModal', () => {
  describe('rendering', () => {
    it('renders plugin name in header', () => {
      const displayInfo = makeAvailableDisplayInfo({
        pluginName: 'telescope.nvim',
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('telescope.nvim')).toBeInTheDocument()
    })

    it('renders author and stars in header', () => {
      const displayInfo = makeAvailableDisplayInfo()
      const telescopeMetadata = getRepositoryMetadata(
        'https://github.com/nvim-telescope/telescope.nvim',
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // Author appears in header (span) and overview panel — use getAllByText
      const authorElements = screen.getAllByText('nvim-telescope')
      expect(authorElements.length).toBeGreaterThan(0)
      expect(
        screen.getByText(
          `⭐ ${((telescopeMetadata?.stars ?? 0) / 1000).toFixed(1)}k`,
        ),
      ).toBeInTheDocument()
    })

    it('renders category badge in header', () => {
      const displayInfo = makeAvailableDisplayInfo({ category: 'navigation' })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // Category appears in both header and overview panel
      const navElements = screen.getAllByText('Navigation')
      expect(navElements.length).toBeGreaterThan(0)
    })

    it('shows enabled/disabled badge for installed plugins', () => {
      const displayInfo = makeInstalledDisplayInfo(undefined, { enabled: true })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // "Enabled" appears in header badge and overview panel status
      const enabledElements = screen.getAllByText('Enabled')
      expect(enabledElements.length).toBeGreaterThan(0)
    })

    it('shows disabled badge when plugin is disabled', () => {
      const displayInfo = makeInstalledDisplayInfo(undefined, {
        enabled: false,
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // "Disabled" appears in header badge and overview panel status
      const disabledElements = screen.getAllByText('Disabled')
      expect(disabledElements.length).toBeGreaterThan(0)
    })

    it('does not render when open is false', () => {
      const displayInfo = makeAvailableDisplayInfo()
      render(
        <PluginDetailModal
          open={false}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // Dialog content should not be visible
      expect(screen.queryByText('Plugin Detail')).toBeNull()
    })
  })

  // ============================================
  // Sidebar navigation
  // ============================================

  describe('sidebar navigation', () => {
    it('shows Overview sidebar item', () => {
      const displayInfo = makeAvailableDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    it('shows Configuration sidebar item', () => {
      const displayInfo = makeAvailableDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('Configuration')).toBeInTheDocument()
    })

    it('shows Commands sidebar item when schema has commands', () => {
      const displayInfo = makeAvailableDisplayInfo({
        exCommands: [makeExCommand()],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // "Commands" appears in sidebar button and overview stats — use getAllByText
      const commandsElements = screen.getAllByText('Commands')
      expect(commandsElements.length).toBeGreaterThan(0)
    })

    it('hides Commands sidebar item when schema has no commands', () => {
      // Use a schema with no commands and no functions (so overview stats won't show "Commands")
      // Don't pass exCommands at all (it's optional) and use empty functions
      const displayInfo = makeAvailableDisplayInfo({
        functions: [],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // The sidebar should not have a "Commands" button
      // Overview stats only shows "Commands" when exCommands is defined
      expect(screen.queryByText('Commands')).toBeNull()
    })

    it('shows Functions sidebar item when schema has functions', () => {
      const displayInfo = makeAvailableDisplayInfo({
        functions: [makeFunction()],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // "Functions" appears in sidebar button and overview stats — use getAllByText
      const functionsElements = screen.getAllByText('Functions')
      expect(functionsElements.length).toBeGreaterThan(0)
    })

    it('hides Functions sidebar item when schema has no functions', () => {
      // Use a schema with no functions and no templates
      const displayInfo = makeAvailableDisplayInfo({
        functions: [],
        functionTemplates: undefined,
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      // "Functions" appears in overview stats but NOT as a sidebar button
      // The sidebar button is a <button> element containing "Functions"
      const functionsElements = screen.queryAllByText('Functions')
      const sidebarButton = functionsElements.find(
        (el) => el.closest('button') !== null,
      )
      expect(sidebarButton).toBeUndefined()
    })

    it('navigates to Configuration panel when sidebar item is clicked', async () => {
      const user = userEvent.setup()
      // Use a schema with options so it's not schema-less (schema-less shows different empty state)
      const displayInfo = makeAvailableDisplayInfo({
        options: [
          {
            type: 'boolean',
            key: 'show_hidden',
            label: 'Show Hidden Files',
            default: false,
          },
        ],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      // Config panel shows the option field
      expect(screen.getByText('Show Hidden Files')).toBeInTheDocument()
    })

    it('shows schema-less empty state in Configuration panel for schema-less plugins', async () => {
      const user = userEvent.setup()
      // Schema-less: no options, no functions, no commands
      const displayInfo = makeAvailableDisplayInfo({
        options: [],
        functions: [],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      // Schema-less shows "No configuration available"
      expect(screen.getByText('No configuration available')).toBeInTheDocument()
    })

    it('navigates to Commands panel when sidebar item is clicked', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        exCommands: [makeExCommand({ name: 'Telescope' })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Commands" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Commands'))
      expect(screen.getByText(':Telescope')).toBeInTheDocument()
    })

    it('navigates to Functions panel when sidebar item is clicked', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        functions: [makeFunction({ name: 'find_files' })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Functions" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Functions'))
      expect(screen.getByText('find_files')).toBeInTheDocument()
    })
  })

  // ============================================
  // Overview panel
  // ============================================

  describe('overview panel', () => {
    it('shows description in overview', () => {
      const displayInfo = makeAvailableDisplayInfo({
        description: 'Highly extensible fuzzy finder',
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(
        screen.getByText('Highly extensible fuzzy finder'),
      ).toBeInTheDocument()
    })

    it('shows tags in overview', () => {
      const displayInfo = makeAvailableDisplayInfo({
        tags: ['fuzzy', 'finder'],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('fuzzy')).toBeInTheDocument()
      expect(screen.getByText('finder')).toBeInTheDocument()
    })

    it('shows source badge in overview', () => {
      const displayInfo: ValidPluginDisplayInfo = {
        status: 'available',
        schema: makeSchema(),
        source: 'builtin',
      }
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('builtin')).toBeInTheDocument()
    })

    it('shows Install Plugin button for available plugins', () => {
      const displayInfo = makeAvailableDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('Install Plugin')).toBeInTheDocument()
    })

    it('shows installation date for installed plugins', () => {
      const displayInfo = makeInstalledDisplayInfo(undefined, {
        addedAt: new Date('2024-01-15').getTime(),
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )
      expect(screen.getByText('Added on')).toBeInTheDocument()
    })
  })

  // ============================================
  // Footer actions
  // ============================================

  describe('footer actions', () => {
    it('calls onInstall when Install Plugin is clicked (available plugin)', async () => {
      const user = userEvent.setup()
      const onInstall = vi.fn().mockResolvedValue(undefined)
      const displayInfo = makeAvailableDisplayInfo({ id: 'my-plugin' })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={onInstall}
          onUninstall={vi.fn().mockResolvedValue(undefined)}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={vi.fn()}
        />,
      )

      // Footer Install Plugin button
      await user.click(screen.getByTestId('footer-install-btn'))
      expect(onInstall).toHaveBeenCalledWith('my-plugin')
    })

    it('deletes available user schemas only after confirmation', async () => {
      const user = userEvent.setup()
      const onDeleteSchema = vi.fn().mockResolvedValue(undefined)
      const displayInfo = makeAvailableDisplayInfo({ id: 'my-plugin' })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
          onDeleteSchema={onDeleteSchema}
        />,
      )

      await user.click(
        screen.getByRole('button', { name: 'Delete from Catalog' }),
      )
      expect(
        screen.getByText(/This removes the global schema from every project/),
      ).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: 'Delete from Catalog' }),
      )
      expect(onDeleteSchema).toHaveBeenCalledWith('my-plugin', 'global')
    })

    it('hides catalog deletion for built-in and installed schemas', () => {
      const builtin: ValidPluginDisplayInfo = {
        status: 'available',
        schema: makeSchema(),
        source: 'builtin',
      }
      const { rerender } = render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={builtin}
          {...defaultHandlers}
        />,
      )
      expect(
        screen.queryByRole('button', { name: 'Delete from Catalog' }),
      ).toBeNull()

      rerender(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={makeInstalledDisplayInfo()}
          {...defaultHandlers}
        />,
      )
      expect(
        screen.queryByRole('button', { name: 'Delete from Catalog' }),
      ).toBeNull()
    })

    it('calls onToggle when Enable/Disable is clicked (installed plugin)', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn().mockResolvedValue(undefined)
      const displayInfo = makeInstalledDisplayInfo(
        { id: 'my-plugin' },
        { enabled: true },
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={vi.fn().mockResolvedValue(undefined)}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={onToggle}
          onConfigChange={vi.fn()}
        />,
      )

      // Footer Disable button
      await user.click(screen.getByText('Disable'))
      expect(onToggle).toHaveBeenCalledWith('my-plugin', false)
    })

    it('shows uninstall confirmation dialog when Uninstall is clicked', async () => {
      const user = userEvent.setup()
      const displayInfo = makeInstalledDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Uninstall" appears in overview panel and footer — click the footer button
      await user.click(screen.getByTestId('footer-uninstall-btn'))
      expect(
        screen.getByText(/Uninstall telescope\.nvim\?/),
      ).toBeInTheDocument()
    })

    it('calls onUninstall after confirming uninstall dialog', async () => {
      const user = userEvent.setup()
      const onUninstall = vi.fn().mockResolvedValue(undefined)
      const displayInfo = makeInstalledDisplayInfo({ id: 'my-plugin' })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={onUninstall}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={vi.fn()}
        />,
      )

      // Click footer Uninstall button
      await user.click(screen.getByTestId('footer-uninstall-btn'))
      // Confirm in dialog — the dialog has a single "Uninstall" action button
      const confirmButton = screen.getByRole('button', { name: 'Uninstall' })
      await user.click(confirmButton)
      expect(onUninstall).toHaveBeenCalledWith('my-plugin')
    })

    it('does not call onUninstall when uninstall is cancelled', async () => {
      const user = userEvent.setup()
      const onUninstall = vi.fn()
      const displayInfo = makeInstalledDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={onUninstall}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={vi.fn()}
        />,
      )

      // Click footer Uninstall button
      await user.click(screen.getByTestId('footer-uninstall-btn'))
      await user.click(screen.getByText('Cancel'))
      expect(onUninstall).not.toHaveBeenCalled()
    })

    it('calls onOpenChange(false) when Close is clicked (clean state)', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      const displayInfo = makeAvailableDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={onOpenChange}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      await user.click(screen.getByText('Close'))
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('calls onResetAll once with schema id when reset defaults is confirmed', async () => {
      const user = userEvent.setup()
      const onResetAll = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          id: 'my-plugin',
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )

      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
          onResetAll={onResetAll}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      await user.click(screen.getByRole('button', { name: 'Reset Defaults' }))
      const confirmResetButtons = screen.getAllByRole('button', {
        name: 'Reset Defaults',
      })
      const confirmResetButton =
        confirmResetButtons[confirmResetButtons.length - 1]
      if (confirmResetButton === undefined) {
        throw new Error('Expected reset confirmation button')
      }
      await user.click(confirmResetButton)

      expect(onResetAll).toHaveBeenCalledTimes(1)
      expect(onResetAll).toHaveBeenCalledWith('my-plugin')
    })

    it('does not call onConfigChange during confirmed global reset', async () => {
      const user = userEvent.setup()
      const onConfigChange = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          id: 'my-plugin',
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )

      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={vi.fn().mockResolvedValue(undefined)}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={onConfigChange}
          onResetAll={vi.fn()}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      await user.click(screen.getByRole('button', { name: 'Reset Defaults' }))
      const confirmResetButtons = screen.getAllByRole('button', {
        name: 'Reset Defaults',
      })
      const confirmResetButton =
        confirmResetButtons[confirmResetButtons.length - 1]
      if (confirmResetButton === undefined) {
        throw new Error('Expected reset confirmation button')
      }
      await user.click(confirmResetButton)

      expect(onConfigChange).not.toHaveBeenCalled()
    })

    it('does not call onConfigChange during confirmed global reset (non-default config)', async () => {
      const user = userEvent.setup()
      const onConfigChange = vi.fn()
      const onResetAll = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          id: 'my-plugin',
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
            {
              type: 'string',
              key: 'theme',
              label: 'Theme',
              default: 'light',
            },
          ],
        },
        { config: { show_hidden: true, theme: 'dark' } },
      )

      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={vi.fn().mockResolvedValue(undefined)}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={onConfigChange}
          onResetAll={onResetAll}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      await user.click(screen.getByRole('button', { name: 'Reset Defaults' }))
      const confirmResetButtons = screen.getAllByRole('button', {
        name: 'Reset Defaults',
      })
      const confirmResetButton =
        confirmResetButtons[confirmResetButtons.length - 1]
      if (confirmResetButton === undefined) {
        throw new Error('Expected reset confirmation button')
      }
      await user.click(confirmResetButton)

      await waitFor(() => {
        expect(onResetAll).toHaveBeenCalledTimes(1)
      })
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onResetAll).toHaveBeenCalledWith('my-plugin')
      expect(onConfigChange).not.toHaveBeenCalled()
    })

    it('still calls onConfigChange when Save Changes is clicked', async () => {
      const user = userEvent.setup()
      const onConfigChange = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          id: 'my-plugin',
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )

      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          onInstall={vi.fn().mockResolvedValue(undefined)}
          onUninstall={vi.fn().mockResolvedValue(undefined)}
          onDeleteSchema={vi.fn().mockResolvedValue(undefined)}
          onToggle={vi.fn().mockResolvedValue(undefined)}
          onConfigChange={onConfigChange}
        />,
      )

      await user.click(screen.getByText('Configuration'))
      await user.click(screen.getByRole('switch'))
      await user.click(screen.getByText('Save Changes'))

      expect(onConfigChange).toHaveBeenCalledTimes(1)
      expect(onConfigChange).toHaveBeenCalledWith(
        'my-plugin',
        expect.objectContaining({ show_hidden: true }),
      )
    })
  })

  // ============================================
  // Unsaved changes handling
  // ============================================

  describe('unsaved changes', () => {
    it('shows discard confirmation when closing with dirty config', async () => {
      const user = userEvent.setup()
      const displayInfo = makeInstalledDisplayInfo(
        {
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // Navigate to config panel
      await user.click(screen.getByText('Configuration'))

      // Toggle the boolean field to make it dirty
      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Try to close
      await user.click(screen.getByText('Close'))

      // Should show discard dialog — "Unsaved changes" appears in both
      // the ConfigPanel dirty indicator and the AlertDialog title
      await waitFor(() => {
        const unsavedElements = screen.getAllByText('Unsaved changes')
        expect(unsavedElements.length).toBeGreaterThan(0)
      })
      // The discard dialog should also show "Discard Changes" button
      expect(screen.getByText('Discard Changes')).toBeInTheDocument()
    })

    it('closes without prompt when config is clean', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      const displayInfo = makeInstalledDisplayInfo()
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={onOpenChange}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      await user.click(screen.getByText('Close'))
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(screen.queryByText('Unsaved changes')).toBeNull()
    })

    it('discards changes and closes when Discard Changes is confirmed', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={onOpenChange}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // Navigate to config and make dirty
      await user.click(screen.getByText('Configuration'))
      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Try to close
      await user.click(screen.getByText('Close'))

      // Confirm discard
      await waitFor(() => {
        expect(screen.getByText('Discard Changes')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Discard Changes'))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('stays open when Cancel is clicked in discard dialog', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      const displayInfo = makeInstalledDisplayInfo(
        {
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
        },
        { config: {} },
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={onOpenChange}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // Navigate to config and make dirty
      await user.click(screen.getByText('Configuration'))
      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Try to close
      await user.click(screen.getByText('Close'))

      // Cancel discard
      await waitFor(() => {
        expect(screen.getByText('Discard Changes')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Cancel'))

      // Modal should still be open (onOpenChange not called with false)
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('preserves dirty state when switching sidebar sections', async () => {
      const user = userEvent.setup()
      const displayInfo = makeInstalledDisplayInfo(
        {
          options: [
            {
              type: 'boolean',
              key: 'show_hidden',
              label: 'Show Hidden Files',
              default: false,
            },
          ],
          exCommands: [makeExCommand()],
        },
        { config: {} },
      )
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // Navigate to config and make dirty
      await user.click(screen.getByText('Configuration'))
      const toggle = screen.getByRole('switch')
      await user.click(toggle)

      // Verify dirty indicator is shown in config view
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

      // Switch to Commands (no confirmation needed)
      await user.click(findSidebarButton('Commands'))

      // Switch back to config — dirty state should still be tracked
      await user.click(screen.getByText('Configuration'))
      // The unsaved changes indicator should still be visible (ConfigPanel stays mounted)
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('shows discard confirmation when closing with dirty install version draft', async () => {
      const user = userEvent.setup()
      const displayInfo = makeInstalledDisplayInfo(
        {
          pack: { version: { mode: 'semver-range', value: '1.*' } },
        },
        { config: {} },
      )

      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      await user.click(screen.getByTestId('install-version-mode-custom'))
      await user.type(screen.getByTestId('install-version-value-input'), '2.*')
      await user.click(screen.getByText('Close'))

      await waitFor(() => {
        expect(screen.getByText('Discard Changes')).toBeInTheDocument()
      })
    })
  })

  // ============================================
  // Commands panel
  // ============================================

  describe('commands panel', () => {
    it('renders command name', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        exCommands: [makeExCommand({ name: 'Telescope' })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Commands" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Commands'))
      expect(screen.getByText(':Telescope')).toBeInTheDocument()
    })

    it('renders command description', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        exCommands: [makeExCommand({ description: 'Open telescope picker' })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Commands" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Commands'))
      expect(screen.getByText('Open telescope picker')).toBeInTheDocument()
    })

    it('shows empty state when no commands', async () => {
      // Render CommandsPanel directly to test empty state
      const { CommandsPanel } = await import(
        '../components/detail-panels/CommandsPanel'
      )
      render(<CommandsPanel commands={[]} />)
      expect(screen.getByText('No commands documented')).toBeInTheDocument()
    })
  })

  // ============================================
  // Functions panel
  // ============================================

  describe('functions panel', () => {
    it('renders function name', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        functions: [makeFunction({ name: 'find_files' })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Functions" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Functions'))
      expect(screen.getByText('find_files')).toBeInTheDocument()
    })

    it('renders function description', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        functions: [
          makeFunction({
            description: 'Find files in the current directory',
          }),
        ],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Functions" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Functions'))
      expect(
        screen.getByText('Find files in the current directory'),
      ).toBeInTheDocument()
    })

    it('shows popular badge for popular functions', async () => {
      const user = userEvent.setup()
      const displayInfo = makeAvailableDisplayInfo({
        functions: [makeFunction({ isPopular: true })],
      })
      render(
        <PluginDetailModal
          open={true}
          onOpenChange={vi.fn()}
          displayInfo={displayInfo}
          {...defaultHandlers}
        />,
      )

      // "Functions" appears in sidebar and overview stats — click the sidebar button
      await user.click(findSidebarButton('Functions'))
      expect(screen.getByText('Popular')).toBeInTheDocument()
    })

    it('shows empty state when no functions', async () => {
      const { FunctionsPanel } = await import(
        '../components/detail-panels/FunctionsPanel'
      )
      render(<FunctionsPanel functions={[]} />)
      expect(screen.getByText('No functions documented')).toBeInTheDocument()
    })
  })
})
