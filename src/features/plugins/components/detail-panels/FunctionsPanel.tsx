import { Code2, Star, Wrench } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import type { SchemaFunction, SchemaFunctionTemplate } from '@/shared/types'

// ============================================
// Props
// ============================================

interface FunctionsPanelProps {
  functions: SchemaFunction[]
  functionTemplates?: SchemaFunctionTemplate[] | undefined
}

// ============================================
// Function card
// ============================================

function FunctionCard({ fn }: { fn: SchemaFunction }): React.JSX.Element {
  const displayName = fn.label ?? fn.name

  return (
    <div className="p-4 rounded-lg border bg-card space-y-2">
      {/* Function name + popular badge */}
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">{displayName}</span>
        {fn.isPopular === true && (
          <Badge
            variant="secondary"
            className="text-xs flex items-center gap-1"
          >
            <Star className="h-3 w-3 fill-current" />
            Popular
          </Badge>
        )}
      </div>

      {/* What it does (beginner-friendly) */}
      {fn.whatItDoes !== undefined && (
        <p className="text-sm text-foreground">{fn.whatItDoes}</p>
      )}

      {/* Description */}
      {fn.description !== undefined && fn.description !== fn.whatItDoes && (
        <p className="text-sm text-muted-foreground">{fn.description}</p>
      )}

      {/* Lua call template */}
      {fn.luaCall !== '' && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Lua call</p>
          <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
            {fn.luaCall}
          </code>
        </div>
      )}

      {/* Parameters */}
      {fn.params.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Parameters</p>
          <div className="space-y-1">
            {fn.params.map((param) => (
              <div key={param.name} className="flex items-start gap-2 text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                  {param.name}
                </code>
                <Badge variant="outline" className="text-xs shrink-0">
                  {param.type}
                </Badge>
                {param.optional === true && (
                  <span className="text-muted-foreground/60 italic shrink-0">
                    optional
                  </span>
                )}
                {param.description !== undefined && (
                  <span className="text-muted-foreground">
                    {param.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return type */}
      {fn.returns !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Returns:</span>
          <Badge variant="outline" className="text-xs">
            {fn.returns}
          </Badge>
        </div>
      )}

      {/* Technical note */}
      {fn.technicalNote !== undefined && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
          {fn.technicalNote}
        </p>
      )}
    </div>
  )
}

// ============================================
// Template card
// ============================================

function TemplateCard({
  template,
}: {
  template: SchemaFunctionTemplate
}): React.JSX.Element {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-2">
      {/* Template name + popular badge */}
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">{template.label}</span>
        {template.isPopular === true && (
          <Badge
            variant="secondary"
            className="text-xs flex items-center gap-1"
          >
            <Star className="h-3 w-3 fill-current" />
            Popular
          </Badge>
        )}
      </div>

      {/* Short description */}
      {template.shortDescription !== '' && (
        <p className="text-sm text-muted-foreground">
          {template.shortDescription}
        </p>
      )}

      {/* What it does */}
      {template.whatItDoes !== undefined && (
        <p className="text-sm text-foreground">{template.whatItDoes}</p>
      )}

      {/* Base function */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Based on:</span>
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
          {template.baseFunctionName}
        </code>
      </div>
    </div>
  )
}

// ============================================
// Main component
// ============================================

export function FunctionsPanel({
  functions,
  functionTemplates,
}: FunctionsPanelProps): React.JSX.Element {
  const hasTemplates =
    functionTemplates !== undefined && functionTemplates.length > 0

  if (functions.length === 0 && !hasTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Code2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-base font-semibold mb-2">
          No functions documented
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This plugin does not expose any callable functions in its schema.
        </p>
        {/* Future: Edit Schema link */}
        <p className="text-xs text-muted-foreground/60 mt-3">
          Schema authors can add functions to the{' '}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">
            functions
          </code>{' '}
          field.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Functions section */}
      {functions.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-semibold">Functions</h4>
            <Badge variant="secondary" className="text-xs">
              {functions.length}
            </Badge>
          </div>
          {functions.map((fn) => (
            <FunctionCard key={fn.name} fn={fn} />
          ))}
        </>
      )}

      {/* Templates section */}
      {hasTemplates && (
        <>
          {functions.length > 0 && <Separator className="my-4" />}
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-semibold">Templates</h4>
            <Badge variant="secondary" className="text-xs">
              {functionTemplates.length}
            </Badge>
          </div>
          {functionTemplates.map((template) => (
            <TemplateCard key={template.key} template={template} />
          ))}
        </>
      )}
    </div>
  )
}
