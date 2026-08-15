import { Switch } from '@/shared/components/ui/switch'
import type { SchemaBooleanOption } from '@/shared/types'
import type { FieldProps } from './types'

interface BooleanFieldProps extends FieldProps<boolean> {
  option: SchemaBooleanOption
}

export function BooleanField({
  option,
  value,
  onChange,
  disabled,
}: BooleanFieldProps): React.JSX.Element {
  const isOn = value ?? option.default ?? false

  return (
    <Switch
      checked={isOn}
      onCheckedChange={(checked) => onChange(checked)}
      disabled={disabled}
      aria-label={option.label}
      size="sm"
    />
  )
}
