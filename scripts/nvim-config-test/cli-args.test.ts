// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
  parseGenerateArgs,
  parseNvimTestArgs,
  parseWorkflowArgs,
} from './cli-args'

describe('cli-args', () => {
  it('parses generate defaults', () => {
    const result = parseGenerateArgs(['--project', 'example-vinela-project'])
    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.useProjectCopy).toBe(true)
    expect(result.value.initLuaPath).toContain('temp/generated/example-vinela-project/init.lua')
  })

  it('rejects mutually exclusive cache flags', () => {
    const result = parseNvimTestArgs([
      '--init',
      'temp/generated/init.lua',
      '--fresh',
      '--reuse-cache',
    ])
    expect(result.success).toBe(false)
  })

  it('parses workflow default startup pipeline', () => {
    const result = parseWorkflowArgs(['--project', 'example-vinela-project', '--mode', 'startup'])
    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.pipeline).toEqual(['generation', 'syntax', 'startup'])
  })

  it('rejects invalid skip-syntax usage', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--mode',
      'startup',
      '--skip-syntax',
    ])
    expect(result.success).toBe(false)
  })

  it('rejects invalid explicit pipeline stages', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--pipeline',
      'syntax,invalid-stage',
    ])

    expect(result).toEqual({
      success: false,
      exitCode: 2,
      message: 'Invalid pipeline stage: invalid-stage',
    })
  })

  it('sanitizes explicit run ids', () => {
    const result = parseNvimTestArgs([
      '--init',
      'temp/generated/init.lua',
      '--run-id',
      ' bad/run id ',
    ])

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.runId).toBe('bad-run-id')
  })

  it('rejects invalid keep-runs values', () => {
    const result = parseNvimTestArgs([
      '--init',
      'temp/generated/init.lua',
      '--keep-runs',
      '-1',
    ])

    expect(result).toEqual({
      success: false,
      exitCode: 2,
      message: 'Invalid --keep-runs. Expected a non-negative integer',
    })
  })

  it('defaults startup post-startup wait to 1000ms', () => {
    const result = parseNvimTestArgs([
      '--init',
      'temp/generated/init.lua',
      '--mode',
      'startup',
    ])

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.postStartupWaitMs).toBe(1000)
  })

  it('rejects post-startup waits that leave less than one second of timeout budget', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--mode',
      'startup',
      '--timeout-ms',
      '1500',
      '--post-startup-wait-ms',
      '600',
    ])

    expect(result).toEqual({
      success: false,
      exitCode: 2,
      message: 'Invalid timeout budget. --timeout-ms minus --post-startup-wait-ms must be at least 1000',
    })
  })

  it('defaults workflow startup wait to 1000ms for explicit startup pipelines', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--mode',
      'syntax',
      '--pipeline',
      'startup',
    ])

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.postStartupWaitMs).toBe(1000)
  })

  it('preserves explicit zero startup wait for explicit startup pipelines', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--mode',
      'syntax',
      '--pipeline',
      'startup',
      '--post-startup-wait-ms',
      '0',
    ])

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.postStartupWaitMs).toBe(0)
  })

  it('keeps non-startup workflow pipelines at zero startup wait by default', () => {
    const result = parseWorkflowArgs([
      '--project',
      'example-vinela-project',
      '--mode',
      'syntax',
      '--pipeline',
      'syntax',
    ])

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.value.postStartupWaitMs).toBe(0)
  })
})
