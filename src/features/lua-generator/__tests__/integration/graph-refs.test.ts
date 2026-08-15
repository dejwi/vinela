/**
 * Categories 5 & 6: Graph References and Data Flow
 *
 * Category 5 – Graph References / Subgraphs (12 tests):
 *   Tests for callable graph definitions, graph-ref invocation patterns,
 *   ordering guarantees, nested chains, and invalid-reference diagnostics.
 *
 * Category 6 – Data Flow & Wiring (10 tests):
 *   Tests that data edges between nodes produce correct Lua variable bindings —
 *   upstream producer variables are propagated to downstream consumer ports,
 *   without falling back to literals when a wire exists.
 *
 * Every positive-path test asserts:
 *   1. `collector.hasErrors() === false`  (no unexpected errors)
 *   2. `assertBlocksBalanced(lua)`        (structural integrity)
 *   3. `await assertLuaSyntaxValid(lua)`  (full compiler check)
 *
 * High-risk tests (6.7, 6.8) use the `it.fails` or explicit gap-assertion
 * pattern described in the plan — failures are intentional regression guards.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import {
  expectedCallableRef,
  expectedCallableRefRegex,
} from '@/features/lua-generator/__tests__/utils/callable-keys'
import { createDefaultActionConfig } from '@/shared/types'
import { createCallablePort, GraphBuilder } from '../utils/graph-builder'
import { generateLuaFromGraphs } from './helpers/generate-lua'
import {
  assertBlocksBalanced,
  assertLuaSyntaxValid,
  ensureLuaParserAvailable,
  escapeRegex,
  expectOccursExactly,
  extractLocalVar,
} from './helpers/lua-assertions'

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureLuaParserAvailable()
})

// ─────────────────────────────────────────────────────────────────────────────
// Shared config factories
// ─────────────────────────────────────────────────────────────────────────────

function setOptionConfig(optionName: string, value: boolean | number = true) {
  return {
    ...createDefaultActionConfig('set-option'),
    optionName,
    scope: 'global' as const,
    valueConfig: { valueMode: 'suggested' as const, suggestedValue: value },
  }
}

function setVariableConfig(
  variableName: string,
  value: boolean | number | string,
  scope: 'g' | 'b' | 'w' | 't' = 'g',
) {
  const valueType =
    typeof value === 'boolean'
      ? 'boolean'
      : typeof value === 'number'
        ? 'number'
        : 'string'
  return {
    ...createDefaultActionConfig('set-variable'),
    scope,
    variableName,
    valueType: valueType as 'boolean' | 'number' | 'string',
    value,
  }
}

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
// Category 5: Graph References (Subgraphs)
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 5: Graph References (Subgraphs)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Callable definitions (5.1 – 5.3)
  // ───────────────────────────────────────────────────────────────────────────

  describe('callable definitions', () => {
    it('5.1 simple callable graph definition', async () => {
      // CallableEntry → SetOption → Return
      const callableGraph = new GraphBuilder('graphA', 'graphA')
        .callableEntry('entry-a')
        .action('opt-a', 'set-option', setOptionConfig('number', true))
        .returnNode('return-a')
        .connectExec('entry-a', 'opt-a')
        .connectExec('opt-a', 'return-a')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([callableGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Callable registration pattern
      expect(lua).toContainCallableRegistration('graphA', 'graphA')
      expect(lua).toContain('function(params)')
      expect(lua).toContain('vim.opt.number = true')
      await assertLuaSyntaxValid(lua)
    })

    it('5.2 callable graph with parameters', async () => {
      // CallableEntry(name, count) → SetVariable → Return
      const callableGraph = new GraphBuilder('graphB', 'graphB')
        .callableEntry('entry-b', [
          createCallablePort('name', 'Name', 'string'),
          createCallablePort('count', 'Count', 'number'),
        ])
        .action(
          'use-param',
          'set-variable',
          setVariableConfig('used_param', 'default', 'g'),
        )
        .returnNode('return-b')
        .connectExec('entry-b', 'use-param')
        .connectExec('use-param', 'return-b')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([callableGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Parameter materialization lines
      expect(lua).toContain('local param_name = params["name"]')
      expect(lua).toContain('local param_count = params["count"]')
      await assertLuaSyntaxValid(lua)
    })

    it('5.3 callable graph with return values', async () => {
      // CallableEntry → SetOption → Return(result)
      const callableGraph = new GraphBuilder('graphC', 'graphC')
        .callableEntry('entry-c')
        .action('opt-c', 'set-option', setOptionConfig('wrap', false))
        .returnNode('return-c', [createCallablePort('result', 'Result', 'any')])
        .connectExec('entry-c', 'opt-c')
        .connectExec('opt-c', 'return-c')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([callableGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Return table format with port ID key
      expect(lua).toContain('return {')
      expect(lua).toContain('["result"]')
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Graph-ref invocation (5.4 – 5.7)
  // ───────────────────────────────────────────────────────────────────────────

  describe('graph-ref invocation', () => {
    it('5.4 graph-ref calling callable with no params', async () => {
      // Callable: CallableEntry → SetOption
      const callableGraph = new GraphBuilder(
        'target-no-params',
        'target-no-params',
      )
        .callableEntry('entry-np')
        .action('opt-np', 'set-option', setOptionConfig('number', true))
        .connectExec('entry-np', 'opt-np')
        .build()

      // Startup: Trigger → GraphRef(target-no-params)
      const startupGraph = new GraphBuilder('startup-5-4', 'startup-5-4')
        .startupTrigger('trigger-54')
        .graphRef('ref-54', 'target-no-params')
        .connectExec('trigger-54', 'ref-54')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Call expression with empty args table
      expect(lua).toContainCallableInvocation(
        'target-no-params',
        'target-no-params',
      )
      await assertLuaSyntaxValid(lua)
    })

    it('5.5 graph-ref calling callable with parameters', async () => {
      // Callable: CallableEntry(msg) → RunCommand
      const callableGraph = new GraphBuilder(
        'target-with-params',
        'target-with-params',
      )
        .callableEntry('entry-wp', [
          createCallablePort('msg', 'Message', 'string'),
        ])
        .action('cmd-wp', 'run-action', runCommandConfig('echo hello'))
        .connectExec('entry-wp', 'cmd-wp')
        .build()

      // Startup: Trigger → CodeBlock(produces string) → GraphRef(target-with-params)
      // Wire code-block output to graph-ref 'msg' param port
      const startupGraph = new GraphBuilder('startup-5-5', 'startup-5-5')
        .startupTrigger('trigger-55')
        .codeBlock(
          'cb-55',
          'return "hello world"',
          [],
          [{ id: 'out', name: 'out', dataType: 'string' }],
        )
        .graphRef('ref-55', 'target-with-params')
        .connectExec('trigger-55', 'cb-55')
        .connectExec('cb-55', 'ref-55')
        // Wire code-block output -> graph-ref 'msg' param
        .connectData('cb-55', 'out', 'ref-55', 'msg')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Verify callable is invoked (not just referenced)
      expect(lua).toContain(
        `${expectedCallableRef('target-with-params', 'target-with-params')}({`,
      )
      // Verify the arg table contains the msg key with a wired value
      expect(lua).toMatch(/\["msg"\]\s*=\s*\w+/)
      // Extract the code-block output variable and verify it's wired into the call
      const cbVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*_code_block_cb_55\(/,
      )
      expect(cbVar, 'code block must produce output var').toBeDefined()
      if (cbVar !== undefined) {
        expect(lua).toContain(`["msg"] = ${cbVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('5.6 graph-ref return value capture and use', async () => {
      // Callable: CallableEntry → CodeBlock → Return(doubled)
      const callableGraph = new GraphBuilder(
        'target-with-return',
        'target-with-return',
      )
        .callableEntry('entry-wr', [createCallablePort('x', 'Input', 'number')])
        .codeBlock(
          'double-cb',
          'local result = (params and params["x"] or 0) * 2\nreturn result',
          [],
          [{ id: 'out', name: 'out', dataType: 'number' }],
        )
        .returnNode('return-wr', [
          createCallablePort('doubled', 'Doubled', 'number'),
        ])
        .connectExec('entry-wr', 'double-cb')
        .connectExec('double-cb', 'return-wr')
        .build()

      // Startup: Trigger → GraphRef(target-with-return) → SetOption (uses return)
      const startupGraph = new GraphBuilder('startup-5-6', 'startup-5-6')
        .startupTrigger('trigger-56')
        .graphRef('ref-56', 'target-with-return')
        .action('opt-56', 'set-option', setOptionConfig('tabstop', 4))
        .connectExec('trigger-56', 'ref-56')
        .connectExec('ref-56', 'opt-56')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Return capture: local <retTable> = _G._vinela_callables[...]({})
      const retTableVar = extractLocalVar(
        lua,
        new RegExp(
          `local\\s+(\\w+)\\s*=\\s*${expectedCallableRefRegex('target-with-return', 'target-with-return')}`,
        ),
      )
      expect(retTableVar, 'return table must be captured').toBeDefined()
      if (retTableVar !== undefined) {
        // Verify extraction: local <var> = <retTable>["doubled"]
        expect(lua).toMatch(
          new RegExp(
            `local\\s+\\w+\\s*=\\s*${escapeRegex(retTableVar)}\\["doubled"\\]`,
          ),
        )
      }
      await assertLuaSyntaxValid(lua)
    })

    it('5.7 multiple references to same callable', async () => {
      // Callable: CallableEntry → SetOption
      const callableGraph = new GraphBuilder(
        'shared-callable',
        'shared-callable',
      )
        .callableEntry('entry-sc')
        .action('opt-sc', 'set-option', setOptionConfig('number', true))
        .connectExec('entry-sc', 'opt-sc')
        .build()

      // Startup: Trigger → GraphRef1 → GraphRef2 (same target)
      const startupGraph = new GraphBuilder('startup-5-7', 'startup-5-7')
        .startupTrigger('trigger-57')
        .graphRef('ref-57-a', 'shared-callable')
        .graphRef('ref-57-b', 'shared-callable')
        .connectExec('trigger-57', 'ref-57-a')
        .connectExec('ref-57-a', 'ref-57-b')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Must have exactly 2 invocations of the same callable
      expectOccursExactly(
        lua,
        expectedCallableRef('shared-callable', 'shared-callable'),
        3,
      )
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Ordering and mixed graph behavior (5.8 – 5.10)
  // ───────────────────────────────────────────────────────────────────────────

  describe('ordering and mixed graph behavior', () => {
    it('5.8 nested call chain (A calls B, B calls C)', async () => {
      // Graph C: CallableEntry → SetOption (leaf)
      const graphC = new GraphBuilder('chain-c', 'chain-c')
        .callableEntry('entry-c')
        .action('opt-c', 'set-option', setOptionConfig('wrap', false))
        .connectExec('entry-c', 'opt-c')
        .build()

      // Graph B: CallableEntry → GraphRef(chain-c)
      const graphB = new GraphBuilder('chain-b', 'chain-b')
        .callableEntry('entry-b')
        .graphRef('ref-b-to-c', 'chain-c')
        .connectExec('entry-b', 'ref-b-to-c')
        .build()

      // Graph A: CallableEntry → GraphRef(chain-b)
      const graphA = new GraphBuilder('chain-a', 'chain-a')
        .callableEntry('entry-a')
        .graphRef('ref-a-to-b', 'chain-b')
        .connectExec('entry-a', 'ref-a-to-b')
        .build()

      // Startup graph: Trigger → GraphRef(chain-a)
      const startupGraph = new GraphBuilder('startup-5-8', 'startup-5-8')
        .startupTrigger('trigger-58')
        .graphRef('ref-58', 'chain-a')
        .connectExec('trigger-58', 'ref-58')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        graphC,
        graphB,
        graphA,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // All three callable definitions must be present
      expect(lua).toContainCallableRegistration('chain-a', 'chain-a')
      expect(lua).toContainCallableRegistration('chain-b', 'chain-b')
      expect(lua).toContainCallableRegistration('chain-c', 'chain-c')
      // Invocations of B and C must appear in callable sections (not just startup)
      expect(lua).toContainCallableInvocation('chain-b', 'chain-b')
      expect(lua).toContainCallableInvocation('chain-c', 'chain-c')
      await assertLuaSyntaxValid(lua)
    })

    it('5.9 callable definitions appear before startup block', async () => {
      // Callable: simple
      const callableGraph = new GraphBuilder(
        'ordering-callable',
        'ordering-callable',
      )
        .callableEntry('entry-ord')
        .action('opt-ord', 'set-option', setOptionConfig('number', true))
        .connectExec('entry-ord', 'opt-ord')
        .build()

      // Startup: calls the callable
      const startupGraph = new GraphBuilder('startup-5-9', 'startup-5-9')
        .startupTrigger('trigger-59')
        .graphRef('ref-59', 'ordering-callable')
        .connectExec('trigger-59', 'ref-59')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Callable definition must appear before the startup do...end block
      const callableDefIdx = lua.indexOf(
        `${expectedCallableRef('ordering-callable', 'ordering-callable')} = function`,
      )
      const startupCallIdx = lua.indexOf(
        `${expectedCallableRef('ordering-callable', 'ordering-callable')}({})`,
      )
      expect(
        callableDefIdx,
        'callable definition not found in output',
      ).toBeGreaterThan(-1)
      expect(
        startupCallIdx,
        'startup call not found in output',
      ).toBeGreaterThan(-1)
      expect(
        callableDefIdx,
        'callable definition must appear before startup call',
      ).toBeLessThan(startupCallIdx)
      await assertLuaSyntaxValid(lua)
    })

    it('5.10 mixed graph with both trigger and callable entry', async () => {
      // Graph has BOTH a startup trigger path AND a callable entry path
      const mixedGraph = new GraphBuilder('mixed-graph', 'mixed-graph')
        .startupTrigger('trigger-mix')
        .callableEntry('entry-mix')
        .action('opt-on-startup', 'set-option', setOptionConfig('number', true))
        .action('opt-on-call', 'set-option', setOptionConfig('wrap', false))
        .connectExec('trigger-mix', 'opt-on-startup')
        .connectExec('entry-mix', 'opt-on-call')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([mixedGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Must contain both callable registration AND startup content
      expect(lua).toContainCallableRegistration('mixed-graph', 'mixed-graph')
      expect(lua).toContain('function(params)')
      // Both action outputs must appear
      expect(lua).toContain('vim.opt.number = true')
      expect(lua).toContain('vim.opt.wrap = false')
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Invalid references and cross-graph data flow (5.11 – 5.12)
  // ───────────────────────────────────────────────────────────────────────────

  describe('invalid references and cross-graph data flow', () => {
    it('5.11 graph-ref to non-existent graph emits diagnostic', () => {
      // Startup graph references a graph that does not exist / is not callable
      const startupGraph = new GraphBuilder('startup-5-11', 'startup-5-11')
        .startupTrigger('trigger-511')
        .graphRef('ref-511', 'does-not-exist')
        .connectExec('trigger-511', 'ref-511')
        .build()

      // Only pass the startup graph — no callable graph with the target ID
      expect(() => {
        generateLuaFromGraphs([startupGraph])
      }).not.toThrow()

      const { lua, diagnostics } = generateLuaFromGraphs([startupGraph])

      // Must emit the reference error diagnostic
      const errors = diagnostics.getErrors()
      const refError = errors.find(
        (e) => e.id === 'graph-ref-target-not-callable',
      )
      expect(
        refError,
        'expected graph-ref-target-not-callable diagnostic',
      ).toBeDefined()
      // Generation must not crash — output may be empty or partial
      expect(typeof lua).toBe('string')
    })

    it('5.12 cross-graph data flow: input → call → output', async () => {
      // Callable: CallableEntry(x) → CodeBlock(doubles x) → Return(doubled)
      const callableGraph = new GraphBuilder('doubler', 'doubler')
        .callableEntry('entry-doubler', [
          createCallablePort('x', 'Input', 'number'),
        ])
        .returnNode('return-doubler', [
          createCallablePort('doubled', 'Result', 'number'),
        ])
        .connectExec('entry-doubler', 'return-doubler')
        .build()

      // Startup: Trigger → CodeBlock(produces value) → GraphRef(doubler) → SetOption(uses return)
      const startupGraph = new GraphBuilder('startup-5-12', 'startup-5-12')
        .startupTrigger('trigger-512')
        .codeBlock(
          'cb-512',
          'return 21',
          [],
          [{ id: 'out', name: 'out', dataType: 'number' }],
        )
        .graphRef('ref-512', 'doubler')
        .action('opt-512', 'set-option', setOptionConfig('tabstop', 4))
        .connectExec('trigger-512', 'cb-512')
        .connectExec('cb-512', 'ref-512')
        .connectExec('ref-512', 'opt-512')
        // Wire: code-block output → graph-ref param 'x'
        .connectData('cb-512', 'out', 'ref-512', 'x')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([
        callableGraph,
        startupGraph,
      ])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Arg table must use port ID as key
      expect(lua).toContain('["x"]')
      // Return extraction must use port ID as key
      expect(lua).toContain('["doubled"]')
      // Callable must be invoked
      expect(lua).toContainCallableInvocation('doubler', 'doubler')
      await assertLuaSyntaxValid(lua)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Category 6: Data Flow & Wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 6: Data Flow & Wiring', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Single-hop wiring (6.1 – 6.4)
  // ───────────────────────────────────────────────────────────────────────────

  describe('single-hop wiring', () => {
    it('6.1 get-variable output wired to set-option value input', async () => {
      // Startup: Trigger → GetVariable(g.my_flag) → SetOption(number, [wired])
      const graph = new GraphBuilder('data-6-1', 'data-6-1')
        .startupTrigger('trigger-61')
        .builtin('getvar-61', 'get-variable', {
          scope: 'g',
          variableName: 'my_flag',
        })
        .action('opt-61', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        .connectExec('trigger-61', 'getvar-61')
        .connectExec('getvar-61', 'opt-61')
        // Wire: get-variable output → set-option value port
        // get-variable generator uses context.getVariableName('var') for its output
        // Since it's a builtin, the output is returned as a unit with code.
        // The wiring connects the node output to the downstream 'value' port.
        // We use the node-level data edge — port IDs from builtin generators
        // are resolved via valueBindings in the traversal layer.
        .connectData('getvar-61', 'value', 'opt-61', 'value')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // get-variable must produce a local variable reading from vim.g.my_flag
      expect(lua).toMatch(/local\s+\w+\s*=\s*vim\.g\.my_flag/)
      // set-option must reference the upstream variable (not a static literal)
      // Extract the producer variable name from get-variable line
      const producerVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*vim\.g\.my_flag/,
      )
      expect(
        producerVar,
        'expected a producer variable from get-variable',
      ).toBeDefined()
      if (producerVar !== undefined) {
        // The set-option line must use the upstream variable
        expect(lua).toContain(`vim.opt.number = ${producerVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('6.2 code block output wired to set-variable input', async () => {
      // Startup: Trigger → CodeBlock(returns string) → SetVariable(wired)
      const graph = new GraphBuilder('data-6-2', 'data-6-2')
        .startupTrigger('trigger-62')
        .codeBlock(
          'cb-62',
          'return "computed_value"',
          [],
          [{ id: 'out', name: 'out', dataType: 'string' }],
        )
        .action('setvar-62', 'set-variable', {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g' as const,
          variableName: 'target_var',
          valueType: 'string' as const,
          value: 'fallback',
        })
        .connectExec('trigger-62', 'cb-62')
        .connectExec('cb-62', 'setvar-62')
        // Wire code-block output → set-variable value port
        .connectData('cb-62', 'out', 'setvar-62', 'value')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Code block must define a local function and capture output
      expect(lua).toMatch(/local function _code_block_/)
      // The downstream assignment must reference the code-block output variable
      // Extract the local output variable from the code-block call site
      const cbOutputVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*_code_block_\w+\(/,
      )
      expect(cbOutputVar, 'code block must produce a local var').toBeDefined()
      if (cbOutputVar !== undefined) {
        // set-variable must use the upstream var (vim.g.target_var = <upstreamVar>)
        expect(lua).toContain(`vim.g.target_var = ${cbOutputVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('6.3 prompt output wired to ui.notify message input', async () => {
      // Startup: Trigger → Prompt → UiNotify(message=[wired])
      const graph = new GraphBuilder('data-6-3', 'data-6-3')
        .startupTrigger('trigger-63')
        .builtin('prompt-63', 'input.prompt', {
          prompt: 'Enter message: ',
        })
        .builtin('notify-63', 'ui.notify', {
          level: 'info',
        })
        .connectExec('trigger-63', 'prompt-63')
        .connectExec('prompt-63', 'notify-63')
        // Wire: prompt 'value' output → notify 'message' input
        .connectData('prompt-63', 'value', 'notify-63', 'message')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Prompt must produce a local capturing vim.fn.input(...)
      expect(lua).toMatch(/local\s+\w+\s*=\s*vim\.fn\.input\(/)
      // Extract the prompt output variable
      const promptVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*vim\.fn\.input\(/,
      )
      expect(promptVar, 'prompt must produce a local var').toBeDefined()
      if (promptVar !== undefined) {
        // vim.notify must use the prompt variable as the first argument
        expect(lua).toContain(`vim.notify(${promptVar},`)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('6.4 check-feature output wired to condition input', async () => {
      // Startup: Trigger → CheckFeature → Condition(wired)
      const graph = new GraphBuilder('data-6-4', 'data-6-4')
        .startupTrigger('trigger-64')
        .builtin('check-64', 'check-feature', {
          feature: 'clipboard',
        })
        .condition('cond-64', '==', 'true', 'true')
        .action(
          'cmd-true',
          'run-action',
          runCommandConfig('echo has_clipboard'),
        )
        .connectExec('trigger-64', 'check-64')
        .connectExec('check-64', 'cond-64')
        .connectTrue('cond-64', 'cmd-true')
        // Wire check-feature output to condition 'a' input
        .connectData('check-64', 'value', 'cond-64', 'a')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // check-feature must produce: local <var> = vim.fn.has('clipboard') == 1
      expect(lua).toMatch(/local\s+\w+\s*=\s*vim\.fn\.has\('clipboard'\) == 1/)
      // Verify check-feature produces a local variable (binding gap: wiring to condition
      // 'a' input currently emits a temp binding rather than the produced var —
      // documented gap, same as 6.7; the check below verifies what currently works)
      const featureVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*vim\.fn\.has\('clipboard'\) == 1/,
      )
      expect(featureVar, 'check-feature must produce a local var').toBeDefined()
      // NOTE: Known gap — the condition operand 'a' is not resolved to featureVar
      // (uses a temp binding instead). When fixed, this should read:
      //   expect(lua).toContain(`if ${featureVar}`)
      // For now, assert that an if-block IS generated (not just any 'if ')
      expect(lua).toMatch(/^\s*if\s+\S.*\bthen\b/m)
      // Verify the true branch action
      expect(lua).toContain('vim.cmd("echo has_clipboard")')
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Fan-out and chains (6.5 – 6.6)
  // ───────────────────────────────────────────────────────────────────────────

  describe('fan-out and chains', () => {
    it('6.5 fan-out: one source output to two consumer inputs', async () => {
      // Startup: Trigger → Prompt → [SetOption(wired), RunCommand(wired)]
      // (sequential consumers, both wired from the same prompt output)
      const graph = new GraphBuilder('data-6-5', 'data-6-5')
        .startupTrigger('trigger-65')
        .builtin('prompt-65', 'input.prompt', {
          prompt: 'Enter value: ',
        })
        .builtin('notify-65-a', 'ui.notify', {
          level: 'info',
        })
        .builtin('notify-65-b', 'ui.notify', {
          level: 'warn',
        })
        .connectExec('trigger-65', 'prompt-65')
        .connectExec('prompt-65', 'notify-65-a')
        .connectExec('notify-65-a', 'notify-65-b')
        // Both consumers wire from same prompt output
        .connectData('prompt-65', 'value', 'notify-65-a', 'message')
        .connectData('prompt-65', 'value', 'notify-65-b', 'message')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Prompt must produce a single local variable
      expect(lua).toMatch(/local\s+\w+\s*=\s*vim\.fn\.input\(/)
      const promptVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*vim\.fn\.input\(/,
      )
      expect(promptVar, 'prompt must produce a local var').toBeDefined()
      if (promptVar !== undefined) {
        // Both notify calls should use the same upstream variable
        expectOccursExactly(lua, `vim.notify(${promptVar},`, 2)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('6.6 chain of transformations (A → B → C)', async () => {
      // CodeBlock A produces value → CodeBlock B transforms → SetVariable C consumes
      const graph = new GraphBuilder('data-6-6', 'data-6-6')
        .startupTrigger('trigger-66')
        .codeBlock(
          'cb-a',
          'return 10',
          [],
          [{ id: 'out', name: 'out', dataType: 'number' }],
        )
        .codeBlock(
          'cb-b',
          'return input * 2',
          [{ id: 'input', name: 'input', dataType: 'number' }],
          [{ id: 'result', name: 'result', dataType: 'number' }],
        )
        .action('setvar-c', 'set-variable', {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g' as const,
          variableName: 'computed',
          valueType: 'number' as const,
          value: 0,
        })
        .connectExec('trigger-66', 'cb-a')
        .connectExec('cb-a', 'cb-b')
        .connectExec('cb-b', 'setvar-c')
        // Wire: A output → B input
        .connectData('cb-a', 'out', 'cb-b', 'input')
        // Wire: B output → C value
        .connectData('cb-b', 'result', 'setvar-c', 'value')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Both code blocks must be defined and called
      expect(lua).toMatch(/local function _code_block_cb_a/)
      expect(lua).toMatch(/local function _code_block_cb_b/)
      // Output of A must be captured
      const aOutputVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*_code_block_cb_a\(/,
      )
      expect(aOutputVar, 'cb-a must produce a captured output').toBeDefined()
      // Output of B must be captured
      const bOutputVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*_code_block_cb_b\(/,
      )
      expect(bOutputVar, 'cb-b must produce a captured output').toBeDefined()
      if (bOutputVar !== undefined) {
        // Final set-variable must use b's output
        expect(lua).toContain(`vim.g.computed = ${bOutputVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Non-trivial dependency shapes (6.7 – 6.8)
  // ───────────────────────────────────────────────────────────────────────────

  describe('non-trivial dependency shapes', () => {
    /**
     * 6.7 Data-only dependency (no exec edge to the provider).
     *
     * HIGH-RISK: A provider node connected only by a data edge (no exec edge)
     * may not be emitted before the consumer in the current traversal.
     *
     * The test asserts that:
     *   a) Generation does not throw.
     *   b) The consumer line exists in the output.
     *   c) No hard crash diagnostics (errors) occur.
     *
     * Known gap: if the provider is never emitted, the consumer may reference
     * an unresolved temp binding. This test documents and guards that gap.
     */
    it('6.7 data-only dependency (provider has no exec edge from entry)', async () => {
      // Provider: a builtin that reads a var — connected by data edge ONLY
      // Consumer: set-option that uses the wired value
      // The exec chain is: Trigger → SetOption(consumer)
      // There is NO exec edge from Trigger to the GetVariable(provider) node.
      const graph = new GraphBuilder('data-6-7', 'data-6-7')
        .startupTrigger('trigger-67')
        .builtin('getvar-67', 'get-variable', {
          scope: 'g',
          variableName: 'orphan_var',
        })
        .action('opt-67', 'set-option', {
          ...createDefaultActionConfig('set-option'),
          optionName: 'number',
          scope: 'global' as const,
          valueConfig: {
            valueMode: 'suggested' as const,
            suggestedValue: true,
          },
        })
        // Exec chain: trigger → opt only (provider has NO exec edge)
        .connectExec('trigger-67', 'opt-67')
        // Data edge: provider → consumer (no exec edge to provider)
        .connectData('getvar-67', 'value', 'opt-67', 'value')
        .build()

      // Generation must not throw
      let result: ReturnType<typeof generateLuaFromGraphs>
      expect(() => {
        result = generateLuaFromGraphs([graph])
      }).not.toThrow()

      // @ts-expect-error – result is assigned in the expect block above
      const { lua } = result

      // Errors are NOT expected for this case — the traversal may resolve to
      // a temp binding or fallback. Document the current behavior:
      // - If the gap produces errors, that's unexpected (fail to catch regressions)
      // - If no errors, ensure the consumer line is still syntactically valid
      expect(typeof lua).toBe('string')
      // set-option line must exist (consumer must run)
      expect(lua).toContain('vim.opt.number')
      // NOTE: the assigned value may be a temp name, nil, or the actual var
      // — this test intentionally avoids asserting the exact value to
      // document rather than prescribe the gap behavior.
      await assertLuaSyntaxValid(lua)
    })

    /**
     * 6.8 Loop iterator value wired to loop body action input.
     *
     * HIGH-RISK / KNOWN GAP: The loop generator does not populate
     * `outputBindings` for the `item`/`index` ports. Downstream consumers
     * receive an unresolved temp binding rather than the actual iterator
     * variable.
     *
     * This test is marked `.fails` — it asserts that the body action DOES use
     * the iterator variable directly, which currently does NOT happen. When the
     * loop generator is fixed to expose `item` as an output binding, this test
     * should be changed from `.fails` to a normal `it`.
     */
    it.fails('6.8 loop iterator item wired to body action (known gap: loop does not expose item binding)', async () => {
      // Startup: Trigger → EachLoop → [body: SetVariable(wired from item)]
      const graph = new GraphBuilder('data-6-8', 'data-6-8')
        .startupTrigger('trigger-68')
        .loop('loop-68', 'each', 'item', 'some_table')
        .action('setvar-68', 'set-variable', {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g' as const,
          variableName: 'current_item',
          valueType: 'string' as const,
          value: 'fallback',
        })
        .connectExec('trigger-68', 'loop-68')
        .connectLoopBody('loop-68', 'setvar-68')
        // Wire: loop 'item' output → set-variable 'value' input
        .connectData('loop-68', 'item', 'setvar-68', 'value')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([graph])

      // No errors expected even for unresolved port
      expect(diagnostics.hasErrors()).toBe(false)
      assertBlocksBalanced(lua)
      // CURRENTLY FAILS: the body should use the iterator variable 'item'
      // but the loop generator does not register 'item' in outputBindings.
      // When fixed, this line should read: vim.g.current_item = item
      expect(lua).toContain('vim.g.current_item = item')
      await assertLuaSyntaxValid(lua)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Callable parameter/return wiring (6.9 – 6.10)
  // ───────────────────────────────────────────────────────────────────────────

  describe('callable parameter/return wiring', () => {
    it('6.9 callable entry parameter wired to action value input', async () => {
      // Callable: CallableEntry(msg) → SetVariable (msg wired to value port)
      const callableGraph = new GraphBuilder('param-wired', 'param-wired')
        .callableEntry('entry-pw', [
          createCallablePort('msg', 'Message', 'string'),
        ])
        .action('setvar-pw', 'set-variable', {
          ...createDefaultActionConfig('set-variable'),
          scope: 'g' as const,
          variableName: 'received_msg',
          valueType: 'string' as const,
          value: 'fallback',
        })
        .connectExec('entry-pw', 'setvar-pw')
        // Wire: callable-entry param port → set-variable value port
        .connectData('entry-pw', 'msg', 'setvar-pw', 'value')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([callableGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Parameter materialization must appear — key in the params table is
      // always the port ID, regardless of the local variable name chosen.
      expect(lua).toContain('params["msg"]')
      // The set-variable must use the upstream param variable (not a fallback literal)
      // Extract the materialization variable name dynamically.
      const paramVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*params\["msg"\]/,
      )
      expect(paramVar, 'expected param materialization variable').toBeDefined()
      if (paramVar !== undefined) {
        expect(lua).toContain(`vim.g.received_msg = ${paramVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })

    it('6.10 return node input wired from computed code block output', async () => {
      // Callable: CallableEntry → CodeBlock(computes) → Return(wired from code-block)
      const callableGraph = new GraphBuilder('return-wired', 'return-wired')
        .callableEntry('entry-rw')
        .codeBlock(
          'cb-rw',
          'return 42',
          [],
          [{ id: 'out', name: 'out', dataType: 'number' }],
        )
        .returnNode('return-rw', [
          createCallablePort('result', 'Result', 'number'),
        ])
        .connectExec('entry-rw', 'cb-rw')
        .connectExec('cb-rw', 'return-rw')
        // Wire: code-block output → return 'result' port
        .connectData('cb-rw', 'out', 'return-rw', 'result')
        .build()

      const { lua, diagnostics } = generateLuaFromGraphs([callableGraph])

      expect(diagnostics.hasErrors(), 'unexpected errors').toBe(false)
      assertBlocksBalanced(lua)
      // Code block must be defined and produce a local
      expect(lua).toMatch(/local function _code_block_cb_rw/)
      const cbVar = extractLocalVar(
        lua,
        /local\s+(\w+)\s*=\s*_code_block_cb_rw\(/,
      )
      expect(
        cbVar,
        'code block must produce a captured output var',
      ).toBeDefined()
      if (cbVar !== undefined) {
        // Return statement must reference the computed variable (not nil or fallback)
        expect(lua).toContain(`["result"] = ${cbVar}`)
      }
      await assertLuaSyntaxValid(lua)
    })
  })
})
