import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasErrors, hasWarnings, type GenerationMetadata } from '@/features/lua-generator/types'
import {
  resetStorageBackendForRuntime,
  setStorageBackendForRuntime,
} from '@/shared/lib/storage'
import type { NodeStorageBackend } from '../lib/node-storage-backend'
import { NodeStorageBackend as RuntimeNodeStorageBackend } from '../lib/node-storage-backend'
import { parseGenerateArgs } from './cli-args'
import type {
  GenerateCommandArgs,
  GenerationCliFailureKind,
  GenerationCliReport,
  ProjectWriteMode,
} from './cli-types'
import { copyProjectToScratch } from './project-copy'
import { ensureDirectory, writeJsonFileAtomic, writeTextFileAtomic } from './report'

export interface RunGenerationOptions extends GenerateCommandArgs {
  stdout?: Pick<typeof console, 'log' | 'error'>
}

export async function runGeneration(
  options: RunGenerationOptions,
): Promise<{ exitCode: number; report: GenerationCliReport }> {
  if (options.useProjectCopy && options.allowProjectWrites) {
    const report = await writeFailureReport({
      sourceProjectPath: options.projectPath,
      reportPath: options.reportPath,
      projectWriteMode: 'allow-copy',
      failureKind: 'invalid-project',
      errorSummary: '--allow-project-writes requires --no-project-copy',
    })
    return { exitCode: 2, report }
  }

  const projectWriteMode: ProjectWriteMode = options.useProjectCopy
    ? 'allow-copy'
    : options.allowProjectWrites
      ? 'allow-source'
      : 'deny'

  const projectCopyPath = options.useProjectCopy
    ? path.join(options.outDir, 'project-copy')
    : undefined

  if (projectCopyPath !== undefined) {
    try {
      await copyProjectToScratch(options.projectPath, projectCopyPath)
    } catch (error) {
      const reportPath = resolveSafeFailureReportPath(options.projectPath, options.reportPath)
      const report = await writeFailureReport({
        sourceProjectPath: options.projectPath,
        reportPath,
        projectCopyPath,
        projectWriteMode,
        failureKind: 'project-copy-failed',
        errorSummary: error instanceof Error ? error.message : String(error),
      })
      return { exitCode: 1, report }
    }
  }

  await ensureDirectory(options.outDir)

  const effectiveProjectPath = projectCopyPath ?? options.projectPath
  const backend = new RuntimeNodeStorageBackend({
    appDataRoot: options.appDataRoot,
    sourceProjectRoot: options.projectPath,
    activeProjectRoot: effectiveProjectPath,
    projectWriteMode,
  })

  if (!(await backend.isValidProject(effectiveProjectPath))) {
    const report = await writeFailureReport({
      sourceProjectPath: options.projectPath,
      effectiveProjectPath,
      reportPath: options.reportPath,
      projectWriteMode,
      projectWriteEvents: backend.getProjectWriteEvents(),
      ...(projectCopyPath !== undefined ? { projectCopyPath } : {}),
      failureKind: 'invalid-project',
      errorSummary: `Invalid project path: ${effectiveProjectPath}`,
    })
    return { exitCode: 2, report }
  }

  setStorageBackendForRuntime(backend)

  try {
    const { generateInitLua } = await import('@/features/lua-generator/orchestrator')
    const generationResult = await generateInitLua({ projectPath: effectiveProjectPath })
    const projectWriteEvents = backend.getProjectWriteEvents()
    const deniedWrites = backend.hasDeniedProjectWrites()

    if (generationResult.success) {
      await writeTextFileAtomic(options.initLuaPath, generationResult.initLua)
    }

    const warningsCount = countWarnings(generationResult.diagnostics)
    const errorsCount = countErrors(generationResult.diagnostics)

    let report: GenerationCliReport
    if (deniedWrites && projectWriteMode === 'deny') {
      report = {
        success: false,
        sourceProjectPath: options.projectPath,
        effectiveProjectPath,
        ...(projectCopyPath !== undefined ? { projectCopyPath } : {}),
        projectWriteMode,
        projectWriteEvents,
        ...(generationResult.success ? { initLuaPath: options.initLuaPath } : {}),
        reportPath: options.reportPath,
        diagnostics: [...generationResult.diagnostics],
        metadata: generationResult.metadata,
        warningsCount,
        errorsCount: Math.max(errorsCount, 1),
        failureKind: 'project-write-denied',
        errorSummary: 'Project write denied during read-only generation',
      }
      await writeJsonFileAtomic(options.reportPath, report)
      return { exitCode: 1, report }
    }

    if (!generationResult.success || hasErrors(generationResult.diagnostics)) {
      report = {
        success: false,
        sourceProjectPath: options.projectPath,
        effectiveProjectPath,
        ...(projectCopyPath !== undefined ? { projectCopyPath } : {}),
        projectWriteMode,
        projectWriteEvents,
        ...(generationResult.success ? { initLuaPath: options.initLuaPath } : {}),
        reportPath: options.reportPath,
        diagnostics: [...generationResult.diagnostics],
        metadata: generationResult.metadata,
        warningsCount,
        errorsCount: Math.max(errorsCount, 1),
        failureKind: 'generation-diagnostics',
        errorSummary: 'Generation failed due to diagnostics',
      }
      await writeJsonFileAtomic(options.reportPath, report)
      return { exitCode: 1, report }
    }

    report = {
      success: true,
      sourceProjectPath: options.projectPath,
      effectiveProjectPath,
      ...(projectCopyPath !== undefined ? { projectCopyPath } : {}),
      projectWriteMode,
      projectWriteEvents,
      initLuaPath: options.initLuaPath,
      reportPath: options.reportPath,
      diagnostics: [...generationResult.diagnostics],
      metadata: generationResult.metadata,
      warningsCount,
      errorsCount: 0,
    }
    await writeJsonFileAtomic(options.reportPath, report)

    if (!options.quiet && !options.json) {
      options.stdout?.log?.(`[generation] report: ${options.reportPath}`)
      options.stdout?.log?.(`[generation] init.lua: ${options.initLuaPath}`)
    }

    return {
      exitCode: options.failOnWarning && hasWarnings(generationResult.diagnostics) ? 3 : 0,
      report,
    }
  } catch (error) {
    const report = await writeFailureReport({
      sourceProjectPath: options.projectPath,
      effectiveProjectPath,
      reportPath: options.reportPath,
      projectWriteMode,
      projectWriteEvents: backend.getProjectWriteEvents(),
      ...(projectCopyPath !== undefined ? { projectCopyPath } : {}),
      failureKind: 'unexpected-error',
      errorSummary: error instanceof Error ? error.message : String(error),
    })
    return { exitCode: 1, report }
  } finally {
    resetStorageBackendForRuntime()
  }
}

function resolveSafeFailureReportPath(sourceProjectPath: string, preferredReportPath: string): string {
  const resolvedSourceProjectPath = path.resolve(sourceProjectPath)
  const resolvedPreferredReportPath = path.resolve(preferredReportPath)

  if (!isPathInsideOrEqual(resolvedSourceProjectPath, resolvedPreferredReportPath)) {
    return resolvedPreferredReportPath
  }

  return path.join(
    os.tmpdir(),
    'vinela-generate-failures',
    `${path.basename(sourceProjectPath)}-${Date.now()}-generation-report.json`,
  )
}

function isPathInsideOrEqual(rootPath: string, targetPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath)
  return (
    relativePath.length === 0 ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  )
}

async function writeFailureReport(input: {
  sourceProjectPath: string
  effectiveProjectPath?: string
  projectCopyPath?: string
  reportPath: string
  projectWriteMode: ProjectWriteMode
  projectWriteEvents?: ReturnType<NodeStorageBackend['getProjectWriteEvents']>
  failureKind: GenerationCliFailureKind
  errorSummary: string
}): Promise<GenerationCliReport> {
  const report: GenerationCliReport = {
    success: false,
    sourceProjectPath: input.sourceProjectPath,
    ...(input.effectiveProjectPath !== undefined
      ? { effectiveProjectPath: input.effectiveProjectPath }
      : {}),
    ...(input.projectCopyPath !== undefined
      ? { projectCopyPath: input.projectCopyPath }
      : {}),
    projectWriteMode: input.projectWriteMode,
    projectWriteEvents: input.projectWriteEvents ?? [],
    reportPath: input.reportPath,
    diagnostics: [],
    metadata: emptyMetadata(),
    warningsCount: 0,
    errorsCount: 1,
    failureKind: input.failureKind,
    errorSummary: input.errorSummary,
  }
  await writeJsonFileAtomic(input.reportPath, report)
  return report
}

function emptyMetadata(): GenerationMetadata {
  return {
    graphsGenerated: 0,
    nodesGenerated: 0,
    pluginsConfigured: 0,
    linesOfCode: 0,
    generationTimeMs: 0,
    phaseTimingsMs: {},
  }
}

function countWarnings(reportDiagnostics: readonly { severity: 'error' | 'warning' }[]): number {
  return reportDiagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
}

function countErrors(reportDiagnostics: readonly { severity: 'error' | 'warning' }[]): number {
  return reportDiagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
}

async function main(): Promise<void> {
  const parsed = parseGenerateArgs(process.argv.slice(2))
  if (!parsed.success) {
    console.error(parsed.message)
    process.exit(parsed.exitCode)
  }

  const result = await runGeneration({
    ...parsed.value,
    stdout: console,
  })

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
