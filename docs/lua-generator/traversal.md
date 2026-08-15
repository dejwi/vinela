# Traversal

> How graphs are indexed, traversed, and converted into compilation units.
> Located in `src/features/lua-generator/traversal/`.

## Overview

The traversal module (Domain 2) converts a `Graph` (nodes + edges) into a deterministic, linear sequence of `CompilationUnit[]`. It handles:

1. **Indexing** -- O(V+E) precomputation of edge lookups
2. **Edge classification** -- Separating exec (control flow) from data (value flow) edges
3. **Exec traversal** -- DFS walk of execution flow with inline code generation
4. **Data dependency resolution** -- Kahn's algorithm for topological sort of data inputs
5. **Cycle detection** -- For both exec and data flows
6. **Variable naming** -- Deterministic, collision-safe Lua variable names

## How Graphs Are Indexed

**File:** `traversal/indexes.ts` (245 lines)

### `buildGraphIndexes(graphs: readonly Graph[]): TraversalGraphIndexes`

Builds O(V+E) indexes for all graphs. The result:

```typescript
interface TraversalGraphIndexes {
  readonly byGraph: ReadonlyMap<string, IndexedGraph>  // Per-graph indexes
  readonly allNodes: ReadonlyMap<string, GraphNode>     // Global node lookup
}

interface IndexedGraph {
  readonly nodesById: ReadonlyMap<string, GraphNode>
  readonly outgoingExecByNode: ReadonlyMap<string, readonly ExecEdge[]>
  readonly incomingExecByNode: ReadonlyMap<string, readonly ExecEdge[]>
  readonly outgoingDataByNode: ReadonlyMap<string, readonly DataEdge[]>
  readonly incomingDataByNode: ReadonlyMap<string, readonly DataEdge[]>
  readonly incomingDataByTargetPort: ReadonlyMap<string, ReadonlyMap<string, readonly DataEdge[]>>
  readonly entries: readonly string[]  // Entry node IDs
}
```

### Edge Classification

The indexer classifies each edge as **exec** or **data** based on the source node type and port ID. This is the critical `isExecEdge()` function:

```typescript
function isExecEdge(node: GraphNode, portId: string): boolean {
  switch (node.data.nodeType) {
    case 'trigger':        return portId === 'exec'
    case 'callable-entry': return portId === 'exec'
    case 'action':         return portId === 'done' || portId === 'on-event'
    case 'condition':      return portId === 'true' || portId === 'false'
    case 'loop':           return portId === 'loop' || portId === 'done'
    case 'code-block':
      // 'done' is exec, but user-defined output ports are data
      return portId === 'done' && !node.data.outputs.some(p => p.id === portId)
    case 'graph-ref':      return portId === 'done'
    case 'run-function':   return portId === 'done'
    case 'builtin':        return portId === 'done'
    case 'return':         return false  // No outputs
    default:               return portId === 'exec' || portId === 'done'
  }
}
```

### Entry Node Detection

Entry nodes are identified by type:
- `trigger` nodes (startup triggers)
- `callable-entry` nodes (callable graph entry points)

These are stored in `IndexedGraph.entries` and used as starting points for traversal.

## Exec vs Data Edges

This is a fundamental concept. The graph has two overlapping edge systems:

### Exec Edges (Control Flow)
- Determine **statement ordering** -- which code runs first
- Connect exec output ports to exec input ports
- Form a tree/DAG structure (with merge points for conditions)
- Traversed via DFS

### Data Edges (Value Flow)
- Determine **value availability** -- which variables are in scope
- Connect data output ports to data input ports
- Can form DAGs (one output feeding multiple inputs)
- Resolved via Kahn's topological sort

**Example:**
```
[Trigger] --exec--> [Set Option A] --exec--> [Set Option B]
                         |                        ^
                         +---data (value)----------+
```

Here, the exec edges determine that A runs before B. The data edge means B reads a value produced by A.

## Port ID Conventions

**CRITICAL: Port IDs must match between the UI (React Flow) and the generator system.**

### Standard Exec Port IDs

| Port | Used By | Direction | Meaning |
|------|---------|-----------|---------|
| `exec` | trigger, callable-entry | output | Start of execution |
| `done` | action, code-block, graph-ref, builtin | output | Execution complete |
| `true` | condition | output | True branch |
| `false` | condition | output | False branch |
| `loop` | loop | output | Loop body |
| `on-event` | create-autocmd | output | Callback body |

### Standard Data Port IDs

| Port | Used By | Direction | Meaning |
|------|---------|-----------|---------|
| `value` | set-option, set-variable, get-variable | input/output | The value |
| `a`, `b` | condition | input | Comparison operands |
| `item`, `index` | loop (each) | output | Iterator values |
| `result` | call-function, run-function | output | Function return value |
| `key-sequence` | set-keymap | input | Key binding |
| `on-press` | set-keymap | input | Action to perform |
| `param:<name>` | run-function | input | Per-parameter input port (one per signature param) |
| `message`, `title` | ui.notify builtin | input | Notification text / title override |
| `path` | buffers.open-file builtin | input | File path override |
| `value` | input.prompt builtin | output | User-entered text |

### Dynamic Port IDs

Some nodes have dynamic ports based on configuration:
- **callable-entry**: Output ports match `data.parameters[].id`
- **return**: Input ports match `data.returnValues[].id`
- **graph-ref**: Input/output ports match target graph's contract
- **code-block**: Input/output ports match `data.inputs[].id` / `data.outputs[].id`

### Port ID Mapping Between UI and Generator

The UI components (React Flow nodes) define ports with specific IDs. The generator system must use **exactly the same IDs**. There is no mapping layer -- the port IDs in the graph JSON are used directly by both systems.

**Where port IDs are defined:**
- UI node components: `src/features/graph-editor/components/nodes/`
- Graph type definitions: `src/shared/types/graph.ts`
- Edge classification: `src/features/lua-generator/traversal/indexes.ts`
- Generator input resolution: Each generator file

**Common mismatch scenarios:**
- UI uses `on-event` but generator checks for `on-trigger` (or vice versa)
- UI uses `done` but generator checks for `complete`
- Dynamic ports use different ID formats between UI and generator

### Authoritative Port ID Contract

The following table lists the **canonical** (current UI) port IDs and any **legacy aliases** accepted by the traversal code for backward compatibility. Use canonical IDs for all new graphs; legacy aliases exist only to handle edges saved by older versions.

| Node type | Port | Canonical ID | Legacy alias(es) | Direction | Kind |
|-----------|------|-------------|-----------------|-----------|------|
| `trigger` | Start | `exec` | — | output | exec |
| `callable-entry` | Start | `exec` | — | output | exec |
| `action` (all) | Continue | `done` | — | output | exec |
| `action:create-autocmd` | Callback body | `on-event` | — | output | exec |
| `condition` | True branch | `true` | — | output | exec |
| `condition` | False branch | `false` | — | output | exec |
| `loop` | Loop body | `loop` | `body` *(compat-only)* | output | exec |
| `loop` | After loop | `done` | `complete` *(compat-only)* | output | exec |
| `code-block` | Continue | `done` | — | output | exec |
| `graph-ref` | Continue | `done` | — | output | exec |
| `run-function` | Continue | `done` | — | output | exec |
| `builtin` | Continue | `done` | — | output | exec |
| `condition` | Left operand | `a` | — | input | data |
| `condition` | Right operand | `b` | — | input | data |
| `loop` (each) | Current item | `item` | — | output | data |
| `loop` (each) | Current index | `index` | — | output | data |
| `set-option` / `set-variable` | Value override | `value` | — | input | data |
| `set-keymap` | Key sequence | `key-sequence` | — | input | data |
| `set-keymap` | Action | `on-press` | — | input | data |
| `run-function` | Parameter input | `param:<name>` | — | input | data |
| `run-function` | Return value | `result` | — | output | data |
| `input.prompt` builtin | User input result | `value` | — | output | data |

> **Legacy aliases** (`body`, `complete`) are accepted by `exec-traversal.ts` when following loop edges, but are **not** recognized by the edge classifier in `indexes.ts` (which only knows `loop`/`done`). This means edges saved with legacy port IDs may be misclassified as data edges. For correctness, always use canonical IDs when creating new edges.

See [Common Issues](./common-issues.md#port-id-mismatches) for debugging tips.

## Exec Flow Traversal

**File:** `traversal/exec-traversal.ts` (835 lines)

### `traverseExecFlow(entryNodeId, indexes, context, collector): CompilationUnit[]`

The main traversal function. Uses DFS with cycle detection.

### Traversal Algorithm

```
1. Start at entry node
2. For each node:
   a. Check cycle guard (visiting set)
   b. Check already-emitted guard
   c. Resolve output bindings (temp variable names for outputs)
   d. Resolve data dependencies (Kahn's algorithm for inputs)
   e. Look up and call node generator
   f. Register output bindings in valueBindings map
   g. Follow exec edges based on node type:
      - Linear nodes: follow single continuation
      - Condition: process true/false branches, find merge point
      - Loop: process body, follow completion edge
```

### Inline Code Generation

The key insight is that branch/body code is generated **inline** within the parent node's code, not as separate compilation units.

When a condition generator calls `renderExecFromPort(node.id, 'true')`, the traversal:
1. Follows the exec edge from the `true` port
2. Generates code for the target node (and its successors) via `generateInlineCode()`
3. Marks those nodes as "emitted" so they won't be processed again
4. Returns the code lines at indent level 0

The condition generator then embeds those lines inside its `if...then...end` block:

```typescript
// Inside condition generator:
const trueLines = context.renderExecFromPort(node.id, 'true')
builder.block('if condition then', (inner) => {
  for (const line of trueLines) {
    inner.line(line)  // LuaBuilder adds proper indentation
  }
}, 'end')
```

### Merge Point Detection

For condition nodes, the traversal finds where true/false branches reconverge:

```typescript
function findMergePoint(trueBranchId, falseBranchId, indexes): string | null {
  const trueReachable = getAllReachable(trueBranchId, indexes)   // BFS
  const falseReachable = getAllReachable(falseBranchId, indexes) // BFS
  // First node reachable from both branches
  for (const nodeId of trueReachable) {
    if (falseReachable.has(nodeId)) return nodeId
  }
  return null
}
```

The merge point is then processed at the same indent level as the condition, after the `if...end` block.

## Data Dependency Resolution

**File:** `traversal/data-dependencies.ts`

### `resolveDataDependencies(nodeId, indexes, valueBindings, usedTempNames, collector)`

Before a node generator is called, all its data inputs must be resolved. This function:

1. Collects all incoming data edges for the target node
2. For each input port, looks up the source node's output binding in `valueBindings`
3. If the source hasn't been processed yet, uses Kahn's algorithm to determine order
4. Returns `{ bindings: Record<string, string>, newTempNames: string[] }`

The `bindings` map is passed to the generator as `context.inputBindings`.

### Value Binding Types

```typescript
type LuaValueRef =
  | { readonly kind: 'literal'; readonly lua: string }   // Inline Lua expression
  | { readonly kind: 'temp'; readonly name: string }      // Temp variable name
  | { readonly kind: 'param'; readonly name: string }     // Function parameter
```

Bindings are stored in a map keyed by `"${nodeId}:${portId}"`.

## Cycle Detection

**File:** `traversal/cycle-detection.ts`

Two independent cycle detectors:

### `detectExecCycles(indexed: IndexedGraph): CycleDetectionResult`
DFS-based detection on exec edges. Returns all cycles found.

### `detectDataCycles(indexed: IndexedGraph): CycleDetectionResult`
DFS-based detection on data edges. Returns all cycles found.

Both use a recursion stack (`visiting` set) to detect back edges.

### `detectLocalDataCycles(nodeIds, getOutgoingEdges)`
Detects cycles in a local subgraph (used during data dependency resolution).

## Variable Naming

**File:** `traversal/variable-naming.ts`

### Naming Conventions

| Pattern | Example | Used For |
|---------|---------|----------|
| `_ns_{nodeId}_{portId}` | `_ns_a1b2c3_value` | Temp variables for node outputs |
| `param_{name}` | `param_input1` | Callable entry parameters |
| `local_{purpose}` | `local_counter` | Local variables |
| `_gen_{hint}_{counter}` | `_gen_var_1` | Generated unique variables |

### Collision Handling

All naming functions accept a `usedNames: ReadonlySet<string>` parameter. If a name collides, `_2`, `_3`, etc. are appended:

```typescript
function generateVariableName(nodeId, portId, usedNames): string {
  const base = `_ns_${sanitize(nodeId)}_${sanitize(portId)}`
  if (!usedNames.has(base)) return base
  let counter = 2
  while (usedNames.has(`${base}_${counter}`)) counter++
  return `${base}_${counter}`
}
```

### Binding Keys

```typescript
makeBindingKey(nodeId, portId)  // Returns "${nodeId}:${portId}"
parseBindingKey(key)            // Returns { nodeId, portId } or null
```

## Complexity Guarantees

| Operation | Time | Space |
|-----------|------|-------|
| Graph indexing | O(V+E) | O(V+E) |
| Exec traversal + cycle detection | O(V+E) | O(V) |
| Data dependency sort (Kahn's) | O(V+E) | O(V+E) |
| Variable naming | O(1) amortized | O(V) |

## Helper Functions

### From `indexes.ts`

```typescript
// Get outgoing exec edges, sorted deterministically by edge ID
getOutgoingExecEdges(indexes: IndexedGraph, nodeId: string): readonly ExecEdge[]

// Get incoming data edges for a specific port
getIncomingDataEdges(indexes: IndexedGraph, nodeId: string, portId: string): readonly DataEdge[]

// Get all incoming data edges for a node
getAllIncomingDataEdges(indexes: IndexedGraph, nodeId: string): readonly DataEdge[]
```

### From `exec-traversal.ts`

```typescript
// Find nodes not reachable from any entry point
findUnreachableNodes(indexes: IndexedGraph, collector: DiagnosticsCollector): readonly string[]
```

## Common Pitfalls

1. **Port ID mismatches** -- The indexer's `isExecEdge()` must agree with the UI's port definitions. If a port is classified as exec when it should be data (or vice versa), the traversal will silently skip it.

2. **Merge point not found** -- If condition branches don't reconverge, the merge point is `null` and post-condition code won't execute. This is valid but may surprise users.

3. **Double emission** -- Nodes processed via `renderExecFromPort` are marked as emitted. The outer `traverse()` loop skips them. If a node is reachable from both the inline path and the outer path, the inline path wins.

4. **Deterministic ordering** -- All edge lists are sorted by `edgeId` for deterministic output. If you add new edge iteration, always sort.

5. **Topology-only mode** -- When `enableNodeGeneration` is false, traversal still runs but doesn't call generators. This is used for testing traversal logic independently.

## Related Documentation

- [Architecture](./architecture.md) -- How traversal fits in the pipeline
- [Node Generators](./node-generators.md) -- How generators consume traversal output
- [Common Issues](./common-issues.md) -- Port ID debugging
