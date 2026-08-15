export type RepositoryMetadataProvider = 'github-rest'

export type RepositoryAuthorSource = 'repo-owner' | 'curated'

export type RepositoryMetadataUnavailableReason =
  | 'not-publicly-available'
  | 'provider-does-not-support-field'
  | 'not-fetched'

export interface RepositoryMetadataUnavailableFields {
  readonly downloads?: RepositoryMetadataUnavailableReason | undefined
}

export interface RepositoryMetadataEntry {
  readonly repoSlug: string
  readonly repoUrl: string
  readonly owner: string
  readonly author: string
  readonly authorSource: RepositoryAuthorSource
  readonly authorNote?: string | undefined
  readonly name: string
  readonly description?: string | undefined
  readonly stars?: number | undefined
  readonly forks?: number | undefined
  readonly openIssues?: number | undefined
  readonly createdAt?: string | undefined
  readonly pushedAt?: string | undefined
  readonly providerUpdatedAt?: string | undefined
  readonly topics?: readonly string[] | undefined
  readonly homepage?: string | undefined
  readonly license?: string | undefined
  readonly fetchedAt: string
  readonly unavailable?: RepositoryMetadataUnavailableFields | undefined
}

export interface RepositoryMetadataSnapshot {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly provider: RepositoryMetadataProvider
  readonly repositories: readonly RepositoryMetadataEntry[]
}
