import { Input } from '@/shared/components/ui/input'
import type { SchemaNumberOption } from '@/shared/types'
import type { FieldProps } from './types'

interface NumberFieldProps extends FieldProps<number> {
  option: SchemaNumberOption
}

export function NumberField({
  option,
  value,
  onChange,
  disabled,
}: NumberFieldProps): React.JSX.Element {
  const validation = option.validation

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value
    if (raw === '') {
      // Allow clearing the field - propagate undefined to parent
      onChange(option.default ?? 0)
      return
    }
    const num = Number(raw)
    if (!Number.isNaN(num)) {
      onChange(num)
    }
  }

  return (
    <Input
      type="number"
      value={value !== undefined ? String(value) : ''}
      onChange={handleChange}
      placeholder={option.default !== undefined ? String(option.default) : ''}
      min={validation?.min}
      max={validation?.max}
      step={validation?.step}
      disabled={disabled}
    />
  )
}
