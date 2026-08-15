import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import type { ActionPickerCustomProps } from './types'

export function ActionPickerCustom({
  value,
  onChange,
}: ActionPickerCustomProps): React.JSX.Element {
  return (
    <div className="flex-1 p-4 space-y-4">
      <div className="space-y-2">
        <Label>Action</Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=":write or gg"
          rows={3}
          className="font-mono"
        />
      </div>

      {/* Hints */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>
            Commands start with <code className="bg-muted px-1 rounded">:</code>{' '}
            (e.g., <code>:write</code>, <code>:quit</code>)
          </li>
          <li>
            Key sequences are literal keys (e.g., <code>gg</code>,{' '}
            <code>dd</code>)
          </li>
          <li>
            Use <code>&lt;C-x&gt;</code> for Ctrl+x, <code>&lt;CR&gt;</code> for
            Enter
          </li>
        </ul>
      </div>

      {/* Preview */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <code className="block p-2 rounded bg-muted font-mono text-sm">
          {value || '(empty)'}
        </code>
      </div>
    </div>
  )
}
