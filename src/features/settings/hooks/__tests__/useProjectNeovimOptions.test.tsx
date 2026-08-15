/**
 * useProjectNeovimOptions Hook Tests
 *
 * Real hook lifecycle tests using renderHook and storage mocks.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadedProject } from '@/shared/types'
import type { ProjectNeovimOptionsFile } from '@/shared/types/neovim-options'

// Mock the storage module
vi.mock('@/features/settings/storage/neovim-options', () => ({
  readNeovimOptions: vi.fn(),
  writeNeovimOptions: vi.fn(),
  writeLeaderKey: vi.fn(),
}))

import { useProjectStore } from '@/features/projects/store'
import * as storage from '@/features/settings/storage/neovim-options'
import { useProjectNeovimOptions } from '../useProjectNeovimOptions'

const mockReadNeovimOptions = vi.mocked(storage.readNeovimOptions)
const mockWriteNeovimOptions = vi.mocked(storage.writeNeovimOptions)
const mockWriteLeaderKey = vi.mocked(storage.writeLeaderKey)

// Helper to construct LoadedProject test objects
function makeLoadedProject(absolutePath: string, name: string): LoadedProject {
  return {
    id: 'test-id',
    absolutePath,
    name,
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
  }
}

// Helper to reset project store between tests
function resetProjectStore() {
  useProjectStore.setState({
    currentProject: null,
    recentProjects: [],
    isLoading: false,
    error: null,
    isTutorialProject: false,
  })
}

describe('useProjectNeovimOptions', () => {
  beforeEach(() => {
    resetProjectStore()
    vi.clearAllMocks()
  })

  describe('isLoading lifecycle', () => {
    it('shows isLoading true during load and false after resolve', async () => {
      // Create a deferred promise
      let resolveRead!: (value: ProjectNeovimOptionsFile | null) => void
      const deferredPromise = new Promise<ProjectNeovimOptionsFile | null>(
        (resolve) => {
          resolveRead = resolve
        },
      )
      mockReadNeovimOptions.mockReturnValue(deferredPromise)

      // Set up project
      const project = makeLoadedProject('/project-a', 'Project A')
      useProjectStore.setState({ currentProject: project })

      const { result } = renderHook(() => useProjectNeovimOptions())

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      act(() => {
        resolveRead({ version: 1, options: {}, updatedAt: Date.now() })
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('leader key defaulting', () => {
    it('resets leader key to default when loaded file has no leaderKey', async () => {
      mockReadNeovimOptions.mockResolvedValue({
        version: 1,
        options: {},
        updatedAt: Date.now(),
        // leaderKey is undefined
      })

      const project = makeLoadedProject('/project-a', 'Project A')
      useProjectStore.setState({ currentProject: project })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Default leader key is Space
      expect(result.current.leaderKey).toBe(' ')
      expect(result.current.isLeaderKeyModified).toBe(false)
    })

    it('loads explicit leader key when present', async () => {
      mockReadNeovimOptions.mockResolvedValue({
        version: 1,
        options: {},
        leaderKey: '\\',
        updatedAt: Date.now(),
      })

      const project = makeLoadedProject('/project-a', 'Project A')
      useProjectStore.setState({ currentProject: project })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.leaderKey).toBe('\\')
      expect(result.current.isLeaderKeyModified).toBe(true)
    })
  })

  describe('project switch behavior', () => {
    it('resets leader and values when switching projects', async () => {
      // Project A has custom leader
      mockReadNeovimOptions.mockImplementation(async (path) => {
        if (path === '/project-a') {
          return {
            version: 1,
            options: { number: { valueType: 'boolean', value: true } },
            leaderKey: '\\',
            updatedAt: Date.now(),
          }
        }
        // Project B has no leader (should default)
        return {
          version: 1,
          options: {},
          updatedAt: Date.now(),
        }
      })

      // Start with project A
      useProjectStore.setState({
        currentProject: makeLoadedProject('/project-a', 'Project A'),
      })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.leaderKey).toBe('\\')
      expect(result.current.isModifiedFromDefault('number')).toBe(true)

      // Switch to project B
      act(() => {
        useProjectStore.setState({
          currentProject: makeLoadedProject('/project-b', 'Project B'),
        })
      })

      // Wait for new data to load
      await waitFor(() => {
        expect(result.current.leaderKey).toBe(' ')
      })

      expect(result.current.isLeaderKeyModified).toBe(false)
    })
  })

  describe('write + revert behavior', () => {
    it('reverts option update on write failure', async () => {
      mockReadNeovimOptions.mockResolvedValue({
        version: 1,
        options: {},
        updatedAt: Date.now(),
      })

      mockWriteNeovimOptions.mockResolvedValue({
        success: false,
        error: 'Disk write failed',
      })

      const project = makeLoadedProject('/project-a', 'Project A')
      useProjectStore.setState({ currentProject: project })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Initially not modified
      expect(result.current.isModifiedFromDefault('number')).toBe(false)

      // Try to update (should fail and revert)
      await expect(
        act(async () => {
          await result.current.updateOption('number', {
            valueType: 'boolean',
            value: true,
          })
        }),
      ).rejects.toThrow('Disk write failed')

      // Should be reverted to unmodified state
      expect(result.current.isModifiedFromDefault('number')).toBe(false)
    })

    it('reverts leader key on write failure', async () => {
      mockReadNeovimOptions.mockResolvedValue({
        version: 1,
        options: {},
        updatedAt: Date.now(),
      })

      mockWriteLeaderKey.mockResolvedValue({
        success: false,
        error: 'Disk write failed',
      })

      const project = makeLoadedProject('/project-a', 'Project A')
      useProjectStore.setState({ currentProject: project })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Initially default leader
      expect(result.current.leaderKey).toBe(' ')

      // Try to update leader (should fail and revert)
      await expect(
        act(async () => {
          await result.current.updateLeaderKey('\\')
        }),
      ).rejects.toThrow('Disk write failed')

      // Should be reverted to default
      expect(result.current.leaderKey).toBe(' ')
    })
  })

  describe('no-project reset behavior', () => {
    it('clears all state when project transitions to null', async () => {
      mockReadNeovimOptions.mockResolvedValue({
        version: 1,
        options: { number: { valueType: 'boolean', value: true } },
        leaderKey: '\\',
        updatedAt: Date.now(),
      })

      // Start with a project
      useProjectStore.setState({
        currentProject: makeLoadedProject('/project-a', 'Project A'),
      })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify loaded state
      expect(result.current.leaderKey).toBe('\\')
      expect(result.current.isModifiedFromDefault('number')).toBe(true)
      expect(result.current.error).toBeNull()

      // Close project (set to null)
      act(() => {
        useProjectStore.setState({ currentProject: null })
      })

      // State should be cleared
      expect(result.current.leaderKey).toBe(' ')
      expect(result.current.isLeaderKeyModified).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.modifiedCount).toBe(0)
    })
  })

  describe('mutation context race guards', () => {
    it('project switch resets state correctly', async () => {
      // This test verifies that the MutationContextTracker prevents stale reverts
      // when switching between projects

      // Mock reads with different data for each project
      mockReadNeovimOptions.mockImplementation(async (path: string) => {
        if (path === '/project-a') {
          return {
            version: 1,
            options: { number: { valueType: 'boolean' as const, value: true } },
            leaderKey: '\\',
            updatedAt: Date.now(),
          }
        }
        // project-b
        return {
          version: 1,
          options: {
            relativenumber: { valueType: 'boolean' as const, value: false },
          },
          leaderKey: '<Tab>',
          updatedAt: Date.now(),
        }
      })

      // Start with project A
      useProjectStore.setState({
        currentProject: makeLoadedProject('/project-a', 'Project A'),
      })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Project A should have its values
      expect(result.current.isModifiedFromDefault('number')).toBe(true)
      expect(result.current.leaderKey).toBe('\\')

      // Now switch to project B
      act(() => {
        useProjectStore.setState({
          currentProject: makeLoadedProject('/project-b', 'Project B'),
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Project B should have its own loaded values
      expect(result.current.getOptionValue('relativenumber')).toEqual({
        valueType: 'boolean',
        value: false,
      })
      expect(result.current.isModifiedFromDefault('relativenumber')).toBe(false)
      expect(result.current.leaderKey).toBe('<Tab>')
      expect(result.current.isLeaderKeyModified).toBe(true)
    })

    it('revert only affects current project', async () => {
      type WriteResult = Awaited<ReturnType<typeof storage.writeNeovimOptions>>

      // Create deferred write so project switch happens before failure resolves
      let resolveWrite!: (result: WriteResult) => void
      const deferredWrite = new Promise<WriteResult>((resolve) => {
        resolveWrite = resolve
      })

      mockWriteNeovimOptions.mockReturnValue(deferredWrite)

      mockReadNeovimOptions.mockImplementation(async (path: string) => {
        if (path === '/project-a') {
          return {
            version: 1,
            options: {},
            updatedAt: Date.now(),
          }
        }

        return {
          version: 1,
          options: {
            relativenumber: { valueType: 'boolean' as const, value: true },
          },
          leaderKey: '<Tab>',
          updatedAt: Date.now(),
        }
      })

      // Start with project A
      useProjectStore.setState({
        currentProject: makeLoadedProject('/project-a', 'Project A'),
      })

      const { result } = renderHook(() => useProjectNeovimOptions())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Kick off update on project A (optimistic local update)
      let pendingUpdate!: Promise<void>
      act(() => {
        pendingUpdate = result.current.updateOption('number', {
          valueType: 'boolean',
          value: true,
        })
      })

      // Switch to project B before write failure resolves
      act(() => {
        useProjectStore.setState({
          currentProject: makeLoadedProject('/project-b', 'Project B'),
        })
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Confirm project B state loaded
      expect(result.current.getOptionValue('relativenumber')).toEqual({
        valueType: 'boolean',
        value: true,
      })
      expect(result.current.leaderKey).toBe('<Tab>')

      // Resolve stale write failure from project A
      act(() => {
        resolveWrite({ success: false, error: 'Disk write failed' })
      })

      await expect(pendingUpdate).rejects.toThrow('Disk write failed')

      // Stale revert must not clobber project B state
      expect(result.current.getOptionValue('relativenumber')).toEqual({
        valueType: 'boolean',
        value: true,
      })
      expect(result.current.leaderKey).toBe('<Tab>')
      expect(result.current.isModifiedFromDefault('number')).toBe(false)

      expect(mockWriteNeovimOptions).toHaveBeenCalledWith('/project-a', {
        number: { valueType: 'boolean', value: true },
      })
    })
  })
})
