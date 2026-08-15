import { useEffect, useState } from 'react'
import { KeyCaptureInput } from '@/shared/components/KeyCaptureInput'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Switch } from '@/shared/components/ui/switch'
import type {
  PluginKeymapCommand,
  PluginKeymapCommandEntry,
} from '@/shared/types'
import { CommandListEditor } from './CommandListEditor'
import { normalizeKeymapKey } from './plugin-keymap-key-normalization'

// ---------------------------------------------------------------------------
// Seed helper for CommandListEditor resync
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic seed string from a command list.
 *
 * Used as part of the `key` prop for CommandListEditor to trigger remount
 * only when the semantic content of the command list changes — not on
 * reference churn.
 *
 * Contract:
 * - Same commands (by value) → same seed → no remount.
 * - Different commands → different seed → remount + rehydrate draft.
 */
export function getCommandListDraftSeed(
  commands: readonly PluginKeymapCommandEntry[],
): string {
  return JSON.stringify(commands)
}

// ---------------------------------------------------------------------------
// Save intent discriminated union
// ---------------------------------------------------------------------------

/**
 * Typed save payload emitted by KeymapEditDialog.
 *
 * - `disable-original`: disable the original preset-origin key only.
 *   Key input is locked to originalKey; no rename is possible.
 * - `upsert-binding`: create/update binding (same-key edit or rename/rebind).
 *   originalKey is present when editing an existing row (may differ from nextKey
 *   when the user has changed the key — i.e. a rebind).
 */
export type KeymapSaveIntent =
  | { readonly intent: 'disable-original'; readonly originalKey: string }
  | {
      readonly intent: 'upsert-binding'
      readonly originalKey: string | undefined
      readonly nextKey: string
      readonly commands: PluginKeymapCommandEntry[]
      readonly source: 'preset' | 'override' | 'custom' | 'disabled' | 'add'
    }

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeymapEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing key (empty string when adding a new entry) */
  initialKey?: string
  /** Existing commands (undefined when adding) */
  initialCommands?: PluginKeymapCommandEntry[]
  /** True if this key is currently disabled (false override) */
  initialDisabled?: boolean
  /** Whether the key exists in the current preset (controls "reset to preset" option) */
  existsInPreset?: boolean
  /** Source of the row being edited */
  rowSource?: 'preset' | 'override' | 'custom' | 'disabled'
  /** Available commands for the dropdown */
  availableCommands: PluginKeymapCommand[]
  /** Whether disabling keys is allowed by the schema */
  allowDisable?: boolean
  /** All keys already in the effective map (for duplicate warning) */
  existingKeys: Set<string>
  /**
   * Whether rebinding (key rename) is allowed by the parent.
   * When false and the user attempts a rebind, an inline blocked message is shown
   * and Save is disabled. Defaults to true.
   */
  canRebind?: boolean
  /**
   * Called on save with a typed intent payload.
   */
  onSave: (intent: KeymapSaveIntent) => void
  /** Called when user wants to reset this key to its preset default */
  onResetToPreset?: (key: string) => void
  /** Called when user wants to delete this custom key entirely */
  onDelete?: (key: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeymapEditDialog({
  open,
  onOpenChange,
  initialKey = '',
  initialCommands,
  initialDisabled = false,
  existsInPreset = false,
  rowSource,
  availableCommands,
  allowDisable = false,
  existingKeys,
  canRebind = true,
  onSave,
  onResetToPreset,
  onDelete,
}: KeymapEditDialogProps): React.JSX.Element {
  const isAdding = initialKey === ''

  const [key, setKey] = useState(initialKey)
  const [commands, setCommands] = useState<PluginKeymapCommandEntry[]>(
    initialCommands ?? [],
  )
  const [disabled, setDisabled] = useState(initialDisabled)

  // Effect-based draft hydration: rehydrate whenever the edit target changes
  // (open state, originalKey, initialCommands, or initialDisabled).
  // This is the single resync strategy — no remount/epoch-key tricks.
  useEffect(() => {
    if (!open) return
    setKey(initialKey)
    setCommands(initialCommands ?? [])
    setDisabled(initialDisabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey, initialCommands, initialDisabled])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const keyTrimmed = key.trim()
  const normalizedKey = normalizeKeymapKey(keyTrimmed)
  const normalizedOriginal = normalizeKeymapKey(initialKey)

  // Is the user changing the key from the original? (rebind intent)
  const isRebind =
    !isAdding && normalizedKey !== '' && normalizedKey !== normalizedOriginal

  // Hard-block: rebind is attempted but the parent signals it is not allowed.
  // When blocked: show actionable inline error, disable Save, keep dialog open.
  const isRebindBlocked = isRebind && !canRebind

  // Duplicate check: exclude current row identity (by normalized original key)
  const isDuplicateKey = (() => {
    if (keyTrimmed === '') return false
    if (!existingKeys.has(normalizedKey) && !existingKeys.has(keyTrimmed))
      return false
    // If editing existing row and key hasn't changed, it's not a duplicate
    if (!isAdding && normalizedKey === normalizedOriginal) return false
    return true
  })()

  // When in rebind mode, disable toggle must be forced off
  const effectiveDisabled = isRebind ? false : disabled

  // Show disable toggle when: allowDisable is true AND (key exists in preset OR is already disabled)
  const showDisableToggle =
    allowDisable && !isAdding && (existsInPreset || initialDisabled)

  const canSave = (() => {
    if (keyTrimmed === '') return false
    if (isDuplicateKey) return false
    // Hard-block: rebind is not allowed
    if (isRebindBlocked) return false
    if (effectiveDisabled) return true
    return commands.length > 0
  })()

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDisableToggle = (checked: boolean): void => {
    // If user turns on disable while in rebind mode, snap key back to original
    if (checked && isRebind) {
      setKey(initialKey)
    }
    setDisabled(checked)
  }

  const handleSave = (): void => {
    if (!canSave) return

    if (effectiveDisabled && !isAdding) {
      // Disable-original intent
      onSave({ intent: 'disable-original', originalKey: initialKey })
    } else {
      // Upsert-binding intent
      const source: 'preset' | 'override' | 'custom' | 'disabled' | 'add' =
        isAdding ? 'add' : (rowSource ?? 'custom')
      onSave({
        intent: 'upsert-binding',
        originalKey: isAdding ? undefined : initialKey,
        nextKey: normalizedKey !== '' ? normalizedKey : keyTrimmed,
        commands,
        source,
      })
    }
    onOpenChange(false)
  }

  const handleResetToPreset = (): void => {
    if (onResetToPreset !== undefined) {
      onResetToPreset(initialKey)
    }
    onOpenChange(false)
  }

  const handleDelete = (): void => {
    if (onDelete !== undefined) {
      onDelete(initialKey)
    }
    onOpenChange(false)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isAdding ? 'Add Key Binding' : 'Edit Key Binding'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key input — always enabled (rebind is allowed) */}
          <div className="space-y-1.5">
            <KeyCaptureInput
              value={key}
              onChange={setKey}
              label="Key"
              placeholder="<CR>"
              disabled={effectiveDisabled && !isAdding}
              showHelp={true}
            />
            {isDuplicateKey && (
              <p className="text-xs text-destructive">
                This key already exists in the effective map. Edit it from the
                table instead.
              </p>
            )}
            {!isAdding && existsInPreset && !isRebind && (
              <p className="text-xs text-muted-foreground">
                This key is defined by the preset.{' '}
                <span className="text-foreground font-medium">
                  Your changes override the preset.
                </span>
              </p>
            )}
            {isRebindBlocked && (
              <p className="text-xs text-destructive" role="alert">
                Rebinding is not available for this preset configuration. To
                rebind keys, either enable <code>allowDisable</code> in the
                schema or add a <code>none</code> preset. Reset the key to{' '}
                <kbd className="bg-muted rounded px-1 py-0.5 text-xs font-mono border">
                  {initialKey}
                </kbd>{' '}
                to save.
              </p>
            )}
            {isRebind && !isRebindBlocked && (
              <p className="text-xs text-muted-foreground">
                Rebinding from{' '}
                <kbd className="bg-muted rounded px-1 py-0.5 text-xs font-mono border">
                  {initialKey}
                </kbd>{' '}
                to{' '}
                <kbd className="bg-muted rounded px-1 py-0.5 text-xs font-mono border">
                  {keyTrimmed}
                </kbd>
                . The original key will be disabled.
              </p>
            )}
          </div>

          {/* Disable toggle (only when allowDisable and key exists in preset or is already disabled) */}
          {showDisableToggle && (
            <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
              <Switch
                id="disable-key"
                aria-label="Disable this key"
                checked={effectiveDisabled}
                onCheckedChange={handleDisableToggle}
                disabled={isRebind}
              />
              <div>
                <p className="text-sm font-medium">Disable this key</p>
                <p className="text-xs text-muted-foreground">
                  {isRebind
                    ? 'Cannot disable while rebinding — reset key to original first'
                    : "Prevents the preset's binding from triggering for this key"}
                </p>
              </div>
            </div>
          )}

          {/* Command list (only shown when not disabled) */}
          {!effectiveDisabled && (
            <CommandListEditor
              key={`${initialKey}::${open ? 'open' : 'closed'}::${getCommandListDraftSeed(initialCommands ?? [])}`}
              commands={commands}
              availableCommands={availableCommands}
              onChange={setCommands}
            />
          )}

          {effectiveDisabled && (
            <div className="rounded-md border border-dashed px-3 py-3">
              <p className="text-xs text-muted-foreground italic">
                Key is disabled — it will be explicitly set to{' '}
                <Badge
                  variant="destructive"
                  className="text-xs font-mono px-1 py-0"
                >
                  false
                </Badge>{' '}
                in the generated config.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {/* Left side: destructive actions */}
          <div className="flex gap-2">
            {!isAdding && onResetToPreset !== undefined && existsInPreset && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToPreset}
              >
                Reset to preset
              </Button>
            )}
            {!isAdding && onDelete !== undefined && !existsInPreset && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>

          {/* Right side: cancel / save */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {isAdding ? 'Add' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
