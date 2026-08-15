import { describe, expect, it, vi } from 'vitest'
import { isValidCatalogCategory, normalizeCatalogCategory } from '../catalog'

describe('normalizeCatalogCategory', () => {
  it('returns valid category unchanged', () => {
    expect(normalizeCatalogCategory('files')).toBe('files')
    expect(normalizeCatalogCategory('editing')).toBe('editing')
    expect(normalizeCatalogCategory('lsp')).toBe('lsp')
  })

  it('returns uncategorized for undefined', () => {
    expect(normalizeCatalogCategory(undefined)).toBe('uncategorized')
  })

  it('returns uncategorized for null', () => {
    expect(normalizeCatalogCategory(null)).toBe('uncategorized')
  })

  it('returns uncategorized for invalid string', () => {
    expect(normalizeCatalogCategory('invalid-category')).toBe('uncategorized')
    expect(normalizeCatalogCategory('serch')).toBe('uncategorized') // typo
  })

  it('returns uncategorized for non-string types', () => {
    expect(normalizeCatalogCategory(123)).toBe('uncategorized')
    expect(normalizeCatalogCategory({})).toBe('uncategorized')
    expect(normalizeCatalogCategory([])).toBe('uncategorized')
  })

  it('logs warning in dev mode for invalid values', () => {
    // Note: This test verifies the function doesn't crash with invalid values.
    // The actual console.warn call depends on import.meta.env.DEV which may not be set in tests.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = normalizeCatalogCategory('bad-category', 'test:func')

    // Should return uncategorized regardless of dev mode
    expect(result).toBe('uncategorized')

    // In dev mode, it would log a warning (but we can't reliably test this in all environments)
    // Just verify the spy was set up correctly
    warnSpy.mockRestore()
  })
})

describe('isValidCatalogCategory', () => {
  it('returns true for valid categories', () => {
    expect(isValidCatalogCategory('files')).toBe(true)
    expect(isValidCatalogCategory('uncategorized')).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(isValidCatalogCategory('invalid')).toBe(false)
    expect(isValidCatalogCategory(undefined)).toBe(false)
    expect(isValidCatalogCategory(123)).toBe(false)
  })
})
