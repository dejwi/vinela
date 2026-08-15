/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectState } from '@/features/projects/store'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'

const mockImportSchema = vi.fn()
const mockDeleteSchema = vi.fn()

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
}))

vi.mock('../hooks/usePlugins', () => ({
  usePlugins: vi.fn(),
  usePluginActions: vi.fn(() => ({
    installPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    togglePlugin: vi.fn(),
    updatePluginConfig: vi.fn(),
    updateLuaFieldOverride: vi.fn(),
    clearLuaFieldOverride: vi.fn(),
    updatePluginInstallOverride: vi.fn(),
    clearPluginInstallOverride: vi.fn(),
    resetPluginToDefaults: vi.fn(),
    exportStandalone: vi.fn(),
    importSchema: mockImportSchema,
    deleteSchema: mockDeleteSchema,
    actionState: { installing: [], uninstalling: [], deletingSchemas: [] },
  })),
}))

import { useProjectStore } from '@/features/projects/store'
import { usePlugins } from '../hooks/usePlugins'
import PluginsPage from '../pages/list'
import { usePluginStore } from '../store'

function makeSchema(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'plugin-a',
    pluginName: 'Plugin A',
    pluginRepo: 'https://github.com/example/plugin-a',
    version: '1.0.0',
    category: 'lsp',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeInstalled(
  schema: PluginSchema,
  overrides?: Partial<InstalledPlugin>,
): InstalledPlugin {
  return {
    schemaId: schema.id,
    enabled: true,
    config: {},
    addedAt: Date.now(),
    ...overrides,
  }
}

function setupProjectStore(): void {
  vi.mocked(useProjectStore).mockImplementation(
    (selector: (state: ProjectState) => unknown) =>
      selector({
        currentProject: {
          id: 'test-project',
          name: 'Test Project',
          createdAt: 0,
          lastModifiedAt: 0,
          absolutePath: '/memory/test-project',
        },
      } as ProjectState),
  )
}

function setupPluginsHook(): void {
  vi.mocked(usePlugins).mockReturnValue({
    isLoading: false,
    initStatus: { status: 'ready', projectPath: '/memory/test-project' },
    error: null,
    retry: vi.fn(),
    plugins: [],
    installPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    togglePlugin: vi.fn(),
    updatePluginConfig: vi.fn(),
    updateLuaFieldOverride: vi.fn(),
    clearLuaFieldOverride: vi.fn(),
    updatePluginInstallOverride: vi.fn(),
    clearPluginInstallOverride: vi.fn(),
    resetPluginToDefaults: vi.fn(),
    exportStandalone: vi.fn(),
    importSchema: vi.fn(),
    deleteSchema: vi.fn(),
    actionState: { installing: [], uninstalling: [], deletingSchemas: [] },
  })
}

describe('PluginsPage browse integration', () => {
  beforeEach(() => {
    usePluginStore.getState().resetForProjectClose()
    setupProjectStore()
    setupPluginsHook()
    vi.clearAllMocks()
  })

  it('shows installed-only empty state when all catalog plugins are installed', async () => {
    const installed = makeSchema({
      id: 'installed-only',
      pluginName: 'Installed Only',
    })

    usePluginStore.setState({
      schemas: [{ schema: installed, source: 'builtin' }],
      installedPlugins: [makeInstalled(installed)],
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(
      screen.getByText('All available plugins are installed'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).toBeNull()
    expect(
      screen.getByRole('tab', { name: /Browse \(0\)/ }),
    ).toBeInTheDocument()
  })

  it('shows generic empty catalog copy when nothing is available or installed', () => {
    usePluginStore.setState({
      schemas: [],
      installedPlugins: [],
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(screen.getByText('No available plugins')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).toBeNull()
  })

  it('shows filter empty state with clear controls when search has no matches', async () => {
    const user = userEvent.setup()
    const available = makeSchema({
      id: 'available-a',
      pluginName: 'Available A',
    })

    usePluginStore.setState({
      schemas: [{ schema: available, source: 'builtin' }],
      installedPlugins: [],
      searchQuery: 'missing',
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(screen.getByText('No plugins found')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear search' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Clear all filters' }),
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(usePluginStore.getState().searchQuery).toBe('')
  })

  it('shows category-only empty state and clears category filter', async () => {
    const user = userEvent.setup()
    const available = makeSchema({
      id: 'available-lsp',
      pluginName: 'Available LSP',
      category: 'lsp',
    })

    usePluginStore.setState({
      schemas: [{ schema: available, source: 'builtin' }],
      installedPlugins: [],
      selectedCategory: 'git',
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(screen.getByText('No plugins found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Clear all filters' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(usePluginStore.getState().selectedCategory).toBeNull()
    expect(usePluginStore.getState().searchQuery).toBe('')
  })

  it('shows combined search and category empty state with independent clear controls', async () => {
    const user = userEvent.setup()
    const available = makeSchema({
      id: 'available-lsp',
      pluginName: 'Available LSP',
      category: 'lsp',
    })

    usePluginStore.setState({
      schemas: [{ schema: available, source: 'builtin' }],
      installedPlugins: [],
      searchQuery: 'missing',
      selectedCategory: 'git',
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(screen.getByText('No plugins found')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear search' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Clear all filters' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(usePluginStore.getState().searchQuery).toBe('')
    expect(usePluginStore.getState().selectedCategory).toBe('git')
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Clear all filters' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No plugins found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(usePluginStore.getState().selectedCategory).toBeNull()
    expect(usePluginStore.getState().searchQuery).toBe('')
    expect(screen.getByText('Available LSP')).toBeInTheDocument()
  })

  it('excludes installed, disabled installed, and orphaned plugins from browse cards and counts', async () => {
    const user = userEvent.setup()
    const available = makeSchema({
      id: 'browse-card',
      pluginName: 'Browse Card',
      category: 'git',
    })
    const installed = makeSchema({
      id: 'installed-card',
      pluginName: 'Installed Card',
      category: 'git',
    })
    const disabledInstalled = makeSchema({
      id: 'disabled-card',
      pluginName: 'Disabled Card',
      category: 'git',
    })
    const orphanedInstalled: InstalledPlugin = {
      schemaId: 'orphan-card',
      enabled: false,
      config: {},
      addedAt: 1,
    }

    usePluginStore.setState({
      schemas: [
        { schema: available, source: 'builtin' },
        { schema: installed, source: 'builtin' },
        { schema: disabledInstalled, source: 'builtin' },
      ],
      installedPlugins: [
        makeInstalled(installed),
        makeInstalled(disabledInstalled, { enabled: false }),
        orphanedInstalled,
      ],
      initStatus: { status: 'ready', projectPath: '/memory/test-project' },
      activeTab: 'browse',
    })

    render(<PluginsPage />)

    expect(
      screen.getByRole('tab', { name: /Browse \(1\)/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Browse Card')).toBeInTheDocument()
    expect(screen.queryByText('Installed Card')).toBeNull()
    expect(screen.queryByText('Disabled Card')).toBeNull()

    const allChip = screen.getByRole('button', { name: 'Show all plugins' })
    expect(within(allChip).getByText('1')).toBeInTheDocument()

    const gitChip = screen.getByRole('button', { name: 'Filter by Git' })
    expect(within(gitChip).getByText('1')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Installed/ }))
    expect(screen.getByText('Installed Card')).toBeInTheDocument()
    expect(screen.getByText('Disabled Card')).toBeInTheDocument()
    expect(screen.getByText('orphan-card')).toBeInTheDocument()
  })
})
