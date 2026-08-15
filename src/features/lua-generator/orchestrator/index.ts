import type { TargetNeovimSnapshot } from '../lib/target-neovim'
import { resolveTargetNeovimSnapshot } from '../lib/target-neovim'
import type { GenerationPhase, GenerationResult } from '../types'
import { generateInitLuaOrchestrator } from './phase-coordinator'

export interface GenerateInitLuaOptions {
  projectPath: string
  signal?: AbortSignal
  onProgress?: (phase: GenerationPhase) => void
  /** Optional for non-UI callers; falls back to resolveTargetNeovimSnapshot() */
  targetNeovim?: TargetNeovimSnapshot
}

/**
 * Generate init.lua for a project.
 *
 * This is the main entry point for the orchestrator (Domain 5).
 * It coordinates all phases of generation:
 * 1. Prepare context
 * 2. Load project data
 * 3. Run pre-generation diagnostics
 * 4. Compute graph disable states
 * 5. Generate sections
 * 6. Generate callable functions and startup graphs
 * 7. Assemble final output
 * 8. Run post-generation output validation
 * 9. Finalize result
 *
 * @param options - Orchestrator options including projectPath, signal, and progress callback
 * @returns GenerationResult with success status, init.lua code, diagnostics, and metadata
 */
export async function generateInitLua(
  options: GenerateInitLuaOptions,
): Promise<GenerationResult> {
  const targetNeovim =
    options.targetNeovim ?? (await resolveTargetNeovimSnapshot())

  return generateInitLuaOrchestrator(options.projectPath, {
    ...options,
    targetNeovim,
  })
}

export { assembleFinalInitLua } from './assemble'
export type { DataLoadResult, LoadOutcome, ProjectData } from './data-loader'
// Export data loader for testing
export {
  collectLoadErrors,
  extractData,
  hasFatalLoadFailure,
  loadProjectData,
} from './data-loader'
export { getGenerator, registerGenerator } from './dispatcher'
export { generateAllGraphs } from './graph-generation'
export { traverseGraph } from './traverse'
