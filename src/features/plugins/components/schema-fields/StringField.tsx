import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import type { SchemaStringOption } from '@/shared/types'
import type { FieldProps } from './types'

interface StringFieldProps extends FieldProps<string> {
  option: SchemaStringOption
}

export function StringField({
  option,
  value,
  onChange,
  disabled,
}: StringFieldProps): React.JSX.Element {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    onChange(e.target.value)
  }

  if (option.uiHint === 'textarea') {
    return (
      <Textarea
        value={value ?? ''}
        onChange={handleChange}
        placeholder={option.default ?? ''}
        disabled={disabled}
        rows={4}
      />
    )
  }

  return (
    <Input
      type="text"
      value={value ?? ''}
      onChange={handleChange}
      placeholder={option.default ?? ''}
      disabled={disabled}
    />
  )
}
