import { useMemo } from 'react'
import type { CatalogEntry } from '@/shared/types/catalog'
import { useCatalog } from './useCatalog'

/**
 * Hook that provides a lookup function for catalog entries.
 * Returns a memoized Map for O(1) lookups.
 */
export function useCatalogLookup(): {
  findByKey: (key: string) => CatalogEntry | undefined
  catalog: CatalogEntry[]
} {
  const catalog = useCatalog()

  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogEntry>()
    for (const entry of catalog) {
      map.set(entry.key, entry)
    }
    return map
  }, [catalog])

  const findByKey = useMemo(
    () => (key: string) => catalogMap.get(key),
    [catalogMap],
  )

  return { findByKey, catalog }
}
