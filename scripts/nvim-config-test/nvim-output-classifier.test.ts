// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { classifyNvimOutput } from './nvim-output-classifier'

const availableVersion = {
  status: 'available' as const,
  info: {
    raw: 'NVIM v0.12.0',
    version: '0.12.0',
    major: 0,
    minor: 12,
    patch: 0,
  },
}

function createNvimReport(overrides?: Partial<{
  vErrmsg: string
  messages: string
}>) {
  return {
    version: '0.12.0',
    vErrmsg: overrides?.vErrmsg ?? '',
    messages: overrides?.messages ?? '',
    runtimepath: '',
    packpath: '',
    data: '',
    config: '',
    state: '',
    cache: '',
    packRoot: '',
    packPlugins: [],
  }
}

describe('classifyNvimOutput', () => {
  it('classifies unsupported versions explicitly', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: null,
      timedOut: false,
      stdout: '',
      stderr: '',
      nvimReport: null,
      versionCheck: {
        status: 'unsupported',
        command: 'nvim',
        info: availableVersion.info,
        minimumVersion: '0.12.0',
        errorSummary: 'unsupported',
      },
    })

    expect(result).toMatchObject({
      success: false,
      failureKind: 'unsupported-nvim-version',
    })
  })

  it('classifies syntax errors', () => {
    const result = classifyNvimOutput({
      mode: 'syntax',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'E5107: Error loading lua [string "/tmp/init.lua"]:3: syntax error',
      nvimReport: null,
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'syntax-error' })
  })

  it('classifies module-not-found errors', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: "module 'foo.bar' not found",
      nvimReport: createNvimReport(),
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'module-not-found' })
  })

  it('returns success with warnings', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 0,
      timedOut: false,
      stdout: '',
      stderr: 'warning text',
      nvimReport: createNvimReport({ messages: 'note text' }),
      versionCheck: availableVersion,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.warnings.length).toBeGreaterThan(0)
    }
  })

  it('classifies stack trace startup failures as startup errors', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'stack traceback:\n\tfoo.lua:1: boom',
      nvimReport: createNvimReport(),
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'startup-error' })
  })

  it('classifies numbered neovim errors as startup errors', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'E492: Not an editor command',
      nvimReport: createNvimReport(),
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'startup-error' })
  })

  it('classifies plugin network failures explicitly', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'fatal: unable to access https://example.test/repo.git',
      nvimReport: createNvimReport(),
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'plugin-network-error' })
  })

  it('prefers Mason startup traces over missing finalizer', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: [
        'Error detected while processing /tmp/init.lua:',
        'E5113: Lua chunk: Unknown registry type: mason',
        'stack traceback:',
        '\t.../mason-registry/sources/init.lua:12: in function',
      ].join('\n'),
      nvimReport: null,
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'startup-error' })
  })

  it('prefers blink configuration failures over missing finalizer', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: 'blink.cmp frecency Unexpected field in configuration!',
      nvimReport: null,
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'startup-error' })
  })

  it('keeps blank missing finalizer failures as report errors', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 1,
      timedOut: false,
      stdout: '',
      stderr: '',
      nvimReport: null,
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'report-error' })
  })

  it('treats non-empty v:errmsg as a startup error', () => {
    const result = classifyNvimOutput({
      mode: 'startup',
      exitCode: 0,
      timedOut: false,
      stdout: '',
      stderr: '',
      nvimReport: createNvimReport({ vErrmsg: 'E5108: Error executing lua' }),
      versionCheck: availableVersion,
    })

    expect(result).toMatchObject({ success: false, failureKind: 'startup-error' })
  })
})
