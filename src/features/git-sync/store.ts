import type { StoreApi, UseBoundStore } from 'zustand'
import { createStore } from '@/shared/lib/store'
import {
  commitGitChanges,
  DEFAULT_GIT_COMMIT_MESSAGE,
  fetchGitRemote,
  inspectGitRepository,
  MAX_GIT_COMMIT_MESSAGE_LENGTH,
  pullGitFastForward,
  pushGitRemote,
  readGitSnapshot,
  stageAllGitChanges,
} from './git-client'
import type {
  GitActionResult,
  GitOperation,
  GitRepositoryState,
  GitSnapshot,
} from './types'

export interface GitSyncState {
  projectPath: string | null
  repository: GitRepositoryState
  operation: GitOperation | null
  lastError: string | null
  initializeProject: (projectPath: string) => Promise<void>
  synchronizeOnOpen: () => Promise<GitActionResult>
  refresh: () => Promise<void>
  commitAll: (message: string) => Promise<GitActionResult>
  synchronize: () => Promise<GitActionResult>
  resetForProjectClose: () => void
}

interface GitOperationClaim {
  generation: number
  projectPath: string
}

let gitGeneration = 0
let refreshInFlight: { projectPath: string; promise: Promise<void> } | null =
  null

function owns(claim: GitOperationClaim): boolean {
  const state = useGitSyncStore.getState()
  return (
    gitGeneration === claim.generation &&
    state.projectPath === claim.projectPath
  )
}

function failure(error: string, didPull = false): GitActionResult {
  return { success: false, error, didPull }
}

function readySnapshot(): GitSnapshot | null {
  const repository = useGitSyncStore.getState().repository
  return repository.status === 'ready' ? repository.snapshot : null
}

function claim(operation: GitOperation): GitOperationClaim | null {
  const state = useGitSyncStore.getState()
  if (
    state.projectPath === null ||
    state.repository.status !== 'ready' ||
    state.operation !== null
  )
    return null
  const result = { generation: gitGeneration, projectPath: state.projectPath }
  useGitSyncStore.setState({ operation })
  return result
}

function setReady(
  claim: GitOperationClaim,
  snapshot: GitSnapshot,
  lastError: string | null,
): void {
  if (owns(claim))
    useGitSyncStore.setState({
      repository: { status: 'ready', snapshot },
      lastError,
    })
}

async function statusFor(
  claim: GitOperationClaim,
): Promise<GitSnapshot | null> {
  const result = await readGitSnapshot(claim.projectPath)
  if (!owns(claim)) return null
  if (!result.success) {
    useGitSyncStore.setState({
      repository: { status: 'error', message: result.error },
    })
    return null
  }
  setReady(claim, result.snapshot, useGitSyncStore.getState().lastError)
  return result.snapshot
}

function finish(claim: GitOperationClaim): void {
  if (owns(claim)) useGitSyncStore.setState({ operation: null })
}

export const useGitSyncStore: UseBoundStore<StoreApi<GitSyncState>> =
  createStore<GitSyncState>((set) => ({
    projectPath: null,
    repository: { status: 'inactive' },
    operation: null,
    lastError: null,

    initializeProject: async (projectPath) => {
      const generation = ++gitGeneration
      set({
        projectPath,
        repository: { status: 'checking' },
        operation: null,
        lastError: null,
      })
      const result = await inspectGitRepository(projectPath)
      if (
        generation !== gitGeneration ||
        useGitSyncStore.getState().projectPath !== projectPath
      )
        return
      if (!result.success)
        set({ repository: { status: 'error', message: result.error } })
      else if (!result.repository) set({ repository: { status: 'inactive' } })
      else set({ repository: { status: 'ready', snapshot: result.snapshot } })
    },

    refresh: async () => {
      const state = useGitSyncStore.getState()
      if (
        state.projectPath === null ||
        state.repository.status !== 'ready' ||
        state.operation !== null
      )
        return
      const inFlight = refreshInFlight
      if (inFlight?.projectPath === state.projectPath) return inFlight.promise
      const claim = {
        generation: gitGeneration,
        projectPath: state.projectPath,
      }
      const promise = (async (): Promise<void> => {
        await statusFor(claim)
      })()
      refreshInFlight = { projectPath: claim.projectPath, promise }
      try {
        await promise
      } finally {
        if (refreshInFlight?.promise === promise) refreshInFlight = null
      }
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: safe open synchronization must retain the ordered Git operation guards.
    synchronizeOnOpen: async () => {
      const current = readySnapshot()
      if (
        current === null ||
        current.conflictedFiles > 0 ||
        current.upstream === null
      )
        return { success: true, didPull: false }
      const operation = claim('fetching')
      if (operation === null)
        return failure('Another Git operation is already in progress.')
      let didPull = false
      try {
        const fetched = await fetchGitRemote(operation.projectPath)
        if (!owns(operation))
          return failure('Git operation was superseded.', didPull)
        if (!fetched.success) {
          setReady(operation, current, fetched.error)
          return failure(fetched.error, didPull)
        }
        const snapshot = await statusFor(operation)
        if (snapshot === null)
          return failure('Failed to read Git status.', didPull)
        if (
          snapshot.changedFiles === 0 &&
          snapshot.conflictedFiles === 0 &&
          snapshot.ahead === 0 &&
          snapshot.behind > 0
        ) {
          set({ operation: 'pulling' })
          const before = snapshot.headOid
          const pulled = await pullGitFastForward(operation.projectPath)
          if (!owns(operation))
            return failure('Git operation was superseded.', didPull)
          if (!pulled.success) {
            setReady(operation, snapshot, pulled.error)
            return failure(pulled.error, didPull)
          }
          const after = await statusFor(operation)
          if (after === null) return failure('Failed to read Git status.', true)
          didPull = after.headOid !== before
        }
        if (owns(operation)) set({ lastError: null })
        return { success: true, didPull }
      } finally {
        finish(operation)
      }
    },

    commitAll: async (message) => {
      const operation = claim('committing')
      if (operation === null)
        return failure('Another Git operation is already in progress.')
      try {
        const snapshot = await statusFor(operation)
        if (snapshot === null) return failure('Failed to read Git status.')
        if (snapshot.conflictedFiles > 0)
          return failure('Git conflicts must be resolved outside Vinela.')
        if (snapshot.changedFiles === 0)
          return failure('No Git changes to commit.')
        const trimmed = message.trim()
        if (trimmed.length > MAX_GIT_COMMIT_MESSAGE_LENGTH)
          return failure('Commit message must be 200 characters or fewer.')
        const commitMessage = trimmed || DEFAULT_GIT_COMMIT_MESSAGE
        const staged = await stageAllGitChanges(operation.projectPath)
        if (!staged.success) {
          await statusFor(operation)
          if (owns(operation)) set({ lastError: staged.error })
          return failure(staged.error)
        }
        const committed = await commitGitChanges(
          operation.projectPath,
          commitMessage,
        )
        if (!committed.success) {
          await statusFor(operation)
          if (owns(operation)) set({ lastError: committed.error })
          return failure(committed.error)
        }
        await statusFor(operation)
        if (owns(operation)) set({ lastError: null })
        return { success: true, didPull: false }
      } finally {
        finish(operation)
      }
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: manual synchronization encodes the approved non-destructive Git state machine.
    synchronize: async () => {
      const operation = claim('fetching')
      if (operation === null)
        return failure('Another Git operation is already in progress.')
      let didPull = false
      const blocked = (snapshot: GitSnapshot): boolean =>
        snapshot.conflictedFiles > 0 ||
        snapshot.changedFiles > 0 ||
        snapshot.branch === null ||
        snapshot.upstream === null ||
        (snapshot.ahead > 0 && snapshot.behind > 0)
      const runPull = async (
        before: GitSnapshot,
      ): Promise<GitActionResult | null> => {
        set({ operation: 'pulling' })
        const result = await pullGitFastForward(operation.projectPath)
        if (!result.success) {
          await statusFor(operation)
          if (owns(operation)) set({ lastError: result.error })
          return failure(result.error, didPull)
        }
        const after = await statusFor(operation)
        if (after === null) {
          didPull = true
          return failure('Failed to read Git status.', true)
        }
        didPull ||= after.headOid !== before.headOid
        return null
      }
      try {
        let snapshot = await statusFor(operation)
        if (snapshot === null) return failure('Failed to read Git status.')
        if (blocked(snapshot)) return { success: true, didPull }
        const fetched = await fetchGitRemote(operation.projectPath)
        if (!fetched.success) {
          await statusFor(operation)
          if (owns(operation)) set({ lastError: fetched.error })
          return failure(fetched.error, didPull)
        }
        snapshot = await statusFor(operation)
        if (snapshot === null)
          return failure('Failed to read Git status.', didPull)
        if (blocked(snapshot)) return { success: true, didPull }
        if (snapshot.behind > 0) {
          const result = await runPull(snapshot)
          if (result !== null) return result
        } else if (snapshot.ahead > 0) {
          set({ operation: 'pushing' })
          const pushed = await pushGitRemote(operation.projectPath)
          if (!pushed.success) {
            await statusFor(operation)
            if (owns(operation)) set({ lastError: pushed.error })
            return failure(pushed.error, didPull)
          }
          const afterPush = await statusFor(operation)
          if (afterPush === null)
            return failure('Failed to read Git status.', didPull)
          const result = await runPull(afterPush)
          if (result !== null) return result
        }
        if (owns(operation)) set({ lastError: null })
        return { success: true, didPull }
      } finally {
        finish(operation)
      }
    },

    resetForProjectClose: () => {
      gitGeneration += 1
      set({
        projectPath: null,
        repository: { status: 'inactive' },
        operation: null,
        lastError: null,
      })
    },
  }))
