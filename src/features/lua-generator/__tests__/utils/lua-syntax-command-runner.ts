import { type ChildProcess, spawn } from 'node:child_process'
import type { LuaSyntaxCommandRunResult } from './lua-assert'

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

function terminateChildProcess(child: ChildProcess): void {
  if (child.pid === undefined) {
    return
  }

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
        stdio: 'ignore',
        windowsHide: true,
      })
      return
    }

    child.kill('SIGKILL')
  } catch {
    // Best-effort cleanup; timeout result is still returned.
  }
}

function isSpawnNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

/**
 * Run a syntax-checker subprocess with a hard deadline.
 * Expired children are forcefully terminated so Vitest does not inherit orphans.
 */
export async function runLuaSyntaxCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<LuaSyntaxCommandRunResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const settle = (result: LuaSyntaxCommandRunResult): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const child = spawn(command, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })

    const timer = setTimeout(() => {
      terminateChildProcess(child)
      settle({
        success: false,
        reason: 'timeout',
        stdout,
        stderr,
        detail: `command timed out after ${timeoutMs}ms: ${command}`,
      })
    }, timeoutMs)

    child.on('error', (err: unknown) => {
      if (isSpawnNotFoundError(err)) {
        settle({
          success: false,
          reason: 'not-found',
          stdout,
          stderr,
          detail: `command not found: ${command}`,
        })
        return
      }

      const message = err instanceof Error ? err.message : String(err)
      settle({
        success: false,
        reason: 'spawn-error',
        stdout,
        stderr,
        detail: conciseDetail(message),
      })
    })

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return
      }

      if (code === 0) {
        settle({
          success: true,
          stdout,
          stderr,
        })
        return
      }

      const combined = `${stdout}\n${stderr}`.trim()
      const detail =
        combined.length > 0
          ? conciseDetail(combined)
          : signal !== null
            ? `exited with signal ${signal}`
            : `exited with code ${String(code)}`

      settle({
        success: false,
        reason: 'nonzero-exit',
        stdout,
        stderr,
        detail,
      })
    })
  })
}

export const defaultCommandRunner = runLuaSyntaxCommand
