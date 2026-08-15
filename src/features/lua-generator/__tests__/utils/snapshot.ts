/**
 * Snapshot Normalization Utility
 *
 * Normalizes Lua code for stable snapshot comparisons.
 * Handles common sources of snapshot churn.
 */

/**
 * Normalize Lua code for snapshot comparison.
 * - Converts line endings to \n
 * - Trims trailing whitespace
 * - Normalizes indentation (optional)
 * - Removes timestamps/version comments (optional)
 */
export function normalizeLuaForSnapshot(
  code: string,
  options: {
    /** Remove lines matching these patterns */
    removeLinePatterns?: RegExp[]
    /** Normalize indentation to spaces (default: true) */
    normalizeIndentation?: boolean
    /** Tab width for indentation normalization (default: 2) */
    tabWidth?: number
  } = {},
): string {
  const {
    removeLinePatterns = [],
    normalizeIndentation = true,
    tabWidth = 2,
  } = options

  // Normalize line endings
  const normalized = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split into lines for processing
  const lines = normalized.split('\n')

  const processedLines = lines
    .map((line) => {
      // Remove lines matching patterns
      for (const pattern of removeLinePatterns) {
        if (pattern.test(line)) {
          return null
        }
      }

      // Trim trailing whitespace
      let processed = line.trimEnd()

      // Normalize indentation
      if (normalizeIndentation) {
        processed = normalizeLineIndentation(processed, tabWidth)
      }

      return processed
    })
    .filter((line): line is string => line !== null)

  // Join and trim final newlines
  return processedLines.join('\n').replace(/\n+$/, '')
}

/**
 * Normalize a single line's indentation.
 * Converts tabs to spaces and ensures consistent indentation.
 */
function normalizeLineIndentation(line: string, tabWidth: number): string {
  if (line.length === 0) {
    return ''
  }

  // Count leading whitespace
  let leadingSpaces = 0
  let leadingTabs = 0

  for (const char of line) {
    if (char === ' ') {
      leadingSpaces++
    } else if (char === '\t') {
      leadingTabs++
    } else {
      break
    }
  }

  if (leadingSpaces === 0 && leadingTabs === 0) {
    return line
  }

  // Convert to consistent spaces
  const totalIndent = leadingSpaces + leadingTabs * tabWidth
  const content = line.slice(leadingSpaces + leadingTabs)
  return ' '.repeat(totalIndent) + content
}

/**
 * Default patterns to remove from snapshots.
 * Useful for removing timestamps, version numbers, etc.
 */
export const DEFAULT_REMOVE_PATTERNS = {
  /** Remove timestamp comments */
  timestamps: /--\s*Generated.*\d{4}/,
  /** Remove version comments */
  versions: /--\s*Version.*\d+\.\d+/,
  /** Remove UUIDs */
  uuids: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
}

/**
 * Create a snapshot-normalized version of Lua code with common patterns removed.
 */
export function createStableSnapshot(code: string): string {
  return normalizeLuaForSnapshot(code, {
    removeLinePatterns: [
      DEFAULT_REMOVE_PATTERNS.timestamps,
      DEFAULT_REMOVE_PATTERNS.versions,
    ],
    normalizeIndentation: true,
    tabWidth: 2,
  })
}
