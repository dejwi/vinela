/**
 * Colorscheme Section Generator
 *
 * Generates vim.cmd.colorscheme() call wrapped in pcall for safety.
 */

import { findCatalogEntry } from '@/features/colorschemes/utils'
import { APP_LOG_PREFIX } from '@/shared/lib/app-identity'
import type {
  ColorschemeSectionInput,
  LegacyGenerationDiagnostic,
  SectionResult,
} from '../types'

/**
 * Generate the colorscheme section.
 *
 * Uses pcall to prevent startup crash if the colorscheme plugin
 * fails to load or isn't installed yet.
 *
 * @param input - Colorscheme configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generateColorschemeSection(
  input: ColorschemeSectionInput,
): SectionResult {
  const { activeScheme } = input
  const diagnostics: LegacyGenerationDiagnostic[] = []

  // If no active scheme, return empty result
  if (activeScheme === null) {
    return {
      id: 'colorscheme',
      code: [],
      diagnostics: [],
    }
  }

  // Look up the catalog entry
  const catalogEntry = findCatalogEntry(activeScheme)

  if (!catalogEntry) {
    diagnostics.push({
      severity: 'warning',
      message: `Colorscheme '${activeScheme}' not found in catalog — skipping`,
      context: activeScheme,
    })
    return {
      id: 'colorscheme',
      code: [],
      diagnostics,
    }
  }

  // Check if vimColorscheme is defined
  const vimColorscheme = catalogEntry.vimColorscheme
  if (!vimColorscheme) {
    diagnostics.push({
      severity: 'error',
      message: `Colorscheme '${catalogEntry.name}' has no vim colorscheme name defined`,
      context: activeScheme,
    })
    return {
      id: 'colorscheme',
      code: [],
      diagnostics,
    }
  }

  const code: string[] = []

  code.push('-- Colorscheme')

  const activation = catalogEntry.activation
  if (activation?.background !== undefined) {
    code.push(`vim.o.background = "${activation.background}"`)
  }

  if (activation?.globals !== undefined) {
    for (const globalAssignment of activation.globals) {
      code.push(
        `vim.g["${escapeLuaGlobalName(globalAssignment.name)}"] = ${serializeLuaPrimitive(globalAssignment.value)}`,
      )
    }
  }

  // Emit colorscheme with pcall wrapper for safety
  code.push(
    `local ok, err = pcall(vim.cmd.colorscheme, "${escapeForLuaString(vimColorscheme)}")`,
  )
  code.push('if not ok then')
  code.push(
    `  vim.notify("${APP_LOG_PREFIX} Colorscheme '${escapeForLuaString(vimColorscheme)}' not found: " .. err, vim.log.levels.WARN)`,
  )
  code.push('end')

  return {
    id: 'colorscheme',
    code,
    diagnostics,
  }
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

/**
 * Escape a global name for use inside Lua bracket notation.
 */
function escapeLuaGlobalName(name: string): string {
  return name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

/**
 * Serialize a catalog primitive to a Lua literal.
 */
function serializeLuaPrimitive(value: string | number | boolean): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return `"${escapeForLuaString(value)}"`
}
