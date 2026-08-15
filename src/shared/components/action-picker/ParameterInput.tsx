import { FolderOpen } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import type { CatalogCommandParam } from '@/shared/types/catalog'

const COMMAND_SELECT_VALUE_PREFIX = '__vinela_command_select_value__:'

interface ParameterInputProps {
  readonly param: CatalogCommandParam
  readonly value: string
  readonly onChange: (value: string) => void
  readonly variant: 'default' | 'compact'
}

// Helper to detect if we're in browser/memory mode (no Tauri)
function isBrowserMode(): boolean {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)
}

interface FilePathInputProps {
  param: CatalogCommandParam
  value: string
  onChange: (value: string) => void
  inputId: string
  variant: 'default' | 'compact'
}

function FilePathInput({
  param,
  value,
  onChange,
  inputId,
  variant,
}: FilePathInputProps): React.JSX.Element {
  const [isPicking, setIsPicking] = useState(false)
  const browserMode = isBrowserMode()

  const handleBrowse = useCallback(async () => {
    if (browserMode) return

    setIsPicking(true)
    try {
      // Dynamic import to avoid loading Tauri APIs in browser mode
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: param.type === 'directory-path',
        multiple: false,
      })
      if (selected && typeof selected === 'string') {
        onChange(selected)
      }
    } catch {
      // Dialog plugin not available or user cancelled
    } finally {
      setIsPicking(false)
    }
  }, [browserMode, onChange, param.type])

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs">
        {param.label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleBrowse}
          onKeyDown={(event) => {
            if (variant === 'compact') event.stopPropagation()
          }}
          disabled={browserMode || isPicking}
          title={
            browserMode
              ? 'Browse not available in browser mode'
              : `Browse for ${param.type === 'directory-path' ? 'directory' : 'file'}`
          }
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function ParameterInput({
  param,
  value,
  onChange,
  variant,
}: ParameterInputProps): React.JSX.Element {
  const inputId = `param-${param.name}`

  switch (param.type) {
    case 'number':
      return (
        <div className="space-y-1">
          <Label htmlFor={inputId} className="text-xs">
            {param.label}
          </Label>
          <Input
            id={inputId}
            type="number"
            min={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.placeholder}
            className="font-mono"
          />
        </div>
      )

    case 'character':
      return (
        <div className="space-y-1">
          <Label htmlFor={inputId} className="text-xs">
            {param.label}
          </Label>
          <Input
            id={inputId}
            maxLength={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.placeholder}
            className="font-mono w-16"
          />
        </div>
      )

    case 'file-path':
    case 'directory-path':
      return (
        <FilePathInput
          param={param}
          value={value}
          onChange={onChange}
          inputId={inputId}
          variant={variant}
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(String(checked))}
            onKeyDown={(event) => {
              if (variant === 'compact') event.stopPropagation()
            }}
          />
          <div>
            <Label>{param.label}</Label>
            <p className="text-xs text-muted-foreground">{param.description}</p>
          </div>
        </div>
      )

    case 'select':
      return (
        <div className="space-y-1">
          <Label>
            {param.label}
            {param.required ? ' *' : ''}
          </Label>
          <p className="text-xs text-muted-foreground">{param.description}</p>
          <Select
            value={`${COMMAND_SELECT_VALUE_PREFIX}${value}`}
            onValueChange={(next) =>
              onChange(next.slice(COMMAND_SELECT_VALUE_PREFIX.length))
            }
          >
            <SelectTrigger
              className={variant === 'compact' ? 'h-8' : undefined}
              onKeyDown={(event) => {
                if (variant === 'compact') event.stopPropagation()
              }}
            >
              <SelectValue placeholder={param.placeholder} />
            </SelectTrigger>
            <SelectContent
              onKeyDown={(event) => {
                if (variant === 'compact') event.stopPropagation()
              }}
            >
              {param.allowedValues?.map((allowed) => (
                <SelectItem
                  key={allowed}
                  value={`${COMMAND_SELECT_VALUE_PREFIX}${allowed}`}
                >
                  <span>
                    {allowed || param.allowedValueDescriptions?.[allowed]}
                  </span>
                  {allowed && param.allowedValueDescriptions?.[allowed] && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {param.allowedValueDescriptions[allowed]}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    default: // 'string'
      return (
        <div className="space-y-1">
          <Label htmlFor={inputId} className="text-xs">
            {param.label}
          </Label>
          <Input
            id={inputId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={param.placeholder}
          />
        </div>
      )
  }
}
