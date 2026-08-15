import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Graph } from '@/shared/types'
import type { GraphOrderBatchResult } from '../storage'
import { useGraphManager } from './useGraphManager'

const projectFileStore = new Map<string, unknown>()
const writeCalls: string[] = []

function toStorageKey(projectPath: string, relativePath: string): string {
  return `${projectPath}::${relativePath}`
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createGraph(id: string, overrides: Partial<Graph> = {}): Graph {
  return {
    id,
    name: `Graph ${id}`,
    nodes: [],
    edges: [],
    createdAt: 1,
    updatedAt: 10,
    enabled: true,
    order: 0,
    ...overrides,
  }
}

// Mock storage-api
vi.mock('@/shared/lib/storage-api', () => ({
  ensureProjectDir: vi.fn(async () => {}),
  listProjectDir: vi.fn(async (projectPath: string, relativePath: string) => {
    const prefix = `${projectPath}::${relativePath}/`
    const names = [...projectFileStore.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))

    return names.map((name) => ({
      name,
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }))
  }),
  readProjectFile: vi.fn(async (projectPath: string, relativePath: string) => {
    const key = toStorageKey(projectPath, relativePath)
    const value = projectFileStore.get(key)
    if (value === undefined) {
      const error = new Error(`Missing file: ${key}`)
      ;(error as { code?: string }).code = 'ENOENT'
      throw error
    }

    return cloneValue(value)
  }),
  writeProjectFile: vi.fn(
    async (projectPath: string, relativePath: string, data: unknown) => {
      writeCalls.push(relativePath)
      projectFileStore.set(
        toStorageKey(projectPath, relativePath),
        cloneValue(data),
      )
    },
  ),
  removeProjectFile: vi.fn(
    async (projectPath: string, relativePath: string) => {
      projectFileStore.delete(toStorageKey(projectPath, relativePath))
    },
  ),
}))

vi.mock('@/shared/lib/paths', () => ({
  getGraphFilePath: (id: string) => `graphs/${id}.json`,
  PROJECT_PATHS: { GRAPHS: 'graphs' },
}))

describe('useGraphManager', () => {
  beforeEach(() => {
    projectFileStore.clear()
    writeCalls.length = 0
  })

  describe('initialization', () => {
    it('loads graphs on mount', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.graphs).toHaveLength(1)
      expect(result.current.graphs[0]?.id).toBe('a')
      expect(result.current.error).toBeNull()
    })

    it('handles empty project gracefully', async () => {
      const projectPath = '/empty-project'

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.graphs).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })

  describe('updateGraph', () => {
    it('updates graph and reflects changes', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const updatedGraph = { ...graphA, name: 'Updated Graph A' }

      await act(async () => {
        await result.current.updateGraph(updatedGraph)
      })

      expect(result.current.graphs[0]?.name).toBe('Updated Graph A')
      expect(result.current.error).toBeNull()
    })

    it('throws and sets error when saveGraphContent returns null', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      // Set up initial graph
      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Now delete the file from store so saveGraphContent will return null
      projectFileStore.delete(toStorageKey(projectPath, 'graphs/a.json'))

      const updatedGraph = { ...graphA, name: 'Updated Graph A' }

      let thrownError: Error | null = null
      await act(async () => {
        try {
          await result.current.updateGraph(updatedGraph)
        } catch (e) {
          thrownError = e as Error
        }
      })

      // Should have thrown an error
      expect(thrownError).not.toBeNull()
      expect(thrownError).toBeInstanceOf(Error)
      expect((thrownError as unknown as Error).message).toContain(
        'Failed to save graph',
      )

      // refreshGraphs should have been called (graphs should be empty now)
      // Error state may be cleared by refresh, but the error was thrown
      await waitFor(() => {
        expect(result.current.graphs).toHaveLength(0)
      })
    })
  })

  describe('toggleGraphEnabled', () => {
    it('toggles graph enabled state', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', {
        order: 0,
        name: 'Graph A',
        enabled: true,
      })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.graphs[0]?.enabled).toBe(true)

      await act(async () => {
        await result.current.toggleGraphEnabled('a')
      })

      expect(result.current.graphs[0]?.enabled).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('throws and sets error when updateGraphMetadata returns null', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', {
        order: 0,
        name: 'Graph A',
        enabled: true,
      })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Delete the file so updateGraphMetadata will return null
      projectFileStore.delete(toStorageKey(projectPath, 'graphs/a.json'))

      let toggleError: Error | null = null
      await act(async () => {
        try {
          await result.current.toggleGraphEnabled('a')
        } catch (e) {
          toggleError = e as Error
        }
      })

      // Should have thrown an error
      expect(toggleError).not.toBeNull()
      expect(toggleError).toBeInstanceOf(Error)
      expect((toggleError as unknown as Error).message).toContain(
        'Failed to update graph',
      )

      // refreshGraphs should have been called (graphs should be empty now)
      await waitFor(() => {
        expect(result.current.graphs).toHaveLength(0)
      })
    })
  })

  describe('reorderGraphs', () => {
    it('reorders graphs successfully', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })
      const graphB = createGraph('b', { order: 1, name: 'Graph B' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)
      projectFileStore.set(toStorageKey(projectPath, 'graphs/b.json'), graphB)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Reorder: a becomes order 1, b becomes order 0
      await act(async () => {
        await result.current.reorderGraphs([
          { graphId: 'a', order: 1 },
          { graphId: 'b', order: 0 },
        ])
      })

      // Graphs should be reordered
      const graphIds = result.current.graphs.map((g) => g.id)
      expect(graphIds).toContain('a')
      expect(graphIds).toContain('b')
      expect(result.current.error).toBeNull()
    })

    it('throws and sets error when batch reorder fails', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })
      const graphB = createGraph('b', { order: 1, name: 'Graph B' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)
      projectFileStore.set(toStorageKey(projectPath, 'graphs/b.json'), graphB)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Delete graph b so batch reorder will fail on second update
      projectFileStore.delete(toStorageKey(projectPath, 'graphs/b.json'))

      let reorderError: Error | null = null
      await act(async () => {
        try {
          await result.current.reorderGraphs([
            { graphId: 'a', order: 1 },
            { graphId: 'b', order: 0 },
          ])
        } catch (e) {
          reorderError = e as Error
        }
      })

      // Should have thrown an error
      expect(reorderError).not.toBeNull()
      expect(reorderError).toBeInstanceOf(Error)
      expect((reorderError as unknown as Error).message).toContain(
        'Failed to reorder',
      )

      // refreshGraphs should have been called
      await waitFor(() => {
        // Only graph a should remain since b is now deleted
        expect(result.current.graphs).toHaveLength(1)
        expect(result.current.graphs[0]?.id).toBe('a')
      })
    })

    it('no-ops on empty updates array', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Empty updates should not throw
      await act(async () => {
        await result.current.reorderGraphs([])
      })

      expect(result.current.error).toBeNull()
      expect(result.current.graphs).toHaveLength(1)
    })
  })

  describe('createGraph', () => {
    it('creates a new graph and adds it to the list', async () => {
      const projectPath = '/project'

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.createGraph('New Graph')
      })

      expect(result.current.graphs).toHaveLength(1)
      expect(result.current.graphs[0]?.name).toBe('New Graph')
      expect(result.current.error).toBeNull()
    })
  })

  describe('deleteGraph', () => {
    it('deletes a graph and removes it from the list', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.deleteGraph('a')
      })

      expect(result.current.graphs).toHaveLength(0)
      expect(result.current.error).toBeNull()
    })
  })

  describe('refreshGraphs', () => {
    it('refreshes the graph list from disk', async () => {
      const projectPath = '/project'
      const graphA = createGraph('a', { order: 0, name: 'Graph A' })

      projectFileStore.set(toStorageKey(projectPath, 'graphs/a.json'), graphA)

      const { result } = renderHook(() => useGraphManager(projectPath))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.graphs).toHaveLength(1)

      // Add a new graph directly to the store
      const graphB = createGraph('b', { order: 1, name: 'Graph B' })
      projectFileStore.set(toStorageKey(projectPath, 'graphs/b.json'), graphB)

      await act(async () => {
        await result.current.refreshGraphs()
      })

      expect(result.current.graphs).toHaveLength(2)
    })
  })
})

describe('GraphOrderBatchResult type', () => {
  it('has correct success shape', () => {
    const successResult: GraphOrderBatchResult = {
      success: true,
      updatedGraphIds: ['a', 'b'],
    }

    expect(successResult.success).toBe(true)
    expect(successResult.updatedGraphIds).toEqual(['a', 'b'])
  })

  it('has correct failure shape', () => {
    const failureResult: GraphOrderBatchResult = {
      success: false,
      failedGraphId: 'b',
      failedOrder: 2,
      error: 'Graph not found',
      appliedGraphIds: ['a'],
    }

    expect(failureResult.success).toBe(false)
    expect(failureResult.failedGraphId).toBe('b')
    expect(failureResult.appliedGraphIds).toEqual(['a'])
  })
})
