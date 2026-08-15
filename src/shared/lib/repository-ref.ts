export type ParseRepositoryRefResult =
  | {
      readonly success: true
      readonly repoSlug: string
      readonly owner: string
      readonly name: string
      readonly repoUrl: string
    }
  | { readonly success: false; readonly error: string }

function normalizeRepositoryRefInput(repoRef: string): string {
  return repoRef.trim().replace(/[?#].*$/, '')
}

function sanitizeRepositorySegment(segment: string): string {
  return segment.trim().replace(/[^A-Za-z0-9_.-]/g, '')
}

function buildSuccess(owner: string, name: string): ParseRepositoryRefResult {
  const normalizedOwner = owner.toLowerCase()
  const normalizedName = name.toLowerCase()

  return {
    success: true,
    owner: normalizedOwner,
    name: normalizedName,
    repoSlug: `${normalizedOwner}/${normalizedName}`,
    repoUrl: `https://github.com/${normalizedOwner}/${normalizedName}`,
  }
}

export function parseRepositoryRef(repoRef: string): ParseRepositoryRefResult {
  const trimmed = normalizeRepositoryRefInput(repoRef)
  if (trimmed.length === 0) {
    return { success: false, error: 'Repository reference cannot be empty' }
  }

  const normalized = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')

  const parts = normalized.split('/').filter((part) => part.length > 0)
  if (parts.length !== 2) {
    return {
      success: false,
      error: 'Repository reference must be a GitHub owner/repo pair',
    }
  }

  const owner = sanitizeRepositorySegment(parts[0] ?? '')
  const name = sanitizeRepositorySegment(parts[1] ?? '')

  if (owner.length === 0) {
    return { success: false, error: 'Repository owner cannot be empty' }
  }

  if (name.length === 0) {
    return { success: false, error: 'Repository name cannot be empty' }
  }

  return buildSuccess(owner, name)
}

export function getRepoOwner(repoRef: string): string {
  const parsed = parseRepositoryRef(repoRef)
  if (parsed.success) {
    return parsed.owner
  }

  const fallbackCandidate = normalizeRepositoryRefInput(repoRef)
    .replace(/^https?:\/\//i, '')
    .split('/')
    .find((segment) => segment.length > 0)

  const sanitizedFallback = sanitizeRepositorySegment(fallbackCandidate ?? '')
  return sanitizedFallback.length > 0 ? sanitizedFallback : 'Unknown'
}
