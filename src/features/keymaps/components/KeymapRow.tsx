import { Pencil, Trash2, X } from 'lucide-react'
import {
  getActiveProfileIds,
  useProjectProfilesStore,
} from '@/features/profiles'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { ProjectProfile } from '@/shared/types'
import type { RunCustomActionTargetStatus } from '../custom-action-target-status'
import { getKeymapIssues } from '../lib/keymap-validation'
import { resolveKeymapActivation } from '../profile-inclusion'
import { useKeymapStore } from '../store'
import type { KeymapConflict, KeymapEntry, ProjectKeymap } from '../types'
import { getEntryKeySequence, getEntryModes } from '../utils'
import { ActionSummary } from './ActionSummary'
import { ConflictBadge } from './ConflictBadge'
import { EnableToggle } from './EnableToggle'
import { GraphSourceBadge } from './GraphSourceBadge'

interface KeymapRowProps {
  entry: KeymapEntry
  conflict: KeymapConflict | null
  onEdit: (keymap: ProjectKeymap) => void
  /** Called when user requests to delete a keymap (shows confirmation dialog) */
  onDeleteRequest: (keymap: ProjectKeymap) => void
  onToggle: (keymapId: string) => void
  onEnabledOverrideChange: (
    keymapId: string,
    enabledOverride: boolean | undefined,
  ) => void
  profilesReady: boolean
  onNavigateToNode: (graphId: string, nodeId: string) => void
  onNavigateToGraph: (graphId: string) => void
  getRunCustomActionTargetStatus: (
    graphId: string,
  ) => RunCustomActionTargetStatus
}

export function KeymapRow({
  entry,
  conflict,
  onEdit,
  onDeleteRequest,
  onToggle,
  onEnabledOverrideChange,
  profilesReady,
  onNavigateToNode,
  onNavigateToGraph,
  getRunCustomActionTargetStatus,
}: KeymapRowProps): React.JSX.Element {
  const profiles = useProjectProfilesStore((state) => state.profiles)
  const overrides = useProjectProfilesStore((state) => state.overrides)
  const activeProfileIds = getActiveProfileIds(profiles, overrides)
  const activation =
    entry.source === 'project' && profilesReady
      ? resolveKeymapActivation(entry.keymap, profiles, activeProfileIds)
      : null
  const isDisabled = activation?.enabled === false
  const validationIssues = useKeymapStore((state) => state.validationIssues)

  const issues =
    entry.source === 'project'
      ? getKeymapIssues(entry.keymapId, validationIssues)
      : []

  // Determine tutorial data attribute for row targeting
  const tutorialDataAttr =
    entry.source === 'graph'
      ? `keymap-graph-${entry.nodeId}`
      : `keymap-project-${entry.keymapId}`

  return (
    <div
      data-tutorial={tutorialDataAttr}
      className={cn(
        'grid grid-cols-[60px_140px_1fr_120px_170px] gap-2 px-3 py-2 rounded-md',
        'hover:bg-muted/50 transition-colors',
        isDisabled && 'opacity-60 grayscale',
      )}
    >
      {/* Mode badges */}
      <div className="flex gap-1 items-center flex-wrap">
        {getEntryModes(entry).map((mode) => (
          <span
            key={mode}
            className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
          >
            {mode}
          </span>
        ))}
        {isDisabled && (
          <Badge
            variant="outline"
            className="text-muted-foreground text-[10px] px-1 py-0"
          >
            Off
          </Badge>
        )}
      </div>

      {/* Key sequence with optional conflict badge */}
      <div className="flex items-center gap-1.5 font-mono text-sm">
        {conflict !== null && <ConflictBadge />}
        <span>{getEntryKeySequence(entry)}</span>
      </div>

      {/* Action summary */}
      <div className="flex items-center gap-1.5 min-w-0">
        <ActionSummary
          entry={entry}
          issues={issues}
          onNavigateToGraph={onNavigateToGraph}
          getRunCustomActionTargetStatus={getRunCustomActionTargetStatus}
        />
        {entry.source === 'project' &&
          entry.keymap.profileIds
            ?.map((id) => profiles.find((profile) => profile.id === id))
            .filter(
              (profile): profile is ProjectProfile => profile !== undefined,
            )
            .map((profile) => (
              <Badge
                key={profile.id}
                variant="outline"
                className="shrink-0 text-[10px]"
              >
                <span
                  className="mr-1 h-2 w-2 rounded-full"
                  style={{ backgroundColor: profile.color }}
                />
                {profile.name}
              </Badge>
            ))}
      </div>

      {/* Source badge */}
      <div className="flex items-center">
        {entry.source === 'graph' ? (
          <GraphSourceBadge
            graphName={entry.graphName}
            onClick={() => onNavigateToNode(entry.graphId, entry.nodeId)}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary">Custom</Badge>
            </TooltipTrigger>
            <TooltipContent>
              Created directly in the Shortcuts page
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Actions (custom only) */}
      <div className="flex items-center gap-1 justify-end">
        {entry.source === 'project' && (
          <>
            {activation?.kind === 'local' && (
              <EnableToggle
                enabled={activation.enabled}
                onToggle={() => onToggle(entry.keymapId)}
              />
            )}
            {activation?.kind === 'profiles' && (
              <>
                <Badge variant="outline">
                  {activation.enabled ? 'Profiles on' : 'Profiles off'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onEnabledOverrideChange(entry.keymapId, activation.enabled)
                  }
                  aria-label="Override attached profiles"
                >
                  Override
                </Button>
              </>
            )}
            {activation?.kind === 'override' && (
              <>
                <EnableToggle
                  enabled={activation.enabled}
                  onToggle={() =>
                    onEnabledOverrideChange(entry.keymapId, !activation.enabled)
                  }
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onEnabledOverrideChange(entry.keymapId, undefined)
                      }
                      aria-label="Remove local override"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Follow attached profiles</TooltipContent>
                </Tooltip>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(entry.keymap)}
              aria-label="Edit shortcut"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteRequest(entry.keymap)}
              aria-label="Delete shortcut"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
