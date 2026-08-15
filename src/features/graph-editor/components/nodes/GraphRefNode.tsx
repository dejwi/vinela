import { AlertCircle, GitFork } from 'lucide-react'
import { memo, useEffect, useMemo } from 'react'
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
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type {
  Graph,
  GraphRefNodeData,
  Port,
  PortDataType,
} from '@/shared/types'
import { extractCallableContract, resolveNodeDisplayName } from '@/shared/types'
import { useGraphEditorStore } from '../../store'
import { getDisableReason } from '../../utils/graph-disable-state'
import { useGraphManagerContext } from '../GraphManagerContext'
import { BaseNode } from './BaseNode'

interface GraphRefNodeProps {
  id: string
  data: GraphRefNodeData
  selected?: boolean
}

interface ContractPortSnapshot {
  id: string
  name: string
  dataType: PortDataType
}

interface ContractSnapshot {
  parameters: ContractPortSnapshot[]
  returnValues: ContractPortSnapshot[]
}

interface GraphRefWarningsProps {
  referencedGraphId: string | undefined
  referencedGraph: Graph | undefined
  fallbackContract: ContractSnapshot | undefined
  contract: {
    parameters: ContractPortSnapshot[]
    returnValues: ContractPortSnapshot[]
  } | null
  isTargetDisabled: boolean
  isTargetMissing: boolean
  disableReason: string | undefined
}

function GraphRefWarnings({
  referencedGraphId,
  referencedGraph,
  fallbackContract,
  contract,
  isTargetDisabled,
  isTargetMissing,
  disableReason,
}: GraphRefWarningsProps): React.ReactElement | null {
  if (referencedGraphId && !referencedGraph && fallbackContract) {
    return (
      <div className="mt-2 text-xs text-amber-500">
        Using cached callable contract.
      </div>
    )
  }

  if (isTargetMissing) {
    return (
      <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
        <AlertCircle className="w-3 h-3" />
        <span>Target graph missing</span>
      </div>
    )
  }

  if (referencedGraphId && referencedGraph && !contract) {
    return (
      <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
        <AlertCircle className="w-3 h-3" />
        <span>Graph not callable</span>
      </div>
    )
  }

  if (isTargetDisabled && disableReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-500">
              <AlertCircle className="w-3 h-3" />
              <span>Target graph disabled</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{disableReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return null
}

function toContractSnapshot(contract: {
  parameters: ContractPortSnapshot[]
  returnValues: ContractPortSnapshot[]
}): ContractSnapshot {
  return {
    parameters: contract.parameters.map((parameter) => ({
      id: parameter.id,
      name: parameter.name,
      dataType: parameter.dataType,
    })),
    returnValues: contract.returnValues.map((returnValue) => ({
      id: returnValue.id,
      name: returnValue.name,
      dataType: returnValue.dataType,
    })),
  }
}

function areContractsEqual(
  left: ContractSnapshot | undefined,
  right: ContractSnapshot | undefined,
): boolean {
  if (!left && !right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  if (
    left.parameters.length !== right.parameters.length ||
    left.returnValues.length !== right.returnValues.length
  ) {
    return false
  }

  const matchParameters = left.parameters.every((parameter, index) => {
    const other = right.parameters[index]
    return (
      other &&
      other.id === parameter.id &&
      other.name === parameter.name &&
      other.dataType === parameter.dataType
    )
  })

  if (!matchParameters) {
    return false
  }

  return left.returnValues.every((returnValue, index) => {
    const other = right.returnValues[index]
    return (
      other &&
      other.id === returnValue.id &&
      other.name === returnValue.name &&
      other.dataType === returnValue.dataType
    )
  })
}

export const GraphRefNode = memo(function GraphRefNode({
  id,
  data,
  selected,
}: GraphRefNodeProps) {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)
  const currentGraph = useGraphEditorStore((state) => state.graph)
  const { graphs, disableStates } = useGraphManagerContext()

  // Filter to only callable graphs (excluding current graph)
  const callableGraphs = useMemo(() => {
    return graphs.filter((g: Graph) => {
      if (g.id === currentGraph?.id) return false // Can't reference self
      return g.nodes.some((n) => n.data.nodeType === 'callable-entry')
    })
  }, [graphs, currentGraph?.id])

  // Get the referenced graph's contract
  const referencedGraph = graphs.find(
    (g: Graph) => g.id === data.referencedGraphId,
  )
  const liveContract = referencedGraph
    ? extractCallableContract(referencedGraph)
    : null
  const fallbackContract = data.cachedContract
  const contract =
    liveContract ?? (referencedGraph ? null : (fallbackContract ?? null))

  // Check if target graph is effectively disabled
  const targetDisableState = data.referencedGraphId
    ? disableStates.statesByGraphId.get(data.referencedGraphId)
    : undefined
  const isTargetMissing = Boolean(data.referencedGraphId) && !referencedGraph
  const isTargetDisabled =
    targetDisableState !== undefined &&
    targetDisableState.effective.kind !== 'enabled'
  const disableReason = getDisableReason(targetDisableState)

  useEffect(() => {
    if (!referencedGraph) {
      return
    }

    if (!liveContract) {
      if (!data.cachedContract) {
        return
      }

      updateNodeData<GraphRefNodeData>(id, {
        cachedContract: undefined,
      })
      return
    }

    const liveSnapshot = toContractSnapshot(liveContract)
    if (areContractsEqual(data.cachedContract, liveSnapshot)) {
      return
    }

    updateNodeData<GraphRefNodeData>(id, {
      cachedContract: liveSnapshot,
    })
  }, [data.cachedContract, id, liveContract, referencedGraph, updateNodeData])

  // Build ports from contract
  const inputPorts: Port[] = [
    { id: 'exec', label: 'Execute', dataType: 'void', required: true },
    ...(contract?.parameters.map((p) => ({
      id: p.id,
      label: p.name,
      dataType: p.dataType,
      required: false,
    })) ?? []),
  ]

  const outputPorts: Port[] = [
    { id: 'done', label: 'Done', dataType: 'void', required: false },
    ...(contract?.returnValues.map((p) => ({
      id: p.id,
      label: p.name,
      dataType: p.dataType,
      required: false,
    })) ?? []),
  ]

  const handleGraphChange = (graphId: string) => {
    const targetGraph = graphs.find((g: Graph) => g.id === graphId)
    const targetContract = targetGraph
      ? extractCallableContract(targetGraph)
      : null

    updateNodeData<GraphRefNodeData>(id, {
      referencedGraphId: graphId,
      cachedContract: targetContract
        ? {
            parameters: targetContract.parameters,
            returnValues: targetContract.returnValues,
          }
        : undefined,
    })
  }

  const isValid = data.referencedGraphId && contract

  return (
    <BaseNode
      label={resolveNodeDisplayName(
        data.displayName,
        referencedGraph?.name ?? 'Graph Reference',
      )}
      icon={<GitFork className="w-4 h-4" />}
      color={
        isTargetMissing
          ? 'border-red-500'
          : isTargetDisabled
            ? 'border-amber-500'
            : isValid
              ? 'border-indigo-500'
              : 'border-red-500'
      }
      inputs={inputPorts}
      outputs={outputPorts}
      selected={selected}
      tutorialTarget="graph-node-tut-node-graph-ref-telescope"
    >
      <div className="min-w-[180px]">
        <Select
          value={data.referencedGraphId}
          onValueChange={handleGraphChange}
        >
          <SelectTrigger className="min-h-8 text-xs">
            <SelectValue placeholder="Select graph..." />
          </SelectTrigger>
          <SelectContent>
            {callableGraphs.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                No callable graphs available.
                <br />
                Add a Callable Entry node to a graph first.
              </div>
            ) : (
              callableGraphs.map((graph: Graph) => (
                <SelectItem key={graph.id} value={graph.id} className="text-xs">
                  {graph.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <GraphRefWarnings
          referencedGraphId={data.referencedGraphId}
          referencedGraph={referencedGraph}
          fallbackContract={fallbackContract}
          contract={contract}
          isTargetDisabled={isTargetDisabled}
          isTargetMissing={isTargetMissing}
          disableReason={disableReason}
        />
      </div>
    </BaseNode>
  )
})
