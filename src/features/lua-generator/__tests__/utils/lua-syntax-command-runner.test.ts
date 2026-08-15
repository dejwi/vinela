import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runLuaSyntaxCommand } from './lua-syntax-command-runner'

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ESRCH'
    ) {
      return false
    }
    throw err
  }
}

describe('lua-syntax-command-runner', () => {
  it('terminates a hanging child and returns timeout within the deadline margin', async () => {
    const timeoutMs = 300
    const marginMs = 700
    const markerDir = await mkdtemp(join(tmpdir(), 'vinela-runner-timeout-'))
    const pidFile = join(markerDir, 'pid.txt')

    try {
      const start = Date.now()
      const result = await runLuaSyntaxCommand(
        process.execPath,
        [
          '-e',
          `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1_000_000)`,
        ],
        timeoutMs,
      )
      const elapsed = Date.now() - start

      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error('expected timeout failure')
      }

      expect(result.reason).toBe('timeout')
      expect(elapsed).toBeLessThan(timeoutMs + marginMs)

      const pidText = await readFile(pidFile, 'utf8')
      const childPid = Number.parseInt(pidText.trim(), 10)
      expect(Number.isFinite(childPid)).toBe(true)

      await new Promise((resolve) => {
        setTimeout(resolve, 100)
      })

      expect(await isProcessAlive(childPid)).toBe(false)
    } finally {
      await rm(markerDir, { recursive: true, force: true })
    }
  })

  it('classifies nonzero exit separately from timeout', async () => {
    const result = await runLuaSyntaxCommand(
      process.execPath,
      ['-e', 'process.exit(2)'],
      5_000,
    )

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('expected nonzero exit')
    }

    expect(result.reason).toBe('nonzero-exit')
  })

  it('classifies missing commands as not-found', async () => {
    const result = await runLuaSyntaxCommand(
      '/tmp/vinela-missing-lua-checker-command',
      ['-v'],
      1_000,
    )

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('expected not-found failure')
    }

    expect(result.reason).toBe('not-found')
  })

  it('returns success output for a fast no-op child', async () => {
    const markerDir = await mkdtemp(join(tmpdir(), 'vinela-runner-success-'))
    const markerFile = join(markerDir, 'ok.txt')

    try {
      await writeFile(markerFile, 'ready', 'utf8')
      const result = await runLuaSyntaxCommand(
        process.execPath,
        ['-e', `require('fs').accessSync(${JSON.stringify(markerFile)})`],
        5_000,
      )

      expect(result.success).toBe(true)
    } finally {
      await rm(markerDir, { recursive: true, force: true })
    }
  })
})
