import { Zap } from 'lucide-react'
import { memo } from 'react'
import type { Port, TriggerNodeData } from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { BaseNode } from './BaseNode'

// Define ports with proper types
const TRIGGER_OUTPUTS: Port[] = [
  { id: 'exec', label: 'Execute', dataType: 'void', required: false },
]

function getTriggerLabel(): string {
  return 'On Startup'
}

interface TriggerNodeProps {
  data: TriggerNodeData
  selected?: boolean
}

export const TriggerNode = memo(function TriggerNode({
  data,
  selected,
}: TriggerNodeProps) {
  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, getTriggerLabel())}
      icon={<Zap className="w-4 h-4" />}
      color="border-amber-500"
      outputs={TRIGGER_OUTPUTS}
      selected={selected}
    >
      <div className="text-xs text-muted-foreground">
        Runs when Neovim starts
      </div>
    </BaseNode>
  )
})
