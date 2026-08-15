import { fetchJson } from '@/shared/lib/http'

// ============================================
// Types
// ============================================

export interface GitHubRepoInfo {
  /** Repository name, e.g. "telescope.nvim" */
  name: string
  /** Full name including owner, e.g. "nvim-telescope/telescope.nvim" */
  fullName: string
  /** Repository description (null if not set) */
  description: string | null
  /** Owner login, e.g. "nvim-telescope" */
  owner: string
  /** GitHub star count */
  stars: number
  /** Default branch, e.g. "main" or "master" */
  defaultBranch: string
  /** Homepage URL (null if not set) */
  homepage: string | null
  /** SPDX license identifier (null if not set) */
  license: string | null
  /** GitHub topics/tags */
  topics: string[]
}

export type FetchRepoInfoResult =
  | { success: true; info: GitHubRepoInfo }
  | {
      success: false
      reason: 'not-found' | 'rate-limited' | 'network-error'
      details?: string | undefined
    }

// ============================================
// Raw API response shape (internal)
// ============================================

interface RawGitHubRepo {
  name?: unknown
  full_name?: unknown
  description?: unknown
  owner?: { login?: unknown } | null
  stargazers_count?: unknown
  default_branch?: unknown
  homepage?: unknown
  license?: { spdx_id?: unknown } | null
  topics?: unknown
}

function isRawGitHubRepo(value: unknown): value is RawGitHubRepo {
  return typeof value === 'object' && value !== null
}

function parseRepoInfo(raw: RawGitHubRepo): GitHubRepoInfo {
  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    fullName: typeof raw.full_name === 'string' ? raw.full_name : '',
    description: typeof raw.description === 'string' ? raw.description : null,
    owner: typeof raw.owner?.login === 'string' ? raw.owner.login : '',
    stars: typeof raw.stargazers_count === 'number' ? raw.stargazers_count : 0,
    defaultBranch:
      typeof raw.default_branch === 'string' ? raw.default_branch : 'main',
    homepage:
      typeof raw.homepage === 'string' && raw.homepage.length > 0
        ? raw.homepage
        : null,
    license:
      typeof raw.license?.spdx_id === 'string' &&
      raw.license.spdx_id !== 'NOASSERTION'
        ? raw.license.spdx_id
        : null,
    topics: Array.isArray(raw.topics)
      ? raw.topics.filter((t): t is string => typeof t === 'string')
      : [],
  }
}

// ============================================
// Public API
// ============================================

/**
 * Fetch repository info from the GitHub REST API.
 *
 * Uses the public API (no auth required, 60 req/hour rate limit).
 * Maps HTTP errors to typed failure reasons:
 *   - 404 → 'not-found'
 *   - 403 → 'rate-limited'
 *   - network failure → 'network-error'
 */
export async function fetchGitHubRepoInfo(
  owner: string,
  repo: string,
): Promise<FetchRepoInfoResult> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const result = await fetchJson<unknown>(url)

  if (!result.success) {
    // Distinguish 404 / 403 from generic network errors
    if (result.error.includes('HTTP 404')) {
      return { success: false, reason: 'not-found', details: result.error }
    }
    if (result.error.includes('HTTP 403')) {
      return { success: false, reason: 'rate-limited', details: result.error }
    }
    return { success: false, reason: 'network-error', details: result.error }
  }

  if (!isRawGitHubRepo(result.data)) {
    return {
      success: false,
      reason: 'network-error',
      details: 'Unexpected response shape from GitHub API',
    }
  }

  return { success: true, info: parseRepoInfo(result.data) }
}
