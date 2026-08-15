import { render, screen } from '@testing-library/react'
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
import { isMemoryMode } from '@/shared/lib/storage'

describe('MemoryModeIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not memory mode and not tutorial project', () => {
    vi.mocked(isMemoryMode).mockReturnValue(false)
    vi.mocked(useProjectStore).mockImplementation(
      (selector: (state: ProjectState) => unknown) =>
        selector({ isTutorialProject: false } as ProjectState),
    )

    const { container } = render(<MemoryModeIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders only Memory Mode when memory mode is true but not tutorial', () => {
    vi.mocked(isMemoryMode).mockReturnValue(true)
    vi.mocked(useProjectStore).mockImplementation(
      (selector: (state: ProjectState) => unknown) =>
        selector({ isTutorialProject: false } as ProjectState),
    )

    render(<MemoryModeIndicator />)

    expect(screen.getByText('Memory Mode')).toBeInTheDocument()
    expect(screen.queryByText('Tutorial')).not.toBeInTheDocument()
  })

  it('renders only Tutorial when tutorial is true but not memory mode', () => {
    vi.mocked(isMemoryMode).mockReturnValue(false)
    vi.mocked(useProjectStore).mockImplementation(
      (selector: (state: ProjectState) => unknown) =>
        selector({ isTutorialProject: true } as ProjectState),
    )

    render(<MemoryModeIndicator />)

    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(screen.queryByText('Memory Mode')).not.toBeInTheDocument()
  })

  it('renders both when both are true', () => {
    vi.mocked(isMemoryMode).mockReturnValue(true)
    vi.mocked(useProjectStore).mockImplementation(
      (selector: (state: ProjectState) => unknown) =>
        selector({ isTutorialProject: true } as ProjectState),
    )

    render(<MemoryModeIndicator />)

    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(screen.getByText('Memory Mode')).toBeInTheDocument()
  })
})
