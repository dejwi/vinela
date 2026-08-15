import { useNodeConnections } from '@xyflow/react'
import { Code2 } from 'lucide-react'
import { memo } from 'react'
import type { FunctionParamInfo } from '@/shared/components/function-param-defaults'
import { effectiveTier } from '@/shared/components/function-param-defaults'
import type {
  Port,
  RunFunctionNodeData,
  RunFunctionParamSignature,
} from '@/shared/types'
import { resolveNodeDisplayName } from '@/shared/types'
import { BaseNode } from './BaseNode'

const EXEC_INPUT: Port = {
  id: 'exec',
  label: 'Execute',
  dataType: 'void',
  required: true,
}

const DONE_OUTPUT: Port = {
  id: 'done',
  label: 'Then',
  dataType: 'void',
  required: false,
}

interface RunFunctionNodeProps {
  id: string
  data: RunFunctionNodeData
  selected?: boolean
}

function getRunFunctionInputs(
  data: RunFunctionNodeData,
  connectedParams: ReadonlySet<string>,
): Port[] {
  const inputs: Port[] = [EXEC_INPUT]

  if (data.signature !== null) {
    for (const param of data.signature.params) {
      const visibleTier = effectiveTier(
        toFunctionParamInfo(param),
        data.paramDefaults[param.name],
        connectedParams.has(param.name),
      )
      if (visibleTier === 'advanced') {
        continue
      }
      inputs.push({
        id: `param:${param.name}`,
        label: param.name,
        dataType: param.type,
        required: !(param.optional ?? false),
      })
    }
  }

  return inputs
}

function toFunctionParamInfo(
  param: RunFunctionParamSignature,
): FunctionParamInfo {
  return {
    name: param.name,
    type: param.type,
    optional: param.optional ?? false,
    description: param.description,
    tier: param.tier,
    group: param.group,
    allowedValues: param.allowedValues,
    allowedValueDescriptions: param.allowedValueDescriptions,
    multi: param.multi,
    objectShape: param.objectShape?.map((entry: RunFunctionParamSignature) =>
      toFunctionParamInfo(entry),
    ),
  }
}

function getRunFunctionOutputs(data: RunFunctionNodeData): Port[] {
  const outputs: Port[] = [DONE_OUTPUT]

  if (data.signature !== null && data.signature.returns !== 'void') {
    outputs.push({
      id: 'result',
      label: 'Result',
      dataType: data.signature.returns,
      required: false,
    })
  }

  return outputs
}

function getFunctionSummary(data: RunFunctionNodeData): string {
  if (data.functionSource.type === 'core') {
    return data.functionSource.functionName || 'No function selected'
  }
  const { pluginId, functionName } = data.functionSource
  if (!pluginId && !functionName) return 'No function selected'
  if (!functionName) return `Plugin: ${pluginId}`
  return `${pluginId}: ${functionName}`
}

export const RunFunctionNode = memo(function RunFunctionNode({
  id,
  data,
  selected,
}: RunFunctionNodeProps) {
  const connections = useNodeConnections({ id })
  const connectedParams = new Set<string>()
  for (const connection of connections) {
    if (connection.target !== id || connection.targetHandle === null) continue
    if (!connection.targetHandle.startsWith('param:')) continue
    connectedParams.add(connection.targetHandle.slice('param:'.length))
  }

  const inputs = getRunFunctionInputs(data, connectedParams)
  const outputs = getRunFunctionOutputs(data)
  const summary = getFunctionSummary(data)

  return (
    <BaseNode
      label={resolveNodeDisplayName(data.displayName, 'Run Function')}
      icon={<Code2 className="w-4 h-4" />}
      color="border-purple-500"
      inputs={inputs}
      outputs={outputs}
      selected={selected}
    >
      <p className="max-w-[220px] truncate text-xs text-muted-foreground">
        {summary}
      </p>
    </BaseNode>
  )
})
