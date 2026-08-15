import { Code, Edit, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  normalizeAndPruneRebindLinks,
  resolvePluginKeymapDefaults,
} from '@/features/plugins/utils/plugin-keymap-defaults'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type {
  PluginConfigValue,
  PluginKeymapCommand,
  PluginKeymapCommandEntry,
  SchemaPluginKeymapOption,
} from '@/shared/types'
import type { KeymapSaveIntent } from './KeymapEditDialog'
import { KeymapEditDialog } from './KeymapEditDialog'
import { normalizeKeymapKey } from './plugin-keymap-key-normalization'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginKeymapFieldState {
  selectedPreset: string
  overrides: Map<string, PluginKeymapCommandEntry[] | false>
  /**
   * UI-local rebind link tracking (not persisted).
   * Maps normalizedNewKey -> normalizedOldKey for linked rebind pairs.
   * A rebind pair is: oldKey -> false (disabled), newKey -> commands.
   */
  rebindLinks: Map<string, string>
}

type RowSource = 'preset' | 'override' | 'custom' | 'disabled'

interface EffectiveRow {
  key: string
  commands: PluginKeymapCommandEntry[] | false
  source: RowSource
  /**
   * True when this row is the "new key" half of a linked rebind pair.
   * Such rows show "Undo rebind" instead of plain "Delete".
   */
  isReboundReplacement: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initFieldState(
  value: PluginConfigValue | undefined,
  option: SchemaPluginKeymapOption,
): PluginKeymapFieldState {
  const resolved = resolvePluginKeymapDefaults(value, option)
  return {
    selectedPreset: resolved.preset,
    overrides: new Map(Object.entries(resolved.overrides ?? {})),
    // rebindLinks is hydrated from resolver (normalized + pruned at load time)
    rebindLinks: resolved.rebindLinks,
  }
}

function serializeToConfigValue(
  state: PluginKeymapFieldState,
): PluginConfigValue {
  const result: Record<string, PluginConfigValue> = {}
  result['preset'] = state.selectedPreset
  if (state.overrides.size > 0) {
    const overrides: Record<string, PluginConfigValue> = {}
    for (const [k, v] of state.overrides) {
      if (v === false) {
        overrides[k] = false
      } else {
        overrides[k] = v.map((entry) =>
          typeof entry === 'string'
            ? entry
            : ({ lua: entry.lua } as PluginConfigValue),
        ) as PluginConfigValue
      }
    }
    result['overrides'] = overrides
  }
  // Emit _meta.rebindLinks only when non-empty (editor metadata, not used for Lua generation)
  if (state.rebindLinks.size > 0) {
    const rebindLinksObj: Record<string, PluginConfigValue> = {}
    for (const [newKey, oldKey] of state.rebindLinks) {
      rebindLinksObj[newKey] = oldKey
    }
    result['_meta'] = { rebindLinks: rebindLinksObj } as PluginConfigValue
  }
  return result
}

function computeEffectiveRows(
  state: PluginKeymapFieldState,
  option: SchemaPluginKeymapOption,
): EffectiveRow[] {
  const preset = option.presets.find((p) => p.id === state.selectedPreset)
  const presetMappings: Record<string, string[]> = preset?.mappings ?? {}

  const rows: EffectiveRow[] = []
  const seen = new Set<string>()

  // Preset keys first
  for (const [key, cmds] of Object.entries(presetMappings)) {
    seen.add(key)
    const override = state.overrides.get(key)
    if (override === undefined) {
      rows.push({
        key,
        commands: cmds,
        source: 'preset',
        isReboundReplacement: false,
      })
    } else if (override === false) {
      rows.push({
        key,
        commands: false,
        source: 'disabled',
        isReboundReplacement: false,
      })
    } else {
      rows.push({
        key,
        commands: override,
        source: 'override',
        isReboundReplacement: false,
      })
    }
  }

  // Custom keys (in overrides but not in preset)
  for (const [key, value] of state.overrides) {
    if (!seen.has(key)) {
      const normalizedKey = normalizeKeymapKey(key)
      const isReboundReplacement = state.rebindLinks.has(normalizedKey)
      rows.push({
        key,
        commands: value,
        source: 'custom',
        isReboundReplacement,
      })
    }
  }

  return rows
}

/**
 * Check if commands are equal to the preset mapping for a given key.
 * Uses normalized key lookup and deep command equality.
 */
function commandsMatchPreset(
  key: string,
  commands: PluginKeymapCommandEntry[],
  presetMappings: Record<string, string[]>,
): boolean {
  const presetCmds = presetMappings[key]
  if (presetCmds === undefined) return false
  return JSON.stringify(commands) === JSON.stringify(presetCmds)
}

/**
 * Result of applying a rebind operation.
 * - `{ kind: 'applied'; ... }` — rebind was applied in-place (allowDisable path).
 * - `{ kind: 'forked'; ... }` — preset was switched to 'none' (fork path).
 * - `{ kind: 'blocked' }` — hard-block: no allowDisable and no 'none' preset.
 */
type RebindResult =
  | {
      readonly kind: 'applied'
      readonly overrides: Map<string, PluginKeymapCommandEntry[] | false>
      readonly rebindLinks: Map<string, string>
    }
  | {
      readonly kind: 'forked'
      readonly overrides: Map<string, PluginKeymapCommandEntry[] | false>
    }
  | { readonly kind: 'blocked' }

/**
 * Compute the result of a rebind (key rename) operation.
 * Does not mutate state — returns a discriminated result for the caller to apply.
 */
function computeRebind(
  originalKey: string,
  normalizedOrig: string,
  nextKey: string,
  normalizedNext: string,
  commands: PluginKeymapCommandEntry[],
  presetMappings: Record<string, string[]>,
  currentOverrides: Map<string, PluginKeymapCommandEntry[] | false>,
  currentRebindLinks: Map<string, string>,
  allowDisable: boolean,
  hasNonePreset: boolean,
): RebindResult {
  if (allowDisable) {
    const overrides = new Map(currentOverrides)
    overrides.set(originalKey, false)
    overrides.set(nextKey, commands)
    // Build raw links then normalize+prune against the new overrides state
    const rawLinks = new Map(currentRebindLinks)
    rawLinks.set(normalizedNext, normalizedOrig)
    const rebindLinks = normalizeAndPruneRebindLinks(rawLinks, overrides)
    return { kind: 'applied', overrides, rebindLinks }
  }

  if (hasNonePreset) {
    const effectiveMappings = { ...presetMappings }
    for (const [k, v] of currentOverrides) {
      if (v === false) {
        delete effectiveMappings[k]
      } else {
        effectiveMappings[k] = v as string[]
      }
    }
    delete effectiveMappings[originalKey]
    effectiveMappings[nextKey] = commands as string[]

    const overrides = new Map<string, PluginKeymapCommandEntry[] | false>()
    for (const [k, v] of Object.entries(effectiveMappings)) {
      overrides.set(k, v)
    }
    return { kind: 'forked', overrides }
  }

  return { kind: 'blocked' }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CommandChip({
  name,
  commands,
}: {
  name: string
  commands: PluginKeymapCommand[]
}): React.JSX.Element {
  const cmd = commands.find((c) => c.name === name)
  const chip = (
    <Badge
      variant={cmd?.isTerminal === true ? 'outline' : 'secondary'}
      className="text-xs font-mono cursor-default"
    >
      {cmd?.label ?? name}
    </Badge>
  )

  if (cmd?.description === undefined) return chip

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{cmd.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function LuaCommandChip({ lua }: { lua: string }): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs font-mono gap-1 cursor-default"
          >
            <Code className="h-3 w-3" />
            Lua
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <pre className="text-xs font-mono whitespace-pre-wrap">{lua}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SourceBadge({ source }: { source: RowSource }): React.JSX.Element {
  switch (source) {
    case 'preset':
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          preset
        </Badge>
      )
    case 'override':
      return (
        <Badge variant="default" className="text-xs">
          override
        </Badge>
      )
    case 'custom':
      return (
        <Badge variant="secondary" className="text-xs">
          custom
        </Badge>
      )
    case 'disabled':
      return (
        <Badge variant="destructive" className="text-xs">
          disabled
        </Badge>
      )
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PluginKeymapFieldProps {
  option: SchemaPluginKeymapOption
  value: PluginConfigValue | undefined
  onChange: (value: PluginConfigValue) => void
  disabled?: boolean | undefined
}

export function PluginKeymapField({
  option,
  value,
  onChange,
  disabled = false,
}: PluginKeymapFieldProps): React.JSX.Element {
  const [state, setState] = useState<PluginKeymapFieldState>(() =>
    initFieldState(value, option),
  )

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<EffectiveRow | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  // Fallback alert shown when the defensive hard-block branch fires in the parent
  const [blockedRebindAlert, setBlockedRebindAlert] = useState<string | null>(
    null,
  )

  // Track whether any dialog is open for resync guard
  const anyDialogOpen = editDialogOpen || addDialogOpen

  // Ref to track previous value/option for resync comparison
  const prevValueRef = useRef<PluginConfigValue | undefined>(value)
  const prevOptionRef = useRef<SchemaPluginKeymapOption>(option)

  // Parent-prop resync: when external value/option changes, rehydrate state.
  // If a dialog is open, close it first then apply source-of-truth state.
  useEffect(() => {
    const valueChanged = value !== prevValueRef.current
    const optionChanged = option !== prevOptionRef.current

    if (!valueChanged && !optionChanged) return

    prevValueRef.current = value
    prevOptionRef.current = option

    if (anyDialogOpen) {
      // Close dialogs first, then resync
      setEditDialogOpen(false)
      setAddDialogOpen(false)
      setEditingRow(null)
    }

    setState(initFieldState(value, option))
  }, [value, option, anyDialogOpen])

  const rows = useMemo(
    () => computeEffectiveRows(state, option),
    [state, option],
  )

  const existingKeys = useMemo(
    () => new Set(rows.map((r) => normalizeKeymapKey(r.key))),
    [rows],
  )

  const currentPreset = useMemo(
    () => option.presets.find((p) => p.id === state.selectedPreset),
    [option.presets, state.selectedPreset],
  )

  const emitChange = (nextState: PluginKeymapFieldState): void => {
    setState(nextState)
    onChange(serializeToConfigValue(nextState))
  }

  const handlePresetChange = (presetId: string): void => {
    emitChange({ ...state, selectedPreset: presetId })
  }

  // ---------------------------------------------------------------------------
  // Save intent handler — implements the override delta semantics matrix
  // ---------------------------------------------------------------------------

  const handleUpsertBinding = (
    intent: KeymapSaveIntent & { intent: 'upsert-binding' },
    presetMappings: Record<string, string[]>,
  ): void => {
    const { originalKey, nextKey, commands, source } = intent
    const normalizedNext = normalizeKeymapKey(nextKey)
    const normalizedOrig =
      originalKey !== undefined ? normalizeKeymapKey(originalKey) : undefined
    const isRename =
      normalizedOrig !== undefined && normalizedNext !== normalizedOrig

    if (isRename && normalizedOrig !== undefined && originalKey !== undefined) {
      const result = computeRebind(
        originalKey,
        normalizedOrig,
        nextKey,
        normalizedNext,
        commands,
        presetMappings,
        state.overrides,
        state.rebindLinks,
        option.allowDisable === true,
        option.presets.some((p) => p.id === 'none'),
      )
      switch (result.kind) {
        case 'applied':
          emitChange({
            ...state,
            overrides: result.overrides,
            rebindLinks: result.rebindLinks,
          })
          break
        case 'forked':
          emitChange({
            ...state,
            selectedPreset: 'none',
            overrides: result.overrides,
            rebindLinks: new Map(),
          })
          break
        case 'blocked':
          // Defensive hard-block: surface a fallback alert so the no-op is never silent.
          setBlockedRebindAlert(
            `Cannot rebind "${originalKey}" → "${nextKey}": rebinding requires allowDisable or a "none" preset in the schema.`,
          )
          break
      }
      return
    }

    // Same-key edit (no rename)
    const nextOverrides = new Map(state.overrides)
    const useKey = originalKey ?? nextKey
    if (source === 'preset' || source === 'override' || source === 'disabled') {
      if (commandsMatchPreset(useKey, commands, presetMappings)) {
        nextOverrides.delete(useKey)
      } else {
        nextOverrides.set(useKey, commands)
      }
    } else if (source === 'custom') {
      nextOverrides.set(useKey, commands)
    } else {
      nextOverrides.set(nextKey, commands)
    }
    emitChange({ ...state, overrides: nextOverrides })
  }

  const handleSaveIntent = (intent: KeymapSaveIntent): void => {
    const presetMappings: Record<string, string[]> =
      currentPreset?.mappings ?? {}

    switch (intent.intent) {
      case 'disable-original': {
        const nextOverrides = new Map(state.overrides)
        nextOverrides.set(intent.originalKey, false)
        emitChange({ ...state, overrides: nextOverrides })
        break
      }
      case 'upsert-binding':
        handleUpsertBinding(intent, presetMappings)
        break
    }
  }

  const handleResetToPreset = (key: string): void => {
    const normalizedKey = normalizeKeymapKey(key)
    const nextOverrides = new Map(state.overrides)
    const nextRebindLinks = new Map(state.rebindLinks)

    // Check if this key is the "old key" half of a linked rebind pair
    // (i.e., it was disabled as part of a rebind)
    const linkedNewKey = (() => {
      for (const [newKey, oldKey] of nextRebindLinks) {
        if (oldKey === normalizedKey) return newKey
      }
      return undefined
    })()

    if (linkedNewKey !== undefined) {
      // Atomic rollback: remove both pair entries
      nextOverrides.delete(key)
      // Find the actual (non-normalized) new key in overrides
      for (const k of nextOverrides.keys()) {
        if (normalizeKeymapKey(k) === linkedNewKey) {
          nextOverrides.delete(k)
          break
        }
      }
      nextRebindLinks.delete(linkedNewKey)
    } else {
      nextOverrides.delete(key)
    }

    // Normalize+prune after mutation to enforce invariants
    const prunedLinks = normalizeAndPruneRebindLinks(
      nextRebindLinks,
      nextOverrides,
    )
    emitChange({
      ...state,
      overrides: nextOverrides,
      rebindLinks: prunedLinks,
    })
  }

  const handleUndoRebind = (newKey: string): void => {
    // Undo rebind: atomic rollback of the linked pair
    const normalizedNewKey = normalizeKeymapKey(newKey)
    const linkedOldKey = state.rebindLinks.get(normalizedNewKey)

    const nextOverrides = new Map(state.overrides)
    const nextRebindLinks = new Map(state.rebindLinks)

    // Remove the new key entry
    nextOverrides.delete(newKey)

    // Remove the old key's false entry
    if (linkedOldKey !== undefined) {
      for (const k of nextOverrides.keys()) {
        if (normalizeKeymapKey(k) === linkedOldKey) {
          nextOverrides.delete(k)
          break
        }
      }
      nextRebindLinks.delete(normalizedNewKey)
    }

    // Normalize+prune after mutation to enforce invariants
    const prunedLinks = normalizeAndPruneRebindLinks(
      nextRebindLinks,
      nextOverrides,
    )
    emitChange({
      ...state,
      overrides: nextOverrides,
      rebindLinks: prunedLinks,
    })
  }

  const handleDelete = (key: string): void => {
    const nextOverrides = new Map(state.overrides)
    nextOverrides.delete(key)
    emitChange({ ...state, overrides: nextOverrides })
  }

  const handleResetAllOverrides = (): void => {
    // Clear all overrides and rebindLinks (pruning against empty overrides yields empty links)
    emitChange({ ...state, overrides: new Map(), rebindLinks: new Map() })
  }

  const openEdit = (row: EffectiveRow): void => {
    setEditingRow(row)
    setEditDialogOpen(true)
  }

  const handleEditDialogOpenChange = (open: boolean): void => {
    setEditDialogOpen(open)
    if (!open) {
      setEditingRow(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Hard-block check for rebind when allowDisable is false and no 'none' preset
  // ---------------------------------------------------------------------------
  const canRebind = useMemo(() => {
    if (option.allowDisable === true) return true
    return option.presets.some((p) => p.id === 'none')
  }, [option])

  return (
    <div className="space-y-3">
      {/* Fallback alert for defensive hard-block branch */}
      {blockedRebindAlert !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span className="flex-1">{blockedRebindAlert}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 font-medium hover:opacity-70"
            onClick={() => setBlockedRebindAlert(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Preset selector */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Preset</p>
        <Select
          value={state.selectedPreset}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select preset…" />
          </SelectTrigger>
          <SelectContent>
            {option.presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex flex-col gap-0.5">
                  <span>{preset.label}</span>
                  {preset.description !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Hard-block warning */}
      {!canRebind && (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2">
          Key rebinding is not available for this preset configuration. To
          rebind keys, either enable <code>allowDisable</code> in the schema or
          add a <code>none</code> preset.
        </p>
      )}

      {/* Effective keymaps table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Effective Keymaps</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            disabled={disabled}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Key
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No preset bindings. Add keymaps manually using{' '}
              <strong>Add Key</strong>.
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[7rem_1fr_5.5rem_4.5rem] border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Key</span>
              <span>Commands</span>
              <span>Source</span>
              <span />
            </div>

            {/* Data rows */}
            <div className="divide-y">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className={`grid grid-cols-[7rem_1fr_5.5rem_4.5rem] items-center px-3 py-2 gap-x-2 ${row.source === 'preset' ? 'opacity-60' : ''}`}
                >
                  {/* Key */}
                  <div>
                    <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs font-mono border">
                      {row.key}
                    </kbd>
                  </div>

                  {/* Commands */}
                  <div>
                    {row.commands === false ? (
                      <span className="text-xs text-muted-foreground italic line-through">
                        disabled
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.commands.map((entry, cmdIdx) =>
                          typeof entry === 'string' ? (
                            <CommandChip
                              key={`${row.key}-cmd-${cmdIdx}`}
                              name={entry}
                              commands={option.commands}
                            />
                          ) : (
                            <LuaCommandChip
                              key={`${row.key}-lua-${cmdIdx}`}
                              lua={entry.lua}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Source */}
                  <div>
                    <SourceBadge source={row.source} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={disabled}
                      onClick={() => openEdit(row)}
                      aria-label="Edit key binding"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {(row.source === 'override' ||
                      row.source === 'disabled') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        disabled={disabled}
                        onClick={() => handleResetToPreset(row.key)}
                        aria-label="Reset to preset"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                    {row.source === 'custom' && row.isReboundReplacement && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        disabled={disabled}
                        onClick={() => handleUndoRebind(row.key)}
                        aria-label="Undo rebind"
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    )}
                    {row.source === 'custom' && !row.isReboundReplacement && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        disabled={disabled}
                        onClick={() => handleDelete(row.key)}
                        aria-label="Delete key binding"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.overrides.size > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetAllOverrides}
            disabled={disabled}
            className="h-7 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset all overrides
          </Button>
        )}
      </div>

      {/* Add key dialog */}
      <KeymapEditDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        initialKey=""
        availableCommands={option.commands}
        {...(option.allowDisable !== undefined
          ? { allowDisable: option.allowDisable }
          : {})}
        canRebind={canRebind}
        existingKeys={existingKeys}
        onSave={handleSaveIntent}
      />

      {/* Edit key dialog */}
      {editingRow !== null && (
        <KeymapEditDialog
          open={editDialogOpen}
          onOpenChange={handleEditDialogOpenChange}
          initialKey={editingRow.key}
          initialCommands={
            editingRow.commands === false ? [] : editingRow.commands
          }
          initialDisabled={editingRow.commands === false}
          existsInPreset={
            editingRow.source === 'preset' ||
            editingRow.source === 'override' ||
            editingRow.source === 'disabled'
          }
          rowSource={editingRow.source}
          availableCommands={option.commands}
          {...(option.allowDisable !== undefined
            ? { allowDisable: option.allowDisable }
            : {})}
          canRebind={canRebind}
          existingKeys={existingKeys}
          onSave={handleSaveIntent}
          {...(editingRow.source === 'override' ||
          editingRow.source === 'disabled'
            ? { onResetToPreset: handleResetToPreset }
            : {})}
          {...(editingRow.source === 'custom' &&
          !editingRow.isReboundReplacement
            ? { onDelete: handleDelete }
            : {})}
        />
      )}
    </div>
  )
}
