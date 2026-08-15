import {
  BookOpen,
  Calendar,
  ExternalLink,
  Hash,
  Package,
  Star,
  Tag,
  User,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import type { PluginInstallOverride } from '@/shared/types'
import { PLUGIN_CATEGORY_LABELS } from '@/shared/types'
import { formatStars, resolvePluginMetadata } from '../../format-utils'
import type { ValidPluginDisplayInfo } from '../PluginGridCard'
import { InstallVersionControl } from './InstallVersionControl'

// ============================================
// Props
// ============================================

interface OverviewPanelProps {
  displayInfo: ValidPluginDisplayInfo
  onToggle: () => void
  onUninstall: () => void
  onInstallOverrideChange: (
    override: PluginInstallOverride,
  ) => Promise<void> | void
  onInstallOverrideClear: () => Promise<void> | void
  onInstallVersionDirtyChange?: ((dirty: boolean) => void) | undefined
  discardTrigger: number
  isUninstalling?: boolean | undefined
}

// ============================================
// Helpers
// ============================================

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

// ============================================
// Component
// ============================================

export function OverviewPanel({
  displayInfo,
  onToggle,
  onUninstall,
  onInstallOverrideChange,
  onInstallOverrideClear,
  onInstallVersionDirtyChange,
  discardTrigger,
  isUninstalling,
}: OverviewPanelProps): React.JSX.Element {
  const { schema } = displayInfo
  const isInstalled = displayInfo.status === 'installed'
  const isEnabled = isInstalled ? displayInfo.installed.enabled : false
  const repositoryMetadata = resolvePluginMetadata(schema, displayInfo.source)
  const formattedStars = formatStars(repositoryMetadata.stars)
  const categoryLabel =
    schema.category !== undefined
      ? PLUGIN_CATEGORY_LABELS[schema.category]
      : null

  // Count modified options (non-default values)
  const modifiedOptionsCount = isInstalled
    ? Object.keys(displayInfo.installed.config).length
    : 0

  return (
    <div className="space-y-6">
      {/* Description */}
      {schema.description !== undefined && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Description
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {schema.description}
          </p>
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-4">
        {repositoryMetadata.author !== undefined && (
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Author</p>
              <p className="text-sm font-medium">{repositoryMetadata.author}</p>
            </div>
          </div>
        )}

        {/* Stars */}
        {formattedStars !== null && (
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Stars</p>
              <p className="text-sm font-medium">
                {repositoryMetadata.stars?.toLocaleString() ?? formattedStars}
              </p>
            </div>
          </div>
        )}

        {repositoryMetadata.createdAt !== undefined && (
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">
                {formatDate(Date.parse(repositoryMetadata.createdAt))}
              </p>
            </div>
          </div>
        )}

        {repositoryMetadata.pushedAt !== undefined && (
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-sm font-medium">
                {formatDate(Date.parse(repositoryMetadata.pushedAt))}
              </p>
            </div>
          </div>
        )}

        {/* Schema version */}
        <div className="flex items-start gap-2">
          <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Schema version</p>
            <p className="text-sm font-medium">v{schema.version}</p>
          </div>
        </div>

        {/* Source */}
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <Badge variant="outline" className="text-xs mt-0.5">
              {displayInfo.source}
            </Badge>
          </div>
        </div>
      </div>

      {/* Repository link */}
      {schema.pluginRepo !== '' && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            Repository
          </h4>
          <a
            href={repositoryMetadata.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1.5"
          >
            {repositoryMetadata.repoSlug ?? repositoryMetadata.repoUrl}
            <ExternalLink className="h-3 w-3" />
          </a>
          {repositoryMetadata.fetchedAt !== undefined && (
            <p className="text-xs text-muted-foreground mt-2">
              Metadata refreshed{' '}
              {formatDate(Date.parse(repositoryMetadata.fetchedAt))}
            </p>
          )}
        </div>
      )}

      {/* Category */}
      {categoryLabel !== null && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Category</h4>
          <Badge variant="secondary">{categoryLabel}</Badge>
        </div>
      )}

      {/* Tags */}
      {schema.tags !== undefined && schema.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Tags
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {schema.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {schema.dependencies !== undefined && schema.dependencies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Dependencies</h4>
          <div className="flex flex-wrap gap-1.5">
            {schema.dependencies.map((dep) => (
              <Badge key={dep} variant="outline" className="text-xs font-mono">
                {dep}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Quick Stats</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Config options</span>
            <span className="font-medium">{schema.options.length}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-muted/50">
            <span className="text-muted-foreground">Functions</span>
            <span className="font-medium">{schema.functions.length}</span>
          </div>
          {schema.functionTemplates !== undefined && (
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Templates</span>
              <span className="font-medium">
                {schema.functionTemplates.length}
              </span>
            </div>
          )}
          {schema.exCommands !== undefined && (
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Commands</span>
              <span className="font-medium">{schema.exCommands.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Installed info */}
      {isInstalled && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Installation Info
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added on</span>
                <span>{formatDate(displayInfo.installed.addedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={isEnabled ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {modifiedOptionsCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Modified options
                  </span>
                  <span>{modifiedOptionsCount}</span>
                </div>
              )}
            </div>

            <InstallVersionControl
              schema={schema}
              installed={displayInfo.installed}
              onSave={onInstallOverrideChange}
              onClear={onInstallOverrideClear}
              onDirtyChange={onInstallVersionDirtyChange}
              discardTrigger={discardTrigger}
            />

            {/* Toggle / Uninstall actions */}
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onToggle}
                className="flex-1"
              >
                {isEnabled ? 'Disable Plugin' : 'Enable Plugin'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onUninstall}
                disabled={isUninstalling === true}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isUninstalling === true ? 'Removing…' : 'Uninstall'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
