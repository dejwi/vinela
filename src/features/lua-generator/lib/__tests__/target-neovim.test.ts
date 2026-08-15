import { describe, expect, it } from 'vitest'
import { checkTargetNeovimBaseline } from '@/features/lua-generator/diagnostics/checks/target-neovim-baseline'
import { DiagnosticsCollector } from '@/features/lua-generator/diagnostics/collector'
import type { PreGenerationContext } from '@/features/lua-generator/diagnostics/types'
import {
  getTargetNeovimCallout,
  normalizeTargetNeovimSnapshot,
  TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID,
} from '@/features/lua-generator/lib/target-neovim'

function makeContext(
  targetNeovim: PreGenerationContext['targetNeovim'],
): PreGenerationContext {
  return {
    graphs: [],
    graphsById: new Map(),
    nodesByGraph: new Map(),
    edgesByGraph: new Map(),
    disableStates: new Map(),
    callableContracts: new Map(),
    installedPlugins: [],
    schemas: [],
    targetNeovim,
  }
}

describe('getTargetNeovimCallout', () => {
  it('returns strong warning for detected old versions', () => {
    const callout = getTargetNeovimCallout({
      kind: 'detected',
      version: '0.11.4',
      versionDisplay: 'NVIM v0.11.4',
    })
    expect(callout?.kind).toBe('old-version')
  })

  it('suppresses callout for supported and memory mode', () => {
    expect(
      getTargetNeovimCallout({
        kind: 'detected',
        version: '0.12.4',
        versionDisplay: 'NVIM v0.12.4',
      }),
    ).toBeNull()
    expect(
      getTargetNeovimCallout({ kind: 'unavailable', reason: 'memory-mode' }),
    ).toBeNull()
  })

  it('returns soft warning for undetected desktop targets', () => {
    const callout = getTargetNeovimCallout({
      kind: 'undetected',
      reason: 'not-in-path',
    })
    expect(callout?.kind).toBe('undetected')
  })

  it('treats malformed detected versions as undetected parse-failed', () => {
    const callout = getTargetNeovimCallout({
      kind: 'detected',
      version: 'garbage',
      versionDisplay: 'NVIM garbage',
    })
    expect(callout?.kind).toBe('undetected')
    expect(
      normalizeTargetNeovimSnapshot({
        kind: 'detected',
        version: 'garbage',
        versionDisplay: 'NVIM garbage',
      }),
    ).toEqual({ kind: 'undetected', reason: 'parse-failed' })
  })
})

describe('checkTargetNeovimBaseline', () => {
  it('emits one global runtime warning without plugin source', () => {
    const collector = new DiagnosticsCollector()
    checkTargetNeovimBaseline(
      makeContext({
        kind: 'detected',
        version: '0.11.4',
        versionDisplay: 'NVIM v0.11.4',
      }),
      collector,
    )

    const warnings = collector.getAll().filter((d) => d.severity === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.id).toBe(TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID)
    expect(warnings[0]?.category).toBe('runtime')
    expect(warnings[0]?.source).toBeUndefined()
  })

  it('does not warn for supported detected versions', () => {
    const collector = new DiagnosticsCollector()
    checkTargetNeovimBaseline(
      makeContext({
        kind: 'detected',
        version: '0.12.0',
        versionDisplay: 'NVIM v0.12.0',
      }),
      collector,
    )
    expect(collector.getAll()).toHaveLength(0)
  })

  it('warns softly for malformed injected detected snapshots', () => {
    const collector = new DiagnosticsCollector()
    checkTargetNeovimBaseline(
      makeContext({
        kind: 'detected',
        version: 'not-a-version',
        versionDisplay: 'NVIM not-a-version',
      }),
      collector,
    )

    const warnings = collector.getAll().filter((d) => d.severity === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.id).toBe(TARGET_NEOVIM_BASELINE_DIAGNOSTIC_ID)
    expect(warnings[0]?.message).toBe('Could not verify local Neovim version')
  })
})
