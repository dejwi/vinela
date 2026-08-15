/**
 * Test Infrastructure for Lua Generator
 *
 * This module exports all test utilities and fixtures for the Lua generator tests.
 *
 * @example
 * ```typescript
 * import {
 *   GraphBuilder,
 *   createCallablePort,
 *   simpleStartupGraph,
 *   minimalProject,
 *   createTempProject,
 *   validateLuaSyntax,
 *   generateLuaFromGraphs,
 *   assertLuaSyntaxValid,
 *   assertBlocksBalanced,
 * } from '@/features/lua-generator/__tests__'
 * ```
 */

// ============================================
// Utilities
// ============================================

export type { BlockBalanceAssertOptions } from './utils/block-balance'
export { assertBlocksBalanced } from './utils/block-balance'
// New integration test helpers
export type {
  GenerateLuaFromGraphsOptions,
  GenerateLuaFromGraphsResult,
} from './utils/generate-helper'
export {
  generateLuaFromGraphs,
  generateStartupCode,
} from './utils/generate-helper'
export {
  createCallablePort,
  GraphBuilder,
} from './utils/graph-builder'
export type { LuaSyntaxAssertOptions } from './utils/lua-assert'
export { assertLuaSyntaxValid } from './utils/lua-assert'
export type {
  LuaValidationResult,
  ToolProbeResult,
} from './utils/lua-validator'
export {
  clearToolProbeCache,
  probeLuaValidationTools,
  validateLuaSyntax,
} from './utils/lua-validator'
export {
  createStableSnapshot,
  DEFAULT_REMOVE_PATTERNS,
  normalizeLuaForSnapshot,
} from './utils/snapshot'
export type {
  ProjectFixture,
  TempProjectResult,
} from './utils/temp-project'
export {
  createEmptyFixture,
  createTempProject,
} from './utils/temp-project'

// ============================================
// Graph Fixtures
// ============================================

export {
  allNodesGraph,
  minimalAllNodesGraph,
} from './fixtures/graphs/all-nodes'
export {
  callableGraph,
  callableWithConditionGraph,
  multiParamCallableGraph,
  noParamsCallableGraph,
  noReturnCallableGraph,
} from './fixtures/graphs/callable'
export {
  comparisonOperatorsGraph,
  conditionalGraph,
  nestedConditionalGraph,
} from './fixtures/graphs/conditional'
export {
  allLoopTypesGraph,
  eachLoopGraph,
  forLoopGraph,
  whileLoopGraph,
} from './fixtures/graphs/loop-types'
export {
  simpleSetKeymapGraph,
  simpleSetOptionGraph,
  simpleStartupGraph,
} from './fixtures/graphs/simple-startup'

// ============================================
// Project Fixtures
// ============================================

export { complexProject } from './fixtures/projects/complex'
export { minimalProject } from './fixtures/projects/minimal'
