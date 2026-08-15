/**
 * Performance Fixture Builders for Category 13 Tests
 *
 * Provides deterministic, loop-based graph builders for stress-scale scenarios.
 * All fixtures:
 *   - Use explicit exec port wiring via `connectExec` / `connectTrue` / `connectFalse`
 *   - Are built with stable, deterministic IDs for reproducible workloads
 *   - Are returned as `readonly Graph[]` for immutability discipline
 *
 * Build fixtures BEFORE starting timing measurements — only the generation
 * call should be included in `measureGenerationTime`.
 *
 * ## Exec-port wiring rationale
 * GraphBuilder.connect() defaults to `out -> in` (data edges). The traversal
 * only follows strict exec-port IDs (`exec`, `done`, `true`, `false`, `loop`).
 * Accidental data edges cause the generator to traverse far less work than
 * intended, silently invalidating timing workloads. All builders below use
 * `connectExec`, `connectTrue`, `connectFalse`, or explicit port IDs.
 */

import type { ProjectKeymap } from '@/features/keymaps/types'
import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'
import type {
  InstalledPluginFixture,
  NeovimOptionsFixture,
} from './orchestrator-fixture'

// ─────────────────────────────────────────────────────────────────────────────
// Shared Config Factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal set-option action config with a per-node distinct option name.
 * Keeps per-node variation lightweight while ensuring unique Lua output
 * for order/count assertions.
 */
function setOptionConfig(optionName: string, value: boolean = true) {
  return {
    ...createDefaultActionConfig('set-option'),
    optionName,
    scope: 'global' as const,
    valueConfig: {
      valueMode: 'suggested' as const,
      suggestedValue: value,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.1 / 13.2 — Multi-graph chain builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build `graphCount` startup graphs, each containing a trigger followed by
 * `nodesPerGraph - 1` sequential set-option actions, all wired with exec edges.
 *
 * Self-check counters (verified externally before timing):
 *   totalNodes  = graphCount * nodesPerGraph
 *   totalEdges  = graphCount * (nodesPerGraph - 1)   (exec edges only)
 *
 * @param graphCount   Number of independent graphs to create.
 * @param nodesPerGraph Total node count per graph (1 trigger + N-1 actions).
 */
export function buildMultiGraphChains(
  graphCount: number,
  nodesPerGraph: number,
): readonly Graph[] {
  const graphs: Graph[] = []

  for (let g = 0; g < graphCount; g++) {
    const graphId = `perf-multi-g${g}`
    const triggerId = `${graphId}-trigger`
    let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

    const actionIds: string[] = []
    for (let n = 1; n < nodesPerGraph; n++) {
      const actionId = `${graphId}-action-${n}`
      actionIds.push(actionId)
      builder = builder.action(
        actionId,
        'set-option',
        setOptionConfig(`g${g}opt${n}`),
      )
    }

    // Wire trigger → a1 → a2 → … → aN
    if (actionIds.length > 0) {
      builder = builder.connectExec(triggerId, actionIds[0] as string)
      for (let i = 0; i < actionIds.length - 1; i++) {
        builder = builder.connectExec(
          actionIds[i] as string,
          actionIds[i + 1] as string,
        )
      }
    }

    graphs.push(builder.build())
  }

  return graphs
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.3 — Single long chain graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single startup graph: trigger → A₁ → A₂ → … → A(totalNodes-1)
 *
 * Self-check:
 *   graph.nodes.length === totalNodes
 *   exec edges         === totalNodes - 1
 *
 * @param totalNodes Total node count (1 trigger + totalNodes-1 actions).
 */
export function buildSingleChainGraph(totalNodes: number): Graph {
  const graphId = 'perf-chain'
  const triggerId = `${graphId}-trigger`
  let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

  const actionIds: string[] = []
  for (let n = 1; n < totalNodes; n++) {
    const actionId = `${graphId}-action-${n}`
    actionIds.push(actionId)
    builder = builder.action(
      actionId,
      'set-option',
      setOptionConfig(`chainopt${n}`),
    )
  }

  if (actionIds.length > 0) {
    builder = builder.connectExec(triggerId, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
  }

  return builder.build()
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.4 — Wide fan graph (condition → action branches)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single startup graph with `branchCount` independent condition→action
 * branch pairs, all chained from the trigger.
 *
 * Structure:
 *   trigger → cond₁ →(true)→ action₁
 *           → cond₂ →(true)→ action₂
 *           …
 *
 * Wiring: trigger.exec → cond₁.exec; cond₁.done → cond₂.exec; …
 * Each condition's true branch points to its paired action.
 * (False branch left disconnected — traversal stops there.)
 *
 * Self-check:
 *   graph.nodes.length === 1 + branchCount * 2   (trigger + N conditions + N actions)
 *   exec edges         === 1 + (branchCount - 1) + branchCount
 *                      === 1 + branchCount * 2 - 1
 *                      === branchCount * 2
 *   Note: trigger→cond1 (1) + condN.done→cond(N+1) (branchCount-1) + condN→actionN (branchCount)
 *         = 1 + branchCount-1 + branchCount = 2*branchCount total exec edges
 *
 * For branchCount=100:
 *   nodeCount  = 201
 *   execEdges  = 200
 *
 * @param branchCount Number of condition→action pairs.
 */
export function buildWideFanGraph(branchCount: number): Graph {
  const graphId = 'perf-fan'
  const triggerId = `${graphId}-trigger`
  let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

  const condIds: string[] = []
  const actionIds: string[] = []

  for (let i = 0; i < branchCount; i++) {
    const condId = `${graphId}-cond-${i}`
    const actionId = `${graphId}-action-${i}`
    condIds.push(condId)
    actionIds.push(actionId)

    builder = builder.condition(condId, '==', `branch${i}`, '1')
    builder = builder.action(
      actionId,
      'set-option',
      setOptionConfig(`fanopt${i}`),
    )
  }

  // Wire: trigger → cond0, then each condition's done → next condition
  builder = builder.connectExec(triggerId, condIds[0] as string)
  for (let i = 0; i < branchCount - 1; i++) {
    // Use done port (conditions emit done after evaluating — the "continuation" path)
    builder = builder.connect(
      condIds[i] as string,
      condIds[i + 1] as string,
      'done',
      'exec',
    )
  }

  // Wire each condition's true branch to its paired action
  for (let i = 0; i < branchCount; i++) {
    builder = builder.connectTrue(condIds[i] as string, actionIds[i] as string)
  }

  return builder.build()
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.5 — Deep nested conditions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single startup graph with `depth` nested conditions on the true path,
 * terminating in a single action at the deepest level.
 *
 * Structure:
 *   trigger → cond₁(true) → cond₂(true) → … → cond_depth(true) → terminalAction
 *
 * Self-check:
 *   graph.nodes.length === 1 + depth + 1   (trigger + N conditions + 1 terminal)
 *   exec edges (true-path) === 1 + depth   (trigger→c1, c1→c2, …, c(N)→terminal)
 *
 * @param depth Number of nested condition levels.
 */
export function buildDeepNestedConditions(depth: number): Graph {
  const graphId = 'perf-deep'
  const triggerId = `${graphId}-trigger`
  const terminalId = `${graphId}-terminal`
  let builder = new GraphBuilder(graphId, graphId)
    .startupTrigger(triggerId)
    .action(terminalId, 'set-option', setOptionConfig('deepTerminalOpt'))

  const condIds: string[] = []
  for (let i = 0; i < depth; i++) {
    const condId = `${graphId}-cond-${i}`
    condIds.push(condId)
    builder = builder.condition(condId, '==', `depthVar${i}`, `${i}`)
  }

  // Wire: trigger → cond0
  builder = builder.connectExec(triggerId, condIds[0] as string)

  // Wire: cond(i) true → cond(i+1)
  for (let i = 0; i < depth - 1; i++) {
    builder = builder.connectTrue(
      condIds[i] as string,
      condIds[i + 1] as string,
    )
  }

  // Wire: deepest condition true → terminal
  builder = builder.connectTrue(
    condIds[condIds.length - 1] as string,
    terminalId,
  )

  return builder.build()
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.6 — Many graph-ref calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build `callableCount` callable graphs, each with:
 *   callable-entry → action → return
 *
 * Plus 1 startup graph that calls each callable `callsPerCallable` times
 * in sequence (total `callableCount * callsPerCallable` graph-ref nodes).
 *
 * Self-check (startup graph):
 *   startup.nodes.length === 1 + callableCount * callsPerCallable
 *                            (trigger + all graph-ref nodes)
 *   exec edges in startup === callableCount * callsPerCallable
 *                            (trigger→ref1, ref1→ref2, …)
 *
 * @param callableCount   Number of distinct callable graphs.
 * @param callsPerCallable Number of times each callable is referenced in the startup graph.
 */
export function buildManyGraphRefs(
  callableCount: number,
  callsPerCallable: number,
): readonly Graph[] {
  const graphs: Graph[] = []

  // Build callable graphs
  const callableIds: string[] = []
  for (let c = 0; c < callableCount; c++) {
    const graphId = `perf-callable-${c}`
    callableIds.push(graphId)

    const entryId = `${graphId}-entry`
    const actionId = `${graphId}-action`
    const returnId = `${graphId}-return`

    const callable = new GraphBuilder(graphId, graphId)
      .callableEntry(entryId, [createCallablePort('p1', 'Param', 'any')])
      .action(actionId, 'set-option', setOptionConfig(`callableOpt${c}`))
      .returnNode(returnId, [createCallablePort('r1', 'Result', 'any')])
      .connectExec(entryId, actionId)
      .connectExec(actionId, returnId)
      .build()

    graphs.push(callable)
  }

  // Build startup graph with many graph-ref call nodes
  const startupId = 'perf-graphref-startup'
  const triggerId = `${startupId}-trigger`
  let startupBuilder = new GraphBuilder(startupId, startupId).startupTrigger(
    triggerId,
  )

  const refIds: string[] = []
  for (let c = 0; c < callableCount; c++) {
    for (let r = 0; r < callsPerCallable; r++) {
      const refId = `${startupId}-ref-c${c}-r${r}`
      refIds.push(refId)
      const callableGraphId = callableIds[c] as string
      startupBuilder = startupBuilder.graphRef(refId, callableGraphId)
    }
  }

  // Wire: trigger → ref[0] → ref[1] → … → ref[N-1]
  if (refIds.length > 0) {
    startupBuilder = startupBuilder.connectExec(triggerId, refIds[0] as string)
    for (let i = 0; i < refIds.length - 1; i++) {
      startupBuilder = startupBuilder.connectExec(
        refIds[i] as string,
        refIds[i + 1] as string,
      )
    }
  }

  graphs.push(startupBuilder.build())
  return graphs
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.7 — Complex project fixture for output-size test
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplexProjectFixture {
  graphs: readonly Graph[]
  /** Real Neovim options (5 standard options + leaderKey) for orchestrator testing */
  options: NeovimOptionsFixture
  /** Two project-sourced keymaps for orchestrator testing */
  keymaps: ProjectKeymap[]
  /** One enabled plugin with a config for orchestrator testing */
  plugins: InstalledPluginFixture[]
}

/**
 * Build a representative "complex project" fixture for output-size testing.
 *
 * Includes:
 *   - 5 startup graphs, each with 8 sequential actions (mix of set-option + run-action)
 *   - 3 callable graphs (entry → action → return)
 *   - 1 startup graph calling each callable 2 times via graph-ref nodes
 *   - 2 conditional startup graphs (condition → true/false actions)
 *
 * Total: 11 graphs, ~100 nodes.
 *
 * Also returns realistic non-graph data for orchestrator testing:
 *   - `options`: 5 real Neovim option names + leaderKey
 *   - `keymaps`: 2 project-sourced keymap entries
 *   - `plugins`: 1 enabled plugin (no schema — no-op in generation)
 */
export function buildComplexProjectFixtureForSize(): ComplexProjectFixture {
  const graphs: Graph[] = []

  // 5 startup graphs with 8 actions each
  for (let g = 0; g < 5; g++) {
    const graphId = `complex-startup-${g}`
    const triggerId = `${graphId}-trigger`
    let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

    const actionIds: string[] = []
    for (let n = 1; n <= 8; n++) {
      const actionId = `${graphId}-action-${n}`
      actionIds.push(actionId)
      if (n % 2 === 0) {
        // Even: run-action
        builder = builder.action(actionId, 'run-action', {
          ...createDefaultActionConfig('run-action'),
          mode: 'custom-command' as const,
          actionType: 'command' as const,
          action: `echo complex_g${g}_n${n}`,
          selectedActionKey: '',
          paramValues: {},
        })
      } else {
        // Odd: set-option
        builder = builder.action(
          actionId,
          'set-option',
          setOptionConfig(`complex_g${g}_opt${n}`),
        )
      }
    }

    builder = builder.connectExec(triggerId, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // 3 callable graphs
  const callableIds: string[] = []
  for (let c = 0; c < 3; c++) {
    const graphId = `complex-callable-${c}`
    callableIds.push(graphId)
    const entryId = `${graphId}-entry`
    const actionId = `${graphId}-action`
    const returnId = `${graphId}-return`

    graphs.push(
      new GraphBuilder(graphId, graphId)
        .callableEntry(entryId, [createCallablePort('p1', 'Input', 'any')])
        .action(actionId, 'set-option', setOptionConfig(`callableOpt${c}`))
        .returnNode(returnId, [createCallablePort('r1', 'Output', 'any')])
        .connectExec(entryId, actionId)
        .connectExec(actionId, returnId)
        .build(),
    )
  }

  // 1 startup graph calling each callable 2x via graph-ref
  {
    const graphId = 'complex-refs-startup'
    const triggerId = `${graphId}-trigger`
    let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

    const refIds: string[] = []
    for (const callableId of callableIds) {
      for (let r = 0; r < 2; r++) {
        const refId = `${graphId}-ref-${callableId}-${r}`
        refIds.push(refId)
        builder = builder.graphRef(refId, callableId)
      }
    }

    builder = builder.connectExec(triggerId, refIds[0] as string)
    for (let i = 0; i < refIds.length - 1; i++) {
      builder = builder.connectExec(
        refIds[i] as string,
        refIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // 2 conditional startup graphs
  for (let g = 0; g < 2; g++) {
    const graphId = `complex-cond-${g}`
    const triggerId = `${graphId}-trigger`
    const condId = `${graphId}-cond`
    const trueId = `${graphId}-true`
    const falseId = `${graphId}-false`

    graphs.push(
      new GraphBuilder(graphId, graphId)
        .startupTrigger(triggerId)
        .condition(condId, '==', `condVar${g}`, `${g}`)
        .action(trueId, 'set-option', setOptionConfig(`condTrue${g}`))
        .action(falseId, 'set-option', setOptionConfig(`condFalse${g}`))
        .connectExec(triggerId, condId)
        .connectTrue(condId, trueId)
        .connectFalse(condId, falseId)
        .build(),
    )
  }

  // Real Neovim options (5 standard options + leaderKey) — exercises real-world
  // option-section generator paths instead of synthetic names
  const options: NeovimOptionsFixture = {
    version: 1,
    options: {
      number: { valueType: 'boolean', value: true },
      wrap: { valueType: 'boolean', value: false },
      tabstop: { valueType: 'number', value: 2 },
      shiftwidth: { valueType: 'number', value: 2 },
      expandtab: { valueType: 'boolean', value: true },
    },
    leaderKey: ' ',
    updatedAt: 1_000_000,
  }

  // Two realistic project keymaps for section generator coverage
  const keymaps: ProjectKeymap[] = [
    {
      id: 'km-perf-1',
      modes: ['n'],
      keySequence: '<leader>ff',
      action: {
        actionType: 'run-action',
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: ':echo "find files"<CR>',
          selectedActionKey: '',
          paramValues: {},
        },
      },
      description: 'Perf test keymap 1',
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
    },
    {
      id: 'km-perf-2',
      modes: ['n'],
      keySequence: '<leader>q',
      action: {
        actionType: 'run-action',
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: ':q<CR>',
          selectedActionKey: '',
          paramValues: {},
        },
      },
      description: 'Perf test keymap 2',
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
    },
  ]

  // One plugin fixture (schemaId without a matching schema — will be silently
  // filtered by buildResolvedPlugins, safe for orchestrator testing)
  const plugins: InstalledPluginFixture[] = [
    {
      schemaId: 'perf-test-plugin',
      enabled: true,
      config: { opt1: true },
    },
  ]

  return { graphs, options, keymaps, plugins }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real Option Pool for Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pool of real Neovim boolean option names for fixture generation.
 * Rotated via modular indexing to ensure variety without exceeding catalog.
 */
const REAL_BOOL_OPTIONS: readonly string[] = [
  'number',
  'relativenumber',
  'cursorline',
  'cursorcolumn',
  'wrap',
  'linebreak',
  'breakindent',
  'expandtab',
  'smarttab',
  'autoindent',
  'smartindent',
  'ignorecase',
  'smartcase',
  'hlsearch',
  'incsearch',
  'wrapscan',
  'undofile',
  'swapfile',
  'backup',
  'autoread',
  'splitright',
  'splitbelow',
  'hidden',
  'termguicolors',
  'showmode',
  'showcmd',
  'wildmenu',
  'list',
  'title',
]

function realBoolOptionConfig(
  index: number,
): ReturnType<typeof setOptionConfig> {
  const name = REAL_BOOL_OPTIONS[index % REAL_BOOL_OPTIONS.length]
  if (name === undefined) throw new Error('REAL_BOOL_OPTIONS is empty')
  return setOptionConfig(name, index % 2 === 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.11 — Typical project fixture
// ─────────────────────────────────────────────────────────────────────────────

export interface TypicalProjectFixture {
  graphs: readonly Graph[]
  expectedStartupCount: number
  expectedCallableCount: number
}

/**
 * Build a realistic 8-graph "typical user project" fixture.
 *
 * Graphs:
 *   1. "Editor Setup"        — startup + 7 set-option actions
 *   2. "Search Config"       — startup + 4 set-option actions
 *   3. "File Handling"       — startup + 3 set-option actions
 *   4. "UI Polish"           — startup + condition (termguicolors) + 2 branch actions
 *   5. "Format on Save"      — startup + create-autocmd (BufWritePre)
 *   6. "Keymaps"             — startup + 4 set-keymap actions
 *   7. "Greet Helper"        — callable (entry → run-action → return)
 *   8. "Startup Orchestrator"— startup + graph-ref (Greet) + set-option + set-keymap
 *
 * Total: ~40 nodes, mix of 6 node types.
 * Returns `expectedStartupCount = 7`, `expectedCallableCount = 1`.
 */
export function buildTypicalProjectFixture(): TypicalProjectFixture {
  const graphs: Graph[] = []

  // ── Graph 1: Editor Setup ────────────────────────────────────────────────
  {
    const gid = 'typical-editor-setup'
    const trigger = `${gid}-trigger`
    const optionNames = [
      'number',
      'relativenumber',
      'cursorline',
      'expandtab',
      'tabstop',
      'shiftwidth',
      'scrolloff',
    ]
    let builder = new GraphBuilder('Editor Setup', gid).startupTrigger(trigger)
    const actionIds: string[] = []
    for (let i = 0; i < optionNames.length; i++) {
      const aid = `${gid}-action-${i}`
      actionIds.push(aid)
      const name = optionNames[i]
      if (name === undefined) throw new Error('option name undefined')
      builder = builder.action(aid, 'set-option', setOptionConfig(name, true))
    }
    builder = builder.connectExec(trigger, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // ── Graph 2: Search Config ───────────────────────────────────────────────
  {
    const gid = 'typical-search-config'
    const trigger = `${gid}-trigger`
    const optionNames = ['ignorecase', 'smartcase', 'hlsearch', 'incsearch']
    let builder = new GraphBuilder('Search Config', gid).startupTrigger(trigger)
    const actionIds: string[] = []
    for (let i = 0; i < optionNames.length; i++) {
      const aid = `${gid}-action-${i}`
      actionIds.push(aid)
      const name = optionNames[i]
      if (name === undefined) throw new Error('option name undefined')
      builder = builder.action(aid, 'set-option', setOptionConfig(name, true))
    }
    builder = builder.connectExec(trigger, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // ── Graph 3: File Handling ───────────────────────────────────────────────
  {
    const gid = 'typical-file-handling'
    const trigger = `${gid}-trigger`
    const optionNames = ['undofile', 'autoread', 'hidden']
    let builder = new GraphBuilder('File Handling', gid).startupTrigger(trigger)
    const actionIds: string[] = []
    for (let i = 0; i < optionNames.length; i++) {
      const aid = `${gid}-action-${i}`
      actionIds.push(aid)
      const name = optionNames[i]
      if (name === undefined) throw new Error('option name undefined')
      builder = builder.action(aid, 'set-option', setOptionConfig(name, true))
    }
    builder = builder.connectExec(trigger, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // ── Graph 4: UI Polish (startup + condition + true/false branches) ────────
  {
    const gid = 'typical-ui-polish'
    const trigger = `${gid}-trigger`
    const cond = `${gid}-cond`
    const trueAction = `${gid}-true`
    const falseAction = `${gid}-false`
    graphs.push(
      new GraphBuilder('UI Polish', gid)
        .startupTrigger(trigger)
        .condition(cond, '==', 'termguicolors_check', '1')
        .action(
          trueAction,
          'set-option',
          setOptionConfig('termguicolors', true),
        )
        .action(
          falseAction,
          'set-option',
          setOptionConfig('termguicolors', false),
        )
        .connectExec(trigger, cond)
        .connectTrue(cond, trueAction)
        .connectFalse(cond, falseAction)
        .build(),
    )
  }

  // ── Graph 5: Format on Save (startup + create-autocmd + callback) ────────
  {
    const gid = 'typical-format-on-save'
    const trigger = `${gid}-trigger`
    const autocmd = `${gid}-autocmd`
    const callback = `${gid}-callback`
    const autocmdConfig = {
      ...createDefaultActionConfig('create-autocmd'),
      events: ['BufWritePre'],
      patterns: ['*'],
      groupName: '',
      once: false,
      nested: false,
      callbackLua: '',
    }
    const callbackConfig = {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command' as const,
      actionType: 'command' as const,
      action: 'lua vim.lsp.buf.format()',
      selectedActionKey: '',
      paramValues: {},
    }
    graphs.push(
      new GraphBuilder('Format on Save', gid)
        .startupTrigger(trigger)
        .action(autocmd, 'create-autocmd', autocmdConfig)
        .action(callback, 'run-action', callbackConfig)
        .connect(autocmd, callback, 'on-event', 'exec')
        .connectExec(trigger, autocmd)
        .build(),
    )
  }

  // ── Graph 6: Keymaps (startup + 4 set-keymap actions) ────────────────────
  {
    const gid = 'typical-keymaps'
    const trigger = `${gid}-trigger`
    const keymapDefs = [
      { key: '<leader>w', cmd: ':w<cr>', desc: 'Save file' },
      { key: '<leader>q', cmd: ':q<cr>', desc: 'Quit' },
      { key: '<leader>/', cmd: ':nohlsearch<cr>', desc: 'Clear search' },
      { key: '<leader>e', cmd: ':Explore<cr>', desc: 'File explorer' },
    ]
    let builder = new GraphBuilder('Keymaps', gid).startupTrigger(trigger)
    const actionIds: string[] = []
    for (let i = 0; i < keymapDefs.length; i++) {
      const aid = `${gid}-km-${i}`
      actionIds.push(aid)
      const def = keymapDefs[i]
      if (def === undefined) throw new Error('keymap def undefined')
      const kmConfig = {
        ...createDefaultActionConfig('set-keymap'),
        modes: ['n' as const],
        keySequence: def.key,
        command: def.cmd,
        description: def.desc,
        silent: true,
        noremap: true,
        expr: false,
      }
      builder = builder.action(aid, 'set-keymap', kmConfig)
    }
    builder = builder.connectExec(trigger, actionIds[0] as string)
    for (let i = 0; i < actionIds.length - 1; i++) {
      builder = builder.connectExec(
        actionIds[i] as string,
        actionIds[i + 1] as string,
      )
    }
    graphs.push(builder.build())
  }

  // ── Graph 7: Greet Helper (callable) ─────────────────────────────────────
  {
    const gid = 'typical-greet-helper'
    const entry = `${gid}-entry`
    const action = `${gid}-action`
    const ret = `${gid}-return`
    const runConfig = {
      ...createDefaultActionConfig('run-action'),
      mode: 'custom-command' as const,
      actionType: 'command' as const,
      action: 'echo "Hello from Greet Helper"',
      selectedActionKey: '',
      paramValues: {},
    }
    graphs.push(
      new GraphBuilder('Greet Helper', gid)
        .callableEntry(entry, [createCallablePort('p1', 'Name', 'any')])
        .action(action, 'run-action', runConfig)
        .returnNode(ret, [createCallablePort('r1', 'Result', 'any')])
        .connectExec(entry, action)
        .connectExec(action, ret)
        .build(),
    )
  }

  // ── Graph 8: Startup Orchestrator (startup + graph-ref + set-option + set-keymap)
  {
    const gid = 'typical-startup-orchestrator'
    const trigger = `${gid}-trigger`
    const ref = `${gid}-ref-greet`
    const optAction = `${gid}-opt`
    const kmAction = `${gid}-km`
    const kmConfig = {
      ...createDefaultActionConfig('set-keymap'),
      modes: ['n' as const],
      keySequence: '<leader>h',
      command: ':echo "hi"<cr>',
      description: 'Hello keymap',
      silent: true,
      noremap: true,
      expr: false,
    }
    graphs.push(
      new GraphBuilder('Startup Orchestrator', gid)
        .startupTrigger(trigger)
        .graphRef(ref, 'typical-greet-helper')
        .action(optAction, 'set-option', setOptionConfig('showcmd', true))
        .action(kmAction, 'set-keymap', kmConfig)
        .connectExec(trigger, ref)
        .connectExec(ref, optAction)
        .connectExec(optAction, kmAction)
        .build(),
    )
  }

  return {
    graphs,
    expectedStartupCount: 7,
    expectedCallableCount: 1,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.12 — Deep nested conditions with both branches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single startup graph with `depth` nested conditions on the true path,
 * each condition having BOTH a true-branch action (chaining deeper) and a
 * false-branch action, terminating in a single action at the deepest true level.
 *
 * Structure:
 *   trigger
 *     → cond₀(true) → cond₁(true) → … → cond_{depth-1}(true) → terminal
 *       cond₀(false) → falseAction₀
 *       cond₁(false) → falseAction₁
 *       …
 *
 * Self-check:
 *   graph.nodes.length === 1 + depth + depth + depth + 1
 *               === 1 + 3*depth + 1   (trigger + conditions + true-actions* + false-actions + terminal)
 *   * Note: true-actions are the conditions themselves for depth > 1 (the true path IS the next cond).
 *     Corrected count: 1 trigger + depth conditions + depth false-actions + 1 terminal = 2 + 2*depth
 *
 * Actual node count:
 *   1 (trigger) + depth (conditions) + depth (false actions) + 1 (terminal) = 2 + 2*depth
 *
 * For depth=30: 62 nodes.
 *
 * @param depth Number of nested condition levels.
 */
export function buildDeepNestedConditionsWithBranches(depth: number): Graph {
  const graphId = 'perf-deep-branches'
  const triggerId = `${graphId}-trigger`
  const terminalId = `${graphId}-terminal`
  let builder = new GraphBuilder(graphId, graphId)
    .startupTrigger(triggerId)
    .action(terminalId, 'set-option', realBoolOptionConfig(0))

  const condIds: string[] = []
  const falseActionIds: string[] = []

  for (let i = 0; i < depth; i++) {
    const condId = `${graphId}-cond-${i}`
    const falseActionId = `${graphId}-false-${i}`
    condIds.push(condId)
    falseActionIds.push(falseActionId)
    builder = builder.condition(condId, '==', `branchVar${i}`, `${i}`)
    // Use rotating real option names for false-branch actions
    builder = builder.action(
      falseActionId,
      'set-option',
      realBoolOptionConfig(i + 1),
    )
  }

  // Wire: trigger → cond0
  builder = builder.connectExec(triggerId, condIds[0] as string)

  // Wire: cond(i).true → cond(i+1) for i < depth-1
  for (let i = 0; i < depth - 1; i++) {
    builder = builder.connectTrue(
      condIds[i] as string,
      condIds[i + 1] as string,
    )
  }

  // Wire: deepest condition true → terminal
  builder = builder.connectTrue(
    condIds[condIds.length - 1] as string,
    terminalId,
  )

  // Wire: each condition's false → its paired false-action
  for (let i = 0; i < depth; i++) {
    builder = builder.connectFalse(
      condIds[i] as string,
      falseActionIds[i] as string,
    )
  }

  return builder.build()
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture Self-Check Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** The set of exec port IDs the traversal recognises. */
const EXEC_PORT_IDS = new Set([
  'exec',
  'done',
  'true',
  'false',
  'loop',
  'on-event',
  'complete',
])

/**
 * Count exec-type edges in a graph (source port must be an exec port ID).
 */
export function countExecEdges(graph: Graph): number {
  return graph.edges.filter((e) => EXEC_PORT_IDS.has(e.sourcePort)).length
}

/**
 * Count exec-type edges across an array of graphs.
 */
export function countTotalExecEdges(graphs: readonly Graph[]): number {
  return graphs.reduce((sum, g) => sum + countExecEdges(g), 0)
}

/**
 * Count total nodes across an array of graphs.
 */
export function countTotalNodes(graphs: readonly Graph[]): number {
  return graphs.reduce((sum, g) => sum + g.nodes.length, 0)
}
