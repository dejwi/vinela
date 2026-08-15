import { useNodeConnections } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { memo } from 'react'
import type { ConditionNodeData, Port } from '@/shared/types'
import {
  buildConditionExpression,
  resolveNodeDisplayName,
} from '@/shared/types'
import { BaseNode } from './BaseNode'

const CONDITION_INPUTS: Port[] = [
  { id: 'a', label: 'A', dataType: 'any', required: true },
  { id: 'b', label: 'B', dataType: 'any', required: true },
]

const CONDITION_OUTPUTS: Port[] = [
  { id: 'true', label: 'True Branch', dataType: 'void', required: false },
  { id: 'false', label: 'False Branch', dataType: 'void', required: false },
]

interface ConditionNodeProps {
  data: ConditionNodeData
  id: string
  selected?: boolean
}

export const ConditionNode = memo(function ConditionNode({
  data,
  id,
  selected,
}: ConditionNodeProps) {
  // Get connections for this node
  const connections = useNodeConnections({ id })

  // Check if ports 'a' and 'b' are connected
  const isAConnected = connections.some(
    (conn) => conn.target === id && conn.targetHandle === 'a',
  )
  const isBConnected = connections.some(
    (conn) => conn.target === id && conn.targetHandle === 'b',
  )

  // Build preview expression based on connection state
  const getPreview = (): string => {
    const aValue = isAConnected ? 'A' : data.hardcodedA.trim()
    const bValue = isBConnected ? 'B' : data.hardcodedB.trim()

    // If neither side has a value, show placeholder
    if (aValue.length === 0 && bValue.length === 0) {
      return ''
    }

    // Build expression using connected placeholders or hardcoded values
    return buildConditionExpression(aValue, data.operator, bValue)
  }

  const preview = getPreview()

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, 'Condition')}
      icon={<GitBranch className="w-4 h-4" />}
      color="border-yellow-500"
      inputs={CONDITION_INPUTS}
      outputs={CONDITION_OUTPUTS}
      selected={selected}
    >
      <div className="text-xs text-muted-foreground min-w-[180px] space-y-2">
        <div className="flex items-center justify-center gap-2 font-medium">
          <span
            className={`text-xs ${isAConnected ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {isAConnected ? 'A' : data.hardcodedA.trim() || 'A'}
          </span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {data.operator}
          </code>
          <span
            className={`text-xs ${isBConnected ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {isBConnected ? 'B' : data.hardcodedB.trim() || 'B'}
          </span>
        </div>
        {preview.length > 0 ? (
          <code className="block rounded bg-muted px-2 py-1 text-xs truncate">
            {preview}
          </code>
        ) : null}
      </div>
    </BaseNode>
  )
})
