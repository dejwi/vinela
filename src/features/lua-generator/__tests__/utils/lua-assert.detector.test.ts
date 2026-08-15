import { afterEach, describe, expect, it } from 'vitest'
import {
  clearLuaSyntaxToolCache,
  detectLuaSyntaxToolUncached,
  type LuaSyntaxCommandRunner,
  type LuaSyntaxCommandRunResult,
  NOOP_LUA_SYNTAX_CHECK,
} from './lua-assert'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function success(stdout = '', stderr = ''): LuaSyntaxCommandRunResult {
  return { success: true, stdout, stderr }
}

function failure(
  reason: Extract<LuaSyntaxCommandRunResult, { success: false }>['reason'],
  detail: string,
  stdout = '',
  stderr = '',
): LuaSyntaxCommandRunResult {
  return { success: false, reason, stdout, stderr, detail }
}

function invocationKey(command: string, args: readonly string[]): string {
  return `${command}\0${args.join('\0')}`
}

function automaticDiscoveryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env['VINELA_LUA_SYNTAX_CHECKER']
  return env
}

describe('lua-assert detector', () => {
  afterEach(() => {
    restoreEnv()
    clearLuaSyntaxToolCache()
  })

  it('falls through from hanging old Neovim to LuaJIT with timeout diagnostics', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = []

    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      calls.push({ command, args })
      const key = invocationKey(command, args)

      if (key === invocationKey('nvim', ['-v'])) {
        return success('NVIM v0.6.1\n')
      }

      if (
        key.startsWith(
          invocationKey('nvim', [
            '--headless',
            '-u',
            'NONE',
            '-i',
            'NONE',
            '-n',
            '-l',
          ]),
        )
      ) {
        return failure('timeout', 'command timed out after 2000ms: nvim')
      }

      if (key === invocationKey('luajit', ['-v'])) {
        return success('LuaJIT 2.1.0-beta3\n')
      }

      if (key.startsWith(invocationKey('luajit', ['-b']))) {
        return success()
      }

      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })

    expect(result.available).toBe(true)
    if (!result.available) {
      throw new Error('expected available checker')
    }

    expect(result.engine).toBe('luajit')
    expect(result.command).toBe('luajit')
    expect(result.searchedCommands).toEqual(['nvim', 'luajit'])
    expect(result.rejectedCommands).toHaveLength(1)

    const rejection = result.rejectedCommands[0]
    expect(rejection).toEqual(
      expect.objectContaining({
        stage: 'capability',
        command: 'nvim',
        engine: 'nvim',
        reason: 'timeout',
      }),
    )

    expect(calls.some((call) => call.command === 'luac5.1')).toBe(false)
  })

  it('fails closed on hanging override without probing automatic fallbacks', async () => {
    const probedCommands: string[] = []

    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      probedCommands.push(command)

      if (command === 'nvim' && args[0] === '-v') {
        return success('NVIM v0.6.1\n')
      }

      if (
        command === 'nvim' &&
        args[0] === '--headless' &&
        args.includes('-l')
      ) {
        return failure('timeout', 'command timed out after 2000ms: nvim')
      }

      if (command === 'luajit') {
        return success('LuaJIT 2.1.0-beta3\n')
      }

      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: {
        ...process.env,
        VINELA_LUA_SYNTAX_CHECKER: 'nvim',
      },
    })

    expect(result.available).toBe(false)
    if (result.available) {
      throw new Error('expected unavailable checker')
    }

    expect(result.searchedCommands).toEqual(['nvim'])
    expect(result.rejectedCommands[0]).toEqual(
      expect.objectContaining({
        stage: 'capability',
        command: 'nvim',
        engine: 'nvim',
        reason: 'timeout',
      }),
    )
    expect(probedCommands).not.toContain('luajit')
  })

  it('falls through from old Neovim lacking -l to LuaJIT', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = []

    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      calls.push({ command, args })
      const key = invocationKey(command, args)

      if (key === invocationKey('nvim', ['-v'])) {
        return success('NVIM v0.6.1\n')
      }

      if (
        key.startsWith(
          invocationKey('nvim', [
            '--headless',
            '-u',
            'NONE',
            '-i',
            'NONE',
            '-n',
            '-l',
          ]),
        )
      ) {
        return failure(
          'nonzero-exit',
          'E886: System has no Lua support',
          '',
          'unsupported -l',
        )
      }

      if (key === invocationKey('luajit', ['-v'])) {
        return success('LuaJIT 2.1.0-beta3\n')
      }

      if (key.startsWith(invocationKey('luajit', ['-b']))) {
        return success()
      }

      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })

    expect(result.available).toBe(true)
    if (!result.available) {
      throw new Error('expected available checker')
    }

    expect(result.engine).toBe('luajit')
    expect(result.command).toBe('luajit')
    expect(result.searchedCommands).toEqual(['nvim', 'luajit'])
    expect(result.rejectedCommands).toHaveLength(1)

    const rejection = result.rejectedCommands[0]
    expect(rejection).toEqual(
      expect.objectContaining({
        stage: 'capability',
        command: 'nvim',
        engine: 'nvim',
        reason: 'nonzero-exit',
      }),
    )

    if (rejection?.stage !== 'capability') {
      throw new Error('expected capability rejection')
    }

    expect(rejection.invocation.slice(0, 8)).toEqual([
      '--headless',
      '-u',
      'NONE',
      '-i',
      'NONE',
      '-n',
      '-l',
      expect.stringContaining('vinela-lua-syntax-validator.lua'),
    ])
    expect(rejection.invocation[8]).toEqual(
      expect.stringContaining('check.lua'),
    )

    expect(calls.some((call) => call.command === 'luac5.1')).toBe(false)
  })

  it('rejects Lua 5.4-only environments with incompatible-version diagnostics', async () => {
    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      if (args[0] === '-v' || args[0] === '-b' || args[0] === '-p') {
        if (command === 'luac5.4') {
          return success(
            'Lua 5.4.6  Copyright (C) 1994-2023 Lua.org, PUC-Rio\n',
          )
        }
        if (command === 'luac') {
          return success(
            'Lua 5.4.6  Copyright (C) 1994-2023 Lua.org, PUC-Rio\n',
          )
        }
      }
      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })

    expect(result.available).toBe(false)
    if (result.available) {
      throw new Error('expected unavailable checker')
    }

    expect(result.searchedCommands).toEqual([
      'nvim',
      'luajit',
      'luac5.1',
      'lua5.1',
      'luac',
    ])

    const luacRejection = result.rejectedCommands.find(
      (rejection) =>
        rejection.stage === 'identity' &&
        rejection.command === 'luac' &&
        rejection.reason === 'incompatible-version',
    )
    expect(luacRejection).toBeDefined()

    const luac54Rejection = result.rejectedCommands.find(
      (rejection) =>
        rejection.stage === 'identity' &&
        rejection.command === 'luac5.4' &&
        rejection.reason === 'incompatible-version',
    )
    expect(luac54Rejection).toBeDefined()
  })

  it('accepts compatible bare luac after earlier candidates are absent', async () => {
    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      if (command === 'luac' && args[0] === '-v') {
        return success('Lua 5.1.5  Copyright (C) 1994-2012 Lua.org, PUC-Rio\n')
      }
      if (command === 'luac' && args[0] === '-p') {
        return success()
      }
      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })

    expect(result.available).toBe(true)
    if (!result.available) {
      throw new Error('expected available checker')
    }

    expect(result.engine).toBe('compatible-luac')
    expect(result.command).toBe('luac')
    expect(result.dialect).toBe('neovim-lua51')
    expect(result.searchedCommands[result.searchedCommands.length - 1]).toBe(
      'luac',
    )
  })

  it('fails closed on invalid override without probing automatic fallbacks', async () => {
    const probedCommands: string[] = []

    const runner: LuaSyntaxCommandRunner = async (command) => {
      probedCommands.push(command)
      if (command === '/tmp/does-not-exist/luajit') {
        return failure('not-found', 'command not found')
      }
      if (command === 'luajit') {
        return success('LuaJIT 2.1.0-beta3\n')
      }
      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: {
        ...process.env,
        VINELA_LUA_SYNTAX_CHECKER: '/tmp/does-not-exist/luajit',
      },
    })

    expect(result.available).toBe(false)
    if (result.available) {
      throw new Error('expected unavailable checker')
    }

    expect(result.searchedCommands).toEqual(['/tmp/does-not-exist/luajit'])
    expect(result.rejectedCommands[0]).toEqual(
      expect.objectContaining({
        stage: 'identity',
        command: '/tmp/does-not-exist/luajit',
        reason: 'not-found',
      }),
    )
    expect(probedCommands).not.toContain('luajit')
  })

  it('checks override capability and rejects incapable old Neovim', async () => {
    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      if (command === 'nvim' && args[0] === '-v') {
        return success('NVIM v0.6.1\n')
      }
      if (
        command === 'nvim' &&
        args[0] === '--headless' &&
        args.includes('-l')
      ) {
        return failure('nonzero-exit', 'unsupported -l')
      }
      if (command === 'luajit') {
        return success('LuaJIT 2.1.0-beta3\n')
      }
      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: {
        ...process.env,
        VINELA_LUA_SYNTAX_CHECKER: 'nvim',
      },
    })

    expect(result.available).toBe(false)
    if (result.available) {
      throw new Error('expected unavailable checker')
    }

    expect(result.searchedCommands).toEqual(['nvim'])
    expect(result.rejectedCommands[0]).toEqual(
      expect.objectContaining({
        stage: 'capability',
        command: 'nvim',
        engine: 'nvim',
        reason: 'nonzero-exit',
      }),
    )
  })

  it('prefers capable Neovim without probing lower-priority tools', async () => {
    const probedCommands: string[] = []

    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      probedCommands.push(command)

      if (command === 'nvim' && args[0] === '-v') {
        return success('NVIM v0.10.0\n')
      }

      if (
        command === 'nvim' &&
        args[0] === '--headless' &&
        args.includes('-l')
      ) {
        return success()
      }

      return failure('not-found', `${command} not found`)
    }

    const result = await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })

    expect(result.available).toBe(true)
    if (!result.available) {
      throw new Error('expected available checker')
    }

    expect(result.engine).toBe('nvim')
    expect(result.command).toBe('nvim')
    expect(result.rejectedCommands).toHaveLength(0)
    expect(probedCommands).not.toContain('luajit')
    expect(probedCommands).not.toContain('luac5.1')
  })

  it('uses the same no-op input for capability probing', async () => {
    let checkContents = ''

    const runner: LuaSyntaxCommandRunner = async (command, args) => {
      if (command === 'luac' && args[0] === '-v') {
        return success('Lua 5.1.5  Copyright (C) 1994-2012 Lua.org, PUC-Rio\n')
      }
      if (command === 'luac' && args[0] === '-p') {
        const checkPath = args[1]
        if (typeof checkPath === 'string') {
          const { readFile } = await import('node:fs/promises')
          checkContents = await readFile(checkPath, 'utf8')
        }
        return success()
      }
      return failure('not-found', `${command} not found`)
    }

    await detectLuaSyntaxToolUncached({
      runner,
      env: automaticDiscoveryEnv(),
    })
    expect(checkContents).toBe(NOOP_LUA_SYNTAX_CHECK)
  })
})
