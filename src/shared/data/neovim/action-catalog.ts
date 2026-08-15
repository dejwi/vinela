import type { CatalogCommandParam } from '@/shared/types/catalog'

// ============================================
// Consolidated Action Categories (10 total)
// ============================================

export type ActionCategory =
  | 'file' // File operations (save, quit, edit, reload)
  | 'copy-paste' // Clipboard + registers (unified)
  | 'navigation' // Marks + jumps + go-to (unified)
  | 'editing' // Text manipulation, undo/redo, repeat
  | 'layout' // Tabs + windows (unified)
  | 'lists' // Quickfix + location list (unified)
  | 'folding' // Code folding
  | 'search' // Search operations
  | 'help' // Help commands
  | 'diagnostics' // LSP diagnostics

export const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  file: 'File',
  'copy-paste': 'Copy & Paste',
  navigation: 'Navigation',
  editing: 'Editing',
  layout: 'Layout',
  lists: 'Lists',
  folding: 'Folding',
  search: 'Search',
  help: 'Help',
  diagnostics: 'Diagnostics',
}

export const ACTION_CATEGORY_ICONS: Record<ActionCategory, string> = {
  file: 'File',
  'copy-paste': 'Clipboard',
  navigation: 'Compass',
  editing: 'Edit3',
  layout: 'Layout',
  lists: 'List',
  folding: 'ChevronsDownUp',
  search: 'Search',
  help: 'HelpCircle',
  diagnostics: 'Activity',
}

// All categories in display order
export const ACTION_CATEGORIES: ActionCategory[] = [
  'file',
  'copy-paste',
  'navigation',
  'editing',
  'layout',
  'lists',
  'folding',
  'search',
  'help',
  'diagnostics',
]

// ============================================
// Simplified Parameter Types (4 total)
// ============================================

export type ActionParamType =
  | 'string' // Free text input (also used for register, mark, motion)
  | 'number' // Numeric input (line number, count, tab number)
  | 'character' // Single character
  | 'file-path' // File path with browse button

export interface ActionParameter {
  name: string
  type: ActionParamType
  label: string
  placeholder: string
  description: string
  required: boolean
  defaultValue?: string
  /** Validation hint for special string types */
  hint?: 'register' | 'mark' | 'motion'
}

// ============================================
// Catalog Entry Types
// ============================================

export interface ActionCatalogEntry {
  /** Simple unique key: 'write', 'yank-clipboard', 'set-mark' */
  key: string

  /** Action type */
  type: 'command' | 'keys'

  /** Category for grouping */
  category: ActionCategory

  /** User-friendly label shown in grid */
  label: string

  /** Short description (1 line) */
  shortDescription: string

  /** Detailed explanation for beginners */
  whatItDoes: string

  /** Technical note for advanced users (optional) */
  technicalNote?: string

  /** The action template with {param} placeholders */
  template: string

  /** Example usage */
  example: string

  /** Help reference */
  sourceDoc: string

  /** Parameters for this action */
  params?: ActionParameter[]

  /** Whether this is shown in Popular view (~15-20 actions) */
  isPopular?: boolean

  /** Search aliases (alternative names users might search for) */
  aliases?: string[]
}

// ============================================
// Helper Functions
// ============================================

/**
 * Resolves an action template by substituting {param} placeholders with values.
 * Missing or empty param values result in the placeholder being removed.
 */
export function resolveActionTemplate(
  template: string,
  paramValues: Readonly<Record<string, string>>,
  params: readonly CatalogCommandParam[],
): string {
  return template
    .replace(/\{(\w+)\}/g, (_match, paramName) => {
      const param = params.find((candidate) => candidate.name === paramName)
      const value = paramValues[paramName] ?? param?.default ?? ''
      if (!param || value.length === 0) return ''
      const escaped =
        param.escape === 'ex-argument' ? escapeExArgument(value) : value
      if (param.emit?.kind === 'flag') {
        return value === 'true' ? param.emit.token : ''
      }
      if (param.emit?.kind === 'option') {
        return `${param.emit.prefix} ${escaped}`
      }
      return escaped
    })
    .replace(/^\s+/, '')
    .replace(/(?<!\\)\s+$/, '')
}

function escapeExArgument(value: string): string {
  return value
    .replace(/[\t\n *?[{`$\\%#'"|!]/g, '\\$&')
    .replace(/^([+>])/, '\\$1')
    .replace(/^-$/, '\\-')
}

/**
 * Checks if an action has parameters defined.
 */
export function hasActionParams(
  action: ActionCatalogEntry | undefined | null,
): boolean {
  return (
    action !== undefined &&
    action !== null &&
    action.params !== undefined &&
    action.params.length > 0
  )
}

/**
 * Get the category label for an action category.
 */
export function getActionCategoryLabel(category: ActionCategory): string {
  return ACTION_CATEGORY_LABELS[category]
}

/**
 * Get the category icon name for an action category.
 */
export function getActionCategoryIcon(category: ActionCategory): string {
  return ACTION_CATEGORY_ICONS[category]
}
