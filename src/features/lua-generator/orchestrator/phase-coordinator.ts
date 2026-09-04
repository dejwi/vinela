// ============================================
// Phase Coordinator
// Coordinates the 9-phase generation pipeline
// ============================================

import { computeDisableStates } from '@/features/graph-editor/utils/graph-disable-state'
import {
  DEFAULT_LEADER_KEY,
  extractCallableContract,
  type Graph,
  type GraphCallableContract,
  type GraphDisableState,
  type InstalledPlugin,
  isThemeSchemaId,
  type PluginSchema,
  type ProjectLspConfig,
  type ProjectNeovimOptionsFile,
} from '@/shared/types'
import { DiagnosticsCollector } from '../diagnostics/collector'
import type { GenerationDiagnostic } from '../diagnostics/types'
import {
  generateColorschemeSection,
  generateHighlightSection,
  generateLeaderKeySection,
  generateLSPSection,
  generateNeovimOptionsSection,
  generatePluginSection,
  generateProjectKeymapsSection,
} from '../sections'
import type {
  CompilationUnit,
  GenerationMetadata,
  GenerationPhase,
  GenerationResult,
  OrchestratorOptions,
  ProjectKeymap,
  ResolvedPluginForGeneration,
  SectionResult,
} from '../types'
import { assembleFinalInitLua } from './assemble'
import {
  collectLoadErrors,
  type DataLoadResult,
  extractData,
  hasFatalLoadFailure,
  type LoadedProjectProfiles,
  loadProjectData,
} from './data-loader'
import { generateAllGraphs } from './graph-generation'
import { checkLuaBlockBalance } from './lua-block-balance'
import { runPreGenerationChecks } from './pre-generation-checks'
import { buildGenerationResult } from './result-builder'

// ============================================
// Phase Timings Tracker
// ============================================

interface PhaseTimings {
  phase1Prepare: number
  phase2Load: number
  phase3PreGeneration: number
  phase4DisableStates: number
  phase5Sections: number
  phase6Graphs: number
  phase7Assembly: number
  phase8Validation: number
  phase9Finalize: number
}

// ============================================
// Load Result Types
// ============================================

interface SimplifiedLoadResult {
  graphs: { data: Graph[] }
  plugins: { data: InstalledPlugin[] }
  schemas: { data: PluginSchema[] }
  options: { data: ProjectNeovimOptionsFile | null }
  keymaps: { data: ProjectKeymap[] }
  profiles: { data: LoadedProjectProfiles }
  lspConfig: { data: ProjectLspConfig }
  colorschemePrefs: {
    data: {
      activeScheme: string | null
      variantPreferences: Record<string, string>
    }
  }
  projectName: string
}

// ============================================
// Main Orchestrator Function
// ============================================

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: nine-phase pipeline coordinates cancellation, progress, and ordered section assembly; splitting would risk phase-order and partial-output regressions
export async function generateInitLuaOrchestrator(
  projectPath: string,
  options: OrchestratorOptions,
): Promise<GenerationResult> {
  const startTime = performance.now()
  const timings: Partial<PhaseTimings> = {}
  const collector = new DiagnosticsCollector()

  // Track if we should emit terminal phase event
  let terminalPhaseEmitted = false
  const emitProgress = (phase: GenerationPhase): void => {
    options.onProgress?.(phase)
  }

  // Helper to emit terminal phase
  const emitTerminalPhase = (success: boolean): void => {
    if (terminalPhaseEmitted) return
    terminalPhaseEmitted = true

    if (success) {
      emitProgress({
        type: 'complete',
        result: {
          success: true,
          initLua: '',
          diagnostics: [...collector.getAll()],
          metadata: createEmptyMetadata(startTime),
        },
      })
    } else {
      emitProgress({
        type: 'error',
        error: 'Generation failed',
      })
    }
  }

  try {
    // ============================================
    // Phase 1: Prepare Context
    // ============================================
    emitProgress({ type: 'validating', checkName: 'prepare-context' })
    const phase1Start = performance.now()

    if (options.signal?.aborted) {
      emitTerminalPhase(false)
      return buildGenerationResult({
        success: false,
        diagnostics: [createCancellationDiagnostic()],
        metadata: createEmptyMetadata(startTime),
      })
    }

    if (!projectPath) {
      collector.addError({
        id: 'ERR_INVALID_PROJECT',
        category: 'config',
        message: 'Project path is required',
      })
      emitTerminalPhase(false)
      return buildErrorResult(collector, startTime)
    }

    timings.phase1Prepare = performance.now() - phase1Start

    // ============================================
    // Phase 2: Data Loading
    // ============================================
    emitProgress({ type: 'validating', checkName: 'load-project' })
    const phase2Start = performance.now()

    const rawLoadResult = await loadProjectData(projectPath, options.signal)
    const loadResult = extractSimplifiedData(rawLoadResult)

    timings.phase2Load = performance.now() - phase2Start

    // Check for fatal load failures (graphs are required)
    if (hasFatalLoadFailure(rawLoadResult)) {
      const errors = collectLoadErrors(rawLoadResult)
      for (const err of errors) {
        collector.addError({
          id: `ERR_LOAD_${err.source.toUpperCase()}`,
          category: 'config',
          message: `Failed to load ${err.source}: ${err.error}`,
        })
      }
      emitTerminalPhase(false)
      return buildErrorResult(collector, startTime)
    }

    // Add warnings for optional source failures
    const loadErrors = collectLoadErrors(rawLoadResult)
    for (const err of loadErrors) {
      collector.addWarning({
        id: `WARN_LOAD_${err.source.toUpperCase()}`,
        category: 'config',
        message: `Failed to load ${err.source}: ${err.error}. Using defaults.`,
      })
    }

    // Check cancellation after loading
    if (options.signal?.aborted) {
      emitTerminalPhase(false)
      return buildGenerationResult({
        success: false,
        diagnostics: [createCancellationDiagnostic()],
        metadata: createEmptyMetadata(startTime),
      })
    }

    const graphs = loadResult.graphs.data
    const disableResult = computeDisableStates(graphs)
    const disableStates = disableResult.statesByGraphId

    const allCallableContracts = new Map<string, GraphCallableContract>()
    for (const graph of graphs) {
      const contract = extractCallableContract(graph)
      if (contract) {
        allCallableContracts.set(graph.id, contract)
      }
    }

    // ============================================
    // Phase 3: Pre-Generation Checks
    // ============================================
    emitProgress({ type: 'validating', checkName: 'pre-generation' })
    const phase3Start = performance.now()

    const preGenContext = {
      graphs,
      graphsById: new Map(graphs.map((g) => [g.id, g])),
      nodesByGraph: new Map(graphs.map((g) => [g.id, g.nodes])),
      edgesByGraph: new Map(graphs.map((g) => [g.id, g.edges])),
      disableStates,
      callableContracts: allCallableContracts,
      installedPlugins: loadResult.plugins.data,
      schemas: loadResult.schemas.data.map((s) => ({
        schema: s,
        source: 'project' as const,
      })),
      targetNeovim: options.targetNeovim,
    }

    runPreGenerationChecks(preGenContext, collector)

    timings.phase3PreGeneration = performance.now() - phase3Start

    if (collector.hasErrors()) {
      emitTerminalPhase(false)
      return buildErrorResult(collector, startTime)
    }

    // ============================================
    // Phase 4: Compute Graph Disable States
    // ============================================
    emitProgress({ type: 'validating', checkName: 'compute-disable-state' })
    const phase4Start = performance.now()

    // Partition graphs by effective state
    const enabledGraphs: Graph[] = []
    const excludedGraphs: Array<{ graph: Graph; state: GraphDisableState }> = []

    for (const graph of graphs) {
      const state = disableStates.get(graph.id)
      if (state?.effective.kind === 'enabled') {
        enabledGraphs.push(graph)
      } else if (state) {
        excludedGraphs.push({ graph, state })
      }
    }

    // Sort enabled graphs by canonical order
    enabledGraphs.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
      return a.id.localeCompare(b.id)
    })

    // Add warnings for excluded graphs
    for (const { graph, state } of excludedGraphs) {
      if (state.effective.kind === 'user-disabled') {
        collector.addWarning({
          id: 'WARN_GRAPH_DISABLED',
          category: 'structure',
          message: `Graph '${graph.name}' is disabled by user`,
          source: { graphId: graph.id },
        })
      } else if (state.effective.kind === 'dependency-disabled') {
        collector.addWarning({
          id: 'WARN_GRAPH_BLOCKED',
          category: 'structure',
          message: `Graph '${graph.name}' is blocked by dependency: ${state.effective.blockedByRootName}`,
          source: { graphId: graph.id },
          details: `Blocked by graph ID: ${state.effective.blockedByRootId}`,
        })
      }
    }

    timings.phase4DisableStates = performance.now() - phase4Start

    // ============================================
    // Phase 5: Section Generation
    // ============================================
    const phase5Start = performance.now()
    const sectionResults: SectionResult[] = []

    // Build resolved plugins for generation
    const resolvedPlugins = buildResolvedPlugins(
      loadResult.plugins.data,
      loadResult.schemas.data,
    )

    // Get theme plugin IDs
    const themePluginIds = extractThemePluginIds(resolvedPlugins)

    // 1. Leader Key Section
    emitProgress({ type: 'generating-sections', sectionName: 'leader-key' })
    const leaderResult = generateLeaderKeySection({
      leaderKey: loadResult.options.data?.leaderKey ?? DEFAULT_LEADER_KEY,
    })
    sectionResults.push(leaderResult)

    // 2. Neovim Options Section
    emitProgress({ type: 'generating-sections', sectionName: 'neovim-options' })
    const optionsResult = generateNeovimOptionsSection({
      options: loadResult.options.data?.options ?? {},
    })
    sectionResults.push(optionsResult)

    // 3. Plugin Section
    emitProgress({ type: 'generating-sections', sectionName: 'plugins' })
    const pluginResult = generatePluginSection({
      resolvedPlugins,
      themePluginIds,
    })
    sectionResults.push(pluginResult)

    // 4. LSP Section
    emitProgress({ type: 'generating-sections', sectionName: 'lsp' })
    const lspResult = generateLSPSection({
      enabledServers: loadResult.lspConfig.data.enabledServers,
      resolvedPlugins,
    })
    sectionResults.push(lspResult)

    // 5. Colorscheme Section
    emitProgress({ type: 'generating-sections', sectionName: 'colorscheme' })
    const colorschemeResult = generateColorschemeSection({
      activeScheme: loadResult.colorschemePrefs.data.activeScheme,
    })
    sectionResults.push(colorschemeResult)

    // 6. Highlights Section
    emitProgress({ type: 'generating-sections', sectionName: 'highlights' })
    const highlightResult = generateHighlightSection({
      highlightOverrides: loadResult.options.data?.highlightOverrides ?? [],
    })
    sectionResults.push(highlightResult)

    timings.phase5Sections = performance.now() - phase5Start

    // Check cancellation
    if (options.signal?.aborted) {
      emitTerminalPhase(false)
      return buildGenerationResult({
        success: false,
        diagnostics: [createCancellationDiagnostic()],
        metadata: createEmptyMetadata(startTime),
      })
    }

    // ============================================
    // Phase 6: Graph Generation
    // ============================================
    const phase6Start = performance.now()

    emitProgress({
      type: 'generating-graphs',
      current: 0,
      total: graphs.length,
      graphName: '',
    })

    const { callableUnits, startupUnits, callableKeyByGraphId } =
      generateAllGraphs(enabledGraphs, collector)

    // 7. Project Keymaps Section (after callable map is known)
    emitProgress({
      type: 'generating-sections',
      sectionName: 'project-keymaps',
    })
    const keymapsResult = generateProjectKeymapsSection({
      keymaps: loadResult.keymaps.data,
      profiles: loadResult.profiles.data.profiles,
      profileOverrides: loadResult.profiles.data.overrides,
      resolvedPlugins,
      callableKeyByGraphId,
    })
    sectionResults.push(keymapsResult)

    // Collect section diagnostics
    for (const section of sectionResults) {
      for (const diagnostic of section.diagnostics) {
        const normalizedDiagnostic = {
          id: 'WARN_SECTION',
          category: 'config' as const,
          message: diagnostic.message,
          ...(diagnostic.context !== undefined && {
            details: diagnostic.context,
          }),
        }

        if (diagnostic.severity === 'error') {
          collector.addError(normalizedDiagnostic)
        } else if (diagnostic.severity === 'warning') {
          collector.addWarning(normalizedDiagnostic)
        }
      }
    }

    let currentGraphIndex = 0
    for (const graph of graphs) {
      currentGraphIndex += 1
      emitProgress({
        type: 'generating-graphs',
        current: currentGraphIndex,
        total: graphs.length,
        graphName: graph.name,
      })

      if (options.signal?.aborted) {
        emitTerminalPhase(false)
        return buildGenerationResult({
          success: false,
          diagnostics: [createCancellationDiagnostic()],
          metadata: createEmptyMetadata(startTime),
        })
      }
    }

    const callableFunctionSnippets = buildSnippetBlocks(
      callableUnits,
      'callable-entry',
    )
    const startupExecutionSnippets = buildSnippetBlocks(startupUnits, 'trigger')

    timings.phase6Graphs = performance.now() - phase6Start

    // ============================================
    // Phase 7: Assembly
    // ============================================
    const phase7Start = performance.now()

    const initLua = assembleFinalInitLua(
      sectionResults,
      callableFunctionSnippets,
      startupExecutionSnippets,
      {
        projectName: loadResult.projectName,
        generationDate: new Date().toISOString(),
      },
    )

    timings.phase7Assembly = performance.now() - phase7Start

    // ============================================
    // Phase 8: Post-Generation Validation
    // ============================================
    emitProgress({ type: 'validating-output' })
    const phase8Start = performance.now()

    // Basic block-balance check: verify that block-opening keywords
    // (function, if, for, while, repeat) are balanced by their
    // corresponding closers (end, until) in the generated output.
    // Note: `do` is intentionally NOT counted as an opener — it is part
    // of loop/while headers and the entire construct is closed by a single
    // `end`.  See lua-block-balance.ts JSDoc for the full rationale.
    // This is a lightweight token-counting pass — not a full parser —
    // and catches structural mistakes introduced by generators.
    const blockBalance = checkLuaBlockBalance(initLua)
    if (!blockBalance.balanced) {
      collector.addWarning({
        id: 'WARN_BLOCK_IMBALANCE',
        category: 'runtime',
        message: `Generated Lua has unbalanced blocks: ${blockBalance.openers} block-opener(s) vs ${blockBalance.closers} block-closer(s). The output may be syntactically invalid.`,
        details: `Net imbalance: ${blockBalance.openers - blockBalance.closers} (positive = unclosed blocks, negative = extra 'end'/'until')`,
      })
    }

    timings.phase8Validation = performance.now() - phase8Start

    // ============================================
    // Phase 9: Finalize Result
    // ============================================
    const phase9Start = performance.now()

    const totalLines = initLua.split('\n').length
    const success = !collector.hasErrors()

    const metadata: GenerationMetadata = {
      graphsGenerated: enabledGraphs.length,
      nodesGenerated: enabledGraphs.reduce((sum, g) => sum + g.nodes.length, 0),
      pluginsConfigured: resolvedPlugins.filter((rp) => rp.plugin.enabled)
        .length,
      linesOfCode: totalLines,
      generationTimeMs: Math.round(performance.now() - startTime),
      phaseTimingsMs: {
        prepare: Math.round(timings.phase1Prepare ?? 0),
        load: Math.round(timings.phase2Load ?? 0),
        preGeneration: Math.round(timings.phase3PreGeneration ?? 0),
        disableStates: Math.round(timings.phase4DisableStates ?? 0),
        sections: Math.round(timings.phase5Sections ?? 0),
        graphs: Math.round(timings.phase6Graphs ?? 0),
        assembly: Math.round(timings.phase7Assembly ?? 0),
        validation: Math.round(timings.phase8Validation ?? 0),
        finalize: Math.round(performance.now() - phase9Start),
      },
    }

    timings.phase9Finalize = performance.now() - phase9Start

    // Use timings to avoid unused variable warning
    void timings

    emitTerminalPhase(success)

    if (success) {
      return buildGenerationResult({
        success: true,
        initLua,
        diagnostics: [...collector.getAll()],
        metadata,
      })
    }

    return buildGenerationResult({
      success: false,
      diagnostics: [...collector.getAll()],
      metadata,
    })
  } catch (error) {
    // Handle unexpected errors
    collector.addError({
      id: 'ERR_UNEXPECTED',
      category: 'runtime',
      message: error instanceof Error ? error.message : String(error),
      details: 'Unexpected error during generation',
    })

    emitTerminalPhase(false)
    return buildErrorResult(collector, startTime)
  }
}

// ============================================
// Helper Functions
// ============================================

function createEmptyMetadata(startTime: number): GenerationMetadata {
  return {
    graphsGenerated: 0,
    nodesGenerated: 0,
    pluginsConfigured: 0,
    linesOfCode: 0,
    generationTimeMs: Math.round(performance.now() - startTime),
    phaseTimingsMs: {},
  }
}

function createCancellationDiagnostic(): GenerationDiagnostic {
  return {
    id: 'ERR_CANCELLED',
    severity: 'error',
    category: 'runtime',
    message: 'Generation was cancelled',
  }
}

function buildErrorResult(
  collector: DiagnosticsCollector,
  startTime: number,
): GenerationResult {
  return buildGenerationResult({
    success: false,
    diagnostics: [...collector.getAll()],
    metadata: createEmptyMetadata(startTime),
  })
}

function extractSimplifiedData(result: DataLoadResult): SimplifiedLoadResult {
  const projectMeta = extractData(result.projectMeta, null)
  return {
    graphs: { data: extractData(result.graphs, []) },
    plugins: { data: extractData(result.plugins, []) },
    schemas: { data: extractData(result.schemas, []) },
    options: { data: extractData(result.options, null) },
    keymaps: { data: extractData(result.keymaps, []) },
    profiles: { data: result.profiles.data },
    lspConfig: { data: extractData(result.lspConfig, { enabledServers: [] }) },
    colorschemePrefs: {
      data: extractData(result.colorschemePrefs, {
        activeScheme: null,
        variantPreferences: {},
      }),
    },
    projectName: projectMeta?.name ?? 'Project',
  }
}

function buildResolvedPlugins(
  plugins: InstalledPlugin[],
  schemas: PluginSchema[],
): ResolvedPluginForGeneration[] {
  const schemaMap = new Map(schemas.map((s) => [s.id, s]))

  return plugins
    .map((plugin): ResolvedPluginForGeneration | null => {
      const schema = schemaMap.get(plugin.schemaId)
      if (!schema) return null

      return {
        plugin: {
          id: plugin.schemaId, // Use schemaId as ID
          schemaId: plugin.schemaId,
          enabled: plugin.enabled,
          config: plugin.config,
          ...(plugin.luaFieldOverrides !== undefined && {
            luaFieldOverrides: plugin.luaFieldOverrides,
          }),
          ...(plugin.installOverride !== undefined && {
            installOverride: plugin.installOverride,
          }),
        },
        schema,
      }
    })
    .filter((rp): rp is ResolvedPluginForGeneration => rp !== null)
}

function extractThemePluginIds(
  resolvedPlugins: ResolvedPluginForGeneration[],
): Set<string> {
  const themeIds = new Set<string>()

  for (const rp of resolvedPlugins) {
    // Check if schema ID follows theme pattern (theme--repo/name or similar)
    if (isThemeSchemaId(rp.schema.id)) {
      themeIds.add(rp.schema.id)
    }
  }

  return themeIds
}

function buildSnippetBlocks(
  units: readonly CompilationUnit[],
  preferredNodeType: string,
): string[][] {
  const preferredUnits = units.filter(
    (unit) => unit.nodeType === preferredNodeType && unit.code.length > 0,
  )

  if (preferredUnits.length > 0) {
    return preferredUnits.map((unit) => [...unit.code])
  }

  return units
    .filter((unit) => unit.code.length > 0)
    .map((unit) => [...unit.code])
}
