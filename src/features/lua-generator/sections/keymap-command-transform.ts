import type { LegacyGenerationDiagnostic } from '@/features/lua-generator/types'
import { rawLua } from '@/features/lua-generator/utils/lua-serialize'

function transformKeymapCommandEntry(
  entry: unknown,
  optionKey: string,
  key: string,
  pluginName: string,
  diagnostics: LegacyGenerationDiagnostic[],
): unknown | undefined {
  if (typeof entry === 'string') {
    return entry
  }

  if (
    typeof entry === 'object' &&
    entry !== null &&
    'lua' in (entry as Record<string, unknown>)
  ) {
    const luaCode = (entry as { lua: string }).lua
    if (typeof luaCode === 'string' && luaCode.trim().length > 0) {
      return rawLua(luaCode)
    }

    diagnostics.push({
      severity: 'warning',
      message: `Plugin '${pluginName}': keymap "${optionKey}" key "${key}" has empty Lua entry — dropped`,
      context: optionKey,
    })
    return undefined
  }

  diagnostics.push({
    severity: 'warning',
    message: `Plugin '${pluginName}': keymap "${optionKey}" key "${key}" has malformed command entry (expected string or { lua: "..." }) — dropped`,
    context: optionKey,
  })
  return undefined
}

function transformKeymapCommandArray(
  value: unknown[],
  optionKey: string,
  key: string,
  pluginName: string,
  diagnostics: LegacyGenerationDiagnostic[],
): unknown[] | undefined {
  const commands: unknown[] = []
  for (const entry of value) {
    const transformed = transformKeymapCommandEntry(
      entry,
      optionKey,
      key,
      pluginName,
      diagnostics,
    )
    if (transformed !== undefined) {
      commands.push(transformed)
    }
  }

  if (commands.length > 0) {
    return commands
  }

  diagnostics.push({
    severity: 'warning',
    message: `Plugin '${pluginName}': keymap "${optionKey}" key "${key}" has no valid commands after filtering — key omitted from output`,
    context: optionKey,
  })
  return undefined
}

/**
 * Transform keymap command entries for Lua serialization.
 */
export function transformKeymapCommands(
  table: Record<string, unknown>,
  optionKey: string,
  pluginName: string,
  diagnostics: LegacyGenerationDiagnostic[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(table)) {
    if (key === 'preset') {
      result[key] = value
      continue
    }

    if (value === false) {
      result[key] = false
      continue
    }

    if (Array.isArray(value)) {
      const commands = transformKeymapCommandArray(
        value,
        optionKey,
        key,
        pluginName,
        diagnostics,
      )
      if (commands !== undefined) {
        result[key] = commands
      }
      continue
    }

    diagnostics.push({
      severity: 'warning',
      message: `Plugin '${pluginName}': keymap "${optionKey}" key "${key}" has unexpected value type "${typeof value}" — dropped`,
      context: optionKey,
    })
  }
  return result
}
