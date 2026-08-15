import { HelpCircle, Keyboard } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { KeyCaptureDialog } from './KeyCaptureDialog'

interface KeyCaptureInputProps {
  /** Current key sequence value in Vim notation */
  value: string
  /** Called when the value changes */
  onChange: (value: string) => void
  /** Placeholder text for the input */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /**
   * Optional: leader key for auto-replacement in capture dialog.
   * When omitted, the leader replacement UI is hidden in the dialog.
   */
  leaderKey?: string
  /** Label text (defaults to "Key Sequence") */
  label?: string
  /** Whether to show the notation help popover (default: true) */
  showHelp?: boolean
}

export function KeyCaptureInput({
  value,
  onChange,
  placeholder = '<leader>ff',
  disabled = false,
  leaderKey,
  label = 'Key Sequence',
  showHelp = true,
}: KeyCaptureInputProps): React.JSX.Element {
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium">{label}</p>
        {showHelp && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Key notation help"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm" side="right" align="start">
              <div className="space-y-3">
                <p className="font-medium">Common Key Notations</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <code className="bg-muted px-1 rounded">
                      &lt;leader&gt;
                    </code>{' '}
                    Leader key
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;C-x&gt;</code>{' '}
                    Ctrl+x
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;A-x&gt;</code>{' '}
                    Alt+x
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;S-x&gt;</code>{' '}
                    Shift+x
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;CR&gt;</code>{' '}
                    Enter
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;Esc&gt;</code>{' '}
                    Escape
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;Tab&gt;</code>{' '}
                    Tab
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;BS&gt;</code>{' '}
                    Backspace
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;Space&gt;</code>{' '}
                    Space
                  </div>
                  <div>
                    <code className="bg-muted px-1 rounded">&lt;F1&gt;</code>{' '}
                    Function keys
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Combine modifiers:{' '}
                  <code className="bg-muted px-1 rounded">&lt;C-S-a&gt;</code>{' '}
                  for Ctrl+Shift+a
                </p>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono flex-1"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCaptureDialogOpen(true)}
          disabled={disabled}
          className="shrink-0"
        >
          <Keyboard className="h-4 w-4 mr-1.5" />
          Capture
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Type in Vim notation or click <strong>Capture</strong> to record key
        presses
      </p>

      <KeyCaptureDialog
        open={captureDialogOpen}
        onOpenChange={setCaptureDialogOpen}
        initialValue={value}
        onCapture={onChange}
        {...(leaderKey !== undefined ? { leaderKey } : {})}
      />
    </div>
  )
}
