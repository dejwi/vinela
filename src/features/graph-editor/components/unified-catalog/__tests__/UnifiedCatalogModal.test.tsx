// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { UnifiedCatalogModal } from '../UnifiedCatalogModal'

// Mock the plugin store
vi.mock('@/features/plugins', () => ({
  usePluginStore: vi.fn((selector) => {
    const state = {
      schemas: [],
      installedPlugins: [],
    }
    return selector ? selector(state) : state
  }),
}))

// Helper to render with required providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('UnifiedCatalogModal', () => {
  it('renders when open', () => {
    renderWithProviders(
      <UnifiedCatalogModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    )

    // Check for search input
    expect(
      screen.getByPlaceholderText('Search actions and functions...'),
    ).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderWithProviders(
      <UnifiedCatalogModal open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    )

    // Search input should not be present
    expect(
      screen.queryByPlaceholderText('Search actions and functions...'),
    ).not.toBeInTheDocument()
  })

  it('shows sidebar with views and categories', () => {
    renderWithProviders(
      <UnifiedCatalogModal open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    )

    // Check for view buttons
    expect(screen.getByText('Popular')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()

    // Check for category headers
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Sources')).toBeInTheDocument()
  })
})
