import { describe, expect, it } from 'vitest'
import { buildCatalog } from '@/shared/data/catalog-builder'
import { resolveActionTemplate } from '@/shared/data/neovim/action-catalog'
import { validateSchema } from '@/shared/lib/schema-validation'
import type { PluginSchema, ResolvedSchema } from '@/shared/types'
import codediffSchema from '../codediff-nvim.json'

const schema = codediffSchema as PluginSchema
const resolved: readonly ResolvedSchema[] = [{ schema, source: 'builtin' }]
const CODEDIFF_TEMPLATE_EXAMPLES = {
  'open-changes': ':CodeDiff',
  'open-staged': ':CodeDiff --staged',
  'open-inline': ':CodeDiff --inline',
  'compare-head': ':CodeDiff HEAD',
  'current-file-vs-head': ':CodeDiff file HEAD',
  'compare-two-files': ':CodeDiff file /tmp/old.lua /tmp/new.lua',
  'compare-two-directories':
    ':CodeDiff dir /tmp/project-before /tmp/project-after',
  history: ':CodeDiff history',
  'selected-lines-history': ":'<,'>CodeDiff history",
  merge: ':CodeDiff merge src/main.ts',
  install: ':CodeDiff install',
  'force-reinstall': ':CodeDiff install!',
} as const

describe('codediff.nvim schema', () => {
  it('models the official schema inventory', () => {
    expect(validateSchema(schema).valid).toBe(true)
    expect(schema.pluginRepo).toBe(
      'https://github.com/esmuellert/codediff.nvim',
    )
    expect(schema.options).toHaveLength(123)
    expect(
      schema.options.find((option) => option.key === 'keymaps.view.quit'),
    ).toMatchObject({ default: 'q', type: 'keysequence' })
    expect(
      schema.options.find(
        (option) => option.key === 'keymaps.conflict.diffget_current',
      ),
    ).toMatchObject({ default: '3do', type: 'keysequence' })
    expect(
      schema.options.find((option) => option.key === 'highlights.char_insert'),
    ).not.toHaveProperty('default')
    expect(schema.events).toEqual([
      'CodeDiffOpen',
      'CodeDiffClose',
      'CodeDiffFileSelect',
    ])
  })

  it('exposes command presets with typed resolution', () => {
    const commands = buildCatalog([], resolved).filter(
      (entry) => entry.type === 'command',
    )
    const inline = commands.find(
      (entry) => entry.key === 'codediff-nvim:cmd-template:open-inline',
    )
    if (inline === undefined) throw new Error('missing inline preset')
    expect(resolveActionTemplate(inline.template, {}, inline.params)).toBe(
      ':CodeDiff --inline',
    )
    for (const [key, example] of Object.entries(CODEDIFF_TEMPLATE_EXAMPLES)) {
      expect(
        commands.find(
          (entry) => entry.key === `codediff-nvim:cmd-template:${key}`,
        )?.example,
      ).toBe(example)
    }
  })
})
