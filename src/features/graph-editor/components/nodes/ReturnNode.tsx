import { AlertTriangle, CornerDownLeft, Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { memo, useCallback } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type {
  CallablePort,
  Port,
  PortDataType,
  ReturnNodeData,
} from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { useGraphEditorStore } from '../../store'
import { BaseNode } from './BaseNode'

const DATA_TYPES: PortDataType[] = [
  'any',
  'string',
  'number',
  'boolean',
  'buffer',
  'window',
  'table',
  'void',
]

interface ReturnNodeProps {
  id: string
  data: ReturnNodeData
  selected?: boolean
}

export const ReturnNode = memo(function ReturnNode({
  id,
  data,
  selected,
}: ReturnNodeProps) {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const graph = useGraphEditorStore((state) => state.graph)

  // Check if graph has a Callable Entry node
  const hasCallableEntry =
    graph?.nodes.some((n) => n.data.nodeType === 'callable-entry') ?? false

  // Convert CallablePorts to input ports for BaseNode
  const inputPorts: Port[] = [
    { id: 'exec', label: 'Execute', dataType: 'void', required: true },
    ...data.returnValues.map((p) => ({
      id: p.id,
      label: p.name,
      dataType: p.dataType,
      required: false,
    })),
  ]

  const addReturnValue = useCallback(() => {
    const newReturn: CallablePort = {
      id: nanoid(),
      name: `result${data.returnValues.length + 1}`,
      dataType: 'any',
    }
    updateNodeData<ReturnNodeData>(id, {
      returnValues: [...data.returnValues, newReturn],
    })
  }, [id, data.returnValues, updateNodeData])

  const removeReturnValue = useCallback(
    (returnId: string) => {
      updateNodeData<ReturnNodeData>(id, {
        returnValues: data.returnValues.filter((r) => r.id !== returnId),
      })
    },
    [id, data.returnValues, updateNodeData],
  )

  const updateReturnValue = useCallback(
    (returnId: string, updates: Partial<CallablePort>) => {
      updateNodeData<ReturnNodeData>(id, {
        returnValues: data.returnValues.map((r) =>
          r.id === returnId ? { ...r, ...updates } : r,
        ),
      })
    },
    [id, data.returnValues, updateNodeData],
  )

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, 'Return')}
      icon={<CornerDownLeft className="w-4 h-4" />}
      color={
        hasCallableEntry
          ? 'border-green-500' // Normal color
          : 'border-red-500' // Warning color
      }
      inputs={inputPorts}
      selected={selected}
      tutorialTarget="graph-node-tut-node-return"
    >
      <div className="space-y-2 min-w-[200px]">
        {/* Warning if no Callable Entry */}
        {!hasCallableEntry && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                <AlertTriangle className="w-3 h-3" />
                <span>No Callable Entry</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>This graph has no Callable Entry node.</p>
              <p>Return nodes only work in callable graphs.</p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="text-xs text-muted-foreground">Return Values:</div>

        {data.returnValues.map((ret) => (
          <div key={ret.id} className="flex items-center gap-1">
            <Input
              value={ret.name}
              onChange={(e) =>
                updateReturnValue(ret.id, { name: e.target.value })
              }
              className="h-7 text-xs flex-1"
              placeholder="name"
            />
            <Select
              value={ret.dataType}
              onValueChange={(value: PortDataType) =>
                updateReturnValue(ret.id, { dataType: value })
              }
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeReturnValue(ret.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={addReturnValue}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Return Value
        </Button>
      </div>
    </BaseNode>
  )
})
