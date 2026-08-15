import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseRepositoryRef } from '../src/shared/lib/repository-ref'
import type {
  RepositoryMetadataEntry,
  RepositoryMetadataProvider,
  RepositoryMetadataSnapshot,
} from '../src/shared/types'

const SNAPSHOT_PROVIDER: RepositoryMetadataProvider = 'github-rest'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const SCHEMAS_DIR = path.join(REPO_ROOT, 'src', 'schemas')
const COLORSCHEME_CATALOG_PATH = path.join(
  REPO_ROOT,
  'src',
  'colorschemes',
  'catalog.json',
)
const SNAPSHOT_PATH = path.join(
  REPO_ROOT,
  'src',
  'metadata',
  'repository-metadata.snapshot.json',
)

export interface CliOptions {
  readonly allowPartial: boolean
  readonly dryRun: boolean
}

export interface RefreshOutcome {
  readonly nextSnapshot: RepositoryMetadataSnapshot
  readonly fetchErrors: readonly string[]
  readonly missingRepoSlugs: readonly string[]
  readonly shouldWriteRuntimeSnapshot: boolean
  readonly completionMessage: string
}

interface RawSchemaRecord {
  readonly pluginRepo?: unknown
}

interface RawColorSchemeCatalogEntry {
  readonly pluginRepo?: unknown
  readonly repoUrl?: unknown
}

interface GitHubApiOwner {
  readonly login?: unknown
}

interface GitHubApiLicense {
  readonly spdx_id?: unknown
}

interface GitHubApiRepository {
  readonly full_name?: unknown
  readonly html_url?: unknown
  readonly name?: unknown
  readonly description?: unknown
  readonly owner?: GitHubApiOwner | null
  readonly stargazers_count?: unknown
  readonly forks_count?: unknown
  readonly open_issues_count?: unknown
  readonly created_at?: unknown
  readonly pushed_at?: unknown
  readonly updated_at?: unknown
  readonly topics?: unknown
  readonly homepage?: unknown
  readonly license?: GitHubApiLicense | null
}

type FetchRepositoryEntryResult =
  | { readonly success: true; readonly entry: RepositoryMetadataEntry }
  | { readonly success: false; readonly error: string }

interface DiffChange {
  readonly repoSlug: string
  readonly field: 'stars' | 'createdAt' | 'pushedAt'
  readonly before: string
  readonly after: string
}

export function parseCliOptions(argv: readonly string[]): CliOptions {
  return {
    allowPartial: argv.includes('--allow-partial'),
    dryRun: argv.includes('--dry-run'),
  }
}

function isGitHubApiRepository(value: unknown): value is GitHubApiRepository {
  return typeof value === 'object' && value !== null
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const fileContents = await readFile(filePath, 'utf8')
  return JSON.parse(fileContents) as T
}

function extractRepositoryRefsFromCatalog(
  catalog: readonly RawColorSchemeCatalogEntry[],
): string[] {
  const refs: string[] = []

  for (const entry of catalog) {
    if (typeof entry.pluginRepo === 'string' && entry.pluginRepo.length > 0) {
      refs.push(entry.pluginRepo)
      continue
    }

    if (typeof entry.repoUrl === 'string' && entry.repoUrl.length > 0) {
      refs.push(entry.repoUrl)
    }
  }

  return refs
}

async function readBundledRepositoryRefs(): Promise<readonly string[]> {
  const schemaFileNames = (await readdir(SCHEMAS_DIR))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))

  const refs: string[] = []
  for (const schemaFileName of schemaFileNames) {
    const schemaPath = path.join(SCHEMAS_DIR, schemaFileName)
    const schema = await readJsonFile<RawSchemaRecord>(schemaPath)
    if (typeof schema.pluginRepo === 'string' && schema.pluginRepo.length > 0) {
      refs.push(schema.pluginRepo)
    }
  }

  const catalog = await readJsonFile<readonly RawColorSchemeCatalogEntry[]>(
    COLORSCHEME_CATALOG_PATH,
  )

  refs.push(...extractRepositoryRefsFromCatalog(catalog))
  return refs
}

function normalizeBundledRepositoryRefs(
  refs: readonly string[],
): { readonly repoSlugs: readonly string[]; readonly errors: readonly string[] } {
  const normalized = new Set<string>()
  const errors: string[] = []

  for (const ref of refs) {
    const parsed = parseRepositoryRef(ref)
    if (!parsed.success) {
      errors.push(`${ref}: ${parsed.error}`)
      continue
    }

    normalized.add(parsed.repoSlug)
  }

  return {
    repoSlugs: Array.from(normalized).sort((left, right) =>
      left.localeCompare(right),
    ),
    errors,
  }
}

function getRequestHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'nvim-settings-repository-metadata-refresh',
  }

  const token = process.env['GITHUB_TOKEN']
  if (token !== undefined && token.trim().length > 0) {
    headers['Authorization'] = `Bearer ${token.trim()}`
  }

  return headers
}

function buildGitHubApiUrl(repoSlug: string): string {
  return `https://api.github.com/repos/${repoSlug}`
}

function buildGitHubFetchError(
  repoSlug: string,
  status: number,
  statusText: string,
): string {
  return `${repoSlug}: GitHub REST returned ${status} ${statusText}. If this may be rate limiting, retry with GITHUB_TOKEN=... bun run metadata:refresh`
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function readOptionalStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const strings = value.filter((item): item is string => typeof item === 'string')
  return strings.length > 0 ? strings : undefined
}

async function fetchRepositoryEntry(
  repoSlug: string,
): Promise<FetchRepositoryEntryResult> {
  let response: Response

  try {
    response = await fetch(buildGitHubApiUrl(repoSlug), {
      headers: getRequestHeaders(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `${repoSlug}: GitHub REST request failed (${message})`,
    }
  }

  if (!response.ok) {
    return {
      success: false,
      error: buildGitHubFetchError(repoSlug, response.status, response.statusText),
    }
  }

  const payload = (await response.json()) as unknown
  if (!isGitHubApiRepository(payload)) {
    return {
      success: false,
      error: `${repoSlug}: Unexpected GitHub API response shape`,
    }
  }

  return createRepositoryEntry(repoSlug, payload)
}

function createRepositoryEntry(
  repoSlug: string,
  payload: GitHubApiRepository,
): FetchRepositoryEntryResult {
  const owner = readOptionalString(payload.owner?.login)
  const fullName = readOptionalString(payload.full_name)
  const name = readOptionalString(payload.name)
  const fetchedAt = new Date().toISOString()

  if (owner === undefined || fullName === undefined || name === undefined) {
    return {
      success: false,
      error: `${repoSlug}: Missing required GitHub repository fields`,
    }
  }

  const parsed = parseRepositoryRef(fullName)
  if (!parsed.success) {
    return {
      success: false,
      error: `${repoSlug}: Could not normalize GitHub full_name (${parsed.error})`,
    }
  }

  const entry: RepositoryMetadataEntry = {
    repoSlug: parsed.repoSlug,
    repoUrl:
      readOptionalString(payload.html_url) ??
      `https://github.com/${parsed.repoSlug}`,
    owner,
    author: owner,
    authorSource: 'repo-owner',
    name,
    description: readOptionalString(payload.description),
    stars: readOptionalNumber(payload.stargazers_count),
    forks: readOptionalNumber(payload.forks_count),
    openIssues: readOptionalNumber(payload.open_issues_count),
    createdAt: readOptionalString(payload.created_at),
    pushedAt: readOptionalString(payload.pushed_at),
    providerUpdatedAt: readOptionalString(payload.updated_at),
    topics: readOptionalStringArray(payload.topics),
    homepage: readOptionalString(payload.homepage),
    license:
      readOptionalString(payload.license?.spdx_id) === 'NOASSERTION'
        ? undefined
        : readOptionalString(payload.license?.spdx_id),
    fetchedAt,
    unavailable: {
      downloads: 'not-publicly-available',
    },
  }

  return { success: true, entry }
}

async function loadExistingSnapshot(): Promise<RepositoryMetadataSnapshot> {
  try {
    return await readJsonFile<RepositoryMetadataSnapshot>(SNAPSHOT_PATH)
  } catch {
    return {
      schemaVersion: 1,
      generatedAt: '',
      provider: SNAPSHOT_PROVIDER,
      repositories: [],
    }
  }
}

function buildSnapshot(
  entries: readonly RepositoryMetadataEntry[],
): RepositoryMetadataSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: SNAPSHOT_PROVIDER,
    repositories: [...entries].sort((left, right) =>
      left.repoSlug.localeCompare(right.repoSlug),
    ),
  }
}

function buildEntryMap(
  entries: readonly RepositoryMetadataEntry[],
): ReadonlyMap<string, RepositoryMetadataEntry> {
  return new Map(entries.map((entry) => [entry.repoSlug, entry]))
}

function computeDiffChanges(
  previousEntries: readonly RepositoryMetadataEntry[],
  nextEntries: readonly RepositoryMetadataEntry[],
): readonly DiffChange[] {
  const previousBySlug = buildEntryMap(previousEntries)
  const changes: DiffChange[] = []

  for (const nextEntry of nextEntries) {
    const previousEntry = previousBySlug.get(nextEntry.repoSlug)
    if (previousEntry === undefined) {
      continue
    }

    for (const field of ['stars', 'createdAt', 'pushedAt'] as const) {
      const beforeValue = previousEntry[field]
      const afterValue = nextEntry[field]
      if (beforeValue !== afterValue) {
        changes.push({
          repoSlug: nextEntry.repoSlug,
          field,
          before: String(beforeValue ?? 'undefined'),
          after: String(afterValue ?? 'undefined'),
        })
      }
    }
  }

  return changes
}

function printDiffSummary(
  previousEntries: readonly RepositoryMetadataEntry[],
  nextEntries: readonly RepositoryMetadataEntry[],
): void {
  const previousBySlug = buildEntryMap(previousEntries)
  const nextBySlug = buildEntryMap(nextEntries)

  const added = nextEntries
    .filter((entry) => !previousBySlug.has(entry.repoSlug))
    .map((entry) => entry.repoSlug)
  const removed = previousEntries
    .filter((entry) => !nextBySlug.has(entry.repoSlug))
    .map((entry) => entry.repoSlug)
  const changes = computeDiffChanges(previousEntries, nextEntries)

  console.log(`Snapshot repositories: ${nextEntries.length}`)

  if (added.length > 0) {
    console.log(`Added repositories (${added.length}): ${added.join(', ')}`)
  }
  if (removed.length > 0) {
    console.log(`Removed repositories (${removed.length}): ${removed.join(', ')}`)
  }
  if (changes.length > 0) {
    console.log('Field changes:')
    for (const change of changes) {
      console.log(
        `  ${change.repoSlug} ${change.field}: ${change.before} -> ${change.after}`,
      )
    }
  }

  if (added.length === 0 && removed.length === 0 && changes.length === 0) {
    console.log('No added, removed, or tracked field changes detected.')
  }
}

function verifyCoverage(
  expectedRepoSlugs: readonly string[],
  snapshotEntries: readonly RepositoryMetadataEntry[],
): readonly string[] {
  const snapshotRepoSlugs = new Set(snapshotEntries.map((entry) => entry.repoSlug))
  return expectedRepoSlugs.filter((repoSlug) => !snapshotRepoSlugs.has(repoSlug))
}

function printFetchErrors(fetchErrors: readonly string[]): void {
  if (fetchErrors.length === 0) {
    return
  }

  console.log(`Fetch warnings (${fetchErrors.length}):`)
  for (const fetchError of fetchErrors) {
    console.log(`  ${fetchError}`)
  }
}

function printMissingRepoSlugs(missingRepoSlugs: readonly string[]): void {
  if (missingRepoSlugs.length === 0) {
    return
  }

  console.log(`Missing repositories (${missingRepoSlugs.length}): ${missingRepoSlugs.join(', ')}`)
}

export function evaluateRefreshOutcome(
  options: CliOptions,
  normalizedRepoSlugs: readonly string[],
  previousSnapshot: RepositoryMetadataSnapshot,
  entries: readonly RepositoryMetadataEntry[],
  fetchErrors: readonly string[],
): RefreshOutcome {
  const nextSnapshot = buildSnapshot(entries)
  const missingRepoSlugs = verifyCoverage(
    normalizedRepoSlugs,
    nextSnapshot.repositories,
  )

  if (options.dryRun) {
    if (fetchErrors.length > 0 && !options.allowPartial) {
      throw new Error(`Dry run failed during fetch:\n${fetchErrors.join('\n')}`)
    }

    if (missingRepoSlugs.length > 0 && !options.allowPartial) {
      throw new Error(
        `Dry run coverage failed. Missing repositories: ${missingRepoSlugs.join(', ')}`,
      )
    }

    printDiffSummary(previousSnapshot.repositories, nextSnapshot.repositories)
    printFetchErrors(fetchErrors)
    printMissingRepoSlugs(missingRepoSlugs)

    return {
      nextSnapshot,
      fetchErrors,
      missingRepoSlugs,
      shouldWriteRuntimeSnapshot: false,
      completionMessage:
        options.allowPartial
          ? 'Dry run with partial mode did not write the runtime snapshot.'
          : 'Dry run completed without writing the runtime snapshot.',
    }
  }

  if (options.allowPartial) {
    printDiffSummary(previousSnapshot.repositories, nextSnapshot.repositories)
    printFetchErrors(fetchErrors)
    printMissingRepoSlugs(missingRepoSlugs)

    return {
      nextSnapshot,
      fetchErrors,
      missingRepoSlugs,
      shouldWriteRuntimeSnapshot: false,
      completionMessage: 'Partial mode did not write the runtime snapshot.',
    }
  }

  if (fetchErrors.length > 0) {
    throw new Error(`Repository metadata refresh failed:\n${fetchErrors.join('\n')}`)
  }

  if (missingRepoSlugs.length > 0) {
    throw new Error(
      `Snapshot coverage incomplete. Missing repositories: ${missingRepoSlugs.join(', ')}`,
    )
  }

  printDiffSummary(previousSnapshot.repositories, nextSnapshot.repositories)

  return {
    nextSnapshot,
    fetchErrors,
    missingRepoSlugs,
    shouldWriteRuntimeSnapshot: true,
    completionMessage: 'Wrote snapshot to src/metadata/repository-metadata.snapshot.json',
  }
}

async function writeSnapshot(
  snapshot: RepositoryMetadataSnapshot,
): Promise<void> {
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const bundledRefs = await readBundledRepositoryRefs()
  const normalizedRefs = normalizeBundledRepositoryRefs(bundledRefs)
  const previousSnapshot = await loadExistingSnapshot()

  if (normalizedRefs.errors.length > 0) {
    throw new Error(`Malformed bundled repository refs:\n${normalizedRefs.errors.join('\n')}`)
  }

  const entries: RepositoryMetadataEntry[] = []
  const fetchErrors: string[] = []

  for (const repoSlug of normalizedRefs.repoSlugs) {
    console.log(`Fetching ${repoSlug}`)
    const result = await fetchRepositoryEntry(repoSlug)
    if (!result.success) {
      fetchErrors.push(result.error)
      continue
    }

    entries.push(result.entry)
  }

  const outcome = evaluateRefreshOutcome(
    options,
    normalizedRefs.repoSlugs,
    previousSnapshot,
    entries,
    fetchErrors,
  )

  if (outcome.shouldWriteRuntimeSnapshot) {
    await writeSnapshot(outcome.nextSnapshot)
  }

  console.log(outcome.completionMessage)
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  await main()
}
