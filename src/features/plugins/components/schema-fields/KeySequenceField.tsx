import { KeyCaptureInput } from '@/shared/components/KeyCaptureInput'
import type { SchemaKeySequenceOption } from '@/shared/types'
import type { FieldProps } from './types'

interface KeySequenceFieldProps extends FieldProps<string> {
  option: SchemaKeySequenceOption
}

export function KeySequenceField({
  option,
  value,
  onChange,
  disabled,
}: KeySequenceFieldProps): React.JSX.Element {
  return (
    <KeyCaptureInput
      value={value ?? ''}
      onChange={onChange}
      placeholder={option.default ?? 'e.g., <leader>ff'}
      disabled={disabled ?? false}
      showHelp={true}
    />
  )
}
