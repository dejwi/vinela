// Unified Catalog Builder
// Consolidates core actions and plugin functions/commands into a single searchable catalog

import type { ActionCatalogEntry } from '@/shared/data/neovim/action-catalog'
import type {
  CatalogCategory,
  CatalogCommandParam,
  CatalogEntry,
  CatalogFunctionParam,
} from '@/shared/types/catalog'
import { normalizeCatalogCategory } from '@/shared/types/catalog'
import type {
  PluginSchema,
  ResolvedSchema,
  SchemaExCommand,
  SchemaExCommandTemplate,
  SchemaFunction,
} from '@/shared/types/schema'

// Map old ActionCategory to new CatalogCategory
const CATEGORY_MAP: Record<string, CatalogCategory> = {
  file: 'files',
  'copy-paste': 'copy-paste',
  navigation: 'navigation',
  editing: 'editing',
  layout: 'layout',
  lists: 'navigation', // Merged
  folding: 'folding',
  search: 'search',
  help: 'help',
}

/**
 * Build unified catalog from core entries and installed plugin schemas.
 * Deduplicates commands covered by function's relatedCommand field.
 */
export function buildCatalog(
  coreEntries: readonly ActionCatalogEntry[],
  installedSchemas: readonly ResolvedSchema[],
): CatalogEntry[] {
  const entries: CatalogEntry[] = []
  const coveredCommands = new Set<string>()

  // 1. Add core entries
  for (const core of coreEntries) {
    entries.push(coreToCatalogEntry(core))
  }

  // 2. Add plugin functions, track covered commands
  for (const { schema } of installedSchemas) {
    for (const fn of schema.functions ?? []) {
      entries.push(functionToCatalogEntry(schema, fn))
      if (fn.relatedCommand) {
        coveredCommands.add(normalizeCommand(fn.relatedCommand))
      }
    }
  }

  // 3. Add plugin commands and templates.
  for (const { schema } of installedSchemas) {
    for (const cmd of schema.exCommands ?? []) {
      if (!coveredCommands.has(normalizeCommand(cmd.name))) {
        entries.push(commandToCatalogEntry(schema, cmd))
      }
      for (const template of schema.exCommandTemplates ?? []) {
        if (template.baseCommandName === cmd.name) {
          entries.push(commandTemplateToCatalogEntry(schema, cmd, template))
        }
      }
    }
  }

  return entries
}

/**
 * Normalize command for deduplication (strip colon, lowercase, trim)
 */
function normalizeCommand(cmd: string): string {
  return cmd.replace(/^:/, '').trim().split(/\s/, 1)[0]?.toLowerCase() ?? ''
}

/**
 * Convert core ActionCatalogEntry to CatalogEntry
 */
function coreToCatalogEntry(core: ActionCatalogEntry): CatalogEntry {
  const category = CATEGORY_MAP[core.category] ?? 'uncategorized'

  const params: readonly CatalogCommandParam[] = (core.params ?? []).map(
    (p): CatalogCommandParam => {
      const base = {
        name: p.name,
        type: p.type,
        required: p.required,
      }
      return {
        ...base,
        ...(p.defaultValue !== undefined && { default: p.defaultValue }),
        label: p.label,
        placeholder: p.placeholder,
        description: p.description,
      }
    },
  )

  const baseFields = {
    key: core.key,
    source: { sourceType: 'core' as const },
    label: core.label,
    shortDescription: core.shortDescription,
    category,
    isPopular: core.isPopular ?? false,
    aliases: core.aliases ?? [],
    template: core.template,
    params,
    ...(core.whatItDoes !== undefined && { whatItDoes: core.whatItDoes }),
    ...(core.example !== undefined && { example: core.example }),
    ...(core.technicalNote !== undefined && {
      technicalNote: core.technicalNote,
    }),
    ...(core.sourceDoc !== undefined && { sourceDoc: core.sourceDoc }),
  }

  // Return properly typed based on discriminator
  if (core.type === 'command') {
    return { type: 'command' as const, ...baseFields }
  }
  return { type: 'keys' as const, ...baseFields }
}

/**
 * Convert SchemaFunction to CatalogEntry
 */
function functionToCatalogEntry(
  schema: PluginSchema,
  fn: SchemaFunction,
): CatalogEntry {
  const params: readonly CatalogFunctionParam[] = fn.params.map(
    (p): CatalogFunctionParam => ({
      name: p.name,
      type: p.type,
      required: p.optional !== true,
      ...(p.description !== undefined && { description: p.description }),
    }),
  )

  // Explicitly construct function entry (no cast needed)
  const entry: CatalogEntry & { type: 'function' } = {
    type: 'function',
    key: `${schema.id}:${fn.name}`,
    source: {
      sourceType: 'plugin',
      pluginId: schema.id,
      pluginName: schema.pluginName,
    },
    label: fn.label ?? snakeCaseToTitleCase(fn.name),
    shortDescription: fn.shortDescription ?? fn.description ?? fn.name,
    category: normalizeCatalogCategory(fn.category, `${schema.id}:${fn.name}`),
    isPopular: fn.isPopular ?? false,
    aliases: fn.aliases ?? [],
    pluginId: schema.id,
    functionName: fn.name,
    params,
    ...(fn.whatItDoes !== undefined && { whatItDoes: fn.whatItDoes }),
    ...(fn.example !== undefined && { example: fn.example }),
    ...(fn.technicalNote !== undefined && {
      technicalNote: fn.technicalNote,
    }),
    ...(fn.sourceDoc !== undefined && { sourceDoc: fn.sourceDoc }),
    ...(fn.returns !== undefined && { returns: fn.returns }),
    ...(fn.relatedCommand !== undefined && {
      relatedCommand: fn.relatedCommand,
    }),
  }

  return entry
}

/**
 * Convert SchemaExCommand to CatalogEntry
 */
function commandToCatalogEntry(
  schema: PluginSchema,
  cmd: SchemaExCommand,
): Extract<CatalogEntry, { type: 'command' }> {
  const params: readonly CatalogCommandParam[] = (cmd.params ?? []).map(
    (p): CatalogCommandParam => ({
      name: p.name,
      type: p.type ?? 'string',
      required: p.optional !== true,
      label: p.label ?? p.name,
      placeholder: p.placeholder,
      description: p.description,
      ...(p.defaultValue !== undefined && { default: String(p.defaultValue) }),
      ...(p.allowedValues !== undefined && { allowedValues: p.allowedValues }),
      ...(p.allowedValueDescriptions !== undefined && {
        allowedValueDescriptions: p.allowedValueDescriptions,
      }),
      ...(p.tier !== undefined && { tier: p.tier }),
      ...(p.group !== undefined && { group: p.group }),
      ...(p.escape !== undefined && { escape: p.escape }),
      ...(p.emit !== undefined && { emit: p.emit }),
    }),
  )

  // Explicitly construct command entry (no cast needed)
  const entry: Extract<CatalogEntry, { type: 'command' }> = {
    type: 'command',
    key: `${schema.id}:cmd:${cmd.name}`,
    source: {
      sourceType: 'plugin',
      pluginId: schema.id,
      pluginName: schema.pluginName,
    },
    label: cmd.label ?? cmd.name,
    shortDescription: cmd.shortDescription ?? cmd.description,
    category: normalizeCatalogCategory(
      cmd.category,
      `${schema.id}:cmd:${cmd.name}`,
    ),
    isPopular: cmd.isPopular ?? false,
    aliases: cmd.aliases ?? [],
    template: cmd.template,
    params,
    ...(cmd.whatItDoes !== undefined && { whatItDoes: cmd.whatItDoes }),
    ...(cmd.example !== undefined && { example: cmd.example }),
    ...(cmd.technicalNote !== undefined && {
      technicalNote: cmd.technicalNote,
    }),
    ...(cmd.sourceDoc !== undefined && { sourceDoc: cmd.sourceDoc }),
  }

  return entry
}

function commandTemplateToCatalogEntry(
  schema: PluginSchema,
  command: SchemaExCommand,
  template: SchemaExCommandTemplate,
): Extract<CatalogEntry, { type: 'command' }> {
  const base = commandToCatalogEntry(schema, command)
  const params = base.params.map(
    (param): CatalogCommandParam => ({
      ...param,
      ...(template.defaults[param.name] !== undefined && {
        default: String(template.defaults[param.name]),
      }),
    }),
  )
  return {
    ...base,
    key: `${schema.id}:cmd-template:${template.key}`,
    label: template.label,
    shortDescription: template.shortDescription,
    params,
    example: template.example ?? command.example,
    ...(template.whatItDoes !== undefined
      ? { whatItDoes: template.whatItDoes }
      : command.whatItDoes !== undefined && { whatItDoes: command.whatItDoes }),
    aliases: template.aliases ?? command.aliases ?? [],
    isPopular: template.isPopular ?? command.isPopular ?? false,
  }
}

/**
 * Convert snake_case to Title Case for label fallback
 */
function snakeCaseToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
