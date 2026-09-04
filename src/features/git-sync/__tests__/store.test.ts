import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitSnapshot } from '../types'

const client = vi.hoisted(() => ({
  commit: vi.fn(),
  fetch: vi.fn(),
  inspect: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  snapshot: vi.fn(),
  stage: vi.fn(),
}))

vi.mock('../git-client', () => ({
  DEFAULT_GIT_COMMIT_MESSAGE: 'Update Vinela project',
  MAX_GIT_COMMIT_MESSAGE_LENGTH: 200,
  commitGitChanges: client.commit,
  fetchGitRemote: client.fetch,
  inspectGitRepository: client.inspect,
  pullGitFastForward: client.pull,
  pushGitRemote: client.push,
  readGitSnapshot: client.snapshot,
  stageAllGitChanges: client.stage,
}))

import { useGitSyncStore } from '../store'

const clean: GitSnapshot = {
  headOid: 'one',
  branch: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  changedFiles: 0,
  conflictedFiles: 0,
}

const success = { success: true, stdout: '' } as const

describe('Git sync store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useGitSyncStore.getState().resetForProjectClose()
    client.inspect.mockResolvedValue({
      success: true,
      repository: true,
      snapshot: clean,
    })
    client.snapshot.mockResolvedValue({ success: true, snapshot: clean })
    client.fetch.mockResolvedValue(success)
    client.pull.mockResolvedValue(success)
    client.push.mockResolvedValue(success)
    client.stage.mockResolvedValue(success)
    client.commit.mockResolvedValue(success)
  })

  it('initializes locally without fetching', async () => {
    await useGitSyncStore.getState().initializeProject('/project')
    expect(useGitSyncStore.getState().repository).toEqual({
      status: 'ready',
      snapshot: clean,
    })
    expect(client.fetch).not.toHaveBeenCalled()
  })

  it('does not auto-sync conflicts or no-upstream repositories', async () => {
    await useGitSyncStore.getState().initializeProject('/project')
    useGitSyncStore.setState({
      repository: {
        status: 'ready',
        snapshot: { ...clean, conflictedFiles: 1 },
      },
    })
    await useGitSyncStore.getState().synchronizeOnOpen()
    useGitSyncStore.setState({
      repository: { status: 'ready', snapshot: { ...clean, upstream: null } },
    })
    await useGitSyncStore.getState().synchronizeOnOpen()
    expect(client.fetch).not.toHaveBeenCalled()
  })

  it('fast-forwards a clean behind repository on open', async () => {
    await useGitSyncStore.getState().initializeProject('/project')
    useGitSyncStore.setState({
      repository: { status: 'ready', snapshot: { ...clean, behind: 1 } },
    })
    client.snapshot
      .mockResolvedValueOnce({
        success: true,
        snapshot: { ...clean, behind: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: { ...clean, headOid: 'two' },
      })
    await expect(
      useGitSyncStore.getState().synchronizeOnOpen(),
    ).resolves.toEqual({ success: true, didPull: true })
    expect(client.fetch).toHaveBeenCalledBefore(client.pull as never)
  })

  it('claims commit before reading status and commits the default message', async () => {
    let resolveSnapshot: ((value: unknown) => void) | undefined
    client.snapshot.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve
        }),
    )
    await useGitSyncStore.getState().initializeProject('/project')
    const pending = useGitSyncStore.getState().commitAll('')
    expect(useGitSyncStore.getState().operation).toBe('committing')
    resolveSnapshot?.({
      success: true,
      snapshot: { ...clean, changedFiles: 1 },
    })
    await pending
    expect(client.commit).toHaveBeenCalledWith(
      '/project',
      'Update Vinela project',
    )
    expect(client.stage).toHaveBeenCalledBefore(client.commit as never)
  })

  it('does not push during commit and rejects concurrent operations', async () => {
    await useGitSyncStore.getState().initializeProject('/project')
    client.snapshot.mockResolvedValue({
      success: true,
      snapshot: { ...clean, changedFiles: 1 },
    })
    const commit = useGitSyncStore.getState().commitAll('message')
    await expect(useGitSyncStore.getState().synchronize()).resolves.toEqual({
      success: false,
      error: 'Another Git operation is already in progress.',
      didPull: false,
    })
    await commit
    expect(client.push).not.toHaveBeenCalled()
  })

  it('refreshes status and retains a manual pull failure', async () => {
    await useGitSyncStore.getState().initializeProject('/project')
    client.snapshot
      .mockResolvedValueOnce({
        success: true,
        snapshot: { ...clean, behind: 1 },
      })
      .mockResolvedValueOnce({
        success: true,
        snapshot: { ...clean, behind: 1 },
      })
      .mockResolvedValueOnce({ success: true, snapshot: clean })
    client.pull.mockResolvedValueOnce({ success: false, error: 'pull failed' })
    await expect(useGitSyncStore.getState().synchronize()).resolves.toEqual({
      success: false,
      error: 'pull failed',
      didPull: false,
    })
    expect(client.snapshot).toHaveBeenCalledTimes(3)
    expect(useGitSyncStore.getState().lastError).toBe('pull failed')
  })
})
