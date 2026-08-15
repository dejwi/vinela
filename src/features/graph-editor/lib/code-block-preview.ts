// Code Block preview generation utilities
// Shared between CodeBlockNode and CodeBlockPropertiesEditor

import { sanitizeLuaIdentifier } from '@/features/lua-generator'
import type { CodeBlockNodeData } from '@/shared/types'

/**
 * Normalize a port name for Lua by trimming whitespace and sanitizing
 * to a valid Lua identifier.
 *
 * This helper is used in both validation and preview generation to ensure
 * consistent behavior.
 *
 * @param name - The raw port name from user input
 * @returns The sanitized Lua identifier
 *
 * @example
 * normalizePortNameForLua("my-input") // returns "my_input"
 * normalizePortNameForLua("  value  ") // returns "value"
 * normalizePortNameForLua("") // returns "_unnamed"
 * normalizePortNameForLua("   ") // returns "_unnamed"
 */
export function normalizePortNameForLua(name: string): string {
  const trimmed = name.trim()
  return sanitizeLuaIdentifier(trimmed)
}

/**
 * Generate a simple structure preview showing the function wrapper
 *
 * Used in both the node card display and properties panel preview.
 * This ensures the preview stays consistent across the UI.
 */
export function generateStructurePreview(data: CodeBlockNodeData): string {
  const params = data.inputs
    .map((p) => normalizePortNameForLua(p.name))
    .join(', ')
  const code = data.code?.trim() || '-- your code here'
  return `local function(${params})\n  ${code.split('\n').join('\n  ')}\nend`
}
