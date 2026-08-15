/**
 * Plugin Section Generator
 *
 * Generates vim.pack.add() for plugin declarations and require().setup()
 * for plugin configurations.
 */

import {
  getInstallVersionLabel,
  installVersionSpecsEqual,
} from '@/features/plugins/utils/install-version'
import { decideLuaInclusion } from '@/features/plugins/utils/lua-field-include'
import { getEmittedOptionDefaultValue } from '@/features/plugins/utils/option-default'
import { resolvePluginKeymapDefaults } from '@/features/plugins/utils/plugin-keymap-defaults'
import { evaluateSchemaOptionNotices } from '@/features/plugins/utils/schema-option-notices'
import { renderSetupTemplate } from '@/shared/lib/setup-template'
import type {
  PluginConfigValue,
  PluginInstallOverride,
  PluginSchema,
  SchemaOption,
  SchemaSelectOption,
  VimPackInstallSpec,
} from '@/shared/types'
import type {
  LegacyGenerationDiagnostic,
  PluginSectionInput,
  ResolvedPluginForGeneration,
  SectionResult,
} from '../types'
import {
  flattenPluginKeymapValue,
  unflattenDotKeys,
} from '../utils/config-merge'
import { effectiveKey } from '../utils/effective-key'
import { jsonDeepClone } from '../utils/json-clone'
import {
  isRawLua,
  rawLua,
  serializeValue,
  validateLuaFieldNotPlainString,
} from '../utils/lua-serialize'
import { escapeLuaString } from '../utils/lua-string'
import {
  assertSchemaShape,
  LuaGenerationError,
} from '../utils/schema-shape-invariants'
import { isMeaningfulUserOptionValue } from '../utils/value-intent'
import { transformKeymapCommands } from './keymap-command-transform'
import {
  applySchemaGenerationRules,
  type MergedMap,
  type MergedValue,
} from './schema-generation-rules'

/**
 * Strip Lua comment-only lines from a string value.
 *
 * A "comment-only line" is a line whose trimmed content starts with `--`.
 * Lines that contain code before a trailing comment (e.g., `key = val -- note`)
 * are preserved — only lines that are purely comments are removed.
 *
 * Empty lines are preserved (they're structural whitespace between code).
 *
 * Limitation: This is line-based, not Lua-syntax-aware. A `--` inside a
 * multiline string literal (`[[ ... ]]`) would also be treated as a comment
 * line. In practice, schema defaults don't use multiline string literals,
 * so this is acceptable.
 *
 * @param luaCode - Lua code string (may contain newlines)
 * @returns The code with comment-only lines removed
 */
export function stripLuaCommentLines(luaCode: string): string {
  const lines = luaCode.split('\n')
  const filtered = lines.filter((line) => {
    const trimmed = line.trim()
    // Keep empty lines (structural whitespace)
    // Keep lines that don't start with -- (actual code, possibly with trailing comments)
    return trimmed.length === 0 || !trimmed.startsWith('--')
  })
  return filtered.join('\n')
}

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwnMergedValue(merged: MergedMap, key: string): boolean {
  const hasOwnPropertyFn = Object.prototype.hasOwnProperty
  return hasOwnPropertyFn.call(merged, key)
}

function cloneConfigValue(value: PluginConfigValue): PluginConfigValue {
  // Scalars are immutable, no clone needed
  if (value === null || typeof value !== 'object') {
    return value
  }

  return jsonDeepClone(value)
}

function asPluginConfigValueOrInvariantBreak(
  value: MergedValue | undefined,
): { ok: true; value: PluginConfigValue | undefined } | { ok: false } {
  if (isRawLua(value)) {
    return { ok: false }
  }

  return { ok: true, value: value as PluginConfigValue | undefined }
}

function getOptionDefault(option: SchemaOption): PluginConfigValue | undefined {
  return getEmittedOptionDefaultValue(option)
}

function isFiniteNumberValue(value: number): boolean {
  return Number.isFinite(value)
}

function isValidSingleSelectValue(
  option: SchemaSelectOption,
  value: string,
): boolean {
  return option.options.some((candidate) => candidate.value === value)
}

function getNormalizedValidMultiSelectDefault(
  option: SchemaSelectOption,
): string[] | undefined {
  if (option.multi !== true || !Array.isArray(option.default)) {
    return undefined
  }

  const validValues = option.default.filter((value) =>
    isValidSingleSelectValue(option, value),
  )
  return validValues.length === option.default.length ? validValues : undefined
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: schema-typed coercion branches by option kind and fallback rules
function normalizeTypedOptionValue(
  option: Exclude<
    SchemaOption,
    { readonly type: 'object' | 'lua' | 'plugin-keymap' | 'mapping-table' }
  >,
  value: PluginConfigValue,
  schemaDefault: PluginConfigValue | undefined,
  pluginName: string,
  fullPath: string,
  diagnostics: LegacyGenerationDiagnostic[],
): PluginConfigValue | undefined {
  const warn = (message: string): void => {
    diagnostics.push({
      severity: 'warning',
      message: `Plugin '${pluginName}': ${message}`,
      context: fullPath,
    })
  }

  switch (option.type) {
    case 'number': {
      if (typeof value === 'number' && isFiniteNumberValue(value)) {
        return value
      }

      if (typeof value === 'string') {
        const trimmedValue = value.trim()
        if (trimmedValue.length > 0) {
          const coercedValue = Number(trimmedValue)
          if (isFiniteNumberValue(coercedValue)) {
            warn(`coerced numeric string at "${fullPath}" to a Lua number`)
            return coercedValue
          }
        }
      }

      warn(
        `dropped invalid number value at "${fullPath}" and fell back to schema default or omission`,
      )
      return typeof schemaDefault === 'number' ? schemaDefault : undefined
    }

    case 'boolean': {
      if (typeof value === 'boolean') {
        return value
      }

      if (value === 'true' || value === 'false') {
        warn(`coerced boolean string at "${fullPath}" to a Lua boolean`)
        return value === 'true'
      }

      warn(
        `dropped invalid boolean value at "${fullPath}" and fell back to schema default or omission`,
      )
      return typeof schemaDefault === 'boolean' ? schemaDefault : undefined
    }

    case 'select': {
      if (option.multi === true) {
        if (!Array.isArray(value)) {
          warn(
            `dropped invalid multi-select value at "${fullPath}" and fell back to schema default or omission`,
          )
          return getNormalizedValidMultiSelectDefault(option)
        }

        const validValues: string[] = []
        for (const entry of value) {
          if (
            typeof entry === 'string' &&
            isValidSingleSelectValue(option, entry)
          ) {
            validValues.push(entry)
            continue
          }

          warn(`filtered invalid multi-select entry at "${fullPath}"`)
        }

        if (validValues.length > 0) {
          return validValues
        }

        if (value.length === 0) {
          return []
        }

        const fallbackDefault = getNormalizedValidMultiSelectDefault(option)
        if (fallbackDefault !== undefined) {
          warn(
            `replaced fully invalid multi-select value at "${fullPath}" with schema default`,
          )
        }
        return fallbackDefault
      }

      if (
        typeof value === 'string' &&
        isValidSingleSelectValue(option, value)
      ) {
        return value
      }

      warn(
        `dropped invalid select value at "${fullPath}" and fell back to schema default or omission`,
      )
      return typeof schemaDefault === 'string' &&
        isValidSingleSelectValue(option, schemaDefault)
        ? schemaDefault
        : undefined
    }

    case 'string': {
      if (typeof value === 'string') {
        return value
      }

      warn(
        `dropped invalid string value at "${fullPath}" and fell back to schema default or omission`,
      )
      return typeof schemaDefault === 'string' ? schemaDefault : undefined
    }

    case 'array':
    case 'color':
    case 'keysequence': {
      return value
    }
  }
}

interface MergeOptionContext {
  option: SchemaOption
  fullPath: string
  userValue: PluginConfigValue | undefined
  defaultValueOverride: PluginConfigValue | undefined
  luaFieldOverrides: Record<string, boolean> | undefined
  merged: MergedMap
  luaPaths: Set<string>
  diagnostics: LegacyGenerationDiagnostic[]
  pluginName: string
  userConfig: Readonly<Record<string, PluginConfigValue>>
}

function pushSchemaGenerationNotices(
  option: SchemaOption,
  fullPath: string,
  userConfig: Readonly<Record<string, PluginConfigValue>>,
  value: PluginConfigValue | undefined,
  diagnostics: LegacyGenerationDiagnostic[],
  pluginName: string,
): void {
  const notices = evaluateSchemaOptionNotices({
    option,
    optionPath: fullPath,
    allValues: userConfig,
    surface: 'generation',
    value,
  })

  for (const notice of notices) {
    diagnostics.push({
      severity: notice.severity,
      message: `Plugin '${pluginName}': ${notice.message}`,
      context: option.emitKey ?? fullPath,
    })
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive schema-typed option merge with include/raw/lua precedence; extraction would change coercion order and generated setup tables
function mergeOptionValue(ctx: MergeOptionContext): void {
  const schemaDefault = ctx.defaultValueOverride ?? getOptionDefault(ctx.option)

  if (ctx.option.type === 'object') {
    pushSchemaGenerationNotices(
      ctx.option,
      ctx.fullPath,
      ctx.userConfig,
      ctx.userValue ?? schemaDefault,
      ctx.diagnostics,
      ctx.pluginName,
    )

    const userObject = isConfigObject(ctx.userValue) ? ctx.userValue : undefined
    const defaultObject = isConfigObject(schemaDefault)
      ? schemaDefault
      : undefined

    for (const childOption of ctx.option.properties) {
      const childPath = `${ctx.fullPath}.${childOption.key}`
      const childUserValue = userObject?.[childOption.key]
      const childDefaultValue = defaultObject?.[childOption.key]

      mergeOptionValue({
        option: childOption,
        fullPath: childPath,
        userValue: childUserValue,
        defaultValueOverride: childDefaultValue,
        luaFieldOverrides: ctx.luaFieldOverrides,
        merged: ctx.merged,
        luaPaths: ctx.luaPaths,
        diagnostics: ctx.diagnostics,
        pluginName: ctx.pluginName,
        userConfig: ctx.userConfig,
      })
    }
    return
  }

  if (ctx.option.type === 'lua') {
    ctx.luaPaths.add(ctx.fullPath)
    const explicitOverride = ctx.luaFieldOverrides?.[ctx.fullPath]
    const decision = decideLuaInclusion(
      ctx.option,
      ctx.userValue,
      explicitOverride,
    )

    if (!decision.included) {
      return
    }

    const effectiveValue = ctx.userValue ?? schemaDefault
    if (effectiveValue === undefined) {
      ctx.merged[ctx.fullPath] = undefined as unknown as PluginConfigValue
      ctx.diagnostics.push({
        severity: 'warning',
        message: `Plugin '${ctx.pluginName}': lua field "${ctx.fullPath}" was forced included without value/default — emitting nil`,
        context: ctx.fullPath,
      })
      return
    }

    // Defensive unreachable guard: inclusion oracle always omits empty string.
    if (typeof effectiveValue === 'string' && effectiveValue === '') {
      ctx.diagnostics.push({
        severity: 'warning',
        message: `Plugin '${ctx.pluginName}': inclusion oracle returned included=true for empty value at "${ctx.fullPath}" — defensive omission`,
        context: ctx.fullPath,
      })
      return
    }

    if (typeof effectiveValue === 'string') {
      const stripped = stripLuaCommentLines(effectiveValue)
      if (stripped.trim().length === 0) {
        ctx.diagnostics.push({
          severity: 'warning',
          message: `Plugin '${ctx.pluginName}': lua field "${ctx.fullPath}" is whitespace-only after stripping comments — omitted`,
          context: ctx.fullPath,
        })
        return
      }

      ctx.merged[ctx.fullPath] = rawLua(stripped)
      pushSchemaGenerationNotices(
        ctx.option,
        ctx.fullPath,
        ctx.userConfig,
        ctx.userValue ?? schemaDefault,
        ctx.diagnostics,
        ctx.pluginName,
      )
      return
    }

    ctx.merged[ctx.fullPath] = cloneConfigValue(effectiveValue)
    pushSchemaGenerationNotices(
      ctx.option,
      ctx.fullPath,
      ctx.userConfig,
      ctx.userValue ?? schemaDefault,
      ctx.diagnostics,
      ctx.pluginName,
    )
    return
  }

  if (ctx.option.type === 'plugin-keymap') {
    if (ctx.userValue !== undefined) {
      ctx.merged[ctx.fullPath] = cloneConfigValue(ctx.userValue)
      pushSchemaGenerationNotices(
        ctx.option,
        ctx.fullPath,
        ctx.userConfig,
        ctx.userValue,
        ctx.diagnostics,
        ctx.pluginName,
      )
      return
    }

    if (ctx.option.defaultEmission === 'explicit-only') {
      return
    }

    // Ensure transform pass resolves defaults even without user value.
    ctx.merged[ctx.fullPath] = undefined as unknown as PluginConfigValue
    return
  }

  if (ctx.option.type === 'mapping-table') {
    if (ctx.userValue !== undefined) {
      ctx.merged[ctx.fullPath] = cloneConfigValue(ctx.userValue)
      pushSchemaGenerationNotices(
        ctx.option,
        ctx.fullPath,
        ctx.userConfig,
        ctx.userValue,
        ctx.diagnostics,
        ctx.pluginName,
      )
      return
    }

    if (Array.isArray(ctx.option.default) && ctx.option.default.length > 0) {
      ctx.merged[ctx.fullPath] = cloneConfigValue([
        ...ctx.option.default,
      ] as PluginConfigValue)
    }
    return
  }

  if (ctx.userValue !== undefined) {
    const normalizedUserValue = normalizeTypedOptionValue(
      ctx.option,
      ctx.userValue,
      schemaDefault,
      ctx.pluginName,
      ctx.fullPath,
      ctx.diagnostics,
    )
    if (normalizedUserValue !== undefined) {
      ctx.merged[ctx.fullPath] = cloneConfigValue(normalizedUserValue)
    }
    pushSchemaGenerationNotices(
      ctx.option,
      ctx.fullPath,
      ctx.userConfig,
      normalizedUserValue,
      ctx.diagnostics,
      ctx.pluginName,
    )
    return
  }

  if (schemaDefault !== undefined) {
    ctx.merged[ctx.fullPath] = cloneConfigValue(schemaDefault)
    pushSchemaGenerationNotices(
      ctx.option,
      ctx.fullPath,
      ctx.userConfig,
      schemaDefault,
      ctx.diagnostics,
      ctx.pluginName,
    )
  }
}

function buildPackSpecLua(
  repo: string,
  pack: VimPackInstallSpec | undefined,
): string {
  const srcUrl = repo.startsWith('https://')
    ? repo
    : `https://github.com/${repo}`
  const fields = [`src = "${escapeLuaString(srcUrl)}"`]

  if (pack?.name !== undefined) {
    fields.push(`name = "${escapeLuaString(pack.name)}"`)
  }

  if (pack?.version?.mode === 'ref') {
    fields.push(`version = "${escapeLuaString(pack.version.value)}"`)
  }

  if (pack?.version?.mode === 'semver-range') {
    fields.push(
      `version = vim.version.range("${escapeLuaString(pack.version.value)}")`,
    )
  }

  return `{ ${fields.join(', ')} },`
}

function resolveEffectivePack(
  schemaPack: VimPackInstallSpec | undefined,
  override: PluginInstallOverride | undefined,
): VimPackInstallSpec | undefined {
  const name = override?.name ?? schemaPack?.name
  const version = override?.version ?? schemaPack?.version

  if (name === undefined && version === undefined) {
    return undefined
  }

  return { name, version }
}

function mergePluginConfigWithLuaInclusion(
  options: ResolvedPluginForGeneration['schema']['options'],
  userConfig: Record<string, PluginConfigValue>,
  luaFieldOverrides: Record<string, boolean> | undefined,
  diagnostics: LegacyGenerationDiagnostic[],
  pluginName: string,
): { merged: MergedMap; luaPaths: Set<string> } {
  const merged: MergedMap = {}
  const luaPaths = new Set<string>()

  for (const option of options) {
    mergeOptionValue({
      option,
      fullPath: option.key,
      userValue: userConfig[option.key],
      defaultValueOverride: undefined,
      luaFieldOverrides,
      merged,
      luaPaths,
      diagnostics,
      pluginName,
      userConfig,
    })
  }

  return { merged, luaPaths }
}

function getByDotPath(
  value: Record<string, unknown>,
  path: string,
): unknown | undefined {
  const segments = path.split('.')
  let current: unknown = value

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) {
      return undefined
    }

    const record = current as Record<string, unknown>
    if (!(segment in record)) {
      return undefined
    }

    current = record[segment]
  }

  return current
}

function assertLuaPathsAreSafe(
  config: Record<string, unknown>,
  luaPaths: ReadonlySet<string>,
): void {
  for (const luaPath of luaPaths) {
    const value = getByDotPath(config, luaPath)
    if (value !== undefined) {
      validateLuaFieldNotPlainString(value, luaPath)
    }
  }
}

function assertNoRawTypedSubtreeOverlap(
  schema: ResolvedPluginForGeneration['schema'],
  config: Record<string, PluginConfigValue>,
): void {
  const optionsByKey = new Map<string, SchemaOption>()
  for (const option of schema.options) {
    optionsByKey.set(option.key, option)
  }

  const userSetKeys = new Set<string>()
  for (const [key, value] of Object.entries(config)) {
    const option = optionsByKey.get(key)
    if (isMeaningfulUserOptionValue(value, option)) {
      userSetKeys.add(key)
    }
  }

  const luaOptions = schema.options.filter((option) => option.type === 'lua')
  for (const luaOption of luaOptions) {
    if (!userSetKeys.has(luaOption.key)) {
      continue
    }

    const luaEmittedKey = effectiveKey(luaOption)
    const subtreePrefix = `${luaEmittedKey}.`
    const overlappingOptions = schema.options.filter(
      (option) =>
        option.key !== luaOption.key &&
        userSetKeys.has(option.key) &&
        effectiveKey(option).startsWith(subtreePrefix),
    )

    if (overlappingOptions.length === 0) {
      continue
    }

    throw new LuaGenerationError(
      `Plugin "${schema.id}": cannot set both raw lua option "${luaOption.key}" (emits "${luaEmittedKey}") and typed descendant(s) under the same emitted subtree: ${overlappingOptions
        .map((option) => `"${option.key}" (emits "${effectiveKey(option)}")`)
        .join(
          ', ',
        )}. Choose one approach per subtree: clear "${luaOption.key}" to use typed defaults, or reset the typed fields to their defaults to use the raw override.`,
    )
  }
}

/**
 * Generate the plugin section.
 *
 * Emits vim.pack.add() for all enabled plugins, and require().setup()
 * for plugins with setup configurations.
 *
 * @param input - Plugin configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generatePluginSection(
  input: PluginSectionInput,
): SectionResult {
  const { resolvedPlugins, themePluginIds } = input
  const diagnostics: LegacyGenerationDiagnostic[] = []

  // Filter to enabled plugins only
  const enabledPlugins = resolvedPlugins.filter((rp) => rp.plugin.enabled)

  if (enabledPlugins.length === 0) {
    return {
      id: 'plugins',
      code: [],
      diagnostics: [],
    }
  }

  // Sort plugins alphabetically by pluginName for deterministic output
  const sortedPlugins = [...enabledPlugins].sort((a, b) =>
    a.schema.pluginName.localeCompare(b.schema.pluginName),
  )

  const code: string[] = []

  // Emit vim.pack.add() block with ALL enabled plugins
  code.push('-- Plugins')
  code.push('vim.pack.add({')

  for (const rp of sortedPlugins) {
    const repo = rp.schema.pluginRepo

    if (!repo) {
      diagnostics.push({
        severity: 'error',
        message: `Plugin '${rp.schema.pluginName}': missing repository URL, cannot add to vim.pack`,
        context: rp.schema.id,
      })
      continue
    }

    const effectivePack = resolveEffectivePack(
      rp.schema.pack,
      rp.plugin.installOverride,
    )

    if (
      rp.plugin.installOverride?.version !== undefined &&
      rp.schema.pack?.version !== undefined &&
      !installVersionSpecsEqual(
        rp.plugin.installOverride.version,
        rp.schema.pack.version,
      )
    ) {
      diagnostics.push({
        severity: 'warning',
        context: rp.schema.id,
        message: `Plugin '${rp.schema.pluginName}': custom install version '${getInstallVersionLabel(
          rp.plugin.installOverride.version,
        )}' overrides schema default '${getInstallVersionLabel(
          rp.schema.pack.version,
        )}'. Ensure the selected schema/config is compatible with that plugin version.`,
      })
    }

    code.push(`  ${buildPackSpecLua(repo, effectivePack)}`)
  }

  code.push('})')

  // Emit setup() calls for non-theme plugins with setup configuration
  const regularPlugins = sortedPlugins.filter(
    (rp) => !themePluginIds.has(rp.schema.id),
  )

  for (const rp of regularPlugins) {
    const setupResult = generatePluginSetup(rp, diagnostics)
    if (setupResult) {
      code.push('')
      code.push(...setupResult)
    }
  }

  return {
    id: 'plugins',
    code,
    diagnostics,
  }
}

/**
 * Generate setup code for a single plugin.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: schema-driven setup emission with ordered option merges and diagnostic side effects tied to exact Lua layout
function generatePluginSetup(
  rp: ResolvedPluginForGeneration,
  diagnostics: LegacyGenerationDiagnostic[],
): string[] | null {
  const setup = rp.schema.setup
  const pluginName = rp.schema.pluginName

  // No setup metadata - emit comment only
  if (!setup) {
    diagnostics.push({
      severity: 'info',
      message: `Plugin '${pluginName}': no setup metadata — loaded but not configured`,
      context: rp.schema.id,
    })
    return [`-- ${pluginName}: no setup required`]
  }

  const requirePath = setup.requirePath

  if (!requirePath || requirePath.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: `Plugin '${pluginName}': setup.requirePath is empty`,
      context: rp.schema.id,
    })
    return null
  }

  const setupFunction = setup.setupFunction ?? 'setup'
  const schemaForValidation = rp.schema as PluginSchema

  try {
    assertSchemaShape(schemaForValidation)
    assertNoRawTypedSubtreeOverlap(rp.schema, rp.plugin.config)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push({
      severity: 'error',
      message: `Plugin '${pluginName}': ${message}`,
      context: rp.schema.id,
    })
    return null
  }

  // Merge schema defaults with user config
  const { merged: mergedConfig, luaPaths } = mergePluginConfigWithLuaInclusion(
    rp.schema.options,
    rp.plugin.config,
    rp.plugin.luaFieldOverrides,
    diagnostics,
    pluginName,
  )

  // Post-merge transform: resolve plugin-keymap options into Lua-ready flat tables.
  // Must run BEFORE unflattenDotKeys so the keymap value is already in its final shape.
  for (const option of rp.schema.options) {
    if (option.type === 'plugin-keymap') {
      if (!hasOwnMergedValue(mergedConfig, option.key)) {
        continue
      }

      const slot = asPluginConfigValueOrInvariantBreak(mergedConfig[option.key])
      if (!slot.ok) {
        diagnostics.push({
          severity: 'error',
          message: `Plugin '${pluginName}': internal invariant violated — plugin-keymap option "${option.key}" received a raw Lua marker; this is a codegen bug`,
          context: rp.schema.id,
        })
        return null
      }

      // Apply canonical default resolution (fills in defaultPreset when absent)
      const resolved = resolvePluginKeymapDefaults(slot.value, option)

      // Flatten { preset, overrides: { key: commands } } -> { preset, key: commands }
      const flattened = flattenPluginKeymapValue({
        preset: resolved.preset,
        overrides: resolved.overrides,
      } as Record<string, unknown>)

      // Convert { lua: "..." } entries to LuaRawCode markers, with diagnostics
      const transformed = transformKeymapCommands(
        flattened,
        option.key,
        pluginName,
        diagnostics,
      )

      mergedConfig[option.key] = transformed as MergedValue
    }
  }

  applySchemaGenerationRules({
    merged: mergedConfig,
    schema: rp.schema,
    userConfig: rp.plugin.config,
    pluginName,
    diagnostics,
  })

  const remapPairs: Array<{ from: string; to: string }> = []
  for (const option of rp.schema.options) {
    const to = effectiveKey(option)
    if (to !== option.key) {
      remapPairs.push({ from: option.key, to })
    }
  }
  remapPairs.sort((a, b) => b.from.length - a.from.length)

  const emittedFlatConfig: MergedMap = {}
  for (const path of Object.keys(mergedConfig)) {
    const value = mergedConfig[path]
    let emitPath = path
    for (const { from, to } of remapPairs) {
      if (path === from || path.startsWith(`${from}.`)) {
        emitPath = `${to}${path.slice(from.length)}`
        break
      }
    }
    emittedFlatConfig[emitPath] = value as MergedValue
  }

  // Unflatten dot-notation keys
  let unflattened: Record<string, unknown>
  try {
    unflattened = unflattenDotKeys(emittedFlatConfig)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push({
      severity: 'error',
      message: `Plugin '${pluginName}': config key collision — ${message}`,
      context: rp.schema.id,
    })
    return null
  }

  try {
    assertLuaPathsAreSafe(unflattened, luaPaths)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push({
      severity: 'error',
      message: `Plugin '${pluginName}': ${message}`,
      context: rp.schema.id,
    })
    return null
  }

  const code: string[] = []

  // Emit plugin name comment
  code.push(`-- ${pluginName}`)

  // Emit preSetup code if defined
  if (setup.preSetup) {
    code.push(setup.preSetup)
  }

  if (setup.render?.kind === 'lua-template') {
    try {
      const serializedConfig = serializeValue(
        unflattened as import('../utils/lua-serialize').LuaSerializable,
        { pretty: true, sortObjectKeys: true },
      )
      const serializedRequirePath = `"${escapeLuaString(requirePath)}"`
      code.push(
        renderSetupTemplate({
          template: setup.render.template,
          serializedConfig,
          serializedRequirePath,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      diagnostics.push({
        severity: 'error',
        message: `Plugin '${pluginName}': setup template render failed — ${message}`,
        context: rp.schema.id,
      })
      return null
    }
  } else {
    // Build the setup() call
    const configKeys = Object.keys(unflattened)
    const setupCall =
      configKeys.length === 0
        ? `require("${escapeLuaString(requirePath)}").${setupFunction}()`
        : `require("${escapeLuaString(requirePath)}").${setupFunction}(${serializeValue(
            unflattened as import('../utils/lua-serialize').LuaSerializable,
            { pretty: true, sortObjectKeys: true },
          )})`

    code.push(setupCall)
  }

  // Emit postSetup code if defined
  if (setup.postSetup) {
    code.push(setup.postSetup)
  }

  return code
}

/**
 * Escape a string for use in Lua double-quoted string.
 */
