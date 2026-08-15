/**
 * Lua content / structure assertion helpers for integration tests.
 *
 * Three layers of validation are provided:
 * 1. Content: string containment / ordering helpers (synchronous, always run)
 * 2. Block balance: `assertBlocksBalanced` (synchronous, always run)
 * 3. Syntax:  `assertLuaSyntaxValid` (async, Neovim-compatible checker via Node child-process)
 *
 * Usage convention:
 *   - Call `assertBlocksBalanced(lua)` in every multi-node test.
 *   - Call `await assertLuaSyntaxValid(lua)` in every multi-node test.
 *   - Put `await ensureLuaParserAvailable()` in a `beforeAll` block; tests fail
 *     when no Neovim-compatible checker is available.
 *
 * Strong assertion helpers (Phase 1 additions):
 *   - expectLuaStatement      – anchored full-line match
 *   - expectNoOccurrence      – negative assertion with comment stripping
 *   - expectLuaLine           – regex-based line finder
 *   - expectAssignment        – full `lhs = rhs` statement check
 *   - expectNotAssignment     – negative `lhs = rhs` check
 *   - expectFullKeymapCall    – structured vim.keymap.set() assertion
 *   - expectFullAutocmdCall   – structured nvim_create_autocmd() assertion
 *   - extractLocalVar         – extract a captured group from a pattern
 *   - Regex pattern constants (SET_OPTION_PATTERN, KEYMAP_SET_PATTERN, etc.)
 */

import { expect } from 'vitest'
import { requireDefined } from '@/features/lua-generator/__tests__/utils/test-assertions'
import { checkLuaBlockBalance } from '@/features/lua-generator/orchestrator/lua-block-balance'
import {
  assertLuaSyntaxValid as assertLuaSyntaxValidCanonical,
  ensureLuaParserAvailable as ensureLuaParserAvailableCanonical,
} from '../../utils/lua-assert'

export {
  assertLuaSyntaxValidCanonical as assertLuaSyntaxValid,
  ensureLuaParserAvailableCanonical as ensureLuaParserAvailable,
}

// ─────────────────────────────────────────────────────────────────────────────
// Block balance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that the generated Lua has balanced block keywords
 * (function/if/for/while/repeat vs end/until).
 *
 * This is a lightweight, zero-dependency structural guard that should be called
 * in **every** multi-node test regardless of whether `luac` is available.
 */
export function assertBlocksBalanced(lua: string): void {
  const result = checkLuaBlockBalance(lua)
  if (!result.balanced) {
    const lines = lua.split('\n')
    const numbered = lines
      .map((l, i) => `${String(i + 1).padStart(4, ' ')}: ${l}`)
      .join('\n')

    expect.fail(
      `Block balance check failed: ${result.openers} opener(s) vs ${result.closers} closer(s).\n\nGenerated Lua:\n${numbered}`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content / ordering helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that the Lua string contains ALL of the given snippets.
 */
export function expectContainsAll(lua: string, snippets: string[]): void {
  for (const snippet of snippets) {
    expect(
      lua,
      `Expected Lua to contain: ${JSON.stringify(snippet)}`,
    ).toContain(snippet)
  }
}

/**
 * Assert that the snippets appear in the Lua string in strictly increasing
 * index order (i.e. snippet[0] appears before snippet[1] etc.).
 */
export function expectInOrder(lua: string, snippets: string[]): void {
  let lastIndex = -1
  for (const snippet of snippets) {
    const idx = lua.indexOf(snippet)
    expect(
      idx,
      `Expected to find ${JSON.stringify(snippet)} in Lua`,
    ).toBeGreaterThan(-1)
    expect(
      idx,
      `Expected ${JSON.stringify(snippet)} (at ${idx}) to appear after previous match (at ${lastIndex})`,
    ).toBeGreaterThan(lastIndex)
    lastIndex = idx
  }
}

/**
 * Assert that a snippet appears exactly `count` times in the Lua string.
 */
export function expectOccursExactly(
  lua: string,
  snippet: string,
  count: number,
): void {
  let matches = 0
  let pos = 0
  while (pos < lua.length) {
    const idx = lua.indexOf(snippet, pos)
    if (idx === -1) break
    matches++
    pos = idx + snippet.length
  }
  expect(
    matches,
    `Expected ${JSON.stringify(snippet)} to appear exactly ${count} time(s) but found ${matches}`,
  ).toBe(count)
}

// ─────────────────────────────────────────────────────────────────────────────
// Line-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split the Lua string into non-empty lines.
 */
export function getLuaLines(lua: string): string[] {
  return lua.split('\n').filter((l) => l.trim().length > 0)
}

/**
 * Block-spec token ordering: assert that each token in `tokens` appears in the
 * Lua string in the given order.  A thin wrapper around `expectInOrder`.
 */
export function expectBlockStructure(lua: string, tokens: string[]): void {
  expectInOrder(lua, tokens)
}

/**
 * Assert that `followingSnippet` appears after `innerSnippet` in the Lua
 * string.  Used to check that a post-merge / post-loop continuation appears
 * outside (after) the inner block.
 */
export function expectLineAfter(
  lua: string,
  innerSnippet: string,
  followingSnippet: string,
): void {
  const innerIdx = lua.indexOf(innerSnippet)
  expect(
    innerIdx,
    `Expected to find ${JSON.stringify(innerSnippet)}`,
  ).toBeGreaterThan(-1)
  const followIdx = lua.indexOf(followingSnippet)
  expect(
    followIdx,
    `Expected to find ${JSON.stringify(followingSnippet)}`,
  ).toBeGreaterThan(-1)
  expect(
    followIdx,
    `Expected ${JSON.stringify(followingSnippet)} to appear after ${JSON.stringify(innerSnippet)}`,
  ).toBeGreaterThan(innerIdx)
}

/**
 * Assert that lines containing `innerSnippet` have greater indentation than
 * lines containing `outerSnippet`.
 */
export function expectDeeper(
  lua: string,
  outerSnippet: string,
  innerSnippet: string,
): void {
  const lines = lua.split('\n')

  const outerLine = lines.find((l) => l.includes(outerSnippet))
  const innerLine = lines.find((l) => l.includes(innerSnippet))

  expect(
    outerLine,
    `Expected to find a line containing ${JSON.stringify(outerSnippet)}`,
  ).toBeDefined()
  expect(
    innerLine,
    `Expected to find a line containing ${JSON.stringify(innerSnippet)}`,
  ).toBeDefined()

  if (outerLine === undefined || innerLine === undefined) return

  const outerIndent = outerLine.match(/^(\s*)/)?.[1]?.length ?? 0
  const innerIndent = innerLine.match(/^(\s*)/)?.[1]?.length ?? 0

  expect(
    innerIndent,
    `Expected ${JSON.stringify(innerSnippet)} (indent ${innerIndent}) to be more indented than ${JSON.stringify(outerSnippet)} (indent ${outerIndent})`,
  ).toBeGreaterThan(outerIndent)
}

/**
 * Assert that the nesting depth of `if` or `for/while` blocks is at least the
 * given threshold.
 *
 * Uses the simplest possible heuristic: count leading spaces of lines
 * containing the relevant keyword.
 */
export function expectNestingDepth(
  lua: string,
  spec: { ifDepth?: number; loopDepth?: number },
): void {
  const lines = lua.split('\n')

  if (spec.ifDepth !== undefined) {
    const ifLines = lines.filter((l) => /^\s*if\s/.test(l))
    const maxDepth = ifLines.reduce((max, l) => {
      const indent = l.match(/^(\s*)/)?.[1]?.length ?? 0
      return Math.max(max, indent)
    }, 0)
    // Each level of nesting adds 2 spaces (LuaBuilder default)
    const expectedMinIndent = (spec.ifDepth - 1) * 2
    expect(
      maxDepth,
      `Expected if-nesting depth ≥ ${spec.ifDepth} (min indent ${expectedMinIndent}) but max indent was ${maxDepth}`,
    ).toBeGreaterThanOrEqual(expectedMinIndent)
  }

  if (spec.loopDepth !== undefined) {
    const loopLines = lines.filter((l) => /^\s*(for|while)\s/.test(l))
    const maxDepth = loopLines.reduce((max, l) => {
      const indent = l.match(/^(\s*)/)?.[1]?.length ?? 0
      return Math.max(max, indent)
    }, 0)
    const expectedMinIndent = (spec.loopDepth - 1) * 2
    expect(
      maxDepth,
      `Expected loop-nesting depth ≥ ${spec.loopDepth} (min indent ${expectedMinIndent}) but max indent was ${maxDepth}`,
    ).toBeGreaterThanOrEqual(expectedMinIndent)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 strong assertion helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape a string for literal use inside a RegExp.
 * Exported so test files can inline regex patterns that contain dynamic values.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Assert that `statement` appears as a complete trimmed line in the Lua output,
 * or as the start of a line with only a trailing comment (`-- ...`).
 *
 * Prevents false positives from substring matches (e.g. matching a comment
 * or a longer expression that happens to contain the snippet).
 */
export function expectLuaStatement(lua: string, statement: string): void {
  const lines = lua.split('\n').map((l) => l.trim())

  // Exact match first
  if (lines.some((l) => l === statement)) return

  // Allow trailing line comment: `<statement> -- some comment`
  const trailingCommentRe = new RegExp(`^${escapeRegex(statement)}\\s*(--.*)?$`)
  const found = lines.some((l) => trailingCommentRe.test(l))
  expect(
    found,
    `Expected complete Lua statement: ${JSON.stringify(statement)}\n` +
      `Closest matches:\n${
        lines
          .filter((l) => l.includes(statement.split(' ')[0] ?? ''))
          .map((l) => `  ${l}`)
          .join('\n') || '  (none)'
      }`,
  ).toBe(true)
}

/**
 * Assert that `snippet` does NOT appear anywhere in the Lua output
 * (outside of line comments).
 *
 * Provides a clear error message showing the line where it was found.
 */
export function expectNoOccurrence(lua: string, snippet: string): void {
  // Strip trailing line comments before checking, to avoid false positives
  // from the snippet appearing in a comment rather than real code.
  const strippedLines = lua.split('\n').map((line) => line.replace(/--.*$/, ''))
  const stripped = strippedLines.join('\n')

  const idx = stripped.indexOf(snippet)
  if (idx !== -1) {
    const lines = lua.split('\n')
    const lineNum = lua.substring(0, idx).split('\n').length
    const line = lines[lineNum - 1] ?? ''
    expect.fail(
      `Expected ${JSON.stringify(snippet)} to NOT appear in Lua output, ` +
        `but found it on line ${lineNum}: ${line.trim()}`,
    )
  }
}

/**
 * Assert that at least one line matches the given regex pattern.
 * Returns the first matching line for further inspection.
 */
export function expectLuaLine(lua: string, pattern: RegExp): string {
  const lines = lua.split('\n')
  const match = lines.find((l) => pattern.test(l.trim()))
  expect(
    match,
    `Expected a line matching ${pattern} in Lua output`,
  ).toBeDefined()
  return requireDefined(match, `line matching ${pattern}`)
}

/**
 * Assert that a specific assignment `lhs = rhs` exists in the Lua output
 * as a complete statement (exact trimmed line or line with trailing comment).
 */
export function expectAssignment(lua: string, lhs: string, rhs: string): void {
  const fullAssignment = `${lhs} = ${rhs}`
  expectLuaStatement(lua, fullAssignment)
}

/**
 * Assert that a specific wrong assignment does NOT exist in the Lua output.
 */
export function expectNotAssignment(
  lua: string,
  lhs: string,
  wrongRhs: string,
): void {
  const wrongAssignment = `${lhs} = ${wrongRhs}`
  expectNoOccurrence(lua, wrongAssignment)
}

/**
 * Extract the first local variable name declared by a given pattern.
 * e.g. extractLocalVar(lua, /local\s+(\w+)\s*=\s*vim\.fn\.input/)
 * Returns the captured group [1] or undefined if not found.
 * Exported for use across test files (avoids duplication in graph-refs.test.ts).
 */
export function extractLocalVar(
  lua: string,
  pattern: RegExp,
): string | undefined {
  const match = pattern.exec(lua)
  return match?.[1]
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured keymap assertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expectation shape for a vim.keymap.set() call.
 *
 * NOTE on `remap`: The generator translates `noremap: true` → `remap = false`
 * in the emitted Lua. Always use `remap` (not `noremap`) in expectations here.
 */
export interface KeymapExpectation {
  modes: string | string[]
  lhs: string
  rhs: string
  desc?: string
  opts?: {
    silent?: boolean
    remap?: boolean
    expr?: boolean
  }
}

/**
 * Assert a complete vim.keymap.set() call with all expected components,
 * scoped to the actual call line (not the whole file).
 *
 * Finds the keymap.set line(s) matching the LHS and verifies all arguments
 * on that same line. Prevents false passes from tokens scattered across
 * unrelated lines.
 */
export function expectFullKeymapCall(
  lua: string,
  expected: KeymapExpectation,
): void {
  const lines = lua.split('\n')
  const lhsEscaped = escapeRegex(expected.lhs)
  const keymapLine = lines.find(
    (l) =>
      l.includes('vim.keymap.set(') && new RegExp(`"${lhsEscaped}"`).test(l),
  )
  expect(
    keymapLine,
    `Expected a vim.keymap.set() call with lhs "${expected.lhs}"`,
  ).toBeDefined()
  if (!keymapLine) return

  const trimmed = keymapLine.trim()

  // Verify mode argument — scoped to this line only
  if (Array.isArray(expected.modes)) {
    for (const mode of expected.modes) {
      expect(trimmed, `keymap line missing mode "${mode}"`).toContain(
        `"${mode}"`,
      )
    }
    // Verify table format { "n", "v" }
    expect(trimmed, 'multi-mode should use table format').toMatch(/\{[^}]*\}/)
  } else {
    expect(trimmed, `keymap line missing mode "${expected.modes}"`).toContain(
      `"${expected.modes}"`,
    )
  }

  // Verify RHS — also scoped to this line
  expect(trimmed, `keymap line missing rhs "${expected.rhs}"`).toContain(
    expected.rhs,
  )

  // Verify opts — scoped to this line
  if (expected.opts) {
    for (const [key, value] of Object.entries(expected.opts)) {
      if (value !== undefined) {
        expect(
          trimmed,
          `keymap line missing opt ${key} = ${String(value)}`,
        ).toContain(`${key} = ${String(value)}`)
      }
    }
  }

  // Verify desc — scoped to this line
  if (expected.desc) {
    expect(trimmed, `keymap line missing desc "${expected.desc}"`).toContain(
      expected.desc,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured autocmd assertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expectation shape for a vim.api.nvim_create_autocmd() call.
 */
export interface AutocmdExpectation {
  events: string[]
  patterns?: string[]
  group?: string
  once?: boolean
  callbackContains?: string[]
}

/**
 * Assert a complete nvim_create_autocmd() call with all expected components.
 *
 * Event, pattern, group, and once checks are scoped to the autocmd call line.
 * callbackContains checks span the whole output (callback body may be on
 * earlier lines when a callable reference is used).
 */
export function expectFullAutocmdCall(
  lua: string,
  expected: AutocmdExpectation,
): void {
  const lines = lua.split('\n')
  const autocmdLine = lines.find((l) =>
    l.includes('vim.api.nvim_create_autocmd('),
  )
  expect(
    autocmdLine,
    'Expected a vim.api.nvim_create_autocmd() call',
  ).toBeDefined()
  if (!autocmdLine) return

  const trimmed = autocmdLine.trim()

  // Verify events — scoped to the autocmd line
  if (expected.events.length === 1) {
    const ev = requireDefined(
      expected.events[0],
      'expected.events single event',
    )
    expect(trimmed, `autocmd line missing event "${ev}"`).toContain(`"${ev}"`)
  } else {
    for (const event of expected.events) {
      expect(trimmed, `autocmd line missing event "${event}"`).toContain(
        `"${event}"`,
      )
    }
  }

  // Verify patterns — scoped to the autocmd line
  if (expected.patterns) {
    for (const pat of expected.patterns) {
      expect(trimmed, `autocmd line missing pattern "${pat}"`).toContain(pat)
    }
  }

  // Verify group — scoped to the autocmd line
  if (expected.group) {
    expect(trimmed, `autocmd line missing group "${expected.group}"`).toContain(
      `group = "${expected.group}"`,
    )
  }

  // Verify once — scoped to the autocmd line
  if (expected.once === true) {
    expect(trimmed, 'autocmd line missing once = true').toContain('once = true')
  } else if (expected.once === false) {
    // once = true should not appear on this autocmd's line
    expect(trimmed, 'autocmd line should not have once = true').not.toContain(
      'once = true',
    )
  }

  // Verify callback body — spans full output (body may be on earlier lines)
  if (expected.callbackContains) {
    for (const snippet of expected.callbackContains) {
      expect(lua, `autocmd callback missing "${snippet}"`).toContain(snippet)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex pattern constants (non-ambiguous, no (.+?) captures across tables)
// ─────────────────────────────────────────────────────────────────────────────

/** Match a complete set-option assignment line */
export const SET_OPTION_PATTERN = /vim\.opt(?:_local)?\.(\w+)\s*=\s*(.+)/

/** Match a complete set-variable assignment line */
export const SET_VARIABLE_PATTERN = /vim\.([gbwtv])\.(\w+)\s*=\s*(.+)/

/** Match a local variable assignment */
export const LOCAL_VAR_PATTERN = /local\s+(\w+)\s*=\s*(.+)/

/**
 * Match a vim.keymap.set call — captures the first string-quoted mode.
 * For multi-mode calls like `{"n","v"}`, use the table format check instead.
 */
export const KEYMAP_SET_PATTERN =
  /vim\.keymap\.set\(\s*(?:"([^"]+)"|\{[^}]*\})\s*,\s*"([^"]+)"/

/**
 * Match a vim.api.nvim_create_autocmd call — captures the first string-quoted event.
 * For multi-event calls like `{"BufEnter","BufRead"}`, use the table format check.
 */
export const AUTOCMD_PATTERN =
  /vim\.api\.nvim_create_autocmd\(\s*(?:"([^"]+)"|\{[^}]*\})\s*,/

/** Match a callable registration */
export const CALLABLE_REG_PATTERN =
  /_G\._vinela_callables\["(.+?)"\]\s*=\s*function/

/** Match a callable invocation */
export const CALLABLE_CALL_PATTERN = /_G\._vinela_callables\["(.+?)"\]\(/

/** Match a code-block function definition */
export const CODE_BLOCK_DEF_PATTERN =
  /local function (_code_block_\w+)\(([^)]*)\)/

/** Match a for-numeric loop header */
export const FOR_LOOP_PATTERN =
  /for\s+(\w+)\s*=\s*([^,]+),\s*([^\s,]+)(?:,\s*([^\s]+))?\s+do/

/** Match a while loop header */
export const WHILE_LOOP_PATTERN = /while\s+(.+?)\s+do/

/** Match an each (pairs) loop header */
export const EACH_LOOP_PATTERN = /for\s+_,\s*(\w+)\s+in\s+pairs\(([^)]+)\)\s+do/
