import { Play, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { ActionPickerModal } from '@/shared/components/action-picker'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'
import type { RunActionFormProps, RunActionFormValidationResult } from './types'

// ============================================
// Validation Functions
// ============================================

export function validateRunActionForm(
  config: RunActionFormProps['config'],
): RunActionFormValidationResult {
  const errors: string[] = []
  if (config.action.trim().length === 0) {
    errors.push('Action is required.')
  }

  const warnings: string[] = []
  if (config.mode === 'custom-command' && config.action.includes('\n')) {
    warnings.push(
      'Multiline command detected. Only single Ex command strings are supported.',
    )
  }

  return { errors, warnings }
}

// ============================================
// Main Component
// ============================================

export function RunActionForm({
  config,
  onChange,
  showFrame = true,
  catalog,
}: RunActionFormProps): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preferredMode, setPreferredMode] = useState<'preset' | 'custom'>(
    config.mode.startsWith('custom') ? 'custom' : 'preset',
  )

  // Local state for custom input to enable real-time updates
  const [customInput, setCustomInput] = useState(
    config.mode.startsWith('custom') ? config.action : '',
  )

  // Sync preferredMode with config.mode when it changes externally (e.g., after confirm/reopen)
  useEffect(() => {
    setPreferredMode(config.mode.startsWith('custom') ? 'custom' : 'preset')
  }, [config.mode])

  // Sync customInput when config changes externally
  useEffect(() => {
    if (config.mode.startsWith('custom')) {
      setCustomInput(config.action)
    }
  }, [config.mode, config.action])

  const validation = useMemo(() => validateRunActionForm(config), [config])

  // Get the selected action info for display
  const selectedAction = useMemo(() => {
    if (config.mode === 'catalog' && config.selectedActionKey) {
      return (
        catalog.find((entry) => entry.key === config.selectedActionKey) ?? null
      )
    }
    return null
  }, [catalog, config.mode, config.selectedActionKey])

  // Get a display label for the current selection
  const displayLabel = useMemo(() => {
    if (config.mode === 'catalog' && selectedAction) {
      return selectedAction.label
    }
    if (config.mode === 'custom-command') {
      return 'Custom Command'
    }
    if (config.mode === 'custom-keys') {
      return 'Custom Key Sequence'
    }
    return 'No action selected'
  }, [config.mode, selectedAction])

  const handlePickerConfirm = (newConfig: {
    mode: 'catalog' | 'custom-command' | 'custom-keys'
    actionType: 'command' | 'keys'
    action: string
    selectedActionKey: string
    paramValues: Record<string, string>
  }) => {
    onChange({
      mode: newConfig.mode,
      actionType: newConfig.actionType,
      action: newConfig.action,
      selectedActionKey: newConfig.selectedActionKey,
      paramValues: newConfig.paramValues,
    })
  }

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value)
    const isCommand = value.startsWith(':')
    onChange({
      mode: isCommand ? 'custom-command' : 'custom-keys',
      actionType: isCommand ? 'command' : 'keys',
      action: value,
      selectedActionKey: '', // Clear catalog selection
      paramValues: {},
    })
  }

  const content = (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mode:</span>
        <ToggleGroup
          type="single"
          value={preferredMode}
          onValueChange={(v) => {
            if (!v) return
            const newMode = v as 'preset' | 'custom'
            setPreferredMode(newMode)

            // When switching to custom, initialize the custom input
            if (newMode === 'custom' && config.mode === 'catalog') {
              // Start fresh with empty custom input
              setCustomInput('')
              onChange({
                mode: 'custom-keys', // Default to keys
                actionType: 'keys',
                action: '',
                selectedActionKey: '',
                paramValues: {},
              })
            }
          }}
          size="sm"
        >
          <ToggleGroupItem value="preset">Preset</ToggleGroupItem>
          <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Current selection display - different for preset vs custom */}
      {preferredMode === 'preset' ? (
        // Preset mode - show selection display
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{displayLabel}</span>
          </div>

          {/* Action preview */}
          <code
            className={cn(
              'block p-2 rounded bg-muted font-mono text-sm break-all',
              !config.action && 'text-muted-foreground italic',
            )}
          >
            {config.action || '(no action selected)'}
          </code>

          {/* Parameter values display (if catalog mode with params) */}
          {config.mode === 'catalog' &&
            Object.keys(config.paramValues).length > 0 && (
              <div className="text-xs text-muted-foreground">
                <p>Parameters:</p>
                <div className="flex gap-2 flex-wrap mt-1">
                  {Object.entries(config.paramValues).map(([key, value]) => (
                    <span
                      key={key}
                      className="bg-muted px-1.5 py-0.5 rounded font-mono"
                    >
                      {key}: {value || '(empty)'}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Open picker button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPickerOpen(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            {config.action ? 'Change Action' : 'Select Action'}
          </Button>
        </div>
      ) : (
        // Custom mode - inline text input
        <div className="rounded-md border p-3 space-y-3">
          {/* Text input for custom action */}
          <div className="space-y-2">
            <Input
              value={customInput}
              onChange={(e) => handleCustomInputChange(e.target.value)}
              placeholder=":write or gg"
              className="font-mono"
            />
          </div>

          {/* Hints - same as ActionPickerCustom */}
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li>
              Commands start with{' '}
              <code className="bg-muted px-1 rounded">:</code> (e.g.,{' '}
              <code>:write</code>, <code>:quit</code>)
            </li>
            <li>
              Key sequences are literal keys (e.g., <code>gg</code>,{' '}
              <code>dd</code>)
            </li>
            <li>
              Use <code>&lt;C-x&gt;</code> for Ctrl+x, <code>&lt;CR&gt;</code>{' '}
              for Enter
            </li>
          </ul>

          {/* Type indicator */}
          {customInput && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Detected type:</span>
              <span className="font-medium">
                {customInput.startsWith(':') ? 'Ex Command' : 'Key Sequence'}
              </span>
            </div>
          )}

          {/* Optional: Button to open modal for more space */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setPickerOpen(true)}
          >
            Open in modal for more space
          </Button>
        </div>
      )}

      {/* Action Picker Modal */}
      <ActionPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={config}
        onConfirm={handlePickerConfirm}
        initialMode={preferredMode}
        catalog={catalog}
      />
    </div>
  )

  if (!showFrame) {
    return content
  }

  return (
    <ActionEditorFrame
      title="Run Action"
      description="Execute an Ex command or key sequence."
      errors={validation.errors}
      warnings={validation.warnings}
    >
      {content}
    </ActionEditorFrame>
  )
}
