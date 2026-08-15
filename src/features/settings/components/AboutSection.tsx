import { isMemoryMode } from '@/shared/lib/storage'

interface InfoRowProps {
  label: string
  value: string
  description?: string
}

function InfoRow({
  label,
  value,
  description,
}: InfoRowProps): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-4">
      <span className="text-sm text-muted-foreground min-w-[8rem]">
        {label}
      </span>
      <div>
        <span className="text-sm font-medium">{value}</span>
        {description !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  )
}

export function AboutSection(): React.JSX.Element {
  const memoryMode = isMemoryMode()

  const storageLabel = memoryMode
    ? 'Browser (Memory Only)'
    : 'Desktop (Local Files)'

  const storageDescription = memoryMode
    ? 'Running in browser mode. Data is stored in memory and browser localStorage.'
    : 'Your projects and settings are saved as files on your computer.'

  return (
    <div className="space-y-4">
      {/* Info rows */}
      <div className="space-y-3">
        <InfoRow label="Version" value={__APP_VERSION__} />
        <InfoRow
          label="Storage Mode"
          value={storageLabel}
          description={storageDescription}
        />
      </div>

      {/* Tagline */}
      <p className="text-xs text-muted-foreground/60 pt-2">
        Made with ♥ for the Neovim community
      </p>
    </div>
  )
}
