import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseNvimTestArgs } from './cli-args'
import type {
  NvimCachePolicy,
  NvimCachePolicyReason,
  NvimFinalizerReport,
  NvimIsolatedEnvSummary,
  NvimPackAddConfirmPolicy,
  NvimMode,
  NvimTestCommandArgs,
  NvimTestReport,
  NvimValidationPolicySummary,
  NvimVersionInfo,
  NvimVersionCheckResult,
} from './cli-types'
import { classifyNvimOutput } from './nvim-output-classifier'
import { createNvimFinalizerLua } from './nvim-finalizer-template'
import { createRunPathSet } from './paths'
import {
  copyLatestReportFiles,
  ensureDirectory,
  pruneRunDirectories,
  writeJsonFileAtomic,
  writeTextFileAtomic,
} from './report'

const DEFAULT_STARTUP_MIN_NVIM = '0.12.0'

export interface RunNvimValidationOptions extends NvimTestCommandArgs {
  reportPath?: string
  latestDir?: string
  stdoutPath?: string
  stderrPath?: string
  verboseLogPath?: string
  startuptimeLogPath?: string
  nvimReportPath?: string
  quiet?: boolean
}

interface StageXdgPaths {
  xdgConfigHome: string
  xdgDataHome: string
  xdgStateHome: string
  xdgCacheHome: string
  xdgRuntimeDir: string
  packRoot: string
}

interface ResolvedValidationPolicy {
  summary: NvimValidationPolicySummary
  xdgPaths?: StageXdgPaths
  preludePath?: string
}

export async function runNvimValidation(
  options: RunNvimValidationOptions,
): Promise<{ exitCode: number; report: NvimTestReport }> {
  await prepareRunDirectories(options)
  const validationPolicy = await resolveValidationPolicy(options)

  const modePrefix = options.mode
  const reportPath = options.reportPath ?? path.join(options.workDir, `${modePrefix}-report.json`)
  const stdoutPath = options.stdoutPath ?? path.join(options.workDir, `${modePrefix}-stdout.log`)
  const stderrPath = options.stderrPath ?? path.join(options.workDir, `${modePrefix}-stderr.log`)
  const verboseLogPath =
    options.verboseLog ? options.verboseLogPath ?? path.join(options.workDir, `${modePrefix}-verbose.log`) : undefined
  const startuptimeLogPath =
    options.startupTime && options.mode === 'startup'
      ? options.startuptimeLogPath ?? path.join(options.workDir, `${modePrefix}-startuptime.log`)
      : undefined
  const nvimReportPath =
    options.mode === 'syntax'
      ? undefined
      : options.nvimReportPath ?? path.join(options.workDir, `${modePrefix}-nvim-report.json`)
  const latestDir = options.latestDir ?? createRunPathSet(options.initLuaPath, options.runId).latestDir
  const command = buildNvimCommand(options, {
    validationPolicy,
    ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
    ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
  })
  const commandWithExecutable = [options.nvimCommand, ...command]

  const initFileCheck = await checkInitLuaPath(options.initLuaPath)
  if (!initFileCheck.success) {
    const report = await finalizeNvimReport({
      options,
      reportPath,
      stdoutPath,
      stderrPath,
      latestDir,
      stdout: '',
      stderr: '',
      report: {
        success: false,
        mode: options.mode,
        initLuaPath: options.initLuaPath,
        command: commandWithExecutable,
        env: { initPathEnv: options.initLuaPath },
        durationMs: 0,
        stdoutPath,
        stderrPath,
        ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
        ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
        ...(nvimReportPath !== undefined ? { nvimReportPath } : {}),
        failureKind: 'missing-init',
        errorSummary: initFileCheck.errorSummary,
        errorExcerpt: initFileCheck.errorSummary,
        validationPolicy: validationPolicy.summary,
      },
    })
    return {
      exitCode: mapReportExitCode(report),
      report,
    }
  }

  const versionCheck = checkNvimVersion(
    options.nvimCommand,
    options.mode,
    options.minNvimVersion,
  )

  const env = await buildNvimEnvironment(options, nvimReportPath, validationPolicy)

  if (versionCheck.status !== 'available') {
    const report = await finalizePreflightFailureReport({
      options,
      mode: options.mode,
      initLuaPath: options.initLuaPath,
      command,
      env: env.summary,
      stdoutPath,
      stderrPath,
      reportPath,
      latestDir,
      versionCheck,
      validationPolicy: validationPolicy.summary,
      ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
      ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
      ...(nvimReportPath !== undefined ? { nvimReportPath } : {}),
    })
    return {
      exitCode: mapPreflightExitCode(versionCheck),
      report,
    }
  }

  if (options.mode !== 'syntax' && nvimReportPath !== undefined) {
    await writeTextFileAtomic(env.finalizerPath, createNvimFinalizerLua())
  }

  const startedAt = Date.now()
  let processResult: {
    stdout: string
    stderr: string
    exitCode: number | null
    timedOut: boolean
  }

  try {
    processResult = await spawnAndCapture({
      command: options.nvimCommand,
      args: command,
      env: env.values,
      timeoutMs: options.timeoutMs,
    })
  } catch (error) {
    const report = await finalizeNvimReport({
      options,
      reportPath,
      stdoutPath,
      stderrPath,
      latestDir,
      stdout: '',
      stderr: '',
      report: {
        success: false,
        mode: options.mode,
        initLuaPath: options.initLuaPath,
        command: commandWithExecutable,
        env: env.summary,
        durationMs: Date.now() - startedAt,
        stdoutPath,
        stderrPath,
        ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
        ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
        ...(nvimReportPath !== undefined ? { nvimReportPath } : {}),
        failureKind: 'process-exit',
        errorSummary: 'Failed to spawn Neovim process after version preflight',
        errorExcerpt: trimErrorExcerpt(error),
        nvimVersion: versionCheck.info.version,
        validationPolicy: validationPolicy.summary,
      },
    })

    return {
      exitCode: mapReportExitCode(report),
      report,
    }
  }
  const durationMs = Date.now() - startedAt

  const nvimReport = await readNvimReport(nvimReportPath)
  const classification = classifyNvimOutput({
    mode: options.mode,
    exitCode: processResult.exitCode,
    timedOut: processResult.timedOut,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    nvimReport,
    versionCheck,
  })

  const report: NvimTestReport = classification.success
    ? {
        success: true,
        mode: options.mode,
        initLuaPath: options.initLuaPath,
        nvimVersion: versionCheck.info.version,
        command: commandWithExecutable,
        env: env.summary,
        durationMs,
        stdoutPath,
        stderrPath,
        ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
        ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
        ...(nvimReportPath !== undefined ? { nvimReportPath } : {}),
        validationPolicy: validationPolicy.summary,
        warnings: classification.warnings,
      }
    : {
        success: false,
        mode: options.mode,
        initLuaPath: options.initLuaPath,
        command: commandWithExecutable,
        env: env.summary,
        durationMs,
        stdoutPath,
        stderrPath,
        ...(verboseLogPath !== undefined ? { verboseLogPath } : {}),
        ...(startuptimeLogPath !== undefined ? { startuptimeLogPath } : {}),
        ...(nvimReportPath !== undefined ? { nvimReportPath } : {}),
        failureKind: classification.failureKind,
        errorSummary: classification.errorSummary,
        errorExcerpt: classification.errorExcerpt,
        nvimVersion: versionCheck.info.version,
        validationPolicy: validationPolicy.summary,
      }

  const finalizedReport = await finalizeNvimReport({
    options,
    reportPath,
    stdoutPath,
    stderrPath,
    latestDir,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    report,
  })

  if (!options.quiet && !options.json) {
    console.log(`[${options.mode}] report: ${reportPath}`)
  }

  return {
    exitCode: mapReportExitCode(finalizedReport),
    report: finalizedReport,
  }
}

function buildNvimCommand(
  options: RunNvimValidationOptions,
  paths: {
    validationPolicy: ResolvedValidationPolicy
    verboseLogPath?: string
    startuptimeLogPath?: string
  },
): string[] {
  const args: string[] = ['--headless']

  switch (options.mode) {
    case 'syntax':
      args.push(
        '-u',
        'NONE',
        '-i',
        'NONE',
        '-n',
        '-c',
        "lua local f, err = loadfile(assert(vim.env.NVIM_SETTINGS_TEST_INIT, 'missing init path')); if not f then error(err) end",
        '-c',
        'qa!',
      )
      return args
    case 'source':
      args.push(
        '-u',
        'NONE',
        '-i',
        'NONE',
        '-n',
        '-c',
        "lua dofile(assert(vim.env.NVIM_SETTINGS_TEST_INIT, 'missing init path'))",
        '-c',
        "lua dofile(assert(vim.env.NVIM_SETTINGS_TEST_FINALIZER, 'missing finalizer path'))",
      )
      return args
    case 'startup':
      if (paths.validationPolicy.preludePath !== undefined) {
        args.push(
          '--cmd',
          "lua dofile(assert(vim.env.NVIM_SETTINGS_TEST_PRELUDE, 'missing prelude path'))",
        )
      }
      args.push('-u', options.initLuaPath, '-i', 'NONE', '-n')
      if (paths.verboseLogPath !== undefined) {
        args.push(`-V1${paths.verboseLogPath}`)
      }
      if (paths.startuptimeLogPath !== undefined) {
        args.push('--startuptime', paths.startuptimeLogPath)
      }
      if (options.postStartupWaitMs > 0) {
        args.push(
          '-c',
          `lua vim.wait(${options.postStartupWaitMs}, function() return false end)`,
        )
      }
      args.push(
        '-c',
        "lua dofile(assert(vim.env.NVIM_SETTINGS_TEST_FINALIZER, 'missing finalizer path'))",
      )
      return args
  }
}

async function buildNvimEnvironment(
  options: RunNvimValidationOptions,
  nvimReportPath: string | undefined,
  validationPolicy: ResolvedValidationPolicy,
): Promise<{ values: NodeJS.ProcessEnv; summary: NvimIsolatedEnvSummary; finalizerPath: string }> {
  const finalizerPath = path.join(options.workDir, `${options.mode}-finalizer.lua`)
  const envValues: NodeJS.ProcessEnv = {
    ...process.env,
    NVIM_SETTINGS_TEST_INIT: options.initLuaPath,
  }
  const summary: NvimIsolatedEnvSummary = {
    initPathEnv: options.initLuaPath,
  }

  if (options.mode !== 'syntax' && nvimReportPath !== undefined) {
    envValues['NVIM_SETTINGS_TEST_FINALIZER'] = finalizerPath
    envValues['NVIM_SETTINGS_TEST_REPORT'] = nvimReportPath
    summary.finalizerPathEnv = finalizerPath
    summary.reportPathEnv = nvimReportPath
  }

  if (validationPolicy.preludePath !== undefined) {
    envValues['NVIM_SETTINGS_TEST_PRELUDE'] = validationPolicy.preludePath
  }

  if (validationPolicy.xdgPaths !== undefined) {
    const xdgPaths = validationPolicy.xdgPaths

    await Promise.all([
      ensureDirectory(xdgPaths.xdgConfigHome),
      ensureDirectory(xdgPaths.xdgDataHome),
      ensureDirectory(xdgPaths.xdgStateHome),
      ensureDirectory(xdgPaths.xdgCacheHome),
      ensureDirectory(xdgPaths.xdgRuntimeDir),
    ])

    envValues['XDG_CONFIG_HOME'] = xdgPaths.xdgConfigHome
    envValues['XDG_DATA_HOME'] = xdgPaths.xdgDataHome
    envValues['XDG_STATE_HOME'] = xdgPaths.xdgStateHome
    envValues['XDG_CACHE_HOME'] = xdgPaths.xdgCacheHome
    envValues['XDG_RUNTIME_DIR'] = xdgPaths.xdgRuntimeDir
    envValues['NVIM_APPNAME'] = 'vinela-test'

    summary.xdgConfigHome = xdgPaths.xdgConfigHome
    summary.xdgDataHome = xdgPaths.xdgDataHome
    summary.xdgStateHome = xdgPaths.xdgStateHome
    summary.xdgCacheHome = xdgPaths.xdgCacheHome
    summary.xdgRuntimeDir = xdgPaths.xdgRuntimeDir
    summary.nvimAppname = 'vinela-test'
  }

  return {
    values: envValues,
    summary,
    finalizerPath,
  }
}

async function resolveValidationPolicy(
  options: RunNvimValidationOptions,
): Promise<ResolvedValidationPolicy> {
  if (options.mode === 'syntax') {
    return {
      summary: {
        mode: 'syntax',
        cachePolicy: 'none',
        cachePolicyReason: 'mode-has-no-plugin-runtime',
        pluginBootstrapExpected: false,
        nonInteractiveInstall: false,
        packAddConfirmPolicy: 'not-applicable',
        postStartupWaitMs: options.postStartupWaitMs,
        timeoutMs: options.timeoutMs,
        stageWorkDir: options.workDir,
        dataRootExistedBeforeRun: false,
        dataRootClearedBeforeRun: false,
      },
    }
  }

  const xdgPaths = createStageXdgPaths(options)
  const dataRootExistedBeforeRun = await pathExists(xdgPaths.xdgDataHome)
  const stageRoots = [
    xdgPaths.xdgConfigHome,
    xdgPaths.xdgDataHome,
    xdgPaths.xdgStateHome,
    xdgPaths.xdgCacheHome,
    xdgPaths.xdgRuntimeDir,
  ]

  let cachePolicy: NvimCachePolicy
  let cachePolicyReason: NvimCachePolicyReason
  let dataRootClearedBeforeRun = false

  if (options.fresh) {
    await Promise.all(stageRoots.map((rootPath) => fs.rm(rootPath, { recursive: true, force: true })))
    cachePolicy = 'isolated-fresh-cleared'
    cachePolicyReason = 'fresh-flag-cleared-stage-roots'
    dataRootClearedBeforeRun = true
  } else if (options.reuseCache) {
    cachePolicy = 'isolated-reused'
    cachePolicyReason = 'reuse-cache-flag'
  } else if (dataRootExistedBeforeRun) {
    cachePolicy = 'isolated-reused'
    cachePolicyReason = 'stable-work-dir-existing-cache'
  } else {
    cachePolicy = 'isolated-implicit-cold'
    cachePolicyReason = 'new-run-dir-no-prior-cache-detected'
  }

  const isFreshStartup = options.mode === 'startup' && cachePolicy === 'isolated-fresh-cleared'
  const preludePath = isFreshStartup ? path.join(options.workDir, 'startup-pack-add-prelude.lua') : undefined
  if (preludePath !== undefined) {
    await writeTextFileAtomic(preludePath, createPackAddPreludeLua())
  }

  return {
    summary: {
      mode: options.mode,
      cachePolicy,
      cachePolicyReason,
      pluginBootstrapExpected: options.mode === 'startup',
      nonInteractiveInstall: isFreshStartup,
      packAddConfirmPolicy: resolvePackAddConfirmPolicy(options.mode, isFreshStartup),
      postStartupWaitMs: options.postStartupWaitMs,
      timeoutMs: options.timeoutMs,
      stageWorkDir: options.workDir,
      xdgDataHome: xdgPaths.xdgDataHome,
      xdgConfigHome: xdgPaths.xdgConfigHome,
      xdgStateHome: xdgPaths.xdgStateHome,
      xdgCacheHome: xdgPaths.xdgCacheHome,
      packRoot: xdgPaths.packRoot,
      dataRootExistedBeforeRun,
      dataRootClearedBeforeRun,
    },
    xdgPaths,
    ...(preludePath !== undefined ? { preludePath } : {}),
  }
}

function createStageXdgPaths(options: RunNvimValidationOptions): StageXdgPaths {
  const xdgRoot = options.reuseCache ? path.join(options.cacheDir, options.mode, 'xdg') : path.join(options.workDir, 'xdg')
  const xdgDataHome = path.join(xdgRoot, 'data')

  return {
    xdgConfigHome: path.join(xdgRoot, 'config'),
    xdgDataHome,
    xdgStateHome: path.join(xdgRoot, 'state'),
    xdgCacheHome: path.join(xdgRoot, 'cache'),
    xdgRuntimeDir: path.join(xdgRoot, 'run'),
    packRoot: path.join(xdgDataHome, 'vinela-test', 'site', 'pack', 'core', 'opt'),
  }
}

function resolvePackAddConfirmPolicy(
  mode: NvimMode,
  isFreshStartup: boolean,
): NvimPackAddConfirmPolicy {
  if (mode !== 'startup') {
    return 'not-applicable'
  }

  return isFreshStartup ? 'test-prelude-confirm-false' : 'interactive-default'
}

function createPackAddPreludeLua(): string {
  return `
local original_pack_add = vim.pack and vim.pack.add
if type(original_pack_add) ~= 'function' then
  error('vinela startup test prelude could not wrap vim.pack.add for noninteractive bootstrap')
end

vim.pack.add = function(specs, opts)
  local effective_opts = opts or {}
  if effective_opts.confirm == nil then
    effective_opts = vim.tbl_extend('force', effective_opts, { confirm = false })
  end
  return original_pack_add(specs, effective_opts)
end
`.trimStart()
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function checkNvimVersion(
  nvimCommand: string,
  mode: NvimMode,
  minNvimVersion?: string,
): NvimVersionCheckResult {
  const versionOutput = spawnSync(nvimCommand, ['--version'], { encoding: 'utf8' })

  if (versionOutput.error !== undefined) {
    return {
      status: 'missing',
      command: nvimCommand,
      errorSummary: versionOutput.error.message,
    }
  }

  const raw = versionOutput.stdout.trim()
  const info = parseNvimVersion(raw)
  if (info === null) {
    return {
      status: 'missing',
      command: nvimCommand,
      errorSummary: 'Unable to parse `nvim --version` output',
    }
  }

  const requiredVersion = minNvimVersion ?? (mode === 'syntax' ? undefined : DEFAULT_STARTUP_MIN_NVIM)
  if (requiredVersion !== undefined && compareVersions(info.version, requiredVersion) < 0) {
    return {
      status: 'unsupported',
      command: nvimCommand,
      info,
      minimumVersion: requiredVersion,
      errorSummary: `Neovim ${info.version} found, but >=${requiredVersion} is required for ${mode} validation of vim.pack-based generated configs`,
    }
  }

  return {
    status: 'available',
    info,
  }
}

export function parseNvimVersion(rawOutput: string): NvimVersionInfo | null {
  const match = rawOutput.match(/NVIM\s+v?(\d+)\.(\d+)\.(\d+)/i)
  if (match === null) {
    return null
  }

  const majorText = match[1]
  const minorText = match[2]
  const patchText = match[3]
  if (majorText === undefined || minorText === undefined || patchText === undefined) {
    return null
  }
  return {
    raw: rawOutput,
    version: `${majorText}.${minorText}.${patchText}`,
    major: Number.parseInt(majorText, 10),
    minor: Number.parseInt(minorText, 10),
    patch: Number.parseInt(patchText, 10),
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10))
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10))

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftParts[index] ?? 0
    const rightPart = rightParts[index] ?? 0
    if (leftPart !== rightPart) {
      return leftPart - rightPart
    }
  }

  return 0
}

async function spawnAndCapture(input: {
  command: string
  args: readonly string[]
  env: NodeJS.ProcessEnv
  timeoutMs: number
}): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      env: input.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, input.timeoutMs)

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode, timedOut })
    })
  })
}

async function readNvimReport(reportPath: string | undefined): Promise<NvimFinalizerReport | null> {
  if (reportPath === undefined) {
    return null
  }

  try {
    const raw = await fs.readFile(reportPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return isNvimFinalizerReport(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isNvimFinalizerReport(value: unknown): value is NvimFinalizerReport {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as {
    version?: unknown
    vErrmsg?: unknown
    messages?: unknown
    runtimepath?: unknown
    packpath?: unknown
    data?: unknown
    config?: unknown
    state?: unknown
    cache?: unknown
    packRoot?: unknown
    packPlugins?: unknown
  }
  return typeof candidate['version'] === 'string' &&
    typeof candidate['vErrmsg'] === 'string' &&
    typeof candidate['messages'] === 'string' &&
    typeof candidate['runtimepath'] === 'string' &&
    typeof candidate['packpath'] === 'string' &&
    typeof candidate['data'] === 'string' &&
    typeof candidate['config'] === 'string' &&
    typeof candidate['state'] === 'string' &&
    typeof candidate['cache'] === 'string' &&
    typeof candidate['packRoot'] === 'string' &&
    Array.isArray(candidate['packPlugins']) &&
    candidate['packPlugins'].every((item) => typeof item === 'string')
}

function trimErrorExcerpt(error: unknown): string {
  const raw = error instanceof Error ? error.stack ?? error.message : String(error)
  const trimmed = raw.trim()
  if (trimmed.length <= 400) {
    return trimmed
  }

  return `${trimmed.slice(0, 397)}...`
}

async function finalizePreflightFailureReport(input: {
  options: RunNvimValidationOptions
  mode: NvimMode
  initLuaPath: string
  command: readonly string[]
  env: NvimIsolatedEnvSummary
  stdoutPath: string
  stderrPath: string
  verboseLogPath?: string
  startuptimeLogPath?: string
  nvimReportPath?: string
  reportPath: string
  latestDir: string
  versionCheck: Exclude<NvimVersionCheckResult, { status: 'available' }>
  validationPolicy: NvimValidationPolicySummary
}): Promise<NvimTestReport> {
  return finalizeNvimReport({
    options: input.options,
    reportPath: input.reportPath,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    latestDir: input.latestDir,
    stdout: '',
    stderr: '',
    report: {
    success: false,
    mode: input.mode,
    initLuaPath: input.initLuaPath,
    command: [input.versionCheck.command, ...input.command],
    env: input.env,
    durationMs: 0,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    ...(input.verboseLogPath !== undefined ? { verboseLogPath: input.verboseLogPath } : {}),
    ...(input.startuptimeLogPath !== undefined ? { startuptimeLogPath: input.startuptimeLogPath } : {}),
    ...(input.nvimReportPath !== undefined ? { nvimReportPath: input.nvimReportPath } : {}),
    validationPolicy: input.validationPolicy,
    failureKind:
      input.versionCheck.status === 'missing'
        ? 'missing-nvim'
        : 'unsupported-nvim-version',
    errorSummary: input.versionCheck.errorSummary,
    errorExcerpt: input.versionCheck.errorSummary,
      ...(input.versionCheck.status === 'unsupported'
        ? { nvimVersion: input.versionCheck.info.version }
        : {}),
    },
  })
}

function mapReportExitCode(report: NvimTestReport): number {
  if (report.success) {
    return 0
  }

  switch (report.failureKind) {
    case 'missing-init':
      return 2
    case 'missing-nvim':
      return 4
    case 'timeout':
      return 5
    case 'unsupported-nvim-version':
      return 6
    default:
      return 1
  }
}

function mapPreflightExitCode(versionCheck: Exclude<NvimVersionCheckResult, { status: 'available' }>): number {
  return versionCheck.status === 'missing' ? 4 : 6
}

async function prepareRunDirectories(options: RunNvimValidationOptions): Promise<void> {
  await Promise.all([ensureDirectory(options.workDir), ensureDirectory(options.cacheDir)])
}

async function checkInitLuaPath(
  initLuaPath: string,
): Promise<{ success: true } | { success: false; errorSummary: string }> {
  try {
    const stats = await fs.stat(initLuaPath)
    if (!stats.isFile()) {
      return {
        success: false,
        errorSummary: '--init path is not a file',
      }
    }

    return { success: true }
  } catch {
    return {
      success: false,
      errorSummary: 'init.lua not found',
    }
  }
}

async function finalizeNvimReport(input: {
  options: RunNvimValidationOptions
  reportPath: string
  stdoutPath: string
  stderrPath: string
  latestDir: string
  stdout: string
  stderr: string
  report: NvimTestReport
}): Promise<NvimTestReport> {
  await writeTextFileAtomic(input.stdoutPath, input.stdout)
  await writeTextFileAtomic(input.stderrPath, input.stderr)

  const finalizedReport: NvimTestReport = input.options.latest
    ? {
        ...input.report,
        latestReportDir: input.latestDir,
      }
    : input.report

  await writeJsonFileAtomic(input.reportPath, finalizedReport)

  if (input.options.latest) {
    await copyLatestReportFiles(input.latestDir, [
      { sourcePath: input.reportPath, fileName: path.basename(input.reportPath) },
    ])
    await writeJsonFileAtomic(path.join(input.latestDir, 'latest-summary.json'), {
      reportPath: input.reportPath,
      workDir: input.options.workDir,
      mode: input.options.mode,
    })
  }

  await pruneRunDirectories(path.dirname(input.options.workDir), input.options.keepRuns)
  return finalizedReport
}

async function main(): Promise<void> {
  const parsed = parseNvimTestArgs(process.argv.slice(2))
  if (!parsed.success) {
    console.error(parsed.message)
    process.exit(parsed.exitCode)
  }

  const result = await runNvimValidation(parsed.value)
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
