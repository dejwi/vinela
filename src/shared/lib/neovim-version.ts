// ============================================
// Neovim Version Normalization and Comparison
// ============================================

/** Vinela's application baseline — generated config targets Neovim 0.12+ APIs. */
export const MIN_SUPPORTED_NEOVIM_VERSION = '0.12.0'

export interface ParsedNeovimVersion {
  readonly major: number
  readonly minor: number
  readonly patch: number
  /** Numeric prefix without prerelease suffix, e.g. "0.12.0" */
  readonly normalized: string
}

/**
 * Parse a Neovim version string into numeric components.
 * Ignores prerelease suffixes for comparison (e.g. "0.12.0-dev+abc" → 0.12.0).
 * Returns null for malformed input.
 */
export function parseNeovimVersionNumeric(
  version: string,
): ParsedNeovimVersion | null {
  const trimmed = version.trim()
  if (trimmed.length === 0) {
    return null
  }

  const match = trimmed.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    return null
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  if (
    !Number.isFinite(major) ||
    !Number.isFinite(minor) ||
    !Number.isFinite(patch)
  ) {
    return null
  }

  return {
    major,
    minor,
    patch,
    normalized: `${major}.${minor}.${patch}`,
  }
}

/**
 * Compare two parsed Neovim versions.
 * Returns negative if a < b, zero if equal, positive if a > b.
 */
export function compareParsedNeovimVersions(
  a: ParsedNeovimVersion,
  b: ParsedNeovimVersion,
): number {
  if (a.major !== b.major) {
    return a.major - b.major
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor
  }
  return a.patch - b.patch
}

/**
 * Returns true when `version` is at or above the given baseline (prerelease ignored).
 */
export function isNeovimVersionAtLeast(
  version: string,
  baseline: string = MIN_SUPPORTED_NEOVIM_VERSION,
): boolean {
  const parsed = parseNeovimVersionNumeric(version)
  const baselineParsed = parseNeovimVersionNumeric(baseline)
  if (parsed === null || baselineParsed === null) {
    return false
  }
  return compareParsedNeovimVersions(parsed, baselineParsed) >= 0
}
