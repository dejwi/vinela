// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const runGenerationMock = vi.fn()
const runNvimValidationMock = vi.fn()

vi.mock('./generate', () => ({
  runGeneration: runGenerationMock,
}))

vi.mock('./nvim-runner', () => ({
  runNvimValidation: runNvimValidationMock,
}))

describe('runWorkflow', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    vi.clearAllMocks()
    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('fails at generation when fail-on-warning returns exit code 3', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-test-'))
    tempRoots.push(tempRoot)
    const { runWorkflow } = await import('./workflow')
    const workDir = path.join(tempRoot, 'work')
    const generationReportPath = path.join(workDir, 'generation-report.json')
    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(generationReportPath, '{}\n', 'utf8')

    runGenerationMock.mockResolvedValue({
      exitCode: 3,
      report: {
        success: true,
        sourceProjectPath: '/project',
        effectiveProjectPath: '/scratch/project-copy',
        projectCopyPath: '/scratch/project-copy',
        projectWriteMode: 'allow-copy',
        projectWriteEvents: [],
        initLuaPath: path.join(tempRoot, 'init.lua'),
        reportPath: generationReportPath,
        diagnostics: [],
        metadata: {
          graphsGenerated: 0,
          nodesGenerated: 0,
          pluginsConfigured: 0,
          linesOfCode: 0,
          generationTimeMs: 0,
          phaseTimingsMs: {},
        },
        warningsCount: 1,
        errorsCount: 0,
      },
    })

    const result = await runWorkflow({
      projectPath: '/project',
      mode: 'syntax',
      pipeline: ['generation', 'syntax'],
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'warn-run',
      keepRuns: 1,
      latest: true,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'nvim',
      appDataRoot: path.join(tempRoot, 'app-data'),
      allowProjectWrites: false,
      useProjectCopy: true,
      failOnWarning: true,
      json: false,
      quiet: true,
    })

    expect(result.exitCode).toBe(3)
    expect(result.report.success).toBe(false)
    if (result.report.success) {
      return
    }

    expect(result.report.firstFailureStage).toBe('generation')
    expect(result.report.errorSummary).toBe(
      'Generation produced warnings and --fail-on-warning is enabled',
    )
    expect(result.report.stages).toContainEqual(
      expect.objectContaining({
        stage: 'generation',
        status: 'failed',
        failureKind: 'generation-warnings',
      }),
    )
    expect(runNvimValidationMock).not.toHaveBeenCalled()
  })

  it('omits latestReportDir when latest updates are disabled', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-test-'))
    tempRoots.push(tempRoot)
    const { runWorkflow } = await import('./workflow')
    const workDir = path.join(tempRoot, 'work')
    const generationReportPath = path.join(workDir, 'generation-report.json')
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(generationReportPath, '{}\n', 'utf8')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')

    runGenerationMock.mockResolvedValue({
      exitCode: 0,
      report: {
        success: true,
        sourceProjectPath: '/project',
        effectiveProjectPath: '/scratch/project-copy',
        projectCopyPath: '/scratch/project-copy',
        projectWriteMode: 'allow-copy',
        projectWriteEvents: [],
        initLuaPath,
        reportPath: generationReportPath,
        diagnostics: [],
        metadata: {
          graphsGenerated: 0,
          nodesGenerated: 0,
          pluginsConfigured: 0,
          linesOfCode: 0,
          generationTimeMs: 0,
          phaseTimingsMs: {},
        },
        warningsCount: 0,
        errorsCount: 0,
      },
    })

    runNvimValidationMock.mockResolvedValue({
      exitCode: 0,
      report: {
        success: true,
        mode: 'syntax',
        initLuaPath,
        nvimVersion: '0.12.0',
        command: ['nvim', '--headless'],
        env: { initPathEnv: initLuaPath },
        durationMs: 1,
        stdoutPath: path.join(workDir, 'syntax-stdout.log'),
        stderrPath: path.join(workDir, 'syntax-stderr.log'),
        validationPolicy: {
          mode: 'syntax',
          cachePolicy: 'none',
          cachePolicyReason: 'mode-has-no-plugin-runtime',
          pluginBootstrapExpected: false,
          nonInteractiveInstall: false,
          packAddConfirmPolicy: 'not-applicable',
          postStartupWaitMs: 0,
          timeoutMs: 1000,
          stageWorkDir: path.join(workDir, 'stages', 'syntax'),
          dataRootExistedBeforeRun: false,
          dataRootClearedBeforeRun: false,
        },
        warnings: [],
      },
    })

    const result = await runWorkflow({
      projectPath: '/project',
      mode: 'syntax',
      pipeline: ['generation', 'syntax'],
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'no-latest',
      keepRuns: 1,
      latest: false,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'nvim',
      appDataRoot: path.join(tempRoot, 'app-data'),
      allowProjectWrites: false,
      useProjectCopy: true,
      failOnWarning: false,
      json: false,
      quiet: true,
    })

    expect(result.report.success).toBe(true)
    expect('latestReportDir' in result.report).toBe(false)
    expect(result.report.validationSummary).toEqual({
      requestedMode: 'syntax',
      requestedFresh: false,
      requestedReuseCache: false,
    })
    await expect(fs.access(path.join(workDir, 'latest-summary.json'))).rejects.toBeDefined()
  })

  it('passes stage-specific work dirs and exposes startup validation policy on failure', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-test-'))
    tempRoots.push(tempRoot)
    const { runWorkflow } = await import('./workflow')
    const workDir = path.join(tempRoot, 'work')
    const generationReportPath = path.join(workDir, 'generation-report.json')
    const initLuaPath = path.join(workDir, 'init.lua')
    await fs.mkdir(workDir, { recursive: true })
    await fs.writeFile(generationReportPath, '{}\n', 'utf8')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')

    runGenerationMock.mockResolvedValue({
      exitCode: 0,
      report: {
        success: true,
        sourceProjectPath: '/project',
        effectiveProjectPath: '/scratch/project-copy',
        projectCopyPath: '/scratch/project-copy',
        projectWriteMode: 'allow-copy',
        projectWriteEvents: [],
        initLuaPath,
        reportPath: generationReportPath,
        diagnostics: [],
        metadata: {
          graphsGenerated: 0,
          nodesGenerated: 0,
          pluginsConfigured: 0,
          linesOfCode: 0,
          generationTimeMs: 0,
          phaseTimingsMs: {},
        },
        warningsCount: 0,
        errorsCount: 0,
      },
    })

    runNvimValidationMock
      .mockResolvedValueOnce({
        exitCode: 0,
        report: {
          success: true,
          mode: 'source',
          initLuaPath,
          nvimVersion: '0.12.0',
          command: ['nvim', '--headless'],
          env: { initPathEnv: initLuaPath },
          durationMs: 1,
          stdoutPath: path.join(workDir, 'stages', 'source', 'source-stdout.log'),
          stderrPath: path.join(workDir, 'stages', 'source', 'source-stderr.log'),
          warnings: [],
          validationPolicy: {
            mode: 'source',
            cachePolicy: 'isolated-implicit-cold',
            cachePolicyReason: 'new-run-dir-no-prior-cache-detected',
            pluginBootstrapExpected: false,
            nonInteractiveInstall: false,
            packAddConfirmPolicy: 'not-applicable',
            postStartupWaitMs: 0,
            timeoutMs: 5000,
            stageWorkDir: path.join(workDir, 'stages', 'source'),
            xdgDataHome: path.join(workDir, 'stages', 'source', 'xdg', 'data'),
            xdgConfigHome: path.join(workDir, 'stages', 'source', 'xdg', 'config'),
            xdgStateHome: path.join(workDir, 'stages', 'source', 'xdg', 'state'),
            xdgCacheHome: path.join(workDir, 'stages', 'source', 'xdg', 'cache'),
            packRoot: path.join(workDir, 'stages', 'source', 'xdg', 'data', 'vinela-test', 'site', 'pack', 'core', 'opt'),
            dataRootExistedBeforeRun: false,
            dataRootClearedBeforeRun: false,
          },
        },
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        report: {
          success: false,
          mode: 'startup',
          initLuaPath,
          command: ['nvim', '--headless'],
          env: { initPathEnv: initLuaPath },
          durationMs: 2,
          stdoutPath: path.join(workDir, 'stages', 'startup', 'startup-stdout.log'),
          stderrPath: path.join(workDir, 'stages', 'startup', 'startup-stderr.log'),
          failureKind: 'startup-error',
          errorSummary: 'Neovim reported a runtime startup error',
          errorExcerpt: 'Unknown registry type: mason',
          nvimVersion: '0.12.0',
          validationPolicy: {
            mode: 'startup',
            cachePolicy: 'isolated-fresh-cleared',
            cachePolicyReason: 'fresh-flag-cleared-stage-roots',
            pluginBootstrapExpected: true,
            nonInteractiveInstall: true,
            packAddConfirmPolicy: 'test-prelude-confirm-false',
            postStartupWaitMs: 1000,
            timeoutMs: 5000,
            stageWorkDir: path.join(workDir, 'stages', 'startup'),
            xdgDataHome: path.join(workDir, 'stages', 'startup', 'xdg', 'data'),
            xdgConfigHome: path.join(workDir, 'stages', 'startup', 'xdg', 'config'),
            xdgStateHome: path.join(workDir, 'stages', 'startup', 'xdg', 'state'),
            xdgCacheHome: path.join(workDir, 'stages', 'startup', 'xdg', 'cache'),
            packRoot: path.join(workDir, 'stages', 'startup', 'xdg', 'data', 'vinela-test', 'site', 'pack', 'core', 'opt'),
            dataRootExistedBeforeRun: true,
            dataRootClearedBeforeRun: true,
          },
        },
      })

    const result = await runWorkflow({
      projectPath: '/project',
      mode: 'startup',
      pipeline: ['generation', 'source', 'startup'],
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'fresh-pipeline',
      keepRuns: 1,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      appDataRoot: path.join(tempRoot, 'app-data'),
      allowProjectWrites: false,
      useProjectCopy: true,
      failOnWarning: false,
      json: false,
      quiet: true,
    })

    expect(result.report.success).toBe(false)
    const sourceCall = runNvimValidationMock.mock.calls[0]?.[0]
    const startupCall = runNvimValidationMock.mock.calls[1]?.[0]
    expect(sourceCall?.workDir).toBe(path.join(workDir, 'stages', 'source'))
    expect(startupCall?.workDir).toBe(path.join(workDir, 'stages', 'startup'))
    expect(startupCall?.fresh).toBe(true)
    if (result.report.success) {
      return
    }

    expect(result.report.validationSummary.startupPolicy).toMatchObject({
      cachePolicy: 'isolated-fresh-cleared',
      nonInteractiveInstall: true,
    })
    expect(result.report.stages).toContainEqual(
      expect.objectContaining({
        stage: 'startup',
        status: 'failed',
        validationPolicy: expect.objectContaining({
          xdgDataHome: path.join(workDir, 'stages', 'startup', 'xdg', 'data'),
        }),
      }),
    )
  })
})
