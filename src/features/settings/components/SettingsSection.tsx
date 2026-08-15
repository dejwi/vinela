import { Separator } from '@/shared/components/ui/separator'

interface SettingsSectionProps {
  /** Section title (e.g., "Appearance", "Graph Editor") */
  title: string
  /** Optional description shown below the title */
  description?: string
  /** Setting rows inside this section */
  children: React.ReactNode
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps): React.JSX.Element {
  return (
    <section className="space-y-4">
      {/* Section header with separator line */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            {title}
          </h2>
          <Separator className="flex-1" />
        </div>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Setting rows */}
      <div className="space-y-6 pl-1">{children}</div>
    </section>
  )
}
