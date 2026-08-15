import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePluginStore } from '@/features/plugins'
import { useTutorialStore } from '@/features/tutorial/store'
import {
  validateRunActionForm,
  validateSetOptionForm,
  validateSetVariableForm,
} from '@/shared/components/action-forms'
import { Button } from '@/shared/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { buildCatalog } from '@/shared/data/catalog-builder'
import { buildFunctionCatalog } from '@/shared/data/function-catalog-builder'
import { ACTION_CATALOG } from '@/shared/data/neovim/action-catalog-entries'
import type { KeymapMode, RunFunctionDefaultValue } from '@/shared/types'
import { isCatalogActionEntry } from '@/shared/types/catalog'
import {
  ACTION_TYPE_DESCRIPTIONS,
  ACTION_TYPE_GROUPS,
  ACTION_TYPE_LABELS,
} from '../constants'
import { useKeymapStore } from '../store'
import type {
  ManualKeymapAction,
  ManualKeymapActionType,
  ProjectKeymap,
} from '../types'
import { CodeBlockEditor } from './action-editors/CodeBlockEditor'
import { RunActionEditor } from './action-editors/RunActionEditor'
import { RunCustomActionEditor } from './action-editors/RunCustomActionEditor'
import { RunFunctionEditor } from './action-editors/RunFunctionEditor'
import { SetOptionEditor } from './action-editors/SetOptionEditor'
import { SetVariableEditor } from './action-editors/SetVariableEditor'
import { KeyCapture } from './KeyCapture'
import { ModeSelector } from './ModeSelector'

interface KeymapEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If provided, dialog is in "edit" mode. If null, "create" mode. */
  editingKeymap: ProjectKeymap | null
  projectPath: string
}

function createDefaultAction(type: ManualKeymapActionType): ManualKeymapAction {
  switch (type) {
    case 'run-action':
      return {
        actionType: 'run-action',
        config: {
          mode: 'catalog',
          actionType: 'command',
          action: '',
          selectedActionKey: '',
          paramValues: {},
        },
      }
    case 'run-function':
      return {
        actionType: 'run-function',
        selectedFunctionKey: '',
        functionSource: { type: 'core', functionName: '' },
        signature: null,
        paramDefaults: {},
      }
    case 'set-option':
      return {
        actionType: 'set-option',
        optionName: '',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      }
    case 'set-variable':
      return {
        actionType: 'set-variable',
        scope: 'g',
        variableName: '',
        valueType: 'string',
        value: '',
      }
    case 'code-block':
      return {
        actionType: 'code-block',
        code: '',
      }
    case 'run-custom-action':
      return { actionType: 'run-custom-action', graphId: '', graphName: '' }
    default: {
      // Exhaustiveness check
      ;((_exhaustive: never) => _exhaustive)(type)
      return {
        actionType: 'run-action',
        config: {
          mode: 'catalog',
          actionType: 'command',
          action: '',
          selectedActionKey: '',
          paramValues: {},
        },
      }
    }
  }
}

function getActionValidationErrors(
  action: ManualKeymapAction,
  availableFunctionKeys?: ReadonlySet<string>,
): string[] {
  switch (action.actionType) {
    case 'run-action': {
      const result = validateRunActionForm({
        mode: action.config.mode,
        actionType: action.config.actionType,
        action: action.config.action,
        selectedActionKey: action.config.selectedActionKey,
        paramValues: action.config.paramValues,
      })
      // Add command-specific validation
      if (
        action.config.action.includes('<Cmd>') &&
        !action.config.action.trim().endsWith('<CR>')
      ) {
        result.errors.push(
          'Commands starting with <Cmd> need to end with <CR>. Example: <Cmd>write<CR>',
        )
      }
      return result.errors
    }
    case 'run-function': {
      return getRunFunctionValidationErrors(action, availableFunctionKeys)
    }
    case 'set-option': {
      const result = validateSetOptionForm({
        optionName: action.optionName,
        scope: action.scope,
        valueConfig: action.valueConfig,
      })
      return result.errors
    }
    case 'set-variable': {
      const result = validateSetVariableForm({
        scope: action.scope,
        variableName: action.variableName,
        valueType: action.valueType,
        value: action.value,
      })
      return result.errors
    }
    case 'code-block': {
      if (action.code.trim().length === 0) {
        return ['Enter some Lua code to execute.']
      }
      return []
    }
    case 'run-custom-action':
      return action.graphId.length === 0
        ? ['Choose a custom action or create a new one.']
        : []
    default: {
      // Exhaustiveness check
      ;((_exhaustive: never) => _exhaustive)(action)
      return []
    }
  }
}

function getRunFunctionValidationErrors(
  action: Extract<ManualKeymapAction, { actionType: 'run-function' }>,
  availableFunctionKeys?: ReadonlySet<string>,
): string[] {
  const errors: string[] = []

  if (action.selectedFunctionKey.trim().length === 0) {
    errors.push('Choose a function to call.')
  }

  if (action.functionSource.type === 'core') {
    if (action.functionSource.functionName.trim().length === 0) {
      errors.push('Enter the Neovim API function name to call.')
    }
  } else {
    if (action.functionSource.pluginId.trim().length === 0) {
      errors.push('Enter the plugin ID.')
    }
    if (action.functionSource.functionName.trim().length === 0) {
      errors.push('Enter the plugin function name to call.')
    }
  }

  if (
    action.selectedFunctionKey.trim().length > 0 &&
    availableFunctionKeys !== undefined &&
    !availableFunctionKeys.has(action.selectedFunctionKey)
  ) {
    errors.push(
      'The selected function is no longer available (removed or plugin disabled). Re-select a function.',
    )
  }

  if (action.signature !== null) {
    const missingDefaults = action.signature.params
      .filter((param) => !(param.optional ?? false))
      .filter(
        (param) =>
          !hasConfiguredRunFunctionDefault(action.paramDefaults[param.name]),
      )

    if (missingDefaults.length > 0) {
      errors.push(
        `Set default values for required parameters: ${missingDefaults
          .map((param) => param.name)
          .join(', ')}`,
      )
    }
  }

  return errors
}

function hasConfiguredRunFunctionDefault(
  value: RunFunctionDefaultValue | undefined,
): boolean {
  if (value === undefined) {
    return false
  }

  if (value.kind === 'lua') {
    return value.lua.trim().length > 0
  }

  if (value.kind === 'scalar' && typeof value.value === 'string') {
    return value.value.trim().length > 0
  }

  if (value.kind === 'multiselect') {
    return value.values.length > 0
  }

  if (value.kind === 'object') {
    return Object.keys(value.entries).length > 0
  }

  return true
}

function validateKeymapForm(
  modes: KeymapMode[],
  keySequence: string,
  action: ManualKeymapAction,
  availableFunctionKeys?: ReadonlySet<string>,
): string[] {
  const errors: string[] = []
  if (modes.length === 0)
    errors.push('Choose at least one mode for this shortcut to work in.')
  if (keySequence.trim().length === 0)
    errors.push('Enter the key combination you want to use.')
  errors.push(...getActionValidationErrors(action, availableFunctionKeys))
  return errors
}

export function KeymapEditorDialog({
  open,
  onOpenChange,
  editingKeymap,
  projectPath,
}: KeymapEditorDialogProps): React.JSX.Element {
  const { addManualKeymap, updateManualKeymap } = useKeymapStore()
  const schemas = usePluginStore((state) => state.schemas)
  const installedPlugins = usePluginStore((state) => state.installedPlugins)

  const enabledSchemas = useMemo(
    () =>
      schemas.filter((schema) =>
        installedPlugins.some(
          (plugin) => plugin.schemaId === schema.schema.id && plugin.enabled,
        ),
      ),
    [schemas, installedPlugins],
  )

  const availableFunctionKeys = useMemo(() => {
    const catalog = buildFunctionCatalog(enabledSchemas)
    return new Set(catalog.entries.map((entry) => entry.key))
  }, [enabledSchemas])
  const actionCatalog = useMemo(
    () =>
      buildCatalog(ACTION_CATALOG, enabledSchemas).filter(isCatalogActionEntry),
    [enabledSchemas],
  )

  const [modes, setModes] = useState<KeymapMode[]>(['n'])
  const [keySequence, setKeySequence] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] =
    useState<ManualKeymapActionType>('run-action')
  const [action, setAction] = useState<ManualKeymapAction>(
    createDefaultAction('run-action'),
  )
  const [silent, setSilent] = useState(true)
  const [noremap, setNoremap] = useState(true)
  const [expr, setExpr] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const isEditing = editingKeymap !== null

  // Check if tutorial is active to prevent outside close
  const runtimeState = useTutorialStore((s) => s.runtimeState)
  const isTutorialActive =
    runtimeState.status === 'active' || runtimeState.status === 'paused'

  useEffect(() => {
    if (!open) return

    if (editingKeymap) {
      setModes(editingKeymap.modes)
      setKeySequence(editingKeymap.keySequence)
      setDescription(editingKeymap.description)
      setActionType(editingKeymap.action.actionType)
      setAction(editingKeymap.action)
      setSilent(editingKeymap.silent)
      setNoremap(editingKeymap.noremap)
      setExpr(editingKeymap.expr)
      // Open advanced options if any non-default values
      setAdvancedOpen(
        !editingKeymap.silent || !editingKeymap.noremap || editingKeymap.expr,
      )
    } else {
      // Reset to defaults
      setModes(['n'])
      setKeySequence('')
      setDescription('')
      setActionType('run-action')
      setAction(createDefaultAction('run-action'))
      setSilent(true)
      setNoremap(true)
      setExpr(false)
      setAdvancedOpen(false)
    }
  }, [editingKeymap, open])

  function handleActionTypeChange(newType: ManualKeymapActionType): void {
    setActionType(newType)
    setAction(createDefaultAction(newType))
  }

  /**
   * Returns validation errors for the keymap form fields (modes + keySequence only).
   * Used by RunCustomActionEditor to validate before creating a graph.
   * Does NOT validate the action since it will be set after graph creation.
   */
  const getKeymapFormValidationErrors = useCallback((): string[] => {
    const errors: string[] = []
    if (modes.length === 0)
      errors.push('Choose at least one mode for this shortcut to work in.')
    if (keySequence.trim().length === 0)
      errors.push('Please enter a key sequence before creating a graph.')
    return errors
  }, [modes, keySequence])

  const validationErrors = validateKeymapForm(
    modes,
    keySequence,
    action,
    availableFunctionKeys,
  )

  async function handleSubmit(): Promise<void> {
    if (validationErrors.length > 0) return

    setIsSaving(true)

    try {
      if (isEditing) {
        await updateManualKeymap(editingKeymap.id, {
          modes,
          keySequence,
          action,
          description,
          silent,
          noremap,
          expr,
        })
      } else {
        await addManualKeymap({
          modes,
          keySequence,
          action,
          description,
          silent,
          noremap,
          expr,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save shortcut',
      )
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Called by RunCustomActionEditor when quick-creating a new action.
   * Persists the keymap before navigating to the editor.
   * Receives the new graph data directly to avoid race conditions with state propagation.
   */
  const handleQuickCreate = useCallback(
    async (newGraphId: string, newGraphName: string): Promise<void> => {
      // Build the action with the provided graph data
      const newAction: ManualKeymapAction = {
        actionType: 'run-custom-action',
        graphId: newGraphId,
        graphName: newGraphName,
      }

      try {
        if (isEditing && editingKeymap) {
          await updateManualKeymap(editingKeymap.id, {
            modes,
            keySequence,
            action: newAction,
            description,
            silent,
            noremap,
            expr,
          })
        } else {
          await addManualKeymap({
            modes,
            keySequence,
            action: newAction,
            description,
            silent,
            noremap,
            expr,
          })
        }
        onOpenChange(false)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save shortcut',
        )
        throw err // Re-throw so the caller knows it failed
      }
    },
    [
      isEditing,
      editingKeymap,
      modes,
      keySequence,
      description,
      silent,
      noremap,
      expr,
      addManualKeymap,
      updateManualKeymap,
      onOpenChange,
    ],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        data-tutorial="keymap-editor-dialog"
        preventOutsideClose={isTutorialActive}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Keyboard Shortcut' : 'Create Keyboard Shortcut'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify this keyboard shortcut.'
              : 'Define a new keyboard shortcut for Neovim.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <KeyCapture value={keySequence} onChange={setKeySequence} />

          <ModeSelector selected={modes} onChange={setModes} />

          <div className="space-y-1">
            <p className="text-sm font-medium">Description</p>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this shortcut does"
            />
            <p className="text-xs text-muted-foreground">
              A brief note to help you remember what this shortcut does
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">What happens when pressed?</p>

            <Select
              value={actionType}
              onValueChange={(v) =>
                handleActionTypeChange(v as ManualKeymapActionType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </SelectLabel>
                    {group.types.map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex flex-col">
                          <span>{ACTION_TYPE_LABELS[type]}</span>
                          <span className="text-xs text-muted-foreground">
                            {ACTION_TYPE_DESCRIPTIONS[type]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Separator className="my-4" />

            {/* Render action-specific editor */}
            {renderActionEditor(
              action,
              setAction,
              projectPath,
              handleQuickCreate,
              getKeymapFormValidationErrors,
              actionCatalog,
            )}
          </div>

          <Separator />

          {/* Advanced Options */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? '' : '-rotate-90'}`}
              />
              Advanced Options
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <div className="grid grid-cols-1 gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={silent}
                    onChange={(e) => setSilent(e.target.checked)}
                  />
                  <span>Quiet mode (silent)</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={noremap}
                    onChange={(e) => setNoremap(e.target.checked)}
                  />
                  <span>Non-recursive (noremap) — recommended</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={expr}
                    onChange={(e) => setExpr(e.target.checked)}
                  />
                  <span>Expression mode (expr)</span>
                </label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4 space-y-1">
                {validationErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={validationErrors.length > 0 || isSaving}
          >
            {isSaving
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save Changes'
                : 'Create Shortcut'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function renderActionEditor(
  action: ManualKeymapAction,
  setAction: React.Dispatch<React.SetStateAction<ManualKeymapAction>>,
  projectPath: string,
  onQuickCreate: (newGraphId: string, newGraphName: string) => Promise<void>,
  getKeymapValidationErrors: () => string[],
  actionCatalog: readonly import('@/shared/types/catalog').CatalogActionEntry[],
): React.JSX.Element {
  switch (action.actionType) {
    case 'run-action':
      return (
        <RunActionEditor
          mode={action.config.mode}
          actionType={action.config.actionType}
          action={action.config.action}
          selectedActionKey={action.config.selectedActionKey}
          paramValues={action.config.paramValues}
          onChange={(updates) =>
            setAction((prev) =>
              prev.actionType !== 'run-action'
                ? prev
                : { ...prev, config: { ...prev.config, ...updates } },
            )
          }
          catalog={actionCatalog}
        />
      )
    case 'run-function':
      return (
        <RunFunctionEditor
          selectedFunctionKey={action.selectedFunctionKey}
          functionSource={action.functionSource}
          signature={action.signature}
          paramDefaults={action.paramDefaults}
          onChange={(updates) =>
            setAction((prev) => {
              if (prev.actionType !== 'run-function') return prev
              return { ...prev, ...updates }
            })
          }
        />
      )
    case 'set-option':
      return (
        <SetOptionEditor
          optionName={action.optionName}
          scope={action.scope}
          valueConfig={action.valueConfig}
          onChange={(updates) =>
            setAction((prev) => {
              if (prev.actionType !== 'set-option') return prev
              return { ...prev, ...updates }
            })
          }
        />
      )
    case 'set-variable':
      return (
        <SetVariableEditor
          scope={action.scope}
          variableName={action.variableName}
          valueType={action.valueType}
          value={action.value}
          onChange={(updates) =>
            setAction((prev) => {
              if (prev.actionType !== 'set-variable') return prev
              return { ...prev, ...updates }
            })
          }
        />
      )
    case 'code-block':
      return (
        <CodeBlockEditor
          code={action.code}
          onChange={(code) => setAction({ actionType: 'code-block', code })}
        />
      )
    case 'run-custom-action':
      return (
        <RunCustomActionEditor
          graphId={action.graphId}
          graphName={action.graphName}
          onChange={(graphId, graphName) =>
            setAction({
              actionType: 'run-custom-action',
              graphId,
              graphName,
            })
          }
          projectPath={projectPath}
          onQuickCreate={onQuickCreate}
          getKeymapValidationErrors={getKeymapValidationErrors}
        />
      )
    default: {
      // Exhaustiveness check
      ;((_exhaustive: never) => _exhaustive)(action)
      return <div>Unknown action type</div>
    }
  }
}
