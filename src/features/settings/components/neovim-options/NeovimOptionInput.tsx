import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import type {
  NeovimOptionDefinition,
  NeovimOptionStoredValue,
} from '@/shared/types/neovim-options'
import { ListOptionEditor } from './ListOptionEditor'

const EMPTY_SELECT_VALUE = '__vinela_empty_value__'

function clampToRange(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) {
    return min
  }
  if (max !== undefined && value > max) {
    return max
  }
  return value
}

function getDefaultString(option: NeovimOptionDefinition): string {
  return typeof option.defaultValue === 'string' ? option.defaultValue : ''
}

function getDefaultNumber(option: NeovimOptionDefinition): number {
  return typeof option.defaultValue === 'number' ? option.defaultValue : 0
}

function getDefaultBoolean(option: NeovimOptionDefinition): boolean {
  return typeof option.defaultValue === 'boolean' ? option.defaultValue : false
}

function getDefaultList(option: NeovimOptionDefinition): string[] {
  return Array.isArray(option.defaultValue) ? [...option.defaultValue] : []
}

export interface NeovimOptionInputProps {
  option: NeovimOptionDefinition
  value: NeovimOptionStoredValue
  onChange: (value: NeovimOptionStoredValue) => void
}

interface TypedInputProps {
  option: NeovimOptionDefinition
  value: NeovimOptionStoredValue
  onChange: (value: NeovimOptionStoredValue) => void
}

function BooleanOptionInput({
  option,
  value,
  onChange,
}: TypedInputProps): React.JSX.Element {
  const checked =
    value.valueType === 'boolean' ? value.value : getDefaultBoolean(option)

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        onCheckedChange={(nextChecked) => {
          onChange({ valueType: 'boolean', value: nextChecked === true })
        }}
        aria-label={option.label}
      />
      <span className="text-sm text-muted-foreground">
        {checked ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  )
}

function NumberOptionInput({
  option,
  value,
  onChange,
}: TypedInputProps): React.JSX.Element {
  const numberValue =
    value.valueType === 'number' ? value.value : getDefaultNumber(option)

  return (
    <div className="space-y-2">
      <Input
        type="number"
        min={option.min}
        max={option.max}
        value={numberValue}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isNaN(parsed)) {
            return
          }

          onChange({
            valueType: 'number',
            value: clampToRange(parsed, option.min, option.max),
          })
        }}
      />
      {(option.min !== undefined || option.max !== undefined) && (
        <p className="text-xs text-muted-foreground">
          Range: {option.min ?? '-infinity'} to {option.max ?? 'infinity'}
        </p>
      )}
    </div>
  )
}

function StringOptionInput({
  option,
  value,
  onChange,
}: TypedInputProps): React.JSX.Element {
  const stringValue =
    value.valueType === 'string' ? value.value : getDefaultString(option)

  if (option.choices !== undefined && option.choices.length > 0) {
    const selectValue = stringValue === '' ? EMPTY_SELECT_VALUE : stringValue

    return (
      <Select
        value={selectValue}
        onValueChange={(nextValue) => {
          onChange({
            valueType: 'string',
            value:
              nextValue === EMPTY_SELECT_VALUE
                ? ''
                : (nextValue ?? getDefaultString(option)),
          })
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a value" />
        </SelectTrigger>
        <SelectContent>
          {option.choices.map((choice) => (
            <SelectItem
              key={`${option.name}-${choice.value}`}
              value={choice.value === '' ? EMPTY_SELECT_VALUE : choice.value}
            >
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Input
      type="text"
      value={stringValue}
      onChange={(event) => {
        onChange({ valueType: 'string', value: event.target.value })
      }}
      placeholder="Enter a value"
    />
  )
}

function StringListOptionInput({
  option,
  value,
  onChange,
}: TypedInputProps): React.JSX.Element {
  const listValue =
    value.valueType === 'string-list' ? value.value : getDefaultList(option)

  return (
    <ListOptionEditor
      valueType="string-list"
      value={listValue}
      choices={option.choices}
      isOrderSensitive={option.isOrderSensitive}
      onChange={(nextValue) => {
        onChange({ valueType: 'string-list', value: nextValue })
      }}
    />
  )
}

function CharListOptionInput({
  option,
  value,
  onChange,
}: TypedInputProps): React.JSX.Element {
  const listValue =
    value.valueType === 'char-list' ? value.value : getDefaultList(option)

  return (
    <ListOptionEditor
      valueType="char-list"
      value={listValue}
      choices={option.choices}
      isOrderSensitive={option.isOrderSensitive}
      onChange={(nextValue) => {
        onChange({ valueType: 'char-list', value: nextValue })
      }}
    />
  )
}

export function NeovimOptionInput({
  option,
  value,
  onChange,
}: NeovimOptionInputProps): React.JSX.Element {
  switch (option.valueType) {
    case 'boolean':
      return (
        <BooleanOptionInput option={option} value={value} onChange={onChange} />
      )

    case 'number':
      return (
        <NumberOptionInput option={option} value={value} onChange={onChange} />
      )

    case 'string':
      return (
        <StringOptionInput option={option} value={value} onChange={onChange} />
      )

    case 'string-list':
      return (
        <StringListOptionInput
          option={option}
          value={value}
          onChange={onChange}
        />
      )

    case 'char-list':
      return (
        <CharListOptionInput
          option={option}
          value={value}
          onChange={onChange}
        />
      )

    default: {
      const exhaustive: never = option.valueType
      throw new Error(`Unsupported option value type: ${exhaustive as string}`)
    }
  }
}
