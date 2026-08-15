// src/features/lua-generator/types.ts
// Shared contracts used across Domains 5-8 for Lua code generation

import type { ProjectKeymap } from '@/features/keymaps/types'
import type { TargetNeovimSnapshot } from '@/features/lua-generator/lib/target-neovim'
import type {
  Graph,
  GraphCallableContract,
  GraphEdge,
  GraphNode,
  HighlightOverride,
  NeovimOptionStoredValue,
  PluginSchema,
} from '@/shared/types'

// Re-export canonical keymap types so sections can import from one place
export type {
  ManualKeymapAction,
  ManualRunActionConfig,
  ProjectKeymap,
} from '@/features/keymaps/types'

// ============================================
// LEGACY SECTION RESULTS (Domain 5)
// ============================================

/**
 * @deprecated Use the new discriminated union types below for Domain 8.
 * Kept for backward compatibility with existing section generators.
 */
export type DiagnosticSeverity = 'info' | 'warning' | 'error'

/**
 * Diagnostic type used by section generators.
 */
export interface SectionGenerationDiagnostic {
  severity: DiagnosticSeverity
  message: string
  /** Optional context like option name, plugin id, etc. */
  context?: string
}

/**
 * @deprecated Use SectionGenerationDiagnostic.
 */
export type LegacyGenerationDiagnostic = SectionGenerationDiagnostic

export type SectionId =
  | 'leader-key'
  | 'neovim-options'
  | 'plugins'
  | 'lsp'
  | 'colorscheme'
  | 'highlights'
  | 'project-keymaps'
  | 'callable-functions'

export interface SectionResult {
  /** Canonical section identifier for deterministic assembly order */
  id: SectionId
  /** Generated Lua code lines (empty array if nothing to emit) */
  code: string[]
  /** Diagnostics discovered during generation */
  diagnostics: SectionGenerationDiagnostic[]
  /** Features that were intentionally skipped (version gates, missing plugins) */
  skippedReasons?: string[]
}

// ============================================
// NEW DOMAIN 8 TYPES (Discriminated Unions)
// ============================================

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic Types (Domain 8)
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticCategory =
  | 'structure'
  | 'connectivity'
  | 'config'
  | 'syntax'
  | 'reference'
  | 'cycle'
  | 'runtime'

/**
 * Generation diagnostic with full metadata.
 * Note: Arrays are mutable for immer compatibility.
 */
export interface GenerationDiagnostic {
  id: string
  severity: 'error' | 'warning'
  category: DiagnosticCategory
  message: string
  details?: string
  source?: {
    graphId?: string
    /** Human-readable graph name, for display in error messages */
    graphName?: string
    nodeId?: string
    nodeType?: string
    portId?: string
  }
  suggestions?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Metadata (Domain 8)
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationMetadata {
  graphsGenerated: number
  nodesGenerated: number
  pluginsConfigured: number
  linesOfCode: number
  generationTimeMs: number
  phaseTimingsMs: Record<string, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Result (Domain 8 - Discriminated Union)
// Note: Arrays are mutable for immer compatibility in stores
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationResult =
  | {
      success: true
      initLua: string
      diagnostics: GenerationDiagnostic[]
      metadata: GenerationMetadata
    }
  | {
      success: false
      diagnostics: GenerationDiagnostic[]
      metadata: GenerationMetadata
      initLua?: string
    }

// ─────────────────────────────────────────────────────────────────────────────
// Generation Phase (Domain 8 - Progress Updates)
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationPhase =
  | { type: 'idle' }
  | { type: 'validating'; checkName: string }
  | { type: 'generating-sections'; sectionName: string }
  | {
      type: 'generating-graphs'
      current: number
      total: number
      graphName: string
    }
  | { type: 'validating-output' }
  | { type: 'complete'; result: GenerationResult }
  | { type: 'error'; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator Options (Domain 8)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorOptions {
  projectPath: string
  signal?: AbortSignal
  onProgress?: (phase: GenerationPhase) => void
  /** Request-scoped target Neovim snapshot from pre-flight UI */
  targetNeovim: TargetNeovimSnapshot
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation Dialog Phase (Domain 8 - UI-only)
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationDialogPhase =
  | { type: 'pre-flight' }
  | { type: 'generation'; progress: GenerationPhase }
  | { type: 'deploying'; result: GenerationResult }
  | { type: 'deployed'; deployResult: DeployResult }

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic Helpers (Domain 8)
// ─────────────────────────────────────────────────────────────────────────────

export function hasErrors(
  diagnostics: readonly GenerationDiagnostic[],
): boolean {
  return diagnostics.some((d) => d.severity === 'error')
}

export function hasWarnings(
  diagnostics: readonly GenerationDiagnostic[],
): boolean {
  return diagnostics.some((d) => d.severity === 'warning')
}

export function countByLevel(
  diagnostics: readonly GenerationDiagnostic[],
  level: GenerationDiagnostic['severity'],
): number {
  return diagnostics.filter((d) => d.severity === level).length
}

export function isNavigable(diagnostic: GenerationDiagnostic): boolean {
  return (
    diagnostic.source?.graphId !== undefined &&
    diagnostic.source?.nodeId !== undefined
  )
}

// ============================================
// GENERATION CONTEXT
// ============================================

/** Canonical edge alias used by orchestration contracts. */
export type Edge = GraphEdge

/** Canonical callable graph contract used by node generators. */
export type CallableContract = GraphCallableContract

/**
 * Intermediate representation for a single generated node unit.
 * Shared between traversal and node generators.
 */
export interface CompilationUnit {
  nodeId: string
  nodeType: string
  code: string[]
  localVars: string[]
  inputBindings: Record<string, string>
  outputBindings: Record<string, string>
  indentLevel: number
}

/**
 * Canonical graph indexes consumed by orchestration/traversal boundaries.
 */
export interface GraphIndexes {
  nodesByGraph: Map<string, GraphNode[]>
  edgesByGraph: Map<string, Edge[]>
  execEdges: Map<string, Edge[]>
  dataEdges: Map<string, Edge[]>
}

/**
 * Canonical generation context used at D2/D3 integration boundaries.
 */
export interface GenerationContext {
  graph: Graph
  indexes: GraphIndexes
  getInputValue(portId: string): string
  getVariableName(): string
  emitDiagnostic(diagnostic: GenerationDiagnostic): void
}

export interface ResolvedPluginForGeneration {
  plugin: {
    id: string
    schemaId: string
    enabled: boolean
    config: Record<string, import('@/shared/types').PluginConfigValue>
    /** Per-field lua include overrides (option key -> include/exclude) */
    luaFieldOverrides?: Record<string, boolean> | undefined
    installOverride?: import('@/shared/types').PluginInstallOverride | undefined
  }
  schema: PluginSchema
}

export interface SectionGenerationContext {
  /** Project name for header comment */
  projectName: string
  /** All installed plugins with their schemas resolved */
  resolvedPlugins: ResolvedPluginForGeneration[]
  /** Which plugin schema IDs are theme plugins */
  themePluginIds: Set<string>
}

// ============================================
// SECTION INPUT TYPES
// ============================================

export interface LeaderKeySectionInput {
  /** From ProjectNeovimOptionsFile.leaderKey */
  leaderKey: string | undefined
}

export interface NeovimOptionsSectionInput {
  /** User's configured options (from neovim-options.json) */
  options: Record<string, NeovimOptionStoredValue>
}

export interface PluginSectionInput {
  /** Resolved plugins: installed plugin data paired with its schema */
  resolvedPlugins: ResolvedPluginForGeneration[]
  /** Theme plugin IDs to exclude from setup (colorscheme section handles them) */
  themePluginIds: Set<string>
}

export interface LspSectionInput {
  /** Enabled LSP server names (from lsp-servers.json) */
  enabledServers: string[]
  /** Resolved plugins — queried for generic LSP-related capabilities */
  resolvedPlugins: ResolvedPluginForGeneration[]
}

export interface ColorschemeSectionInput {
  /** Active color scheme catalog entry ID (null = no custom scheme) */
  activeScheme: string | null
}

export interface HighlightSectionInput {
  /** Highlight overrides from neovim-options.json */
  highlightOverrides: HighlightOverride[]
}

export interface ProjectKeymapsSectionInput {
  /** Manual keymaps from keymaps.json */
  keymaps: ProjectKeymap[]
  /** Resolved plugins — needed to check if callable graph targets exist */
  resolvedPlugins: ResolvedPluginForGeneration[]
  /** Callable registry key lookup by graph id */
  callableKeyByGraphId?: ReadonlyMap<string, string>
}

// ============================================
// DEPLOY TYPES
// ============================================

export type DeployErrorCode =
  | 'memory-mode'
  | 'no-output-path'
  | 'permission-denied'
  | 'write-failed'
  | 'backup-failed'
  | 'directory-creation-failed'

export type DeployResult =
  | {
      success: true
      outputPath: string
      backupCreated: boolean
      backupPath: string | undefined
    }
  | {
      success: false
      error: string
      errorCode: DeployErrorCode
    }

export interface DeployRequest {
  projectId: string
  projectPath: string
  initLua: string
}

// ============================================
// EXPORT TYPES
// ============================================

export type ExportErrorCode =
  | 'memory-mode'
  | 'no-destination'
  | 'destination-not-empty'
  | 'write-failed'
  | 'permission-denied'

export type ExportResult =
  | {
      success: true
      exportedTo: string
      filesWritten: string[]
    }
  | {
      success: false
      error: string
      errorCode: ExportErrorCode
    }

export interface ExportOptions {
  /** Absolute path to the current project */
  projectPath: string
  /** Destination directory for the export */
  destinationPath: string
  /** Include source .json graph files (default: false) */
  includeSourceGraphs?: boolean
  /** Include used plugin schemas (default: true) */
  includeSchemas?: boolean
}

// ============================================
// GENERATION STATUS TYPES (Legacy - Domain 5)
// ============================================

export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error'

/**
 * @deprecated Use GenerationResult discriminated union instead.
 * Kept for backward compatibility.
 */
export interface LegacyGenerationState {
  status: GenerationStatus
  initLua?: string
  error?: string
  errorCode?: string
}

export interface GenerationProgress {
  phase: string
  percent: number
}
