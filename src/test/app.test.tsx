import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Sidebar } from '../app/components/sidebar'
import { Providers } from '../app/providers'

// Test the layout renders correctly
describe('App Layout', () => {
  it('renders the sidebar navigation', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    // Check navigation icons are present (by title attribute)
    expect(screen.getByTitle('Graph Editor')).toBeInTheDocument()
    expect(screen.getByTitle('Plugins')).toBeInTheDocument()
    expect(screen.getByTitle('Keymaps')).toBeInTheDocument()
    expect(screen.getByTitle('Settings')).toBeInTheDocument()
  })

  it('renders navigation items in the correct order', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    // Expected order: Plugins, Keymaps, Neovim Options, Color Schemes, Graph Editor, Settings
    const expectedOrder = [
      'Plugins',
      'Keymaps',
      'Neovim Options',
      'Color Schemes',
      'Graph Editor',
      'Settings',
    ]

    const navTitles = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('title'))

    // Filter to just the expected items (skip project dropdown if present)
    const filteredNavTitles = navTitles.filter((title) =>
      expectedOrder.includes(title ?? ''),
    )

    expect(filteredNavTitles).toEqual(expectedOrder)
  })

  it('renders pages within providers', async () => {
    // Test that providers wrap content correctly
    render(
      <Providers>
        <div>Test content</div>
      </Providers>,
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
