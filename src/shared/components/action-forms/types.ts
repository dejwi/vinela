import type { SetOptionActionConfig } from '@/shared/types'
import type { CatalogActionEntry } from '@/shared/types/catalog'

// ============================================
// SetOptionForm Types
// ============================================

export interface SetOptionFormProps {
  config: {
    optionName: string
    scope: 'global' | 'local'
    valueConfig: SetOptionActionConfig['valueConfig']
  }
  onChange: (config: SetOptionFormProps['config']) => void
  /** When true, shows "value from connection" placeholder instead of value input */
  isValueConnected?: boolean
  /** Whether to show the ActionEditorFrame wrapper (default: true) */
  showFrame?: boolean
}

export interface SetOptionFormValidationResult {
  errors: string[]
  warnings: string[]
}

// ============================================
// RunActionForm Types (formerly RunCommandForm)
// ============================================

export interface RunActionFormProps {
  catalog: readonly CatalogActionEntry[]
  config: {
    mode: 'catalog' | 'custom-command' | 'custom-keys'
    actionType: 'command' | 'keys'
    action: string
    selectedActionKey: string
    paramValues: Record<string, string>
  }
  onChange: (config: RunActionFormProps['config']) => void
  /** Whether to show the ActionEditorFrame wrapper (default: true) */
  showFrame?: boolean
}

export interface RunActionFormValidationResult {
  errors: string[]
  warnings: string[]
}

// ============================================
// SetVariableForm Types
// ============================================

export interface SetVariableFormProps {
  config: {
    scope: 'g' | 'b' | 'w' | 't' | 'v'
    variableName: string
    valueType: 'string' | 'number' | 'boolean' | 'raw'
    value: string | number | boolean
  }
  onChange: (config: SetVariableFormProps['config']) => void
  /** When true, shows "value from connection" placeholder instead of value input */
  isValueConnected?: boolean
  /** Whether to show the ActionEditorFrame wrapper (default: true) */
  showFrame?: boolean
}

export interface SetVariableFormValidationResult {
  errors: string[]
  warnings: string[]
}
