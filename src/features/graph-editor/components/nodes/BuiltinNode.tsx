import { AlertTriangle, Blocks } from 'lucide-react'
import { memo } from 'react'
import type { BuiltinNodeData, Port } from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { getBuiltinActionDefinition } from '../../data/builtin-actions'
import { BaseNode } from './BaseNode'

const FALLBACK_INPUTS: Port[] = [
  { id: 'exec', label: 'Execute', dataType: 'void', required: true },
]

const FALLBACK_OUTPUTS: Port[] = [
  { id: 'done', label: 'Done', dataType: 'void' },
]

interface BuiltinNodeProps {
  data: BuiltinNodeData
  selected?: boolean
}

export const BuiltinNode = memo(function BuiltinNode({
  data,
  selected,
}: BuiltinNodeProps) {
  const builtinDefinition = getBuiltinActionDefinition(data.builtinId)
  const isMissingDefinition = builtinDefinition === null
  const Icon = builtinDefinition?.icon ?? Blocks

  return (
    <BaseNode
      label={resolveNodeDisplayName(
        data.displayName,
        builtinDefinition?.label ?? 'Missing Builtin',
      )}
      icon={<Icon className="w-4 h-4" />}
      color={isMissingDefinition ? 'border-red-500' : 'border-cyan-500'}
      inputs={builtinDefinition?.inputs ?? FALLBACK_INPUTS}
      outputs={builtinDefinition?.outputs ?? FALLBACK_OUTPUTS}
      selected={selected}
    >
      <div className="space-y-1 text-xs text-muted-foreground min-w-[180px]">
        {isMissingDefinition ? (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive">
            <div className="flex items-center gap-1 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Unknown builtin action
            </div>
            <p className="mt-1">
              Restore this builtin registry entry to recover this node.
            </p>
          </div>
        ) : (
          <>
            <p className="truncate">{builtinDefinition.category}</p>
            <p className="line-clamp-2 text-[11px]">
              {builtinDefinition.getPreview(data.config)}
            </p>
          </>
        )}
      </div>
    </BaseNode>
  )
})
