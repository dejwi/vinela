import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog-entries'
import { ParameterInput } from './ParameterInput'
import type { ActionPickerPreviewProps } from './types'

export function ActionPickerPreview({
  action,
  paramValues,
  onParamChange,
  editable = false,
  onEdit,
}: ActionPickerPreviewProps): React.JSX.Element {
  const resolvedAction = useMemo(
    () =>
      resolveActionTemplate(action.template, paramValues, action.params ?? []),
    [action.template, action.params, paramValues],
  )

  // Local state for editable preview
  const [editValue, setEditValue] = useState(resolvedAction)

  // Update edit value when resolved action changes (but not while user is editing)
  useEffect(() => {
    setEditValue(resolvedAction)
  }, [resolvedAction])

  const handleEditChange = (value: string) => {
    setEditValue(value)
    onEdit?.(value)
  }

  return (
    <div className="border-t p-4 bg-muted/30 space-y-4">
      {/* Action Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{action.label}</h4>
          {/* Type badge shown here, not in grid */}
          <Badge variant={action.type === 'command' ? 'default' : 'secondary'}>
            {action.type === 'command' ? 'Command' : 'Key Sequence'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{action.whatItDoes}</p>
        {action.technicalNote && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Technical details
            </summary>
            <p className="mt-1 pl-2 border-l-2 text-muted-foreground">
              {action.technicalNote}
            </p>
          </details>
        )}
      </div>

      {/* Parameters */}
      {action.params && action.params.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Parameters
          </p>
          {action.params.map((param) => (
            <ParameterInput
              key={param.name}
              param={param}
              value={paramValues[param.name] ?? ''}
              onChange={(value) => onParamChange(param.name, value)}
              variant="default"
            />
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        {editable ? (
          <Input
            value={editValue}
            onChange={(e) => handleEditChange(e.target.value)}
            className="font-mono text-sm bg-background"
            placeholder="Action preview..."
          />
        ) : (
          <code className="block p-2 rounded bg-muted font-mono text-sm">
            {resolvedAction}
          </code>
        )}
      </div>

      {/* Help reference */}
      <p className="text-xs text-muted-foreground font-mono">
        {action.sourceDoc}
      </p>
    </div>
  )
}
