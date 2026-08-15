import { findActionByKey } from '@/shared/data/neovim/action-catalog-entries'
import { API_FUNCTION_CATALOG } from '@/shared/data/neovim/api-functions'
import { DIAGNOSTIC_FUNCTION_CATALOG } from '@/shared/data/neovim/diagnostic-functions'
import { CORE_FUNCTION_TEMPLATES } from '@/shared/data/neovim/function-templates'
import { NEOVIM_FUNCTION_CATALOG } from '@/shared/data/neovim/functions'
import { LSP_FUNCTION_CATALOG } from '@/shared/data/neovim/lsp-functions'
import { TREESITTER_FUNCTION_CATALOG } from '@/shared/data/neovim/treesitter-functions'
import type { KeymapMode } from '@/shared/types'
import type { KeymapEntry, ManualKeymapAction } from './types'

// ============================================
// Static core function label lookup (no schema loading needed)
// ============================================

/**
 * Pre-built map of function key → friendly label for all core functions.
 * Used by summarizeRunFunction() to avoid building the full catalog.
 */
const CORE_FUNCTION_LABEL_MAP = new Map<string, string>([
  ...[
    ...NEOVIM_FUNCTION_CATALOG,
    ...API_FUNCTION_CATALOG,
    ...LSP_FUNCTION_CATALOG,
    ...DIAGNOSTIC_FUNCTION_CATALOG,
    ...TREESITTER_FUNCTION_CATALOG,
  ].map((fn): [string, string] => [`core:${fn.name}`, fn.label]),
  // Also include template labels
  ...CORE_FUNCTION_TEMPLATES.map((tmpl): [string, string] => [
    `template:${tmpl.key}`,
    tmpl.label,
  ]),
])

// ============================================
// Entry helpers
// ============================================

/** Get key sequence from any entry type */
export function getEntryKeySequence(entry: KeymapEntry): string {
  return entry.source === 'graph' ? entry.keySequence : entry.keymap.keySequence
}

/** Get modes from any entry type */
export function getEntryModes(entry: KeymapEntry): KeymapMode[] {
  return entry.source === 'graph' ? entry.modes : entry.keymap.modes
}

/** Get description from any entry type */
export function getEntryDescription(entry: KeymapEntry): string {
  return entry.source === 'graph' ? entry.description : entry.keymap.description
}

/** Get a human-readable summary of what the keymap does */
export function getActionSummary(entry: KeymapEntry): string {
  if (entry.source === 'graph') {
    return entry.hasConnectedLogic ? 'Custom workflow' : entry.command
  }

  return getManualActionSummary(entry.keymap.action)
}

function summarizeRunAction(
  action: Extract<ManualKeymapAction, { actionType: 'run-action' }>,
): string {
  if (action.config.mode === 'catalog' && action.config.selectedActionKey) {
    const catalogEntry = findActionByKey(action.config.selectedActionKey)
    if (catalogEntry) return catalogEntry.label
    return `Run: ${action.config.action || action.config.selectedActionKey}`
  }
  return `Run: ${action.config.action || '(empty)'}`
}

function summarizeRunFunction(
  action: Extract<ManualKeymapAction, { actionType: 'run-function' }>,
): string {
  // Try static core label lookup (covers core functions and templates)
  if (action.selectedFunctionKey) {
    const coreLabel = CORE_FUNCTION_LABEL_MAP.get(action.selectedFunctionKey)
    if (coreLabel !== undefined) return coreLabel
  }

  // Fallback to raw function name
  if (action.functionSource.type === 'core') {
    return action.functionSource.functionName || '(no function)'
  }
  const { pluginId, functionName } = action.functionSource
  return `${pluginId}: ${functionName || '(no function)'}`
}

function summarizeCodeBlock(
  action: Extract<ManualKeymapAction, { actionType: 'code-block' }>,
): string {
  const preview = action.code.split('\n')[0]?.slice(0, 30) || '(empty)'
  return `Lua: ${preview}${action.code.length > 30 ? '...' : ''}`
}

function summarizeRunCustomAction(
  action: Extract<ManualKeymapAction, { actionType: 'run-custom-action' }>,
): string {
  if (!action.graphId) return '(no action selected)'
  return action.graphName || '(custom action)'
}

/** Get a human-readable summary of a manual keymap action */
export function getManualActionSummary(action: ManualKeymapAction): string {
  switch (action.actionType) {
    case 'run-action':
      return summarizeRunAction(action)
    case 'run-function':
      return summarizeRunFunction(action)
    case 'set-option':
      return `Setting: ${action.optionName || '(no option)'}`
    case 'set-variable':
      return `${action.scope}:${action.variableName || '(no variable)'}`
    case 'code-block':
      return summarizeCodeBlock(action)
    case 'run-custom-action':
      return summarizeRunCustomAction(action)
    default: {
      // Exhaustiveness check
      ;((_exhaustive: never) => _exhaustive)(action)
      return '(unknown action)'
    }
  }
}
