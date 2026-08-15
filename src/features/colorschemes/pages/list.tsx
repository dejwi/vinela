import { Palette, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/features/projects/store'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { ColorSchemeCard } from '../components/ColorSchemeCard'
import {
  ColorSchemeFilters,
  type SortOption,
  type VariantFilter,
} from '../components/ColorSchemeFilters'
import { useColorSchemes } from '../hooks/useColorSchemes'
import { resolveColorSchemeMetadata } from '../metadata'

export default function ColorSchemesPage(): React.JSX.Element {
  const projectPath = useProjectStore((s) => s.currentProject?.absolutePath)
  const {
    displayList,
    isLoading,
    installColorScheme,
    uninstallColorScheme,
    setActiveColorScheme,
    actionState,
  } = useColorSchemes()

  // Filter state
  const [search, setSearch] = useState('')
  const [variant, setVariant] = useState<VariantFilter>('all')
  const [sort, setSort] = useState<SortOption>('stars')
  const [showInstalled, setShowInstalled] = useState(false)

  // Refs for scroll-to-active
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const jumpHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (jumpHighlightTimeoutRef.current) {
        clearTimeout(jumpHighlightTimeoutRef.current)
      }
    }
  }, [])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = displayList

    // Search filter
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((d) => {
        const metadata = resolveColorSchemeMetadata(d.catalog)

        return (
          d.catalog.name.toLowerCase().includes(lower) ||
          d.catalog.description.toLowerCase().includes(lower) ||
          d.catalog.tags?.some((t) => t.toLowerCase().includes(lower)) ===
            true ||
          metadata.author?.toLowerCase().includes(lower) === true ||
          metadata.owner?.toLowerCase().includes(lower) === true ||
          metadata.repoSlug?.toLowerCase().includes(lower) === true
        )
      })
    }

    // Variant filter
    if (variant !== 'all') {
      result = result.filter(
        (d) => d.catalog.variant === variant || d.catalog.variant === 'both',
      )
    }

    // Installed filter
    if (showInstalled) {
      result = result.filter((d) => d.status === 'installed')
    }

    // Sort
    result = [...result].sort((a, b) => {
      const metadataA = resolveColorSchemeMetadata(a.catalog)
      const metadataB = resolveColorSchemeMetadata(b.catalog)

      switch (sort) {
        case 'stars': {
          const starsA = metadataA.stars ?? -1
          const starsB = metadataB.stars ?? -1
          if (starsA !== starsB) {
            return starsB - starsA
          }

          return a.catalog.name.localeCompare(b.catalog.name)
        }
        case 'name':
          return a.catalog.name.localeCompare(b.catalog.name)
        default:
          return 0
      }
    })

    return result
  }, [displayList, search, variant, sort, showInstalled])

  // Callback to register card refs
  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el)
    } else {
      cardRefs.current.delete(id)
    }
  }, [])

  // Find active scheme ID from filtered list (so it respects current filters)
  const activeSchemeId = useMemo(() => {
    const activeInfo = filtered.find(
      (info) => info.status === 'installed' && info.isActive,
    )
    return activeInfo?.catalog.id ?? null
  }, [filtered])

  // Jump to active theme handler
  const handleJumpToActive = useCallback(() => {
    if (!activeSchemeId) return

    const card = cardRefs.current.get(activeSchemeId)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Add a brief highlight animation (use animate-pulse + ring-offset to avoid double ring with active state)
      if (jumpHighlightTimeoutRef.current) {
        clearTimeout(jumpHighlightTimeoutRef.current)
      }
      card.classList.add('animate-pulse', 'ring-offset-2')
      jumpHighlightTimeoutRef.current = setTimeout(() => {
        card.classList.remove('animate-pulse', 'ring-offset-2')
      }, 1500)
    }
  }, [activeSchemeId])

  const installedCount = displayList.filter(
    (d) => d.status === 'installed',
  ).length

  if (projectPath === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No project loaded</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" data-tutorial="colorschemes-page">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Color Schemes</h1>
          <p className="text-muted-foreground">
            Choose a visual theme for your code editor
          </p>
        </div>

        {/* Filters */}
        <ColorSchemeFilters
          search={search}
          onSearchChange={setSearch}
          variant={variant}
          onVariantChange={setVariant}
          sort={sort}
          onSortChange={setSort}
          showInstalled={showInstalled}
          onShowInstalledChange={setShowInstalled}
          installedCount={installedCount}
          activeSchemeId={activeSchemeId}
          onJumpToActive={handleJumpToActive}
        />

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-96 rounded-xl border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 auto-rows-fr">
            {filtered.map((info) => (
              <ColorSchemeCard
                key={info.catalog.id}
                ref={(el) => setCardRef(info.catalog.id, el)}
                displayInfo={info}
                isActive={info.status === 'installed' ? info.isActive : false}
                onInstall={(id) => void installColorScheme(id)}
                onUninstall={(id) => void uninstallColorScheme(id)}
                onSetActive={(id) => void setActiveColorScheme(id)}
                isInstalling={actionState.installing.includes(info.catalog.id)}
                isUninstalling={actionState.uninstalling.includes(
                  info.catalog.id,
                )}
              />
            ))}
          </div>
        )}

        {/* Empty state - no installed themes with filter active */}
        {!isLoading && filtered.length === 0 && showInstalled && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Palette className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No themes installed</p>
            <p className="text-sm text-muted-foreground">
              Click "Install" on any theme to add it to your collection
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && !showInstalled && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            {search !== '' ? (
              <>
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No matching color schemes</p>
                <p className="text-sm">Try adjusting your filters</p>
              </>
            ) : (
              <>
                <Palette className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  No color schemes available
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
