import { describe, expect, it, vi } from 'vitest'
import { expectedCallableRef } from '@/features/lua-generator/__tests__/utils/callable-keys'
import type { SectionResult } from '../../types'
import { assembleFinalInitLua } from '../assemble'

const DEFAULT_OPTIONS = {
  projectName: 'Test Project',
  generationDate: '2026-03-01T00:00:00.000Z',
}

function createSection(id: SectionResult['id'], line: string): SectionResult {
  return {
    id,
    code: [line],
    diagnostics: [],
  }
}

describe('assembleFinalInitLua', () => {
  it('orders sections correctly', () => {
    const sections: SectionResult[] = [
      createSection('project-keymaps', 'KEYMAPS_LINE'),
      createSection('plugins', 'PLUGINS_LINE'),
      createSection('leader-key', 'LEADER_LINE'),
      createSection('neovim-options', 'OPTIONS_LINE'),
    ]

    const output = assembleFinalInitLua(
      sections,
      [['CALLABLE_LINE']],
      [],
      DEFAULT_OPTIONS,
    )

    const leaderIndex = output.indexOf('LEADER_LINE')
    const optionsIndex = output.indexOf('OPTIONS_LINE')
    const callableIndex = output.indexOf('CALLABLE_LINE')
    const pluginsIndex = output.indexOf('PLUGINS_LINE')
    const keymapsIndex = output.indexOf('KEYMAPS_LINE')

    expect(leaderIndex).toBeGreaterThanOrEqual(0)
    expect(optionsIndex).toBeGreaterThan(leaderIndex)
    expect(callableIndex).toBeGreaterThan(optionsIndex)
    expect(pluginsIndex).toBeGreaterThan(callableIndex)
    expect(keymapsIndex).toBeGreaterThan(pluginsIndex)
  })

  it('deduplicates sections by ID', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const sections: SectionResult[] = [
      createSection('plugins', 'PLUGINS_FIRST'),
      createSection('plugins', 'PLUGINS_SECOND'),
      createSection('leader-key', 'LEADER_LINE'),
    ]

    const output = assembleFinalInitLua(sections, [], [], DEFAULT_OPTIONS)

    expect(output).toContain('PLUGINS_FIRST')
    expect(output).not.toContain('PLUGINS_SECOND')
    expect(warnSpy).toHaveBeenCalledWith('Duplicate section: plugins')

    warnSpy.mockRestore()
  })

  it('includes section comments', () => {
    const sections: SectionResult[] = [
      createSection('leader-key', 'vim.g.mapleader = ","'),
    ]

    const output = assembleFinalInitLua(
      sections,
      [['function _nvimset_example(params)', 'end']],
      [['-- startup code']],
      DEFAULT_OPTIONS,
    )

    expect(output).toContain('-- Section: leader-key')
    expect(output).toContain('-- Section: callable-functions')
    expect(output).toContain('-- Startup Execution')
  })

  it('always emits callable registry initialization before any section code', () => {
    const sections: SectionResult[] = [
      createSection('neovim-options', 'vim.opt.number = true'),
    ]

    const output = assembleFinalInitLua(sections, [], [], DEFAULT_OPTIONS)

    expect(output).toContain(
      '_G._vinela_callables = _G._vinela_callables or {}',
    )

    const registryIndex = output.indexOf('_G._vinela_callables')
    const optionsIndex = output.indexOf('vim.opt.number = true')

    expect(registryIndex).toBeGreaterThanOrEqual(0)
    expect(optionsIndex).toBeGreaterThan(registryIndex)
  })

  it('emits registry init before callable-functions section', () => {
    const output = assembleFinalInitLua(
      [],
      [
        [
          `${expectedCallableRef('my_graph', 'my_graph')} = function(params) end`,
        ],
      ],
      [],
      DEFAULT_OPTIONS,
    )

    const registryInitIndex = output.indexOf(
      '_G._vinela_callables = _G._vinela_callables or {}',
    )
    const callableWriteIndex = output.indexOf(
      expectedCallableRef('my_graph', 'my_graph'),
    )

    expect(registryInitIndex).toBeGreaterThanOrEqual(0)
    expect(callableWriteIndex).toBeGreaterThan(registryInitIndex)
  })
})
