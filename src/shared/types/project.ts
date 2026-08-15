import type { TutorialProgress } from './tutorial'

/**
 * Project metadata stored in project.json
 * Does NOT include the folder path - that's runtime context.
 */
export interface Project {
  id: string
  name: string // Editable, independent of folder name
  description?: string | undefined
  createdAt: number
  lastModifiedAt: number
}

/**
 * Runtime representation of an open project.
 * Extends Project with the absolute path (not persisted to project.json).
 */
export interface LoadedProject extends Project {
  /** Absolute path to the project folder */
  absolutePath: string
}

/**
 * Entry in the recent projects list (stored in AppSettings).
 */
export interface RecentProject {
  /** Absolute path to project folder */
  absolutePath: string
  /** Cached project name for display (updated when project opens) */
  name: string
  /** Timestamp of last open */
  lastOpenedAt: number
}

/**
 * App-level settings stored in AppData.
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'

  /** Recent projects list (absolute paths) */
  recentProjects: RecentProject[]

  /** Custom Neovim config output path (default: ~/.config/nvim/init.lua) */
  neovimOutputPath?: string | undefined

  // Editor preferences
  /** Auto-save debounce delay in ms (default: 1000) */
  autoSaveDelay?: number | undefined
  /** Show grid on graph canvas (default: true) */
  showGrid?: boolean | undefined
  /** Snap to grid (default: false) */
  snapToGrid?: boolean | undefined
  /** Grid spacing in pixels (default: 20) */
  gridSpacing?: number | undefined
  /** Show minimap on graph canvas (default: true) */
  showMinimap?: boolean | undefined
  /** Confirm before deleting nodes (default: true) */
  confirmNodeDeletion?: boolean | undefined

  /** Tutorial progress and state. Undefined = never started. */
  tutorialProgress?: TutorialProgress | undefined
}
