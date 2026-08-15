// ============================================
// Diagnostics Collector (Non-Failing Accumulation)
// ============================================

import type { DiagnosticSource, GenerationDiagnostic } from './types'

/**
 * Collects diagnostics without failing fast.
 * Supports deduplication by id+source combination.
 */
export class DiagnosticsCollector {
  private errors: GenerationDiagnostic[] = []
  private warnings: GenerationDiagnostic[] = []
  private seenKeys = new Set<string>()

  /**
   * Add an error diagnostic.
   * Automatically assigns 'error' severity.
   */
  addError(input: Omit<GenerationDiagnostic, 'severity'>): void {
    const key = this.makeDedupeKey(input)
    if (this.seenKeys.has(key)) {
      return
    }
    this.seenKeys.add(key)

    const diagnostic: GenerationDiagnostic = {
      ...input,
      severity: 'error',
    }
    this.errors.push(diagnostic)
  }

  /**
   * Add a warning diagnostic.
   * Automatically assigns 'warning' severity.
   */
  addWarning(input: Omit<GenerationDiagnostic, 'severity'>): void {
    const key = this.makeDedupeKey(input)
    if (this.seenKeys.has(key)) {
      return
    }
    this.seenKeys.add(key)

    const diagnostic: GenerationDiagnostic = {
      ...input,
      severity: 'warning',
    }
    this.warnings.push(diagnostic)
  }

  /**
   * Check if any errors have been collected.
   */
  hasErrors(): boolean {
    return this.errors.length > 0
  }

  /**
   * Check if any warnings have been collected.
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0
  }

  /**
   * Get all collected errors.
   */
  getErrors(): readonly GenerationDiagnostic[] {
    return [...this.errors]
  }

  /**
   * Get all collected warnings.
   */
  getWarnings(): readonly GenerationDiagnostic[] {
    return [...this.warnings]
  }

  /**
   * Get all diagnostics (errors first, then warnings).
   */
  getAll(): readonly GenerationDiagnostic[] {
    return [...this.errors, ...this.warnings]
  }

  /**
   * Merge another collector's diagnostics into this one.
   */
  merge(other: DiagnosticsCollector): void {
    for (const diagnostic of other.getAll()) {
      if (diagnostic.severity === 'error') {
        this.addError(diagnostic)
      } else {
        this.addWarning(diagnostic)
      }
    }
  }

  /**
   * Get total count of diagnostics.
   */
  get count(): number {
    return this.errors.length + this.warnings.length
  }

  /**
   * Clear all collected diagnostics.
   */
  clear(): void {
    this.errors = []
    this.warnings = []
    this.seenKeys.clear()
  }

  /**
   * Create a deduplication key from diagnostic input.
   * Combines id and source fields for stable dedupe.
   */
  private makeDedupeKey(input: Omit<GenerationDiagnostic, 'severity'>): string {
    const sourceKey = this.makeSourceKey(input.source)
    return `${input.id}::${sourceKey}`
  }

  /**
   * Create a stable key from source information.
   */
  private makeSourceKey(source: DiagnosticSource | undefined): string {
    if (!source) {
      return '_global_'
    }
    const parts: string[] = []
    if (source.graphId) {
      parts.push(`g:${source.graphId}`)
    }
    if (source.nodeId) {
      parts.push(`n:${source.nodeId}`)
    }
    if (source.portId) {
      parts.push(`p:${source.portId}`)
    }
    return parts.length > 0 ? parts.join('|') : '_anon_'
  }
}
