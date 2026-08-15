// Hook for building and filtering the unified action/function catalog

import { useMemo } from 'react'
import { usePluginStore } from '@/features/plugins'
import { buildCatalog } from '@/shared/data/catalog-builder'
import { ACTION_CATALOG } from '@/shared/data/neovim/action-catalog-entries'
import type { CatalogEntry } from '@/shared/types/catalog'

/**
 * Build unified catalog from core entries and installed plugin schemas.
 * Automatically filters to only installed plugins.
 */
export function useCatalog(): CatalogEntry[] {
  const schemas = usePluginStore((s) => s.schemas)
  const installedPlugins = usePluginStore((s) => s.installedPlugins)

  // Get schemas for installed and enabled plugins only
  const installedSchemas = useMemo(() => {
    const enabledIds = new Set(
      installedPlugins.filter((p) => p.enabled).map((p) => p.schemaId),
    )
    return schemas.filter((rs) => enabledIds.has(rs.schema.id))
  }, [installedPlugins, schemas])

  // Build catalog from core entries + installed plugin schemas
  const catalog = useMemo(
    () => buildCatalog(ACTION_CATALOG, installedSchemas),
    [installedSchemas],
  )

  return catalog
}
