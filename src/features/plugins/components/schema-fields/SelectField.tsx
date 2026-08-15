import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import type { SchemaSelectOption } from '@/shared/types'

type SelectFieldValue = string | string[]

interface SelectFieldProps {
  option: SchemaSelectOption
  value: SelectFieldValue | undefined
  onChange: (value: SelectFieldValue) => void
  disabled?: boolean | undefined
  error?: string | undefined
}

export function SelectField({
  option,
  value,
  onChange,
  disabled,
}: SelectFieldProps): React.JSX.Element {
  // For multi-select, use checkboxes
  if (option.multi === true) {
    const selectedValues: string[] =
      value !== undefined && Array.isArray(value) ? value : []

    const handleToggle = (optValue: string): void => {
      const newValues = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue]
      onChange(newValues)
    }

    return (
      <div className="space-y-1.5">
        {option.options.map((opt) => {
          const isChecked = selectedValues.includes(opt.value)
          return (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(opt.value)}
                disabled={disabled}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors',
                  isChecked && 'bg-primary border-primary',
                )}
              >
                {isChecked && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <title>Checked</title>
                    <path
                      d="M8.5 2.5L3.5 7.5L1.5 5.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {opt.label}
            </label>
          )
        })}
      </div>
    )
  }

  // Single-select: value must be a string
  const singleValue = typeof value === 'string' ? value : undefined
  return (
    <Select
      value={singleValue ?? ''}
      onValueChange={onChange}
      disabled={disabled === true}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select an option..." />
      </SelectTrigger>
      <SelectContent>
        {option.options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
