import { Keyboard } from 'lucide-react'
import { useState } from 'react'
import { KeyCaptureDialog } from '@/features/keymaps/components/KeyCaptureDialog'
import { useProjectNeovimOptions } from '@/features/settings/hooks/useProjectNeovimOptions'
import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import type { KeymapMode, SetKeymapActionConfig } from '@/shared/types'
import { useIsPortConnected } from '../../../hooks/useIsPortConnected'

interface SetKeymapActionEditorProps {
  config: SetKeymapActionConfig
  nodeId: string
  onChange: (config: SetKeymapActionConfig) => void
}

const MODE_LABELS: Record<KeymapMode, string> = {
  n: 'Normal',
  i: 'Insert',
  v: 'Visual+Select',
  x: 'Visual',
  t: 'Terminal',
  c: 'Command-line',
  o: 'Operator-pending',
  s: 'Select',
}

const MODE_ORDER: readonly KeymapMode[] = [
  'n',
  'i',
  'v',
  'x',
  't',
  'c',
  'o',
  's',
]

function buildErrors(
  config: SetKeymapActionConfig,
  isOnPressConnected: boolean,
  isKeySequenceConnected: boolean,
): string[] {
  const errors: string[] = []

  if (config.modes.length === 0) {
    errors.push('At least one mode is required.')
  }
  if (!isKeySequenceConnected && config.keySequence.trim().length === 0) {
    errors.push('Key sequence is required.')
  }
  if (!isOnPressConnected && config.command.trim().length === 0) {
    errors.push('Command/RHS is required.')
  }

  if (
    config.command.includes('<Cmd>') &&
    !config.command.trim().endsWith('<CR>')
  ) {
    errors.push('Mappings using <Cmd> must end with <CR>.')
  }

  return errors
}

function buildWarnings(config: SetKeymapActionConfig): string[] {
  const warnings: string[] = []
  if (!config.noremap) {
    warnings.push('Recursive mapping enabled (noremap=false).')
  }
  if (!config.showInKeymaps) {
    warnings.push('Hidden from the Shortcuts page.')
  }
  return warnings
}

function ConnectedFieldPlaceholder({
  label,
}: {
  label: string
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <p>
          Value comes from connected input port. Disconnect to edit manually.
        </p>
      </div>
    </div>
  )
}

export function SetKeymapActionEditor({
  config,
  nodeId,
  onChange,
}: SetKeymapActionEditorProps): React.JSX.Element {
  const isOnPressConnected = useIsPortConnected(nodeId, 'on-press')
  const isKeySequenceConnected = useIsPortConnected(nodeId, 'key-sequence')
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)
  const { leaderKey } = useProjectNeovimOptions()

  return (
    <ActionEditorFrame
      title="Set Keymap"
      description="Create a mapping with mode, lhs, rhs and map options."
      errors={buildErrors(config, isOnPressConnected, isKeySequenceConnected)}
      warnings={buildWarnings(config)}
    >
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Modes</p>
        <div className="grid grid-cols-2 gap-2">
          {MODE_ORDER.map((mode) => {
            const checked = config.modes.includes(mode)
            return (
              <label
                key={mode}
                className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const nextModes = checked
                      ? config.modes.filter((entry) => entry !== mode)
                      : [...config.modes, mode]
                    onChange({ ...config, modes: nextModes })
                  }}
                />
                <span>
                  {mode} - {MODE_LABELS[mode]}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {isKeySequenceConnected ? (
        <ConnectedFieldPlaceholder label="Key Sequence (lhs)" />
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Key Sequence (lhs)</p>
          <div className="flex gap-2">
            <Input
              value={config.keySequence}
              onChange={(event) =>
                onChange({
                  ...config,
                  keySequence: event.target.value,
                })
              }
              placeholder="<leader>ff"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCaptureDialogOpen(true)}
              className="shrink-0"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </div>
          <KeyCaptureDialog
            open={captureDialogOpen}
            onOpenChange={setCaptureDialogOpen}
            initialValue={config.keySequence}
            onCapture={(seq) => onChange({ ...config, keySequence: seq })}
            leaderKey={leaderKey}
          />
        </div>
      )}

      {isOnPressConnected ? (
        <ConnectedFieldPlaceholder label="Command / RHS" />
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Command / RHS</p>
          <Input
            value={config.command}
            onChange={(event) =>
              onChange({
                ...config,
                command: event.target.value,
              })
            }
            placeholder="<Cmd>Telescope find_files<CR>"
          />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Description</p>
        <Input
          value={config.description}
          onChange={(event) =>
            onChange({
              ...config,
              description: event.target.value,
            })
          }
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.silent}
            onChange={(event) =>
              onChange({
                ...config,
                silent: event.target.checked,
              })
            }
          />
          silent
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.noremap}
            onChange={(event) =>
              onChange({
                ...config,
                noremap: event.target.checked,
              })
            }
          />
          noremap
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.expr}
            onChange={(event) =>
              onChange({
                ...config,
                expr: event.target.checked,
              })
            }
          />
          expr
        </label>
      </div>

      <div className="space-y-1 mt-3 pt-3 border-t">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.showInKeymaps}
            onChange={(event) =>
              onChange({
                ...config,
                showInKeymaps: event.target.checked,
              })
            }
          />
          <span>Show in Shortcuts page</span>
        </label>
        <p className="text-xs text-muted-foreground ml-5">
          When enabled, this keymap appears in the centralized Shortcuts page.
          Disable if this is a helper mapping you don't want to clutter the
          list.
        </p>
      </div>
    </ActionEditorFrame>
  )
}
