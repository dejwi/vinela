import { Keyboard } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getKeyDisplayName,
  normalizeToVimNotation,
} from '@/features/keymaps/utils/key-notation'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { SingleKeyCaptureDialog } from '../../components/SingleKeyCaptureDialog'

interface LeaderKeyControlProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const CUSTOM_SENTINEL = '\0'

const LEADER_KEY_PRESETS = [
  { value: ' ', label: 'Space', description: 'Most popular modern choice' },
  {
    value: '\\',
    label: 'Backslash (\\)',
    description: 'Traditional Vim default',
  },
  { value: ',', label: 'Comma (,)', description: 'Easy to reach' },
] as const

export function LeaderKeyControl({
  value,
  onChange,
  disabled = false,
}: LeaderKeyControlProps): React.JSX.Element {
  const [isUpdating, setIsUpdating] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)
  // Track whether user has explicitly selected "Custom" mode
  const [isCustomMode, setIsCustomMode] = useState(false)
  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DEBOUNCE_MS = 300

  // Find current preset if value matches one
  const currentPreset = LEADER_KEY_PRESETS.find((opt) => opt.value === value)

  // Initialize custom mode based on whether value matches a preset
  useEffect(() => {
    const matchesPreset = LEADER_KEY_PRESETS.some((opt) => opt.value === value)
    setIsCustomMode(!matchesPreset)
    if (!matchesPreset && value) {
      setCustomValue(value)
    }
  }, [value])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handlePresetChange = async (newValue: string): Promise<void> => {
    if (newValue === CUSTOM_SENTINEL) {
      // Switch to custom mode - keep current value as starting point
      setIsCustomMode(true)
      setCustomValue(value)
      return
    }

    // Switching to a preset
    setIsCustomMode(false)
    setIsUpdating(true)
    onChange(newValue)
    setIsUpdating(false)
  }

  // Debounced handler for custom value changes
  const handleCustomValueChange = useCallback(
    (newValue: string): void => {
      setCustomValue(newValue)

      // Clear any pending debounce
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }

      if (newValue.length > 0) {
        debounceTimerRef.current = setTimeout(() => {
          setIsUpdating(true)
          onChange(newValue)
          setIsUpdating(false)
        }, DEBOUNCE_MS)
      }
    },
    [onChange],
  )

  const handleCaptureKey = async (capturedKey: string): Promise<void> => {
    // The captured key is already in Vim notation from SingleKeyCaptureDialog
    // It could be '<Space>', '<Tab>', 'a', etc.
    // Normalize it to ensure consistent format
    const normalizedKey = normalizeToVimNotation(capturedKey)

    // For display, use the human-readable name
    const displayValue = getKeyDisplayName(normalizedKey)

    // Store the normalized notation but show the display name in the input
    // For single chars like 'a', '\', ',', use as-is
    // For special keys like '<Space>', store the notation
    const valueToStore =
      normalizedKey.startsWith('<') && normalizedKey.endsWith('>')
        ? normalizedKey
        : capturedKey

    setCustomValue(displayValue)
    setIsUpdating(true)
    onChange(valueToStore)
    setIsUpdating(false)
  }

  // Determine dropdown value: use CUSTOM_SENTINEL when in custom mode
  const dropdownValue = isCustomMode ? CUSTOM_SENTINEL : value

  return (
    <div className="space-y-3">
      {/* Preset dropdown */}
      <div className="flex items-center gap-2">
        <Select
          value={dropdownValue}
          onValueChange={(v) => void handlePresetChange(v)}
          disabled={disabled || isUpdating}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue>{currentPreset?.label ?? 'Custom'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LEADER_KEY_PRESETS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_SENTINEL}>
              <div className="flex flex-col">
                <span>Custom...</span>
                <span className="text-xs text-muted-foreground">
                  Set any key as your leader
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom key input - shown when "Custom" is selected */}
      {isCustomMode && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-medium">Custom Leader Key</p>
          <div className="flex gap-2">
            <Input
              value={customValue}
              onChange={(e) => handleCustomValueChange(e.target.value)}
              placeholder="Enter key (e.g., ;)"
              className="font-mono flex-1"
              disabled={isUpdating}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCaptureDialogOpen(true)}
              className="shrink-0"
            >
              <Keyboard className="h-4 w-4 mr-1.5" />
              Capture
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Type a key or click <strong>Capture</strong> to record a keypress
          </p>
        </div>
      )}

      {/* Visual preview */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground mb-2">Preview:</p>
        <p className="text-sm">
          <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
            &lt;leader&gt;ff
          </code>
          {' → Press '}
          <kbd className="bg-background border px-1.5 py-0.5 rounded text-xs font-mono">
            {value === ' ' ? 'Space' : value || '?'}
          </kbd>
          {' then '}
          <kbd className="bg-background border px-1.5 py-0.5 rounded text-xs font-mono">
            f
          </kbd>
          {' then '}
          <kbd className="bg-background border px-1.5 py-0.5 rounded text-xs font-mono">
            f
          </kbd>
        </p>
      </div>

      {/* Single key capture dialog for custom leader key */}
      <SingleKeyCaptureDialog
        open={captureDialogOpen}
        onOpenChange={setCaptureDialogOpen}
        onCapture={handleCaptureKey}
      />
    </div>
  )
}
