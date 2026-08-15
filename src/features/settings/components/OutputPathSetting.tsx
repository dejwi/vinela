import { AlertTriangle, FolderOpen, Info, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { getDefaultNeovimOutputPath } from '@/shared/lib/settings'
import { isMemoryMode } from '@/shared/lib/storage'
import { cn } from '@/shared/lib/utils'

interface OutputPathSettingProps {
  /** Current custom path, or undefined for default */
  value: string | undefined
  /** Called when path changes */
  onChange: (path: string | undefined) => Promise<boolean>
}

export function OutputPathSetting({
  value,
  onChange,
}: OutputPathSettingProps): React.JSX.Element {
  const inMemoryMode = isMemoryMode()
  const defaultOutputPath = getDefaultNeovimOutputPath()
  const displayPath = value ?? defaultOutputPath
  const isDefault = value === undefined
  const isInvalid = value !== undefined && !value.endsWith('.lua')

  // Memory mode: show info card
  if (inMemoryMode) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Config File Location</h3>
          <p className="text-sm text-muted-foreground">
            This is the file Neovim reads when it starts up. By default, it goes
            to the standard location that Neovim looks for on startup.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Not available in browser mode
              </p>
              <p className="text-sm text-muted-foreground">
                File paths are only available in the desktop app. In browser
                mode, configurations are stored in memory.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop mode: show path + browse + reset
  const handleBrowse = async (): Promise<void> => {
    try {
      // Dynamic import to avoid loading Tauri in browser
      const { save } = await import('@tauri-apps/plugin-dialog')

      const selected = await save({
        ...(value !== undefined ? { defaultPath: value } : {}),
        filters: [{ name: 'Lua files', extensions: ['lua'] }],
        title: 'Choose where to save your Neovim config',
      })

      if (selected !== null) {
        if (!selected.endsWith('.lua')) {
          toast.error('Invalid path', {
            description: 'Config files must end in .lua',
          })
          return
        }
        const didPersist = await onChange(selected)
        if (didPersist) {
          toast.success('Config path updated')
        }
      }
    } catch (error) {
      console.error('Failed to open save dialog:', error)
      toast.error('Failed to open file browser')
    }
  }

  const handleReset = async (): Promise<void> => {
    const didPersist = await onChange(undefined)
    if (didPersist) {
      toast.success('Config path reset to default')
    }
  }

  return (
    <div className="space-y-3">
      {/* Label and description */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Config File Location</h3>
        <p className="text-sm text-muted-foreground">
          This is the file Neovim reads when it starts up. By default, it goes
          to the standard location that Neovim looks for on startup.
        </p>
      </div>

      {/* Path display + buttons */}
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={displayPath}
          className={cn(
            'flex-1 font-mono text-sm',
            isDefault && 'text-muted-foreground',
          )}
          aria-label="Neovim config file path"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleBrowse}
          aria-label="Browse for file location"
        >
          <FolderOpen className="h-4 w-4 mr-1.5" />
          Browse
        </Button>
        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleReset()
            }}
            aria-label="Reset to default path"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset Default
          </Button>
        )}
      </div>

      {/* Default path hint */}
      {isDefault && (
        <p className="text-xs text-muted-foreground/70">
          Default: {defaultOutputPath} · Most users should keep this unchanged.
        </p>
      )}

      {/* Validation error */}
      {isInvalid && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Config files must end in .lua — Neovim only loads Lua configuration
          files.
        </p>
      )}
    </div>
  )
}
