import path from 'node:path'
import type {
  GenerateCommandArgs,
  NvimMode,
  NvimTestCommandArgs,
  ParseArgsResult,
  WorkflowCommandArgs,
  WorkflowStageName,
} from './cli-types'
import {
  createRunPathSet,
  getDefaultAppDataRoot,
  getDefaultCacheRoot,
  getDefaultGeneratedOutDir,
  resolvePath,
  sanitizeRunId,
} from './paths'

type FlagMap = ReadonlyMap<string, readonly string[]>

const VALID_MODES: readonly NvimMode[] = ['syntax', 'source', 'startup']
const VALID_WORKFLOW_STAGES: readonly WorkflowStageName[] = [
  'generation',
  'syntax',
  'source',
  'startup',
]

export function parseGenerateArgs(argv: readonly string[]): ParseArgsResult<GenerateCommandArgs> {
  const flags = parseFlags(argv)
  const projectPath = readRequiredPath(flags, '--project')
  if (projectPath === null) {
    return errorResult('Missing required --project <path>')
  }

  const outPath = readOptionalValue(flags, '--out')
  const outDir = outPath !== undefined
    ? path.dirname(resolvePath(outPath))
    : resolvePath(readOptionalValue(flags, '--out-dir') ?? getDefaultGeneratedOutDir(projectPath))
  const initLuaPath = outPath !== undefined
    ? resolvePath(outPath)
    : path.join(outDir, 'init.lua')

  return {
    success: true,
    value: {
      projectPath: resolvePath(projectPath),
      outDir,
      initLuaPath,
      reportPath: resolvePath(readOptionalValue(flags, '--report') ?? path.join(outDir, 'generation-report.json')),
      appDataRoot: resolvePath(readOptionalValue(flags, '--app-data') ?? getDefaultAppDataRoot()),
      useProjectCopy: !flags.has('--no-project-copy'),
      allowProjectWrites: flags.has('--allow-project-writes'),
      failOnWarning: flags.has('--fail-on-warning'),
      json: flags.has('--json'),
      quiet: flags.has('--quiet'),
    },
  }
}

export function parseNvimTestArgs(
  argv: readonly string[],
): ParseArgsResult<NvimTestCommandArgs> {
  const flags = parseFlags(argv)
  const initLuaPath = readRequiredPath(flags, '--init')
  if (initLuaPath === null) {
    return errorResult('Missing required --init <path>')
  }

  const mode = parseMode(readOptionalValue(flags, '--mode') ?? 'startup')
  if (mode === null) {
    return errorResult('Invalid --mode. Expected syntax, source, or startup')
  }

  if (flags.has('--fresh') && flags.has('--reuse-cache')) {
    return errorResult('--fresh and --reuse-cache cannot be combined')
  }

  const runId = sanitizeRunId(readOptionalValue(flags, '--run-id') ?? createRunPathSet(initLuaPath).runId)
  const pathSet = createRunPathSet(initLuaPath, runId)
  const workDir = resolvePath(readOptionalValue(flags, '--work-dir') ?? pathSet.runDir)
  const keepRuns = parseNonNegativeInteger(readOptionalValue(flags, '--keep-runs') ?? '20')
  if (keepRuns === null) {
    return errorResult('Invalid --keep-runs. Expected a non-negative integer')
  }

  const timeoutDefault = mode === 'startup' ? '120000' : '30000'
  const timeoutMs = parsePositiveInteger(readOptionalValue(flags, '--timeout-ms') ?? timeoutDefault)
  if (timeoutMs === null) {
    return errorResult('Invalid --timeout-ms. Expected a positive integer')
  }

  const postStartupWaitMsDefault = mode === 'startup' ? '1000' : '0'
  const postStartupWaitMs = parseNonNegativeInteger(
    readOptionalValue(flags, '--post-startup-wait-ms') ?? postStartupWaitMsDefault,
  )
  if (postStartupWaitMs === null) {
    return errorResult('Invalid --post-startup-wait-ms. Expected a non-negative integer')
  }

  const timeoutBudgetError = validatePostStartupWaitBudget(timeoutMs, postStartupWaitMs)
  if (timeoutBudgetError !== null) {
    return errorResult(timeoutBudgetError)
  }

  const value: NvimTestCommandArgs = {
    initLuaPath: resolvePath(initLuaPath),
    mode,
    workDir,
    cacheDir: resolvePath(readOptionalValue(flags, '--cache-dir') ?? getDefaultCacheRoot()),
    runId,
    keepRuns,
    latest: !flags.has('--no-latest'),
    reuseCache: flags.has('--reuse-cache'),
    fresh: flags.has('--fresh'),
    timeoutMs,
    postStartupWaitMs,
    nvimCommand: readOptionalValue(flags, '--nvim') ?? 'nvim',
    json: flags.has('--json'),
    verboseLog:
      flags.has('--verbose-log') ||
      (!flags.has('--no-verbose-log') && mode === 'startup'),
    startupTime:
      flags.has('--startuptime') ||
      (!flags.has('--no-startuptime') && mode === 'startup'),
  }
  const minNvimVersion = readOptionalValue(flags, '--min-nvim')
  if (minNvimVersion !== undefined) {
    value.minNvimVersion = minNvimVersion
  }

  return {
    success: true,
    value,
  }
}

export function parseWorkflowArgs(
  argv: readonly string[],
): ParseArgsResult<WorkflowCommandArgs> {
  const flags = parseFlags(argv)
  const projectPath = readRequiredPath(flags, '--project')
  if (projectPath === null) {
    return errorResult('Missing required --project <path>')
  }

  const mode = parseMode(readOptionalValue(flags, '--mode') ?? 'startup')
  if (mode === null) {
    return errorResult('Invalid --mode. Expected syntax, source, or startup')
  }

  if (flags.has('--fresh') && flags.has('--reuse-cache')) {
    return errorResult('--fresh and --reuse-cache cannot be combined')
  }

  const pipelineResult = parseWorkflowPipeline(flags, mode)
  if (!pipelineResult.success) {
    return pipelineResult
  }

  const runId = sanitizeRunId(readOptionalValue(flags, '--run-id') ?? createRunPathSet(projectPath).runId)
  const pathSet = createRunPathSet(projectPath, runId)
  const timeoutMs = parsePositiveInteger(
    readOptionalValue(flags, '--timeout-ms') ?? (mode === 'startup' ? '120000' : '30000'),
  )
  if (timeoutMs === null) {
    return errorResult('Invalid --timeout-ms. Expected a positive integer')
  }

  const explicitPostStartupWaitMs = readOptionalValue(flags, '--post-startup-wait-ms')
  const postStartupWaitMs = parseNonNegativeInteger(
    explicitPostStartupWaitMs ?? (pipelineResult.value.includes('startup') ? '1000' : '0'),
  )
  if (postStartupWaitMs === null) {
    return errorResult('Invalid --post-startup-wait-ms. Expected a non-negative integer')
  }

  const timeoutBudgetError = validatePostStartupWaitBudget(timeoutMs, postStartupWaitMs)
  if (timeoutBudgetError !== null) {
    return errorResult(timeoutBudgetError)
  }

  const keepRuns = parseNonNegativeInteger(readOptionalValue(flags, '--keep-runs') ?? '20')
  if (keepRuns === null) {
    return errorResult('Invalid --keep-runs. Expected a non-negative integer')
  }

  const value: WorkflowCommandArgs = {
    projectPath: resolvePath(projectPath),
    mode,
    pipeline: pipelineResult.value,
    workDir: resolvePath(readOptionalValue(flags, '--work-dir') ?? pathSet.runDir),
    cacheDir: resolvePath(readOptionalValue(flags, '--cache-dir') ?? getDefaultCacheRoot()),
    runId,
    keepRuns,
    latest: !flags.has('--no-latest'),
    reuseCache: flags.has('--reuse-cache'),
    fresh: flags.has('--fresh'),
    timeoutMs,
    postStartupWaitMs,
    nvimCommand: readOptionalValue(flags, '--nvim') ?? 'nvim',
    appDataRoot: resolvePath(readOptionalValue(flags, '--app-data') ?? getDefaultAppDataRoot()),
    allowProjectWrites: flags.has('--allow-project-writes'),
    useProjectCopy: !flags.has('--no-project-copy'),
    failOnWarning: flags.has('--fail-on-warning'),
    json: flags.has('--json'),
    quiet: flags.has('--quiet'),
  }
  const minNvimVersion = readOptionalValue(flags, '--min-nvim')
  if (minNvimVersion !== undefined) {
    value.minNvimVersion = minNvimVersion
  }

  return {
    success: true,
    value,
  }
}

function parseWorkflowPipeline(
  flags: FlagMap,
  mode: NvimMode,
): ParseArgsResult<readonly WorkflowStageName[]> {
  const explicitPipeline = readOptionalValue(flags, '--pipeline')
  const singleMode = readOptionalValue(flags, '--single-mode')
  const skipSyntax = flags.has('--skip-syntax')

  if (explicitPipeline !== undefined && singleMode !== undefined) {
    return errorResult('--pipeline and --single-mode cannot be combined')
  }

  if (singleMode !== undefined) {
    const parsedMode = parseMode(singleMode)
    if (parsedMode === null) {
      return errorResult('Invalid --single-mode. Expected syntax, source, or startup')
    }

    const stages: WorkflowStageName[] = ['generation', parsedMode]
    if (skipSyntax && parsedMode === 'syntax') {
      return errorResult('--skip-syntax cannot be used with --single-mode syntax')
    }

    return {
      success: true,
      value: skipSyntax ? stages.filter((stage) => stage !== 'syntax') : stages,
    }
  }

  if (explicitPipeline !== undefined) {
    const parsedStages = explicitPipeline
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)

    if (parsedStages.length === 0) {
      return errorResult('Invalid --pipeline. Expected at least one validation stage')
    }

    const pipeline: WorkflowStageName[] = ['generation']
    for (const stage of parsedStages) {
      if (!VALID_WORKFLOW_STAGES.includes(stage as WorkflowStageName) || stage === 'generation') {
        return errorResult(`Invalid pipeline stage: ${stage}`)
      }
      pipeline.push(stage as WorkflowStageName)
    }

    if (skipSyntax) {
      return {
        success: true,
        value: pipeline.filter((stage) => stage !== 'syntax'),
      }
    }

    return { success: true, value: pipeline }
  }

  if (skipSyntax) {
    return errorResult('--skip-syntax requires --single-mode or --pipeline')
  }

  switch (mode) {
    case 'syntax':
      return { success: true, value: ['generation', 'syntax'] }
    case 'source':
      return { success: true, value: ['generation', 'syntax', 'source'] }
    case 'startup':
      return { success: true, value: ['generation', 'syntax', 'startup'] }
  }
}

function parseFlags(argv: readonly string[]): Map<string, readonly string[]> {
  const flags = new Map<string, string[]>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined) {
      continue
    }
    if (!token.startsWith('--')) {
      continue
    }

    const nextToken = argv[index + 1]
    if (nextToken === undefined || nextToken.startsWith('--')) {
      flags.set(token, [])
      continue
    }

    const existing = flags.get(token) ?? []
    existing.push(nextToken)
    flags.set(token, existing)
    index += 1
  }

  return flags
}

function parseMode(input: string): NvimMode | null {
  return VALID_MODES.includes(input as NvimMode) ? (input as NvimMode) : null
}

function readRequiredPath(flags: FlagMap, flagName: string): string | null {
  const value = readOptionalValue(flags, flagName)
  return value === undefined ? null : value
}

function readOptionalValue(flags: FlagMap, flagName: string): string | undefined {
  const values = flags.get(flagName)
  if (values === undefined) {
    return undefined
  }
  const value = values[values.length - 1]
  return value
}

function parsePositiveInteger(input: string): number | null {
  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function parseNonNegativeInteger(input: string): number | null {
  const parsed = Number.parseInt(input, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed
}

function validatePostStartupWaitBudget(
  timeoutMs: number,
  postStartupWaitMs: number,
): string | null {
  if (postStartupWaitMs === 0) {
    return null
  }

  if (timeoutMs - postStartupWaitMs < 1000) {
    return 'Invalid timeout budget. --timeout-ms minus --post-startup-wait-ms must be at least 1000'
  }

  return null
}

function errorResult(message: string): ParseArgsResult<never> {
  return {
    success: false,
    exitCode: 2,
    message,
  }
}
