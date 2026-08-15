import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/shared/components/ui/input'

interface NumberSettingProps {
  /** Unique ID for the input element */
  id: string
  /** Current value */
  value: number
  /** Called when value changes (after debounce) */
  onChange: (value: number) => void
  /** Minimum allowed value */
  min: number
  /** Maximum allowed value */
  max: number
  /** Step increment for arrow keys */
  step: number
  /** Unit label displayed after the input (e.g., "ms", "px") */
  unit: string
  /** Optional aria-describedby ID */
  describedBy?: string
}

/** Debounce delay before persisting the value */
const SAVE_DEBOUNCE_MS = 500

export function NumberSetting({
  id,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  describedBy,
}: NumberSettingProps): React.JSX.Element {
  // Local state for immediate UI feedback
  const [localValue, setLocalValue] = useState(String(value))
  const debounceRef = useRef<number | null>(null)

  // Sync from prop when it changes externally
  useEffect(() => {
    setLocalValue(String(value))
  }, [value])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      setLocalValue(raw)

      // Cancel previous debounce
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }

      if (raw.trim() === '') {
        return
      }

      // Parse and validate
      const parsed = Number(raw)
      if (Number.isNaN(parsed)) return

      const clamped = Math.min(Math.max(parsed, min), max)

      // Debounce the save
      debounceRef.current = window.setTimeout(() => {
        onChange(clamped)
        // Update local display to clamped value
        setLocalValue(String(clamped))
      }, SAVE_DEBOUNCE_MS)
    },
    [onChange, min, max],
  )

  // On blur: immediately apply clamped value
  const handleBlur = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (localValue.trim() === '') {
      setLocalValue(String(value))
      return
    }

    const parsed = Number(localValue)
    if (Number.isNaN(parsed)) {
      // Revert to current value
      setLocalValue(String(value))
      return
    }

    const clamped = Math.min(Math.max(parsed, min), max)
    setLocalValue(String(clamped))
    if (clamped !== value) {
      onChange(clamped)
    }
  }, [localValue, value, onChange, min, max])

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        className="w-24 text-right font-mono tabular-nums"
        aria-describedby={describedBy}
      />
      <span className="text-sm text-muted-foreground select-none">{unit}</span>
    </div>
  )
}
