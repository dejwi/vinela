import { ChevronDown, FileJson, Github, Search, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Input } from '@/shared/components/ui/input'

// ============================================
// Props
// ============================================

export interface PluginsHeaderProps {
  /** Current search query value */
  searchQuery: string
  /** Called with the new query after 300ms debounce */
  onSearchChange: (query: string) => void
  /** Called when user clicks "Import JSON File" */
  onImportClick: () => void
  /** Called when user clicks "Import from GitHub" */
  onImportGitHubClick?: (() => void) | undefined
  /** Called when user clicks "Export Standalone" */
  onExportStandaloneClick?: (() => void) | undefined
}

// ============================================
// Component
// ============================================

/**
 * Page header for the Plugins page.
 *
 * Contains:
 *   - Page title + subtitle
 *   - Debounced search input (300ms)
 *   - "Import" dropdown (Import JSON File / Import from GitHub)
 *   - "Export Standalone" button
 */
export function PluginsHeader({
  searchQuery,
  onSearchChange,
  onImportClick,
  onImportGitHubClick,
  onExportStandaloneClick,
}: PluginsHeaderProps): React.JSX.Element {
  // Local input value for debouncing
  const [inputValue, setInputValue] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external searchQuery → local input when it changes externally
  // (e.g. on tab switch or programmatic clear)
  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value
      setInputValue(value)

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        onSearchChange(value)
      }, 300)
    },
    [onSearchChange],
  )

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plugins</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage Neovim plugins for your project
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Import dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1.5" />
                Import
                <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onImportClick}>
                <FileJson className="h-4 w-4" />
                Import JSON File
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onImportGitHubClick}
                disabled={onImportGitHubClick === undefined}
              >
                <Github className="h-4 w-4" />
                Import from GitHub
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Standalone */}
          {onExportStandaloneClick !== undefined && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportStandaloneClick}
            >
              Export Standalone
            </Button>
          )}
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search plugins..."
          value={inputValue}
          onChange={handleInputChange}
          aria-label="Search plugins"
        />
      </div>
    </div>
  )
}
