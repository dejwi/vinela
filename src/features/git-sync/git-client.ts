import { Command } from '@tauri-apps/plugin-shell'
import { projectFileExists } from '@/shared/lib/storage-api'
import { isBrowserOnlyRuntime } from '@/shared/lib/tauri-runtime'
import type {
  GitCommandResult,
  GitInspectResult,
  GitSnapshot,
  GitSnapshotResult,
} from './types'

export const DEFAULT_GIT_COMMIT_MESSAGE = 'Update Vinela project'
export const MAX_GIT_COMMIT_MESSAGE_LENGTH = 200

type GitAlias =
  | 'git-project-root'
  | 'git-status'
  | 'git-fetch'
  | 'git-pull-ff-only'
  | 'git-add-all'
  | 'git-commit'
  | 'git-push'

const GIT_ENV = { GIT_TERMINAL_PROMPT: '0' }

function errorFromOutput(stdout: string, stderr: string): string {
  return stderr.trim() || stdout.trim() || 'Git command failed.'
}

async function runGit(
  projectPath: string,
  alias: GitAlias,
  args: string[] = [],
): Promise<GitCommandResult> {
  try {
    const output = await Command.create(alias, args, {
      cwd: projectPath,
      env: GIT_ENV,
    }).execute()
    if (output.code === 0) return { success: true, stdout: output.stdout }
    return {
      success: false,
      error: errorFromOutput(output.stdout, output.stderr),
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Git command failed.',
    }
  }
}

function numberValue(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseGitSnapshot(stdout: string): GitSnapshot {
  let headOid: string | null = null
  let branch: string | null = null
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  let changedFiles = 0
  let conflictedFiles = 0
  for (const line of stdout.split('\n')) {
    if (line.startsWith('# branch.oid ')) {
      const value = line.slice('# branch.oid '.length)
      headOid = value === '(initial)' ? null : value
    } else if (line.startsWith('# branch.head ')) {
      const value = line.slice('# branch.head '.length)
      branch = value === '(detached)' ? null : value
    } else if (line.startsWith('# branch.upstream ')) {
      upstream = line.slice('# branch.upstream '.length) || null
    } else if (line.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line)
      ahead = numberValue(match?.[1])
      behind = numberValue(match?.[2])
    } else if (/^(1 |2 |u |\? )/.test(line)) {
      changedFiles += 1
      if (line.startsWith('u ')) conflictedFiles += 1
    }
  }
  return {
    headOid,
    branch,
    upstream,
    ahead,
    behind,
    changedFiles,
    conflictedFiles,
  }
}

export async function readGitSnapshot(
  projectPath: string,
): Promise<GitSnapshotResult> {
  const result = await runGit(projectPath, 'git-status', [
    '--no-optional-locks',
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
  ])
  return result.success
    ? { success: true, snapshot: parseGitSnapshot(result.stdout) }
    : result
}

export async function inspectGitRepository(
  projectPath: string,
): Promise<GitInspectResult> {
  if (isBrowserOnlyRuntime() || projectPath.startsWith('/memory/')) {
    return { success: true, repository: false }
  }
  let hasGitDirectory: boolean
  try {
    hasGitDirectory = await projectFileExists(projectPath, '.git')
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to inspect Git repository.',
    }
  }
  if (!hasGitDirectory) {
    return { success: true, repository: false }
  }
  const root = await runGit(projectPath, 'git-project-root', [
    'rev-parse',
    '--show-prefix',
  ])
  if (!root.success) return root
  if (root.stdout.trim() !== '') return { success: true, repository: false }
  const snapshot = await readGitSnapshot(projectPath)
  return snapshot.success
    ? { success: true, repository: true, snapshot: snapshot.snapshot }
    : snapshot
}

export async function fetchGitRemote(
  projectPath: string,
): Promise<GitCommandResult> {
  return runGit(projectPath, 'git-fetch', ['fetch', '--quiet'])
}

export async function pullGitFastForward(
  projectPath: string,
): Promise<GitCommandResult> {
  return runGit(projectPath, 'git-pull-ff-only', [
    'pull',
    '--quiet',
    '--ff-only',
  ])
}

export async function stageAllGitChanges(
  projectPath: string,
): Promise<GitCommandResult> {
  return runGit(projectPath, 'git-add-all', ['add', '--all'])
}

export async function commitGitChanges(
  projectPath: string,
  message: string,
): Promise<GitCommandResult> {
  return runGit(projectPath, 'git-commit', ['commit', '--message', message])
}

export async function pushGitRemote(
  projectPath: string,
): Promise<GitCommandResult> {
  return runGit(projectPath, 'git-push', ['push', '--quiet'])
}
