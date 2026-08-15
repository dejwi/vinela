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
import { readProjectFile } from '../storage-api'

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
})
