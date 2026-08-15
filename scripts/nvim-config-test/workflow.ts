import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseWorkflowArgs } from './cli-args'
import type {
  CombinedWorkflowReport,
  CombinedWorkflowValidationSummary,
  NvimMode,
  WorkflowCommandArgs,
  WorkflowStageName,
  WorkflowStageSummary,
} from './cli-types'
import { runGeneration } from './generate'
import { createRunPathSet } from './paths'
import { copyLatestReportFiles, pruneRunDirectories, writeJsonFileAtomic } from './report'
import { runNvimValidation } from './nvim-runner'

const ALL_STAGES: readonly WorkflowStageName[] = ['generation', 'syntax', 'source', 'startup']

export async function runWorkflow(
  options: WorkflowCommandArgs,
): Promise<{ exitCode: number; report: CombinedWorkflowReport }> {
  if (options.fresh) {
    await fs.rm(options.workDir, { recursive: true, force: true })
  }

  await fs.mkdir(options.workDir, { recursive: true })

  const pathSet = createRunPathSet(options.projectPath, options.runId)
  const latestDir = pathSet.latestDir
  const initLuaPath = path.join(options.workDir, 'init.lua')
  const generationReportPath = path.join(options.workDir, 'generation-report.json')
  const stageSummaries = createInitialStageSummaries(options.pipeline)
  const validationSummary = createValidationSummary(options.mode, options.fresh, options.reuseCache)

  if (!options.quiet && !options.json) {
    console.log(`[workflow:generation] starting`)
  }

  const generationResult = await runGeneration({
    projectPath: options.projectPath,
    outDir: options.workDir,
    initLuaPath,
    reportPath: generationReportPath,
    appDataRoot: options.appDataRoot,
    useProjectCopy: options.useProjectCopy,
    allowProjectWrites: options.allowProjectWrites,
    failOnWarning: options.failOnWarning,
    json: false,
    quiet: true,
  })

  updateStageSummary(stageSummaries, 'generation', generationReportPath, generationResult.report)

  if (generationResult.report.success && generationResult.exitCode !== 0) {
    const warningErrorSummary =
      'Generation produced warnings and --fail-on-warning is enabled'
    const generationWarningSummary: WorkflowStageSummary = {
      stage: 'generation',
      status: 'failed',
      reportPath: generationReportPath,
      failureKind: 'generation-warnings',
      errorSummary: warningErrorSummary,
    }
    replaceStageSummary(stageSummaries, generationWarningSummary)

    const report = createWorkflowReport({
      success: false,
      pipeline: options.pipeline,
      stages: stageSummaries,
      firstFailureStage: 'generation',
      firstFailureReportPath: generationReportPath,
      errorSummary: warningErrorSummary,
      combinedReportPath: path.join(options.workDir, 'combined-report.json'),
      validationSummary,
      latest: options.latest,
      latestDir,
    })
    await finalizeWorkflow(report, latestDir, [generationReportPath], options.keepRuns, options.workDir, options.latest)
    return { exitCode: generationResult.exitCode, report }
  }

  if (!generationResult.report.success) {
    const report = createWorkflowReport({
      success: false,
      pipeline: options.pipeline,
      stages: stageSummaries,
      firstFailureStage: 'generation',
      firstFailureReportPath: generationReportPath,
      errorSummary: generationResult.report.errorSummary,
      combinedReportPath: path.join(options.workDir, 'combined-report.json'),
      validationSummary,
      latest: options.latest,
      latestDir,
    })
    await finalizeWorkflow(report, latestDir, [generationReportPath], options.keepRuns, options.workDir, options.latest)
    return { exitCode: generationResult.exitCode, report }
  }

  let currentExitCode = generationResult.exitCode
  const completedReportPaths = [generationReportPath]

  for (const stage of options.pipeline) {
    if (stage === 'generation') {
      continue
    }

    if (!options.quiet && !options.json) {
      console.log(`[workflow:${stage}] starting`)
    }

    const stageMode = stageToMode(stage)
    const stageWorkDir = path.join(options.workDir, 'stages', stage)
    const stageReportPath = path.join(stageWorkDir, `${stage}-report.json`)
    const stageResult = await runNvimValidation({
      initLuaPath,
      mode: stageMode,
      workDir: stageWorkDir,
      cacheDir: options.cacheDir,
      runId: options.runId,
      keepRuns: 0,
      latest: false,
      reuseCache: options.reuseCache,
      fresh: options.fresh,
      timeoutMs: options.timeoutMs,
      postStartupWaitMs: options.postStartupWaitMs,
      nvimCommand: options.nvimCommand,
      json: false,
      verboseLog: stageMode === 'startup',
      startupTime: stageMode === 'startup',
      reportPath: stageReportPath,
      stdoutPath: path.join(stageWorkDir, `${stage}-stdout.log`),
      stderrPath: path.join(stageWorkDir, `${stage}-stderr.log`),
      verboseLogPath: path.join(stageWorkDir, `${stage}-verbose.log`),
      startuptimeLogPath: path.join(stageWorkDir, `${stage}-startuptime.log`),
      quiet: true,
      ...(options.minNvimVersion !== undefined
        ? { minNvimVersion: options.minNvimVersion }
        : {}),
      ...(stageMode !== 'syntax'
        ? { nvimReportPath: path.join(stageWorkDir, `${stage}-nvim-report.json`) }
        : {}),
    })

    completedReportPaths.push(stageReportPath)
    updateStageSummary(stageSummaries, stage, stageReportPath, stageResult.report)
    if (stage === 'startup') {
      validationSummary.startupPolicy = stageResult.report.validationPolicy
    }

    if (!stageResult.report.success) {
      const report = createWorkflowReport({
        success: false,
        pipeline: options.pipeline,
        stages: stageSummaries,
        firstFailureStage: stage,
        firstFailureReportPath: stageReportPath,
        errorSummary: stageResult.report.errorSummary,
        combinedReportPath: path.join(options.workDir, 'combined-report.json'),
        validationSummary,
        latest: options.latest,
        latestDir,
      })
      await finalizeWorkflow(report, latestDir, completedReportPaths, options.keepRuns, options.workDir, options.latest)
      return { exitCode: stageResult.exitCode, report }
    }

    currentExitCode = stageResult.exitCode
  }

  const report = createWorkflowReport({
    success: true,
    pipeline: options.pipeline,
    stages: stageSummaries,
    firstFailureStage: null,
    initLuaPath,
    combinedReportPath: path.join(options.workDir, 'combined-report.json'),
    validationSummary,
    latest: options.latest,
    latestDir,
  })
  await finalizeWorkflow(report, latestDir, completedReportPaths, options.keepRuns, options.workDir, options.latest)
  return { exitCode: currentExitCode, report }
}

function createInitialStageSummaries(
  pipeline: readonly WorkflowStageName[],
): WorkflowStageSummary[] {
  const includesStartupOrSource = pipeline.includes('startup') || pipeline.includes('source')

  return ALL_STAGES.map((stage) => {
    if (pipeline.includes(stage)) {
      return { stage, status: 'not-run' }
    }

    if (stage === 'syntax' && includesStartupOrSource) {
      return { stage, status: 'skipped' }
    }

    return { stage, status: 'not-run' }
  })
}

function updateStageSummary(
  summaries: WorkflowStageSummary[],
  stage: WorkflowStageName,
  reportPath: string,
  report:
    | { success: true; durationMs?: number; validationPolicy?: WorkflowStageSummary['validationPolicy'] }
    | {
        success: false
        durationMs?: number
        failureKind?: string
        errorSummary?: string
        validationPolicy?: WorkflowStageSummary['validationPolicy']
      },
): void {
  const summary = summaries.find((candidate) => candidate.stage === stage)
  if (summary === undefined) {
    return
  }

  summary.status = report.success ? 'passed' : 'failed'
  summary.reportPath = reportPath
  if (report.durationMs !== undefined) {
    summary.durationMs = report.durationMs
  }
  if (report.validationPolicy !== undefined) {
    summary.validationPolicy = report.validationPolicy
  }
  if (!report.success) {
    if (report.failureKind !== undefined) {
      summary.failureKind = report.failureKind
    }
    if (report.errorSummary !== undefined) {
      summary.errorSummary = report.errorSummary
    }
  }
}

function replaceStageSummary(
  summaries: WorkflowStageSummary[],
  updatedSummary: WorkflowStageSummary,
): void {
  const summaryIndex = summaries.findIndex((candidate) => candidate.stage === updatedSummary.stage)
  if (summaryIndex < 0) {
    return
  }

  summaries[summaryIndex] = updatedSummary
}

function stageToMode(stage: Exclude<WorkflowStageName, 'generation'>): NvimMode {
  switch (stage) {
    case 'syntax':
      return 'syntax'
    case 'source':
      return 'source'
    case 'startup':
      return 'startup'
  }
}

function createWorkflowReport(
  input:
    | {
        success: true
        pipeline: readonly WorkflowStageName[]
        stages: readonly WorkflowStageSummary[]
        firstFailureStage: null
        initLuaPath: string
        combinedReportPath: string
        validationSummary: CombinedWorkflowValidationSummary
        latest: boolean
        latestDir: string
      }
    | {
        success: false
        pipeline: readonly WorkflowStageName[]
        stages: readonly WorkflowStageSummary[]
        firstFailureStage: WorkflowStageName
        firstFailureReportPath: string
        errorSummary: string
        combinedReportPath: string
        validationSummary: CombinedWorkflowValidationSummary
        latest: boolean
        latestDir: string
      },
): CombinedWorkflowReport {
  if (input.success) {
    return {
      success: true,
      pipeline: input.pipeline,
      stages: input.stages,
      firstFailureStage: null,
      initLuaPath: input.initLuaPath,
      combinedReportPath: input.combinedReportPath,
      validationSummary: input.validationSummary,
      ...(input.latest ? { latestReportDir: input.latestDir } : {}),
    }
  }

  return {
    success: false,
    pipeline: input.pipeline,
    stages: input.stages,
    firstFailureStage: input.firstFailureStage,
    firstFailureReportPath: input.firstFailureReportPath,
    errorSummary: input.errorSummary,
    combinedReportPath: input.combinedReportPath,
    validationSummary: input.validationSummary,
    ...(input.latest ? { latestReportDir: input.latestDir } : {}),
  }
}

function createValidationSummary(
  requestedMode: NvimMode,
  requestedFresh: boolean,
  requestedReuseCache: boolean,
): CombinedWorkflowValidationSummary {
  return {
    requestedMode,
    requestedFresh,
    requestedReuseCache,
  }
}

async function finalizeWorkflow(
  report: CombinedWorkflowReport,
  latestDir: string,
  completedReportPaths: readonly string[],
  keepRuns: number,
  workDir: string,
  latest: boolean,
): Promise<void> {
  await writeJsonFileAtomic(report.combinedReportPath, report)

  if (latest) {
    const latestCopies = completedReportPaths.map((reportPath) => ({
      sourcePath: reportPath,
      fileName: path.basename(reportPath),
    }))
    latestCopies.push({
      sourcePath: report.combinedReportPath,
      fileName: path.basename(report.combinedReportPath),
    })
    await copyLatestReportFiles(latestDir, latestCopies)
    await writeJsonFileAtomic(path.join(latestDir, 'latest-summary.json'), {
      combinedReportPath: report.combinedReportPath,
      workDir,
    })
  }
  await pruneRunDirectories(path.dirname(workDir), keepRuns)
}

async function main(): Promise<void> {
  const parsed = parseWorkflowArgs(process.argv.slice(2))
  if (!parsed.success) {
    console.error(parsed.message)
    process.exit(parsed.exitCode)
  }

  const result = await runWorkflow(parsed.value)
  if (parsed.value.json) {
    console.log(JSON.stringify(result.report, null, 2))
  }
  process.exit(result.exitCode)
}

function isExecutedAsScript(moduleUrl: string): boolean {
  return path.resolve(process.argv[1] ?? '') === fileURLToPath(moduleUrl)
}

if (isExecutedAsScript(import.meta.url)) {
  void main()
}
