import { useGraphEditorStore } from '@/features/graph-editor/store'
import { useKeymapStore } from '@/features/keymaps/store'
import { usePluginStore } from '@/features/plugins/store'
import { useProjectStore } from '@/features/projects/store'

/**
 * Setup actions run before a step is displayed to ensure the UI is in the correct state.
 * All actions must be idempotent and handle missing project gracefully.
 *
 * SETUP ACTION INVENTORY (v7 short flow):
 * ======================================
 *
 * Referenced by new 9-step flow:
 * - prepare-plugins-browse (steps 2-3)
 * - prepare-keymaps-page (steps 4-5)
 * - reset-neovim-options-tutorial-state (step 6)
 * - ensure-graph-sidebar-expanded (step 8)
 *
 * Registered but unreferenced (available for future use):
 * - select-autocmd-node
 * - prepare-plugin-install-step
 * - ensure-telescope-installed
 * - close-plugin-modal
 * - select-callable-entry-node
 * - select-graph-ref-node
 * - ensure-keymap-editor-open
 * - close-keymap-editor
 * - clear-node-selection
 * - center-on-callable-entry
 * - center-on-graph-ref
 *
 * Total registered actions: 15
 * Referenced by v7 steps: 4
 * Available for extension: 11
 */
export type SetupAction = () => Promise<void> | void

function isPluginInstalled(schemaId: string): boolean {
  return usePluginStore
    .getState()
    .installedPlugins.some((plugin) => plugin.schemaId === schemaId)
}

function isPluginInstalledAndEnabled(schemaId: string): boolean {
  return usePluginStore
    .getState()
    .installedPlugins.some(
      (plugin) => plugin.schemaId === schemaId && plugin.enabled,
    )
}

/**
 * Registry of all available setup actions, keyed by their ID.
 */
export const SETUP_ACTIONS = {
  /**
   * Ensures the graph sidebar is expanded (not collapsed).
   * Uses the sidebarCollapsed field in the graph editor store.
   */
  'ensure-graph-sidebar-expanded': (): void => {
    const store = useGraphEditorStore.getState()
    if (store.sidebarCollapsed) {
      store.setSidebarCollapsed(false)
    }
  },

  /**
   * Selects the tutorial autocmd node so the properties panel shows it.
   */
  'select-autocmd-node': (): void => {
    useGraphEditorStore
      .getState()
      .setSelectedNodes(['tut-node-autocmd-yank-highlight'])
  },

  /**
   * Resets the plugins page to the browse tab with no search or category filter.
   * Ensures the telescope card is visible when the tutorial reaches plugin steps.
   */
  'prepare-plugins-browse': (): void => {
    const store = usePluginStore.getState()
    store.setActiveTab('browse')
    store.setSearchQuery('')
    store.setSelectedCategory(null)
  },

  /**
   * Prepares the plugin install step:
   * 1. Resets browse tab state so telescope card is visible.
   * 2. Uninstalls telescope if already installed (so install button is shown).
   * 3. Opens the telescope detail modal via DOM event.
   *
   * This is async because uninstall is async.
   */
  'prepare-plugin-install-step': async (): Promise<void> => {
    const projectPath = useProjectStore.getState().currentProject?.absolutePath
    if (!projectPath) return

    const store = usePluginStore.getState()
    store.setActiveTab('browse')
    store.setSearchQuery('')
    store.setSelectedCategory(null)

    const telescopeId = 'telescope-nvim'
    if (isPluginInstalled(telescopeId)) {
      await store.uninstallPlugin(projectPath, telescopeId)
    }

    if (isPluginInstalled(telescopeId)) {
      throw new Error(
        '[tutorial] Unable to prepare install step: telescope-nvim is still installed. Uninstall Telescope in the Plugins page, then retry this step.',
      )
    }

    window.dispatchEvent(
      new CustomEvent('tutorial:open-plugin-modal', {
        detail: { schemaId: telescopeId },
      }),
    )
  },

  /**
   * Ensures telescope is installed and enabled before showing the plugin-detail step.
   * Installs it if not present, then polls until the store reflects the installed state.
   * Times out after 8 seconds to avoid hanging the tutorial indefinitely.
   */
  'ensure-telescope-installed': async (): Promise<void> => {
    const projectPath = useProjectStore.getState().currentProject?.absolutePath
    if (!projectPath) return

    const store = usePluginStore.getState()
    const telescopeId = 'telescope-nvim'

    if (!isPluginInstalledAndEnabled(telescopeId)) {
      await store.installPlugin(projectPath, telescopeId)
    }

    const start = Date.now()
    while (
      !isPluginInstalledAndEnabled(telescopeId) &&
      Date.now() - start < 8000
    ) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }

    if (!isPluginInstalledAndEnabled(telescopeId)) {
      throw new Error(
        '[tutorial] Telescope did not finish installing within 8 seconds. Install and enable Telescope manually, then retry this step.',
      )
    }
  },

  /**
   * Closes the plugin detail modal via DOM event.
   * Used before navigating away from the plugins page.
   */
  'close-plugin-modal': (): void => {
    window.dispatchEvent(new CustomEvent('tutorial:close-plugin-modal'))
  },

  /**
   * Selects the callable entry node in the telescope search graph
   * so the properties panel shows it for the callable-graph-explained step.
   */
  'select-callable-entry-node': (): void => {
    useGraphEditorStore.getState().setSelectedNodes(['tut-node-callable-entry'])
  },

  /**
   * Selects the graph-ref node in the editor setup graph
   * so the properties panel shows it for the graph-ref-explained step.
   */
  'select-graph-ref-node': (): void => {
    useGraphEditorStore
      .getState()
      .setSelectedNodes(['tut-node-graph-ref-telescope'])
  },

  /**
   * Prepares the keymaps page for tutorial display:
   * 1. Loads all keymaps for the current project.
   * 2. Resets filters and sort via DOM event for consistent state.
   */
  'prepare-keymaps-page': async (): Promise<void> => {
    const projectPath = useProjectStore.getState().currentProject?.absolutePath
    if (!projectPath) return

    await useKeymapStore.getState().loadAllKeymaps(projectPath)
    window.dispatchEvent(new CustomEvent('tutorial:reset-keymaps-page-state'))
  },

  /**
   * Opens the keymap editor dialog via DOM event.
   * Used for the keymap-editor step.
   */
  'ensure-keymap-editor-open': (): void => {
    window.dispatchEvent(new CustomEvent('tutorial:open-keymap-editor'))
  },

  /**
   * Closes the keymap editor dialog via DOM event.
   * Used after the keymap-editor step to return to the list view.
   */
  'close-keymap-editor': (): void => {
    window.dispatchEvent(new CustomEvent('tutorial:close-keymap-editor'))
  },

  /**
   * Resets the Neovim Options page state to the popular view with no filters.
   * Ensures Popular view with no filters so the cursorline card is visible in the options tutorial step.
   */
  'reset-neovim-options-tutorial-state': (): void => {
    window.dispatchEvent(new CustomEvent('tutorial:reset-neovim-options-state'))
  },

  /**
   * Clears any selected nodes to close the properties panel.
   * Used before spotlighting specific nodes in the tutorial.
   */
  'clear-node-selection': (): void => {
    useGraphEditorStore.getState().setSelectedNodes([])
  },

  /**
   * Centers the viewport on the Callable Entry node.
   * Dispatches a custom event that the GraphEditor listens for.
   */
  'center-on-callable-entry': (): void => {
    window.dispatchEvent(
      new CustomEvent('graph-editor:center-on-node', {
        detail: { nodeId: 'tut-node-callable-entry' },
      }),
    )
  },

  /**
   * Centers the viewport on the Graph Reference (Telescope) node.
   * Dispatches a custom event that the GraphEditor listens for.
   */
  'center-on-graph-ref': (): void => {
    window.dispatchEvent(
      new CustomEvent('graph-editor:center-on-node', {
        detail: { nodeId: 'tut-node-graph-ref-telescope' },
      }),
    )
  },
} as const satisfies Record<string, SetupAction>

/**
 * Type for valid setup action IDs derived from the SETUP_ACTIONS registry.
 * This provides compile-time safety for tutorial step definitions.
 */
export type SetupActionId = keyof typeof SETUP_ACTIONS

function isSetupActionId(actionId: string): actionId is SetupActionId {
  return actionId in SETUP_ACTIONS
}

/**
 * Runs a setup action by ID. Returns silently if action not found.
 */
export async function runSetupAction(actionId: string): Promise<void> {
  if (!isSetupActionId(actionId)) return
  await SETUP_ACTIONS[actionId]()
}
