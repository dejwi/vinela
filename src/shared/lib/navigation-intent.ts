import { create } from 'zustand'

/**
 * Intent to focus on a specific node in a specific graph.
 * Set by features that want to navigate the user to a node
 * (e.g., keymaps page clicking "View in graph").
 */
export interface FocusNodeIntent {
  /** The graph containing the target node */
  graphId: string
  /** The node to focus on */
  nodeId: string
}

interface NavigationIntentState {
  /** Pending intent to focus on a graph node */
  focusNode: FocusNodeIntent | null

  /** Set a new focus intent (called before navigating to /editor) */
  setFocusNode: (intent: FocusNodeIntent) => void

  /** Clear the focus intent without consuming it */
  clearFocusNode: () => void

  /**
   * Consume the current focus intent (returns it and clears).
   * Called by the graph editor page to process the intent.
   * Returns null if no intent is pending.
   */
  consumeFocusNode: () => FocusNodeIntent | null
}

export const useNavigationIntentStore = create<NavigationIntentState>(
  (set, get) => ({
    focusNode: null,

    setFocusNode: (intent) => set({ focusNode: intent }),

    clearFocusNode: () => set({ focusNode: null }),

    consumeFocusNode: () => {
      const current = get().focusNode
      if (current !== null) {
        set({ focusNode: null })
      }
      return current
    },
  }),
)
