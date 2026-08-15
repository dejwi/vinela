import { Phone, Plus, Trash2 } from 'lucide-react'
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
import type {
  CallableEntryNodeData,
  CallablePort,
  Port,
  PortDataType,
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
]

interface CallableEntryNodeProps {
  id: string
  data: CallableEntryNodeData
  selected?: boolean
}

export const CallableEntryNode = memo(function CallableEntryNode({
  id,
  data,
  selected,
}: CallableEntryNodeProps) {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)

  // Convert CallablePorts to display ports for BaseNode
  const outputPorts: Port[] = [
    { id: 'exec', label: 'Execute', dataType: 'void', required: false },
    ...data.parameters.map((p) => ({
      id: p.id,
      label: p.name,
      dataType: p.dataType,
      required: false,
    })),
  ]

  const addParameter = useCallback(() => {
    const newParam: CallablePort = {
      id: nanoid(),
      name: `param${data.parameters.length + 1}`,
      dataType: 'any',
    }
    updateNodeData<CallableEntryNodeData>(id, {
      parameters: [...data.parameters, newParam],
    })
  }, [id, data.parameters, updateNodeData])

  const removeParameter = useCallback(
    (paramId: string) => {
      updateNodeData<CallableEntryNodeData>(id, {
        parameters: data.parameters.filter((p) => p.id !== paramId),
      })
    },
    [id, data.parameters, updateNodeData],
  )

  const updateParameter = useCallback(
    (paramId: string, updates: Partial<CallablePort>) => {
      updateNodeData<CallableEntryNodeData>(id, {
        parameters: data.parameters.map((p) =>
          p.id === paramId ? { ...p, ...updates } : p,
        ),
      })
    },
    [id, data.parameters, updateNodeData],
  )

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, 'Callable Entry')}
      icon={<Phone className="w-4 h-4" />}
      color="border-green-500"
      outputs={outputPorts}
      selected={selected}
      tutorialTarget="graph-node-tut-node-callable-entry"
    >
      <div className="space-y-2 min-w-[200px]">
        <div className="text-xs text-muted-foreground">Parameters:</div>

        {data.parameters.map((param) => (
          <div key={param.id} className="flex items-center gap-1">
            <Input
              value={param.name}
              onChange={(e) =>
                updateParameter(param.id, { name: e.target.value })
              }
              className="h-7 text-xs flex-1"
              placeholder="name"
            />
            <Select
              value={param.dataType}
              onValueChange={(value: PortDataType) =>
                updateParameter(param.id, { dataType: value })
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
              onClick={() => removeParameter(param.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={addParameter}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Parameter
        </Button>
      </div>
    </BaseNode>
  )
})
