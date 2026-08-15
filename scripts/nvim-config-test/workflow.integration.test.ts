// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface MockGenerationArgs {
  initLuaPath: string
  reportPath: string
}

const runGenerationMock = vi.fn<
  (args: MockGenerationArgs) => Promise<{
    exitCode: number
    report: {
      success: true
      sourceProjectPath: string
      effectiveProjectPath: string
      projectCopyPath: string
      projectWriteMode: 'allow-copy'
      projectWriteEvents: []
      initLuaPath: string
      reportPath: string
      diagnostics: []
      metadata: {
        graphsGenerated: number
        nodesGenerated: number
        pluginsConfigured: number
        linesOfCode: number
        generationTimeMs: number
        phaseTimingsMs: {}
      }
      warningsCount: number
      errorsCount: number
    }
  }>
>()

vi.mock('./generate', () => ({
  runGeneration: runGenerationMock,
}))

describe('runWorkflow integration', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    vi.clearAllMocks()
    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('propagates fake executable startup failures through the combined workflow report', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-integration-'))
    tempRoots.push(tempRoot)
    const projectPath = path.join(tempRoot, 'project')
    const workDir = path.join(tempRoot, 'work')
    const fakeNvimPath = path.join(tempRoot, 'fake-nvim.sh')

    await fs.mkdir(projectPath, { recursive: true })
    await fs.writeFile(
      fakeNvimPath,
      [
        '#!/usr/bin/env bash',
        'if [ "$1" = "--version" ]; then',
        '  printf "NVIM v0.12.0\\n"',
        '  exit 0',
        'fi',
        'printf "Error detected while processing /tmp/init.lua:\\n" >&2',
        'printf "E5113: Lua chunk: Unknown registry type: mason\\n" >&2',
        'printf "stack traceback:\\n" >&2',
        'exit 1',
      ].join('\n'),
      'utf8',
    )
    await fs.chmod(fakeNvimPath, 0o755)

    runGenerationMock.mockImplementation(async (args) => {
      await fs.mkdir(path.dirname(args.initLuaPath), { recursive: true })
      await fs.writeFile(args.initLuaPath, 'return true\n', 'utf8')
      await fs.writeFile(args.reportPath, '{"success":true}\n', 'utf8')

      return {
        exitCode: 0,
        report: {
          success: true,
          sourceProjectPath: projectPath,
          effectiveProjectPath: projectPath,
          projectCopyPath: projectPath,
          projectWriteMode: 'allow-copy',
          projectWriteEvents: [],
          initLuaPath: args.initLuaPath,
          reportPath: args.reportPath,
          diagnostics: [],
          metadata: {
            graphsGenerated: 0,
            nodesGenerated: 0,
            pluginsConfigured: 0,
            linesOfCode: 1,
            generationTimeMs: 0,
            phaseTimingsMs: {},
          },
          warningsCount: 0,
          errorsCount: 0,
        },
      }
    })

    const { runWorkflow } = await import('./workflow')

    const result = await runWorkflow({
      projectPath,
      mode: 'startup',
      pipeline: ['generation', 'startup'],
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'fake-executable-startup',
      keepRuns: 0,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: fakeNvimPath,
      appDataRoot: path.join(tempRoot, 'app-data'),
      allowProjectWrites: false,
      useProjectCopy: true,
      failOnWarning: false,
      json: false,
      quiet: true,
    })

    expect(result.exitCode).toBe(1)
    expect(result.report.success).toBe(false)
    if (result.report.success) {
      return
    }

    expect(result.report.firstFailureStage).toBe('startup')
    expect(result.report.validationSummary.startupPolicy).toMatchObject({
      cachePolicy: 'isolated-fresh-cleared',
      postStartupWaitMs: 1000,
    })
    expect(result.report.stages).toContainEqual(
      expect.objectContaining({
        stage: 'startup',
        status: 'failed',
        failureKind: 'startup-error',
        validationPolicy: expect.objectContaining({
          cachePolicy: 'isolated-fresh-cleared',
        }),
      }),
    )
  })
})
