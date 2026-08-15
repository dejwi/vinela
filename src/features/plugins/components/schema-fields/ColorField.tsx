import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import type { SchemaColorOption } from '@/shared/types'
import type { FieldProps } from './types'

interface ColorFieldProps extends FieldProps<string> {
  option: SchemaColorOption
}

export function ColorField({
  option,
  value,
  onChange,
  disabled,
  error,
}: ColorFieldProps): React.JSX.Element {
  const [localError, setLocalError] = useState<string | null>(null)
  const currentValue = value ?? option.default ?? ''
  const format = option.format ?? 'hex'

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(currentValue)
  const isValidRgb = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(currentValue)
  const isValidHsl = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(
    currentValue,
  )

  const handleBlur = (): void => {
    if (currentValue === '') {
      setLocalError(null)
      return
    }

    let isValid = false
    switch (format) {
      case 'hex':
        isValid = isValidHex
        break
      case 'rgb':
        isValid = isValidRgb
        break
      case 'hsl':
        isValid = isValidHsl
        break
    }

    if (!isValid) {
      setLocalError(`Invalid ${format} format`)
    } else {
      setLocalError(null)
    }
  }

  const getPlaceholder = (): string => {
    switch (format) {
      case 'hex':
        return '#000000'
      case 'rgb':
        return 'rgb(0, 0, 0)'
      case 'hsl':
        return 'hsl(0, 0%, 0%)'
    }
  }

  const showError = localError ?? error

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          className="h-9 w-9 shrink-0 rounded-md border border-input"
          style={{
            backgroundColor:
              (format === 'hex' && isValidHex) ||
              (format === 'rgb' && isValidRgb) ||
              (format === 'hsl' && isValidHsl)
                ? currentValue
                : 'transparent',
          }}
          aria-hidden="true"
        />
        <Input
          type="text"
          value={currentValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value)
            setLocalError(null)
          }}
          onBlur={handleBlur}
          placeholder={getPlaceholder()}
          disabled={disabled}
        />
      </div>
      {showError !== undefined && (
        <p className="text-xs text-destructive">{showError}</p>
      )}
    </div>
  )
}
