// Indentation utilities for Lua code generation

export interface IndentTextOptions {
  /** The string to use for each indent level (default: '  ') */
  indentUnit?: string
  /** The number of indent levels to apply (default: 0) */
  level?: number
}

/**
 * Get the indent prefix for a given level.
 *
 * @param level - The indent level (must be non-negative)
 * @param indentUnit - The string to repeat for each level (default: '  ')
 * @returns The indent prefix string
 * @throws Error if level is negative
 */
export function getIndentPrefix(
  level: number,
  indentUnit: string = '  ',
): string {
  if (level < 0) {
    throw new Error(`Indent level cannot be negative: ${level}`)
  }
  return indentUnit.repeat(level)
}

/**
 * Indent multi-line text by adding a prefix to each line.
 *
 * Splits the input on line breaks, prefixes each line with the appropriate
 * indentation, and rejoins with the original line endings.
 *
 * @param text - The text to indent
 * @param options - Indentation options
 * @returns The indented text
 */
export function indentMultiline(
  text: string,
  options: IndentTextOptions = {},
): string {
  const { indentUnit = '  ', level = 0 } = options

  if (text.length === 0) {
    return ''
  }

  const prefix = getIndentPrefix(level, indentUnit)
  const lines = text.split(/\r?\n/)

  return lines.map((line) => (line.length > 0 ? prefix + line : '')).join('\n')
}
