import {
  isRunFunctionDefaultValue,
  type PluginSchema,
  type ResolvedSchema,
  type RunFunctionDefaultValue,
  type SchemaFunctionParam,
} from '@/shared/types'
import type { CatalogCategory } from './catalog-types'
import type {
  CoreCategorySlug,
  CoreFunctionTemplateDefinition,
  FunctionCatalogEntry,
  FunctionCatalogParam,
} from './function-catalog-types'
import {
  CORE_CATEGORY_LABELS,
  CORE_CATEGORY_ORDER,
  coreCategoryKey,
  pluginAllCategoryKey,
} from './function-catalog-types'
import { API_FUNCTION_CATALOG } from './neovim/api-functions'
import { DIAGNOSTIC_FUNCTION_CATALOG } from './neovim/diagnostic-functions'
import { CORE_FUNCTION_TEMPLATES } from './neovim/function-templates'
import {
  inferFunctionResultPortType,
  NEOVIM_FUNCTION_CATALOG,
  type VimFunctionCatalogEntry,
} from './neovim/functions'
import { LSP_FUNCTION_CATALOG } from './neovim/lsp-functions'
import { TREESITTER_FUNCTION_CATALOG } from './neovim/treesitter-functions'

// ============================================
// Display formatters for plugin entries
// ============================================

function formatLuaCallForDisplay(luaCall: string): string {
  let out = luaCall.replace(/\$params\.([A-Za-z_][A-Za-z0-9_]*)/g, '$1')
  out = out.replace(/\$params\b/g, '...')
  return out
}

function derivePluginSourceDoc(
  authored: string | undefined,
  luaCall: string,
): string {
  if (authored !== undefined && authored.trim().length > 0) {
    return authored
  }

  return formatLuaCallForDisplay(luaCall)
}

// ============================================
// Core Category Definitions (canonical ordering)
// ============================================

/**
 * CORE_CATEGORIES is derived from CORE_CATEGORY_ORDER — the single source of truth.
 * Do NOT use Object.keys(CORE_CATEGORY_LABELS) for ordering.
 */
const CORE_CATEGORIES: readonly CatalogCategory[] = CORE_CATEGORY_ORDER.map(
  (slug) => ({
    key: coreCategoryKey(slug),
    label: CORE_CATEGORY_LABELS[slug],
  }),
)

// ============================================
// Build Core Entries
// ============================================

function buildCoreEntry(fn: VimFunctionCatalogEntry): FunctionCatalogEntry {
  const categorySlug = fn.category as CoreCategorySlug
  const catKey = coreCategoryKey(categorySlug)
  const returns = inferFunctionResultPortType(fn)

  const params: FunctionCatalogParam[] = (fn.argumentHints ?? []).map(
    (hint) => ({
      name: hint.name,
      type: hint.type ?? 'any',
      optional: hint.index >= fn.minArgs,
      description: hint.description,
      example: hint.example,
      allowedValues: hint.allowedValues,
      allowedValueDescriptions: hint.allowedValueDescriptions,
    }),
  )

  return {
    key: `core:${fn.name}`,
    categoryKey: catKey,
    categoryLabel: CORE_CATEGORY_LABELS[categorySlug],
    label: fn.label, // Use friendly label
    shortDescription: fn.notes,
    functionSource: { type: 'core', functionName: fn.name },
    luaCall: fn.luaCallOverride ?? `vim.fn.${fn.name}($params)`, // Respect override
    params,
    returns,
    sourceDoc: fn.sourceDoc,
    notes: fn.notes,
    signature: fn.signature,
    isPlugin: false,
    // New fields
    whatItDoes: fn.whatItDoes,
    technicalNote: fn.technicalNote,
    isPopular: fn.isPopular,
    advancedOnly: fn.advancedOnly,
    requires: fn.requires,
    aliases: fn.aliases,
    returnDescription: fn.returnDescription,
    paramsStyle: fn.paramsStyle,
  }
}

// ============================================
// Template Builder
// ============================================

function findBaseEntryByFunctionName(
  baseEntryMap: ReadonlyMap<string, FunctionCatalogEntry>,
  functionName: string,
): FunctionCatalogEntry | undefined {
  for (const entry of baseEntryMap.values()) {
    if (
      entry.functionSource.type === 'core' &&
      entry.functionSource.functionName === functionName
    ) {
      return entry
    }
  }
  return undefined
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeTemplateDefaults(
  rawDefaults: Record<string, unknown>,
  validParamNames: ReadonlySet<string>,
  unknownParamMessage: (paramName: string) => string,
  invalidValueMessage: (paramName: string) => string,
): Record<string, RunFunctionDefaultValue> {
  const templateDefaults: Record<string, RunFunctionDefaultValue> = {}

  for (const [paramName, rawValue] of Object.entries(rawDefaults)) {
    if (!validParamNames.has(paramName)) {
      if (import.meta.env.DEV) {
        console.error(unknownParamMessage(paramName))
      }
      continue
    }

    if (!isRunFunctionDefaultValue(rawValue)) {
      if (import.meta.env.DEV) {
        console.error(invalidValueMessage(paramName))
      }
      continue
    }

    templateDefaults[paramName] = rawValue
  }

  return templateDefaults
}

function buildCoreTemplateEntries(
  templates: readonly CoreFunctionTemplateDefinition[],
  baseEntryMap: ReadonlyMap<string, FunctionCatalogEntry>,
): FunctionCatalogEntry[] {
  const entries: FunctionCatalogEntry[] = []

  for (const tmpl of templates) {
    const baseFn = findBaseEntryByFunctionName(
      baseEntryMap,
      tmpl.baseFunctionName,
    )
    if (baseFn === undefined) {
      if (import.meta.env.DEV) {
        console.warn(
          `Template "${tmpl.key}" references unknown base function "${tmpl.baseFunctionName}". Skipping.`,
        )
      }
      continue
    }

    const baseParamNames = new Set(baseFn.params.map((p) => p.name))
    const templateDefaults = sanitizeTemplateDefaults(
      tmpl.defaults,
      baseParamNames,
      (paramName) =>
        `Template "${tmpl.key}" has default for unknown param "${paramName}" ` +
        `(base function "${tmpl.baseFunctionName}" has params: [${[...baseParamNames].join(', ')}])`,
      (paramName) =>
        `Template "${tmpl.key}" has invalid default value for param "${paramName}"`,
    )

    entries.push({
      // Inherited from base function (single source of truth):
      key: `template:${tmpl.key}`,
      categoryKey: baseFn.categoryKey,
      categoryLabel: baseFn.categoryLabel,
      functionSource: baseFn.functionSource,
      luaCall: baseFn.luaCall,
      params: baseFn.params,
      returns: baseFn.returns,
      sourceDoc: baseFn.sourceDoc,
      notes: baseFn.notes,
      signature: baseFn.signature,
      isPlugin: false,
      paramsStyle: baseFn.paramsStyle,

      // Overridden by template:
      label: tmpl.label,
      shortDescription: tmpl.shortDescription,
      whatItDoes: tmpl.whatItDoes,
      isPopular: tmpl.isPopular,
      aliases: tmpl.aliases,

      // Template-specific:
      isTemplate: true,
      baseFunctionKey: baseFn.key,
      templateDefaults,
    })
  }

  return entries
}

function buildCoreEntries(): FunctionCatalogEntry[] {
  const allFunctions: readonly VimFunctionCatalogEntry[] = [
    ...NEOVIM_FUNCTION_CATALOG,
    ...API_FUNCTION_CATALOG,
    ...LSP_FUNCTION_CATALOG,
    ...DIAGNOSTIC_FUNCTION_CATALOG,
    ...TREESITTER_FUNCTION_CATALOG,
  ]

  const baseEntries = allFunctions.map(buildCoreEntry)

  // Build a lookup of base entries for template resolution
  const baseEntryMap = new Map<string, FunctionCatalogEntry>(
    baseEntries.map((e) => [e.key, e]),
  )

  const templateEntries = buildCoreTemplateEntries(
    CORE_FUNCTION_TEMPLATES,
    baseEntryMap,
  )

  return [...baseEntries, ...templateEntries]
}

// ============================================
// Build Plugin Entries
// ============================================

/**
 * Auto-derive a friendly label from a function name.
 * Examples:
 *   'find_files' → 'Find Files'
 *   'live_grep'  → 'Live Grep'
 *   'git_commits' → 'Git Commits'
 */
export function deriveLabelFromFunctionName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildPluginEntries(schema: PluginSchema): {
  categories: CatalogCategory[]
  entries: FunctionCatalogEntry[]
} {
  if (
    schema.functions.length === 0 &&
    (schema.functionTemplates ?? []).length === 0
  ) {
    return { categories: [], entries: [] }
  }

  const allKey = pluginAllCategoryKey(schema.id)
  const allLabel = schema.pluginName

  const categories: CatalogCategory[] = [{ key: allKey, label: allLabel }]

  // Build regular function entries
  const entries: FunctionCatalogEntry[] = schema.functions.map((fn) => {
    const params: FunctionCatalogParam[] = fn.params.map((p) =>
      mapSchemaParamToCatalogParam(p),
    )

    return {
      key: `plugin:${schema.id}:${fn.name}`,
      categoryKey: allKey,
      categoryLabel: allLabel,
      label: fn.label ?? deriveLabelFromFunctionName(fn.name), // Auto-derive!
      shortDescription: fn.description ?? `Function from ${schema.pluginName}`,
      whatItDoes: fn.whatItDoes,
      technicalNote: fn.technicalNote,
      isPopular: fn.isPopular,
      aliases: fn.aliases,
      functionSource: {
        type: 'plugin',
        pluginId: schema.id,
        functionName: fn.name,
      },
      luaCall: fn.luaCall,
      params,
      returns: fn.returns ?? 'void',
      sourceDoc: derivePluginSourceDoc(fn.sourceDoc, fn.luaCall),
      notes: fn.description ?? '',
      signature: formatLuaCallForDisplay(fn.luaCall),
      isPlugin: true,
    }
  })

  // Build template entries from plugin functionTemplates
  for (const tmpl of schema.functionTemplates ?? []) {
    const baseFn = schema.functions.find(
      (f) => f.name === tmpl.baseFunctionName,
    )
    if (!baseFn) continue // Skip templates referencing missing functions

    const params: FunctionCatalogParam[] = baseFn.params.map((p) =>
      mapSchemaParamToCatalogParam(p),
    )

    const baseParamNames = new Set(baseFn.params.map((p) => p.name))
    const rawDefaults = isObjectRecord(tmpl.defaults) ? tmpl.defaults : {}
    const templateDefaults = sanitizeTemplateDefaults(
      rawDefaults,
      baseParamNames,
      (paramName) =>
        `Plugin "${schema.id}" template "${tmpl.key}" has default for unknown param ` +
        `"${paramName}" (base function "${tmpl.baseFunctionName}" has params: ` +
        `[${baseFn.params.map((p) => p.name).join(', ')}])`,
      (paramName) =>
        `Plugin "${schema.id}" template "${tmpl.key}" has invalid default value for param "${paramName}"`,
    )

    entries.push({
      key: `plugin:${schema.id}:template:${tmpl.key}`,
      categoryKey: allKey,
      categoryLabel: allLabel,
      label: tmpl.label,
      shortDescription: tmpl.shortDescription,
      whatItDoes: tmpl.whatItDoes,
      isPopular: tmpl.isPopular,
      aliases: tmpl.aliases,
      functionSource: {
        type: 'plugin',
        pluginId: schema.id,
        functionName: baseFn.name,
      },
      luaCall: baseFn.luaCall,
      params,
      returns: baseFn.returns ?? 'void',
      sourceDoc: derivePluginSourceDoc(baseFn.sourceDoc, baseFn.luaCall),
      notes: tmpl.shortDescription,
      signature: formatLuaCallForDisplay(baseFn.luaCall),
      isPlugin: true,
      isTemplate: true,
      baseFunctionKey: `plugin:${schema.id}:${baseFn.name}`,
      templateDefaults,
    })
  }

  return { categories, entries }
}

// ============================================
// Dev-mode uniqueness assertion
// ============================================

function assertUniqueCatalogKeys(
  entries: readonly FunctionCatalogEntry[],
): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.key)) {
      throw new Error(`Duplicate function catalog key: "${entry.key}"`)
    }
    seen.add(entry.key)
  }
}

// ============================================
// Public API
// ============================================

export interface FunctionCatalog {
  readonly categories: readonly CatalogCategory[]
  readonly entries: readonly FunctionCatalogEntry[]
}

/**
 * Build a complete function catalog from core Neovim functions + installed plugin schemas.
 *
 * @param installedSchemas - Only schemas for plugins that are installed AND enabled
 */
export function buildFunctionCatalog(
  installedSchemas: readonly ResolvedSchema[],
): FunctionCatalog {
  const categories: CatalogCategory[] = [...CORE_CATEGORIES]
  const entries: FunctionCatalogEntry[] = buildCoreEntries()

  for (const { schema } of installedSchemas) {
    const plugin = buildPluginEntries(schema)
    categories.push(...plugin.categories)
    entries.push(...plugin.entries)
  }

  if (import.meta.env.DEV) {
    assertUniqueCatalogKeys(entries)
  }

  return { categories, entries }
}

// ============================================
// Query Helpers (mirror action-catalog-entries.ts pattern)
// ============================================

export function getFunctionsByCategory(
  catalog: FunctionCatalog,
  categoryKey: string,
): readonly FunctionCatalogEntry[] {
  return catalog.entries.filter((e) => e.categoryKey === categoryKey)
}

export function findFunctionByKey(
  catalog: FunctionCatalog,
  key: string,
): FunctionCatalogEntry | undefined {
  return catalog.entries.find((e) => e.key === key)
}

export function getFunctionCategoryCounts(
  catalog: FunctionCatalog,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of catalog.entries) {
    counts[entry.categoryKey] = (counts[entry.categoryKey] ?? 0) + 1
  }
  return counts
}

export function searchFunctions(
  catalog: FunctionCatalog,
  query: string,
): readonly FunctionCatalogEntry[] {
  const q = query.toLowerCase().trim()
  if (q.length === 0) return catalog.entries

  return catalog.entries.filter((entry) => {
    if (entry.label.toLowerCase().includes(q)) return true
    if (entry.shortDescription.toLowerCase().includes(q)) return true
    if (entry.signature.toLowerCase().includes(q)) return true
    if (entry.aliases?.some((a) => a.toLowerCase().includes(q))) return true
    if (entry.categoryLabel.toLowerCase().includes(q)) return true
    // NEW: search whatItDoes and entry key
    if (entry.whatItDoes?.toLowerCase().includes(q)) return true
    if (entry.key.toLowerCase().includes(q)) return true
    return false
  })
}

/**
 * Returns popular functions (isPopular: true, advancedOnly !== true).
 * Used by the Popular view in the function picker.
 */
export function getPopularFunctions(
  catalog: FunctionCatalog,
): readonly FunctionCatalogEntry[] {
  return catalog.entries.filter(
    (e) => e.isPopular === true && e.advancedOnly !== true,
  )
}
function mapSchemaParamToCatalogParam(
  p: SchemaFunctionParam,
): FunctionCatalogParam {
  return {
    name: p.name,
    type: p.type,
    optional: p.optional ?? false,
    description: p.description,
    example: p.example,
    tier: p.tier,
    group: p.group,
    allowedValues: p.allowedValues,
    allowedValueDescriptions: p.allowedValueDescriptions,
    multi: p.multi,
    objectShape: p.objectShape?.map((child) =>
      mapSchemaParamToCatalogParam(child),
    ),
    portLabel: p.portLabel,
  }
}
