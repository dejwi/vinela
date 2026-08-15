import { Package, RotateCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProjectStore } from '@/features/projects/store'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'
import type { AvailablePluginDisplayInfo } from '@/shared/types'
import { BrowseSortDropdown } from '../components/BrowseSortDropdown'
import { CategoryFilter } from '../components/CategoryFilter'
import type { ImportResult } from '../components/ImportGitHubDialog'
import { ImportGitHubDialog } from '../components/ImportGitHubDialog'
import { ImportJsonDialog } from '../components/ImportJsonDialog'
import { InstalledSortDropdown } from '../components/InstalledSortDropdown'
import { OrphanedPluginCard } from '../components/OrphanedPluginCard'
import { PluginDetailModal } from '../components/PluginDetailModal'
import {
  InstalledPluginGridCard,
  PluginGridCard,
} from '../components/PluginGridCard'
import { PluginsHeader } from '../components/PluginsHeader'
import { usePluginActions, usePlugins } from '../hooks/usePlugins'
import { usePluginsPage } from '../hooks/usePluginsPage'
import { seedWithLuaDefaults } from '../utils/seed-defaults'

// ============================================
// Stable interfaces for child components
// ============================================

/**
 * Props interface for the PluginGridCard component.
 * Exported here so child components can implement against this stable contract.
 */
export interface PluginGridCardProps {
  displayInfo: AvailablePluginDisplayInfo
  onClick: (schemaId: string) => void
}

// ============================================
// Empty state components
// ============================================

function InstalledEmptyState({
  hasSearch,
}: {
  hasSearch: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      {hasSearch ? (
        <>
          <Search className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-base font-medium">No matching plugins</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </>
      ) : (
        <>
          <Package className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-base font-medium">No installed plugins</p>
          <p className="text-sm mt-1">
            Browse the Browse tab to find and install plugins
          </p>
        </>
      )}
    </div>
  )
}

interface BrowseEmptyStateProps {
  searchQuery: string
  hasCategory: boolean
  hasInstalledPlugins: boolean
  onClearSearch: () => void
  onClearFilters: () => void
}

function BrowseEmptyState({
  searchQuery,
  hasCategory,
  hasInstalledPlugins,
  onClearSearch,
  onClearFilters,
}: BrowseEmptyStateProps): React.JSX.Element {
  const hasSearch = searchQuery !== ''
  const hasFilters = hasCategory
  const hasActiveFilters = hasSearch || hasFilters

  if (!hasActiveFilters && hasInstalledPlugins) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-base font-medium">
          All available plugins are installed
        </p>
        <p className="text-sm mt-1">
          Check the Installed tab to manage your plugins
        </p>
      </div>
    )
  }

  if (!hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-base font-medium">No available plugins</p>
        <p className="text-sm mt-1">
          Import a schema to add plugins to your catalog
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <Search className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-base font-medium">No plugins found</p>
      {hasSearch && (
        <p className="text-sm mt-1">
          No results for{' '}
          <span className="font-medium text-foreground">
            &ldquo;{searchQuery}&rdquo;
          </span>
        </p>
      )}
      <div className="flex items-center gap-2 mt-4">
        {hasSearch && (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        )}
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================
// Main page component
// ============================================

export default function PluginsPage(): React.JSX.Element {
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const { isLoading, error, retry } = usePlugins()
  const {
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginConfig,
    updateLuaFieldOverride,
    clearLuaFieldOverride,
    updatePluginInstallOverride,
    clearPluginInstallOverride,
    resetPluginToDefaults,
    exportStandalone,
    importSchema,
    deleteSchema,
    actionState,
  } = usePluginActions()

  // Page-level UI state from store (persists across tab switches)
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    installedSort,
    setInstalledSort,
    browseSort,
    setBrowseSort,
    selectedCategory,
    setSelectedCategory,
    allPlugins,
    filteredInstalledPlugins,
    filteredBrowsePlugins,
    browseTotalCount,
    browseCategoryCounts,
  } = usePluginsPage()

  // Selected plugin for detail modal
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null)

  // Import dialog state
  const [showImportJson, setShowImportJson] = useState(false)
  const [showImportGitHub, setShowImportGitHub] = useState(false)

  // Tutorial bridge: listen for DOM events to open/close the plugin detail modal
  useEffect(() => {
    const handleOpenModal = (event: Event): void => {
      const customEvent = event as CustomEvent<{ schemaId: string }>
      setSelectedPluginId(customEvent.detail.schemaId)
    }
    const handleCloseModal = (): void => {
      setSelectedPluginId(null)
    }

    window.addEventListener('tutorial:open-plugin-modal', handleOpenModal)
    window.addEventListener('tutorial:close-plugin-modal', handleCloseModal)

    return () => {
      window.removeEventListener('tutorial:open-plugin-modal', handleOpenModal)
      window.removeEventListener(
        'tutorial:close-plugin-modal',
        handleCloseModal,
      )
    }
  }, [])

  if (projectPath === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No project loaded</p>
      </div>
    )
  }

  // Find the selected plugin from the full unfiltered list so the modal opens
  // regardless of active category filter or browse search query.
  const selectedPlugin =
    selectedPluginId !== null
      ? allPlugins.find(
          (p) =>
            (p.status === 'orphaned' ? p.schemaId : p.schema.id) ===
            selectedPluginId,
        )
      : undefined

  // Handle import results from either dialog
  // projectPath is guaranteed non-undefined here (early return above)
  const resolvedProjectPath = projectPath
  function handleImportResult(result: ImportResult): void {
    void importSchema(
      resolvedProjectPath,
      result.schema,
      result.type === 'install',
      result.scope,
    )
  }

  return (
    <ScrollArea className="h-full">
      <div data-tutorial="plugins-page" className="p-6 space-y-6 max-w-5xl">
        {/* Header: title, search, import/export buttons */}
        <PluginsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onImportClick={() => setShowImportJson(true)}
          onImportGitHubClick={() => setShowImportGitHub(true)}
          onExportStandaloneClick={() => exportStandalone(projectPath)}
        />

        {/* Error banner */}
        {error !== null && (
          <div className="flex items-center justify-between p-3 rounded border border-destructive text-destructive text-sm">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              className="shrink-0 ml-3"
            >
              <RotateCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Tabbed content */}
        {!isLoading && (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'installed' | 'browse')}
          >
            <TabsList>
              <TabsTrigger value="installed">
                Installed ({filteredInstalledPlugins.length})
              </TabsTrigger>
              <TabsTrigger value="browse">
                Browse ({filteredBrowsePlugins.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Installed Tab ── */}
            <TabsContent value="installed" className="space-y-4 mt-4">
              {/* Sort control */}
              {filteredInstalledPlugins.length > 0 && (
                <div className="flex items-center justify-end">
                  <InstalledSortDropdown
                    value={installedSort}
                    onChange={setInstalledSort}
                  />
                </div>
              )}

              {/* Plugin grid */}
              {filteredInstalledPlugins.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredInstalledPlugins.map((p) => {
                    if (p.status === 'orphaned') {
                      return (
                        <OrphanedPluginCard
                          key={p.schemaId}
                          schemaId={p.schemaId}
                          installed={p.installed}
                          onRemove={(id) =>
                            void uninstallPlugin(projectPath, id)
                          }
                          onFindSchema={() => setShowImportGitHub(true)}
                        />
                      )
                    }

                    if (p.status === 'installed') {
                      return (
                        <InstalledPluginGridCard
                          key={p.schema.id}
                          displayInfo={p}
                          onToggle={() =>
                            togglePlugin(
                              projectPath,
                              p.schema.id,
                              !p.installed.enabled,
                            )
                          }
                          onUninstall={() => setSelectedPluginId(p.schema.id)}
                          onConfigure={() => setSelectedPluginId(p.schema.id)}
                        />
                      )
                    }

                    // Fallback for 'available' which shouldn't happen in the installed tab
                    return null
                  })}
                </div>
              ) : (
                <InstalledEmptyState hasSearch={searchQuery !== ''} />
              )}
            </TabsContent>

            {/* ── Browse Tab ── */}
            <TabsContent value="browse" className="space-y-4 mt-4">
              {/* Category filter chips */}
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categoryCounts={browseCategoryCounts}
                totalCount={browseTotalCount}
              />

              {/* Sort control */}
              <div className="flex items-center justify-end">
                <BrowseSortDropdown
                  value={browseSort}
                  onChange={setBrowseSort}
                />
              </div>

              {/* Plugin grid */}
              {filteredBrowsePlugins.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBrowsePlugins.map((p) => (
                    <PluginGridCard
                      key={p.schema.id}
                      displayInfo={p}
                      onClick={(id) => setSelectedPluginId(id)}
                    />
                  ))}
                </div>
              ) : (
                <BrowseEmptyState
                  searchQuery={searchQuery}
                  hasCategory={selectedCategory !== null}
                  hasInstalledPlugins={allPlugins.some(
                    (p) => p.status === 'installed' || p.status === 'orphaned',
                  )}
                  onClearSearch={() => setSearchQuery('')}
                  onClearFilters={() => {
                    setSelectedCategory(null)
                    setSearchQuery('')
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* ── Plugin Detail Modal ── */}
      {selectedPlugin !== undefined && selectedPlugin.status !== 'orphaned' && (
        <PluginDetailModal
          open={selectedPluginId !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPluginId(null)
          }}
          displayInfo={selectedPlugin}
          onInstall={async (schemaId) => {
            await installPlugin(projectPath, schemaId)
          }}
          onUninstall={async (schemaId) => {
            await uninstallPlugin(projectPath, schemaId)
            setSelectedPluginId(null)
          }}
          onDeleteSchema={async (schemaId, source) => {
            await deleteSchema(projectPath, schemaId, source)
            setSelectedPluginId(null)
          }}
          onToggle={async (schemaId, enabled) => {
            await togglePlugin(projectPath, schemaId, enabled)
          }}
          onConfigChange={(schemaId, config) => {
            void updatePluginConfig(projectPath, schemaId, config)
          }}
          onInstallOverrideChange={(schemaId, override) =>
            updatePluginInstallOverride(projectPath, schemaId, override)
          }
          onInstallOverrideClear={(schemaId) =>
            clearPluginInstallOverride(projectPath, schemaId)
          }
          onLuaIncludeChange={(schemaId, optionKey, included) => {
            void updateLuaFieldOverride(
              projectPath,
              schemaId,
              optionKey,
              included,
            )
          }}
          onLuaIncludeClear={(schemaId, optionKey) => {
            void clearLuaFieldOverride(projectPath, schemaId, optionKey)
          }}
          onResetAll={(schemaId) => {
            const selectedSchema = selectedPlugin.schema
            if (selectedSchema.id !== schemaId) {
              return
            }

            const defaults = seedWithLuaDefaults({}, selectedSchema.options)
            void resetPluginToDefaults(projectPath, schemaId, defaults)
          }}
          isDeletingSchema={actionState.deletingSchemas.includes(
            selectedPlugin.schema.id,
          )}
        />
      )}

      {/* ── Import from GitHub Dialog ── */}
      <ImportGitHubDialog
        isOpen={showImportGitHub}
        projectPath={projectPath}
        onClose={() => setShowImportGitHub(false)}
        onImport={handleImportResult}
      />

      {/* ── Import from JSON Dialog ── */}
      <ImportJsonDialog
        isOpen={showImportJson}
        projectPath={projectPath}
        onClose={() => setShowImportJson(false)}
        onImport={handleImportResult}
      />
    </ScrollArea>
  )
}
