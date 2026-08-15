import type {
  Graph,
  InstalledPlugin,
  PluginSchema,
  ResolvedSchema,
  SchemaFunction,
} from '@/shared/types'

export type HealthState = 'healthy' | 'warning' | 'error'

export type PluginActionDependencyReason =
  | 'healthy'
  | 'plugin-disabled'
  | 'plugin-uninstalled'
  | 'schema-missing'
  | 'function-missing'

interface PluginActionDependencyBase {
  pluginId: string
  functionName: string
  pluginName: string
  status: HealthState
  reason: PluginActionDependencyReason
  message: string
  guidance: string
  schema?: PluginSchema
  installedPlugin?: InstalledPlugin
  schemaFunction?: SchemaFunction
}

export type PluginActionDependencyHealth = PluginActionDependencyBase

export interface GraphHealthIssue {
  severity: Exclude<HealthState, 'healthy'>
  reason: Exclude<PluginActionDependencyReason, 'healthy'>
  graphId: string
  nodeId: string
  pluginId: string
  functionName: string
  message: string
  guidance: string
  transitive: boolean
  path: string[]
}

export interface GraphHealthSummary {
  graphId: string
  status: HealthState
  directIssues: GraphHealthIssue[]
  transitiveIssues: GraphHealthIssue[]
  issues: GraphHealthIssue[]
}

interface GraphHealthInput {
  graph: Graph
  allGraphs: readonly Graph[]
  schemas: readonly ResolvedSchema[]
  installedPlugins: readonly InstalledPlugin[]
}

interface PluginActionDependencyInput {
  pluginId: string
  functionName: string
  schemas: readonly ResolvedSchema[]
  installedPlugins: readonly InstalledPlugin[]
}

function getPluginName(pluginId: string, schema?: PluginSchema): string {
  return schema?.pluginName ?? pluginId
}

function getSeverity(
  status: HealthState,
): Exclude<HealthState, 'healthy'> | null {
  if (status === 'warning') {
    return 'warning'
  }
  if (status === 'error') {
    return 'error'
  }
  return null
}

function toScore(status: HealthState): number {
  switch (status) {
    case 'healthy':
      return 0
    case 'warning':
      return 1
    case 'error':
      return 2
  }
}

function maxState(states: readonly HealthState[]): HealthState {
  let max = 0
  for (const state of states) {
    max = Math.max(max, toScore(state))
  }

  if (max === 2) {
    return 'error'
  }
  if (max === 1) {
    return 'warning'
  }
  return 'healthy'
}

export function resolvePluginActionDependency({
  pluginId,
  functionName,
  schemas,
  installedPlugins,
}: PluginActionDependencyInput): PluginActionDependencyHealth {
  const installedPlugin = installedPlugins.find(
    (entry) => entry.schemaId === pluginId,
  )
  const resolvedSchema = schemas.find((entry) => entry.schema.id === pluginId)
  const schema = resolvedSchema?.schema
  const schemaFunction = schema?.functions.find(
    (entry) => entry.name === functionName,
  )
  const pluginName = getPluginName(pluginId, schema)

  if (!installedPlugin) {
    return {
      pluginId,
      functionName,
      pluginName,
      status: 'error',
      reason: 'plugin-uninstalled',
      message: `${pluginName} is not installed.`,
      guidance: 'Install the plugin again to restore this node.',
      ...(schema ? { schema } : {}),
    }
  }

  if (!schema) {
    return {
      pluginId,
      functionName,
      pluginName,
      status: 'error',
      reason: 'schema-missing',
      message: `Schema for ${pluginName} is missing.`,
      guidance:
        'Restore this schema (built-in/global/project) to recover node details.',
      installedPlugin,
    }
  }

  if (!schemaFunction) {
    return {
      pluginId,
      functionName,
      pluginName,
      status: 'error',
      reason: 'function-missing',
      message: `Function "${functionName}" no longer exists in ${pluginName}.`,
      guidance:
        'Restore the schema version that defines this function or pick another function.',
      schema,
      installedPlugin,
    }
  }

  if (!installedPlugin.enabled) {
    return {
      pluginId,
      functionName,
      pluginName,
      status: 'warning',
      reason: 'plugin-disabled',
      message: `${pluginName} is currently disabled.`,
      guidance: 'Enable the plugin to reactivate this node.',
      schema,
      installedPlugin,
      schemaFunction,
    }
  }

  return {
    pluginId,
    functionName,
    pluginName,
    status: 'healthy',
    reason: 'healthy',
    message: 'Plugin dependency is healthy.',
    guidance: 'No action required.',
    schema,
    installedPlugin,
    schemaFunction,
  }
}

function collectGraphIssues(
  rootGraphId: string,
  graphId: string,
  path: readonly string[],
  graphsById: ReadonlyMap<string, Graph>,
  schemas: readonly ResolvedSchema[],
  installedPlugins: readonly InstalledPlugin[],
  activePath: ReadonlySet<string>,
): GraphHealthIssue[] {
  const graph = graphsById.get(graphId)
  if (!graph) {
    return []
  }

  const nextActivePath = new Set(activePath)
  nextActivePath.add(graphId)
  const issues: GraphHealthIssue[] = []

  for (const node of graph.nodes) {
    if (node.data.nodeType === 'run-function') {
      const source = node.data.functionSource
      if (source.type === 'plugin') {
        const dependency = resolvePluginActionDependency({
          pluginId: source.pluginId,
          functionName: source.functionName,
          schemas,
          installedPlugins,
        })

        const severity = getSeverity(dependency.status)
        if (severity && dependency.reason !== 'healthy') {
          issues.push({
            severity,
            reason: dependency.reason,
            graphId,
            nodeId: node.id,
            pluginId: source.pluginId,
            functionName: source.functionName,
            message: dependency.message,
            guidance: dependency.guidance,
            transitive: graphId !== rootGraphId,
            path: [...path],
          })
        }
      }
      continue
    }

    if (node.data.nodeType !== 'graph-ref') {
      continue
    }

    const targetGraphId = node.data.referencedGraphId
    if (targetGraphId.length === 0 || nextActivePath.has(targetGraphId)) {
      continue
    }

    const targetGraph = graphsById.get(targetGraphId)
    if (!targetGraph) {
      continue
    }

    issues.push(
      ...collectGraphIssues(
        rootGraphId,
        targetGraphId,
        [...path, targetGraphId],
        graphsById,
        schemas,
        installedPlugins,
        nextActivePath,
      ),
    )
  }

  return issues
}

export function evaluateGraphHealth({
  graph,
  allGraphs,
  schemas,
  installedPlugins,
}: GraphHealthInput): GraphHealthSummary {
  const graphsById = new Map(allGraphs.map((entry) => [entry.id, entry]))
  if (!graphsById.has(graph.id)) {
    graphsById.set(graph.id, graph)
  }

  const issues = collectGraphIssues(
    graph.id,
    graph.id,
    [graph.id],
    graphsById,
    schemas,
    installedPlugins,
    new Set<string>(),
  )

  const directIssues = issues.filter((issue) => !issue.transitive)
  const transitiveIssues = issues.filter((issue) => issue.transitive)
  const status = maxState(issues.map((issue) => issue.severity))

  return {
    graphId: graph.id,
    status,
    directIssues,
    transitiveIssues,
    issues,
  }
}

export function evaluateRunFunctionNodeHealth(
  pluginId: string,
  functionName: string,
  schemas: readonly ResolvedSchema[],
  installedPlugins: readonly InstalledPlugin[],
): PluginActionDependencyHealth {
  return resolvePluginActionDependency({
    pluginId,
    functionName,
    schemas,
    installedPlugins,
  })
}
