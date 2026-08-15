import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { ResetOptionConfirm } from './ResetOptionConfirm'

interface OptionResetButtonProps {
  optionLabel: string
  scope: 'lua' | 'object' | 'simple'
  disabled?: boolean | undefined
  onReset: () => void
}

function descriptionForScope(
  scope: 'lua' | 'object' | 'simple',
  optionLabel: string,
): string {
  switch (scope) {
    case 'lua':
      return 'Your edited value and any include-toggle override will be cleared.'
    case 'object':
      return `Your edits to all sub-fields under "${optionLabel}" will be cleared.`
    case 'simple':
      return 'Your edited value will be cleared.'
    default: {
      const _exhaustive: never = scope
      throw new Error(`Unhandled reset scope: ${String(_exhaustive)}`)
    }
  }
}

export function OptionResetButton({
  optionLabel,
  scope,
  disabled,
  onReset,
}: OptionResetButtonProps): React.JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-60 hover:opacity-100"
        {...(disabled !== undefined ? { disabled } : {})}
        onClick={() => setShowConfirm(true)}
        aria-label={`Reset "${optionLabel}" to default`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>

      <ResetOptionConfirm
        open={showConfirm}
        optionLabel={optionLabel}
        description={descriptionForScope(scope, optionLabel)}
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false)
          onReset()
        }}
      />
    </>
  )
}
