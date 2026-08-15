// ============================================
// Pre-Generation Diagnostic Checks
// ============================================

// New checks (Phase 2 - Domain 6)
export { checkCircularDependencies } from './circular-dependencies'
export { checkCodeBlocks } from './code-block-validation'
export { checkDisabledDependencies } from './disabled-dependencies'
// Existing checks (Phase 1)
export { checkDisconnectedEntryPoints } from './disconnected-entry-points'
export { checkDuplicateIds } from './duplicate-ids'
export { checkEmptyGraphs } from './empty-graphs'
export { checkInvalidConfig } from './invalid-config'
export { checkInvalidGraphRefs } from './invalid-graph-refs'
export { checkMissingRequiredPorts } from './missing-required-ports'
export { checkOrphanedNodes } from './orphaned-nodes'
export { checkTargetNeovimBaseline } from './target-neovim-baseline'
export { checkTypeMismatches } from './type-mismatches'
