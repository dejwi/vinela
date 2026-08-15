import type { ReactNode } from 'react'

interface PropertiesSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function PropertiesSection({
  title,
  description,
  children,
}: PropertiesSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
