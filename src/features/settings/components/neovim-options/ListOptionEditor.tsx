import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import type { NeovimOptionChoice } from '@/shared/types/neovim-options'

export interface ListOptionEditorProps {
  valueType: 'string-list' | 'char-list'
  value: readonly string[]
  choices?: readonly NeovimOptionChoice[] | undefined
  isOrderSensitive?: boolean | undefined
  onChange: (value: string[]) => void
}

function uniqueOrdered(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }

  return result
}

function parseCustomTokens(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function ListOptionEditor({
  valueType,
  value,
  choices,
  isOrderSensitive = false,
  onChange,
}: ListOptionEditorProps): React.JSX.Element {
  const [customTokenInput, setCustomTokenInput] = useState('')

  const selected = uniqueOrdered(value)
  const selectedSet = new Set(selected)

  const toggleValue = (token: string): void => {
    if (selectedSet.has(token)) {
      onChange(selected.filter((entry) => entry !== token))
      return
    }

    onChange([...selected, token])
  }

  const removeValue = (token: string): void => {
    onChange(selected.filter((entry) => entry !== token))
  }

  const moveValue = (index: number, direction: -1 | 1): void => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= selected.length) {
      return
    }

    const nextValues = [...selected]
    const item = nextValues[index]
    if (!item) {
      return
    }

    nextValues[index] = nextValues[nextIndex] ?? item
    nextValues[nextIndex] = item
    onChange(nextValues)
  }

  const addCustomTokens = (): void => {
    const parsed = parseCustomTokens(customTokenInput)
    if (parsed.length === 0) {
      return
    }

    const next = uniqueOrdered([...selected, ...parsed])
    onChange(next)
    setCustomTokenInput('')
  }

  return (
    <div className="space-y-3">
      {choices !== undefined && choices.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => {
            const isChecked = selectedSet.has(choice.value)

            return (
              <label
                key={choice.value}
                className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                  checked={isChecked}
                  onChange={() => toggleValue(choice.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {choice.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {choice.description}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Selected values</p>
        {selected.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            No values selected.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((token, index) => (
              <Badge key={token} variant="secondary" className="gap-1">
                <span className="max-w-[12rem] truncate">{token}</span>
                {isOrderSensitive && (
                  <>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => moveValue(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${token} earlier`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => moveValue(index, 1)}
                      disabled={index === selected.length - 1}
                      aria-label={`Move ${token} later`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={() => removeValue(token)}
                  aria-label={`Remove ${token}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={customTokenInput}
            onChange={(event) => setCustomTokenInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCustomTokens()
              }
            }}
            placeholder={
              valueType === 'char-list'
                ? 'Add token (for example: r)'
                : 'Add token (comma-separated allowed)'
            }
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomTokens}
            disabled={customTokenInput.trim().length === 0}
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Add custom values not listed above.
          {isOrderSensitive ? ' Use arrows to set evaluation order.' : ''}
        </p>
      </div>
    </div>
  )
}
