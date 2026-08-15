import { describe, expect, it } from 'vitest'
import type { LspSectionInput, ResolvedPluginForGeneration } from '../../types'
import { generateLSPSection } from '../lsp-section'

function createMockPlugin(
  id: string,
  enabled: boolean,
  capabilities?: ResolvedPluginForGeneration['schema']['capabilities'],
): ResolvedPluginForGeneration {
  return {
    plugin: {
      id,
      schemaId: id,
      enabled,
      config: {},
    },
    schema: {
      id,
      pluginName: id,
      pluginRepo: `owner/${id}`,
      version: '1.0.0',
      functions: [],
      options: [],
      capabilities,
    } as ResolvedPluginForGeneration['schema'],
  }
}

const installerCapability = [
  {
    kind: 'lsp-package-installer' as const,
    provider: 'mason-registry' as const,
  },
]

function enablerCapability(minNvimVersion = '0.11') {
  return [
    {
      kind: 'lsp-server-enabler' as const,
      api: 'vim.lsp.enable' as const,
      minNvimVersion,
    },
  ]
}

describe('generateLSPSection', () => {
  it('returns empty result when no servers enabled', () => {
    const input: LspSectionInput = {
      enabledServers: [],
      resolvedPlugins: [],
    }
    const result = generateLSPSection(input)
    expect(result.code).toEqual([])
    expect(result.diagnostics).toEqual([])
  })

  it('skips installer block when no installer capability is installed', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [],
    }
    const result = generateLSPSection(input)
    expect(result.code.some((line) => line.includes('mason-registry'))).toBe(
      false,
    )
    expect(result.skippedReasons).toContain(
      'lsp-package-installer skipped: no enabled plugin declares installer capability',
    )
  })

  it('skips installer block when installer capability plugin is disabled', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [
        createMockPlugin('installer', false, installerCapability),
      ],
    }
    const result = generateLSPSection(input)
    expect(result.skippedReasons).toContain(
      'lsp-package-installer skipped: no enabled plugin declares installer capability',
    )
  })

  it('skips lsp-enable when no enabler capability is installed', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [],
    }
    const result = generateLSPSection(input)
    expect(result.code.some((line) => line.includes('vim.lsp.enable'))).toBe(
      false,
    )
    expect(result.skippedReasons).toContain(
      'lsp-enable skipped: no enabled plugin declares lsp-server-enabler capability',
    )
  })

  it('generates both blocks when all prerequisites met', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    expect(result.code.some((line) => line.includes('mason-registry'))).toBe(
      true,
    )
    expect(result.code.some((line) => line.includes('vim.lsp.enable'))).toBe(
      true,
    )
    expect(result.skippedReasons).toBeUndefined()
  })

  it('generates mason block with correct package names', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls', 'rust_analyzer'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    expect(
      result.code.some((line) => line.includes('lua-language-server')),
    ).toBe(true)
    expect(result.code.some((line) => line.includes('rust-analyzer'))).toBe(
      true,
    )
  })

  it('sorts server names alphabetically', () => {
    const input: LspSectionInput = {
      enabledServers: ['zebra', 'alpha', 'beta'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    const alphaIndex = result.code.findIndex((line) => line.includes('"alpha"'))
    const betaIndex = result.code.findIndex((line) => line.includes('"beta"'))
    const zebraIndex = result.code.findIndex((line) => line.includes('"zebra"'))
    expect(alphaIndex).toBeLessThan(betaIndex)
    expect(betaIndex).toBeLessThan(zebraIndex)
  })

  it('emits info diagnostic for servers without mason package', () => {
    const input: LspSectionInput = {
      enabledServers: ['gdscript'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    expect(
      result.diagnostics.some(
        (d) => d.severity === 'info' && d.message.includes('no Mason package'),
      ),
    ).toBe(true)
  })

  it('emits warning diagnostic for unknown servers', () => {
    const input: LspSectionInput = {
      enabledServers: ['unknown_server_xyz'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    expect(
      result.diagnostics.some(
        (d) =>
          d.severity === 'warning' &&
          d.message.includes('not found in catalog'),
      ),
    ).toBe(true)
  })

  it('wraps vim.lsp.enable in version guard', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [createMockPlugin('enabler', true, enablerCapability())],
    }
    const result = generateLSPSection(input)
    expect(
      result.code.some((line) => line.includes('vim.fn.has("nvim-0.11")')),
    ).toBe(true)
    expect(
      result.code.some((line) => line.includes('requires Neovim 0.11+')),
    ).toBe(true)
  })

  it('uses the capability minNvimVersion in generated Lua', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [
        createMockPlugin('generic-enabler', true, enablerCapability('0.12')),
      ],
    }
    const result = generateLSPSection(input)

    expect(
      result.code.some((line) => line.includes('vim.fn.has("nvim-0.12")')),
    ).toBe(true)
    expect(
      result.code.some((line) => line.includes('requires Neovim 0.12+')),
    ).toBe(true)
  })

  it('skips lsp-enable when the capability-bearing plugin is disabled', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [
        createMockPlugin('generic-enabler', false, enablerCapability('0.12')),
      ],
    }
    const result = generateLSPSection(input)

    expect(result.code.some((line) => line.includes('vim.lsp.enable'))).toBe(
      false,
    )
    expect(result.skippedReasons).toContain(
      'lsp-enable skipped: no enabled plugin declares lsp-server-enabler capability',
    )
  })

  it('does not emit mason block when no packages to install', () => {
    const input: LspSectionInput = {
      enabledServers: ['gdscript'],
      resolvedPlugins: [
        createMockPlugin('installer', true, installerCapability),
        createMockPlugin('enabler', true, enablerCapability()),
      ],
    }
    const result = generateLSPSection(input)
    expect(result.code.some((line) => line.includes('vim.lsp.enable'))).toBe(
      true,
    )
    expect(result.code.some((line) => line.includes('mason-registry'))).toBe(
      false,
    )
  })

  it('handles multiple skipped reasons', () => {
    const input: LspSectionInput = {
      enabledServers: ['lua_ls'],
      resolvedPlugins: [],
    }
    const result = generateLSPSection(input)
    expect(result.skippedReasons).toHaveLength(2)
    expect(result.skippedReasons).toContain(
      'lsp-package-installer skipped: no enabled plugin declares installer capability',
    )
    expect(result.skippedReasons).toContain(
      'lsp-enable skipped: no enabled plugin declares lsp-server-enabler capability',
    )
  })

  it('escapes server names in output', () => {
    const input: LspSectionInput = {
      enabledServers: ['ts_ls'],
      resolvedPlugins: [createMockPlugin('enabler', true, enablerCapability())],
    }
    const result = generateLSPSection(input)
    expect(result.code.some((line) => line.includes('"ts_ls"'))).toBe(true)
  })
})
