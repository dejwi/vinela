import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectProfile } from '@/shared/types'
import { saveProjectProfileOverrides, saveProjectProfiles } from './storage'
import {
  _resetProjectProfilesStoreTestState,
  useProjectProfilesStore,
} from './store'

vi.mock('./storage', () => ({
  loadProjectProfileOverrides: vi.fn(),
  loadProjectProfiles: vi.fn(),
  saveProjectProfileOverrides: vi.fn(),
  saveProjectProfiles: vi.fn(),
}))

const profile = (id: string): ProjectProfile => ({
  id,
  name: id,
  color: '#6366f1',
  defaultActive: true,
})

const mockSaveProjectProfileOverrides = vi.mocked(saveProjectProfileOverrides)
const mockSaveProjectProfiles = vi.mocked(saveProjectProfiles)

describe('project profiles store', () => {
  beforeEach(() => {
    _resetProjectProfilesStoreTestState()
    mockSaveProjectProfileOverrides.mockReset()
    mockSaveProjectProfiles.mockReset()
    useProjectProfilesStore.setState({
      profiles: [profile('a'), profile('removed')],
      overrides: { a: false, removed: false },
      initStatus: { status: 'ready', projectPath: '/p' },
      projectPath: '/p',
      error: null,
    })
  })

  it('rejects a failed override write without blocking later writes', async () => {
    mockSaveProjectProfileOverrides
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue(undefined)

    await expect(
      useProjectProfilesStore.getState().setProfileActive('a', false),
    ).rejects.toThrow('write failed')
    await expect(
      useProjectProfilesStore.getState().setProfileActive('a', true),
    ).resolves.toBeUndefined()
  })

  it('prunes deleted-profile overrides when saving definitions', async () => {
    mockSaveProjectProfiles.mockResolvedValue(undefined)
    mockSaveProjectProfileOverrides.mockResolvedValue(undefined)

    await useProjectProfilesStore.getState().saveProfiles([profile('a')])

    expect(mockSaveProjectProfileOverrides).toHaveBeenCalledWith('/p', {
      a: false,
    })
    expect(useProjectProfilesStore.getState().overrides).toEqual({ a: false })
  })
})
