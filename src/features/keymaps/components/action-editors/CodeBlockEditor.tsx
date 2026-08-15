import { Textarea } from '@/shared/components/ui/textarea'

interface CodeBlockEditorProps {
  code: string
  onChange: (code: string) => void
}

export function CodeBlockEditor({
  code,
  onChange,
}: CodeBlockEditorProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Lua Code</p>
        <Textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          placeholder="-- Lua code to execute when key is pressed"
          className="min-h-[120px] font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Write Lua code to execute when this key is pressed. The code runs in
          Neovim's Lua environment with full API access.
        </p>
      </div>
    </div>
  )
}
