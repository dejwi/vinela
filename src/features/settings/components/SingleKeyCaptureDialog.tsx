import { Circle, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { keyEventToVimNotation } from '@/features/keymaps/utils/key-notation'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'

interface SingleKeyCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (key: string) => void
}

export function SingleKeyCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: SingleKeyCaptureDialogProps): React.JSX.Element {
  const [capturedKey, setCapturedKey] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  // Track when capture was just started to ignore the triggering keypress
  const captureStartTimeRef = useRef<number>(0)
  // Debounce threshold to ignore keypresses that triggered the capture button
  const ACTIVATION_DEBOUNCE_MS = 100

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCapturedKey(null)
      setIsCapturing(false)
      captureStartTimeRef.current = 0
    }
  }, [open])

  const startCapture = useCallback(() => {
    captureStartTimeRef.current = Date.now()
    setIsCapturing(true)
    setCapturedKey(null)
  }, [])

  const stopCapture = useCallback(() => {
    setIsCapturing(false)
  }, [])

  // Keyboard event handler - captures single key then stops
  useEffect(() => {
    if (!isCapturing) return

    function handleKeyDown(event: KeyboardEvent) {
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
        setCapturedKey(vimNotation)
        setIsCapturing(false) // Auto-stop after capturing one key
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isCapturing])

  const displayKey = capturedKey === '<Space>' ? 'Space' : capturedKey

  // Screen reader announcement text
  const getStatusAnnouncement = (): string => {
    if (isCapturing) {
      return 'Recording. Press a key now.'
    }
    return capturedKey !== null
      ? `Captured key: ${displayKey}`
      : 'Ready to capture a key.'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Capture Leader Key</DialogTitle>
          <DialogDescription>
            Press the key you want to use as your leader key.
          </DialogDescription>
        </DialogHeader>

        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {getStatusAnnouncement()}
        </div>

        <div className="space-y-4">
          {/* Captured key display - with recording indicator */}
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
            {capturedKey !== null ? (
              <kbd className="text-lg font-mono font-semibold bg-background border px-3 py-1.5 rounded">
                {displayKey}
              </kbd>
            ) : (
              <p className="text-muted-foreground">
                {isCapturing ? 'Press a key...' : 'Click "Start" to capture'}
              </p>
            )}
          </div>

          {/* Capture controls */}
          <div className="flex justify-center gap-2">
            {isCapturing ? (
              <Button onClick={stopCapture} variant="secondary" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            ) : (
              <Button onClick={startCapture} size="sm">
                <Circle className="h-4 w-4 mr-2 text-red-500" />
                {capturedKey !== null ? 'Recapture' : 'Start'}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (capturedKey) {
                onCapture(capturedKey)
                onOpenChange(false)
              }
            }}
            disabled={!capturedKey}
          >
            Use This Key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
