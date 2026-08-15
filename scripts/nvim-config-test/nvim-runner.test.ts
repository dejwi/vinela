// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

type SpawnSyncResult = { stdout: string; error?: Error }
type SpawnResult = { stdout: string; stderr: string; exitCode: number | null }
type SpawnBehavior = SpawnResult | { error: Error }

const spawnSyncMock = vi.fn<(command: string, args: string[], options: { encoding: string }) => SpawnSyncResult>()
const spawnMock = vi.fn<(command: string, args: readonly string[], options: { env: NodeJS.ProcessEnv; stdio: [string, string, string] }) => EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: (signal: string) => void }>()

vi.mock('node:child_process', () => ({
  spawnSync: spawnSyncMock,
  spawn: spawnMock,
}))

describe('runNvimValidation', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('returns exit code 2 and updates latest when init.lua is missing', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const { runNvimValidation } = await import('./nvim-runner')
    const workDir = path.join(tempRoot, 'work')
    const latestDir = path.join(tempRoot, 'latest')
    const reportPath = path.join(workDir, 'syntax-report.json')

    const result = await runNvimValidation({
      initLuaPath: path.join(tempRoot, 'missing-init.lua'),
      mode: 'syntax',
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'missing-init',
      keepRuns: 5,
      latest: true,
      reuseCache: false,
        fresh: false,
        timeoutMs: 1000,
        postStartupWaitMs: 0,
        nvimCommand: '/tmp/opencode/not-a-real-nvim',
      json: false,
      verboseLog: false,
      startupTime: false,
      quiet: true,
      latestDir,
      reportPath,
    })

    expect(result.exitCode).toBe(2)
    expect(result.report).toMatchObject({
      success: false,
      failureKind: 'missing-init',
      latestReportDir: latestDir,
    })
    expect(spawnSyncMock).not.toHaveBeenCalled()
    expect(spawnMock).not.toHaveBeenCalled()
    expect(JSON.parse(await fs.readFile(path.join(latestDir, 'latest-summary.json'), 'utf8'))).toEqual({
      reportPath,
      workDir,
      mode: 'syntax',
    })
  })

  it('finalizes missing nvim preflight reports into latest', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: '', error: new Error('spawn ENOENT') })

    const { runNvimValidation } = await import('./nvim-runner')
    const workDir = path.join(tempRoot, 'work')
    const latestDir = path.join(tempRoot, 'latest')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'syntax',
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'missing-nvim',
      keepRuns: 5,
      latest: true,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'missing-nvim',
      json: false,
      verboseLog: false,
      startupTime: false,
      quiet: true,
      latestDir,
    })

    expect(result.exitCode).toBe(4)
    expect(result.report).toMatchObject({
      success: false,
      failureKind: 'missing-nvim',
      latestReportDir: latestDir,
    })
    expect(JSON.parse(await fs.readFile(path.join(latestDir, 'latest-summary.json'), 'utf8'))).toMatchObject({
      mode: 'syntax',
      workDir,
    })
  })

  it('finalizes unsupported nvim preflight reports into latest', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.10.0' })

    const { runNvimValidation } = await import('./nvim-runner')
    const latestDir = path.join(tempRoot, 'latest')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'startup',
      workDir: path.join(tempRoot, 'work'),
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'unsupported-nvim',
      keepRuns: 5,
      latest: true,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: true,
      startupTime: true,
      quiet: true,
      latestDir,
    })

    expect(result.exitCode).toBe(6)
    expect(result.report).toMatchObject({
      success: false,
      failureKind: 'unsupported-nvim-version',
      latestReportDir: latestDir,
    })
  })

  it('adds latestReportDir to successful syntax reports', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() => createSpawnChild({ stdout: '', stderr: '', exitCode: 0 }))

    const { runNvimValidation } = await import('./nvim-runner')
    const latestDir = path.join(tempRoot, 'latest')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'syntax',
      workDir: path.join(tempRoot, 'work'),
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'success',
      keepRuns: 5,
      latest: true,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: false,
      startupTime: false,
      quiet: true,
      latestDir,
    })

    expect(result.exitCode).toBe(0)
    expect(result.report).toMatchObject({
      success: true,
      latestReportDir: latestDir,
    })
  })

  it('keeps shared cache dir untouched for standalone fresh runs', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    const cacheDir = path.join(tempRoot, 'cache')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(path.join(cacheDir, 'stale.txt'), 'stale', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() => createSpawnChild({ stdout: '', stderr: '', exitCode: 0 }))

    const { runNvimValidation } = await import('./nvim-runner')

    await runNvimValidation({
      initLuaPath,
      mode: 'syntax',
      workDir: path.join(tempRoot, 'work'),
      cacheDir,
      runId: 'fresh-cache',
      keepRuns: 5,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: false,
      startupTime: false,
      quiet: true,
    })

    await expect(fs.readFile(path.join(cacheDir, 'stale.txt'), 'utf8')).resolves.toBe('stale')
  })

  it('finalizes post-preflight spawn errors into a structured report', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    const workDir = path.join(tempRoot, 'work')
    const latestDir = path.join(tempRoot, 'latest')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() =>
      createSpawnChild({ error: new Error('spawn EACCES') }),
    )

    const { runNvimValidation } = await import('./nvim-runner')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'syntax',
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'spawn-error',
      keepRuns: 5,
      latest: true,
      reuseCache: false,
      fresh: false,
      timeoutMs: 1000,
      postStartupWaitMs: 0,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: false,
      startupTime: false,
      quiet: true,
      latestDir,
    })

    expect(result.exitCode).toBe(1)
    expect(result.report).toMatchObject({
      success: false,
      failureKind: 'process-exit',
      errorSummary: 'Failed to spawn Neovim process after version preflight',
      latestReportDir: latestDir,
      nvimVersion: '0.12.0',
    })
    if (result.report.success) {
      return
    }

    expect(result.report.errorExcerpt).toContain('spawn EACCES')
    await expect(fs.readFile(result.report.stdoutPath, 'utf8')).resolves.toBe('')
    await expect(fs.readFile(result.report.stderrPath, 'utf8')).resolves.toBe('')
    await expect(
      fs.readFile(path.join(latestDir, 'latest-summary.json'), 'utf8'),
    ).resolves.toContain('syntax-report.json')
  })

  it('uses a fresh startup prelude and reports fresh bootstrap policy', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    const workDir = path.join(tempRoot, 'work')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    await fs.mkdir(path.join(workDir, 'xdg', 'data'), { recursive: true })
    await fs.writeFile(path.join(workDir, 'xdg', 'data', 'stale.txt'), 'stale', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation((_command, _args) => createSpawnChild({ stdout: '', stderr: '', exitCode: 0 }))

    const { runNvimValidation } = await import('./nvim-runner')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'startup',
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'fresh-startup',
      keepRuns: 0,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: true,
      startupTime: true,
      quiet: true,
    })

    expect(result.report.validationPolicy).toMatchObject({
      cachePolicy: 'isolated-fresh-cleared',
      dataRootExistedBeforeRun: true,
      dataRootClearedBeforeRun: true,
      nonInteractiveInstall: true,
      packAddConfirmPolicy: 'test-prelude-confirm-false',
      postStartupWaitMs: 1000,
    })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    const spawnArgs = spawnMock.mock.calls[0]?.[1]
    expect(spawnArgs).toContain('--cmd')
    expect(spawnArgs).toContain("lua dofile(assert(vim.env.NVIM_SETTINGS_TEST_PRELUDE, 'missing prelude path'))")
    expect(spawnArgs).toContain('lua vim.wait(1000, function() return false end)')
    const preludePath = path.join(workDir, 'startup-pack-add-prelude.lua')
    await expect(fs.readFile(preludePath, 'utf8')).resolves.toContain('confirm = false')
    await expect(fs.readFile(preludePath, 'utf8')).resolves.toContain(
      'vinela startup test prelude could not wrap vim.pack.add for noninteractive bootstrap',
    )
    await expect(fs.access(path.join(workDir, 'xdg', 'data', 'stale.txt'))).rejects.toBeDefined()
  })

  it('preserves init.lua and unrelated work files during standalone fresh startup runs', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const workDir = path.join(tempRoot, 'work')
    const initLuaPath = path.join(workDir, 'init.lua')
    const unrelatedFilePath = path.join(workDir, 'notes.txt')
    const stalePluginPath = path.join(
      workDir,
      'xdg',
      'data',
      'vinela-test',
      'site',
      'pack',
      'core',
      'opt',
      'stale-plugin',
      'README.md',
    )
    await fs.mkdir(path.dirname(stalePluginPath), { recursive: true })
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    await fs.writeFile(unrelatedFilePath, 'keep me\n', 'utf8')
    await fs.writeFile(stalePluginPath, 'stale\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() => createSpawnChild({ stdout: '', stderr: '', exitCode: 0 }))

    const { runNvimValidation } = await import('./nvim-runner')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'startup',
      workDir,
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'fresh-same-work-dir',
      keepRuns: 0,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: true,
      startupTime: true,
      quiet: true,
    })

    expect(result.report.validationPolicy).toMatchObject({
      cachePolicy: 'isolated-fresh-cleared',
      dataRootExistedBeforeRun: true,
      dataRootClearedBeforeRun: true,
    })
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(result.report.mode).toBe('startup')
    await expect(fs.readFile(initLuaPath, 'utf8')).resolves.toBe('return true\n')
    await expect(fs.readFile(unrelatedFilePath, 'utf8')).resolves.toBe('keep me\n')
    await expect(fs.access(stalePluginPath)).rejects.toBeDefined()
  })

  it('classifies Mason-like startup stderr without a finalizer report', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() => createSpawnChild({
      stdout: '',
      stderr: [
        'Error detected while processing /tmp/init.lua:',
        'E5113: Lua chunk: Unknown registry type: mason',
        'stack traceback:',
        '\t.../mason-registry/sources/init.lua:12: in function',
      ].join('\n'),
      exitCode: 1,
    }))

    const { runNvimValidation } = await import('./nvim-runner')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'startup',
      workDir: path.join(tempRoot, 'work'),
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'mason-failure',
      keepRuns: 0,
      latest: false,
      reuseCache: false,
      fresh: false,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: true,
      startupTime: true,
      quiet: true,
    })

    expect(result.exitCode).toBe(1)
    expect(result.report.success).toBe(false)
    if (result.report.success) {
      return
    }

    expect(result.report.failureKind).toBe('startup-error')
    expect(result.report.errorExcerpt).toContain('Unknown registry type: mason')
    expect(result.report.validationPolicy.cachePolicy).toBe('isolated-implicit-cold')
  })

  it('classifies explicit prelude wrap failures as startup errors', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-runner-'))
    tempRoots.push(tempRoot)
    const initLuaPath = path.join(tempRoot, 'init.lua')
    await fs.writeFile(initLuaPath, 'return true\n', 'utf8')
    spawnSyncMock.mockReturnValue({ stdout: 'NVIM v0.12.0' })
    spawnMock.mockImplementation(() => createSpawnChild({
      stdout: '',
      stderr: [
        'Error detected while processing pre-vimrc command line:',
        'E5113: Error while calling lua chunk:',
        'vinela startup test prelude could not wrap vim.pack.add for noninteractive bootstrap',
        'stack traceback:',
      ].join('\n'),
      exitCode: 1,
    }))

    const { runNvimValidation } = await import('./nvim-runner')

    const result = await runNvimValidation({
      initLuaPath,
      mode: 'startup',
      workDir: path.join(tempRoot, 'work'),
      cacheDir: path.join(tempRoot, 'cache'),
      runId: 'prelude-wrap-failure',
      keepRuns: 0,
      latest: false,
      reuseCache: false,
      fresh: true,
      timeoutMs: 5000,
      postStartupWaitMs: 1000,
      nvimCommand: 'nvim',
      json: false,
      verboseLog: true,
      startupTime: true,
      quiet: true,
    })

    expect(result.exitCode).toBe(1)
    expect(result.report.success).toBe(false)
    if (result.report.success) {
      return
    }

    expect(result.report.failureKind).toBe('startup-error')
    expect(result.report.errorExcerpt).toContain(
      'vinela startup test prelude could not wrap vim.pack.add for noninteractive bootstrap',
    )
  })
})

function createSpawnChild(result: SpawnBehavior): EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: (signal: string) => void
} {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: (signal: string) => void
  }

  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = () => undefined

  queueMicrotask(() => {
    if ('error' in result) {
      child.emit('error', result.error)
      return
    }

    if (result.stdout.length > 0) {
      child.stdout.emit('data', result.stdout)
    }
    if (result.stderr.length > 0) {
      child.stderr.emit('data', result.stderr)
    }
    child.emit('close', result.exitCode)
  })

  return child
}
