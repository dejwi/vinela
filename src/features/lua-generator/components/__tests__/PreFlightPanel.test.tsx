import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeymapStore } from '@/features/keymaps/store'
import { usePluginStore } from '@/features/plugins/store'
import type { TargetNeovimPreflightState } from '../../lib/target-neovim'
import { useGenerationStore } from '../../store'
import { PreFlightPanel } from '../PreFlightPanel'

vi.mock('@/features/plugins/store', () => ({
  usePluginStore: vi.fn(),
}))

vi.mock('@/features/keymaps/store', () => ({
  useKeymapStore: vi.fn(),
}))

vi.mock('../../store', () => ({
  useGenerationStore: vi.fn(),
}))

function mockStores(preflight: TargetNeovimPreflightState): void {
  vi.mocked(usePluginStore).mockImplementation((selector) => {
    const state = { installedPlugins: [] }
    return selector ? selector(state as never) : (state as never)
  })
  vi.mocked(useKeymapStore).mockImplementation((selector) => {
    const state = { manualKeymaps: [] }
    return selector ? selector(state as never) : (state as never)
  })
  vi.mocked(useGenerationStore).mockImplementation((selector) => {
    const state = { targetNeovimPreflight: preflight }
    return selector ? selector(state as never) : (state as never)
  })
}

describe('PreFlightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders pre-flight summary', () => {
    mockStores({
      kind: 'ready',
      requestId: 1,
      snapshot: { kind: 'unavailable', reason: 'memory-mode' },
    })
    render(<PreFlightPanel />)

    expect(screen.getByText('Plugins')).toBeInTheDocument()
    expect(screen.getByText('Keymaps')).toBeInTheDocument()
    expect(screen.getByText('Neovim Options')).toBeInTheDocument()
    expect(screen.getByText('Graphs')).toBeInTheDocument()
  })

  it('shows loading state while target Neovim preflight resolves', () => {
    mockStores({ kind: 'loading', requestId: 1 })
    render(<PreFlightPanel />)
    expect(
      screen.getByText(/Detecting local Neovim version/i),
    ).toBeInTheDocument()
  })

  it('shows strong callout for detected old Neovim versions', () => {
    mockStores({
      kind: 'ready',
      requestId: 1,
      snapshot: {
        kind: 'detected',
        version: '0.11.4',
        versionDisplay: 'NVIM v0.11.4',
      },
    })
    render(<PreFlightPanel />)
    expect(
      screen.getByText('Neovim version below Vinela baseline'),
    ).toBeInTheDocument()
  })

  it('shows soft callout when desktop Neovim is undetected', () => {
    mockStores({
      kind: 'ready',
      requestId: 1,
      snapshot: { kind: 'undetected', reason: 'not-in-path' },
    })
    render(<PreFlightPanel />)
    expect(
      screen.getByText('Could not verify local Neovim version'),
    ).toBeInTheDocument()
  })

  it('shows no callout for supported detected versions', () => {
    mockStores({
      kind: 'ready',
      requestId: 1,
      snapshot: {
        kind: 'detected',
        version: '0.12.4',
        versionDisplay: 'NVIM v0.12.4',
      },
    })
    render(<PreFlightPanel />)
    expect(
      screen.queryByText('Neovim version below Vinela baseline'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Could not verify local Neovim version'),
    ).not.toBeInTheDocument()
  })

  it('shows plugin count when plugins are installed', () => {
    mockStores({
      kind: 'ready',
      requestId: 1,
      snapshot: { kind: 'unavailable', reason: 'memory-mode' },
    })
    vi.mocked(usePluginStore).mockImplementation((selector) => {
      const state = {
        installedPlugins: [
          { id: '1', schemaId: 'schema1', enabled: true, config: {} },
          { id: '2', schemaId: 'schema2', enabled: true, config: {} },
        ],
      }
      return selector ? selector(state as never) : (state as never)
    })

    render(<PreFlightPanel />)
    expect(screen.getByText('2 plugin(s) with setup calls')).toBeInTheDocument()
  })
})
