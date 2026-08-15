import { useMemo } from 'react'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { ConditionNodeData, Graph, GraphNode } from '@/shared/types'
import {
  buildConditionExpression,
  CONDITION_OPERATORS,
  isConditionNode,
  isConditionOperator,
} from '@/shared/types'
import { useGraphEditorStore } from '../../store'
import {
  type NodePropertiesEditorProps,
  PropertiesNotice,
  PropertiesSection,
} from './shared'

interface ConditionPropertiesContentProps {
  node: GraphNode<ConditionNodeData>
}

function isPortConnected(
  graph: Graph | null,
  nodeId: string,
  portId: string,
): boolean {
  if (!graph) return false
  return graph.edges.some(
    (edge) => edge.target === nodeId && edge.targetPort === portId,
  )
}

function ConditionPropertiesContent({
  node,
}: ConditionPropertiesContentProps): React.JSX.Element {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const graph = useGraphEditorStore((state) => state.graph)

  const isAConnected = useMemo(
    () => isPortConnected(graph, node.id, 'a'),
    [graph, node.id],
  )
  const isBConnected = useMemo(
    () => isPortConnected(graph, node.id, 'b'),
    [graph, node.id],
  )

  const expression = buildConditionExpression(
    node.data.hardcodedA,
    node.data.operator,
    node.data.hardcodedB,
  )

  const handleUpdateA = (value: string): void => {
    updateNodeData<ConditionNodeData>(node.id, {
      hardcodedA: value,
    })
  }

  const handleUpdateB = (value: string): void => {
    updateNodeData<ConditionNodeData>(node.id, {
      hardcodedB: value,
    })
  }

  const handleUpdateOperator = (value: string): void => {
    const newOperator = isConditionOperator(value) ? value : '=='
    updateNodeData<ConditionNodeData>(node.id, {
      operator: newOperator,
    })
  }

  const hasUnsetInput =
    (!isAConnected && node.data.hardcodedA.trim().length === 0) ||
    (!isBConnected && node.data.hardcodedB.trim().length === 0)

  return (
    <div className="space-y-4">
      <PropertiesSection
        title="Comparison"
        description="Compare two values. Each input can come from a connection or a hardcoded value."
      >
        {/* Input A */}
        <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Input A</p>
            {isAConnected ? (
              <span className="text-[10px] text-muted-foreground">
                Connected
              </span>
            ) : (
              <span className="text-[10px] text-amber-500">No connection</span>
            )}
          </div>

          {!isAConnected && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">
                Hardcoded value
              </p>
              <Input
                value={node.data.hardcodedA}
                onChange={(event) => handleUpdateA(event.target.value)}
                placeholder="e.g., vim.bo.filetype"
                className="text-xs"
              />
            </div>
          )}

          {isAConnected && node.data.hardcodedA.trim().length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Fallback value:{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                {node.data.hardcodedA.trim()}
              </code>
            </p>
          )}
        </div>

        {/* Operator */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Operator</p>
          <Select
            value={node.data.operator}
            onValueChange={handleUpdateOperator}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {candidate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Input B */}
        <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Input B</p>
            {isBConnected ? (
              <span className="text-[10px] text-muted-foreground">
                Connected
              </span>
            ) : (
              <span className="text-[10px] text-amber-500">No connection</span>
            )}
          </div>

          {!isBConnected && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">
                Hardcoded value
              </p>
              <Input
                value={node.data.hardcodedB}
                onChange={(event) => handleUpdateB(event.target.value)}
                placeholder="e.g., 'lua'"
                className="text-xs"
              />
            </div>
          )}

          {isBConnected && node.data.hardcodedB.trim().length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Fallback value:{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                {node.data.hardcodedB.trim()}
              </code>
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Preview</p>
          <code className="block rounded bg-muted px-2 py-1.5 text-xs">
            {expression.length > 0 ? expression : '<configure both inputs>'}
          </code>
        </div>
      </PropertiesSection>

      <PropertiesSection
        title="Examples"
        description="Common condition patterns for quick starts."
      >
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Filetype check:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              vim.bo.filetype == 'lua'
            </code>
          </p>
          <p>
            <span className="font-medium text-foreground">
              Modified buffer:
            </span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              vim.bo.modified == true
            </code>
          </p>
          <p>
            <span className="font-medium text-foreground">Window count:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">
              #vim.api.nvim_tabpage_list_wins(0) &gt; 1
            </code>
          </p>
        </div>
      </PropertiesSection>

      {hasUnsetInput ? (
        <PropertiesNotice
          title="Missing input value"
          description="One or more inputs have no connection and no hardcoded value. The condition may not evaluate correctly."
        />
      ) : null}
    </div>
  )
}

export function ConditionPropertiesEditor({
  node,
}: NodePropertiesEditorProps): React.JSX.Element {
  if (!isConditionNode(node)) {
    return (
      <PropertiesNotice
        title="Unexpected node type"
        description="Condition editor can only be used with condition nodes."
      />
    )
  }

  return <ConditionPropertiesContent node={node} />
}
