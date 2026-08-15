# Domain 2: Graph Traversal & Topological Sort

This module provides the compiler core for graph-based Lua generation. It converts a `Graph` (nodes + edges) into a deterministic, linear sequence of compilation units.

## Architecture

The module reconciles two edge systems:
- **Exec flow** (`void` outputs): Determines control structure and statement ordering
- **Data flow** (non-`void` outputs): Determines value availability and temporary variable bindings

## Files

| File | Purpose |
|------|---------|
| `types.ts` | Core type definitions (CompilationUnit, TraversalState, IndexedGraph, etc.) |
| `indexes.ts` | Build O(V+E) graph indexes for efficient traversal |
| `exec-traversal.ts` | DFS traversal of execution flow with cycle detection |
| `data-dependencies.ts` | Topological sort (Kahn's algorithm) for data dependencies |
| `cycle-detection.ts` | Cycle detection for both exec and data flows |
| `variable-naming.ts` | Generate deterministic, collision-safe Lua variable names |
| `index.ts` | Public API exports |

## Key Types

### CompilationUnit
```typescript
interface CompilationUnit {
  readonly nodeId: string
  readonly nodeType: string
  readonly code: string[]
  readonly localVars: string[]
  readonly inputBindings: Record<string, string>
  readonly outputBindings: Record<string, string>
  readonly indentLevel: number
}
```

### IndexedGraph
Precomputed indices for O(V+E) traversal:
- `nodesById`: Map of node ID to GraphNode
- `outgoingExecByNode`: Exec edges grouped by source node
- `incomingExecByNode`: Exec edges grouped by target node
- `outgoingDataByNode`: Data edges grouped by source node
- `incomingDataByNode`: Data edges grouped by target node
- `incomingDataByTargetPort`: Data edges grouped by target node and port
- `entries`: Entry node IDs (triggers and callable entries)

## Usage

### Build Indexes
```typescript
const indexes = buildGraphIndexes([graph1, graph2, ...])
const indexed = indexes.byGraph.get(graphId)!
```

### Traverse Execution Flow
```typescript
const units = traverseExecFlow(
  entryNodeId,
  indexed,
  context,
  collector
)
```

### Resolve Data Dependencies
```typescript
const result = resolveDataDependencies(
  nodeId,
  indexed,
  valueBindings,
  usedTempNames,
  collector
)
// result.bindings: portId -> variable name
// result.dependencies: topologically sorted provider nodes
```

### Detect Cycles
```typescript
const execCycles = detectExecCycles(indexed)
const dataCycles = detectDataCycles(indexed)
```

### Generate Variable Names
```typescript
const varName = generateVariableName(nodeId, portId, usedNames)
// Returns: "_ns_node123_result" or "_ns_node123_result_2" on collision
```

## Complexity Guarantees

- Graph indexing: O(V+E)
- Exec traversal + cycle detection: O(V+E)
- Data dependency sorting: O(V+E) via Kahn's algorithm
- Memory: O(V+E)

## Error Handling

All functions use `DiagnosticsCollector` for non-fail-fast error accumulation:
- `exec-cycle-detected`: Execution flow contains a cycle
- `data-cycle-detected`: Data dependencies contain a cycle
- `ambiguous-exec-continuation`: Multiple exec edges from a linear node
- `unreachable-node`: Node not reachable from any entry

## Testing

```bash
bun test src/features/lua-generator/traversal --no-coverage
```

46 tests covering:
- Graph indexing and edge classification
- Linear, conditional, and loop traversal
- Data dependency resolution
- Cycle detection (exec and data)
- Variable naming with collision handling
- Integration scenarios
