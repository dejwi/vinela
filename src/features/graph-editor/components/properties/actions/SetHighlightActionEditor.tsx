import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { Input } from '@/shared/components/ui/input'
import type { SetHighlightActionConfig } from '@/shared/types'
import { useIsPortConnected } from '../../../hooks/useIsPortConnected'

interface SetHighlightActionEditorProps {
  config: SetHighlightActionConfig
  nodeId: string
  onChange: (config: SetHighlightActionConfig) => void
}

function isValidHighlightColor(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return true
  }
  if (trimmed.toUpperCase() === 'NONE') {
    return true
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed) || /^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return true
  }
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmed)
}

function buildErrors(
  config: SetHighlightActionConfig,
  isForegroundConnected: boolean,
  isBackgroundConnected: boolean,
  isGroupNameConnected: boolean,
): string[] {
  const errors: string[] = []
  if (!isGroupNameConnected && config.groupName.trim().length === 0) {
    errors.push('Highlight group name is required.')
  }
  if (!isForegroundConnected && !isValidHighlightColor(config.foreground)) {
    errors.push('Foreground color must be hex, NONE, or color name token.')
  }
  if (!isBackgroundConnected && !isValidHighlightColor(config.background)) {
    errors.push('Background color must be hex, NONE, or color name token.')
  }
  return errors
}

/**
 * Convert a color value to a valid 6-digit hex for the color picker.
 * Returns fallback if the value is not a valid hex color.
 */
function toHexColorForPicker(value: string, fallback = '#000000'): string {
  const trimmed = value.trim()
  // 6-digit hex
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  // 3-digit hex - expand to 6
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

export function SetHighlightActionEditor({
  config,
  nodeId,
  onChange,
}: SetHighlightActionEditorProps): React.JSX.Element {
  const isForegroundConnected = useIsPortConnected(nodeId, 'foreground')
  const isBackgroundConnected = useIsPortConnected(nodeId, 'background')
  const isGroupNameConnected = useIsPortConnected(nodeId, 'group-name')

  return (
    <ActionEditorFrame
      title="Set Highlight"
      description="Customize how text looks in Neovim. Set colors and styles for a named highlight group."
      errors={buildErrors(
        config,
        isForegroundConnected,
        isBackgroundConnected,
        isGroupNameConnected,
      )}
    >
      {isGroupNameConnected ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Group Name</p>
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p>Group name comes from connected input port.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Group Name</p>
          <Input
            value={config.groupName}
            onChange={(event) =>
              onChange({
                ...config,
                groupName: event.target.value,
              })
            }
            placeholder="NormalFloat"
          />
          <p className="text-xs text-muted-foreground">
            A highlight group controls the appearance of UI elements. Common
            groups: <code>Normal</code>, <code>Comment</code>,{' '}
            <code>CursorLine</code>, <code>StatusLine</code>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Foreground</p>
          {isForegroundConnected ? (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p>Color comes from connected input port.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHexColorForPicker(config.foreground, '#d4d4d4')}
                onChange={(event) =>
                  onChange({
                    ...config,
                    foreground: event.target.value,
                  })
                }
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                title="Pick foreground color"
              />
              <Input
                value={config.foreground}
                onChange={(event) =>
                  onChange({
                    ...config,
                    foreground: event.target.value,
                  })
                }
                placeholder="#d4d4d4"
              />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Background</p>
          {isBackgroundConnected ? (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p>Color comes from connected input port.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHexColorForPicker(config.background, '#202020')}
                onChange={(event) =>
                  onChange({
                    ...config,
                    background: event.target.value,
                  })
                }
                className="h-9 w-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                title="Pick background color"
              />
              <Input
                value={config.background}
                onChange={(event) =>
                  onChange({
                    ...config,
                    background: event.target.value,
                  })
                }
                placeholder="#202020"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.bold}
            onChange={(event) =>
              onChange({
                ...config,
                bold: event.target.checked,
              })
            }
          />
          bold
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.italic}
            onChange={(event) =>
              onChange({
                ...config,
                italic: event.target.checked,
              })
            }
          />
          italic
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.underline}
            onChange={(event) =>
              onChange({
                ...config,
                underline: event.target.checked,
              })
            }
          />
          underline
        </label>
      </div>
    </ActionEditorFrame>
  )
}
