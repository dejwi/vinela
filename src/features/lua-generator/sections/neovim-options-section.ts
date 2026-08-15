/**
 * Neovim Options Section Generator
 *
 * Generates vim.opt.* settings from user-configured options.
 * Only emits non-default values, grouped by category for readability.
 */

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getOptionDefinition,
  isDefaultValue,
  LEADER_KEY_OPTION_NAME,
} from '@/shared/lib/neovim-options/catalog'
import type { NeovimOptionStoredValue } from '@/shared/types'
import type {
  LegacyGenerationDiagnostic,
  NeovimOptionsSectionInput,
  SectionResult,
} from '../types'
import { escapeLuaString } from '../utils/lua-string'

/**
 * Generate the Neovim options section.
 *
 * Only emits options that differ from Neovim defaults.
 * Groups options by category with section comments.
 *
 * @param input - Options configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generateNeovimOptionsSection(
  input: NeovimOptionsSectionInput,
): SectionResult {
  const { options } = input
  const diagnostics: LegacyGenerationDiagnostic[] = []

  // Collect options to emit (non-default values only)
  const optionsToEmit: Array<{
    name: string
    value: NeovimOptionStoredValue
    category: string
  }> = []

  for (const [name, value] of Object.entries(options)) {
    // Skip the mapleader option - handled by leader-key section
    if (name === LEADER_KEY_OPTION_NAME) {
      continue
    }

    const definition = getOptionDefinition(name)

    if (!definition) {
      // Unknown option - emit warning but still include it
      diagnostics.push({
        severity: 'warning',
        message: `Option '${name}' is not in the known catalog — emitting as-is`,
        context: name,
      })
      optionsToEmit.push({
        name,
        value,
        category: 'unknown',
      })
      continue
    }

    // Compare against default
    if (isDefaultValue(definition, value)) {
      // Matches default - skip
      continue
    }

    optionsToEmit.push({
      name,
      value,
      category: definition.category,
    })
  }

  // If nothing to emit, return empty result
  if (optionsToEmit.length === 0) {
    diagnostics.push({
      severity: 'info',
      message: 'No Neovim options to emit (all at defaults)',
    })
    return {
      id: 'neovim-options',
      code: [],
      diagnostics,
    }
  }

  // Group by category
  const optionsByCategory = new Map<string, typeof optionsToEmit>()

  for (const option of optionsToEmit) {
    const existing = optionsByCategory.get(option.category) ?? []
    existing.push(option)
    optionsByCategory.set(option.category, existing)
  }

  // Build code output
  const code: string[] = []

  // Emit each category in order
  const categoriesToEmit: string[] = CATEGORY_ORDER.filter((cat) =>
    optionsByCategory.has(cat),
  )

  // Also include any unknown categories at the end
  if (optionsByCategory.has('unknown')) {
    categoriesToEmit.push('unknown')
  }

  for (const [categoryIndex, category] of categoriesToEmit.entries()) {
    const categoryOptions = optionsByCategory.get(category) ?? []

    if (categoryOptions.length === 0) continue

    // Sort options alphabetically within category
    categoryOptions.sort((a, b) => a.name.localeCompare(b.name))

    // Add blank line between categories (but not before first)
    if (categoryIndex > 0) {
      code.push('')
    }

    // Category header
    const categoryLabel =
      category === 'unknown'
        ? 'Other Options'
        : (CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ??
          category)
    code.push(`-- ${categoryLabel}`)

    // Emit each option
    for (const option of categoryOptions) {
      const luaLine = generateOptionLine(option.name, option.value)
      code.push(luaLine)
    }
  }

  return {
    id: 'neovim-options',
    code,
    diagnostics,
  }
}

/**
 * Generate a single vim.opt.* line for an option.
 */
function generateOptionLine(
  name: string,
  value: NeovimOptionStoredValue,
): string {
  const luaValue = serializeOptionValue(value)
  return `vim.opt.${name} = ${luaValue}`
}

/**
 * Serialize an option value to Lua syntax.
 */
function serializeOptionValue(value: NeovimOptionStoredValue): string {
  switch (value.valueType) {
    case 'boolean':
      return value.value ? 'true' : 'false'
    case 'number':
      return String(value.value)
    case 'string':
      return `"${escapeLuaString(value.value)}"`
    case 'string-list':
    case 'char-list': {
      if (value.value.length === 0) {
        return '{}'
      }
      const items = value.value.map((v) => `"${escapeLuaString(v)}"`)
      return `{ ${items.join(', ')} }`
    }
    default: {
      // Exhaustive check - should never reach here
      throw new Error(
        `Unknown value type: ${(value as { valueType: string }).valueType}`,
      )
    }
  }
}
