// Lua generator feature module

// ============================================
// Components (Domain 8: UI)
// ============================================
export {
  GenerateButton,
  GenerateDialog,
} from './components'

// ============================================
// Deploy and Export
// ============================================
export { deployGeneratedConfig } from './deploy/deploy'
export { exportProject } from './deploy/export'
export {
  expandPath,
  getParentDir,
  resolveOutputPath,
  safePathExists,
} from './deploy/path-resolution'
export {
  buildPreGenerationContext,
  getEnabledGraphs,
  getNodeDisplayName,
} from './diagnostics'
export {
  checkDisconnectedEntryPoints,
  checkMissingRequiredPorts,
  checkOrphanedNodes,
} from './diagnostics/checks'
// ============================================
// Domain 6: Diagnostics Framework
// ============================================
export { DiagnosticsCollector } from './diagnostics/collector'
export type {
  UseLuaPreviewParams,
  UseLuaPreviewResult,
} from './hooks/useLuaPreview'
// ============================================
// Hooks
// ============================================
export { useLuaPreview } from './hooks/useLuaPreview'
// ============================================
// Utilities (Domain 1: Lua Builder & Utilities)
// ============================================
export {
  isLuaReservedWord,
  sanitizeLuaIdentifier,
  sanitizeLuaIdentifierList,
} from './lua-utils'
export {
  assembleFinalInitLua,
  generateInitLua,
  getGenerator,
  registerGenerator,
  traverseGraph,
} from './orchestrator'
// ============================================
// Store (Domain 8)
// ============================================
export {
  selectCanCancel,
  selectCanDeploy,
  selectCurrentResult,
  selectDiagnostics,
  selectIsOperationInProgress,
  useGenerationStore,
} from './store'
// ============================================
// Types
// ============================================
export type {
  DeployErrorCode,
  DeployRequest,
  DeployResult,
  ExportErrorCode,
  ExportOptions,
  ExportResult,
  GenerationDiagnostic,
  GenerationDialogPhase,
  GenerationMetadata,
  GenerationPhase,
  GenerationProgress,
  GenerationResult,
  GenerationStatus,
  LegacyGenerationState,
  OrchestratorOptions,
} from './types'
export {
  countByLevel,
  hasErrors,
  hasWarnings,
  isNavigable,
} from './types'
export {
  getIndentPrefix,
  type IndentTextOptions,
  indentMultiline,
} from './utils/indent'
export {
  LuaBuilder,
  LuaBuilderError,
  type LuaBuilderErrorCode,
  type LuaBuilderOptions,
} from './utils/lua-builder'
export {
  type LuaSerializable,
  LuaSerializationError,
  type SerializeLuaOptions,
  serializeValue,
} from './utils/lua-serialize'
export { escapeLuaString } from './utils/lua-string'
