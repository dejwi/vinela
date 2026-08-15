import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { Input } from '@/shared/components/ui/input'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog'
import { cn } from '@/shared/lib/utils'
import type { CatalogActionEntry } from '@/shared/types/catalog'
import { CommandParameterFields } from '../action-forms/CommandParameterFields'
import { ActionInfoTooltipCompact } from './ActionInfoTooltipCompact'

interface ActionPickerPreviewCompactProps {
  action: CatalogActionEntry
  paramValues: Readonly<Record<string, string>>
  onParamChange: (name: string, value: string) => void
  onEditAction?: (value: string) => void
  isCollapsed: boolean
  onCollapseChange: (collapsed: boolean) => void
}

export function ActionPickerPreviewCompact({
  action,
  paramValues,
  onParamChange,
  onEditAction,
  isCollapsed,
  onCollapseChange,
}: ActionPickerPreviewCompactProps): React.JSX.Element {
  const resolvedAction = useMemo(
    () => resolveActionTemplate(action.template, paramValues, action.params),
    [action.template, action.params, paramValues],
  )

  const [localValue, setLocalValue] = useState(resolvedAction)

  useEffect(() => {
    setLocalValue(resolvedAction)
  }, [resolvedAction])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    if (newValue !== resolvedAction && onEditAction) {
      onEditAction(newValue)
    }
  }

  const hasParams = action.params && action.params.length > 0

  return (
    <div
      className={cn(
        'border-t bg-muted/30 flex min-h-0 flex-col overflow-hidden',
        isCollapsed ? 'shrink-0' : 'flex-[1_1_0%]',
      )}
    >
      <Collapsible
        open={!isCollapsed}
        onOpenChange={(open) => onCollapseChange(!open)}
        className="h-full min-h-0 flex flex-col overflow-hidden"
      >
        {/* Header - Always visible */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ActionInfoTooltipCompact action={action} />
              <h4 className="font-medium text-sm truncate">{action.label}</h4>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isCollapsed ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <span className="sr-only">
              {isCollapsed ? 'Expand details' : 'Collapse details'}
            </span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="min-h-0 flex-1 overflow-y-auto">
          {/* Explanation Section - The "why" */}
          <div className="px-4 pt-1 pb-3">
            <p className="text-sm leading-relaxed text-foreground/90">
              {action.whatItDoes}
            </p>
          </div>

          {/* Configuration Section - The "what" */}
          <div className="px-4 py-3 bg-muted/20 border-t border-border/50">
            {/* Instructional hint */}
            {hasParams && (
              <p className="text-xs text-muted-foreground mb-3">
                Configure this action:
              </p>
            )}

            {/* Parameters */}
            {hasParams && (
              <CommandParameterFields
                entryKey={action.key}
                params={action.params}
                paramValues={paramValues}
                onParamChange={onParamChange}
                variant="compact"
              />
            )}

            {/* Action Preview - styled as "result" */}
            <Input
              value={localValue}
              onChange={handleChange}
              onFocus={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'font-mono text-sm h-10',
                'bg-zinc-900 dark:bg-zinc-950',
                'text-zinc-100',
                'border-0 rounded-md',
                'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0',
              )}
              placeholder="Action preview..."
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
