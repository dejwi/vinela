import { describe, expect, it } from 'vitest'
import {
  buildFunctionCatalog,
  findFunctionByKey,
} from '@/shared/data/function-catalog-builder'
import { renderTemplate } from '@/shared/lib/lua-template'
import type {
  PluginSchema,
  SchemaFunction,
  SchemaFunctionParam,
  SchemaOption,
} from '@/shared/types'
import snacksSchema from '../snacks-nvim.json'

const SNACKS_PICKER_LAYOUT_PRESETS = [
  'default',
  'vertical',
  'vscode',
  'telescope',
  'ivy',
  'ivy_split',
  'dropdown',
  'select',
  'sidebar',
  'left',
  'right',
  'top',
  'bottom',
] as const

const ALLOWLIST = new Set([
  'animate.enabled',
  'bigfile.enabled',
  'dashboard.enabled',
  'dim.enabled',
  'explorer.enabled',
  'gitbrowse.enabled',
  'image.enabled',
  'indent.enabled',
  'input.enabled',
  'lazygit.enabled',
  'notifier.enabled',
  'picker.enabled',
  'profiler.enabled',
  'quickfile.enabled',
  'scope.enabled',
  'scratch.enabled',
  'scroll.enabled',
  'statuscolumn.enabled',
  'terminal.enabled',
  'toggle.enabled',
  'words.enabled',
  'zen.enabled',
])

function byKey(
  options: readonly SchemaOption[],
  key: string,
): SchemaOption | undefined {
  return options.find((option) => option.key === key)
}

function getOptionDefaultValue(option: SchemaOption | undefined): unknown {
  if (option === undefined || option.type === 'plugin-keymap') {
    return undefined
  }

  return option.default
}

describe('snacks-nvim schema enabledWhen migration', () => {
  const schema = snacksSchema as PluginSchema
  const keysExpectedFalse = [
    'picker.enabled',
    'explorer.enabled',
    'lazygit.enabled',
    'terminal.enabled',
    'indent.enabled',
    'dashboard.enabled',
    'notifier.enabled',
    'scope.enabled',
    'words.enabled',
    'scroll.enabled',
    'statuscolumn.enabled',
    'bigfile.enabled',
    'quickfile.enabled',
    'input.enabled',
    'image.enabled',
    'dim.enabled',
    'zen.enabled',
    'toggle.enabled',
    'indent.indent.enabled',
    'indent.animate.enabled',
    'indent.scope.enabled',
    'scope.treesitter.enabled',
    'dim.animate.enabled',
    'image.doc.enabled',
    'image.math.enabled',
  ] as const

  const topLevelModuleEnabledKeys = [
    'picker.enabled',
    'explorer.enabled',
    'lazygit.enabled',
    'terminal.enabled',
    'indent.enabled',
    'dashboard.enabled',
    'notifier.enabled',
    'scope.enabled',
    'words.enabled',
    'scroll.enabled',
    'statuscolumn.enabled',
    'bigfile.enabled',
    'quickfile.enabled',
    'input.enabled',
    'image.enabled',
    'dim.enabled',
    'zen.enabled',
    'toggle.enabled',
  ] as const

  it('bumps version to 1.7.0', () => {
    expect(schema.version).toBe('1.7.0')
  })

  it('renames picker.sources raw key to picker.sourcesRaw with emitKey alias', () => {
    expect(byKey(schema.options, 'picker.sources')).toBeUndefined()
    const rawOption = byKey(schema.options, 'picker.sourcesRaw')
    expect(rawOption?.emitKey).toBe('picker.sources')
  })

  it('does not ship literal tilde path defaults', () => {
    const allowlistedTransformKeys = new Set<string>()

    for (const option of schema.options) {
      const defaultValue = getOptionDefaultValue(option)
      if (typeof defaultValue !== 'string') {
        continue
      }

      const looksLikeLiteralTildePath =
        defaultValue.startsWith('~/') || defaultValue.includes('~/.')

      if (!looksLikeLiteralTildePath) {
        continue
      }

      expect(allowlistedTransformKeys.has(option.key)).toBe(false)
    }
  })

  it('keeps lazygit theme path unset by default', () => {
    expect(
      getOptionDefaultValue(byKey(schema.options, 'lazygit.theme_path')),
    ).toBe(undefined)
  })

  it('matches current upstream picker matcher defaults or leaves them unset', () => {
    const keys = [
      'picker.matcher.fuzzy',
      'picker.matcher.smartcase',
      'picker.matcher.ignorecase',
      'picker.matcher.filename_bonus',
      'picker.matcher.file_pos',
    ] as const

    for (const key of keys) {
      const defaultValue = getOptionDefaultValue(byKey(schema.options, key))
      expect(defaultValue === undefined || defaultValue === true).toBe(true)
    }
  })

  it('retains the intentional picker.ui_select default override', () => {
    expect(
      getOptionDefaultValue(byKey(schema.options, 'picker.ui_select')),
    ).toBe(false)
  })

  it('includes typed picker.sources keys with expected defaults', () => {
    const expected: ReadonlyArray<{
      key: string
      type: SchemaOption['type']
      defaultValue?: unknown
    }> = [
      {
        key: 'picker.sources.files.hidden',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.files.ignored',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.files.follow',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.grep.hidden',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.grep.ignored',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.grep.follow',
        type: 'boolean',
        defaultValue: false,
      },
      { key: 'picker.sources.grep.regex', type: 'boolean', defaultValue: true },
      {
        key: 'picker.sources.buffers.hidden',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.buffers.unloaded',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.buffers.current',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.buffers.modified',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.buffers.sort_lastused',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.explorer.hidden',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.explorer.ignored',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'picker.sources.explorer.tree',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.explorer.git_status',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.explorer.diagnostics',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.explorer.follow_file',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.explorer.watch',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'picker.sources.files.formatters.file.truncate',
        type: 'select',
      },
      {
        key: 'picker.sources.grep.formatters.severity.pos',
        type: 'select',
      },
      {
        key: 'picker.sources.buffers.layout.preset',
        type: 'select',
      },
      {
        key: 'picker.sources.explorer.layout.preview',
        type: 'boolean',
      },
      { key: 'picker.sources.files.on_change', type: 'lua' },
      { key: 'picker.sources.grep.on_change', type: 'lua' },
      {
        key: 'picker.sources.explorer.win.input.keys',
        type: 'lua',
        defaultValue: '{}',
      },
      {
        key: 'picker.sources.explorer.win.list.keys',
        type: 'lua',
        defaultValue: '{}',
      },
    ]

    for (const entry of expected) {
      const option = byKey(schema.options, entry.key)
      expect(option?.type).toBe(entry.type)
      if (entry.defaultValue !== undefined) {
        expect(getOptionDefaultValue(option)).toBe(entry.defaultValue)
      }
      expect(option?.enabledWhen?.key).toBe('picker.enabled')
    }
  })

  it('keeps global picker truncate unset by default and warns when explicitly set', () => {
    const option = byKey(schema.options, 'picker.formatters.file.truncate')
    expect(option?.type).toBe('select')
    expect(getOptionDefaultValue(option)).toBeUndefined()
    expect(option?.notices).toEqual([
      {
        severity: 'warning',
        surfaces: ['configuration', 'generation'],
        when: { kind: 'has-explicit-value' },
        message:
          'Global picker filename truncation applies to all picker sources and can break source-specific behavior such as Explorer rendering. Prefer setting truncation on a specific source, for example Picker / Sources / Files / Formatters → Filename Truncation.',
      },
    ])
  })

  it('adds rich source-specific picker fields without defaults', () => {
    const expectedKeys = [
      'picker.sources.files.dirs',
      'picker.sources.files.formatters.file.truncate',
      'picker.sources.files.layout.preset',
      'picker.sources.grep.glob',
      'picker.sources.grep.formatters.severity.pos',
      'picker.sources.buffers.nofile',
      'picker.sources.buffers.layout.preset',
      'picker.sources.explorer.focus',
      'picker.sources.explorer.jump.close',
      'picker.sources.explorer.layout.preview',
    ] as const

    for (const key of expectedKeys) {
      const option = byKey(schema.options, key)
      expect(option).toBeDefined()
      expect(getOptionDefaultValue(option)).toBeUndefined()
      expect(option?.enabledWhen?.key).toBe('picker.enabled')
    }
  })

  it('sets planned module/submodule enable defaults to false', () => {
    for (const key of keysExpectedFalse) {
      expect(getOptionDefaultValue(byKey(schema.options, key))).toBe(false)
    }
  })

  it('has no top-level module default enabled=true', () => {
    for (const key of topLevelModuleEnabledKeys) {
      expect(getOptionDefaultValue(byKey(schema.options, key))).not.toBe(true)
    }
  })

  it('does not set both visibleWhen and enabledWhen', () => {
    for (const option of schema.options) {
      expect(
        !(option.visibleWhen !== undefined && option.enabledWhen !== undefined),
      ).toBe(true)
    }
  })

  it('keeps enabledWhen keys on module-gate allowlist', () => {
    const keys = new Set(schema.options.map((option) => option.key))
    for (const option of schema.options) {
      if (option.enabledWhen === undefined) continue
      expect(ALLOWLIST.has(option.enabledWhen.key)).toBe(true)
      expect(keys.has(option.enabledWhen.key)).toBe(true)
    }
  })

  it('keeps nested gates as visibleWhen witnesses', () => {
    expect(
      byKey(schema.options, 'indent.animate.style')?.visibleWhen?.key,
    ).toBe('indent.animate.enabled')
    expect(
      byKey(schema.options, 'indent.chunk.only_current')?.visibleWhen?.key,
    ).toBe('indent.chunk.enabled')
  })
})

function getParam(
  fn: SchemaFunction,
  name: string,
): SchemaFunctionParam | undefined {
  return fn.params.find((param) => param.name === name)
}

describe('snacks picker function invariants', () => {
  const schema = snacksSchema as PluginSchema
  const pickerFns = schema.functions.filter((fn) =>
    fn.name.startsWith('picker_'),
  )

  it('keeps picker_resume empty and picker_select opts-only', () => {
    const resume = pickerFns.find((fn) => fn.name === 'picker_resume')
    const select = pickerFns.find((fn) => fn.name === 'picker_select')
    expect(resume?.params.length ?? -1).toBe(0)
    expect(select?.params.length ?? -1).toBe(1)
    expect(select?.params[0]?.name).toBe('opts')
  })

  it('enforces opts as last advanced escape-hatch on picker functions', () => {
    for (const fn of pickerFns) {
      if (fn.name === 'picker_resume' || fn.name === 'picker_select') continue
      const last = fn.params[fn.params.length - 1]
      expect(last?.name).toBe('opts')
      expect(last?.type === 'any' || last?.type === 'table').toBe(true)
      if (last?.tier !== undefined) {
        expect(last.tier).toBe('advanced')
      }
      if (last?.group !== undefined) {
        expect(last.group).toBe('Escape hatch')
      }
    }
  })

  it('enforces layout preset enum where exposed', () => {
    for (const fn of pickerFns) {
      const layoutPreset = getParam(fn, 'layout.preset')
      if (layoutPreset === undefined) continue
      expect(layoutPreset.allowedValues ?? []).toEqual(
        SNACKS_PICKER_LAYOUT_PRESETS,
      )
    }
  })

  it('keeps basic-tier param count under budget', () => {
    for (const fn of pickerFns) {
      const basicCount = fn.params.filter(
        (param) => (param.tier ?? 'basic') === 'basic',
      ).length
      expect(basicCount).toBeLessThanOrEqual(6)
    }
  })

  it('requires allowedValues for multi-select params', () => {
    for (const fn of pickerFns) {
      for (const param of fn.params) {
        if (param.multi !== true) continue
        expect((param.allowedValues?.length ?? 0) > 0).toBe(true)
      }
    }
  })

  it('requires table/any type when objectShape is present', () => {
    for (const fn of pickerFns) {
      for (const param of fn.params) {
        if ((param.objectShape?.length ?? 0) === 0) continue
        expect(param.type === 'table' || param.type === 'any').toBe(true)
      }
    }
  })

  it('requires explicit tier metadata on picker params', () => {
    for (const fn of pickerFns) {
      if (fn.name === 'picker_resume') continue
      for (const param of fn.params) {
        expect(param.tier === 'basic' || param.tier === 'advanced').toBe(true)
      }
    }
  })

  it('uses single-options picker templates without nested opts key', () => {
    for (const fn of pickerFns) {
      if (fn.name === 'picker_resume' || fn.name === 'picker_select') continue
      expect(fn.luaCall.includes('opts = $params.opts')).toBe(false)
      expect(fn.luaCall).toMatch(/^Snacks\.picker\.[a-zA-Z0-9_]+\(\$params\)$/)
    }
  })
})

describe('snacks-nvim plugin entry display formatting', () => {
  const resolved = {
    schema: snacksSchema as PluginSchema,
    source: 'builtin' as const,
  }

  it('Snacks.explorer entry shows real Lua call, not fabricated signature/help', () => {
    const catalog = buildFunctionCatalog([resolved])
    const entry = findFunctionByKey(catalog, 'plugin:snacks-nvim:explorer_open')
    expect(entry).toBeDefined()
    expect(entry?.signature).toBe(
      entry?.luaCall
        .replace(/\$params\.([A-Za-z_][A-Za-z0-9_]*)/g, '$1')
        .replace(/\$params\b/g, '...'),
    )
    expect(entry?.signature).not.toContain('explorer_open')
    expect(entry?.sourceDoc).not.toMatch(/^:help\s+explorer_open$/)
  })

  it('no Snacks plugin entry leaks a `:help <internal_name>` reference', () => {
    const catalog = buildFunctionCatalog([resolved])
    const snacksEntries = catalog.entries.filter(
      (e) =>
        e.isPlugin &&
        e.functionSource.type === 'plugin' &&
        e.functionSource.pluginId === 'snacks-nvim',
    )
    expect(snacksEntries.length).toBeGreaterThan(0)
    for (const entry of snacksEntries) {
      expect(entry.sourceDoc).not.toMatch(/^:help\s+[a-z_][a-z0-9_]*$/)
      expect(entry.signature).not.toContain('$params')
    }
  })
})

describe('snacks-nvim duplicate purge', () => {
  const resolved = {
    schema: snacksSchema as PluginSchema,
    source: 'builtin' as const,
  }
  const catalog = buildFunctionCatalog([resolved])

  it('does not ship redundant empty-defaults picker templates', () => {
    const removedTemplateKeys = [
      'plugin:snacks-nvim:template:picker-files-default',
      'plugin:snacks-nvim:template:picker-grep-default',
      'plugin:snacks-nvim:template:picker-smart-default',
      'plugin:snacks-nvim:template:picker-buffers',
      'plugin:snacks-nvim:template:picker-recent',
      'plugin:snacks-nvim:template:picker-keymaps',
      'plugin:snacks-nvim:template:picker-diagnostics-buffer',
      'plugin:snacks-nvim:template:picker-lsp-references',
      'plugin:snacks-nvim:template:picker-git-status',
    ]
    for (const key of removedTemplateKeys) {
      expect(findFunctionByKey(catalog, key)).toBeUndefined()
    }
  })

  it('keeps templates that provide real parameter presets', () => {
    const keptTemplateKeys = [
      'plugin:snacks-nvim:template:picker-files-hidden',
      'plugin:snacks-nvim:template:picker-grep-hidden',
      'plugin:snacks-nvim:template:picker-explorer-hidden',
      'plugin:snacks-nvim:template:picker-files-config',
      'plugin:snacks-nvim:template:picker-grep-config',
    ]
    for (const key of keptTemplateKeys) {
      expect(findFunctionByKey(catalog, key)).toBeDefined()
    }
  })

  it('does not ship the deprecated duplicate function entries', () => {
    const removedFunctionKeys = [
      'plugin:snacks-nvim:explorer_open_with_opts',
      'plugin:snacks-nvim:lazygit_open_with_opts',
      'plugin:snacks-nvim:scratch_open_with_opts',
      'plugin:snacks-nvim:dashboard_show',
      'plugin:snacks-nvim:bufdelete_buffer',
    ]
    for (const key of removedFunctionKeys) {
      expect(findFunctionByKey(catalog, key)).toBeUndefined()
    }
  })

  it('promotes _with_opts params onto the kept base entries', () => {
    const explorer = findFunctionByKey(
      catalog,
      'plugin:snacks-nvim:explorer_open',
    )
    const lazygit = findFunctionByKey(
      catalog,
      'plugin:snacks-nvim:lazygit_open',
    )
    const scratch = findFunctionByKey(
      catalog,
      'plugin:snacks-nvim:scratch_open',
    )

    expect(explorer?.luaCall).toBe(
      'Snacks.explorer.open({ cwd = $params.cwd })',
    )
    expect(explorer?.params.map((p) => p.name)).toEqual(['cwd'])

    expect(lazygit?.luaCall).toBe('Snacks.lazygit.open({ cwd = $params.cwd })')
    expect(lazygit?.params.map((p) => p.name)).toEqual(['cwd'])

    expect(scratch?.luaCall).toBe(
      'Snacks.scratch.open({ name = $params.name, ft = $params.ft })',
    )
    expect(scratch?.params.map((p) => p.name).sort()).toEqual(['ft', 'name'])
  })

  it('renders explorer_open with unset optional cwd as explicit nil', () => {
    const entry = findFunctionByKey(catalog, 'plugin:snacks-nvim:explorer_open')
    expect(entry).toBeDefined()
    expect(entry?.luaCall).toBe('Snacks.explorer.open({ cwd = $params.cwd })')

    const result = renderTemplate(
      entry?.luaCall ?? '',
      entry?.params ?? [],
      {},
      {},
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.lua).toBe('Snacks.explorer.open({ cwd = nil })')
    }
  })

  it('keeps the canonical dashboard_open and bufdelete_current entries', () => {
    const dashboard = findFunctionByKey(
      catalog,
      'plugin:snacks-nvim:dashboard_open',
    )
    const bufdelete = findFunctionByKey(
      catalog,
      'plugin:snacks-nvim:bufdelete_current',
    )
    expect(dashboard).toBeDefined()
    expect(dashboard?.luaCall).toBe('Snacks.dashboard.open()')
    expect(bufdelete).toBeDefined()
    expect(bufdelete?.luaCall).toBe('Snacks.bufdelete($params.buf)')
  })

  it('every picker_* base function keeps a "Picker: …" label', () => {
    const pickerBases = (snacksSchema as PluginSchema).functions.filter((f) =>
      f.name.startsWith('picker_'),
    )
    expect(pickerBases.length).toBeGreaterThan(30)
    for (const fn of pickerBases) {
      expect(fn.label, `function ${fn.name} should have a label`).toBeDefined()
      expect(
        fn.label,
        `picker base function ${fn.name} must have a label starting with "Picker: "`,
      ).toMatch(/^Picker: /)
    }
  })

  it('only picker_* base functions use the "Picker: " prefix', () => {
    const allEntries = catalog.entries.filter(
      (e) =>
        e.functionSource.type === 'plugin' &&
        e.functionSource.pluginId === 'snacks-nvim',
    )
    for (const e of allEntries) {
      if (e.label.startsWith('Picker: ')) {
        const isPickerBase =
          e.functionSource.type === 'plugin' &&
          e.functionSource.functionName.startsWith('picker_')
        expect(
          isPickerBase,
          `entry "${e.label}" (key=${e.key}) uses the "Picker: " prefix but is not a picker_* base function`,
        ).toBe(true)
      }

      if (e.key.includes(':template:')) {
        expect(
          e.label.startsWith('Picker: '),
          `template entry "${e.label}" (key=${e.key}) must not use the "Picker: " prefix`,
        ).toBe(false)
      }
    }
  })

  it('no two snacks plugin entries duplicate (label-stem, lua-head)', () => {
    const normaliseLabel = (label: string): string =>
      label
        .replace(/^Picker:\s*/i, '')
        .replace(/\s+Picker$/i, '')
        .trim()
        .toLowerCase()

    const luaHead = (luaCall: string): string => {
      const match = /^([A-Za-z_][\w.]*)/.exec(luaCall)
      return (match?.[1] ?? luaCall).toLowerCase()
    }

    const seen = new Map<string, string>()
    const collisions: { a: string; b: string; composite: string }[] = []

    for (const entry of catalog.entries) {
      if (entry.functionSource.type !== 'plugin') continue
      if (entry.functionSource.pluginId !== 'snacks-nvim') continue
      const composite = `${normaliseLabel(entry.label)}::${luaHead(entry.luaCall)}`
      const prior = seen.get(composite)
      if (prior !== undefined) {
        collisions.push({ a: prior, b: entry.key, composite })
      } else {
        seen.set(composite, entry.key)
      }
    }

    expect(
      collisions,
      `duplicate (label-stem, lua-head) pairs:\n${collisions
        .map((c) => `  ${c.composite}\n    ${c.a}\n    ${c.b}`)
        .join('\n')}`,
    ).toEqual([])
  })

  it('no two non-template snacks plugin entries share an identical luaCall', () => {
    const seen = new Map<string, string>()
    const duplicates: { a: string; b: string; luaCall: string }[] = []
    for (const entry of catalog.entries) {
      if (entry.functionSource.type !== 'plugin') continue
      if (entry.functionSource.pluginId !== 'snacks-nvim') continue
      if (entry.key.includes(':template:')) continue
      const prior = seen.get(entry.luaCall)
      if (prior !== undefined) {
        duplicates.push({ a: prior, b: entry.key, luaCall: entry.luaCall })
      } else {
        seen.set(entry.luaCall, entry.key)
      }
    }
    expect(duplicates).toEqual([])
  })
})
