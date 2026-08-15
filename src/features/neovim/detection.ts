import { platform } from '@tauri-apps/plugin-os'
import { Command } from '@tauri-apps/plugin-shell'
import { pathExistsDirect, readTextFileDirect } from '@/shared/lib/direct-fs'
import { expandPath } from '@/shared/lib/path-utils'
import {
  getDefaultNeovimOutputPath,
  loadAppSettings,
} from '@/shared/lib/settings'
import { isMemoryMode } from '@/shared/lib/storage'
import type { NeovimDetectionResult } from './types'
import { GENERATED_CONFIG_MARKER } from './types'

/**
 * Detect Neovim installation and configuration status.
 *
 * Detection steps:
 * 1. Check memory mode (return early if in browser)
 * 2. Run `nvim --version` to check if nvim is installed
 * 3. Parse version from output
 * 4. Get binary path via `which nvim` (Unix) or `where nvim` (Windows)
 * 5. Get config path from AppSettings (or default)
 * 6. Check for existing init.lua using direct-fs (bypasses plugin-fs scope)
 * 7. Check if existing config is ours (marker comment)
 */
export async function detectNeovim(): Promise<NeovimDetectionResult> {
  // Memory mode check - return immediately
  if (isMemoryMode()) {
    return {
      found: false,
      error: 'Neovim detection is not available in browser mode',
      errorCode: 'memory-mode',
    }
  }

  try {
    // Step 1: Run nvim --version
    const versionOutput = await runCommand('nvim', ['--version'])
    if (!versionOutput.success) {
      return {
        found: false,
        error: 'Neovim is not installed or not in PATH',
        errorCode: 'not-in-path',
      }
    }

    // Step 2: Parse version
    const versionInfo = parseNeovimVersion(versionOutput.stdout)
    if (versionInfo === null) {
      return {
        found: false,
        error: 'Could not parse Neovim version from output',
        errorCode: 'parse-failed',
      }
    }

    // Step 3: Get binary path
    const binaryPath = await getNeovimBinaryPath()

    // Step 4: Get config path from settings (uses configured output path)
    const configPath = await getConfiguredOutputPath()

    // Step 5 & 6: Check existing config via direct-fs (no scope extension needed)
    const configStatus = await checkExistingConfig(configPath)

    return {
      found: true,
      binaryPath,
      version: versionInfo.version,
      versionDisplay: versionInfo.display,
      configPath,
      hasExistingConfig: configStatus.exists,
      isOurConfig: configStatus.isOurs,
    }
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : 'Unknown detection error',
      errorCode: 'execution-failed',
    }
  }
}

// ============================================
// Internal Helpers
// ============================================

interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
}

/**
 * Run a shell command with the scoped permissions from capabilities.
 * Only nvim, which, and where are allowed per our capability config.
 */
async function runCommand(cmd: string, args: string[]): Promise<CommandResult> {
  try {
    // Command.create uses the command name from capabilities
    const command = Command.create(cmd, args)
    const output = await command.execute()

    return {
      success: output.code === 0,
      stdout: output.stdout,
      stderr: output.stderr,
    }
  } catch {
    return {
      success: false,
      stdout: '',
      stderr: 'Command execution failed',
    }
  }
}

interface VersionInfo {
  version: string // e.g., "0.10.2"
  display: string // e.g., "NVIM v0.10.2"
}

function parseNeovimVersion(stdout: string): VersionInfo | null {
  // First line format: "NVIM v0.10.2" or "NVIM v0.10.2-dev-abc123"
  const firstLine = stdout.split('\n')[0]?.trim()
  if (!firstLine) return null

  // Match "NVIM v" followed by version
  const match = firstLine.match(/^NVIM\s+v?(\d+\.\d+\.\d+(?:-[^\s]+)?)/)
  if (!match?.[1]) return null

  return {
    version: match[1],
    display: firstLine,
  }
}

async function getNeovimBinaryPath(): Promise<string> {
  const os = platform()
  const cmd = os === 'windows' ? 'where' : 'which'

  const result = await runCommand(cmd, ['nvim'])
  if (result.success && result.stdout.trim()) {
    // `where` on Windows may return multiple lines; take the first
    return result.stdout.split('\n')[0]?.trim() ?? 'nvim'
  }

  return 'nvim' // Fallback if path detection fails
}

/**
 * Get the configured output path from AppSettings.
 * Falls back to platform default if not configured.
 */
async function getConfiguredOutputPath(): Promise<string> {
  try {
    const settings = await loadAppSettings()
    if (settings.neovimOutputPath) {
      return expandPath(settings.neovimOutputPath)
    }
  } catch {
    // Fall through to default
  }

  return expandPath(getDefaultNeovimOutputPath())
}

// ── ConfigStatus ─────────────────────────────────────────────────────────────

type ConfigStatus =
  | { exists: false; isOurs: false }
  | { exists: true; isOurs: boolean }
  | { exists: false; isOurs: false; permissionError: true; error: string }

/**
 * Check if config exists and whether it's ours.
 *
 * Uses direct-fs (Rust std::fs) which bypasses Tauri plugin-fs scope entirely,
 * matching the strategy used by deploy and backup.
 *
 * Returns an explicit permission/scope failure state instead of collapsing
 * all errors to { exists: false } — callers can inspect `permissionError`
 * to distinguish "missing file" from "inaccessible file".
 */
async function checkExistingConfig(configPath: string): Promise<ConfigStatus> {
  let exists: boolean
  try {
    exists = await pathExistsDirect(configPath)
  } catch (err) {
    // pathExistsDirect throws when the path escapes $HOME or the Rust command
    // fails — this is a real access/scope failure, not "file missing".
    const message = err instanceof Error ? err.message : String(err)
    return {
      exists: false,
      isOurs: false,
      permissionError: true,
      error: message,
    }
  }

  if (!exists) {
    return { exists: false, isOurs: false }
  }

  try {
    const content = await readTextFileDirect(configPath)
    const firstLine = content.split('\n')[0]?.trim() ?? ''
    const isOurs = firstLine.startsWith(GENERATED_CONFIG_MARKER)
    return { exists: true, isOurs }
  } catch {
    // File exists but we couldn't read it — report existence, assume not ours.
    return { exists: true, isOurs: false }
  }
}
