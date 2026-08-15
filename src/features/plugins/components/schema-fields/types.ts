import type { PluginConfigValue } from '@/shared/types'

export interface FieldProps<T extends PluginConfigValue = PluginConfigValue> {
  /** The current value (may be undefined if not yet configured) */
  value: T | undefined
  /** Callback when value changes */
  onChange: (value: T) => void
  /** Whether the field is disabled */
  disabled?: boolean | undefined
  /** Validation error message, if any */
  error?: string | undefined
}
