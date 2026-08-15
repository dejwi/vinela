import { Repeat } from 'lucide-react'
import { memo } from 'react'
import type { LoopNodeData, Port } from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { BaseNode } from './BaseNode'

const LOOP_INPUTS: Port[] = [
  { id: 'exec', label: 'Execute', dataType: 'void', required: true },
]

const LOOP_OUTPUTS: Port[] = [
  { id: 'loop', label: 'Loop Body', dataType: 'void' },
  { id: 'done', label: 'Completed', dataType: 'void' },
]

const LOOP_ITERATION_DATA_OUTPUTS: Port[] = [
  { id: 'item', label: 'Item (optional)', dataType: 'any' },
  { id: 'index', label: 'Index (optional)', dataType: 'number' },
]

interface LoopNodeProps {
  data: LoopNodeData
  selected?: boolean
}

function getLoopLabel(loopType: LoopNodeData['loopType']): string {
  switch (loopType) {
    case 'for':
      return 'For Loop'
    case 'while':
      return 'While Loop'
    case 'each':
      return 'Each Loop'
  }
}

function getLoopPreview(data: LoopNodeData): string {
  const iterator = data.iteratorVariable.trim() || 'item'
  const expression = data.iterableExpression.trim()

  switch (data.loopType) {
    case 'while':
      return expression.length > 0
        ? `Repeat while ${expression}`
        : 'Repeat while <condition>'
    case 'each':
      return expression.length > 0
        ? `For each ${iterator} in ${expression}`
        : `For each ${iterator} in <iterable>`
    case 'for':
      return expression.length > 0
        ? `Iterate ${iterator} over ${expression}`
        : `Iterate ${iterator} over <range or iterable>`
  }
}

function getLoopOutputs(loopType: LoopNodeData['loopType']): Port[] {
  if (loopType === 'each' || loopType === 'for') {
    return [...LOOP_OUTPUTS, ...LOOP_ITERATION_DATA_OUTPUTS]
  }

  return LOOP_OUTPUTS
}

export const LoopNode = memo(function LoopNode({
  data,
  selected,
}: LoopNodeProps) {
  return (
    <BaseNode
      label={resolveNodeDisplayName(
        data.displayName,
        getLoopLabel(data.loopType),
      )}
      icon={<Repeat className="w-4 h-4" />}
      color="border-violet-500"
      inputs={LOOP_INPUTS}
      outputs={getLoopOutputs(data.loopType)}
      selected={selected}
    >
      <div className="min-w-[180px] space-y-1 text-xs text-muted-foreground">
        <code className="rounded bg-muted px-1 py-0.5">
          {getLoopPreview(data)}
        </code>
        <div className="flex items-center justify-between text-[11px]">
          <span>Loop Body: runs each iteration</span>
          <span>Completed: runs after exit</span>
        </div>
      </div>
    </BaseNode>
  )
})
