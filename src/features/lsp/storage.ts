/**
 * LSP Storage
 *
 * Functions for reading and writing LSP server configuration.
 */

import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import { EMPTY_LSP_CONFIG, type ProjectLspConfig } from '@/shared/types/lsp'

/**
 * Normalize a raw LSP config from disk.
 * - Deduplicates enabledServers (preserves first occurrence)
 * - Filters out empty/whitespace-only strings
 * - Sorts alphabetically for stable diffs
 */
export function normalizeLspConfig(raw: unknown): ProjectLspConfig {
  if (
    raw === null ||
    raw === undefined ||
    typeof raw !== 'object' ||
    !('enabledServers' in raw) ||
    !Array.isArray((raw as Record<string, unknown>)['enabledServers'])
  ) {
    return { ...EMPTY_LSP_CONFIG }
  }

  const rawServers = (raw as { enabledServers: unknown[] }).enabledServers
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const s of rawServers) {
    if (typeof s !== 'string') continue
    const trimmed = s.trim()
    if (trimmed === '') continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    deduped.push(trimmed)
  }

  deduped.sort()
  return { enabledServers: deduped }
}

export async function loadProjectLspConfig(
  projectPath: string,
): Promise<ProjectLspConfig> {
  const exists = await projectFileExists(projectPath, PROJECT_PATHS.LSP_SERVERS)
  if (!exists) {
    return { ...EMPTY_LSP_CONFIG }
  }
  const raw = await readProjectFile<unknown>(
    projectPath,
    PROJECT_PATHS.LSP_SERVERS,
  )
  return normalizeLspConfig(raw)
}

export async function saveProjectLspConfig(
  projectPath: string,
  config: ProjectLspConfig,
): Promise<void> {
  // Always normalize before writing to keep file clean
  const normalized = normalizeLspConfig(config)
  await writeProjectFile(projectPath, PROJECT_PATHS.LSP_SERVERS, normalized)
}
