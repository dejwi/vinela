// src/features/lua-generator/generators/nodes/shared/lua-emit.ts
// Lua code emission helpers

import type { LuaBuilder } from '@/features/lua-generator/utils/lua-builder'

/**
 * Emit a function call statement.
 */
export function emitCall(
  builder: LuaBuilder,
  func: string,
  args: string[],
): void {
  const argsStr = args.join(', ')
  builder.line(`${func}(${argsStr})`)
}

/**
 * Emit a local variable assignment.
 */
export function emitAssignment(
  builder: LuaBuilder,
  varName: string,
  expression: string,
): void {
  builder.line(`local ${varName} = ${expression}`)
}

/**
 * Emit a table constructor.
 */
export function emitTable(
  builder: LuaBuilder,
  entries: Record<string, string | undefined>,
): void {
  const validEntries = Object.entries(entries).filter(
    ([, value]) => value !== undefined && value.length > 0,
  )

  if (validEntries.length === 0) {
    builder.line('{}')
    return
  }

  if (validEntries.length === 1) {
    const entry = validEntries[0]
    if (entry !== undefined) {
      const [key, value] = entry
      builder.line(`{ ${key} = ${value} }`)
    }
    return
  }

  builder.line('{')
  builder.indent()
  for (const [key, value] of validEntries) {
    builder.line(`${key} = ${value},`)
  }
  builder.dedent()
  builder.line('}')
}

/**
 * Emit an inline table (single line).
 */
export function emitInlineTable(
  entries: Record<string, string | undefined>,
): string {
  const validEntries = Object.entries(entries).filter(
    ([, value]) => value !== undefined && value.length > 0,
  )

  if (validEntries.length === 0) {
    return '{}'
  }

  const pairs = validEntries.map(([key, value]) => `${key} = ${value}`)
  return `{ ${pairs.join(', ')} }`
}

/**
 * Emit an if-then-end block.
 */
export function emitIfBlock(
  builder: LuaBuilder,
  condition: string,
  buildBody: (builder: LuaBuilder) => void,
): void {
  builder.block(`if ${condition} then`, buildBody, 'end')
}

/**
 * Emit an if-then-else-end block.
 */
export function emitIfElseBlock(
  builder: LuaBuilder,
  condition: string,
  buildTrueBranch: (builder: LuaBuilder) => void,
  buildFalseBranch: (builder: LuaBuilder) => void,
): void {
  builder.line(`if ${condition} then`)
  builder.indent()
  buildTrueBranch(builder)
  builder.dedent()
  builder.line('else')
  builder.indent()
  buildFalseBranch(builder)
  builder.dedent()
  builder.line('end')
}

/**
 * Emit a for loop (numeric).
 */
export function emitForNumericBlock(
  builder: LuaBuilder,
  varName: string,
  startExpr: string,
  endExpr: string,
  stepExpr: string | undefined,
  buildBody: (builder: LuaBuilder) => void,
): void {
  const stepClause = stepExpr !== undefined ? `, ${stepExpr}` : ''
  builder.block(
    `for ${varName} = ${startExpr}, ${endExpr}${stepClause} do`,
    buildBody,
    'end',
  )
}

/**
 * Emit a for-in loop (iterator).
 */
export function emitForInBlock(
  builder: LuaBuilder,
  indexVar: string,
  valueVar: string,
  iteratorExpr: string,
  buildBody: (builder: LuaBuilder) => void,
): void {
  builder.block(
    `for ${indexVar}, ${valueVar} in ${iteratorExpr} do`,
    buildBody,
    'end',
  )
}

/**
 * Emit a while loop.
 */
export function emitWhileBlock(
  builder: LuaBuilder,
  condition: string,
  buildBody: (builder: LuaBuilder) => void,
): void {
  builder.block(`while ${condition} do`, buildBody, 'end')
}

/**
 * Emit a function definition.
 */
export function emitFunctionDef(
  builder: LuaBuilder,
  funcName: string,
  params: string[],
  buildBody: (builder: LuaBuilder) => void,
): void {
  const paramsStr = params.join(', ')
  builder.block(`local function ${funcName}(${paramsStr})`, buildBody, 'end')
}

/**
 * Emit a global function registration.
 */
export function emitGlobalFunctionDef(
  builder: LuaBuilder,
  globalPath: string,
  params: string[],
  buildBody: (builder: LuaBuilder) => void,
): void {
  const paramsStr = params.join(', ')
  builder.block(`${globalPath} = function(${paramsStr})`, buildBody, 'end')
}
