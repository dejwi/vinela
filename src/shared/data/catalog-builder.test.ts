import { describe, expect, it } from 'vitest'
import type { ActionCatalogEntry } from '@/shared/data/neovim/action-catalog'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog'
import type { PluginSchema, ResolvedSchema } from '@/shared/types'
import { buildCatalog } from './catalog-builder'

describe('buildCatalog', () => {
  it('includes all core action entries', () => {
    const coreEntries: ActionCatalogEntry[] = [
      {
        key: 'write',
        type: 'command',
        category: 'file',
        label: 'Save File',
        shortDescription: 'Save current buffer',
        whatItDoes: 'Saves the current buffer to disk',
        template: ':write',
        example: ':write',
        sourceDoc: ':help :write',
      },
    ]

    const catalog = buildCatalog(coreEntries, [])

    expect(catalog).toHaveLength(1)
    expect(catalog[0]?.key).toBe('write')
    expect(catalog[0]?.type).toBe('command')
    expect(catalog[0]?.label).toBe('Save File')
  })

  it('includes functions from installed plugins', () => {
    const schema: PluginSchema = {
      id: 'telescope',
      pluginName: 'Telescope',
      pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'find_files',
          label: 'Find Files',
          shortDescription: 'Fuzzy find files',
          params: [],
          luaCall: "require('telescope.builtin').find_files()",
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]

    const catalog = buildCatalog([], installedSchemas)

    expect(catalog).toHaveLength(1)
    expect(catalog[0]?.key).toBe('telescope:find_files')
    expect(catalog[0]?.type).toBe('function')
    expect(catalog[0]?.label).toBe('Find Files')
  })

  it('excludes commands covered by relatedCommand', () => {
    const schema: PluginSchema = {
      id: 'telescope',
      pluginName: 'Telescope',
      pluginRepo: 'https://github.com/nvim-telescope/telescope.nvim',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'find_files',
          params: [],
          luaCall: "require('telescope.builtin').find_files()",
          relatedCommand: ':Telescope find_files',
        },
      ],
      exCommands: [
        {
          name: 'Telescope',
          description: 'Open Telescope picker',
          template: ':Telescope find_files',
          example: ':Telescope find_files',
          sourceDoc: ':help :Telescope',
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]

    const catalog = buildCatalog([], installedSchemas)

    // Should only have the function, not the command
    expect(catalog).toHaveLength(1)
    expect(catalog[0]?.type).toBe('function')
  })

  it('includes commands without relatedCommand coverage', () => {
    const schema: PluginSchema = {
      id: 'mason',
      pluginName: 'Mason',
      pluginRepo: 'https://github.com/williamboman/mason.nvim',
      version: '1.0.0',
      options: [],
      functions: [],
      exCommands: [
        {
          name: 'Mason',
          description: 'Open Mason UI',
          template: ':Mason',
          example: ':Mason',
          sourceDoc: ':help :Mason',
        },
        {
          name: 'MasonInstall',
          description: 'Install a package with Mason',
          template: ':MasonInstall {package}',
          example: ':MasonInstall telescope.nvim',
          sourceDoc: ':help :MasonInstall',
          params: [
            {
              name: 'package',
              placeholder: 'package-name',
              description: 'Package to install',
            },
          ],
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]

    const catalog = buildCatalog([], installedSchemas)

    expect(catalog).toHaveLength(2)
    expect(catalog.every((e) => e.type === 'command')).toBe(true)
  })

  it('maps old ActionCategory to new CatalogCategory', () => {
    const coreEntries: ActionCatalogEntry[] = [
      {
        key: 'test',
        type: 'command',
        category: 'file', // Old category
        label: 'Test',
        shortDescription: 'Test',
        whatItDoes: 'Test',
        template: ':test',
        example: ':test',
        sourceDoc: ':help test',
      },
    ]

    const catalog = buildCatalog(coreEntries, [])

    expect(catalog[0]?.category).toBe('files') // New category (pluralized)
  })

  it('uses shortDescription fallback to description', () => {
    const schema: PluginSchema = {
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'https://github.com/test/test',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'test_func',
          description: 'Fallback description',
          params: [],
          luaCall: 'test()',
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]

    const catalog = buildCatalog([], installedSchemas)

    expect(catalog[0]?.shortDescription).toBe('Fallback description')
  })

  it('normalizes invalid category to uncategorized', () => {
    const schema: PluginSchema = {
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'https://github.com/test/test',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'test_func',
          params: [],
          luaCall: 'test()',
          category: 'invalid-category', // Invalid category
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]
    const catalog = buildCatalog([], installedSchemas)

    expect(catalog[0]?.category).toBe('uncategorized')
  })

  it('normalizes undefined category to uncategorized', () => {
    const schema: PluginSchema = {
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'https://github.com/test/test',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'test_func',
          params: [],
          luaCall: 'test()',
          // No category field
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]
    const catalog = buildCatalog([], installedSchemas)

    expect(catalog[0]?.category).toBe('uncategorized')
  })

  it('preserves valid category from schema', () => {
    const schema: PluginSchema = {
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'https://github.com/test/test',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'test_func',
          params: [],
          luaCall: 'test()',
          category: 'search',
        },
      ],
    }

    const installedSchemas: ResolvedSchema[] = [{ schema, source: 'builtin' }]
    const catalog = buildCatalog([], installedSchemas)

    expect(catalog[0]?.category).toBe('search')
  })

  it('retains templates for a covered base command and resolves emitted values', () => {
    const schema: PluginSchema = {
      id: 'plugin',
      pluginName: 'Plugin',
      pluginRepo: 'https://github.com/test/plugin',
      version: '1.0.0',
      options: [],
      functions: [
        {
          name: 'open',
          params: [],
          luaCall: 'open()',
          relatedCommand: ':Plugin',
        },
      ],
      exCommands: [
        {
          name: 'Plugin',
          description: 'Open plugin',
          template: ':Plugin {staged} {repo}',
          example: ':Plugin',
          sourceDoc: ':help Plugin',
          params: [
            {
              name: 'staged',
              placeholder: 'Disabled',
              description: 'Staged only',
              type: 'boolean',
              optional: true,
              emit: { kind: 'flag', token: '--staged' },
            },
            {
              name: 'repo',
              placeholder: '/repo',
              description: 'Repository',
              type: 'directory-path',
              optional: true,
              escape: 'ex-argument',
              emit: { kind: 'option', prefix: '--repo' },
            },
          ],
        },
      ],
      exCommandTemplates: [
        {
          key: 'staged',
          baseCommandName: 'Plugin',
          label: 'Staged',
          shortDescription: 'Staged changes',
          defaults: { staged: true },
          example: ':Plugin --staged',
        },
        {
          key: 'repo',
          baseCommandName: 'Plugin',
          label: 'Repository',
          shortDescription: 'Repository changes',
          defaults: {},
        },
      ],
    }

    const catalog = buildCatalog([], [{ schema, source: 'builtin' }])
    expect(catalog.map((entry) => entry.key)).toEqual([
      'plugin:open',
      'plugin:cmd-template:staged',
      'plugin:cmd-template:repo',
    ])
    const preset = catalog[1]
    expect(preset?.type).toBe('command')
    if (preset?.type !== 'command') throw new Error('expected command')
    expect(preset.example).toBe(':Plugin --staged')
    const repoPreset = catalog[2]
    expect(repoPreset?.example).toBe(':Plugin')
    expect(
      resolveActionTemplate(
        preset.template,
        { repo: '/repo with space' },
        preset.params,
      ),
    ).toBe(':Plugin --staged --repo /repo\\ with\\ space')
  })
})
