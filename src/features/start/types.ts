import type { RecentProject } from '@/shared/types'

export type ActionState = 'idle' | 'opening' | 'creating' | 'quickStarting'

export type ProjectCreationKind = 'blank' | 'example'

export type RecentProjectsLoadState =
  | { status: 'loading' }
  | { status: 'ready'; projects: RecentProject[] }

export type CreateDialogPhase =
  | { phase: 'editing' }
  | {
      phase: 'confirm-non-empty'
      pending: {
        folderPath: string
        name: string
        description?: string
      }
    }

export type MemoryPathValidation =
  | { valid: true; normalizedPath: string }
  | {
      valid: false
      reason: 'empty' | 'missing_prefix' | 'path_traversal' | 'duplicate'
      message: string
    }

export interface StartScreenState {
  actionState: ActionState
  recents: RecentProjectsLoadState
  isNewProjectDialogOpen: boolean
}

export const MEMORY_PROJECT_PREFIX = '/memory/projects/'
