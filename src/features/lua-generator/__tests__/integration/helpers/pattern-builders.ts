/**
 * Graph shape builders for integration tests.
 *
 * Provides composable, deterministic builders for common connection patterns.
 * All IDs are stable and explicit to support order-sensitive assertions.
 */

import {
  createCallablePort,
  GraphBuilder,
} from '@/features/lua-generator/__tests__/utils/graph-builder'
import type { Graph } from '@/shared/types'
import { createDefaultActionConfig } from '@/shared/types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Produce a minimal set-option action config for the given option + value. */
function setOptionConfig(optionName: string, value: boolean | number = true) {
  return {
    ...createDefaultActionConfig('set-option'),
    optionName,
    scope: 'global' as const,
    valueConfig: { valueMode: 'suggested' as const, suggestedValue: value },
  }
}

/** Produce a minimal run-action (command) config. */
function runCommandConfig(command: string) {
  return {
    ...createDefaultActionConfig('run-action'),
    mode: 'custom-command' as const,
    actionType: 'command' as const,
    action: command,
    selectedActionKey: '',
    paramValues: {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Linear Chain Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearStartupChainOptions {
  /** Graph identifier — must be unique across the test suite run. */
  graphId: string
  /** Number of action nodes to chain after the startup trigger. */
  length: number
  /**
   * Optional per-node factory. Receives 1-based index and returns an action
   * config.  Defaults to set-option on "number<i>".
   */
  nodeFactory?: (index: number) => {
    actionType: Parameters<typeof setOptionConfig>[0]
    config:
      | ReturnType<typeof setOptionConfig>
      | ReturnType<typeof runCommandConfig>
    id?: string
  }
}

/** Return type for builders that expose intermediate node IDs */
export interface LinearChainIds {
  triggerId: string
  actionIds: string[]
}

/**
 * Build a startup graph: Startup → A₁ → A₂ → … → Aₙ
 */
export function buildLinearStartupChain(options: LinearStartupChainOptions): {
  graph: Graph
  ids: LinearChainIds
} {
  const { graphId, length, nodeFactory } = options
  const triggerId = `${graphId}-trigger`
  const actionIds: string[] = []

  let builder = new GraphBuilder(graphId, graphId).startupTrigger(triggerId)

  for (let i = 1; i <= length; i++) {
    const nodeId = `${graphId}-action-${i}`
    actionIds.push(nodeId)

    let config:
      | ReturnType<typeof setOptionConfig>
      | ReturnType<typeof runCommandConfig>
    let actionTypeName: Parameters<typeof builder.action>[1] = 'set-option'

    if (nodeFactory) {
      const spec = nodeFactory(i)
      config = spec.config
      actionTypeName = spec.actionType as Parameters<typeof builder.action>[1]
    } else {
      config = setOptionConfig(`opt${i}`, true)
    }

    builder = builder.action(nodeId, actionTypeName, config)
  }

  // Wire: trigger → a1 → a2 → … → aN
  builder = builder.connectExec(triggerId, actionIds[0] as string)
  for (let i = 0; i < actionIds.length - 1; i++) {
    builder = builder.connectExec(
      actionIds[i] as string,
      actionIds[i + 1] as string,
    )
  }

  return { graph: builder.build(), ids: { triggerId, actionIds } }
}

export interface LinearCallableChainOptions {
  graphId: string
  /**
   * Intermediate action nodes (length > 0 recommended).
   * Defaults to a single set-option node.
   */
  length?: number
}

export interface CallableChainIds {
  entryId: string
  actionIds: string[]
  returnId: string
}

/**
 * Build a callable graph: CallableEntry → A₁ → … → Aₙ → Return
 */
export function buildLinearCallableChain(options: LinearCallableChainOptions): {
  graph: Graph
  ids: CallableChainIds
} {
  const { graphId, length = 1 } = options
  const entryId = `${graphId}-entry`
  const returnId = `${graphId}-return`
  const actionIds: string[] = []

  let builder = new GraphBuilder(graphId, graphId).callableEntry(entryId, [
    createCallablePort('p1', 'Param1', 'any'),
  ])

  for (let i = 1; i <= length; i++) {
    const nodeId = `${graphId}-action-${i}`
    actionIds.push(nodeId)
    builder = builder.action(nodeId, 'set-option', setOptionConfig(`opt${i}`))
  }

  builder = builder.returnNode(returnId, [
    createCallablePort('r1', 'Result', 'any'),
  ])

  // Wire entry → a1 → … → aN → return
  builder = builder.connectExec(entryId, actionIds[0] as string)
  for (let i = 0; i < actionIds.length - 1; i++) {
    builder = builder.connectExec(
      actionIds[i] as string,
      actionIds[i + 1] as string,
    )
  }
  builder = builder.connectExec(
    actionIds[actionIds.length - 1] as string,
    returnId,
  )

  return { graph: builder.build(), ids: { entryId, actionIds, returnId } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Branching / Merging Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface ConditionDiamondOptions {
  graphId: string
  operator?: import('@/shared/types').ConditionOperator
  operandA?: string
  operandB?: string
  /** If true, include a post-merge continuation action node */
  withMerge?: boolean
  /** If true, only wire the false branch (no true branch) */
  falseOnly?: boolean
  /** If true, only wire the true branch (no false branch) */
  trueOnly?: boolean
  /** Number of nodes to put in the true branch (default 1) */
  trueBranchLength?: number
  /** Number of nodes to put in the false branch (default 1) */
  falseBranchLength?: number
}

export interface ConditionDiamondIds {
  triggerId: string
  conditionId: string
  trueIds: string[]
  falseIds: string[]
  mergeId: string | null
}

/**
 * Build a startup graph with a condition node.
 *
 * Wiring depends on options:
 * - trueOnly:  Startup → Cond →(true)→ TrueAction
 * - falseOnly: Startup → Cond →(false)→ FalseAction
 * - default:   Startup → Cond →(true)→ TA; Cond →(false)→ FA
 * - withMerge: adds a MergeAction that both branches converge on, then a final
 *              continuation is attached to the condition's exec (continuation) port
 */
export function buildConditionDiamond(options: ConditionDiamondOptions): {
  graph: Graph
  ids: ConditionDiamondIds
} {
  const {
    graphId,
    operator = '==',
    operandA = 'x',
    operandB = '1',
    withMerge = false,
    falseOnly = false,
    trueOnly = false,
    trueBranchLength = 1,
    falseBranchLength = 1,
  } = options

  const triggerId = `${graphId}-trigger`
  const conditionId = `${graphId}-cond`
  const mergeId = withMerge ? `${graphId}-merge` : null

  let builder = new GraphBuilder(graphId, graphId)
    .startupTrigger(triggerId)
    .condition(conditionId, operator, operandA, operandB)

  // Build true branch
  const trueIds: string[] = []
  if (!falseOnly) {
    for (let i = 1; i <= trueBranchLength; i++) {
      const id = `${graphId}-true-${i}`
      trueIds.push(id)
      builder = builder.action(
        id,
        'run-action',
        runCommandConfig(`echo true_${i}`),
      )
    }
  }

  // Build false branch
  const falseIds: string[] = []
  if (!trueOnly) {
    for (let i = 1; i <= falseBranchLength; i++) {
      const id = `${graphId}-false-${i}`
      falseIds.push(id)
      builder = builder.action(
        id,
        'run-action',
        runCommandConfig(`echo false_${i}`),
      )
    }
  }

  // Merge action
  if (withMerge && mergeId !== null) {
    builder = builder.action(
      mergeId,
      'set-option',
      setOptionConfig('merge_opt'),
    )
  }

  // Wire exec flow: trigger → condition
  builder = builder.connectExec(triggerId, conditionId)

  // Wire branches
  if (trueIds.length > 0) {
    builder = builder.connectTrue(conditionId, trueIds[0] as string)
    for (let i = 0; i < trueIds.length - 1; i++) {
      builder = builder.connectExec(
        trueIds[i] as string,
        trueIds[i + 1] as string,
      )
    }
  }

  if (falseIds.length > 0) {
    builder = builder.connectFalse(conditionId, falseIds[0] as string)
    for (let i = 0; i < falseIds.length - 1; i++) {
      builder = builder.connectExec(
        falseIds[i] as string,
        falseIds[i + 1] as string,
      )
    }
  }

  // Wire merge: both last nodes in each branch → merge node
  if (withMerge && mergeId !== null) {
    const lastTrue = trueIds[trueIds.length - 1]
    const lastFalse = falseIds[falseIds.length - 1]
    if (lastTrue !== undefined) {
      builder = builder.connectExec(lastTrue, mergeId)
    }
    if (lastFalse !== undefined) {
      builder = builder.connectExec(lastFalse, mergeId)
    }
  }

  return {
    graph: builder.build(),
    ids: { triggerId, conditionId, trueIds, falseIds, mergeId },
  }
}

export interface NestedConditionOptions {
  graphId: string
  /** Number of nesting levels (2 or 3) */
  levels: 2 | 3
}

export interface NestedConditionIds {
  triggerId: string
  outerCondId: string
  innerCondId: string
  deepestCondId: string | null
  leafIds: string[]
}

/**
 * Build a graph with nested conditions.
 *
 * Level 2: Startup → OuterCond →(true)→ InnerCond →(true)→ Leaf1
 *                                                  →(false)→ Leaf2
 *
 * Level 3: adds another condition inside InnerCond's true branch.
 */
export function buildNestedConditions(options: NestedConditionOptions): {
  graph: Graph
  ids: NestedConditionIds
} {
  const { graphId, levels } = options

  const triggerId = `${graphId}-trigger`
  const outerCondId = `${graphId}-outer-cond`
  const innerCondId = `${graphId}-inner-cond`
  const deepestCondId = levels === 3 ? `${graphId}-deep-cond` : null

  let builder = new GraphBuilder(graphId, graphId)
    .startupTrigger(triggerId)
    .condition(outerCondId, '>', 'a', '0')
    .condition(innerCondId, '==', 'b', '1')

  const leafIds: string[] = []

  if (levels === 2) {
    const l1 = `${graphId}-leaf-1`
    const l2 = `${graphId}-leaf-2`
    leafIds.push(l1, l2)
    builder = builder
      .action(l1, 'run-action', runCommandConfig('echo leaf1'))
      .action(l2, 'run-action', runCommandConfig('echo leaf2'))
      // Wire
      .connectExec(triggerId, outerCondId)
      .connectTrue(outerCondId, innerCondId)
      .connectTrue(innerCondId, l1)
      .connectFalse(innerCondId, l2)
  } else {
    // 3 levels
    const deepCond = deepestCondId as string
    builder = builder.condition(deepCond, '<', 'c', '5')
    const l1 = `${graphId}-leaf-1`
    const l2 = `${graphId}-leaf-2`
    const l3 = `${graphId}-leaf-3`
    leafIds.push(l1, l2, l3)
    builder = builder
      .action(l1, 'run-action', runCommandConfig('echo leaf1'))
      .action(l2, 'run-action', runCommandConfig('echo leaf2'))
      .action(l3, 'run-action', runCommandConfig('echo leaf3'))
      // Wire outer → inner → deep
      .connectExec(triggerId, outerCondId)
      .connectTrue(outerCondId, innerCondId)
      .connectTrue(innerCondId, deepCond)
      .connectTrue(deepCond, l1)
      .connectFalse(deepCond, l2)
      .connectFalse(innerCondId, l3)
  }

  return {
    graph: builder.build(),
    ids: {
      triggerId,
      outerCondId,
      innerCondId,
      deepestCondId,
      leafIds,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Loop Builders
// ─────────────────────────────────────────────────────────────────────────────

export interface LoopWithBodyOptions {
  graphId: string
  loopType: 'for' | 'while' | 'each'
  iteratorVariable: string
  iterableExpression: string
  /** Number of action nodes in the loop body */
  bodyLength?: number
  /**
   * If true, add a done-port continuation node after the loop using
   * `connectLoopComplete` (sourcePort = 'done').
   */
  withDoneContinuation?: boolean
  /**
   * If true, add a complete-port continuation node after the loop using
   * raw `connect(loopId, id, 'complete', 'exec')` (sourcePort = 'complete').
   * Exercises the alternative alias path in exec-traversal.ts:288.
   */
  withCompleteContinuation?: boolean
}

export interface LoopIds {
  triggerId: string
  loopId: string
  bodyIds: string[]
  doneId: string | null
}

/**
 * Build a startup graph with a loop node.
 *
 * Wiring: Startup → Loop →(loop)→ Body₁ → … → Bodyₙ
 *                        →(done/complete)→ AfterLoop  [if continuation requested]
 */
export function buildLoopWithBody(options: LoopWithBodyOptions): {
  graph: Graph
  ids: LoopIds
} {
  const {
    graphId,
    loopType,
    iteratorVariable,
    iterableExpression,
    bodyLength = 1,
    withDoneContinuation = false,
    withCompleteContinuation = false,
  } = options

  const triggerId = `${graphId}-trigger`
  const loopId = `${graphId}-loop`
  const bodyIds: string[] = []
  const doneId =
    withDoneContinuation || withCompleteContinuation ? `${graphId}-after` : null

  let builder = new GraphBuilder(graphId, graphId)
    .startupTrigger(triggerId)
    .loop(loopId, loopType, iteratorVariable, iterableExpression)

  // Build body nodes
  for (let i = 1; i <= bodyLength; i++) {
    const id = `${graphId}-body-${i}`
    bodyIds.push(id)
    builder = builder.action(id, 'set-option', setOptionConfig(`body_opt${i}`))
  }

  // Add done/complete continuation
  if (doneId !== null) {
    builder = builder.action(
      doneId,
      'set-option',
      setOptionConfig('after_loop_opt'),
    )
  }

  // Wire: trigger → loop
  builder = builder.connectExec(triggerId, loopId)

  // Wire: loop →(loop body)→ body nodes
  builder = builder.connectLoopBody(loopId, bodyIds[0] as string)
  for (let i = 0; i < bodyIds.length - 1; i++) {
    builder = builder.connectExec(
      bodyIds[i] as string,
      bodyIds[i + 1] as string,
    )
  }

  // Wire continuation
  if (doneId !== null) {
    if (withCompleteContinuation) {
      // Raw connect using 'complete' port (exercises alias path in exec-traversal.ts:288)
      builder = builder.connect(loopId, doneId, 'complete', 'exec')
    } else {
      // Standard done port (via connectLoopComplete → sourcePort = 'done')
      builder = builder.connectLoopComplete(loopId, doneId)
    }
  }

  return { graph: builder.build(), ids: { triggerId, loopId, bodyIds, doneId } }
}
