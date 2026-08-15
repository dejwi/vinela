import { Terminal } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import type { SchemaExCommand } from '@/shared/types'

// ============================================
// Props
// ============================================

interface CommandsPanelProps {
  commands: SchemaExCommand[]
}

// ============================================
// Command card
// ============================================

function CommandCard({
  command,
}: {
  command: SchemaExCommand
}): React.JSX.Element {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-2">
      {/* Command name */}
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
        <code className="text-sm font-mono font-semibold">:{command.name}</code>
      </div>

      {/* Description */}
      {command.description !== '' && (
        <p className="text-sm text-muted-foreground">{command.description}</p>
      )}

      {/* Template */}
      {command.template !== '' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Usage</p>
          <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
            {command.template}
          </code>
        </div>
      )}

      {/* Example */}
      {command.example !== '' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Example</p>
          <code className="text-xs bg-muted px-2 py-1 rounded block font-mono text-green-600 dark:text-green-400">
            {command.example}
          </code>
        </div>
      )}

      {/* Parameters */}
      {command.params !== undefined && command.params.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Parameters</p>
          <div className="space-y-1">
            {command.params.map((param) => (
              <div key={param.name} className="flex items-start gap-2 text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                  {param.name}
                </code>
                <span className="text-muted-foreground">
                  {param.description}
                </span>
                {param.placeholder !== '' && (
                  <span className="text-muted-foreground/60 italic shrink-0">
                    e.g. {param.placeholder}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help reference */}
      {command.sourceDoc !== '' && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Help:</span>{' '}
          <code className="bg-muted px-1 py-0.5 rounded">
            {command.sourceDoc}
          </code>
        </p>
      )}
    </div>
  )
}

// ============================================
// Main component
// ============================================

export function CommandsPanel({
  commands,
}: CommandsPanelProps): React.JSX.Element {
  if (commands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Terminal className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-base font-semibold mb-2">No commands documented</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This plugin does not define any Ex commands in its schema.
        </p>
        {/* Future: Edit Schema link */}
        <p className="text-xs text-muted-foreground/60 mt-3">
          Schema authors can add commands to the{' '}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">
            exCommands
          </code>{' '}
          field.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-sm font-semibold">Ex Commands</h4>
        <Badge variant="secondary" className="text-xs">
          {commands.length}
        </Badge>
      </div>
      {commands.map((command) => (
        <CommandCard key={command.name} command={command} />
      ))}
    </div>
  )
}
