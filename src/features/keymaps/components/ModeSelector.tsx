import type { KeymapMode } from '@/shared/types'
import { MODE_LABELS, MODE_ORDER } from '../constants'

interface ModeSelectorProps {
  selected: KeymapMode[]
  onChange: (modes: KeymapMode[]) => void
}

export function ModeSelector({
  selected,
  onChange,
}: ModeSelectorProps): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">Modes</p>
      <p className="text-xs text-muted-foreground">
        Choose which Vim modes this shortcut works in
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODE_ORDER.map((mode) => {
          const checked = selected.includes(mode)
          return (
            <label
              key={mode}
              className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={checked}
                aria-label={`${MODE_LABELS[mode]} mode`}
                onChange={() => {
                  const nextModes = checked
                    ? selected.filter((entry) => entry !== mode)
                    : [...selected, mode]
                  onChange(nextModes)
                }}
              />
              <span>
                {mode} - {MODE_LABELS[mode]}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
