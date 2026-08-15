import path from 'node:path'

const DEFAULT_RUNS_ROOT = path.resolve('temp/nvim-config-test/runs')
const DEFAULT_CACHE_ROOT = path.resolve('temp/nvim-config-test/cache')
const DEFAULT_LATEST_ROOT = path.resolve('temp/nvim-config-test/latest')
const DEFAULT_APP_DATA_ROOT = path.resolve('temp/nvim-config-test/app-data')
const DEFAULT_GENERATED_ROOT = path.resolve('temp/generated')

export interface RunPathSet {
  slug: string
  runId: string
  runDir: string
  latestDir: string
}

export function getDefaultRunsRoot(): string {
  return DEFAULT_RUNS_ROOT
}

export function getDefaultCacheRoot(): string {
  return DEFAULT_CACHE_ROOT
}

export function getDefaultLatestRoot(): string {
  return DEFAULT_LATEST_ROOT
}

export function getDefaultAppDataRoot(): string {
  return DEFAULT_APP_DATA_ROOT
}

export function getDefaultGeneratedOutDir(projectPath: string): string {
  return path.join(DEFAULT_GENERATED_ROOT, path.basename(projectPath))
}

export function slugifyPathSegment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : 'run'
}

export function sanitizeRunId(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return sanitized.length > 0 ? sanitized : 'run'
}

export function createRunId(now: Date = new Date()): string {
  const timestamp = now.toISOString().replace(/[.:]/g, '-').replace('T', '_').replace('Z', '')
  const random = Math.random().toString(36).slice(2, 8)
  return `${timestamp}-${random}`
}

export function createRunPathSet(slugSource: string, runId?: string): RunPathSet {
  const slug = slugifyPathSegment(path.basename(slugSource))
  const resolvedRunId = sanitizeRunId(runId ?? createRunId())

  return {
    slug,
    runId: resolvedRunId,
    runDir: path.join(DEFAULT_RUNS_ROOT, slug, resolvedRunId),
    latestDir: path.join(DEFAULT_LATEST_ROOT, slug),
  }
}

export function resolvePath(inputPath: string): string {
  return path.resolve(inputPath)
}
