/**
 * HomeRoute tests
 *
 * Tests for: Redirect to /plugins when project is loaded
 *
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
}))

import { useProjectStore } from '@/features/projects/store'
import { HomeRoute } from '../home-route'

// ── Helpers ───────────────────────────────────────────────────────────────────

import type { ProjectState } from '@/features/projects/store'

function setupProjectStore(currentProject: object | null) {
  vi.mocked(useProjectStore).mockImplementation(
    (selector: (state: ProjectState) => unknown) =>
      selector({ currentProject } as ProjectState),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HomeRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /plugins when a project is loaded', () => {
    setupProjectStore({
      id: 'test-project',
      name: 'Test Project',
      createdAt: Date.now(),
      lastModifiedAt: Date.now(),
      absolutePath: '/test/project',
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route
            path="/plugins"
            element={<div data-testid="plugins-page">Plugins Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    )

    // Should have redirected to /plugins
    expect(screen.getByTestId('plugins-page')).toBeInTheDocument()
  })

  it('renders loading state when no project is loaded', () => {
    setupProjectStore(null)

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route
            path="/plugins"
            element={<div data-testid="plugins-page">Plugins Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    )

    // Should show loading state (from Suspense fallback while lazy loading StartScreen)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
