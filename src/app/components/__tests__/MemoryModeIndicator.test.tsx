import { render as rtlRender, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryModeIndicator } from '../MemoryModeIndicator'

// Mock storage
vi.mock('@/shared/lib/storage', () => ({
  isMemoryMode: vi.fn(),
}))

// Mock project store
vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
}))

import type { ProjectState } from '@/features/projects/store'
import { useProjectStore } from '@/features/projects/store'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { APP_REPO_URL } from '@/shared/lib/app-identity'
import { isMemoryMode } from '@/shared/lib/storage'

// The badge's tooltip requires a TooltipProvider, mounted app-wide in Providers.
function render(ui: React.ReactElement): ReturnType<typeof rtlRender> {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>)
}

function mockState(memory: boolean, tutorial: boolean): void {
  vi.mocked(isMemoryMode).mockReturnValue(memory)
  vi.mocked(useProjectStore).mockImplementation(
    (selector: (state: ProjectState) => unknown) =>
      selector({ isTutorialProject: tutorial } as ProjectState),
  )
}

describe('MemoryModeIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not memory mode and not tutorial project', () => {
    mockState(false, false)

    const { container } = render(<MemoryModeIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders only the demo repo link when memory mode is true but not tutorial', () => {
    mockState(true, false)

    render(<MemoryModeIndicator />)

    const link = screen.getByRole('link', { name: /demo of vinela/i })
    expect(link).toHaveAttribute('href', APP_REPO_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.queryByText('Tutorial')).not.toBeInTheDocument()
  })

  it('renders only Tutorial when tutorial is true but not memory mode', () => {
    mockState(false, true)

    render(<MemoryModeIndicator />)

    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /demo of vinela/i }),
    ).not.toBeInTheDocument()
  })

  it('renders both when both are true', () => {
    mockState(true, true)

    render(<MemoryModeIndicator />)

    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /demo of vinela/i }),
    ).toBeInTheDocument()
  })
})
