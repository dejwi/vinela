import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenerationDiagnostic } from '../../types'
import { DiagnosticList } from '../DiagnosticList'

// Mock the navigation intent store
vi.mock('@/shared/lib/navigation-intent', () => ({
  useNavigationIntentStore: {
    getState: vi.fn(() => ({
      setFocusNode: vi.fn(),
    })),
  },
}))

// Mock the generation store
vi.mock('../../store', () => ({
  useGenerationStore: vi.fn((selector) => {
    const state = { closeDialog: vi.fn() }
    return selector ? selector(state) : state
  }),
}))

describe('DiagnosticList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty list when no diagnostics', () => {
    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Diagnostics')).toBeInTheDocument()
  })

  it('shows error count badge', () => {
    const diagnostics: GenerationDiagnostic[] = [
      { id: '1', severity: 'error', category: 'config', message: 'Error 1' },
      { id: '2', severity: 'error', category: 'config', message: 'Error 2' },
      {
        id: '3',
        severity: 'warning',
        category: 'config',
        message: 'Warning 1',
      },
    ]

    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={diagnostics} />
      </MemoryRouter>,
    )

    expect(screen.getByText('2 errors')).toBeInTheDocument()
    expect(screen.getByText('1 warning')).toBeInTheDocument()
  })

  it('sorts errors before warnings', () => {
    const diagnostics: GenerationDiagnostic[] = [
      {
        id: '1',
        severity: 'warning',
        category: 'config',
        message: 'Warning first',
      },
      {
        id: '2',
        severity: 'error',
        category: 'config',
        message: 'Error second',
      },
    ]

    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={diagnostics} />
      </MemoryRouter>,
    )

    const items = screen.getAllByText(/first|second/)
    expect(items[0]).toHaveTextContent('Error second')
    expect(items[1]).toHaveTextContent('Warning first')
  })

  it('shows source location for navigable diagnostics', () => {
    const diagnostics: GenerationDiagnostic[] = [
      {
        id: '1',
        severity: 'error',
        category: 'config',
        message: 'Test error',
        source: {
          graphId: 'graph-1',
          graphName: 'My Config',
          nodeId: 'node-1',
        },
      },
    ]

    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={diagnostics} />
      </MemoryRouter>,
    )

    // Should show graphName in the "Go to" button, not raw graphId
    expect(screen.getByText(/Go to/)).toHaveTextContent('Go to My Config')
  })

  it('falls back to graphId when graphName is absent', () => {
    const diagnostics: GenerationDiagnostic[] = [
      {
        id: '1',
        severity: 'error',
        category: 'config',
        message: 'Test error',
        source: { graphId: 'graph-uuid-1234', nodeId: 'node-1' },
      },
    ]

    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={diagnostics} />
      </MemoryRouter>,
    )

    // Falls back to graphId when graphName is missing
    expect(screen.getByText(/Go to/)).toHaveTextContent('Go to graph-uuid-1234')
  })

  it('shows message for each diagnostic', () => {
    const diagnostics: GenerationDiagnostic[] = [
      {
        id: '1',
        severity: 'error',
        category: 'config',
        message: 'First error message',
      },
      {
        id: '2',
        severity: 'warning',
        category: 'reference',
        message: 'Second warning message',
      },
    ]

    render(
      <MemoryRouter>
        <DiagnosticList diagnostics={diagnostics} />
      </MemoryRouter>,
    )

    expect(screen.getByText('First error message')).toBeInTheDocument()
    expect(screen.getByText('Second warning message')).toBeInTheDocument()
  })
})
