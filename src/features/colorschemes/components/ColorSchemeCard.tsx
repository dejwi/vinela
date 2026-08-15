import {
  AlertTriangle,
  Check,
  CircleUserRound,
  ExternalLink,
  Loader2,
  Star,
  Trash2,
} from 'lucide-react'
import { forwardRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { ColorSchemeDisplayInfo } from '@/shared/types'
import { resolveColorSchemeMetadata } from '../metadata'
import { NeovimWindowChrome } from './NeovimWindowChrome'

interface ColorSchemeCardProps {
  displayInfo: ColorSchemeDisplayInfo
  isActive: boolean
  onInstall: (id: string) => void
  onUninstall: (id: string) => void
  onSetActive: (id: string) => void
  isInstalling?: boolean
  isUninstalling?: boolean
}

function formatRelativeDate(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate)
  const diffMs = now.getTime() - date.getTime()
  const months = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30)))
  if (months >= 12) {
    const years = Math.floor(months / 12)
    return `${years} year${years === 1 ? '' : 's'} ago`
  }
  return `${months} month${months === 1 ? '' : 's'} ago`
}

export const ColorSchemeCard = forwardRef<HTMLDivElement, ColorSchemeCardProps>(
  function ColorSchemeCard(
    {
      displayInfo,
      isActive,
      onInstall,
      onUninstall,
      onSetActive,
      isInstalling = false,
      isUninstalling = false,
    }: ColorSchemeCardProps,
    ref,
  ): React.JSX.Element {
    const [showUninstallConfirm, setShowUninstallConfirm] = useState(false)

    const { catalog } = displayInfo
    const isInstalled = displayInfo.status === 'installed'
    const isPluginEnabled = isInstalled ? displayInfo.isPluginEnabled : false
    const metadata = resolveColorSchemeMetadata(catalog)

    const handleUninstall = (): void => {
      onUninstall(catalog.id)
      setShowUninstallConfirm(false)
    }

    return (
      <>
        <div
          ref={ref}
          className={cn(
            'rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md',
            'flex flex-col h-full', // Full height flex column for consistent alignment
            isActive && 'ring-2 ring-primary',
          )}
        >
          {/* Preview */}
          <NeovimWindowChrome
            themeId={catalog.id}
            themeName={catalog.name}
            colors={catalog.colors}
          />

          {/* Metadata - grows to fill space */}
          <div className="p-4 flex flex-col flex-1 space-y-3">
            {/* Author and stats row */}
            {(metadata.author !== undefined ||
              metadata.stars !== undefined) && (
              <div className="flex items-center justify-between gap-3">
                {metadata.author !== undefined ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted shrink-0"
                      aria-hidden
                    >
                      <CircleUserRound className="w-3 h-3" />
                    </span>
                    <span className="truncate">{metadata.author}</span>
                  </div>
                ) : (
                  <div />
                )}

                {metadata.stars !== undefined && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      {metadata.stars.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(metadata.createdAt !== undefined ||
              metadata.pushedAt !== undefined) && (
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                {metadata.createdAt !== undefined && (
                  <span>Created {formatRelativeDate(metadata.createdAt)}</span>
                )}
                {metadata.pushedAt !== undefined && (
                  <span>Updated {formatRelativeDate(metadata.pushedAt)}</span>
                )}
              </div>
            )}

            {metadata.fetchedAt !== undefined && (
              <div className="text-xs text-muted-foreground">
                Metadata refreshed {formatRelativeDate(metadata.fetchedAt)}
              </div>
            )}

            {/* Name and description - flex grow to fill available space */}
            <div className="flex-1 min-h-0">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {catalog.name}
                {isActive && (
                  <Badge variant="default" className="text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
                {isInstalled && !isPluginEnabled && (
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-600 border-amber-600"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Plugin Disabled
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {catalog.description}
              </p>
            </div>

            {/* Tags */}
            {catalog.tags && catalog.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {catalog.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs">
                  {catalog.variant}
                </Badge>
              </div>
            )}

            {/* Actions - always at bottom */}
            <div className="flex items-center justify-between pt-2 mt-auto">
              <a
                href={catalog.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                {isInstalled ? (
                  <>
                    {!isActive && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                onClick={() => onSetActive(catalog.id)}
                                disabled={!isPluginEnabled}
                              >
                                Use This Theme
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!isPluginEnabled && (
                            <TooltipContent>
                              <p>Enable the plugin first</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowUninstallConfirm(true)}
                            disabled={isUninstalling}
                          >
                            {isUninstalling ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Remove this theme</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onInstall(catalog.id)}
                    disabled={isInstalling}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      'Install'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Uninstall confirmation dialog */}
        <Dialog
          open={showUninstallConfirm}
          onOpenChange={setShowUninstallConfirm}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uninstall {catalog.name}?</DialogTitle>
              <DialogDescription>
                This will remove the color scheme from your project.
                {isActive && ' Another theme will be set as active.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUninstallConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleUninstall}>
                Uninstall
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  },
)
