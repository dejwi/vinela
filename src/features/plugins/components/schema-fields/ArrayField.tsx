import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { PluginConfigValue, SchemaArrayOption } from '@/shared/types'
import type { FieldProps } from './types'

interface ArrayFieldProps extends FieldProps<PluginConfigValue[]> {
  option: SchemaArrayOption
}

/** Tuple of [stableId, value] for array items with stable React keys */
type KeyedItem = { id: number; value: PluginConfigValue }

function areConfigValuesEqual(
  left: PluginConfigValue,
  right: PluginConfigValue,
): boolean {
  if (left === right) {
    return true
  }

  const leftType = typeof left
  const rightType = typeof right
  if (
    (leftType === 'object' && left !== null) ||
    (rightType === 'object' && right !== null)
  ) {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return false
}

function areArrayValuesEqual(
  current: KeyedItem[],
  incoming: PluginConfigValue[],
): boolean {
  if (current.length !== incoming.length) {
    return false
  }

  for (let i = 0; i < current.length; i += 1) {
    const currentItem = current[i]
    const incomingItem = incoming[i]
    if (
      currentItem === undefined ||
      incomingItem === undefined ||
      !areConfigValuesEqual(currentItem.value, incomingItem)
    ) {
      return false
    }
  }

  return true
}

export function ArrayField({
  option,
  value,
  onChange,
  disabled,
}: ArrayFieldProps): React.JSX.Element {
  const nextIdRef = useRef(0)
  const normalizedValue = value ?? []

  // Initialize keyed items from incoming value
  const [keyedItems, setKeyedItems] = useState<KeyedItem[]>(() =>
    normalizedValue.map((v) => ({ id: nextIdRef.current++, value: v })),
  )

  useEffect(() => {
    const incomingValue = value ?? []
    setKeyedItems((prev) => {
      if (areArrayValuesEqual(prev, incomingValue)) {
        return prev
      }

      return incomingValue.map((itemValue) => ({
        id: nextIdRef.current++,
        value: itemValue,
      }))
    })
  }, [value])

  // Sync keyed items back to parent on mutations
  const emitChange = (items: KeyedItem[]): void => {
    setKeyedItems(items)
    onChange(items.map((item) => item.value))
  }

  const handleAdd = (): void => {
    let newItem: PluginConfigValue
    switch (option.items.itemType) {
      case 'string':
        newItem = ''
        break
      case 'number':
        newItem = 0
        break
      case 'select':
        newItem = option.items.options[0]?.value ?? ''
        break
    }
    emitChange([...keyedItems, { id: nextIdRef.current++, value: newItem }])
  }

  const handleRemove = (id: number): void => {
    emitChange(keyedItems.filter((item) => item.id !== id))
  }

  const handleItemChange = (id: number, newValue: PluginConfigValue): void => {
    emitChange(
      keyedItems.map((item) =>
        item.id === id ? { ...item, value: newValue } : item,
      ),
    )
  }

  const minReached =
    option.validation?.minItems !== undefined &&
    keyedItems.length <= option.validation.minItems
  const maxReached =
    option.validation?.maxItems !== undefined &&
    keyedItems.length >= option.validation.maxItems

  return (
    <div className="space-y-2">
      {keyedItems.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <ArrayItemInput
            itemType={option.items}
            value={item.value}
            onChange={(v) => handleItemChange(item.id, v)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(item.id)}
            disabled={disabled === true || minReached}
            aria-label="Remove item"
            className="h-9 w-9 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled === true || maxReached}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add item
      </Button>
    </div>
  )
}

interface ArrayItemInputProps {
  itemType: SchemaArrayOption['items']
  value: PluginConfigValue
  onChange: (value: PluginConfigValue) => void
  disabled?: boolean | undefined
}

function ArrayItemInput({
  itemType,
  value,
  onChange,
  disabled,
}: ArrayItemInputProps): React.JSX.Element {
  switch (itemType.itemType) {
    case 'string':
      return (
        <Input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
          disabled={disabled}
          className="flex-1"
        />
      )
    case 'number':
      return (
        <Input
          type="number"
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const num = Number(e.target.value)
            if (!Number.isNaN(num)) {
              onChange(num)
            }
          }}
          disabled={disabled}
          className="flex-1"
        />
      )
    case 'select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          disabled={disabled === true}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {itemType.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
  }
}
