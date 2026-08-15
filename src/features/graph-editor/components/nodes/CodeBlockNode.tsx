import { Code } from 'lucide-react'
import { memo } from 'react'
import { generateStructurePreview } from '@/features/graph-editor/lib/code-block-preview'
import type { CodeBlockNodeData, Port } from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { BaseNode } from './BaseNode'

const CODE_BLOCK_INPUTS: Port[] = [
  { id: 'exec', label: 'Execute', dataType: 'void', required: true },
]

const CODE_BLOCK_OUTPUTS: Port[] = [
  { id: 'done', label: 'Done', dataType: 'void', required: false },
]

interface CodeBlockNodeProps {
  id: string
  data: CodeBlockNodeData
  selected?: boolean
}

export const CodeBlockNode = memo(function CodeBlockNode({
  data,
  selected,
}: CodeBlockNodeProps) {
  const preview = generateStructurePreview(data)
  const inputPorts: Port[] = [
    ...CODE_BLOCK_INPUTS,
    ...data.inputs.map((port) => ({
      id: port.id,
      label: port.name,
      dataType: port.dataType,
      required: false,
    })),
  ]
  const outputPorts: Port[] = [
    ...CODE_BLOCK_OUTPUTS,
    ...data.outputs.map((port) => ({
      id: port.id,
      label: port.name,
      dataType: port.dataType,
      required: false,
    })),
  ]

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, 'Code Block')}
      icon={<Code className="w-4 h-4" />}
      color="border-purple-500"
      inputs={inputPorts}
      outputs={outputPorts}
      selected={selected}
    >
      <div className="min-w-[200px] rounded border border-border/60 bg-muted/20 p-2">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Code Structure Preview (read-only)
        </p>
        {data.code?.trim().length > 0 ? (
          <pre className="line-clamp-4 whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
            {preview}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">
            Empty code block. Use the properties panel to add Lua.
          </p>
        )}
      </div>
    </BaseNode>
  )
})
