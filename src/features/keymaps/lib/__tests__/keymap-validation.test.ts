import { describe, expect, it } from 'vitest'
import type {
  InstalledPlugin,
  PluginSchema,
  ResolvedSchema,
} from '@/shared/types'
import type { ProjectKeymap } from '../../types'
import {
  getKeymapIssues,
  hasKeymapErrors,
  type KeymapValidationIssue,
  validateKeymapReferences,
} from '../keymap-validation'

// ── Mock Data Factories ──────────────────────────────────────────────────

function createKeymap(
  id: string,
  actionType: ProjectKeymap['action']['actionType'],
  overrides: Partial<ProjectKeymap['action']> = {},
): ProjectKeymap {
  return {
    id,
    modes: ['n'],
    keySequence: `<leader>${id}`,
    description: `Test keymap ${id}`,
    silent: true,
    noremap: true,
    expr: false,
    enabled: true,
    action: {
      actionType,
      ...overrides,
    } as ProjectKeymap['action'],
  }
}

function createRunFunctionKeymap(
  id: string,
  functionSourceType: 'core' | 'plugin',
  pluginId?: string,
  functionName?: string,
  selectedFunctionKey = 'key-123',
): ProjectKeymap {
  return createKeymap(id, 'run-function', {
    selectedFunctionKey,
    functionSource:
      functionSourceType === 'core'
        ? { type: 'core', functionName: functionName || 'print' }
        : {
            type: 'plugin',
            pluginId: pluginId || 'test',
            functionName: functionName || 'test',
          },
    signature: null,
    paramDefaults: {},
  })
}

function createCustomActionKeymap(id: string, graphId: string): ProjectKeymap {
  return createKeymap(id, 'run-custom-action', {
    graphId,
    graphName: 'Test Graph',
  })
}

function createPlugin(id: string, enabled = true): InstalledPlugin {
  return {
    schemaId: id,
    enabled,
    config: {},
    addedAt: Date.now(),
  }
}

function createSchema(
  id: string,
  functionNames: string[] = [],
): ResolvedSchema {
  return {
    schema: {
      id,
      pluginName: `Plugin ${id}`,
      description: 'A test plugin',
      pluginRepo: 'test/test',
      version: '1.0.0',
      options: [],
      functions: functionNames.map((name) => ({
        name,
        description: `Function ${name}`,
        params: [],
        luaCall: `require('${id}').${name}()`,
      })),
    } as unknown as PluginSchema,
    source: 'builtin',
  }
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('validateKeymapReferences', () => {
  it('returns no issues for keymaps with core function references', () => {
    const keymaps = [createRunFunctionKeymap('k1', 'core', undefined, 'print')]
    const issues = validateKeymapReferences(keymaps, [], [])
    expect(issues).toHaveLength(0)
  })

  it('returns no issues when plugin is installed and function exists', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'),
    ]
    const plugins = [createPlugin('telescope')]
    const schemas = [createSchema('telescope', ['find_files'])]

    const issues = validateKeymapReferences(keymaps, plugins, schemas)
    expect(issues).toHaveLength(0)
  })

  it('returns error when referenced plugin is not installed', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'),
    ]
    // Plugin is not in installed list

    const issues = validateKeymapReferences(keymaps, [], [])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.keymapId).toBe('k1')
    expect(issues[0]?.level).toBe('error')
    expect(issues[0]?.code).toBe('plugin-not-installed')
    expect(issues[0]?.message).toContain('not installed')
  })

  it('returns warning when referenced plugin is disabled', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'),
    ]
    const plugins = [createPlugin('telescope', false)] // disabled
    const schemas = [createSchema('telescope', ['find_files'])]

    const issues = validateKeymapReferences(keymaps, plugins, schemas)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.level).toBe('warning')
    expect(issues[0]?.code).toBe('plugin-disabled')
    expect(issues[0]?.message).toContain('disabled')
  })

  it('returns warning when plugin schema is missing', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'),
    ]
    const plugins = [createPlugin('telescope')] // installed
    // Schema is missing

    const issues = validateKeymapReferences(keymaps, plugins, [])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.level).toBe('warning')
    expect(issues[0]?.code).toBe('schema-missing')
    expect(issues[0]?.message).toContain('schema is missing')
  })

  it('returns warning when function no longer exists in schema', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'),
    ]
    const plugins = [createPlugin('telescope')]
    const schemas = [createSchema('telescope', ['other_function'])] // function missing

    const issues = validateKeymapReferences(keymaps, plugins, schemas)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.level).toBe('warning')
    expect(issues[0]?.code).toBe('function-missing')
    expect(issues[0]?.message).toContain('no longer exists')
  })

  it('skips disabled keymaps', () => {
    const keymap = createRunFunctionKeymap(
      'k1',
      'plugin',
      'telescope',
      'find_files',
    )
    keymap.enabled = false // Disabled

    const issues = validateKeymapReferences([keymap], [], [])
    expect(issues).toHaveLength(0) // Would normally error for missing plugin
  })

  it('handles keymaps with non-plugin actions (no validation needed)', () => {
    const keymaps = [
      createKeymap('k1', 'run-action', {
        config: {
          mode: 'custom-command',
          actionType: 'command',
          action: 'w',
          selectedActionKey: '',
          paramValues: {},
        },
      }),
      createKeymap('k2', 'set-option', {
        optionName: 'number',
        scope: 'global',
        valueConfig: { valueMode: 'suggested', suggestedValue: true },
      }),
      createKeymap('k3', 'code-block', { code: 'print("hello")' }),
    ]

    const issues = validateKeymapReferences(keymaps, [], [])
    expect(issues).toHaveLength(0)
  })

  it('returns warning for empty selectedFunctionKey', () => {
    const keymap = createRunFunctionKeymap(
      'k1',
      'plugin',
      'telescope',
      'find_files',
      '',
    )

    const issues = validateKeymapReferences([keymap], [], [])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('empty-function-key')
  })

  it('returns warning for empty graphId in run-custom-action', () => {
    const keymap = createCustomActionKeymap('k1', '  ')

    const issues = validateKeymapReferences([keymap], [], [])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('empty-graph-id')
  })

  it('handles multiple issues across multiple keymaps', () => {
    const keymaps = [
      createRunFunctionKeymap('k1', 'plugin', 'telescope', 'find_files'), // missing plugin (error)
      createRunFunctionKeymap('k2', 'plugin', 'mason', 'setup'), // disabled plugin (warning)
      createCustomActionKeymap('k3', ''), // empty graph (warning)
      createRunFunctionKeymap('k4', 'core', undefined, 'print'), // valid
    ]

    const plugins = [createPlugin('mason', false)]
    const schemas = [createSchema('mason', ['setup'])]

    const issues = validateKeymapReferences(keymaps, plugins, schemas)
    expect(issues).toHaveLength(3)

    const codes = issues.map((i) => i.code)
    expect(codes).toContain('plugin-not-installed')
    expect(codes).toContain('plugin-disabled')
    expect(codes).toContain('empty-graph-id')
  })
})

describe('getKeymapIssues', () => {
  const mockIssues: KeymapValidationIssue[] = [
    {
      keymapId: 'k1',
      level: 'error',
      code: 'plugin-not-installed',
      message: 'err',
    },
    {
      keymapId: 'k2',
      level: 'warning',
      code: 'plugin-disabled',
      message: 'warn',
    },
    {
      keymapId: 'k1',
      level: 'warning',
      code: 'schema-missing',
      message: 'warn2',
    },
  ]

  it('filters issues for a specific keymap', () => {
    const k1Issues = getKeymapIssues('k1', mockIssues)
    expect(k1Issues).toHaveLength(2)
    expect(k1Issues.every((i) => i.keymapId === 'k1')).toBe(true)
  })

  it('returns empty array when no issues for keymap', () => {
    const k3Issues = getKeymapIssues('k3', mockIssues)
    expect(k3Issues).toHaveLength(0)
  })
})

describe('hasKeymapErrors', () => {
  it('returns true when any issue is an error', () => {
    const issues: KeymapValidationIssue[] = [
      {
        keymapId: 'k1',
        level: 'warning',
        code: 'plugin-disabled',
        message: 'warn',
      },
      {
        keymapId: 'k2',
        level: 'error',
        code: 'plugin-not-installed',
        message: 'err',
      },
    ]
    expect(hasKeymapErrors(issues)).toBe(true)
  })

  it('returns false when only warnings exist', () => {
    const issues: KeymapValidationIssue[] = [
      {
        keymapId: 'k1',
        level: 'warning',
        code: 'plugin-disabled',
        message: 'warn',
      },
      {
        keymapId: 'k2',
        level: 'warning',
        code: 'schema-missing',
        message: 'warn',
      },
    ]
    expect(hasKeymapErrors(issues)).toBe(false)
  })

  it('returns false for empty issues array', () => {
    expect(hasKeymapErrors([])).toBe(false)
  })
})
