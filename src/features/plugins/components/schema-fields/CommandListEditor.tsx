import { ArrowDown, ArrowUp, Code, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type {
  PluginKeymapCommand,
  PluginKeymapCommandEntry,
} from '@/shared/types'

interface CommandListEditorProps {
  /** Current ordered list of command entries */
  commands: PluginKeymapCommandEntry[]
  /** Available named commands from the schema */
  availableCommands: PluginKeymapCommand[]
  /** Called when the list changes */
  onChange: (commands: PluginKeymapCommandEntry[]) => void
  /** Whether the editor is disabled */
  disabled?: boolean
}

type EditorEntry = { id: number } & (
  | { kind: 'named'; name: string }
  | { kind: 'lua'; code: string }
)

let nextEntryId = 0

function toEditorEntries(commands: PluginKeymapCommandEntry[]): EditorEntry[] {
  return commands.map((cmd) => {
    if (typeof cmd === 'string') {
      return { id: nextEntryId++, kind: 'named', name: cmd }
    }
    return { id: nextEntryId++, kind: 'lua', code: cmd.lua }
  })
}

function fromEditorEntries(entries: EditorEntry[]): PluginKeymapCommandEntry[] {
  return entries.flatMap((entry): PluginKeymapCommandEntry[] => {
    if (entry.kind === 'named') {
      return entry.name ? [entry.name] : []
    }
    return entry.code.trim() ? [{ lua: entry.code }] : []
  })
}

export function CommandListEditor({
  commands,
  availableCommands,
  onChange,
  disabled = false,
}: CommandListEditorProps): React.JSX.Element {
  // Draft ownership: local state is initialized once at mount from the commands prop.
  //
  // Resync contract (versioned/seeded by parent intent only):
  // - CommandListEditor does NOT rehydrate on raw `commands` reference changes.
  //   This prevents render-loop/reference-churn regressions.
  // - The parent (KeymapEditDialog) controls rehydration by remounting this component
  //   via a semantic `key` prop that encodes the edit target identity + commandsSeed.
  //   See `getCommandListDraftSeed` in KeymapEditDialog for the seed computation.
  // - Same key + same semantic commands → same seed → no remount/clobber.
  // - Same key + changed semantic commands from parent → new seed → rehydrate draft.
  const [entries, setEntries] = useState<EditorEntry[]>(() =>
    toEditorEntries(commands),
  )

  const emitChange = (updated: EditorEntry[]): void => {
    setEntries(updated)
    onChange(fromEditorEntries(updated))
  }

  const handleAddNamed = (): void => {
    const first = availableCommands[0]
    const newEntry: EditorEntry = {
      id: nextEntryId++,
      kind: 'named',
      name: first?.name ?? '',
    }
    emitChange([...entries, newEntry])
  }

  const handleAddLua = (): void => {
    const newEntry: EditorEntry = {
      id: nextEntryId++,
      kind: 'lua',
      code: '',
    }
    emitChange([...entries, newEntry])
  }

  const handleRemove = (id: number): void => {
    emitChange(entries.filter((e) => e.id !== id))
  }

  const handleMoveUp = (index: number): void => {
    if (index === 0) return
    const updated = [...entries]
    const prev = updated[index - 1]
    const curr = updated[index]
    if (prev === undefined || curr === undefined) return
    updated[index - 1] = curr
    updated[index] = prev
    emitChange(updated)
  }

  const handleMoveDown = (index: number): void => {
    if (index === entries.length - 1) return
    const updated = [...entries]
    const next = updated[index + 1]
    const curr = updated[index]
    if (next === undefined || curr === undefined) return
    updated[index + 1] = curr
    updated[index] = next
    emitChange(updated)
  }

  const handleChangeNamed = (id: number, name: string): void => {
    emitChange(
      entries.map((e) => (e.id === id ? { ...e, kind: 'named', name } : e)),
    )
  }

  const handleChangeLua = (id: number, code: string): void => {
    emitChange(
      entries.map((e) => (e.id === id ? { ...e, kind: 'lua', code } : e)),
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Commands (executed in order):
      </p>

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No commands. Add a command below.
        </p>
      )}

      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-start gap-2">
          {/* Move up/down buttons */}
          <div className="flex flex-col gap-0.5 pt-1.5">
            <button
              type="button"
              onClick={() => handleMoveUp(index)}
              disabled={disabled || index === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleMoveDown(index)}
              disabled={disabled || index === entries.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Entry input */}
          <div className="flex-1">
            {entry.kind === 'named' ? (
              <Select
                value={entry.name}
                onValueChange={(v) => handleChangeNamed(entry.id, v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue placeholder="Select command..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCommands.map((cmd) => (
                    <SelectItem key={cmd.name} value={cmd.name}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono">{cmd.name}</span>
                              {cmd.isTerminal === true && (
                                <Badge
                                  variant="outline"
                                  className="text-xs px-1 py-0"
                                >
                                  terminal
                                </Badge>
                              )}
                            </span>
                          </TooltipTrigger>
                          {cmd.description !== undefined && (
                            <TooltipContent>
                              <p className="max-w-xs text-xs">
                                {cmd.description}
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Code className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Custom Lua
                  </span>
                </div>
                <Textarea
                  value={entry.code}
                  onChange={(e) => handleChangeLua(entry.id, e.target.value)}
                  disabled={disabled}
                  placeholder="function(cmp) cmp.accept() end"
                  className="font-mono text-xs h-16 resize-none"
                />
              </div>
            )}
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(entry.id)}
            disabled={disabled}
            aria-label="Remove command"
            className="h-8 w-8 shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddNamed}
          disabled={disabled}
          className="text-xs h-7"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Command
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLua}
          disabled={disabled}
          className="text-xs h-7"
        >
          <Code className="h-3 w-3 mr-1" />
          Add Custom Lua
        </Button>
      </div>
    </div>
  )
}
