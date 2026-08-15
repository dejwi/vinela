import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/lib/storage-api', () => ({
  projectFileExists: vi.fn(),
  readProjectFile: vi.fn(),
  writeProjectFile: vi.fn(),
}))

import {
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type { InstalledPlugin } from '@/shared/types'
import {
  CURRENT_PLUGIN_CONFIG_VERSION,
  loadInstalledPlugins,
  saveInstalledPlugins,
} from '../storage'

const mockProjectFileExists = vi.mocked(projectFileExists)
const mockReadProjectFile = vi.mocked(readProjectFile)
const mockWriteProjectFile = vi.mocked(writeProjectFile)

describe('plugins storage version invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes CURRENT_PLUGIN_CONFIG_VERSION in saveInstalledPlugins', async () => {
    const plugins: InstalledPlugin[] = [
      { schemaId: 'a', enabled: true, config: {}, addedAt: 1 },
    ]
    await saveInstalledPlugins('/tmp/project', plugins)

    const payload = mockWriteProjectFile.mock.calls[0]?.[2] as {
      configVersion: number
      plugins: InstalledPlugin[]
    }
    expect(payload.configVersion).toBe(CURRENT_PLUGIN_CONFIG_VERSION)
  })

  it('migration rewrite uses CURRENT_PLUGIN_CONFIG_VERSION', async () => {
    mockProjectFileExists.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue([
      { schemaId: 'a', enabled: true, config: {}, addedAt: 1 },
    ])

    const result = await loadInstalledPlugins('/tmp/project', [])
    expect(result.status).toBe('loaded')

    const payload = mockWriteProjectFile.mock.calls[0]?.[2] as {
      configVersion: number
      plugins: InstalledPlugin[]
    }
    expect(payload.configVersion).toBe(CURRENT_PLUGIN_CONFIG_VERSION)
  })
})
