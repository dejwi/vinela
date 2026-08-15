import type { ColorSchemeCatalogEntry } from '@/shared/types/colorscheme'
import catalogData from './catalog.json'

/**
 * The bundled color scheme catalog.
 * Contains metadata and color definitions for all available themes.
 */
export const catalog: ColorSchemeCatalogEntry[] =
  catalogData as ColorSchemeCatalogEntry[]

/**
 * Get a color scheme by ID.
 */
export function getColorSchemeById(
  id: string,
): ColorSchemeCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id)
}

/**
 * Get all color schemes matching a variant filter.
 */
export function getColorSchemesByVariant(
  variant: 'dark' | 'light' | 'both',
): ColorSchemeCatalogEntry[] {
  return catalog.filter(
    (entry) => entry.variant === variant || entry.variant === 'both',
  )
}

export default catalog
