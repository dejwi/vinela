import { Zap } from 'lucide-react'
import { deriveLabelFromFunctionName } from '@/shared/data/function-catalog-builder'
import type {
  InstalledPlugin,
  PortDataType,
  ResolvedSchema,
  RunFunctionDefaultValue,
  RunFunctionNodeData,
  RunFunctionSignatureSnapshot,
  SchemaFunctionParam,
} from '@/shared/types'
import type {
  NodePaletteCategory,
  NodePaletteCategoryProvider,
} from '../components/NodePalette'

export interface PluginActionPaletteInput {
  schemas: readonly ResolvedSchema[]
  installedPlugins: readonly InstalledPlugin[]
}

function defaultValueForType(type: PortDataType): RunFunctionDefaultValue {
  switch (type) {
    case 'string':
      return { kind: 'scalar', value: '' }
    case 'number':
      return { kind: 'scalar', value: 0 }
    case 'boolean':
      return { kind: 'scalar', value: false }
    case 'buffer':
    case 'window':
    case 'table':
    case 'any':
      return { kind: 'lua', lua: '' }
    case 'void':
      return { kind: 'lua', lua: '' }
  }
}

function createDefaultParamDefaults(
  params: readonly SchemaFunctionParam[],
): Record<string, RunFunctionDefaultValue> {
  const result: Record<string, RunFunctionDefaultValue> = {}

  for (const param of params) {
    if (param.optional === true) {
      continue
    }
    result[param.name] = defaultValueForType(param.type)
  }

  return result
}

function buildSignatureSnapshot(
  schemaFunction: {
    name: string
    params: readonly SchemaFunctionParam[]
    returns?: PortDataType | undefined
    description?: string | undefined
    luaCall?: string | undefined
  },
  pluginId: string,
): RunFunctionSignatureSnapshot {
  const params = schemaFunction.params.map((p) => ({
    name: p.name,
    type: p.type,
    optional: p.optional,
    description: p.description,
  }))

  const returns: PortDataType = schemaFunction.returns ?? 'void'

  const fallbackParamNames = params.map((p) => `$params.${p.name}`).join(', ')
  const fallbackLuaCall = `require('${pluginId}').${schemaFunction.name}(${fallbackParamNames})`
  const luaCall = schemaFunction.luaCall?.trim().length
    ? schemaFunction.luaCall
    : fallbackLuaCall

  return { params, returns, luaCall }
}

function createRunFunctionNodeData(
  pluginId: string,
  functionName: string,
  schemaFunction: {
    name: string
    params: readonly SchemaFunctionParam[]
    returns?: PortDataType | undefined
    description?: string | undefined
    luaCall?: string | undefined
  },
): RunFunctionNodeData {
  const signature = buildSignatureSnapshot(schemaFunction, pluginId)
  const functionKey = `plugin:${pluginId}:${functionName}`

  return {
    nodeType: 'run-function',
    selectedFunctionKey: functionKey,
    functionSource: { type: 'plugin', pluginId, functionName },
    signature,
    paramDefaults: createDefaultParamDefaults(schemaFunction.params),
  }
}

export function createPluginActionPaletteCategories({
  schemas,
  installedPlugins,
}: PluginActionPaletteInput): NodePaletteCategory[] {
  const installedEnabledIds = new Set(
    installedPlugins
      .filter((entry) => entry.enabled)
      .map((entry) => entry.schemaId),
  )

  const categories: NodePaletteCategory[] = []

  for (const { schema } of schemas) {
    if (!installedEnabledIds.has(schema.id) || schema.functions.length === 0) {
      continue
    }

    categories.push({
      id: `plugin-functions-${schema.id}`,
      name: `Plugin: ${schema.pluginName}`,
      nodes: schema.functions
        .map((schemaFunction) => ({
          type: 'run-function' as const,
          label:
            schemaFunction.label ??
            deriveLabelFromFunctionName(schemaFunction.name),
          icon: Zap,
          createData: () =>
            createRunFunctionNodeData(
              schema.id,
              schemaFunction.name,
              schemaFunction,
            ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    })
  }

  return categories.sort((a, b) => a.name.localeCompare(b.name))
}

export function createPluginActionPaletteProvider(
  input: PluginActionPaletteInput,
): NodePaletteCategoryProvider {
  return () => createPluginActionPaletteCategories(input)
}
