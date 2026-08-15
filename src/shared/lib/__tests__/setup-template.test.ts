import { describe, expect, it } from 'vitest'
import { renderSetupTemplate, validateSetupTemplate } from '../setup-template'

describe('validateSetupTemplate', () => {
  it('requires {{config}} and rejects unknown placeholders', () => {
    expect(validateSetupTemplate('local x = {{config}}')).toEqual([])
    expect(validateSetupTemplate('require({{requirePath}})')).not.toEqual([])
    expect(
      validateSetupTemplate('local x = {{config}}; local y = {{unknown}}'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('unknown placeholder'),
        }),
      ]),
    )
  })
})

describe('renderSetupTemplate', () => {
  it('substitutes pre-serialized config and requirePath deterministically', () => {
    const rendered = renderSetupTemplate({
      template:
        'local config = {{config}}\nlocal mod = require({{requirePath}})',
      serializedConfig:
        '{\n  enabled = true,\n  nested = {\n    count = 2,\n  },\n}',
      serializedRequirePath: '"my-plugin"',
    })

    expect(rendered).toContain('local config = {')
    expect(rendered).toContain('enabled = true')
    expect(rendered).toContain('require("my-plugin")')
    expect(rendered).not.toContain('{{config}}')
    expect(rendered).not.toContain('{{requirePath}}')
  })

  it('performs exact placeholder replacement without re-serializing input', () => {
    const rendered = renderSetupTemplate({
      template: 'local config = {{config}}\nrequire({{requirePath}})',
      serializedConfig: '{ mode = "safe" }',
      serializedRequirePath: '"plugin\\"name"',
    })

    expect(rendered).toBe(
      'local config = { mode = "safe" }\nrequire("plugin\\"name")',
    )
  })
})
