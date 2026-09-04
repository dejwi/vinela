import {
  initializeProjectScopedState,
  resetProjectScopedState,
} from '@/app/state/reset-project-scoped-state'
import { useGitSyncStore } from '@/features/git-sync'
import {
  addRecentProject,
  loadAppSettings,
  removeRecentProject as removeRecentProjectFromSettings,
  restoreRecentProject as restoreRecentProjectToSettings,
} from '@/shared/lib/settings'
import { createStore } from '@/shared/lib/store'
import type { LoadedProject, RecentProject } from '@/shared/types'
import * as projectStorage from './storage'

const DEV_BOOTSTRAP_LOG_TAG = '[dev-bootstrap]'
const ACTIVE_PROJECT_PATH_STORAGE_KEY = 'vinela.activeProjectPath'
let projectActivationGeneration = 0

function isCurrentProjectActivation(
  generation: number,
  projectPath: string,
): boolean {
  return (
    generation === projectActivationGeneration &&
    useProjectStore.getState().currentProject?.absolutePath === projectPath
  )
}

function beginBackgroundGitSync(generation: number, projectPath: string): void {
  void useGitSyncStore
    .getState()
    .synchronizeOnOpen()
    .then((result) => {
      if (isCurrentProjectActivation(generation, projectPath) && result.didPull)
        window.location.reload()
    })
}

function getSafeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getPersistedActiveProjectPath(): string | null {
  const localStorage = getSafeLocalStorage()
  if (localStorage === null) {
    return null
  }

  const path = localStorage.getItem(ACTIVE_PROJECT_PATH_STORAGE_KEY)
  if (path === null || path.trim() === '') {
    return null
  }

  return path
}

function persistActiveProjectPath(path: string): void {
  const localStorage = getSafeLocalStorage()
  if (localStorage === null) {
    return
  }

  localStorage.setItem(ACTIVE_PROJECT_PATH_STORAGE_KEY, path)
}

export function clearPersistedActiveProjectPath(): void {
  const localStorage = getSafeLocalStorage()
  if (localStorage === null) {
    return
  }

  localStorage.removeItem(ACTIVE_PROJECT_PATH_STORAGE_KEY)
}

export interface ProjectState {
  // State
  currentProject: LoadedProject | null
  recentProjects: RecentProject[]
  isLoading: boolean
  error: string | null

  /** Whether the currently loaded project is a tutorial project (Fix #2) */
  isTutorialProject: boolean

  // Actions
  loadRecentProjects: () => Promise<void>
  openProject: (folderPath: string) => Promise<projectStorage.OpenProjectResult>
  /**
   * Opens a project for the tutorial without adding to recent projects.
   * Sets isTutorialProject flag to true (Fix #2).
   */
  openProjectForTutorial: (
    folderPath: string,
  ) => Promise<projectStorage.OpenProjectResult>
  createProject: (
    folderPath: string,
    name: string,
    description?: string,
    force?: boolean,
  ) => Promise<projectStorage.CreateProjectResult>
  createExampleProject: (
    folderPath: string,
    name: string,
    description?: string,
  ) => Promise<projectStorage.CreateProjectResult>
  closeProject: () => void
  deleteProject: (folderPath: string) => Promise<void>
  removeRecentProject: (absolutePath: string) => Promise<void>
  restoreRecentProject: (project: RecentProject) => Promise<void>
  clearError: () => void

  // Dev mode - returns true if project was loaded successfully
  initDevMode: () => Promise<boolean>
}

export const useProjectStore = createStore<ProjectState>((set, get) => ({
  currentProject: null,
  recentProjects: [],
  isLoading: false,
  error: null,
  isTutorialProject: false,

  loadRecentProjects: async () => {
    const settings = await loadAppSettings()
    set((state) => {
      state.recentProjects = settings.recentProjects
    })
  },

  openProject: async (folderPath) => {
    const generation = ++projectActivationGeneration
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    const result = await projectStorage.openProject(folderPath)

    if (result.success) {
      if (generation !== projectActivationGeneration) return result

      set((state) => {
        state.currentProject = result.project
        state.isTutorialProject = false
      })
      await useGitSyncStore
        .getState()
        .initializeProject(result.project.absolutePath)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      await addRecentProject(result.project.absolutePath, result.project.name)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      persistActiveProjectPath(result.project.absolutePath)
      initializeProjectScopedState(result.project.absolutePath)
      await get().loadRecentProjects()
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      set((state) => {
        state.isLoading = false
      })
      beginBackgroundGitSync(generation, result.project.absolutePath)
    } else {
      if (generation !== projectActivationGeneration) return result
      set((state) => {
        state.error = result.message
        state.isLoading = false
      })
    }

    return result
  },

  createProject: async (folderPath, name, description, force) => {
    const generation = ++projectActivationGeneration
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    const result = await projectStorage.createProject(
      folderPath,
      name,
      description,
      force,
    )

    if (result.success) {
      if (generation !== projectActivationGeneration) return result

      set((state) => {
        state.currentProject = result.project
        state.isTutorialProject = false
      })
      await useGitSyncStore
        .getState()
        .initializeProject(result.project.absolutePath)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      await addRecentProject(result.project.absolutePath, result.project.name)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      persistActiveProjectPath(result.project.absolutePath)
      initializeProjectScopedState(result.project.absolutePath)
      await get().loadRecentProjects()
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      set((state) => {
        state.isLoading = false
      })
      beginBackgroundGitSync(generation, result.project.absolutePath)
    } else {
      if (generation !== projectActivationGeneration) return result
      set((state) => {
        state.error = result.message
        state.isLoading = false
      })
    }

    return result
  },

  createExampleProject: async (folderPath, name, description) => {
    const generation = ++projectActivationGeneration
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    const result = await projectStorage.createExampleProject(
      folderPath,
      name,
      description,
    )

    if (result.success) {
      if (generation !== projectActivationGeneration) return result

      set((state) => {
        state.currentProject = result.project
        state.isTutorialProject = false
      })
      await useGitSyncStore
        .getState()
        .initializeProject(result.project.absolutePath)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      await addRecentProject(result.project.absolutePath, result.project.name)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      persistActiveProjectPath(result.project.absolutePath)
      initializeProjectScopedState(result.project.absolutePath)
      await get().loadRecentProjects()
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      set((state) => {
        state.isLoading = false
      })
      beginBackgroundGitSync(generation, result.project.absolutePath)
    } else {
      if (generation !== projectActivationGeneration) return result
      set((state) => {
        state.error = result.message
        state.isLoading = false
      })
    }

    return result
  },

  openProjectForTutorial: async (folderPath) => {
    const generation = ++projectActivationGeneration
    set((state) => {
      state.isLoading = true
      state.error = null
    })

    const result = await projectStorage.openProject(folderPath)

    if (result.success) {
      if (generation !== projectActivationGeneration) return result
      // NOTE: No addRecentProject() call here (Fix #2)
      set((state) => {
        state.currentProject = result.project
        state.isTutorialProject = true
      })
      await useGitSyncStore
        .getState()
        .initializeProject(result.project.absolutePath)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return result
      initializeProjectScopedState(result.project.absolutePath)
      set((state) => {
        state.isLoading = false
      })
      beginBackgroundGitSync(generation, result.project.absolutePath)
    } else {
      if (generation !== projectActivationGeneration) return result
      set((state) => {
        state.error = result.message
        state.isLoading = false
      })
    }

    return result
  },

  closeProject: () => {
    projectActivationGeneration += 1
    // Reset all project-scoped stores first
    resetProjectScopedState()
    clearPersistedActiveProjectPath()

    set((state) => {
      state.currentProject = null
      state.error = null
      state.isTutorialProject = false
      state.isLoading = false
    })
  },

  deleteProject: async (folderPath) => {
    await projectStorage.deleteProject(folderPath)
    set((state) => {
      if (state.currentProject?.absolutePath === folderPath) {
        clearPersistedActiveProjectPath()
        state.currentProject = null
      }
      state.recentProjects = state.recentProjects.filter(
        (p) => p.absolutePath !== folderPath,
      )
    })
  },

  removeRecentProject: async (absolutePath) => {
    await removeRecentProjectFromSettings(absolutePath)
    set((state) => {
      state.recentProjects = state.recentProjects.filter(
        (p) => p.absolutePath !== absolutePath,
      )
    })
  },

  restoreRecentProject: async (project) => {
    await restoreRecentProjectToSettings(project)
    await get().loadRecentProjects()
  },

  clearError: () =>
    set((state) => {
      state.error = null
    }),

  initDevMode: async () => {
    const generation = ++projectActivationGeneration
    set((state) => {
      state.isLoading = true
      state.error = null
    })
    const result = await projectStorage.getOrCreateDevProject()
    if (result.success) {
      if (generation !== projectActivationGeneration) return false
      set((state) => {
        state.currentProject = result.project
        state.error = null
        state.isTutorialProject = false
      })
      await useGitSyncStore
        .getState()
        .initializeProject(result.project.absolutePath)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return false
      await addRecentProject(result.project.absolutePath, result.project.name)
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return false
      persistActiveProjectPath(result.project.absolutePath)
      initializeProjectScopedState(result.project.absolutePath)
      await get().loadRecentProjects()
      if (!isCurrentProjectActivation(generation, result.project.absolutePath))
        return false
      set((state) => {
        state.isLoading = false
      })
      beginBackgroundGitSync(generation, result.project.absolutePath)
      return true
    }

    if (generation !== projectActivationGeneration) return false

    const errorMessage = `Dev mode bootstrap failed at ${result.stage} for ${result.path}: ${result.message}`

    if (import.meta.env.DEV) {
      console.error(`${DEV_BOOTSTRAP_LOG_TAG} ${errorMessage}`)
    }

    set((state) => {
      state.currentProject = null
      state.error = errorMessage
      state.isLoading = false
    })

    return false
  },
}))
