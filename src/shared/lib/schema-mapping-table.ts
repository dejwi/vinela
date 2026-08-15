import type {
  PluginConfigValue,
  SchemaMappingTableColumn,
  SchemaMappingTableOption,
} from '@/shared/types'

const TEMPLATE_PLACEHOLDER_PATTERN = /{{\s*([^}]+?)\s*}}/g
const SAFE_RAW_LUA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export type MappingTablePlaceholder =
  | { readonly kind: 'output-key' }
  | { readonly kind: 'row-column'; readonly columnKey: string }

export interface ValidMappingTableRow {
  readonly outputKey: string
  readonly valuesByColumn: ReadonlyMap<string, string>
}

type MappingTableValidationResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: string }

function parsePlaceholderToken(
  token: string,
): MappingTableValidationResult<MappingTablePlaceholder> {
  if (token === 'outputKey') {
    return { success: true, value: { kind: 'output-key' } }
  }

  if (token.startsWith('row.')) {
    const columnKey = token.slice(4)
    if (columnKey.length === 0) {
      return {
        success: false,
        error: 'row placeholder must reference a column key',
      }
    }
    return {
      success: true,
      value: { kind: 'row-column', columnKey },
    }
  }

  return {
    success: false,
    error: `unsupported placeholder "${token}"`,
  }
}

export function extractMappingTableTemplatePlaceholders(
  template: string,
): readonly MappingTablePlaceholder[] {
  const placeholders: MappingTablePlaceholder[] = []

  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    const rawToken = match[1]
    if (rawToken === undefined) {
      continue
    }

    const parsed = parsePlaceholderToken(rawToken.trim())
    if (parsed.success) {
      placeholders.push(parsed.value)
    }
  }

  return placeholders
}

export function validateMappingTableTemplatePlaceholders(
  template: string,
): readonly string[] {
  const errors: string[] = []

  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    const rawToken = match[1]
    if (rawToken === undefined) {
      continue
    }

    const parsed = parsePlaceholderToken(rawToken.trim())
    if (!parsed.success) {
      errors.push(parsed.error)
    }
  }

  return errors
}

function getColumnMap(
  option: SchemaMappingTableOption,
): ReadonlyMap<string, SchemaMappingTableColumn> {
  return new Map(option.columns.map((column) => [column.key, column]))
}

function getRequiredColumnKeys(
  option: SchemaMappingTableOption,
): ReadonlySet<string> {
  const requiredKeys = new Set<string>([
    option.emit.keyColumn,
    option.emit.valueColumn,
  ])

  for (const placeholder of extractMappingTableTemplatePlaceholders(
    option.emit.valueTemplate,
  )) {
    if (placeholder.kind === 'row-column') {
      requiredKeys.add(placeholder.columnKey)
    }
  }

  for (const conflictGroup of option.conflictGroups ?? []) {
    requiredKeys.add(conflictGroup.column)
  }

  return requiredKeys
}

function isConfigObjectRow(
  value: PluginConfigValue,
): value is { readonly [key: string]: PluginConfigValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveMappingTableColumnValue(
  column: SchemaMappingTableColumn,
  value: PluginConfigValue,
): MappingTableValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      success: false,
      error: `column "${column.key}" must be a string`,
    }
  }

  if (column.type === 'select') {
    const allowedValues = new Set(column.options.map((option) => option.value))
    if (!allowedValues.has(value)) {
      return {
        success: false,
        error: `column "${column.key}" must be one of the schema-authored select values`,
      }
    }
  }

  return {
    success: true,
    value,
  }
}

export function validateMappingTableRowForEmit(
  option: SchemaMappingTableOption,
  row: PluginConfigValue,
): MappingTableValidationResult<ValidMappingTableRow> {
  if (!isConfigObjectRow(row)) {
    return {
      success: false,
      error: 'row must be an object',
    }
  }

  const columnMap = getColumnMap(option)
  const requiredColumnKeys = getRequiredColumnKeys(option)
  const valuesByColumn = new Map<string, string>()

  for (const rowKey of Object.keys(row)) {
    if (!columnMap.has(rowKey)) {
      return {
        success: false,
        error: `unknown column "${rowKey}"`,
      }
    }
  }

  for (const column of option.columns) {
    const rawValue = row[column.key]
    if (rawValue === undefined) {
      if (requiredColumnKeys.has(column.key)) {
        return {
          success: false,
          error: `missing required column "${column.key}"`,
        }
      }
      continue
    }

    const resolvedValue = resolveMappingTableColumnValue(column, rawValue)
    if (!resolvedValue.success) {
      return resolvedValue
    }

    valuesByColumn.set(column.key, resolvedValue.value)
  }

  for (const placeholder of extractMappingTableTemplatePlaceholders(
    option.emit.valueTemplate,
  )) {
    if (placeholder.kind !== 'row-column') {
      continue
    }

    const column = columnMap.get(placeholder.columnKey)
    if (column === undefined) {
      return {
        success: false,
        error: `template references undeclared column "${placeholder.columnKey}"`,
      }
    }

    if (column.type !== 'select') {
      return {
        success: false,
        error: `template placeholder "row.${placeholder.columnKey}" must reference a select column`,
      }
    }
  }

  const keyValue = valuesByColumn.get(option.emit.keyColumn)
  if (keyValue === undefined) {
    return {
      success: false,
      error: `missing required column "${option.emit.keyColumn}"`,
    }
  }

  const outputKey = option.emit.outputKeyMap?.[keyValue] ?? keyValue
  const templateUsesOutputKey = extractMappingTableTemplatePlaceholders(
    option.emit.valueTemplate,
  ).some((placeholder) => placeholder.kind === 'output-key')
  if (
    templateUsesOutputKey &&
    !SAFE_RAW_LUA_IDENTIFIER_PATTERN.test(outputKey)
  ) {
    return {
      success: false,
      error: `output key "${outputKey}" is not safe for raw Lua interpolation`,
    }
  }

  return {
    success: true,
    value: {
      outputKey,
      valuesByColumn,
    },
  }
}

export function isSafeRawLuaIdentifier(value: string): boolean {
  return SAFE_RAW_LUA_IDENTIFIER_PATTERN.test(value)
}
