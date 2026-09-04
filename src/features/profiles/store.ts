import { createStore } from '@/shared/lib/store'
import {
  isInitReady,
  type ProjectProfile,
  type StoreInitStatus,
} from '@/shared/types'
import {
  loadProjectProfileOverrides,
  loadProjectProfiles,
  saveProjectProfileOverrides,
  saveProjectProfiles,
} from './storage'

interface ProjectProfilesState {
  profiles: ProjectProfile[]
  overrides: Record<string, boolean>
  initStatus: StoreInitStatus
  error: string | null
  projectPath: string | null
  initializeProfiles: (projectPath: string) => Promise<void>
  saveProfiles: (profiles: ProjectProfile[]) => Promise<void>
  setProfileActive: (profileId: string, active: boolean) => Promise<void>
  clearError: () => void
  resetForProjectClose: () => void
}

let inflightInit: { projectPath: string; promise: Promise<void> } | null = null
let initGeneration = 0
let overrideRevision = 0
let confirmedOverrides: Record<string, boolean> = {}
let overrideWriteTail: Promise<void> = Promise.resolve()

function assertReady(state: ProjectProfilesState): string {
  const projectPath = state.projectPath
  if (projectPath === null || !isInitReady(state.initStatus, projectPath))
    throw new Error('Profiles are not ready for this project')
  return projectPath
}

function normalizeForSave(profiles: ProjectProfile[]): ProjectProfile[] {
  const ids = new Set<string>()
  const names = new Set<string>()
  return profiles.map((profile) => {
    const id = profile.id.trim()
    const name = profile.name.trim()
    const color = profile.color.toLowerCase()
    if (
      !id ||
      !name ||
      ids.has(id) ||
      names.has(name.toLowerCase()) ||
      !/^#[0-9a-f]{6}$/.test(color)
    )
      throw new Error(
        'Profiles must have unique names and IDs and valid colors',
      )
    ids.add(id)
    names.add(name.toLowerCase())
    return { ...profile, id, name, color }
  })
}

export const useProjectProfilesStore = createStore<ProjectProfilesState>(
  (set, get) => ({
    profiles: [],
    overrides: {},
    initStatus: { status: 'idle' },
    error: null,
    projectPath: null,
    initializeProfiles: async (projectPath) => {
      const currentStatus = get().initStatus
      if (
        currentStatus.status === 'ready' &&
        currentStatus.projectPath === projectPath
      )
        return
      if (inflightInit?.projectPath === projectPath) return inflightInit.promise
      const generation = ++initGeneration
      const promise = (async (): Promise<void> => {
        set((state) => {
          state.initStatus = { status: 'loading', projectPath }
          state.error = null
          state.projectPath = projectPath
        })
        try {
          const [profiles, overrides] = await Promise.all([
            loadProjectProfiles(projectPath),
            loadProjectProfileOverrides(projectPath),
          ])
          if (generation !== initGeneration) return
          confirmedOverrides = { ...overrides }
          set((state) => {
            state.profiles = profiles
            state.overrides = overrides
            state.initStatus = { status: 'ready', projectPath }
          })
        } catch (error) {
          if (generation !== initGeneration) return
          const message =
            error instanceof Error ? error.message : 'Failed to load profiles'
          set((state) => {
            state.error = message
            state.initStatus = { status: 'error', projectPath, error: message }
          })
        } finally {
          if (
            inflightInit?.projectPath === projectPath &&
            generation === initGeneration
          )
            inflightInit = null
        }
      })()
      inflightInit = { projectPath, promise }
      return promise
    },
    saveProfiles: async (profiles) => {
      const projectPath = assertReady(get())
      const generation = initGeneration
      const normalized = normalizeForSave(profiles)
      const previous = get().profiles
      set((state) => {
        state.profiles = normalized
      })
      try {
        await saveProjectProfiles(projectPath, normalized)
      } catch (error) {
        if (generation === initGeneration && get().projectPath === projectPath)
          set((state) => {
            state.profiles = previous
            state.error =
              error instanceof Error ? error.message : 'Failed to save profiles'
          })
        throw error
      }
      const profileIds = new Set(normalized.map((profile) => profile.id))
      const overrides = Object.fromEntries(
        Object.entries(get().overrides).filter(([id]) => profileIds.has(id)),
      )
      confirmedOverrides = Object.fromEntries(
        Object.entries(confirmedOverrides).filter(([id]) => profileIds.has(id)),
      )
      const revision = ++overrideRevision
      set((state) => {
        state.overrides = overrides
      })
      const write = overrideWriteTail.then(async () => {
        try {
          await saveProjectProfileOverrides(projectPath, overrides)
          if (
            generation === initGeneration &&
            get().projectPath === projectPath
          ) {
            confirmedOverrides = { ...overrides }
            if (revision === overrideRevision)
              set((state) => {
                state.error = null
              })
          }
        } catch (error) {
          if (
            generation === initGeneration &&
            get().projectPath === projectPath &&
            revision === overrideRevision
          )
            set((state) => {
              state.overrides = { ...confirmedOverrides }
              state.error =
                error instanceof Error
                  ? error.message
                  : 'Failed to save profiles'
            })
          throw error
        }
      })
      overrideWriteTail = write.catch(() => undefined)
      await write
    },
    setProfileActive: async (profileId, active) => {
      const state = get()
      const projectPath = assertReady(state)
      const profile = state.profiles.find((entry) => entry.id === profileId)
      if (!profile) throw new Error('Unknown profile')
      const snapshot = { ...state.overrides }
      if (active === profile.defaultActive) delete snapshot[profileId]
      else snapshot[profileId] = active
      const revision = ++overrideRevision
      const generation = initGeneration
      set((current) => {
        current.overrides = snapshot
      })
      const write = overrideWriteTail.then(async () => {
        try {
          await saveProjectProfileOverrides(projectPath, snapshot)
          if (
            generation === initGeneration &&
            get().projectPath === projectPath
          ) {
            confirmedOverrides = { ...snapshot }
            if (revision === overrideRevision)
              set((current) => {
                current.error = null
              })
          }
        } catch (error) {
          if (
            generation === initGeneration &&
            get().projectPath === projectPath &&
            revision === overrideRevision
          ) {
            set((current) => {
              current.overrides = { ...confirmedOverrides }
              current.error =
                error instanceof Error
                  ? error.message
                  : 'Failed to save profiles'
            })
          }
          throw error
        }
      })
      overrideWriteTail = write.catch(() => undefined)
      await write
    },
    clearError: () =>
      set((state) => {
        state.error = null
      }),
    resetForProjectClose: () => {
      ++initGeneration
      inflightInit = null
      confirmedOverrides = {}
      set((state) => {
        state.profiles = []
        state.overrides = {}
        state.initStatus = { status: 'idle' }
        state.error = null
        state.projectPath = null
      })
    },
  }),
)

export function _resetProjectProfilesStoreTestState(): void {
  inflightInit = null
  initGeneration = 0
  overrideRevision = 0
  confirmedOverrides = {}
  overrideWriteTail = Promise.resolve()
}
