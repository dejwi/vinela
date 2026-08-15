/**
 * Lua Syntax Assertion Utility
 *
 * Node.js-native async assertion helper that validates generated Lua syntax
 * using a Neovim-compatible oracle (LuaJIT / Lua 5.1 dialect). Uses only Node
 * built-ins — no Tauri imports.
 *
 * Designed for use in Vitest integration tests (Node.js environment).
 * The existing lua-validator.ts uses Tauri shell plugin imports which are
 * unavailable in the Vitest runner — use this file instead for test-side
 * syntax validation.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertBlocksBalanced as assertBlocksBalancedFromUtil } from './block-balance'
import { defaultCommandRunner } from './lua-syntax-command-runner'

// ============================================
// Public Types
// ============================================

export type LuaSyntaxToolEngine =
  | 'nvim'
  | 'luajit'
  | 'luac5.1'
  | 'lua5.1'
  | 'compatible-luac'

export type LuaSyntaxCommandRejection =
  | {
      stage: 'identity'
      command: string
      reason:
        | 'not-found'
        | 'unsupported-command'
        | 'incompatible-version'
        | 'version-probe-failed'
      detail: string
    }
  | {
      stage: 'capability'
      command: string
      engine: LuaSyntaxToolEngine
      reason: 'nonzero-exit' | 'timeout' | 'spawn-error'
      invocation: readonly string[]
      detail: string
    }

export type LuaSyntaxTool =
  | {
      available: true
      engine: LuaSyntaxToolEngine
      command: string
      version: string
      dialect: 'neovim-lua51'
      searchedCommands: readonly string[]
      rejectedCommands: readonly LuaSyntaxCommandRejection[]
    }
  | {
      available: false
      searchedCommands: readonly string[]
      rejectedCommands: readonly LuaSyntaxCommandRejection[]
    }

export type LuaSyntaxCommandRunResult =
  | { success: true; stdout: string; stderr: string }
  | {
      success: false
      reason: 'not-found' | 'nonzero-exit' | 'timeout' | 'spawn-error'
      stdout: string
      stderr: string
      detail: string
    }

export type LuaSyntaxCommandRunner = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<LuaSyntaxCommandRunResult>

export interface LuaSyntaxDetectionOptions {
  runner?: LuaSyntaxCommandRunner
  env?: NodeJS.ProcessEnv
}

export interface LuaSyntaxAssertOptions {
  /**
   * Milliseconds before the syntax-check subprocess is killed.
   * Default: 10_000 (10 seconds).
   */
  timeoutMs?: number
  /**
   * When true, the temp file is NOT deleted after a syntax failure.
   * The file path is included in the error message for manual inspection.
   * Default: false (always clean up).
   */
  keepTempFileOnFailure?: boolean
}

export const NOOP_LUA_SYNTAX_CHECK = 'return nil\n'

const SEARCH_ORDER = ['nvim', 'luajit', 'luac5.1', 'lua5.1', 'luac'] as const

const SUPPORTED_OVERRIDE_BASENAMES = new Set([
  'nvim',
  'luajit',
  'luac5.1',
  'lua5.1',
  'luac',
])

const LOADFILE_VALIDATOR_LUA = `local check_path = arg[1]
if check_path == nil then
  io.stderr:write("missing check path\\n")
  os.exit(1)
end
local _, err = loadfile(check_path)
if err ~= nil then
  io.stderr:write(err .. "\\n")
  os.exit(1)
end
os.exit(0)
`

const CI_INSTALL_HINT =
  'Install a Neovim-compatible checker: `apt install neovim luajit lua5.1` (CI), `brew install neovim luajit lua@5.1` (macOS), or set VINELA_LUA_SYNTAX_CHECKER to nvim/luajit/luac5.1/lua5.1/luac.'

const VERSION_PROBE_TIMEOUT_MS = 5_000
/** Bounded no-op capability probe; must stay below Vitest test/hook timeouts. */
export const CAPABILITY_PROBE_TIMEOUT_MS = 2_000
/** Per-assertion syntax-check budget for large generated fixtures. */
export const SYNTAX_CHECK_TIMEOUT_MS = 10_000

// ============================================
// Module-level probe cache
// ============================================

let luaSyntaxToolCache: LuaSyntaxTool | undefined
let probePromise: Promise<LuaSyntaxTool> | undefined

interface LuaSyntaxProbeWorkspace {
  workDir: string
  checkFile: string
  validatorFile: string
  bytecodeFile: string
}

function conciseDetail(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return '(no output)'
  }
  const lines = trimmed.split('\n')
  const first = lines[0] ?? trimmed
  if (first.length > 200) {
    return `${first.slice(0, 197)}...`
  }
  return first
}

function isCompatibleLuacVersion(versionOutput: string): boolean {
  const normalized = versionOutput.toLowerCase()
  if (normalized.includes('lua 5.1') || normalized.includes('luajit')) {
    return true
  }
  if (/lua 5\.[2-9]/.test(normalized)) {
    return false
  }
  return false
}

function isRejectedLuacVersion(versionOutput: string): boolean {
  const normalized = versionOutput.toLowerCase()
  return /lua 5\.[4-9]/.test(normalized) || normalized.includes('lua 5.4')
}

function commandBasename(command: string): string {
  return command.split('/').pop() ?? command
}

function resolveEngineForCommand(
  command: string,
  version: string,
): LuaSyntaxToolEngine | null {
  const base = commandBasename(command)
  if (base === 'nvim') return 'nvim'
  if (base === 'luajit') return 'luajit'
  if (base === 'luac5.1') return 'luac5.1'
  if (base === 'lua5.1') return 'lua5.1'
  if (base === 'luac' && isCompatibleLuacVersion(version)) {
    return 'compatible-luac'
  }
  return null
}

function buildValidationInvocation(
  engine: LuaSyntaxToolEngine,
  workspace: LuaSyntaxProbeWorkspace,
): readonly string[] {
  switch (engine) {
    case 'nvim':
      return [
        '--headless',
        '-u',
        'NONE',
        '-i',
        'NONE',
        '-n',
        '-l',
        workspace.validatorFile,
        workspace.checkFile,
      ]
    case 'luajit':
      return ['-b', workspace.checkFile, workspace.bytecodeFile]
    case 'luac5.1':
    case 'compatible-luac':
      return ['-p', workspace.checkFile]
    case 'lua5.1':
      return [workspace.validatorFile, workspace.checkFile]
  }
}

async function createProbeWorkspace(): Promise<LuaSyntaxProbeWorkspace> {
  const workDir = await mkdtemp(join(tmpdir(), 'vinela-lua-probe-'))
  const checkFile = join(workDir, 'check.lua')
  const validatorFile = join(workDir, 'vinela-lua-syntax-validator.lua')
  const bytecodeFile = join(workDir, 'check.luac')

  await writeFile(checkFile, NOOP_LUA_SYNTAX_CHECK, 'utf8')
  await writeFile(validatorFile, LOADFILE_VALIDATOR_LUA, 'utf8')

  return { workDir, checkFile, validatorFile, bytecodeFile }
}

async function probeCommandVersion(
  runner: LuaSyntaxCommandRunner,
  command: string,
  args: readonly string[] = ['-v'],
): Promise<LuaSyntaxCommandRunResult> {
  return runner(command, args, VERSION_PROBE_TIMEOUT_MS)
}

interface CandidateProbeSuccess {
  engine: LuaSyntaxToolEngine
  command: string
  version: string
}

type CandidateProbeResult =
  | { success: true; data: CandidateProbeSuccess }
  | { success: false; rejection: LuaSyntaxCommandRejection }

async function probeCandidate(
  runner: LuaSyntaxCommandRunner,
  command: string,
  workspace: LuaSyntaxProbeWorkspace,
  options: { requireSupportedBasename: boolean },
): Promise<CandidateProbeResult> {
  const base = commandBasename(command)

  if (
    options.requireSupportedBasename &&
    !SUPPORTED_OVERRIDE_BASENAMES.has(base)
  ) {
    return {
      success: false,
      rejection: {
        stage: 'identity',
        command,
        reason: 'unsupported-command',
        detail: `unsupported override basename: ${base}`,
      },
    }
  }

  const versionResult = await probeCommandVersion(runner, command)
  if (!versionResult.success) {
    if (versionResult.reason === 'not-found') {
      return {
        success: false,
        rejection: {
          stage: 'identity',
          command,
          reason: 'not-found',
          detail: versionResult.detail,
        },
      }
    }

    return {
      success: false,
      rejection: {
        stage: 'identity',
        command,
        reason: 'version-probe-failed',
        detail: versionResult.detail,
      },
    }
  }

  const versionOutput =
    `${versionResult.stdout}\n${versionResult.stderr}`.trim()
  if (versionOutput.length === 0) {
    return {
      success: false,
      rejection: {
        stage: 'identity',
        command,
        reason: 'version-probe-failed',
        detail: 'version probe produced no output',
      },
    }
  }

  if (base === 'luac' && isRejectedLuacVersion(versionOutput)) {
    return {
      success: false,
      rejection: {
        stage: 'identity',
        command,
        reason: 'incompatible-version',
        detail: conciseDetail(versionOutput),
      },
    }
  }

  const engine = resolveEngineForCommand(command, versionOutput)
  if (engine === null) {
    return {
      success: false,
      rejection: {
        stage: 'identity',
        command,
        reason: 'incompatible-version',
        detail: conciseDetail(versionOutput),
      },
    }
  }

  const invocation = buildValidationInvocation(engine, workspace)
  const capabilityResult = await runner(
    command,
    invocation,
    CAPABILITY_PROBE_TIMEOUT_MS,
  )

  if (!capabilityResult.success) {
    const capabilityReason =
      capabilityResult.reason === 'not-found'
        ? 'spawn-error'
        : capabilityResult.reason

    return {
      success: false,
      rejection: {
        stage: 'capability',
        command,
        engine,
        reason: capabilityReason,
        invocation,
        detail: capabilityResult.detail,
      },
    }
  }

  return {
    success: true,
    data: {
      engine,
      command,
      version: versionOutput.split('\n')[0] ?? versionOutput,
    },
  }
}

async function appendLua54DiagnosticRejections(
  runner: LuaSyntaxCommandRunner,
  rejectedCommands: LuaSyntaxCommandRejection[],
): Promise<void> {
  const luac54Version = await probeCommandVersion(runner, 'luac5.4')
  if (luac54Version.success) {
    const versionOutput =
      `${luac54Version.stdout}\n${luac54Version.stderr}`.trim()
    if (isRejectedLuacVersion(versionOutput)) {
      rejectedCommands.push({
        stage: 'identity',
        command: 'luac5.4',
        reason: 'incompatible-version',
        detail: conciseDetail(versionOutput),
      })
    }
  }
}

/**
 * Detect a Neovim-compatible Lua syntax checker without using the module cache.
 * Accepts an injectable command runner for deterministic tests.
 */
export async function detectLuaSyntaxToolUncached(
  options?: LuaSyntaxDetectionOptions,
): Promise<LuaSyntaxTool> {
  const runner = options?.runner ?? defaultCommandRunner
  const env = options?.env ?? process.env
  const searchedCommands: string[] = []
  const rejectedCommands: LuaSyntaxCommandRejection[] = []

  const workspace = await createProbeWorkspace()

  try {
    const configured = env['VINELA_LUA_SYNTAX_CHECKER']?.trim()
    if (configured !== undefined && configured.length > 0) {
      searchedCommands.push(configured)
      const overrideResult = await probeCandidate(
        runner,
        configured,
        workspace,
        {
          requireSupportedBasename: true,
        },
      )

      if (overrideResult.success) {
        return {
          available: true,
          engine: overrideResult.data.engine,
          command: overrideResult.data.command,
          version: overrideResult.data.version,
          dialect: 'neovim-lua51',
          searchedCommands,
          rejectedCommands,
        }
      }

      rejectedCommands.push(overrideResult.rejection)
      return {
        available: false,
        searchedCommands,
        rejectedCommands,
      }
    }

    for (const command of SEARCH_ORDER) {
      searchedCommands.push(command)
      const candidateResult = await probeCandidate(runner, command, workspace, {
        requireSupportedBasename: false,
      })

      if (candidateResult.success) {
        return {
          available: true,
          engine: candidateResult.data.engine,
          command: candidateResult.data.command,
          version: candidateResult.data.version,
          dialect: 'neovim-lua51',
          searchedCommands,
          rejectedCommands,
        }
      }

      rejectedCommands.push(candidateResult.rejection)
    }

    await appendLua54DiagnosticRejections(runner, rejectedCommands)

    return {
      available: false,
      searchedCommands,
      rejectedCommands,
    }
  } finally {
    try {
      await rm(workspace.workDir, { recursive: true, force: true })
    } catch {
      // Cleanup errors must not hide the detector result
    }
  }
}

/**
 * Detect a Neovim-compatible Lua syntax checker on PATH.
 * Result is cached for the Vitest worker process lifetime.
 */
export async function probeLuaSyntaxTool(): Promise<LuaSyntaxTool> {
  if (luaSyntaxToolCache !== undefined) {
    return luaSyntaxToolCache
  }

  if (probePromise === undefined) {
    probePromise = detectLuaSyntaxToolUncached().then((result) => {
      luaSyntaxToolCache = result
      return result
    })
  }

  return probePromise
}

/**
 * Clear the cached syntax-tool probe (for tests that need a fresh detection).
 */
export function clearLuaSyntaxToolCache(): void {
  luaSyntaxToolCache = undefined
  probePromise = undefined
}

function formatRejectionForMessage(
  rejection: LuaSyntaxCommandRejection,
): string {
  if (rejection.stage === 'identity') {
    return `${rejection.command} (${rejection.reason}: ${rejection.detail})`
  }
  return `${rejection.command} capability ${rejection.reason}: ${rejection.detail}`
}

/**
 * Stable, log-safe lines describing probe order, rejections, and selection.
 */
export function formatLuaSyntaxDetectionReport(tool: LuaSyntaxTool): string[] {
  const lines: string[] = [
    `searched commands: ${tool.searchedCommands.join(', ')}`,
  ]

  for (const rejection of tool.rejectedCommands) {
    if (rejection.stage === 'identity') {
      lines.push(
        `rejected command=${rejection.command} stage=${rejection.stage} reason=${rejection.reason} detail=${rejection.detail}`,
      )
      continue
    }

    lines.push(
      `rejected command=${rejection.command} stage=${rejection.stage} engine=${rejection.engine} reason=${rejection.reason} detail=${rejection.detail}`,
    )
  }

  if (tool.available) {
    lines.push(
      `selected command=${tool.command} engine=${tool.engine} version=${tool.version}`,
    )
  }

  return lines
}

function formatMissingToolMessage(
  tool: Extract<LuaSyntaxTool, { available: false }>,
): string {
  const searched = tool.searchedCommands.join(', ')
  const rejected =
    tool.rejectedCommands.length > 0
      ? ` Rejected incompatible tools: ${tool.rejectedCommands.map(formatRejectionForMessage).join('; ')}.`
      : ''
  return (
    'Neovim-compatible Lua syntax checker is required but not found. ' +
    `Searched: ${searched}.${rejected} ` +
    'Lua 5.4 (luac5.4) is not sufficient for Neovim config validation. ' +
    CI_INSTALL_HINT
  )
}

/**
 * Ensure a Neovim-compatible syntax checker is available.
 * Throws with install instructions when none is found.
 */
export async function ensureLuaParserAvailable(): Promise<void> {
  const tool = await probeLuaSyntaxTool()
  if (!tool.available) {
    throw new Error(formatMissingToolMessage(tool))
  }
}

/**
 * @deprecated Use {@link probeLuaSyntaxTool} or {@link hasLuaSyntaxTool}.
 */
export async function hasLuac(): Promise<boolean> {
  const tool = await probeLuaSyntaxTool()
  return tool.available
}

/**
 * Returns true when a previous probe found a Neovim-compatible checker.
 */
export async function hasLuaSyntaxTool(): Promise<boolean> {
  const tool = await probeLuaSyntaxTool()
  return tool.available
}

/**
 * Returns the cached availability result from a previous probe.
 * Returns false when detection has not run yet.
 */
export function isLuaSyntaxToolAvailable(): boolean {
  return luaSyntaxToolCache?.available === true
}

/**
 * @deprecated Use {@link isLuaSyntaxToolAvailable}.
 */
export function isLuacAvailable(): boolean {
  return isLuaSyntaxToolAvailable()
}

async function runSyntaxCheckWithRunner(
  runner: LuaSyntaxCommandRunner,
  tool: Extract<LuaSyntaxTool, { available: true }>,
  checkFile: string,
  workDir: string,
  timeoutMs: number,
): Promise<void> {
  const workspace: LuaSyntaxProbeWorkspace = {
    workDir,
    checkFile,
    validatorFile: join(workDir, 'vinela-lua-syntax-validator.lua'),
    bytecodeFile: join(workDir, 'check.luac'),
  }

  if (tool.engine === 'nvim' || tool.engine === 'lua5.1') {
    await writeFile(workspace.validatorFile, LOADFILE_VALIDATOR_LUA, 'utf8')
  }

  const invocation = buildValidationInvocation(tool.engine, workspace)
  const result = await runner(tool.command, invocation, timeoutMs)

  if (!result.success) {
    const stderr = result.stderr.trim()
    const detail = stderr.length > 0 ? stderr : result.detail
    const error = new Error(detail) as NodeJS.ErrnoException & {
      stderr?: string
    }
    error.stderr = stderr.length > 0 ? stderr : detail
    throw error
  }
}

/**
 * Assert that a Lua string is syntactically valid for Neovim's LuaJIT/Lua 5.1
 * runtime using the best available compatible checker.
 */
export async function assertLuaSyntaxValid(
  lua: string,
  options?: LuaSyntaxAssertOptions,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? SYNTAX_CHECK_TIMEOUT_MS
  const keepTempFileOnFailure = options?.keepTempFileOnFailure ?? false

  const tool = await probeLuaSyntaxTool()
  if (!tool.available) {
    throw new Error(formatMissingToolMessage(tool))
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'vinela-lua-assert-'))
  const tmpFile = join(tmpDir, 'check.lua')
  let syntaxFailed = false

  try {
    await writeFile(tmpFile, lua, 'utf8')
    await runSyntaxCheckWithRunner(
      defaultCommandRunner,
      tool,
      tmpFile,
      tmpDir,
      timeoutMs,
    )
  } catch (err: unknown) {
    syntaxFailed = true

    const stderr = extractStderr(err)
    const lineMatch = /:(\d+):/.exec(stderr)
    const lineInfo = lineMatch ? ` (line ${lineMatch[1]})` : ''

    let message = `Lua syntax validation failed${lineInfo}: ${stderr.trim()}`
    if (keepTempFileOnFailure) {
      message += `\n  Temp file preserved at: ${tmpFile}`
      message += `\n  Checker: ${tool.command} (${tool.engine}, ${tool.version})`
    }

    throw new Error(message)
  } finally {
    if (!(syntaxFailed && keepTempFileOnFailure)) {
      try {
        await rm(tmpDir, { recursive: true, force: true })
      } catch {
        // Cleanup errors must not mask the primary syntax error
      }
    }
  }
}

/**
 * Assert balanced block structures using the shared block-balance utility.
 */
export function assertBlocksBalanced(
  lua: string,
  options?: Parameters<typeof assertBlocksBalancedFromUtil>[1],
): void {
  assertBlocksBalancedFromUtil(lua, options)
}

// ============================================
// Private Helpers
// ============================================

function extractStderr(err: unknown): string {
  if (err instanceof Error && 'stderr' in err) {
    const raw = (err as NodeJS.ErrnoException & { stderr: unknown }).stderr
    return typeof raw === 'string' ? raw : String(raw ?? '')
  }
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}
