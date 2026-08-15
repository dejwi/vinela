import { describe, expect, it } from 'vitest'
import builtinSchemas from '@/schemas/index'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaMappingTableDefault,
} from '@/shared/types'
import { validateConfig, validateSchema } from '../schema-validation'

const validMappingTableDefault: SchemaMappingTableDefault = [
  { filetype: 'lua', preset: 'stylua' },
]
void validMappingTableDefault

// @ts-expect-error mapping-table defaults must be row objects, not primitives
const invalidMappingTableDefault: SchemaMappingTableDefault = ['lua']
void invalidMappingTableDefault

// ============================================
// Helper: minimal valid schema
// ============================================

function makeValidSchema(
  overrides?: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'https://github.com/test/test',
    version: '1.0.0',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeValidSchemaTyped(overrides?: Partial<PluginSchema>): PluginSchema {
  return {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'https://github.com/test/test',
    version: '1.0.0',
    options: [],
    functions: [],
    ...overrides,
  }
}

function makeMappingTableSchemaOption(
  overrides?: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    key: 'presets',
    label: 'Presets',
    type: 'mapping-table',
    default: [],
    columns: [
      {
        key: 'filetype',
        label: 'Filetype',
        type: 'select',
        options: [
          { value: 'lua', label: 'Lua' },
          { value: 'javascript', label: 'JavaScript' },
        ],
      },
      {
        key: 'preset',
        label: 'Preset',
        type: 'select',
        options: [
          { value: 'stylua', label: 'stylua' },
          { value: 'prettierd', label: 'prettierd' },
        ],
      },
    ],
    emit: {
      targetKey: 'filetype',
      keyColumn: 'filetype',
      valueColumn: 'preset',
      valueTemplate:
        'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
    },
    ...overrides,
  }
}

function makeValidSchemaFunction(
  overrides?: Partial<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    name: 'open_workspace',
    luaCall: "require('workspace').open($params)",
    params: [{ name: 'name', type: 'string', optional: true }],
    ...overrides,
  }
}

function expectInvalidParamEmission(
  result: ReturnType<typeof validateSchema>,
): void {
  expect(result.valid).toBe(false)
  expect(
    result.errors.some((error) => error.code === 'INVALID_FIELD_TYPE'),
  ).toBe(true)
  expect(
    result.errors.some((error) => error.message.includes('paramEmission')),
  ).toBe(true)
}

// ============================================
// Schema Validation Tests
// ============================================

describe('validateSchema', () => {
  it('should pass for a valid minimal schema', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should fail when schema is not an object', () => {
    const result = validateSchema('not an object')
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.code).toBe('INVALID_FIELD_TYPE')
  })

  it('should fail when schema is null', () => {
    const result = validateSchema(null)
    expect(result.valid).toBe(false)
    expect(result.errors[0]?.code).toBe('INVALID_FIELD_TYPE')
  })

  it('should fail when id is missing', () => {
    const result = validateSchema(makeValidSchema({ id: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when id is empty string', () => {
    const result = validateSchema(makeValidSchema({ id: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when pluginName is missing', () => {
    const result = validateSchema(makeValidSchema({ pluginName: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when pluginRepo is missing', () => {
    const result = validateSchema(makeValidSchema({ pluginRepo: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when version is missing', () => {
    const result = validateSchema(makeValidSchema({ version: undefined }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when version is an empty string', () => {
    const result = validateSchema(makeValidSchema({ version: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when options is not an array', () => {
    const result = validateSchema(makeValidSchema({ options: 'not-array' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when functions is not an array', () => {
    const result = validateSchema(makeValidSchema({ functions: 'not-array' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should pass with valid vim.pack metadata', () => {
    const result = validateSchema(
      makeValidSchema({
        pack: {
          name: 'blink',
          version: { mode: 'semver-range', value: '1.*' },
        },
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('should fail with invalid vim.pack version mode', () => {
    const result = validateSchema(
      makeValidSchema({
        pack: {
          version: { mode: 'branch', value: 'main' },
        },
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes(
          'pack.version.mode must be "ref" or "semver-range"',
        ),
      ),
    ).toBe(true)
  })

  // ---- Option Validation ----

  it('should pass with valid string option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'name',
            label: 'Name',
            type: 'string',
            default: 'hello',
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('should fail with duplicate option keys', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          { key: 'name', label: 'Name', type: 'string' },
          { key: 'name', label: 'Name 2', type: 'string' },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DUPLICATE_OPTION_KEY')).toBe(
      true,
    )
  })

  it('should fail with invalid option type', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [{ key: 'foo', label: 'Foo', type: 'invalid-type' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_OPTION_TYPE')).toBe(
      true,
    )
  })

  it('should fail when select option has no options array', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [{ key: 'theme', label: 'Theme', type: 'select' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_SELECT_OPTIONS')).toBe(
      true,
    )
  })

  it('should fail when select option has empty options array', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          { key: 'theme', label: 'Theme', type: 'select', options: [] },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_SELECT_OPTIONS')).toBe(
      true,
    )
  })

  it('should pass with valid select option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'theme',
            label: 'Theme',
            type: 'select',
            options: [
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ],
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('passes schema validation with valid notices and explicit-only default emission', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'picker.truncate',
            label: 'Truncate',
            type: 'select',
            defaultEmission: 'explicit-only',
            options: [
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
            ],
            notices: [
              {
                severity: 'warning',
                surfaces: ['configuration', 'generation'],
                when: { kind: 'has-explicit-value' },
                message: 'Use per-source truncate instead.',
              },
            ],
          },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('passes schema validation with generic generation rules and value-map emit metadata', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'log_level',
            label: 'Log Level',
            type: 'select',
            default: 'INFO',
            options: [{ value: 'INFO', label: 'Info' }],
            emit: {
              valueRule: {
                kind: 'value-map',
                values: {
                  INFO: { kind: 'lua', lua: 'vim.log.levels.INFO' },
                },
              },
            },
          },
          {
            key: 'picker.enabled',
            label: 'Picker Enabled',
            type: 'boolean',
            default: false,
          },
        ],
        generationRules: [
          {
            kind: 'subtree-gate',
            scope: 'picker',
            when: { key: 'picker.enabled', equals: false },
            action: 'omit-subtree',
          },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('passes schema validation with nested object generation rules', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'module',
            label: 'Module',
            type: 'object',
            properties: [
              {
                key: 'enabled',
                label: 'Enabled',
                type: 'boolean',
                default: true,
              },
              {
                key: 'setting',
                label: 'Setting',
                type: 'string',
              },
            ],
          },
          {
            key: 'legacy.mode',
            label: 'Legacy Mode',
            type: 'string',
          },
        ],
        generationRules: [
          {
            kind: 'subtree-gate',
            scope: 'module',
            when: { key: 'module.enabled', equals: false },
            action: 'omit-subtree',
          },
          {
            kind: 'conflict',
            left: 'module.setting',
            right: 'legacy.mode',
            severity: 'warning',
            message: 'Module setting conflicts with legacy mode',
          },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('passes schema validation with mapping-table options', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: [{ filetype: 'lua', preset: 'stylua' }],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'preset',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('fails schema validation when mapping-table default contains a primitive row', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: ['lua'],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'preset',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.code === 'INVALID_DEFAULT_VALUE'),
    ).toBe(true)
  })

  it('fails schema validation when mapping-table default contains a null row', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: [null],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'preset',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.code === 'INVALID_DEFAULT_VALUE'),
    ).toBe(true)
  })

  it('fails schema validation when mapping-table default contains an array row', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: [[]],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'preset',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.code === 'INVALID_DEFAULT_VALUE'),
    ).toBe(true)
  })

  it('fails schema validation when mapping-table template references an undeclared column', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: [],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'preset',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.missing}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('references undeclared column "missing"'),
      ),
    ).toBe(true)
  })

  it('fails schema validation when mapping-table raw template interpolates a string column', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'presets',
            label: 'Presets',
            type: 'mapping-table',
            default: [],
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'custom',
                label: 'Custom',
                type: 'string',
              },
            ],
            emit: {
              targetKey: 'filetype',
              keyColumn: 'filetype',
              valueColumn: 'custom',
              valueTemplate:
                'require("formatter.filetypes.{{outputKey}}").{{row.custom}}',
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes(
          'must not interpolate an unconstrained string column',
        ),
      ),
    ).toBe(true)
  })

  it('accepts valid mapping-table autofill metadata', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [
                  { value: 'lua', label: 'Lua' },
                  { value: 'javascript', label: 'JavaScript' },
                ],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  fallback: 'preserve',
                  values: {
                    lua: 'stylua',
                    javascript: 'prettierd',
                  },
                },
                options: [
                  { value: 'stylua', label: 'stylua' },
                  { value: 'prettierd', label: 'prettierd' },
                ],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('rejects mapping-table autofill with an unknown source column', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'missing',
                  values: { lua: 'stylua' },
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes(
          'sourceColumn must reference a declared sibling column',
        ),
      ),
    ).toBe(true)
  })

  it('rejects self-referential mapping-table autofill', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  values: { lua: 'lua' },
                },
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes(
          'sourceColumn must not match the target column key',
        ),
      ),
    ).toBe(true)
  })

  it('rejects mapping-table autofill source keys that are not valid source select options', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  values: { javascript: 'stylua' },
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('is not a valid option for source column'),
      ),
    ).toBe(true)
  })

  it('rejects mapping-table autofill target values that are not valid target select options', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  values: { lua: 'black' },
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('maps to invalid target value "black"'),
      ),
    ).toBe(true)
  })

  it('rejects invalid mapping-table autofill fallback values', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  fallback: 'reset',
                  values: { lua: 'stylua' },
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes(
          'fallback must be "preserve", "empty", or "column-default"',
        ),
      ),
    ).toBe(true)
  })

  it('rejects non-string mapping-table autofill values', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  values: { lua: 123 },
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('values must map to string values'),
      ),
    ).toBe(true)
  })

  it('validates mapping-table autofill using declared own entries only', () => {
    const inheritedValues = Object.create({
      javascript: 'prettierd',
    }) as Record<string, string>
    inheritedValues['lua'] = 'stylua'

    const result = validateSchema(
      makeValidSchema({
        options: [
          makeMappingTableSchemaOption({
            columns: [
              {
                key: 'filetype',
                label: 'Filetype',
                type: 'select',
                options: [{ value: 'lua', label: 'Lua' }],
              },
              {
                key: 'preset',
                label: 'Preset',
                type: 'select',
                autoFill: {
                  kind: 'value-by-column',
                  sourceColumn: 'filetype',
                  values: inheritedValues,
                },
                options: [{ value: 'stylua', label: 'stylua' }],
              },
            ],
          }),
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('fails schema validation when emit.stringRule is used on a non-string option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'enabled',
            label: 'Enabled',
            type: 'boolean',
            emit: {
              stringRule: {
                kind: 'path',
              },
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('only supported on string options'),
      ),
    ).toBe(true)
  })

  it('passes schema validation when emit.stringRule is used on a string option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'path',
            label: 'Path',
            type: 'string',
            emit: {
              stringRule: {
                kind: 'path',
                trim: true,
              },
            },
          },
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('fails schema validation with invalid notice metadata', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'picker.truncate',
            label: 'Truncate',
            type: 'select',
            options: [{ value: 'left', label: 'Left' }],
            notices: [
              {
                severity: 'info',
                surfaces: ['configuration'],
                when: { kind: 'has-explicit-value' },
                message: 'Bad severity',
              },
            ],
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.message.includes('severity must be')),
    ).toBe(true)
  })

  it('passes schema validation with valid multi-select string array default', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
          default: ['red', 'green'],
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(true)
  })

  it('fails schema validation when multi-select default is a string instead of array', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
          default: 'red',
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('fails schema validation when multi-select default contains a value not in options[]', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
          default: ['red', 'purple'],
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('passes schema validation with valid single-select default in options[]', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
          default: 'dark',
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(true)
  })

  it('fails schema validation when single-select default is not a string', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
          default: ['dark'],
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('fails schema validation when single-select default is not in options[]', () => {
    const result = validateSchema({
      id: 'test',
      pluginName: 'Test',
      pluginRepo: 'owner/test',
      version: '1.0.0',
      options: [
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
          default: 'lite',
        },
      ],
      functions: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('should fail when select option entries are malformed', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'theme',
            label: 'Theme',
            type: 'select',
            options: [{ value: '', label: 123 }],
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when array option has no items', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [{ key: 'list', label: 'List', type: 'array' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should pass with valid array option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'list',
            label: 'List',
            type: 'array',
            items: { itemType: 'string' },
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('should fail when array select item options are malformed', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'list',
            label: 'List',
            type: 'array',
            items: {
              itemType: 'select',
              options: [{ value: '', label: null }],
            },
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when object option has no properties', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [{ key: 'obj', label: 'Obj', type: 'object' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should pass with valid object option with nested properties', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'obj',
            label: 'Obj',
            type: 'object',
            properties: [{ key: 'nested', label: 'Nested', type: 'string' }],
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('should fail with invalid default for number option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'count',
            label: 'Count',
            type: 'number',
            default: 'not-a-number',
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('should fail with invalid default for boolean option', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          { key: 'flag', label: 'Flag', type: 'boolean', default: 'yes' },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_DEFAULT_VALUE')).toBe(
      true,
    )
  })

  it('should fail when number validation has min > max', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'count',
            label: 'Count',
            type: 'number',
            validation: { min: 10, max: 5 },
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'INVALID_VALIDATION_RULE'),
    ).toBe(true)
  })

  it('should fail when number validation is null', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'count',
            label: 'Count',
            type: 'number',
            validation: null,
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when array validation is null', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'tags',
            label: 'Tags',
            type: 'array',
            items: { itemType: 'string' },
            validation: null,
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when string validation pattern is invalid regex', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          {
            key: 'name',
            label: 'Name',
            type: 'string',
            validation: { pattern: '[' },
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'INVALID_VALIDATION_RULE'),
    ).toBe(true)
  })

  // ---- Dependency Validation ----

  it('should fail with self-referencing dependency', () => {
    const result = validateSchema(
      makeValidSchema({ dependencies: ['test-plugin'] }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'CIRCULAR_DEPENDENCY')).toBe(
      true,
    )
  })

  it('should pass with valid dependencies', () => {
    const result = validateSchema(
      makeValidSchema({ dependencies: ['other-plugin'] }),
    )
    expect(result.valid).toBe(true)
  })

  it('should fail when dependencies is not an array', () => {
    const result = validateSchema(
      makeValidSchema({ dependencies: 'not-array' }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  // ---- exCommands Validation ----

  describe('exCommands validation', () => {
    it('should pass when exCommands is absent', () => {
      const result = validateSchema(makeValidSchema())
      expect(result.valid).toBe(true)
    })

    it('should pass when exCommands is an empty array', () => {
      const result = validateSchema(makeValidSchema({ exCommands: [] }))
      expect(result.valid).toBe(true)
    })

    it('should fail when exCommands is not an array', () => {
      const result = validateSchema(makeValidSchema({ exCommands: 'bad' }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
        true,
      )
    })

    it('should fail when exCommand entry is not an object', () => {
      const result = validateSchema(makeValidSchema({ exCommands: ['bad'] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
        true,
      )
    })

    it('should fail when exCommand is missing required name', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              description: 'desc',
              template: ':cmd',
              example: ':cmd',
              sourceDoc: ':help cmd',
            },
          ],
        }),
      )
      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD'),
      ).toBe(true)
    })

    it('should pass for a valid exCommand without params', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Foo',
              description: 'Do foo',
              template: ':Foo',
              example: ':Foo',
              sourceDoc: ':help Foo',
            },
          ],
        }),
      )
      expect(result.valid).toBe(true)
    })

    it('should pass for a valid exCommand with valid params', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Bar',
              description: 'Do bar',
              template: ':Bar {target}',
              example: ':Bar baz',
              sourceDoc: ':help Bar',
              params: [
                {
                  name: 'target',
                  placeholder: 'baz',
                  description: 'The target',
                },
              ],
            },
          ],
        }),
      )
      expect(result.valid).toBe(true)
    })

    it('should fail when params is not an array', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Bad',
              description: 'desc',
              template: ':Bad',
              example: ':Bad',
              sourceDoc: ':help Bad',
              params: 'not-an-array',
            },
          ],
        }),
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
        true,
      )
    })

    it('should fail when param is missing name', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Cmd',
              description: 'desc',
              template: ':Cmd {x}',
              example: ':Cmd val',
              sourceDoc: ':help Cmd',
              params: [{ placeholder: 'val', description: 'desc' }],
            },
          ],
        }),
      )
      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD'),
      ).toBe(true)
    })

    it('should fail for duplicate exCommand names', () => {
      const cmd = {
        name: 'Dup',
        description: 'desc',
        template: ':Dup',
        example: ':Dup',
        sourceDoc: ':help Dup',
      }
      const result = validateSchema(makeValidSchema({ exCommands: [cmd, cmd] }))
      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.code === 'DUPLICATE_EX_COMMAND_NAME'),
      ).toBe(true)
    })

    it('should flag param name that has no matching template placeholder', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Mismatch',
              description: 'desc',
              template: ':Mismatch {a}',
              example: ':Mismatch val',
              sourceDoc: ':help Mismatch',
              params: [
                { name: 'a', placeholder: 'val', description: 'ok param' },
                {
                  name: 'b',
                  placeholder: 'val2',
                  description: 'no placeholder in template',
                },
              ],
            },
          ],
        }),
      )
      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e) => e.code === 'INVALID_EX_COMMAND_TEMPLATE'),
      ).toBe(true)
    })

    it('rejects invalid Ex-command template display metadata', () => {
      const result = validateSchema(
        makeValidSchema({
          exCommands: [
            {
              name: 'Foo',
              description: 'Do foo',
              template: ':Foo',
              example: ':Foo',
              sourceDoc: ':help Foo',
            },
          ],
          exCommandTemplates: [
            {
              key: 'foo',
              baseCommandName: 'Foo',
              label: 'Foo preset',
              shortDescription: 'Open Foo',
              defaults: {},
              aliases: 'foo',
            },
          ],
        }),
      )

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((error) =>
          error.message.includes('exCommandTemplates[0].aliases'),
        ),
      ).toBe(true)
    })

    it('validates non-empty Ex-command template examples', () => {
      const command = {
        name: 'Foo',
        description: 'Do foo',
        template: ':Foo',
        example: ':Foo',
        sourceDoc: ':help Foo',
      }
      const template = {
        key: 'foo',
        baseCommandName: 'Foo',
        label: 'Foo preset',
        shortDescription: 'Open Foo',
        defaults: {},
      }

      expect(
        validateSchema(
          makeValidSchema({
            exCommands: [command],
            exCommandTemplates: [{ ...template, example: ':Foo --bar' }],
          }),
        ).valid,
      ).toBe(true)

      for (const example of ['', 1]) {
        const result = validateSchema(
          makeValidSchema({
            exCommands: [command],
            exCommandTemplates: [{ ...template, example }],
          }),
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_FIELD_TYPE',
            message:
              'exCommandTemplates[0].example must be a non-empty string when provided',
          }),
        )
      }
    })
  })

  // ---- Function Validation ----

  it('should pass with valid function', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [{ name: 'input', type: 'string' }],
            luaCall: 'require("plugin").doThing($params)',
          },
        ],
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('should fail with duplicate function names', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [],
            luaCall: 'require("plugin").doThing()',
          },
          {
            name: 'doThing',
            params: [],
            luaCall: 'require("plugin").doThingElse()',
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'DUPLICATE_FUNCTION_NAME'),
    ).toBe(true)
  })

  it('should fail with duplicate param names within one function', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [
              { name: 'input', type: 'string' },
              { name: 'input', type: 'number' },
            ],
            luaCall: 'require("plugin").doThing($params)',
          },
        ],
      }),
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'DUPLICATE_FUNCTION_PARAM_NAME'),
    ).toBe(true)
  })

  it('should fail when function is missing name', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            params: [],
            luaCall: 'require("plugin").doThing()',
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
  })

  it('should fail when function is missing luaCall', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [],
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_LUA_CALL')).toBe(true)
  })

  it('should fail when function param has invalid type', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [{ name: 'input', type: 'invalid-type' }],
            luaCall: 'require("plugin").doThing($params)',
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should fail when function has invalid return type', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          {
            name: 'doThing',
            params: [],
            luaCall: 'require("plugin").doThing()',
            returns: 'invalid-type',
          },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
  })

  it('should pass when function paramEmission is absent', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [makeValidSchemaFunction()],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('should pass when function paramEmission.unsetOptional is "emit-nil"', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          makeValidSchemaFunction({
            paramEmission: { unsetOptional: 'emit-nil' },
          }),
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('should pass when function paramEmission.unsetOptional is "omit-trailing"', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          makeValidSchemaFunction({
            paramEmission: { unsetOptional: 'omit-trailing' },
          }),
        ],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('should pass when function paramEmission is an empty object', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [makeValidSchemaFunction({ paramEmission: {} })],
      }),
    )

    expect(result.valid).toBe(true)
  })

  it('should fail when function paramEmission is a string', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          makeValidSchemaFunction({ paramEmission: 'omit-trailing' }),
        ],
      }),
    )

    expectInvalidParamEmission(result)
  })

  it('should fail when function paramEmission is null', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [makeValidSchemaFunction({ paramEmission: null })],
      }),
    )

    expectInvalidParamEmission(result)
  })

  it('should fail when function paramEmission is an array', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [makeValidSchemaFunction({ paramEmission: [] })],
      }),
    )

    expectInvalidParamEmission(result)
  })

  it('should fail when function paramEmission.unsetOptional is invalid', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          makeValidSchemaFunction({
            paramEmission: { unsetOptional: 'drop-all' },
          }),
        ],
      }),
    )

    expectInvalidParamEmission(result)
  })

  it('should fail when function paramEmission.unsetOptional is null', () => {
    const result = validateSchema(
      makeValidSchema({
        functions: [
          makeValidSchemaFunction({
            paramEmission: { unsetOptional: null },
          }),
        ],
      }),
    )

    expectInvalidParamEmission(result)
  })

  // ---- Full schema with all option types ----

  it('should pass with a complex schema with all option types', () => {
    const result = validateSchema(
      makeValidSchema({
        options: [
          { key: 'name', label: 'Name', type: 'string' },
          { key: 'count', label: 'Count', type: 'number', default: 5 },
          { key: 'enabled', label: 'Enabled', type: 'boolean', default: true },
          {
            key: 'theme',
            label: 'Theme',
            type: 'select',
            options: [{ value: 'dark', label: 'Dark' }],
          },
          {
            key: 'tags',
            label: 'Tags',
            type: 'array',
            items: { itemType: 'string' },
          },
          {
            key: 'config',
            label: 'Config',
            type: 'object',
            properties: [
              { key: 'nested_str', label: 'Nested', type: 'string' },
            ],
          },
          { key: 'bg', label: 'Background', type: 'color', default: '#ff0000' },
          {
            key: 'key',
            label: 'Key',
            type: 'keysequence',
            default: '<leader>f',
          },
          { key: 'code', label: 'Code', type: 'lua', default: 'return true' },
        ],
        functions: [
          {
            name: 'setup',
            params: [{ name: 'opts', type: 'table' }],
            luaCall: 'require("plugin").setup($params)',
            returns: 'void',
          },
        ],
        dependencies: ['nvim-treesitter'],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

// ============================================
// Config Validation Tests
// ============================================

describe('validateConfig', () => {
  it('should pass with empty config and no required options', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'name', label: 'Name', type: 'string' }],
    })
    const result = validateConfig({}, schema)
    expect(result.valid).toBe(true)
  })

  it('should fail when required value is missing', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'name', label: 'Name', type: 'string', required: true }],
    })
    const result = validateConfig({}, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'REQUIRED_VALUE_MISSING')).toBe(
      true,
    )
  })

  it('should pass with valid string value', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'name', label: 'Name', type: 'string', required: true }],
    })
    const result = validateConfig({ name: 'hello' }, schema)
    expect(result.valid).toBe(true)
  })

  it('should fail with type mismatch for string option', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'name', label: 'Name', type: 'string' }],
    })
    const result = validateConfig({ name: 42 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  // ---- String validation ----

  it('should fail when string is too short', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'name',
          label: 'Name',
          type: 'string',
          validation: { minLength: 3 },
        },
      ],
    })
    const result = validateConfig({ name: 'ab' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'STRING_TOO_SHORT')).toBe(true)
  })

  it('should fail when string is too long', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'name',
          label: 'Name',
          type: 'string',
          validation: { maxLength: 5 },
        },
      ],
    })
    const result = validateConfig({ name: 'too long string' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'STRING_TOO_LONG')).toBe(true)
  })

  it('should fail when string does not match pattern', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'name',
          label: 'Name',
          type: 'string',
          validation: { pattern: '^[a-z]+$' },
        },
      ],
    })
    const result = validateConfig({ name: 'Hello123' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'PATTERN_MISMATCH')).toBe(true)
  })

  it('should not throw when string pattern is invalid and should report error', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'name',
          label: 'Name',
          type: 'string',
          validation: { pattern: '[' },
        },
      ],
    })

    expect(() => validateConfig({ name: 'abc' }, schema)).not.toThrow()

    const result = validateConfig({ name: 'abc' }, schema)
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.code === 'INVALID_VALIDATION_RULE'),
    ).toBe(true)
  })

  // ---- Number validation ----

  it('should fail with type mismatch for number option', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'count', label: 'Count', type: 'number' }],
    })
    const result = validateConfig({ count: 'not-a-number' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should fail when number is below min', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          validation: { min: 0 },
        },
      ],
    })
    const result = validateConfig({ count: -1 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'VALUE_OUT_OF_RANGE')).toBe(
      true,
    )
  })

  it('should fail when number is above max', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          validation: { max: 100 },
        },
      ],
    })
    const result = validateConfig({ count: 101 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'VALUE_OUT_OF_RANGE')).toBe(
      true,
    )
  })

  it('should fail when number should be integer but is not', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          validation: { integer: true },
        },
      ],
    })
    const result = validateConfig({ count: 3.14 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should pass with valid number in range', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          validation: { min: 0, max: 100 },
        },
      ],
    })
    const result = validateConfig({ count: 50 }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Boolean validation ----

  it('should fail with type mismatch for boolean option', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'flag', label: 'Flag', type: 'boolean' }],
    })
    const result = validateConfig({ flag: 'yes' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should pass with valid boolean value', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'flag', label: 'Flag', type: 'boolean' }],
    })
    const result = validateConfig({ flag: true }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Select validation ----

  it('should fail with invalid select value', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          options: [
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ],
        },
      ],
    })
    const result = validateConfig({ theme: 'neon' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_OPTION_VALUE')).toBe(
      true,
    )
  })

  it('should pass with valid select value', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          options: [
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ],
        },
      ],
    })
    const result = validateConfig({ theme: 'dark' }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Multi-select validation ----

  it('should pass with valid multi-select string array', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
            { value: 'blue', label: 'Blue' },
          ],
        },
      ],
    })
    const result = validateConfig({ colors: ['red', 'blue'] }, schema)
    expect(result.valid).toBe(true)
  })

  it('should pass with empty array for multi-select', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
        },
      ],
    })
    const result = validateConfig({ colors: [] }, schema)
    expect(result.valid).toBe(true)
  })

  it('should fail with invalid option value in multi-select', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
        },
      ],
    })
    const result = validateConfig({ colors: ['red', 'purple'] }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_OPTION_VALUE')).toBe(
      true,
    )
  })

  it('should fail when multi-select value is not an array', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
        },
      ],
    })
    const result = validateConfig(
      { colors: 'red' as unknown as PluginConfigValue },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should fail when multi-select array contains non-string items', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'colors',
          label: 'Colors',
          type: 'select',
          multi: true,
          options: [
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
          ],
        },
      ],
    })
    const result = validateConfig(
      { colors: ['red', 42 as unknown as string] },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  // ---- Array validation ----

  it('should fail when array value is not an array', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
        },
      ],
    })
    const result = validateConfig({ tags: 'not-array' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should fail when array has too few items', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
          validation: { minItems: 2 },
        },
      ],
    })
    const result = validateConfig({ tags: ['one'] }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'ARRAY_TOO_FEW')).toBe(true)
  })

  it('should fail when array has too many items', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
          validation: { maxItems: 2 },
        },
      ],
    })
    const result = validateConfig({ tags: ['one', 'two', 'three'] }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'ARRAY_TOO_MANY')).toBe(true)
  })

  it('should fail when array has duplicate items with uniqueItems', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
          validation: { uniqueItems: true },
        },
      ],
    })
    const result = validateConfig({ tags: ['a', 'b', 'a'] }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'ARRAY_NOT_UNIQUE')).toBe(true)
  })

  it('should fail when array items have wrong type', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
        },
      ],
    })
    const result = validateConfig(
      { tags: ['valid', 42 as unknown as PluginConfigValue] },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should pass with valid array', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
          validation: { minItems: 1, maxItems: 5, uniqueItems: true },
        },
      ],
    })
    const result = validateConfig({ tags: ['one', 'two'] }, schema)
    expect(result.valid).toBe(true)
  })

  it('rejects mapping-table rows with unknown columns', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'presets',
          label: 'Presets',
          type: 'mapping-table',
          default: [],
          columns: [
            {
              key: 'filetype',
              label: 'Filetype',
              type: 'select',
              options: [{ value: 'lua', label: 'Lua' }],
            },
            {
              key: 'preset',
              label: 'Preset',
              type: 'select',
              options: [{ value: 'stylua', label: 'stylua' }],
            },
          ],
          emit: {
            targetKey: 'filetype',
            keyColumn: 'filetype',
            valueColumn: 'preset',
            valueTemplate:
              'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
          },
        },
      ],
    })

    const result = validateConfig(
      {
        presets: [
          {
            filetype: 'lua',
            preset: 'stylua',
            rogue: 'oops',
          } as unknown as PluginConfigValue,
        ],
      },
      schema,
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('unknown column "rogue"'),
      ),
    ).toBe(true)
  })

  it('rejects mapping-table rows with invalid select values', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'presets',
          label: 'Presets',
          type: 'mapping-table',
          default: [],
          columns: [
            {
              key: 'filetype',
              label: 'Filetype',
              type: 'select',
              options: [{ value: 'lua', label: 'Lua' }],
            },
            {
              key: 'preset',
              label: 'Preset',
              type: 'select',
              options: [{ value: 'stylua', label: 'stylua' }],
            },
          ],
          emit: {
            targetKey: 'filetype',
            keyColumn: 'filetype',
            valueColumn: 'preset',
            valueTemplate:
              'require("formatter.filetypes.{{outputKey}}").{{row.preset}}',
          },
        },
      ],
    })

    const result = validateConfig(
      {
        presets: [
          {
            filetype: "lua'); os.execute('boom') --",
            preset: 'stylua',
          } as unknown as PluginConfigValue,
        ],
      },
      schema,
    )

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) =>
        error.message.includes('column "filetype"'),
      ),
    ).toBe(true)
  })

  // ---- Object validation ----

  it('should fail when object value is not an object', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'config',
          label: 'Config',
          type: 'object',
          properties: [{ key: 'name', label: 'Name', type: 'string' }],
        },
      ],
    })
    const result = validateConfig({ config: 'not-object' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should fail when nested required property is missing', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'config',
          label: 'Config',
          type: 'object',
          properties: [
            {
              key: 'name',
              label: 'Name',
              type: 'string',
              required: true,
            },
          ],
        },
      ],
    })
    const result = validateConfig({ config: {} }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'REQUIRED_VALUE_MISSING')).toBe(
      true,
    )
  })

  it('should pass with valid nested object', () => {
    const schema = makeValidSchemaTyped({
      options: [
        {
          key: 'config',
          label: 'Config',
          type: 'object',
          properties: [
            {
              key: 'name',
              label: 'Name',
              type: 'string',
              required: true,
            },
          ],
        },
      ],
    })
    const result = validateConfig({ config: { name: 'hello' } }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Color validation ----

  it('should fail with invalid hex color', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'bg', label: 'Background', type: 'color' }],
    })
    const result = validateConfig({ bg: 'not-a-color' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_COLOR_FORMAT')).toBe(
      true,
    )
  })

  it('should pass with valid hex color', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'bg', label: 'Background', type: 'color' }],
    })
    const result = validateConfig({ bg: '#ff0000' }, schema)
    expect(result.valid).toBe(true)
  })

  it('should pass with valid rgb color when format is rgb', () => {
    const schema = makeValidSchemaTyped({
      options: [
        { key: 'bg', label: 'Background', type: 'color', format: 'rgb' },
      ],
    })
    const result = validateConfig({ bg: 'rgb(255, 0, 0)' }, schema)
    expect(result.valid).toBe(true)
  })

  it('should fail with hex color when format is rgb', () => {
    const schema = makeValidSchemaTyped({
      options: [
        { key: 'bg', label: 'Background', type: 'color', format: 'rgb' },
      ],
    })
    const result = validateConfig({ bg: '#ff0000' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_COLOR_FORMAT')).toBe(
      true,
    )
  })

  // ---- Key sequence validation ----

  it('should fail with empty key sequence', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'key', label: 'Key', type: 'keysequence' }],
    })
    const result = validateConfig({ key: '' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_KEY_SEQUENCE')).toBe(
      true,
    )
  })

  it('should pass with valid key sequence', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'key', label: 'Key', type: 'keysequence' }],
    })
    const result = validateConfig({ key: '<leader>f' }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Lua validation ----

  it('should fail with non-string lua value', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'code', label: 'Code', type: 'lua' }],
    })
    const result = validateConfig({ code: 42 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('should pass with valid lua string', () => {
    const schema = makeValidSchemaTyped({
      options: [{ key: 'code', label: 'Code', type: 'lua' }],
    })
    const result = validateConfig({ code: 'return true' }, schema)
    expect(result.valid).toBe(true)
  })

  // ---- Full config validation ----

  it('should validate a complex config with multiple option types', () => {
    const schema = makeValidSchemaTyped({
      options: [
        { key: 'name', label: 'Name', type: 'string', required: true },
        {
          key: 'count',
          label: 'Count',
          type: 'number',
          validation: { min: 0, max: 100 },
        },
        { key: 'enabled', label: 'Enabled', type: 'boolean' },
        {
          key: 'theme',
          label: 'Theme',
          type: 'select',
          options: [
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ],
        },
        {
          key: 'tags',
          label: 'Tags',
          type: 'array',
          items: { itemType: 'string' },
        },
        { key: 'bg', label: 'Background', type: 'color' },
      ],
    })

    const config: Record<string, PluginConfigValue> = {
      name: 'My Plugin',
      count: 50,
      enabled: true,
      theme: 'dark',
      tags: ['tag1', 'tag2'],
      bg: '#ff0000',
    }

    const result = validateConfig(config, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

// ============================================
// New Metadata Field Validation Tests
// ============================================

describe('validateSchema — new metadata fields', () => {
  // ---- author ----

  it('accepts a valid author string', () => {
    const result = validateSchema(makeValidSchema({ author: 'folke' }))
    expect(result.valid).toBe(true)
  })

  it('rejects an empty author string', () => {
    const result = validateSchema(makeValidSchema({ author: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"author"'))).toBe(true)
  })

  it('rejects a non-string author', () => {
    const result = validateSchema(makeValidSchema({ author: 42 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"author"'))).toBe(true)
  })

  it('accepts schema without author (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- stars ----

  it('accepts a valid stars number (0)', () => {
    const result = validateSchema(makeValidSchema({ stars: 0 }))
    expect(result.valid).toBe(true)
  })

  it('accepts a valid stars number (positive integer)', () => {
    const result = validateSchema(makeValidSchema({ stars: 16400 }))
    expect(result.valid).toBe(true)
  })

  it('rejects negative stars', () => {
    const result = validateSchema(makeValidSchema({ stars: -1 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"stars"'))).toBe(true)
  })

  it('rejects non-integer stars', () => {
    const result = validateSchema(makeValidSchema({ stars: 1.5 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"stars"'))).toBe(true)
  })

  it('rejects non-number stars', () => {
    const result = validateSchema(makeValidSchema({ stars: 'many' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"stars"'))).toBe(true)
  })

  it('accepts schema without stars (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- category ----

  it('accepts a valid category "syntax"', () => {
    const result = validateSchema(makeValidSchema({ category: 'syntax' }))
    expect(result.valid).toBe(true)
  })

  it('accepts a valid category "lsp"', () => {
    const result = validateSchema(makeValidSchema({ category: 'lsp' }))
    expect(result.valid).toBe(true)
  })

  it('accepts a valid category "navigation"', () => {
    const result = validateSchema(makeValidSchema({ category: 'navigation' }))
    expect(result.valid).toBe(true)
  })

  it('rejects an invalid category string', () => {
    const result = validateSchema(makeValidSchema({ category: 'invalid-cat' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"category"'))).toBe(
      true,
    )
  })

  it('rejects a non-string category', () => {
    const result = validateSchema(makeValidSchema({ category: 123 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"category"'))).toBe(
      true,
    )
  })

  it('accepts schema without category (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- tags ----

  it('accepts a valid tags array', () => {
    const result = validateSchema(
      makeValidSchema({ tags: ['fuzzy', 'finder', 'search'] }),
    )
    expect(result.valid).toBe(true)
  })

  it('accepts an empty tags array', () => {
    const result = validateSchema(makeValidSchema({ tags: [] }))
    expect(result.valid).toBe(true)
  })

  it('rejects tags with empty strings', () => {
    const result = validateSchema(makeValidSchema({ tags: ['valid', ''] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"tags[1]"'))).toBe(
      true,
    )
  })

  it('rejects tags that is not an array', () => {
    const result = validateSchema(makeValidSchema({ tags: 'not-array' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"tags"'))).toBe(true)
  })

  it('rejects tags containing non-string items', () => {
    const result = validateSchema(makeValidSchema({ tags: [42, 'valid'] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"tags[0]"'))).toBe(
      true,
    )
  })

  it('accepts schema without tags (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- tagline ----

  it('accepts a valid tagline string', () => {
    const result = validateSchema(
      makeValidSchema({ tagline: 'A short tagline' }),
    )
    expect(result.valid).toBe(true)
  })

  it('rejects an empty tagline string', () => {
    const result = validateSchema(makeValidSchema({ tagline: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"tagline"'))).toBe(
      true,
    )
  })

  it('rejects a tagline over 120 characters', () => {
    const longTagline = 'a'.repeat(121)
    const result = validateSchema(makeValidSchema({ tagline: longTagline }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"tagline"'))).toBe(
      true,
    )
  })

  it('accepts a tagline of exactly 120 characters', () => {
    const exactTagline = 'a'.repeat(120)
    const result = validateSchema(makeValidSchema({ tagline: exactTagline }))
    expect(result.valid).toBe(true)
  })

  it('accepts schema without tagline (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- iconUrl ----

  it('accepts a valid https iconUrl', () => {
    const result = validateSchema(
      makeValidSchema({ iconUrl: 'https://example.com/icon.png' }),
    )
    expect(result.valid).toBe(true)
  })

  it('accepts a valid http iconUrl', () => {
    const result = validateSchema(
      makeValidSchema({ iconUrl: 'http://example.com/icon.png' }),
    )
    expect(result.valid).toBe(true)
  })

  it('rejects an empty iconUrl string', () => {
    const result = validateSchema(makeValidSchema({ iconUrl: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"iconUrl"'))).toBe(
      true,
    )
  })

  it('rejects an invalid iconUrl (no protocol)', () => {
    const result = validateSchema(makeValidSchema({ iconUrl: 'not-a-url' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('"iconUrl"'))).toBe(
      true,
    )
  })

  it('accepts schema without iconUrl (optional field)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // ---- Combined: all metadata fields valid ----

  it('accepts schema with all metadata fields valid', () => {
    const result = validateSchema(
      makeValidSchema({
        author: 'nvim-telescope',
        stars: 16400,
        category: 'navigation',
        tags: ['fuzzy', 'finder'],
        tagline: 'Highly extensible fuzzy finder over lists',
        iconUrl: 'https://example.com/telescope.png',
      }),
    )
    expect(result.valid).toBe(true)
  })
})

// ============================================
// Setup Field Validation Tests
// ============================================

describe('setup field validation', () => {
  // 1. Valid: schema without setup field — should pass (setup is optional)
  it('passes when setup field is absent (optional)', () => {
    const result = validateSchema(makeValidSchema())
    expect(result.valid).toBe(true)
  })

  // 2. Valid: schema with minimal setup — { requirePath: 'telescope' } should pass
  it('passes with minimal setup containing only requirePath', () => {
    const result = validateSchema(
      makeValidSchema({ setup: { requirePath: 'telescope' } }),
    )
    expect(result.valid).toBe(true)
  })

  // 3. Valid: schema with all setup fields — all fields populated should pass
  it('passes with all setup fields populated', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: {
          requirePath: 'nvim-treesitter',
          setupFunction: 'setup',
          optionMapping: 'table',
          preSetup: "vim.g.mapleader = ' '",
          postSetup: "require('telescope').load_extension('fzf')",
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  // 4. Invalid: setup is not an object — setup: "telescope" should fail with INVALID_FIELD_TYPE
  it('fails when setup is a string instead of an object', () => {
    const result = validateSchema(makeValidSchema({ setup: 'telescope' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) => e.message.includes('setup must be an object')),
    ).toBe(true)
  })

  // 5. Invalid: setup.requirePath missing — setup: {} should fail with MISSING_REQUIRED_FIELD
  it('fails when setup is an empty object (requirePath missing)', () => {
    const result = validateSchema(makeValidSchema({ setup: {} }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.requirePath is required'),
      ),
    ).toBe(true)
  })

  // 6. Invalid: setup.requirePath empty string — should fail with MISSING_REQUIRED_FIELD
  it('fails when setup.requirePath is an empty string', () => {
    const result = validateSchema(
      makeValidSchema({ setup: { requirePath: '' } }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.requirePath is required'),
      ),
    ).toBe(true)
  })

  // 7. Invalid: setup.setupFunction empty string — should fail with INVALID_FIELD_TYPE
  it('fails when setup.setupFunction is an empty string', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: { requirePath: 'telescope', setupFunction: '' },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.setupFunction must be a non-empty string'),
      ),
    ).toBe(true)
  })

  // 8. Invalid: setup.optionMapping invalid value — optionMapping: 'invalid' should fail
  it('fails when setup.optionMapping is an invalid value', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: { requirePath: 'telescope', optionMapping: 'invalid' },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes(
          "setup.optionMapping must be 'table' or 'individual'",
        ),
      ),
    ).toBe(true)
  })

  // 9. Invalid: setup.preSetup not a string — preSetup: 123 should fail
  it('fails when setup.preSetup is not a string', () => {
    const result = validateSchema(
      makeValidSchema({ setup: { requirePath: 'telescope', preSetup: 123 } }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.preSetup must be a string'),
      ),
    ).toBe(true)
  })

  // 10. Invalid: setup.postSetup not a string — postSetup: true should fail
  it('fails when setup.postSetup is not a string', () => {
    const result = validateSchema(
      makeValidSchema({ setup: { requirePath: 'telescope', postSetup: true } }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.postSetup must be a string'),
      ),
    ).toBe(true)
  })

  it('passes with setup.render lua-template containing {{config}}', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: {
          requirePath: 'arbitrary-plugin',
          render: {
            kind: 'lua-template',
            template: 'local config = {{config}}\nrequire({{requirePath}})',
          },
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('fails when setup.render template omits {{config}}', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: {
          requirePath: 'arbitrary-plugin',
          render: {
            kind: 'lua-template',
            template: 'require({{requirePath}})',
          },
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.render.template must contain at least one'),
      ),
    ).toBe(true)
  })

  it('fails when setup.render is combined with setupFunction', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: {
          requirePath: 'arbitrary-plugin',
          setupFunction: 'setup',
          render: {
            kind: 'lua-template',
            template: 'local config = {{config}}',
          },
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) =>
        e.message.includes('setup.setupFunction cannot be used together'),
      ),
    ).toBe(true)
  })

  // Bonus: setup is an array — should fail (arrays are objects in JS, need explicit check)
  it('fails when setup is an array', () => {
    const result = validateSchema(makeValidSchema({ setup: ['telescope'] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_FIELD_TYPE')).toBe(
      true,
    )
    expect(
      result.errors.some((e) => e.message.includes('setup must be an object')),
    ).toBe(true)
  })

  // Bonus: valid optionMapping values
  it('passes with optionMapping set to "table"', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: { requirePath: 'mason', optionMapping: 'table' },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('passes with optionMapping set to "individual"', () => {
    const result = validateSchema(
      makeValidSchema({
        setup: { requirePath: 'mason', optionMapping: 'individual' },
      }),
    )
    expect(result.valid).toBe(true)
  })

  // Round-trip: load built-in schemas and verify they have valid setup fields
  it('built-in schemas with setup field pass validation', () => {
    const schemasWithSetup = (
      builtinSchemas as unknown as Array<Record<string, unknown>>
    ).filter((s) => s['setup'] !== undefined)

    expect(schemasWithSetup.length).toBeGreaterThan(0)

    for (const schema of schemasWithSetup) {
      const result = validateSchema(schema)
      if (!result.valid) {
        const errorMessages = result.errors
          .map((e) => `  - ${e.message}`)
          .join('\n')
        throw new Error(
          `Schema "${String(schema['id'])}" failed validation:\n${errorMessages}`,
        )
      }
      expect(result.valid).toBe(true)
    }
  })
})

// ============================================
// plugin-keymap Schema Option Validation
// ============================================

/** Minimal valid plugin-keymap option for use in schema options array */
function makePluginKeymapOption(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    key: 'keymap',
    label: 'Keymaps',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    commands: [
      { name: 'accept', label: 'Accept' },
      { name: 'cancel', label: 'Cancel' },
      { name: 'fallback', label: 'Fallback', isTerminal: true },
    ],
    presets: [
      {
        id: 'default',
        label: 'Default',
        mappings: { '<CR>': ['accept', 'fallback'] },
      },
      {
        id: 'none',
        label: 'None',
        mappings: {},
      },
    ],
    ...overrides,
  }
}

/** Minimal valid schema containing a plugin-keymap option */
function makeSchemaWithKeymapOption(
  optionOverrides?: Record<string, unknown>,
): Record<string, unknown> {
  return makeValidSchema({
    options: [makePluginKeymapOption(optionOverrides)],
  })
}

describe('validateSchema — plugin-keymap option', () => {
  it('accepts a valid plugin-keymap option', () => {
    const result = validateSchema(makeSchemaWithKeymapOption())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing commands array', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({ commands: undefined }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("'commands'"))).toBe(
      true,
    )
  })

  it('rejects empty commands array', () => {
    const result = validateSchema(makeSchemaWithKeymapOption({ commands: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("'commands'"))).toBe(
      true,
    )
  })

  it('rejects missing presets array', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({ presets: undefined }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("'presets'"))).toBe(
      true,
    )
  })

  it('rejects empty presets array', () => {
    const result = validateSchema(makeSchemaWithKeymapOption({ presets: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("'presets'"))).toBe(
      true,
    )
  })

  it('rejects missing defaultPreset', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({ defaultPreset: undefined }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes("'defaultPreset'")),
    ).toBe(true)
  })

  it('rejects empty string defaultPreset', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({ defaultPreset: '' }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes("'defaultPreset'")),
    ).toBe(true)
  })

  it('rejects defaultPreset that does not match any preset id', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({ defaultPreset: 'nonexistent' }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.code === 'INVALID_FIELD_VALUE' && e.message.includes('nonexistent'),
      ),
    ).toBe(true)
  })

  it('rejects duplicate command names', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        commands: [
          { name: 'accept', label: 'Accept' },
          { name: 'accept', label: 'Accept Again' },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.code === 'INVALID_FIELD_VALUE' &&
          e.message.includes('duplicate command'),
      ),
    ).toBe(true)
  })

  it('rejects duplicate preset ids', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        presets: [
          { id: 'default', label: 'Default', mappings: {} },
          { id: 'default', label: 'Default Again', mappings: {} },
        ],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.code === 'INVALID_FIELD_VALUE' &&
          e.message.includes('duplicate preset'),
      ),
    ).toBe(true)
  })

  it('rejects invalid commands (missing name)', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        commands: [{ label: 'Accept' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes("non-empty 'name'")),
    ).toBe(true)
  })

  it('rejects invalid commands (missing label)', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        commands: [{ name: 'accept' }],
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes("non-empty 'label'")),
    ).toBe(true)
  })

  it('rejects preset mappings that reference unknown commands', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        commands: [{ name: 'accept', label: 'Accept' }],
        presets: [
          {
            id: 'default',
            label: 'Default',
            mappings: { '<CR>': ['accept', 'nonexistent_command'] },
          },
        ],
        defaultPreset: 'default',
      }),
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.code === 'INVALID_FIELD_VALUE' &&
          e.message.includes('nonexistent_command'),
      ),
    ).toBe(true)
  })

  it('requires mappings object on each preset', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        presets: [{ id: 'default', label: 'Default' }],
        defaultPreset: 'default',
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("'mappings'"))).toBe(
      true,
    )
  })

  it('accepts an empty mappings object (the "none" preset pattern)', () => {
    const result = validateSchema(
      makeSchemaWithKeymapOption({
        commands: [{ name: 'accept', label: 'Accept' }],
        presets: [{ id: 'none', label: 'None', mappings: {} }],
        defaultPreset: 'none',
      }),
    )
    expect(result.valid).toBe(true)
  })
})

// ============================================
// plugin-keymap Config Value Validation
// ============================================

/** Minimal typed plugin-keymap schema for validateConfig tests */
function makePluginKeymapSchema(
  optionOverrides?: Record<string, unknown>,
): PluginSchema {
  return makeValidSchemaTyped({
    options: [
      {
        key: 'keymap',
        label: 'Keymaps',
        type: 'plugin-keymap',
        defaultPreset: 'default',
        allowDisable: true,
        commands: [
          { name: 'accept', label: 'Accept' },
          { name: 'cancel', label: 'Cancel' },
          { name: 'fallback', label: 'Fallback', isTerminal: true },
        ],
        presets: [
          {
            id: 'default',
            label: 'Default',
            mappings: { '<CR>': ['accept', 'fallback'] },
          },
          { id: 'none', label: 'None', mappings: {} },
        ],
        ...optionOverrides,
      } as unknown as PluginSchema['options'][number],
    ],
  })
}

describe('validateConfig — plugin-keymap option', () => {
  it('accepts valid config with preset only', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig({ keymap: { preset: 'default' } }, schema)
    expect(result.valid).toBe(true)
  })

  it('accepts absent preset (defaults to schema defaultPreset)', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig({ keymap: {} }, schema)
    expect(result.valid).toBe(true)
  })

  it('accepts config with valid overrides', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          overrides: { '<CR>': ['accept', 'fallback'] },
        },
      },
      schema,
    )
    expect(result.valid).toBe(true)
  })

  it('accepts false for disabled keys when allowDisable is true', () => {
    const schema = makePluginKeymapSchema({ allowDisable: true })
    const result = validateConfig(
      { keymap: { preset: 'default', overrides: { '<C-e>': false } } },
      schema,
    )
    expect(result.valid).toBe(true)
  })

  it('rejects false for disabled keys when allowDisable is false', () => {
    const schema = makePluginKeymapSchema({ allowDisable: false })
    const result = validateConfig(
      { keymap: { preset: 'default', overrides: { '<C-e>': false } } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('allowDisable'))).toBe(
      true,
    )
  })

  it('rejects false for disabled keys when allowDisable is absent', () => {
    const schema = makePluginKeymapSchema({ allowDisable: undefined })
    const result = validateConfig(
      { keymap: { preset: 'default', overrides: { '<C-e>': false } } },
      schema,
    )
    expect(result.valid).toBe(false)
  })

  it('accepts { lua: "..." } entries in overrides', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          overrides: { '<Tab>': [{ lua: 'vim.snippet.jump(1)' }] },
        },
      },
      schema,
    )
    expect(result.valid).toBe(true)
  })

  it('rejects empty Lua strings in overrides', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      { keymap: { preset: 'default', overrides: { '<Tab>': [{ lua: '' }] } } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('empty Lua'))).toBe(
      true,
    )
  })

  it('rejects empty command arrays in overrides', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      { keymap: { preset: 'default', overrides: { '<Tab>': [] } } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.message.includes('empty command list')),
    ).toBe(true)
  })

  it('rejects unknown command names in overrides', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          overrides: { '<Tab>': ['ghost_command'] },
        },
      },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('ghost_command'))).toBe(
      true,
    )
  })

  it('rejects unknown preset ids', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig({ keymap: { preset: 'super-tab' } }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('super-tab'))).toBe(
      true,
    )
  })

  it('rejects unknown top-level keys in config value', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      { keymap: { preset: 'default', unknown_field: 'bad' } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('unknown_field'))).toBe(
      true,
    )
  })

  // ---- _meta namespace (Caveat 2) ----

  it('accepts valid _meta.rebindLinks shape', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          overrides: { '<CR>': false, '<c-j>': ['accept', 'fallback'] },
          _meta: { rebindLinks: { '<c-j>': '<cr>' } },
        },
      },
      schema,
    )
    expect(result.valid).toBe(true)
  })

  it('accepts absent _meta (optional)', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig({ keymap: { preset: 'default' } }, schema)
    expect(result.valid).toBe(true)
  })

  it('rejects _meta that is not an object', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      { keymap: { preset: 'default', _meta: 'bad' } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('_meta'))).toBe(true)
  })

  it('rejects _meta.rebindLinks that is not an object', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      { keymap: { preset: 'default', _meta: { rebindLinks: 'bad' } } },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('rebindLinks'))).toBe(
      true,
    )
  })

  it('rejects _meta.rebindLinks with non-string values', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          _meta: { rebindLinks: { '<c-j>': 42 } },
        },
      },
      schema,
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes('rebindLinks'))).toBe(
      true,
    )
  })

  it('accepts legacy top-level rebindLinks without error (backward compat key)', () => {
    const schema = makePluginKeymapSchema()
    const result = validateConfig(
      {
        keymap: {
          preset: 'default',
          overrides: { '<CR>': false, '<c-j>': ['accept', 'fallback'] },
          rebindLinks: { '<c-j>': '<cr>' },
        },
      },
      schema,
    )
    expect(result.valid).toBe(true)
  })
})
