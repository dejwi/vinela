// ============================================
// Result Builder
// Builds the final GenerationResult discriminated union
// ============================================

import type { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import type {
  GenerationDiagnostic,
  GenerationMetadata,
  GenerationResult,
} from '../types'

interface BuildResultOptions {
  success: boolean
  initLua?: string
  diagnostics: readonly GenerationDiagnostic[]
  metadata: GenerationMetadata
}

/**
 * Build the final GenerationResult discriminated union.
 */
export function buildGenerationResult(
  options: BuildResultOptions,
): GenerationResult {
  if (options.success && options.initLua !== undefined) {
    return {
      success: true,
      initLua: options.initLua,
      diagnostics: [...options.diagnostics],
      metadata: options.metadata,
    }
  }

  return {
    success: false,
    diagnostics: [...options.diagnostics],
    metadata: options.metadata,
    ...(options.initLua !== undefined && { initLua: options.initLua }),
  }
}

/**
 * Build a result from a diagnostics collector.
 */
export function buildResultFromCollector(
  collector: DiagnosticsCollector,
  initLua: string | undefined,
  metadata: GenerationMetadata,
): GenerationResult {
  const hasErrors = collector.hasErrors()

  if (!hasErrors && initLua !== undefined) {
    return {
      success: true,
      initLua,
      diagnostics: [...collector.getAll()],
      metadata,
    }
  }

  return {
    success: false,
    diagnostics: [...collector.getAll()],
    metadata,
    ...(initLua !== undefined && { initLua }),
  }
}
