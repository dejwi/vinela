import { parseRepositoryRef } from '@/shared/lib/repository-ref'
import type {
  RepositoryMetadataEntry,
  RepositoryMetadataProvider,
  RepositoryMetadataSnapshot,
} from '@/shared/types'

import repositoryMetadataSnapshotData from './repository-metadata.snapshot.json'

const repositoryMetadataSnapshot =
  repositoryMetadataSnapshotData as RepositoryMetadataSnapshot

const repositoryMetadataBySlug = new Map<string, RepositoryMetadataEntry>(
  repositoryMetadataSnapshot.repositories.map((entry) => [
    entry.repoSlug,
    entry,
  ]),
)

export function getRepositoryMetadata(
  repoRef: string,
): RepositoryMetadataEntry | undefined {
  const parsed = parseRepositoryRef(repoRef)
  if (!parsed.success) {
    return undefined
  }

  return repositoryMetadataBySlug.get(parsed.repoSlug)
}

export function getRepositoryMetadataSnapshotInfo(): {
  generatedAt: string
  provider: RepositoryMetadataProvider
} {
  return {
    generatedAt: repositoryMetadataSnapshot.generatedAt,
    provider: repositoryMetadataSnapshot.provider,
  }
}

export function getRepositoryMetadataEntries(): readonly RepositoryMetadataEntry[] {
  return repositoryMetadataSnapshot.repositories
}
