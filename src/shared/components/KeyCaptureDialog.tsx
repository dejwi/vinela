import { Circle, Settings, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  applyLeaderReplacement,
  keyEventToVimNotation,
} from '@/shared/lib/key-notation'

interface KeyCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current key sequence value (for display/editing) */
  initialValue: string
  /** Called when user confirms the captured sequence */
  onCapture: (keySequence: string) => void
  /**
   * The configured leader key from settings.
   * When omitted, the leader auto-replace UI is hidden.
   */
  leaderKey?: string
}

export function KeyCaptureDialog({
  open,
  onOpenChange,
  initialValue,
  onCapture,
  leaderKey,
}: KeyCaptureDialogProps): React.JSX.Element {
  const [capturedKeys, setCapturedKeys] = useState<string[]>([])
  const [autoReplaceLeader, setAutoReplaceLeader] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  // Track when capture was just started to ignore the triggering keypress
  const captureStartTimeRef = useRef<number>(0)
  // Debounce threshold to ignore keypresses that triggered the capture button
  const ACTIVATION_DEBOUNCE_MS = 100

  // Reset state when dialog opens, stop capture when dialog closes
  useEffect(() => {
    if (open) {
      // Parse initial value into individual keys if possible
      const parsed = parseKeySequence(initialValue)
      setCapturedKeys(parsed)
      setAutoReplaceLeader(true)
      setIsCapturing(false)
      captureStartTimeRef.current = 0
    } else {
      // Stop capture when dialog closes to prevent lingering event listeners
      setIsCapturing(false)
    }
  }, [open, initialValue])

  const startCapture = useCallback(() => {
    captureStartTimeRef.current = Date.now()
    setIsCapturing(true)
    setCapturedKeys([])
  }, [])

  const stopCapture = useCallback(() => {
    setIsCapturing(false)
  }, [])

  // Keyboard event handler
  useEffect(() => {
    if (!isCapturing) return

    function handleKeyDown(event: KeyboardEvent) {
      // Prevent default browser behavior
      event.preventDefault()
      event.stopPropagation()

      // Ignore modifier-only keypresses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        return
      }

      // Handle Escape key - cancels capture mode instead of capturing it
      if (event.key === 'Escape') {
        setIsCapturing(false)
        return
      }

      // Ignore keypresses that occurred immediately after starting capture
      // (likely the same keypress that activated the button via keyboard)
      const timeSinceStart = Date.now() - captureStartTimeRef.current
      if (timeSinceStart < ACTIVATION_DEBOUNCE_MS) {
        return
      }

      const vimNotation = keyEventToVimNotation(event)
      if (vimNotation) {
        setCapturedKeys((prev) => [...prev, vimNotation])
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCapturing])

  const displaySequence =
    leaderKey !== undefined
      ? applyLeaderReplacement(
          capturedKeys.join(''),
          leaderKey,
          autoReplaceLeader,
        )
      : capturedKeys.join('')

  const leaderDisplayName =
    leaderKey !== undefined
      ? leaderKey === ' '
        ? 'Space'
        : leaderKey
      : undefined

  // Screen reader announcement text
  const getStatusAnnouncement = (): string => {
    if (isCapturing) {
      return capturedKeys.length > 0
        ? `Captured ${capturedKeys.length} keys: ${displaySequence}. Press more keys or stop capture.`
        : 'Recording. Press keys now.'
    }
    return capturedKeys.length > 0
      ? `Captured sequence: ${displaySequence}`
      : 'Ready to capture keys.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capture Key Sequence</DialogTitle>
          <DialogDescription>
            Press the keys you want to use for this shortcut. The sequence will
            be converted to Vim notation automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {getStatusAnnouncement()}
        </div>

        <div className="space-y-4">
          {/* Captured keys display - with recording indicator */}
          <div
            className={`min-h-[60px] rounded-lg border-2 border-dashed p-4 text-center transition-all ${
              isCapturing
                ? 'border-red-500 bg-red-500/5 animate-pulse'
                : 'border-muted-foreground/25 bg-muted/50'
            }`}
          >
            {/* Recording indicator */}
            {isCapturing && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  Recording
                </span>
              </div>
            )}
            {capturedKeys.length > 0 ? (
              <code className="text-lg font-mono font-semibold">
                {displaySequence}
              </code>
            ) : (
              <p className="text-muted-foreground">
                {isCapturing
                  ? 'Press keys now...'
                  : 'Click "Start Capture" to begin'}
              </p>
            )}
          </div>

          {/* Capture controls */}
          <div className="flex justify-center gap-2">
            {isCapturing ? (
              <Button onClick={stopCapture} variant="secondary">
                <Square className="h-4 w-4 mr-2" />
                Stop Capture
              </Button>
            ) : (
              <Button onClick={startCapture}>
                <Circle className="h-4 w-4 mr-2 text-red-500" />
                {capturedKeys.length > 0 ? 'Recapture' : 'Start Capture'}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setCapturedKeys([])}
              disabled={capturedKeys.length === 0}
            >
              Clear
            </Button>
          </div>

          {/* Auto-replace leader checkbox — only shown when leaderKey is provided */}
          {leaderDisplayName !== undefined && (
            <label className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
              <input
                type="checkbox"
                checked={autoReplaceLeader}
                onChange={(e) => setAutoReplaceLeader(e.target.checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium">
                  Auto-replace leader key
                </span>
                <p className="text-xs text-muted-foreground">
                  When enabled, pressing your leader key ({leaderDisplayName})
                  at the start will be converted to{' '}
                  <code className="bg-muted px-1 rounded">&lt;leader&gt;</code>.
                  This makes your shortcuts portable across different Neovim
                  setups.
                </p>
              </div>
            </label>
          )}

          {/* Help text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Tip:</strong> Most shortcuts start with the leader key
              followed by 1-2 letters.
            </p>
            <p>
              Example: Press <kbd>Space</kbd> then <kbd>f</kbd> then{' '}
              <kbd>f</kbd> for a "find files" shortcut.
            </p>
            {leaderDisplayName !== undefined && (
              <div className="flex items-center gap-1 pt-1">
                <Settings className="h-3 w-3" />
                <span>Your leader key is </span>
                <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                  {leaderDisplayName}
                </kbd>
                <span>—</span>
                <Link
                  to="/neovim-options"
                  className="text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Change it
                </Link>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onCapture(displaySequence)
              onOpenChange(false)
            }}
            disabled={capturedKeys.length === 0}
          >
            Use This Sequence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Parse a key sequence string into individual key components.
 * Handles both special keys like <leader>, <C-a> and regular characters.
 *
 * Uses a more robust approach that validates bracket contents to avoid
 * issues with nested or malformed brackets.
 */
function parseKeySequence(sequence: string): string[] {
  if (!sequence) return []

  const keys: string[] = []
  let i = 0

  while (i < sequence.length) {
    const char = sequence[i]
    if (char === undefined) break

    if (char === '<') {
      // Look for a valid special key pattern: <[A-Za-z0-9-]+>
      // This avoids issues with nested brackets or malformed sequences
      const remaining = sequence.slice(i)
      const match = remaining.match(/^<[A-Za-z0-9-]+>/)

      if (match !== null) {
        // Valid special key found
        keys.push(match[0])
        i += match[0].length
      } else {
        // Not a valid special key pattern, treat < as literal
        keys.push(char)
        i++
      }
    } else {
      // Regular character
      keys.push(char)
      i++
    }
  }

  return keys
}
