import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Settings,
  Star,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/shared/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { PluginDisplayInfo, PluginSchema } from '@/shared/types'
import { PLUGIN_CATEGORY_LABELS } from '@/shared/types'
import { formatStars, getTagline, resolvePluginMetadata } from '../format-utils'

// ============================================
// Schema-less detection helper
// ============================================

/**
 * Returns true if the plugin has no configuration schema:
 * no options, no functions, and no ex-commands.
 *
 * Schema-less plugins are typically created via GitHub import when no
 * `vinela.schema.json` file is found in the repository.
 */
export function isSchemalessPlugin(schema: PluginSchema): boolean {
  return (
    schema.options.length === 0 &&
    schema.functions.length === 0 &&
    (schema.exCommands === undefined || schema.exCommands.length === 0) &&
    (schema.functionTemplates === undefined ||
      schema.functionTemplates.length === 0)
  )
}

// ============================================
// PluginGridCard
// ============================================

export type ValidPluginDisplayInfo = Exclude<
  PluginDisplayInfo,
  { status: 'orphaned' }
>

export interface InternalPluginGridCardProps {
  displayInfo: ValidPluginDisplayInfo
  onClick: (schemaId: string) => void
}

/**
 * Grid card for displaying a plugin in the Browse tab.
 *
 * Shows:
 *   - Plugin name (bold) + enabled/installed indicator
 *   - Warning icon for schema-less plugins
 *   - Author + star count
 *   - Tagline / description (2-line clamp)
 *   - Category badge (or "No config" for schema-less) + version
 *   - Source badge
 */
export function PluginGridCard({
  displayInfo,
  onClick,
}: InternalPluginGridCardProps): React.JSX.Element {
  const { schema } = displayInfo
  const isInstalled = displayInfo.status === 'installed'
  const isEnabled = isInstalled ? displayInfo.installed.enabled : false
  const isSchemaless = isSchemalessPlugin(schema)

  const repositoryMetadata = resolvePluginMetadata(schema, displayInfo.source)
  const tagline = getTagline(schema)
  const formattedStars = formatStars(repositoryMetadata.stars)
  const categoryLabel =
    schema.category !== undefined
      ? PLUGIN_CATEGORY_LABELS[schema.category]
      : null

  return (
    <TooltipProvider>
      <Card
        data-tutorial={`plugin-card-${schema.id}`}
        className={cn(
          'cursor-pointer border transition-colors hover:border-primary/50',
          isInstalled && !isEnabled && 'opacity-60',
        )}
        onClick={() => onClick(schema.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick(schema.id)
          }
        }}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            {/* Plugin name + schema-less warning icon */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-sm leading-tight line-clamp-1">
                {schema.pluginName}
              </span>
              {isSchemaless && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-amber-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This plugin has no configuration schema</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Installed indicator */}
            {isInstalled && (
              <span
                className={cn(
                  'shrink-0 flex items-center gap-1 text-xs',
                  isEnabled ? 'text-green-500' : 'text-muted-foreground',
                )}
                title={isEnabled ? 'Enabled' : 'Disabled'}
              >
                {isEnabled ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>
            )}
          </div>

          {/* Author + stars */}
          {(repositoryMetadata.author !== undefined ||
            formattedStars !== null) && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs mt-0.5',
                isSchemaless
                  ? 'text-muted-foreground/60'
                  : 'text-muted-foreground',
              )}
            >
              {repositoryMetadata.author !== undefined && (
                <span className="truncate">{repositoryMetadata.author}</span>
              )}
              {repositoryMetadata.author !== undefined &&
                formattedStars !== null && <span aria-hidden>·</span>}
              {formattedStars !== null && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3 w-3 fill-current" />
                  {formattedStars}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-4 pb-2">
          {/* Tagline / description */}
          {tagline !== undefined ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {tagline}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No description available
            </p>
          )}
        </CardContent>

        <CardFooter className="px-4 pb-4 pt-0 flex items-center justify-between gap-2">
          {/* Category badge / "No schema" badge + version */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {isSchemaless ? (
              <Badge
                variant="outline"
                className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
              >
                No schema
              </Badge>
            ) : categoryLabel !== null ? (
              <Badge variant="secondary" className="text-xs">
                {categoryLabel}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">
                Uncategorized
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              v{schema.version}
            </span>
          </div>

          {/* Source badge */}
          <Badge variant="outline" className="text-xs shrink-0">
            {displayInfo.source}
          </Badge>
        </CardFooter>
      </Card>
    </TooltipProvider>
  )
}

// ============================================
// InstalledPluginGridCard
// ============================================

/**
 * Extended grid card for the Installed tab with action buttons.
 * Wraps PluginGridCard and adds Toggle/Uninstall/Configure actions.
 */
export interface InstalledPluginGridCardProps {
  displayInfo: ValidPluginDisplayInfo
  onToggle: () => void
  onUninstall: () => void
  onConfigure: () => void
}

export function InstalledPluginGridCard({
  displayInfo,
  onToggle,
  onUninstall,
  onConfigure,
}: InstalledPluginGridCardProps): React.JSX.Element {
  const { schema } = displayInfo
  const isInstalled = displayInfo.status === 'installed'
  const isEnabled = isInstalled ? displayInfo.installed.enabled : false
  const isSchemaless = isSchemalessPlugin(schema)

  const repositoryMetadata = resolvePluginMetadata(schema, displayInfo.source)
  const tagline = getTagline(schema)
  const formattedStars = formatStars(repositoryMetadata.stars)
  const categoryLabel =
    schema.category !== undefined
      ? PLUGIN_CATEGORY_LABELS[schema.category]
      : null

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'border transition-colors',
          isInstalled && !isEnabled && 'opacity-60',
        )}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            {/* Plugin name + schema-less warning icon */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-sm leading-tight line-clamp-1">
                {schema.pluginName}
              </span>
              {isSchemaless && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-amber-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This plugin has no configuration schema</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Installed indicator */}
            {isInstalled && (
              <span
                className={cn(
                  'shrink-0 flex items-center gap-1 text-xs',
                  isEnabled ? 'text-green-500' : 'text-muted-foreground',
                )}
                title={isEnabled ? 'Enabled' : 'Disabled'}
              >
                {isEnabled ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>
            )}
          </div>

          {/* Author + stars */}
          {(repositoryMetadata.author !== undefined ||
            formattedStars !== null) && (
            <div
              className={cn(
                'flex items-center gap-2 text-xs mt-0.5',
                isSchemaless
                  ? 'text-muted-foreground/60'
                  : 'text-muted-foreground',
              )}
            >
              {repositoryMetadata.author !== undefined && (
                <span className="truncate">{repositoryMetadata.author}</span>
              )}
              {repositoryMetadata.author !== undefined &&
                formattedStars !== null && <span aria-hidden>·</span>}
              {formattedStars !== null && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <Star className="h-3 w-3 fill-current" />
                  {formattedStars}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="px-4 pb-2">
          {/* Tagline / description */}
          {tagline !== undefined ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {tagline}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No description available
            </p>
          )}
        </CardContent>

        <CardFooter className="px-4 pb-4 pt-0 flex flex-col gap-2">
          {/* Category badge / "No schema" badge + version */}
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isSchemaless ? (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                >
                  No schema
                </Badge>
              ) : categoryLabel !== null ? (
                <Badge variant="secondary" className="text-xs">
                  {categoryLabel}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Uncategorized
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                v{schema.version}
              </span>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              {displayInfo.source}
            </Badge>
          </div>

          {/* Action buttons (installed only) */}
          {isInstalled && (
            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for action buttons inside a card
            <div
              className="flex items-center gap-1.5 w-full"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={onToggle}
                aria-label={isEnabled ? 'Disable plugin' : 'Enable plugin'}
              >
                {isEnabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={onConfigure}
                aria-label="Configure plugin"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onUninstall}
                aria-label="Uninstall plugin"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  )
}
