import {
  getUserConfigValueAtPath,
  isMeaningfulUserOptionValue,
} from '@/features/lua-generator/utils/value-intent'
import {
  canonicalDeepEqual,
  getOptionDefaultValue,
} from '@/features/plugins/utils/option-default'
import {
  extractMappingTableTemplatePlaceholders,
  validateMappingTableRowForEmit,
} from '@/shared/lib/schema-mapping-table'
import { buildTypedSchemaOptionPathIndex } from '@/shared/lib/schema-option-paths'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaConflictRule,
  SchemaMappingTableOption,
  SchemaOption,
} from '@/shared/types'
import type { LegacyGenerationDiagnostic } from '../types'
import { type LuaRawCode, rawLua } from '../utils/lua-serialize'

export type MergedValue =
  | PluginConfigValue
  | LuaRawCode
  | { [key: string]: MergedValue }
  | MergedValue[]

export type MergedMap = Record<string, MergedValue>

export interface ApplySchemaGenerationRulesParams {
  readonly merged: MergedMap
  readonly schema: PluginSchema
  readonly userConfig: Readonly<Record<string, PluginConfigValue>>
  readonly pluginName: string
  readonly diagnostics: LegacyGenerationDiagnostic[]
}

function buildOptionIndex(
  schema: PluginSchema,
): ReadonlyMap<string, SchemaOption> {
  return new Map(
    buildTypedSchemaOptionPathIndex(schema.options).entries.map((entry) => [
      entry.schemaPath,
      entry.option,
    ]),
  )
}

function matchesPath(path: string, scope: string): boolean {
  return path === scope || path.startsWith(`${scope}.`)
}

function replaceAllLiteral(
  value: string,
  search: string,
  replacement: string,
): string {
  return value.split(search).join(replacement)
}

function warn(
  diagnostics: LegacyGenerationDiagnostic[],
  pluginName: string,
  context: string,
  message: string,
): void {
  diagnostics.push({
    severity: 'warning',
    context,
    message: `Plugin '${pluginName}': ${message}`,
  })
}

function applyConflictRule(
  rule: SchemaConflictRule,
  optionIndex: ReadonlyMap<string, SchemaOption>,
  userConfig: Readonly<Record<string, PluginConfigValue>>,
  pluginName: string,
  diagnostics: LegacyGenerationDiagnostic[],
): void {
  const leftOption = optionIndex.get(rule.left)
  const rightOption = optionIndex.get(rule.right)
  const leftValue = getUserConfigValueAtPath(userConfig, rule.left)
  const rightValue = getUserConfigValueAtPath(userConfig, rule.right)

  const bothExplicit = leftValue !== undefined && rightValue !== undefined
  const bothMeaningful =
    isMeaningfulUserOptionValue(leftValue, leftOption) &&
    isMeaningfulUserOptionValue(rightValue, rightOption)
  const shouldReport =
    rule.when === 'both-meaningful' ? bothMeaningful : bothExplicit

  if (!shouldReport) {
    return
  }

  diagnostics.push({
    severity: rule.severity,
    context: `${rule.left} <> ${rule.right}`,
    message: `Plugin '${pluginName}': ${rule.message}`,
  })
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mapping-table rule application interleaves column autofill, value maps, and diagnostics with schema-order sensitivity
function applyMappingTableOption(
  option: SchemaMappingTableOption,
  merged: MergedMap,
  pluginName: string,
  diagnostics: LegacyGenerationDiagnostic[],
): void {
  const rawRows = merged[option.key]
  if (!Array.isArray(rawRows)) {
    delete merged[option.key]
    return
  }

  const table: Record<string, MergedValue[]> = {}
  const keyColumn = option.emit.keyColumn
  const columnByKey = new Map(
    option.columns.map((column) => [column.key, column]),
  )
  const placeholders = extractMappingTableTemplatePlaceholders(
    option.emit.valueTemplate,
  )

  for (const group of option.conflictGroups ?? []) {
    const hitsByKey = new Map<string, string[]>()
    for (const row of rawRows) {
      const validatedRow = validateMappingTableRowForEmit(
        option,
        row as PluginConfigValue,
      )
      if (!validatedRow.success) {
        continue
      }
      const rowKeyValue = validatedRow.value.valuesByColumn.get(keyColumn)
      const rowValueValue = validatedRow.value.valuesByColumn.get(group.column)
      if (
        typeof rowKeyValue !== 'string' ||
        typeof rowValueValue !== 'string'
      ) {
        continue
      }
      if (!group.values.includes(rowValueValue)) {
        continue
      }
      const current = hitsByKey.get(rowKeyValue) ?? []
      current.push(rowValueValue)
      hitsByKey.set(rowKeyValue, current)
    }

    for (const [rowKey, hits] of hitsByKey) {
      if (hits.length > 1) {
        warn(
          diagnostics,
          pluginName,
          option.key,
          replaceAllLiteral(group.message, '{{key}}', rowKey),
        )
      }
    }
  }

  for (const row of rawRows) {
    const validatedRow = validateMappingTableRowForEmit(
      option,
      row as PluginConfigValue,
    )
    if (!validatedRow.success) {
      warn(
        diagnostics,
        pluginName,
        option.key,
        `dropped mapping-table row: ${validatedRow.error}`,
      )
      continue
    }

    const rendered = placeholders.reduce((template, placeholder) => {
      if (placeholder.kind === 'output-key') {
        return replaceAllLiteral(
          template,
          '{{outputKey}}',
          validatedRow.value.outputKey,
        )
      }

      const columnValue = validatedRow.value.valuesByColumn.get(
        placeholder.columnKey,
      )
      if (columnValue === undefined) {
        return template
      }

      return replaceAllLiteral(
        template,
        `{{row.${placeholder.columnKey}}}`,
        columnValue,
      )
    }, option.emit.valueTemplate)

    const entries = table[validatedRow.value.outputKey] ?? []
    entries.push(rawLua(rendered))
    table[validatedRow.value.outputKey] = entries

    for (const [columnKey, columnValue] of validatedRow.value.valuesByColumn) {
      if (columnKey === keyColumn || columnKey === option.emit.valueColumn) {
        continue
      }
      const column = columnByKey.get(columnKey)
      if (column?.type === 'select' || column?.type === 'string') {
        void columnValue
      }
    }
  }

  delete merged[option.key]
  if (Object.keys(table).length > 0) {
    merged[option.emit.targetKey] = table as MergedValue
  }
}

function shouldKeepByIncludeRule(
  option: SchemaOption,
  value: MergedValue | undefined,
): boolean {
  const includeRule =
    option.emit !== undefined && 'include' in option.emit
      ? option.emit.include
      : undefined
  const normalizedKind = includeRule?.kind ?? option.defaultEmission
  if (normalizedKind === 'explicit-only') {
    return value !== undefined
  }
  if (normalizedKind === 'non-default') {
    return !canonicalDeepEqual(
      value as PluginConfigValue | undefined,
      getOptionDefaultValue(option),
    )
  }
  if (normalizedKind === 'non-empty') {
    if (value === undefined) {
      return false
    }
    if (typeof value === 'string') {
      return value.trim().length > 0
    }
  }
  return true
}

function isRelativePathValue(value: string): boolean {
  return (
    !value.startsWith('/') && !value.startsWith('~/') && !value.startsWith('$')
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: dispatches generation rules across option kinds while preserving merge precedence and diagnostic ordering
export function applySchemaGenerationRules(
  params: ApplySchemaGenerationRulesParams,
): void {
  const { merged, schema, userConfig, pluginName, diagnostics } = params
  const optionIndex = buildOptionIndex(schema)

  for (const rule of schema.generationRules ?? []) {
    if (rule.kind === 'conflict') {
      applyConflictRule(rule, optionIndex, userConfig, pluginName, diagnostics)
      continue
    }

    if (rule.kind === 'subtree-gate') {
      const controllerValue =
        merged[rule.when.key] ??
        getUserConfigValueAtPath(userConfig, rule.when.key)
      if (controllerValue !== rule.when.equals) {
        continue
      }

      const explicitDescendants = Object.keys(merged).filter(
        (path) =>
          matchesPath(path, rule.scope) &&
          path !== rule.when.key &&
          getUserConfigValueAtPath(userConfig, path) !== undefined,
      )

      if (
        rule.warnOnExplicitDescendants === true &&
        explicitDescendants.length > 0
      ) {
        warn(
          diagnostics,
          pluginName,
          rule.scope,
          rule.message ??
            `omitted disabled subtree "${rule.scope}" because its controller is disabled`,
        )
      }

      for (const path of Object.keys(merged)) {
        if (matchesPath(path, rule.scope)) {
          delete merged[path]
        }
      }
      continue
    }

    const preserveKeys = new Set(rule.preserveKeys ?? [])
    for (const path of Object.keys(merged)) {
      if (!matchesPath(path, rule.scope) || preserveKeys.has(path)) {
        continue
      }
      const entry = optionIndex.get(path)
      const userValue = getUserConfigValueAtPath(userConfig, path)
      if (!isMeaningfulUserOptionValue(userValue, entry)) {
        delete merged[path]
      }
    }
  }

  for (const [path, value] of Object.entries({ ...merged })) {
    const option = optionIndex.get(path)
    if (option === undefined) {
      continue
    }

    if (option.type === 'mapping-table') {
      applyMappingTableOption(option, merged, pluginName, diagnostics)
      continue
    }

    if (!shouldKeepByIncludeRule(option, value)) {
      delete merged[path]
      continue
    }

    if (
      option.emit !== undefined &&
      'stringRule' in option.emit &&
      option.emit.stringRule?.kind === 'path' &&
      typeof value === 'string'
    ) {
      const trimmedValue =
        option.emit.stringRule.trim === true ? value.trim() : value
      if (
        option.emit.stringRule.omitWhenEmpty === true &&
        trimmedValue.length === 0
      ) {
        delete merged[path]
        continue
      }
      if (
        option.emit.stringRule.warnWhenRelative === true &&
        isRelativePathValue(trimmedValue)
      ) {
        warn(
          diagnostics,
          pluginName,
          path,
          'relative path may resolve unexpectedly at runtime',
        )
      }
      if (
        option.emit.stringRule.expandWithVimFnExpand === true &&
        (trimmedValue.startsWith('~/') || trimmedValue.startsWith('$'))
      ) {
        merged[path] = rawLua(`vim.fn.expand(${JSON.stringify(trimmedValue)})`)
        continue
      }
      merged[path] = trimmedValue
    }

    if (
      option.emit !== undefined &&
      'valueRule' in option.emit &&
      option.emit.valueRule?.kind === 'value-map' &&
      typeof value === 'string'
    ) {
      const mapped = option.emit.valueRule.values[value]
      if (mapped === undefined) {
        const policy = option.emit.valueRule.onUnknown ?? 'warn-and-omit'
        if (policy === 'emit-original') {
          continue
        }
        if (policy === 'warn-and-omit') {
          warn(
            diagnostics,
            pluginName,
            path,
            `omitted unknown mapped value "${value}"`,
          )
        }
        delete merged[path]
        continue
      }

      merged[path] =
        mapped.kind === 'lua'
          ? rawLua(mapped.lua)
          : (mapped.value as unknown as MergedValue)
    }
  }
}
