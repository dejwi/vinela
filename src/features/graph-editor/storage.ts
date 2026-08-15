import { v4 as uuidv4 } from 'uuid'
import { getGraphFilePath, PROJECT_PATHS } from '@/shared/lib/paths'
import {
  ensureProjectDir,
  listProjectDir,
  readProjectFile,
  removeProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type {
  Graph,
  GraphMetadataPatch,
  GraphOrderUpdate,
  KeymapMode,
} from '@/shared/types'
import {
  isKeymapMode,
  isPortDataType,
  isSetVariableValueCompatible,
  isSetVariableValueType,
  isVariableScope,
} from '@/shared/types'

// ============================================
// Result Types
// ============================================

export type GraphOrderBatchResult =
  | { success: true; updatedGraphIds: string[] }
  | {
      success: false
      failedGraphId: string
      failedOrder: number
      error: string
      appliedGraphIds: string[]
    }

import { assignContiguousOrder, getNextOrderValue } from './utils/graph-order'

// ============================================
// Validation Helpers
// ============================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidViewport(
  value: unknown,
): value is { x: number; y: number; zoom: number } {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value['x']) &&
    isFiniteNumber(value['y']) &&
    isFiniteNumber(value['zoom'])
  )
}

function isCallablePort(value: unknown): boolean {
  if (!isRecord(value)) return false

  const dataType = value['dataType']
  if (typeof dataType !== 'string' || !isPortDataType(dataType)) {
    return false
  }

  const description = value['description']
  if (description !== undefined && typeof description !== 'string') {
    return false
  }

  return typeof value['id'] === 'string' && typeof value['name'] === 'string'
}

function isValidTriggerNodeData(data: Record<string, unknown>): boolean {
  // trigger: require triggerType === 'startup'
  return data['triggerType'] === 'startup'
}

// ============================================
// Action Config Validators
// ============================================

function isActionScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isValidSetOptionValueConfig(config: Record<string, unknown>): boolean {
  const valueMode = config['valueMode']
  if (valueMode === 'suggested') {
    return isActionScalar(config['suggestedValue'])
  }
  if (valueMode === 'raw') {
    return typeof config['rawValue'] === 'string'
  }
  return false
}

function isValidSetOptionConfig(config: Record<string, unknown>): boolean {
  if (typeof config['optionName'] !== 'string') return false
  if (config['scope'] !== 'global' && config['scope'] !== 'local') return false
  const valueConfig = config['valueConfig']
  if (!isRecord(valueConfig)) return false
  return isValidSetOptionValueConfig(valueConfig)
}

function isValidSetKeymapConfig(config: Record<string, unknown>): boolean {
  const modes = config['modes']
  if (!Array.isArray(modes)) return false
  if (modes.length === 0) return false

  // Validate every mode is canonical
  if (
    !modes.every(
      (mode): mode is KeymapMode =>
        typeof mode === 'string' && isKeymapMode(mode),
    )
  ) {
    return false
  }

  // Reject duplicates
  if (new Set(modes).size !== modes.length) {
    return false
  }

  return (
    typeof config['keySequence'] === 'string' &&
    typeof config['command'] === 'string' &&
    typeof config['description'] === 'string' &&
    typeof config['silent'] === 'boolean' &&
    typeof config['noremap'] === 'boolean' &&
    typeof config['expr'] === 'boolean' &&
    typeof config['showInKeymaps'] === 'boolean'
  )
}

function isValidRunActionConfig(config: Record<string, unknown>): boolean {
  const mode = config['mode']
  if (
    mode !== 'catalog' &&
    mode !== 'custom-command' &&
    mode !== 'custom-keys'
  ) {
    return false
  }
  const actionType = config['actionType']
  if (actionType !== 'command' && actionType !== 'keys') return false

  const paramValues = config['paramValues']
  if (!isRecordOfStrings(paramValues)) return false

  return (
    typeof config['action'] === 'string' &&
    typeof config['selectedActionKey'] === 'string'
  )
}

function isValidSetVariableConfig(config: Record<string, unknown>): boolean {
  // Validate scope via shared guard
  const scope = config['scope']
  if (typeof scope !== 'string' || !isVariableScope(scope)) {
    return false
  }

  // Validate valueType via shared guard
  const valueType = config['valueType']
  if (typeof valueType !== 'string' || !isSetVariableValueType(valueType)) {
    return false
  }

  // Enforce value/valueType compatibility
  const value = config['value']
  if (!isSetVariableValueCompatible(valueType, value)) {
    return false
  }

  return typeof config['variableName'] === 'string'
}

function isValidGetVariableConfig(config: Record<string, unknown>): boolean {
  const scope = config['scope']
  if (typeof scope !== 'string' || !isVariableScope(scope)) {
    return false
  }
  return typeof config['variableName'] === 'string'
}

function isValidCreateAutocmdConfig(config: Record<string, unknown>): boolean {
  const events = config['events']
  if (!Array.isArray(events)) return false
  if (!events.every((e) => typeof e === 'string')) return false
  // Note: Storage accepts any string events. Semantic event allow-listing and
  // canonicalization is handled by UI normalization/catalog flows, not here.
  const patterns = config['patterns']
  if (!Array.isArray(patterns)) return false
  if (!patterns.every((p) => typeof p === 'string')) return false
  return (
    typeof config['callbackLua'] === 'string' &&
    typeof config['groupName'] === 'string' &&
    typeof config['once'] === 'boolean' &&
    typeof config['nested'] === 'boolean'
  )
}

function isValidSetHighlightConfig(config: Record<string, unknown>): boolean {
  return (
    typeof config['groupName'] === 'string' &&
    typeof config['foreground'] === 'string' &&
    typeof config['background'] === 'string' &&
    typeof config['bold'] === 'boolean' &&
    typeof config['italic'] === 'boolean' &&
    typeof config['underline'] === 'boolean'
  )
}

function isValidActionNodeData(data: Record<string, unknown>): boolean {
  // action: require actionType string, label string, actionConfig record
  if (typeof data['actionType'] !== 'string') return false
  if (typeof data['label'] !== 'string') return false

  const actionConfig = data['actionConfig']
  if (!isRecord(actionConfig)) return false

  // actionConfig.actionConfigType must match actionType
  const actionConfigType = actionConfig['actionConfigType']
  if (actionConfigType !== data['actionType']) return false

  // Strict validation based on action type
  switch (data['actionType']) {
    case 'set-option':
      return isValidSetOptionConfig(actionConfig)
    case 'set-keymap':
      return isValidSetKeymapConfig(actionConfig)
    case 'run-action':
      return isValidRunActionConfig(actionConfig)
    case 'set-variable':
      return isValidSetVariableConfig(actionConfig)
    case 'get-variable':
      return isValidGetVariableConfig(actionConfig)
    case 'create-autocmd':
      return isValidCreateAutocmdConfig(actionConfig)
    case 'set-highlight':
      return isValidSetHighlightConfig(actionConfig)
    default:
      return false
  }
}

// Strict condition operator enum gate
const CONDITION_OPERATOR_SET = new Set(['==', '~=', '>', '>=', '<', '<='])

function isValidConditionNodeData(data: Record<string, unknown>): boolean {
  // condition: require operator in enum set, hardcodedA, hardcodedB strings
  const operator = data['operator']
  if (typeof operator !== 'string') return false
  if (!CONDITION_OPERATOR_SET.has(operator)) return false
  if (typeof data['hardcodedA'] !== 'string') return false
  if (typeof data['hardcodedB'] !== 'string') return false
  return true
}

function isValidLoopNodeData(data: Record<string, unknown>): boolean {
  // loop: require loopType in ['for','while','each'], iteratorVariable, iterableExpression strings
  const loopType = data['loopType']
  if (loopType !== 'for' && loopType !== 'while' && loopType !== 'each')
    return false
  if (typeof data['iteratorVariable'] !== 'string') return false
  if (typeof data['iterableExpression'] !== 'string') return false
  return true
}

function isValidCodeBlockNodeData(data: Record<string, unknown>): boolean {
  // code-block: require code string, inputs/outputs arrays with id/name/dataType
  if (typeof data['code'] !== 'string') return false

  const inputs = data['inputs']
  const outputs = data['outputs']
  if (!Array.isArray(inputs)) return false
  if (!Array.isArray(outputs)) return false

  for (const port of inputs) {
    if (!isCallablePort(port)) return false
  }
  for (const port of outputs) {
    if (!isCallablePort(port)) return false
  }
  return true
}

function isValidGraphRefNodeData(data: Record<string, unknown>): boolean {
  // graph-ref: require referencedGraphId string
  if (typeof data['referencedGraphId'] !== 'string') return false

  // if cachedContract exists, require parameters/returnValues arrays of callable-port-like objects
  const cachedContract = data['cachedContract']
  if (cachedContract !== undefined) {
    if (!isRecord(cachedContract)) return false

    const parameters = cachedContract['parameters']
    const returnValues = cachedContract['returnValues']
    if (!Array.isArray(parameters)) return false
    if (!Array.isArray(returnValues)) return false

    for (const port of parameters) {
      if (!isCallablePort(port)) return false
    }
    for (const port of returnValues) {
      if (!isCallablePort(port)) return false
    }
  }
  return true
}

function isValidRunFunctionNodeData(data: Record<string, unknown>): boolean {
  // run-function: require selectedFunctionKey string, functionSource record,
  // signature null or object, paramDefaults record
  if (typeof data['selectedFunctionKey'] !== 'string') return false

  const functionSource = data['functionSource']
  if (!isRecord(functionSource)) return false

  const signature = data['signature']
  if (signature !== null && !isRecord(signature)) return false

  const paramDefaults = data['paramDefaults']
  if (!isRecord(paramDefaults)) return false

  return true
}

function isValidBuiltinNodeData(data: Record<string, unknown>): boolean {
  // builtin: require builtinId string and config plain object
  if (typeof data['builtinId'] !== 'string') return false
  if (!isRecord(data['config'])) return false
  return true
}

function isValidCallableEntryNodeData(data: Record<string, unknown>): boolean {
  // callable-entry: require parameters array of callable-port-like objects
  const parameters = data['parameters']
  if (!Array.isArray(parameters)) return false
  for (const port of parameters) {
    if (!isCallablePort(port)) return false
  }
  return true
}

function isValidReturnNodeData(data: Record<string, unknown>): boolean {
  // return: require returnValues array of callable-port-like objects
  const returnValues = data['returnValues']
  if (!Array.isArray(returnValues)) return false
  for (const port of returnValues) {
    if (!isCallablePort(port)) return false
  }
  return true
}

// Validator registry for node types — easy to extend
const NODE_TYPE_VALIDATORS: Record<
  string,
  (data: Record<string, unknown>) => boolean
> = {
  trigger: isValidTriggerNodeData,
  action: isValidActionNodeData,
  condition: isValidConditionNodeData,
  loop: isValidLoopNodeData,
  'code-block': isValidCodeBlockNodeData,
  'graph-ref': isValidGraphRefNodeData,
  'run-function': isValidRunFunctionNodeData,
  builtin: isValidBuiltinNodeData,
  'callable-entry': isValidCallableEntryNodeData,
  return: isValidReturnNodeData,
}

function isValidGraphNode(value: unknown): boolean {
  if (!isRecord(value)) return false

  const { id, type, definitionId, position, data } = value as Record<
    string,
    unknown
  >

  // Check required fields
  if (
    typeof id !== 'string' ||
    typeof type !== 'string' ||
    typeof definitionId !== 'string'
  )
    return false
  if (
    !isRecord(position) ||
    !isFiniteNumber(position['x']) ||
    !isFiniteNumber(position['y'])
  )
    return false
  if (!isRecord(data) || typeof data['nodeType'] !== 'string') return false
  if (type !== data['nodeType']) return false

  // Dispatch to per-type validator
  const validator = NODE_TYPE_VALIDATORS[data['nodeType']]
  if (validator === undefined) return false
  return validator(data as Record<string, unknown>)
}

function isValidGraphEdge(value: unknown): boolean {
  if (!isRecord(value)) return false

  const id = value['id']
  const source = value['source']
  const sourcePort = value['sourcePort']
  const target = value['target']
  const targetPort = value['targetPort']

  return (
    typeof id === 'string' &&
    typeof source === 'string' &&
    typeof sourcePort === 'string' &&
    typeof target === 'string' &&
    typeof targetPort === 'string'
  )
}

// ============================================
// Typed Array Guards (remove unsafe casts)
// ============================================

function isValidGraphNodes(value: unknown): value is Graph['nodes'] {
  return Array.isArray(value) && value.every(isValidGraphNode)
}

function isValidGraphEdges(value: unknown): value is Graph['edges'] {
  return Array.isArray(value) && value.every(isValidGraphEdge)
}

/**
 * Strict validation that data conforms to Graph shape.
 * Returns valid Graph or null if invalid.
 * Canonical format only - no defaults, no migration.
 */
function validateGraph(data: unknown): Graph | null {
  if (!isRecord(data)) {
    return null
  }

  // Required fields - must all be present and valid
  const id = data['id']
  const name = data['name']
  const nodes = data['nodes']
  const edges = data['edges']
  const createdAt = data['createdAt']
  const updatedAt = data['updatedAt']
  const enabled = data['enabled']
  const order = data['order']

  // Validate required fields
  if (typeof id !== 'string') return null
  if (typeof name !== 'string') return null
  if (!isValidGraphNodes(nodes)) return null
  if (!isValidGraphEdges(edges)) return null
  if (!isFiniteNumber(createdAt)) return null
  if (!isFiniteNumber(updatedAt)) return null
  if (typeof enabled !== 'boolean') return null
  if (!isFiniteNumber(order)) return null

  // Optional description - only string or undefined allowed
  const description = data['description']
  if (description !== undefined && typeof description !== 'string') {
    return null
  }

  // Optional viewport - only valid viewport object or undefined allowed
  const viewport = data['viewport']
  if (viewport !== undefined && !isValidViewport(viewport)) {
    return null
  }

  return {
    id,
    name,
    description: description === undefined ? undefined : description,
    nodes,
    edges,
    viewport: viewport === undefined ? undefined : viewport,
    createdAt,
    updatedAt,
    enabled,
    order,
  }
}

function compareGraphsByOrder(left: Graph, right: Graph): number {
  if (left.order !== right.order) {
    return left.order - right.order
  }

  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt
  }

  return left.id.localeCompare(right.id)
}

/**
 * List all graphs in a project.
 * Only reads canonical Graph files (no legacy migration writes).
 * @param projectPath - Absolute path to project folder
 */
export async function listGraphs(projectPath: string): Promise<Graph[]> {
  await ensureProjectDir(projectPath, PROJECT_PATHS.GRAPHS)

  const entries = await listProjectDir(projectPath, PROJECT_PATHS.GRAPHS)
  const loadedGraphs: Graph[] = []

  for (const entry of entries) {
    if (entry.name.endsWith('.json')) {
      try {
        const graphId = entry.name.replace('.json', '')
        const graphPath = getGraphFilePath(graphId)
        const rawData = await readProjectFile<unknown>(projectPath, graphPath)

        const validated = validateGraph(rawData)
        if (validated !== null) {
          loadedGraphs.push(validated)
        } else {
          console.warn(`Skipping invalid graph file: ${entry.name}`)
        }
      } catch {
        console.warn(`Skipping unreadable graph file: ${entry.name}`)
      }
    }
  }

  const sorted = [...loadedGraphs].sort(compareGraphsByOrder)
  assignContiguousOrder(sorted)

  return sorted
}

/**
 * Create a new graph.
 * @param projectPath - Absolute path to project folder
 */
export async function createGraph(
  projectPath: string,
  name: string,
  description?: string,
): Promise<Graph> {
  const id = uuidv4()
  const now = Date.now()

  // Get existing graphs to determine next order
  const existingGraphs = await listGraphs(projectPath)
  const order = getNextOrderValue(existingGraphs)

  const graph: Graph = {
    id,
    name,
    description,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    enabled: true,
    order,
  }

  const graphPath = getGraphFilePath(id)
  await writeProjectFile(projectPath, graphPath, graph)

  return graph
}

/**
 * Get a graph by ID.
 * @param projectPath - Absolute path to project folder
 * @returns The graph, or null if not found or on-disk data is invalid.
 */
export async function getGraph(
  projectPath: string,
  graphId: string,
): Promise<Graph | null> {
  try {
    const graphPath = getGraphFilePath(graphId)
    const rawData = await readProjectFile<unknown>(projectPath, graphPath)
    return validateGraph(rawData)
  } catch {
    return null
  }
}

/**
 * Save a graph.
 * @param projectPath - Absolute path to project folder
 */
export async function saveGraph(
  projectPath: string,
  graph: Graph,
): Promise<void> {
  const graphPath = getGraphFilePath(graph.id)
  await writeProjectFile(projectPath, graphPath, graph)
}

/**
 * Save graph content while preserving latest metadata (enabled/order) from disk.
 * Use for full graph saves (autosave, node edits) to avoid clobbering metadata
 * changed concurrently by sidebar toggle/reorder operations.
 *
 * @returns The saved graph with merged metadata, or null if the graph is
 *   missing on disk or the on-disk data is invalid. Callers MUST handle null.
 */
export async function saveGraphContent(
  projectPath: string,
  graph: Graph,
): Promise<Graph | null> {
  const latest = await getGraph(projectPath, graph.id)
  if (latest === null) {
    return null
  }

  const merged: Graph = {
    ...graph,
    enabled: latest.enabled,
    order: latest.order,
  }

  await saveGraph(projectPath, merged)
  return merged
}

/**
 * Delete a graph.
 * @param projectPath - Absolute path to project folder
 */
export async function deleteGraph(
  projectPath: string,
  graphId: string,
): Promise<void> {
  const graphPath = getGraphFilePath(graphId)
  await removeProjectFile(projectPath, graphPath)
}

/**
 * Update only the metadata fields (enabled, order) of a graph.
 * Reads the latest graph from disk and merges only the metadata changes.
 * Prevents stale overwrites during toggle/reorder operations.
 *
 * @param projectPath - Absolute path to project folder
 * @param patch - Metadata fields to update
 * @returns The updated graph, or null if graph not found or on-disk data is
 *   invalid. Callers MUST handle null.
 */
export async function updateGraphMetadata(
  projectPath: string,
  patch: GraphMetadataPatch,
): Promise<Graph | null> {
  // Read latest on-disk graph
  const graph = await getGraph(projectPath, patch.graphId)
  if (graph === null) {
    return null
  }

  // Merge only metadata fields
  const updated: Graph = {
    ...graph,
    ...(patch.enabled !== undefined && { enabled: patch.enabled }),
    ...(patch.order !== undefined && { order: patch.order }),
    updatedAt: Date.now(),
  }

  await saveGraph(projectPath, updated)
  return updated
}

/**
 * Update order for multiple graphs in a batch operation.
 * More efficient than individual updates when reordering.
 * Stops on first failure and returns discriminated result.
 * @param projectPath - Absolute path to project folder
 * @param updates - Array of graphId + order pairs
 * @returns Discriminated result with success/error branches
 */
export async function updateGraphOrderBatch(
  projectPath: string,
  updates: readonly GraphOrderUpdate[],
): Promise<GraphOrderBatchResult> {
  const appliedGraphIds: string[] = []

  for (const update of updates) {
    const result = await updateGraphMetadata(projectPath, {
      graphId: update.graphId,
      order: update.order,
    })

    if (result === null) {
      return {
        success: false,
        failedGraphId: update.graphId,
        failedOrder: update.order,
        error: `Failed to update order for graph "${update.graphId}" - graph missing or invalid on disk`,
        appliedGraphIds,
      }
    }

    appliedGraphIds.push(update.graphId)
  }

  return { success: true, updatedGraphIds: appliedGraphIds }
}
