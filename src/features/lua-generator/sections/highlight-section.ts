/**
 * Highlight Section Generator
 *
 * Generates highlight overrides using nvim_set_hl with merge semantics.
 * nvim_set_hl completely REPLACES the highlight definition, so we must
 * read the existing definition first and merge before setting.
 */

import type { HighlightOverride } from '@/shared/types'
import type {
  HighlightSectionInput,
  LegacyGenerationDiagnostic,
  SectionResult,
} from '../types'

/**
 * Generate the highlight overrides section.
 *
 * Uses a merge-before-emit pattern to avoid clearing existing attributes.
 *
 * @param input - Highlight configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generateHighlightSection(
  input: HighlightSectionInput,
): SectionResult {
  const { highlightOverrides } = input
  const diagnostics: LegacyGenerationDiagnostic[] = []

  // Filter to enabled overrides only
  const enabledOverrides = highlightOverrides.filter((o) => o.enabled)

  if (enabledOverrides.length === 0) {
    return {
      id: 'highlights',
      code: [],
      diagnostics: [],
    }
  }

  // Build the override table for each enabled highlight
  const overrides: Array<{ groupName: string; table: string }> = []

  for (const override of enabledOverrides) {
    // Skip if group name is empty
    if (!override.groupName.trim()) {
      diagnostics.push({
        severity: 'warning',
        message: `Highlight override with empty group name — skipping`,
      })
      continue
    }

    const table = buildOverrideTable(override)

    // Skip if no effective changes
    if (!table) {
      diagnostics.push({
        severity: 'info',
        message: `Highlight override for '${override.groupName}' has no effective changes — skipping`,
        context: override.groupName,
      })
      continue
    }

    overrides.push({ groupName: override.groupName, table })
  }

  if (overrides.length === 0) {
    return {
      id: 'highlights',
      code: [],
      diagnostics,
    }
  }

  // Sort overrides by group name for deterministic output
  overrides.sort((a, b) => a.groupName.localeCompare(b.groupName))

  const code: string[] = []

  // Emit merge helper function in a do block
  code.push('-- Highlight overrides')
  code.push('do')
  code.push('  local function set_hl_merged(group, overrides)')
  code.push(
    '    local existing = vim.api.nvim_get_hl(0, { name = group, link = false })',
  )
  code.push('    local merged = vim.tbl_extend("force", existing, overrides)')
  code.push('    vim.api.nvim_set_hl(0, group, merged)')
  code.push('  end')
  code.push('')

  // Emit each override call
  for (const { groupName, table } of overrides) {
    const escapedGroupName = escapeForLuaString(groupName)
    code.push(`  set_hl_merged("${escapedGroupName}", ${table})`)
  }

  code.push('end')

  return {
    id: 'highlights',
    code,
    diagnostics,
  }
}

/**
 * Build the Lua table string for a highlight override.
 *
 * If `link` is set, only the link field is included (Neovim ignores
 * other attributes when link is specified).
 *
 * @param override - The highlight override
 * @returns Lua table string, or null if no effective changes
 */
function buildOverrideTable(override: HighlightOverride): string | null {
  const fields: string[] = []

  // If link is set, it takes precedence
  if (override.link.trim()) {
    return `{ link = "${escapeForLuaString(override.link)}" }`
  }

  // Build the override table
  if (override.foreground.trim()) {
    fields.push(`fg = "${escapeForLuaString(override.foreground)}"`)
  }

  if (override.background.trim()) {
    fields.push(`bg = "${escapeForLuaString(override.background)}"`)
  }

  if (override.bold) {
    fields.push('bold = true')
  }

  if (override.italic) {
    fields.push('italic = true')
  }

  if (override.underline) {
    fields.push('underline = true')
  }

  if (override.strikethrough) {
    fields.push('strikethrough = true')
  }

  if (override.undercurl) {
    fields.push('undercurl = true')
  }

  if (fields.length === 0) {
    return null
  }

  return `{ ${fields.join(', ')} }`
}

/**
 * Escape a string for use in Lua double-quoted string.
 */
function escapeForLuaString(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Backslash first
    .replace(/"/g, '\\"') // Double quotes
    .replace(/\n/g, '\\n') // Newlines
    .replace(/\r/g, '\\r') // Carriage returns
}
