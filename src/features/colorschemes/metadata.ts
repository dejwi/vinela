import { getRepositoryMetadata } from '@/metadata'
import { parseRepositoryRef } from '@/shared/lib/repository-ref'
import type {
  ColorSchemeCatalogEntry,
  RepositoryAuthorSource,
} from '@/shared/types'

export interface ResolvedColorSchemeMetadata {
  readonly repoSlug?: string | undefined
  readonly repoUrl: string
  readonly owner?: string | undefined
  readonly author?: string | undefined
  readonly authorSource?: RepositoryAuthorSource | undefined
  readonly stars?: number | undefined
  readonly createdAt?: string | undefined
  readonly pushedAt?: string | undefined
  readonly fetchedAt?: string | undefined
}

export function resolveColorSchemeMetadata(
  entry: ColorSchemeCatalogEntry,
): ResolvedColorSchemeMetadata {
  const snapshotEntry = getRepositoryMetadata(entry.pluginRepo)
  if (snapshotEntry !== undefined) {
    return {
      repoSlug: snapshotEntry.repoSlug,
      repoUrl: snapshotEntry.repoUrl,
      owner: snapshotEntry.owner,
      author: snapshotEntry.author,
      authorSource: snapshotEntry.authorSource,
      stars: snapshotEntry.stars,
      createdAt: snapshotEntry.createdAt,
      pushedAt: snapshotEntry.pushedAt,
      fetchedAt: snapshotEntry.fetchedAt,
    }
  }

  const parsed = parseRepositoryRef(entry.pluginRepo)
  return {
    repoSlug: parsed.success ? parsed.repoSlug : undefined,
    repoUrl: parsed.success ? parsed.repoUrl : entry.repoUrl,
  }
}
