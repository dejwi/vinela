import { ExternalLink } from 'lucide-react'
import { CommandParameterFields } from '@/shared/components/action-forms/CommandParameterFields'
import { Button } from '@/shared/components/ui/button'
import {
  type CatalogEntry,
  isCommandEntry,
  isFunctionEntry,
  isKeysEntry,
} from '@/shared/types/catalog'

export interface CatalogDetailPanelProps {
  entry: CatalogEntry
  paramValues: Record<string, string>
  onParamValuesChange: (values: Record<string, string>) => void
  onInsert: () => void
  canInsert: boolean
}

export function CatalogDetailPanel({
  entry,
  paramValues,
  onParamValuesChange,
  onInsert,
  canInsert,
}: CatalogDetailPanelProps): React.JSX.Element {
  const handleParamChange = (name: string, value: string) => {
    onParamValuesChange({ ...paramValues, [name]: value })
  }

  return (
    <div className="border-t bg-muted/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">{entry.label}</h3>
          <p className="text-sm text-muted-foreground">
            {entry.shortDescription}
          </p>
        </div>
        <Button onClick={onInsert} disabled={!canInsert}>
          Insert {isFunctionEntry(entry) ? 'Function' : 'Action'}
        </Button>
      </div>

      {/* Documentation */}
      {entry.whatItDoes && (
        <div>
          <h4 className="text-sm font-medium mb-1">What it does</h4>
          <p className="text-sm text-muted-foreground">{entry.whatItDoes}</p>
        </div>
      )}

      {entry.example && (
        <div>
          <h4 className="text-sm font-medium mb-1">Example</h4>
          <p className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {entry.example}
          </p>
        </div>
      )}

      {entry.technicalNote && (
        <div>
          <h4 className="text-sm font-medium mb-1">Technical Note</h4>
          <p className="text-sm text-muted-foreground">{entry.technicalNote}</p>
        </div>
      )}

      {/* Function Parameters (read-only display) */}
      {isFunctionEntry(entry) && entry.params.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="space-y-2">
            {entry.params.map((param) => (
              <div key={param.name} className="text-sm">
                <span className="font-mono">{param.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  ({param.type}){param.required ? ' - required' : ' - optional'}
                </span>
                {param.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {param.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command/Keys Parameters (with inputs) */}
      {(isCommandEntry(entry) || isKeysEntry(entry)) &&
        entry.params.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Parameters</h4>
            <CommandParameterFields
              entryKey={entry.key}
              params={entry.params}
              paramValues={paramValues}
              onParamChange={handleParamChange}
              variant="default"
            />
          </div>
        )}

      {/* Return type */}
      {isFunctionEntry(entry) && entry.returns && entry.returns !== 'void' && (
        <div>
          <h4 className="text-sm font-medium mb-1">Returns</h4>
          <p className="text-sm text-muted-foreground font-mono">
            {entry.returns}
          </p>
        </div>
      )}

      {/* Related command */}
      {isFunctionEntry(entry) && entry.relatedCommand && (
        <div className="border-t pt-3">
          <p className="text-sm text-muted-foreground">
            Also available as command:{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
              {entry.relatedCommand}
            </code>
          </p>
        </div>
      )}

      {/* Source documentation link */}
      {entry.sourceDoc && (
        <div className="border-t pt-3">
          <a
            href={entry.sourceDoc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            View documentation
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )
}
