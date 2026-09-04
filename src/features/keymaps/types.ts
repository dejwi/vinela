import type {
  ActionScalarValue,
  KeymapMode,
  RunActionActionConfig,
  RunFunctionDefaultValue,
  RunFunctionSignatureSnapshot,
  RunFunctionSource,
  SetOptionValueConfig,
} from '@/shared/types'

// ============================================
// Manual Keymap Action Types (Discriminated Union)
// ============================================

// Omit actionConfigType to avoid conflict with ManualKeymapAction.actionType
export type ManualRunActionConfig = Omit<
  RunActionActionConfig,
  'actionConfigType'
>

/**
 * The set of action types available when creating a manual keymap.
 * Each type determines what Lua code gets generated as the mapping's RHS.
 */
export type ManualKeymapActionType =
  | 'run-action'
  | 'run-function'
  | 'set-option'
  | 'set-variable'
  | 'code-block'
  | 'run-custom-action'

/**
 * Discriminated union for manual keymap actions.
 * Each variant stores only what's needed for that action type.
 * These are intentionally independent from graph ActionConfig types
 * to allow the keymaps feature to evolve independently.
 */
export type ManualKeymapAction =
  | {
      readonly actionType: 'run-action'
      /** Run Action payload stored in nested config to avoid field collision */
      config: ManualRunActionConfig
    }
  | {
      readonly actionType: 'run-function'
      /** Stable key identifying the selected function */
      selectedFunctionKey: string
      /** Source of the function (core or plugin) */
      functionSource: RunFunctionSource
      /** Snapshot of the function signature at time of selection */
      signature: RunFunctionSignatureSnapshot | null
      /** Default values for each parameter */
      paramDefaults: Record<string, RunFunctionDefaultValue>
    }
  | {
      readonly actionType: 'set-option'
      /** Neovim option name (e.g., 'number', 'wrap') */
      optionName: string
      /** Option scope */
      scope: 'global' | 'local'
      /** Value configuration (suggested value or raw Lua expression) */
      valueConfig: SetOptionValueConfig
    }
  | {
      readonly actionType: 'set-variable'
      /** Variable scope (g: global, b: buffer, w: window, t: tab, v: vim) */
      scope: 'g' | 'b' | 'w' | 't' | 'v'
      /** Variable name (without scope prefix) */
      variableName: string
      /** Value type for input validation */
      valueType: 'string' | 'number' | 'boolean' | 'raw'
      /** The value to assign */
      value: ActionScalarValue
    }
  | {
      readonly actionType: 'code-block'
      /** Lua code to execute when key is pressed */
      code: string
    }
  | {
      readonly actionType: 'run-custom-action'
      /** ID of the callable graph to invoke */
      graphId: string
      /**
       * Cached name of the graph for display.
       * Updated when graphs change. May be stale if graph was deleted.
       */
      graphName: string
    }

// ============================================
// Project Keymap (stored in keymaps.json)
// ============================================

/**
 * A manually-created keymap stored in the project's keymaps.json.
 * Independent of any graph - created and edited directly in the Keymaps page.
 */
export interface ProjectKeymap {
  /** UUID */
  id: string
  /** Vim modes this keymap applies to */
  modes: KeymapMode[]
  /** Key sequence in Vim notation (e.g., '<leader>ff', '<C-s>') */
  keySequence: string
  /** What happens when the key is pressed */
  action: ManualKeymapAction
  /** Human-readable description */
  description: string
  /** Whether the mapping suppresses command-line echo */
  silent: boolean
  /** Whether the mapping is non-recursive (recommended: true) */
  noremap: boolean
  /** Whether the RHS is an expression */
  expr: boolean
  /** Baseline state used when no currently defined profile is attached. */
  enabled: boolean
  /**
   * Explicit local state for a shortcut with a defined attached profile.
   * Missing/undefined means attached profiles control activation.
   */
  enabledOverride?: boolean | undefined
  /** Missing and [] both mean no assigned project profiles. */
  profileIds?: string[]
}

// ============================================
// Keymaps File (on-disk format)
// ============================================

/**
 * The structure of keymaps.json on disk.
 * Version field enables future migration.
 */
export interface KeymapsFile {
  version: 1
  keymaps: ProjectKeymap[]
}

// ============================================
// Unified Display Type (Discriminated Union)
// ============================================

/** A graph-sourced keymap detected from a set-keymap action node */
export interface GraphSourcedKeymap {
  readonly source: 'graph'
  /** Graph containing the set-keymap node */
  graphId: string
  /** Cached graph name for display */
  graphName: string
  /** The set-keymap node's ID */
  nodeId: string
  /** Modes from the node's config */
  modes: KeymapMode[]
  /** Key sequence from the node's config */
  keySequence: string
  /** Command/RHS from the node's config */
  command: string
  /** Description from the node's config */
  description: string
  /**
   * Whether the node's 'on-press' input port is connected,
   * indicating the RHS comes from graph logic rather than a static string.
   */
  hasConnectedLogic: boolean
}

/** A manually-created keymap from keymaps.json */
export interface ManualKeymapEntry {
  readonly source: 'project'
  /** Reference to the ProjectKeymap (same ID) */
  keymapId: string
  /** The full ProjectKeymap data */
  keymap: ProjectKeymap
}

/**
 * Discriminated union for the unified keymaps list.
 * Both graph-sourced and manual keymaps appear in the same list.
 */
export type KeymapEntry = GraphSourcedKeymap | ManualKeymapEntry

// ============================================
// Type Guards
// ============================================

export function isGraphSourcedKeymap(
  entry: KeymapEntry,
): entry is GraphSourcedKeymap {
  return entry.source === 'graph'
}

export function isManualKeymapEntry(
  entry: KeymapEntry,
): entry is ManualKeymapEntry {
  return entry.source === 'project'
}

// ============================================
// Helper Types
// ============================================

/** Filter options for the keymaps list */
export interface KeymapFilters {
  search: string
  modeFilter: KeymapMode | 'all'
  sourceFilter: 'all' | 'graph' | 'project'
  actionTypeFilter: ManualKeymapActionType | 'all'
  /** 'all', 'none' (unassigned shortcuts), or a profile id */
  profileFilter: string
}

/** Sort options for the keymaps list */
export type KeymapSortField = 'keySequence' | 'mode' | 'source' | 'description'
export type KeymapSortDirection = 'asc' | 'desc'

export interface KeymapSort {
  field: KeymapSortField
  direction: KeymapSortDirection
}

/** A detected conflict between two keymaps */
export interface KeymapConflict {
  /** The conflicting mode */
  mode: KeymapMode
  /** The conflicting key sequence */
  keySequence: string
  /** The entries that conflict */
  entries: KeymapEntry[]
}
