import { MEMORY_PROJECT_PREFIX, type MemoryPathValidation } from '../types'

/**
 * Validate a memory mode project path.
 * Enforces strict virtual path rules:
 * - Must start with MEMORY_PROJECT_PREFIX
 * - Must have at least one segment after prefix
 * - Cannot contain path traversal (..)
 * - Must be unique (not in existingPaths)
 */
export function validateMemoryPath(
  path: string,
  existingPaths: string[],
): MemoryPathValidation {
  const trimmed = path.trim()

  if (!trimmed) {
    return {
      valid: false,
      reason: 'empty',
      message: 'Path cannot be empty',
    }
  }

  // Normalize early for consistent checks
  const normalized = trimmed.replace(/\/+/g, '/').replace(/\/$/, '')

  if (!normalized.startsWith(MEMORY_PROJECT_PREFIX)) {
    return {
      valid: false,
      reason: 'missing_prefix',
      message: `Path must start with ${MEMORY_PROJECT_PREFIX}`,
    }
  }

  if (normalized.includes('..')) {
    return {
      valid: false,
      reason: 'path_traversal',
      message: 'Path cannot contain ".." (path traversal)',
    }
  }

  const afterPrefix = normalized.slice(MEMORY_PROJECT_PREFIX.length)
  if (!afterPrefix || afterPrefix === '/') {
    return {
      valid: false,
      reason: 'missing_prefix',
      message: 'Path must include a project name after the prefix',
    }
  }

  // Normalize existing paths for comparison
  const normalizedExisting = existingPaths.map((p) =>
    p.replace(/\/+/g, '/').replace(/\/$/, ''),
  )

  if (normalizedExisting.includes(normalized)) {
    return {
      valid: false,
      reason: 'duplicate',
      message: 'A project already exists at this path',
    }
  }

  return {
    valid: true,
    normalizedPath: normalized,
  }
}
