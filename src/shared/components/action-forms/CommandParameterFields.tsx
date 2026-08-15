import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import type { CatalogCommandParam } from '@/shared/types/catalog'
import { ParameterInput } from '../action-picker/ParameterInput'

export interface CommandParameterFieldsProps {
  readonly entryKey: string
  readonly params: readonly CatalogCommandParam[]
  readonly paramValues: Readonly<Record<string, string>>
  readonly onParamChange: (name: string, value: string) => void
  readonly variant: 'default' | 'compact'
}

export function CommandParameterFields(
  props: CommandParameterFieldsProps,
): React.JSX.Element | null {
  const [advancedEntryKey, setAdvancedEntryKey] = useState<string | null>(null)
  const advanced = advancedEntryKey === props.entryKey
  if (props.params.length === 0) return null
  const hasAdvanced = props.params.some((param) => param.tier === 'advanced')
  const groups = new Map<string, CatalogCommandParam[]>()
  for (const param of props.params) {
    const group = param.group ?? 'General'
    const fields = groups.get(group) ?? []
    fields.push(param)
    groups.set(group, fields)
  }

  return (
    <div className="space-y-3">
      {hasAdvanced && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAdvancedEntryKey(advanced ? null : props.entryKey)}
          onKeyDown={(event) => {
            if (props.variant === 'compact' && event.key === 'Enter')
              event.stopPropagation()
          }}
        >
          {advanced ? 'Hide advanced parameters' : 'Show advanced parameters'}
        </Button>
      )}
      {[...groups].map(([group, fields]) => {
        const visible = fields.filter(
          (param) =>
            param.tier !== 'advanced' ||
            advanced ||
            (props.paramValues[param.name] ?? param.default ?? '') !== '',
        )
        if (visible.length === 0) return null
        return (
          <div key={group} className="space-y-3">
            <h4 className="text-sm font-medium">{group}</h4>
            {visible.map((param) => (
              <ParameterInput
                key={param.name}
                param={param}
                value={props.paramValues[param.name] ?? param.default ?? ''}
                onChange={(value) => props.onParamChange(param.name, value)}
                variant={props.variant}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
