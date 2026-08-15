import { CircleHelp, Plus, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import {
  NEOVIM_EVENT_CATALOG,
  normalizeNeovimEventName,
} from '@/shared/data/neovim'
import type { CreateAutocmdActionConfig } from '@/shared/types'
import { normalizePatternEntries } from '@/shared/types'
import { useIsOutputPortConnected } from '../../../hooks/useIsPortConnected'

interface CreateAutocmdActionEditorProps {
  config: CreateAutocmdActionConfig
  nodeId: string
  onChange: (config: CreateAutocmdActionConfig) => void
}

function toggleEvent(
  events: readonly string[],
  eventName: string,
): CreateAutocmdActionConfig['events'] {
  const canonicalName = normalizeNeovimEventName(eventName) ?? eventName
  if (events.includes(canonicalName)) {
    return events.filter((event) => event !== canonicalName)
  }
  return [...events, canonicalName]
}

function hasHomePathPattern(patterns: readonly string[]): boolean {
  return patterns.some(
    (pattern) => pattern.includes('~') || pattern.includes('$HOME'),
  )
}

function buildErrors(
  config: CreateAutocmdActionConfig,
  isOnEventConnected: boolean,
): string[] {
  const errors: string[] = []
  if (config.events.length === 0) {
    errors.push('At least one event is required.')
  }
  if (!isOnEventConnected && config.callbackLua.trim().length === 0) {
    errors.push('Callback Lua is required when On Event is not connected.')
  }
  return errors
}

function buildWarnings(config: CreateAutocmdActionConfig): string[] {
  const warnings: string[] = []
  if (hasHomePathPattern(config.patterns)) {
    warnings.push('Pattern does not auto-expand ~ or $HOME in Neovim API.')
  }
  return warnings
}

export function CreateAutocmdActionEditor({
  config,
  nodeId,
  onChange,
}: CreateAutocmdActionEditorProps): React.JSX.Element {
  const [pendingPattern, setPendingPattern] = useState('')
  const isOnEventConnected = useIsOutputPortConnected(nodeId, 'on-event')
  const errors = useMemo(
    () => buildErrors(config, isOnEventConnected),
    [config, isOnEventConnected],
  )
  const warnings = useMemo(() => buildWarnings(config), [config])

  const addPattern = useCallback((): void => {
    const trimmed = pendingPattern.trim()
    if (trimmed.length === 0) {
      setPendingPattern('')
      return
    }

    // Handle newline-separated patterns (paste support)
    const newPatterns = trimmed
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    onChange({
      ...config,
      patterns: normalizePatternEntries([...config.patterns, ...newPatterns]),
    })
    setPendingPattern('')
  }, [config, pendingPattern, onChange])

  const removePattern = useCallback(
    (patternToRemove: string): void => {
      onChange({
        ...config,
        patterns: normalizePatternEntries(
          config.patterns.filter((p) => p !== patternToRemove),
        ),
      })
    },
    [config, onChange],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') {
        event.preventDefault()
        addPattern()
      }
    },
    [addPattern],
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>): void => {
      const pastedText = event.clipboardData.getData('text')
      if (!pastedText.includes('\n')) {
        // Not multi-line paste, let default behavior handle it
        return
      }

      event.preventDefault()

      // Parse newline-separated patterns from clipboard
      const newPatterns = pastedText
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)

      if (newPatterns.length > 0) {
        onChange({
          ...config,
          patterns: normalizePatternEntries([
            ...config.patterns,
            ...newPatterns,
          ]),
        })
      }
    },
    [config, onChange],
  )

  return (
    <TooltipProvider>
      <ActionEditorFrame
        title="Create Autocmd"
        description="Create an autocommand that responds to Neovim events."
        errors={errors}
        warnings={warnings}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium">Events</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
            {NEOVIM_EVENT_CATALOG.map((entry) => {
              const checked = config.events.includes(entry.name)
              return (
                <div
                  key={entry.name}
                  className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/60"
                >
                  <label className="flex flex-1 items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          ...config,
                          events: toggleEvent(config.events, entry.name),
                        })
                      }
                      className="mt-0.5"
                    />
                    <span className="flex-1 text-xs">
                      <span className="font-medium">{entry.name}</span>
                      <span className="block text-muted-foreground">
                        {entry.patternGuidance}
                      </span>
                    </span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Show details for ${entry.name}`}
                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                      >
                        <CircleHelp className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className="max-w-xs"
                      sideOffset={8}
                    >
                      <div className="space-y-2">
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.details}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pattern hint: {entry.patternGuidance}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          {entry.sourceDoc}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )
            })}
          </div>
          {config.events.length === 0 ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
              aria-live="polite"
            >
              No events selected. Select at least one event to generate this
              autocmd.
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium">Patterns</p>
          <div className="flex items-center gap-2">
            <Input
              value={pendingPattern}
              onChange={(event) => setPendingPattern(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="*.lua"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={addPattern}
              type="button"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Examples: <code className="text-foreground">*.lua</code>,{' '}
              <code className="text-foreground">{'*.{ts,tsx}'}</code>,{' '}
              <code className="text-foreground">*/doc/*.txt</code>,{' '}
              <code className="text-foreground">*</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Press Enter to add. Paste multiple patterns (newline-separated) to
              add several at once.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Note: <code>~</code> and <code>$HOME</code> are NOT auto-expanded
              in the Neovim API.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {config.patterns.map((pattern) => (
              <div
                key={pattern}
                className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
              >
                <code className="font-mono">{pattern}</code>
                <button
                  type="button"
                  onClick={() => removePattern(pattern)}
                  className="p-0.5 rounded hover:bg-muted-foreground/20 transition-colors"
                  aria-label={`Remove pattern ${pattern}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Augroup Name (optional)
          </p>
          <Input
            value={config.groupName}
            onChange={(event) =>
              onChange({
                ...config,
                groupName: event.target.value,
              })
            }
            placeholder="MyAutoGroup"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Callback Lua</p>
          {isOnEventConnected ? (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p>
                Callback is defined by nodes connected to the "On Event" output
                port.
              </p>
              <p className="text-xs mt-1">
                The Lua below serves as fallback if the connection is removed.
              </p>
              <Textarea
                value={config.callbackLua}
                onChange={(event) =>
                  onChange({
                    ...config,
                    callbackLua: event.target.value,
                  })
                }
                rows={3}
                placeholder="vim.notify('event fired')"
                className="mt-2"
              />
            </div>
          ) : (
            <Textarea
              value={config.callbackLua}
              onChange={(event) =>
                onChange({
                  ...config,
                  callbackLua: event.target.value,
                })
              }
              rows={5}
              placeholder="vim.notify('event fired')"
            />
          )}
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium">Options</p>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  once: !config.once,
                })
              }
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                config.once
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <span className="text-sm font-medium">Run Once</span>
              <span className="text-xs text-muted-foreground">
                Run this autocommand a single time, then remove it.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  nested: !config.nested,
                })
              }
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                config.nested
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <span className="text-sm font-medium">Allow Nested Autocmds</span>
              <span className="text-xs text-muted-foreground">
                Allow commands inside this callback to trigger other
                autocommands.
              </span>
            </button>
          </div>
        </div>
      </ActionEditorFrame>
    </TooltipProvider>
  )
}
