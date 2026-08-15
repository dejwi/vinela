import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginCategory } from '@/shared/types'
import { PLUGIN_CATEGORIES, PLUGIN_CATEGORY_LABELS } from '@/shared/types'
import { CategoryFilter } from '../components/CategoryFilter'

// ============================================
// Test Helpers
// ============================================

function makeCategoryCounts(
  overrides?: Partial<Record<PluginCategory, number>>,
): Partial<Record<PluginCategory, number>> {
  // Default: all categories have 2 plugins
  const defaults: Partial<Record<PluginCategory, number>> = {}
  for (const cat of PLUGIN_CATEGORIES) {
    defaults[cat] = 2
  }
  return { ...defaults, ...overrides }
}

// ============================================
// CategoryFilter tests
// ============================================

describe('CategoryFilter', () => {
  it('renders the "All" chip', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Show all plugins' }),
    ).toBeInTheDocument()
  })

  it('renders all categories that have count > 0', () => {
    const counts = makeCategoryCounts()
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={counts}
        totalCount={16}
      />,
    )

    for (const category of PLUGIN_CATEGORIES) {
      const label = PLUGIN_CATEGORY_LABELS[category]
      expect(
        screen.getByRole('button', { name: `Filter by ${label}` }),
      ).toBeInTheDocument()
    }
  })

  it('does not render chips for categories with count 0', () => {
    const counts = makeCategoryCounts({ git: 0, debugging: 0 })
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={counts}
        totalCount={12}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Filter by Git' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Filter by Debugging' }),
    ).toBeNull()
  })

  it('does not render chips for categories absent from counts', () => {
    // Only provide counts for a subset of categories
    const counts: Partial<Record<PluginCategory, number>> = {
      navigation: 3,
      lsp: 5,
    }
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={counts}
        totalCount={8}
      />,
    )

    // Only navigation and lsp should appear
    expect(
      screen.getByRole('button', { name: 'Filter by Navigation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Filter by LSP & Completion' }),
    ).toBeInTheDocument()

    // Others should not appear
    expect(screen.queryByRole('button', { name: 'Filter by Git' })).toBeNull()
  })

  it('shows "All" chip as active (aria-pressed=true) when no category selected', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    const allChip = screen.getByRole('button', { name: 'Show all plugins' })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows category chip as active when that category is selected', () => {
    render(
      <CategoryFilter
        selectedCategory="navigation"
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    const navChip = screen.getByRole('button', { name: 'Filter by Navigation' })
    expect(navChip).toHaveAttribute('aria-pressed', 'true')

    const allChip = screen.getByRole('button', { name: 'Show all plugins' })
    expect(allChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows "All" chip as inactive when a category is selected', () => {
    render(
      <CategoryFilter
        selectedCategory="lsp"
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    const allChip = screen.getByRole('button', { name: 'Show all plugins' })
    expect(allChip).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSelectCategory(null) when "All" chip is clicked', async () => {
    const user = userEvent.setup()
    const onSelectCategory = vi.fn()
    render(
      <CategoryFilter
        selectedCategory="navigation"
        onSelectCategory={onSelectCategory}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show all plugins' }))
    expect(onSelectCategory).toHaveBeenCalledWith(null)
  })

  it('calls onSelectCategory with the category when a chip is clicked', async () => {
    const user = userEvent.setup()
    const onSelectCategory = vi.fn()
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Filter by Navigation' }),
    )
    expect(onSelectCategory).toHaveBeenCalledWith('navigation')
  })

  it('calls onSelectCategory with different categories on successive clicks', async () => {
    const user = userEvent.setup()
    const onSelectCategory = vi.fn()
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={onSelectCategory}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Filter by Git' }))
    expect(onSelectCategory).toHaveBeenLastCalledWith('git')

    await user.click(
      screen.getByRole('button', { name: 'Filter by LSP & Completion' }),
    )
    expect(onSelectCategory).toHaveBeenLastCalledWith('lsp')
  })

  it('shows "Clear" button when a category is selected', () => {
    render(
      <CategoryFilter
        selectedCategory="syntax"
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Clear category filter' }),
    ).toBeInTheDocument()
  })

  it('does not show "Clear" button when no category is selected', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Clear category filter' }),
    ).toBeNull()
  })

  it('calls onSelectCategory(null) when "Clear" button is clicked', async () => {
    const user = userEvent.setup()
    const onSelectCategory = vi.fn()
    render(
      <CategoryFilter
        selectedCategory="editor"
        onSelectCategory={onSelectCategory}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Clear category filter' }),
    )
    expect(onSelectCategory).toHaveBeenCalledWith(null)
  })

  it('displays the total count on the "All" chip', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={42}
      />,
    )

    // The "All" chip should contain "42" somewhere
    const allChip = screen.getByRole('button', { name: 'Show all plugins' })
    expect(allChip).toHaveTextContent('42')
  })

  it('displays per-category counts on chips', () => {
    const counts: Partial<Record<PluginCategory, number>> = {
      navigation: 7,
      lsp: 3,
    }
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={counts}
        totalCount={10}
      />,
    )

    const navChip = screen.getByRole('button', { name: 'Filter by Navigation' })
    expect(navChip).toHaveTextContent('7')

    const lspChip = screen.getByRole('button', {
      name: 'Filter by LSP & Completion',
    })
    expect(lspChip).toHaveTextContent('3')
  })

  it('applies primary background class to active chip', () => {
    render(
      <CategoryFilter
        selectedCategory="git"
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    const gitChip = screen.getByRole('button', { name: 'Filter by Git' })
    expect(gitChip.className).toContain('bg-primary')
  })

  it('applies muted background class to inactive chips', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={makeCategoryCounts()}
        totalCount={16}
      />,
    )

    // All category chips should be inactive (muted)
    const navChip = screen.getByRole('button', { name: 'Filter by Navigation' })
    expect(navChip.className).toContain('bg-muted')
  })

  it('renders with empty counts (no category chips)', () => {
    render(
      <CategoryFilter
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        categoryCounts={{}}
        totalCount={0}
      />,
    )

    // Only "All" chip should be present
    expect(
      screen.getByRole('button', { name: 'Show all plugins' }),
    ).toBeInTheDocument()
    // No category chips
    for (const category of PLUGIN_CATEGORIES) {
      const label = PLUGIN_CATEGORY_LABELS[category]
      expect(
        screen.queryByRole('button', { name: `Filter by ${label}` }),
      ).toBeNull()
    }
  })
})
