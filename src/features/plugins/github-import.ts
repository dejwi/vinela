import { PLUGIN_SCHEMA_FILENAME } from '@/shared/lib/app-identity'
import { fetchText } from '@/shared/lib/http'
import { parseRepositoryRef } from '@/shared/lib/repository-ref'
import { validateSchema } from '@/shared/lib/schema-validation'
import type { PluginSchema } from '@/shared/types'
import type { GitHubRepoInfo } from './github-api'

// ============================================
// URL Parsing
// ============================================

export type ParseGitHubUrlResult =
  | { success: true; owner: string; repo: string }
  | { success: false; error: string }

/**
 * Parse a GitHub URL into owner and repo components.
 *
 * Accepts:
 *   - https://github.com/owner/repo
 *   - http://github.com/owner/repo
 *   - github.com/owner/repo
 *   - Trailing slashes stripped
 *   - .git suffix stripped
 */
export function parseGitHubUrl(url: string): ParseGitHubUrlResult {
  const trimmed = url.trim()
  const normalizedHost = trimmed.replace(/^https?:\/\//i, '')

  if (
    trimmed.length > 0 &&
    (normalizedHost.includes('://') ||
      (normalizedHost.includes('.') &&
        !normalizedHost.toLowerCase().startsWith('github.com/')))
  ) {
    return {
      success: false,
      error: 'URL must be a GitHub repository (github.com/owner/repo)',
    }
  }

  const normalizedForImport = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git(?=\/|$)/i, '')
    .replace(/\/+$/, '')

  const normalizedParts = normalizedForImport.split('/').filter(Boolean)
  const candidateRef =
    normalizedParts.length >= 2
      ? `${normalizedParts[0]}/${normalizedParts[1]}`
      : trimmed

  const parsed = parseRepositoryRef(candidateRef)
  if (!parsed.success) {
    if (trimmed.length === 0) {
      return { success: false, error: 'URL cannot be empty' }
    }

    if (!url.toLowerCase().includes('github.com/') && !url.includes('/')) {
      return {
        success: false,
        error: 'URL must be a GitHub repository (github.com/owner/repo)',
      }
    }

    if (url.toLowerCase().includes('github.com/')) {
      return {
        success: false,
        error:
          'URL must include both owner and repository (github.com/owner/repo)',
      }
    }

    return { success: false, error: parsed.error }
  }

  return { success: true, owner: parsed.owner, repo: parsed.name }
}

// ============================================
// Schema File Fetching
// ============================================

/**
 * Construct the raw content URL for the vinela.schema.json file.
 */
export function getSchemaRawUrl(
  owner: string,
  repo: string,
  branch: string,
): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${PLUGIN_SCHEMA_FILENAME}`
}

export type FetchSchemaResult =
  | { success: true; schema: PluginSchema }
  | {
      success: false
      reason:
        | 'not-found'
        | 'invalid-json'
        | 'validation-failed'
        | 'network-error'
      details?: string | undefined
    }

/**
 * Attempt to fetch and validate the vinela.schema.json from a GitHub repo.
 *
 * Returns:
 *   - success: true + schema if found and valid
 *   - success: false + reason if not found, invalid JSON, or fails validation
 */
export async function fetchGitHubSchema(
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<FetchSchemaResult> {
  const url = getSchemaRawUrl(owner, repo, defaultBranch)
  const result = await fetchText(url)

  if (!result.success) {
    // 404 means no schema file present
    if (result.error.includes('HTTP 404')) {
      return { success: false, reason: 'not-found' }
    }
    return { success: false, reason: 'network-error', details: result.error }
  }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(result.data)
  } catch (err) {
    return {
      success: false,
      reason: 'invalid-json',
      details: err instanceof Error ? err.message : String(err),
    }
  }

  // Validate against schema spec
  const validation = validateSchema(parsed)
  if (!validation.valid) {
    const firstError =
      validation.errors[0]?.message ?? 'Unknown validation error'
    return {
      success: false,
      reason: 'validation-failed',
      details: firstError,
    }
  }

  return { success: true, schema: parsed as PluginSchema }
}

// ============================================
// Schema-less Plugin Generation
// ============================================

/**
 * Generate a minimal PluginSchema from GitHub API info (no config options).
 *
 * ID format: "github:<owner>/<repo>" — the bijective codec layer handles
 * encoding this to a filesystem-safe storage key when saving.
 */
export function createSchemalessPlugin(info: GitHubRepoInfo): PluginSchema {
  const schema: PluginSchema = {
    id: `github:${info.fullName}`,
    pluginName: info.name,
    pluginRepo: `https://github.com/${info.fullName}`,
    version: '0.0.0',
    author: info.owner,
    stars: info.stars,
    options: [],
    functions: [],
  }
  if (info.description !== null) {
    schema.description = info.description
  }
  if (info.topics.length > 0) {
    schema.tags = info.topics
  }
  return schema
}

// ============================================
// API Metadata Merging
// ============================================

/**
 * Merge live GitHub API metadata into an existing schema.
 *
 * Merge rules:
 *   - stars: always overridden by API (live data is fresher)
 *   - author: API fills gap only if schema doesn't have it
 *   - description: API fills gap only if schema doesn't have it
 *   - tags: API topics fill gap only if schema doesn't have tags
 */
export function mergeApiMetadata(
  schema: PluginSchema,
  info: GitHubRepoInfo,
): PluginSchema {
  const merged: PluginSchema = {
    ...schema,
    stars: info.stars,
    author: schema.author ?? info.owner,
  }

  // Fill description gap from API (only if schema doesn't have one)
  if (schema.description === undefined && info.description !== null) {
    merged.description = info.description
  }

  // Fill tags gap from topics (only if schema doesn't have tags)
  if (schema.tags === undefined && info.topics.length > 0) {
    merged.tags = info.topics
  }

  return merged
}
