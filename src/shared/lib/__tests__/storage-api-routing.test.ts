import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageBackend } from '../storage-backend'

// We need to mock the environment to test routing.
// We'll mock isTauriAvailable to true to simulate Tauri mode,
// and verify that /memory/... paths still use the MemoryStorageBackend.

vi.mock('../storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage')>()
  return {
    ...actual,
    getStorageBackend: vi.fn(),
    getProjectStorageBackend: vi.fn(),
  }
})

import * as storageModule from '../storage'
import {
  PROJECT_FILES_CHANGED_EVENT,
  readProjectFile,
  removeProjectFile,
  writeProjectFile,
  writeProjectTextFile,
} from '../storage-api'

const mockGetProjectStorageBackend = vi.mocked(
  storageModule.getProjectStorageBackend,
)

describe('Storage API Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes project operations through getProjectStorageBackend', async () => {
    const mockBackend: Partial<StorageBackend> = {
      readProjectFile: vi.fn().mockResolvedValue('file-content'),
    }
    mockGetProjectStorageBackend.mockResolvedValue(
      mockBackend as unknown as StorageBackend,
    )

    const result = await readProjectFile(
      '/memory/projects/tutorial-123',
      'file.json',
    )

    expect(mockGetProjectStorageBackend).toHaveBeenCalledWith(
      '/memory/projects/tutorial-123',
    )
    expect(mockBackend.readProjectFile).toHaveBeenCalledWith(
      '/memory/projects/tutorial-123',
      'file.json',
    )
    expect(result).toBe('file-content')
  })

  it('notifies after successful project mutations only', async () => {
    const backend: Partial<StorageBackend> = {
      removeProjectFile: vi.fn().mockResolvedValue(undefined),
      writeProjectFile: vi.fn().mockResolvedValue(undefined),
      writeProjectTextFile: vi.fn().mockResolvedValue(undefined),
    }
    mockGetProjectStorageBackend.mockResolvedValue(backend as StorageBackend)
    const details: unknown[] = []
    const listener = (event: Event): void => {
      details.push((event as CustomEvent).detail)
    }
    window.addEventListener(PROJECT_FILES_CHANGED_EVENT, listener)
    await writeProjectFile('/project', 'project.json', { name: 'Test' })
    await writeProjectTextFile('/project', 'notes.txt', 'text')
    await removeProjectFile('/project', 'notes.txt')
    window.removeEventListener(PROJECT_FILES_CHANGED_EVENT, listener)
    expect(details).toEqual([
      { projectPath: '/project' },
      { projectPath: '/project' },
      { projectPath: '/project' },
    ])
  })
})
