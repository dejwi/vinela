import { useGitSyncStore } from '@/features/git-sync'
import { useGraphEditorStore } from '@/features/graph-editor/store'
import { useKeymapStore } from '@/features/keymaps/store'
import { useLspStore } from '@/features/lsp/store'
import { useGenerationStore } from '@/features/lua-generator/store'
import { usePluginStore } from '@/features/plugins/store'
import { useProjectProfilesStore } from '@/features/profiles'

/**
 * Eagerly initialize all project-scoped stores when a project is opened.
 * This ensures plugin and keymap data is available before any page renders,
 * fixing the plugin availability bug and eliminating loading flickers.
 *
 * Fire-and-forget: does not block project open. Stores will be populated
 * within milliseconds (local I/O) and consumers will re-render once with data.
 *
 * Called by the project store's openProject, createProject, and initDevMode actions.
 */
export function initializeProjectScopedState(projectPath: string): void {
  void usePluginStore.getState().initializePlugins(projectPath)
  void useKeymapStore.getState().loadAllKeymaps(projectPath)
  void useProjectProfilesStore.getState().initializeProfiles(projectPath)
  void useLspStore.getState().loadFromProject(projectPath)
}

/**
 * Reset all project-scoped state when closing a project.
 * This prevents state bleed between projects and ensures a clean slate.
 *
 * Called by the project store's closeProject action.
 */
export function resetProjectScopedState(): void {
  useGraphEditorStore.getState().resetForProjectClose()
  useKeymapStore.getState().resetForProjectClose()
  useProjectProfilesStore.getState().resetForProjectClose()
  usePluginStore.getState().resetForProjectClose()
  useLspStore.getState().resetForProjectClose()
  useGenerationStore.getState().resetForProjectClose()
  useGitSyncStore.getState().resetForProjectClose()
}
