import type { ReactNode } from 'react'

export interface ActionEditorFrameProps {
  title: string
  description: string
  children: ReactNode
  errors?: readonly string[]
  warnings?: readonly string[]
}

export function ActionEditorFrame({
  title,
  description,
  children,
  errors,
  warnings,
}: ActionEditorFrameProps): React.JSX.Element {
  return (
    <section className="min-w-0 space-y-3 rounded-md border p-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground whitespace-normal break-words">
          {description}
        </p>
      </div>

      {errors && errors.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {warnings && warnings.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  )
}
