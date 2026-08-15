// Lua string escaping utilities

/**
 * Escape a string for use in Lua double-quoted string literals.
 *
 * Escaping rules:
 * - \\ -> \\
 * - " -> \"
 * - \n -> \n
 * - \r -> \r
 * - \t -> \t
 * - \0 -> \0
 * - Control chars (0x01-0x1F, 0x7F) -> decimal escape \ddd (3 digits)
 * - Printable non-ASCII remains as-is (UTF-8 preserved)
 *
 * @param value - The string to escape
 * @returns The escaped string (without surrounding quotes)
 */
export function escapeLuaString(value: string): string {
  let result = ''

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)

    // Handle common escapes first
    switch (code) {
      case 0x5c: // \
        result += '\\\\'
        break
      case 0x22: // "
        result += '\\"'
        break
      case 0x0a: // \n
        result += '\\n'
        break
      case 0x0d: // \r
        result += '\\r'
        break
      case 0x09: // \t
        result += '\\t'
        break
      case 0x00: // \0
        result += '\\0'
        break
      default:
        // Control characters (0x01-0x1F, 0x7F) get decimal escapes
        if ((code >= 0x01 && code <= 0x1f) || code === 0x7f) {
          // Pad to 3 digits
          const decimal = code.toString(10).padStart(3, '0')
          result += `\\${decimal}`
        } else {
          // Printable ASCII and all other characters (including UTF-8) remain as-is
          result += value.charAt(i)
        }
        break
    }
  }

  return result
}
