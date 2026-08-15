import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Code2,
  Info,
  Settings,
  Terminal,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { PluginConfigValue, PluginSchema } from '@/shared/types'
import { buildGroupTree } from '../format-utils'
import { buildOptionIndex, computeVisibleCounts } from '../utils/conditions'
import { isSchemalessPlugin } from './PluginGridCard'

// ============================================
// Types
// ============================================

/**
 * Discriminated union for the active view in the plugin detail modal.
 * - 'overview': Plugin info, metadata, install/toggle/uninstall
 * - 'config': Configuration options (optionally scoped to a group)
 * - 'commands': Ex commands
 * - 'functions': Functions and templates
 */
export type PluginDetailView =
  | { readonly kind: 'overview' }
  | { readonly kind: 'config'; readonly group?: string | undefined }
  | { readonly kind: 'commands' }
  | { readonly kind: 'functions' }

export function isOverviewView(v: PluginDetailView): v is { kind: 'overview' } {
  return v.kind === 'overview'
}

export function isConfigView(
  v: PluginDetailView,
): v is { kind: 'config'; group?: string | undefined } {
  return v.kind === 'config'
}

export function isCommandsView(v: PluginDetailView): v is { kind: 'commands' } {
  return v.kind === 'commands'
}

export function isFunctionsView(
  v: PluginDetailView,
): v is { kind: 'functions' } {
  return v.kind === 'functions'
}

// ============================================
// Props
// ============================================

interface PluginDetailSidebarProps {
  schema: PluginSchema
  pluginValues: Record<string, PluginConfigValue>
  activeView: PluginDetailView
  onSelectView: (view: PluginDetailView) => void
}

// ============================================
// Sidebar item
// ============================================

interface SidebarItemProps {
  icon?: React.ReactNode
  label: string
  count?: number | undefined
  /** Optional trailing icon (e.g. warning indicator) shown after the count */
  trailingIcon?: React.ReactNode | undefined
  isActive: boolean
  isIndented?: boolean | undefined
  leadingChevron?: React.ReactNode | undefined
  ariaExpanded?: boolean | undefined
  selectable?: boolean | undefined
  onClick: () => void
}

function SidebarItem({
  icon,
  label,
  count,
  trailingIcon,
  isActive,
  isIndented,
  leadingChevron,
  ariaExpanded,
  selectable = true,
  onClick,
}: SidebarItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
        isIndented === true && 'pl-7',
        !selectable && 'cursor-default',
        isActive
          ? 'bg-accent text-accent-foreground'
          : selectable
            ? 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground',
      )}
    >
      {leadingChevron !== undefined && (
        <span className="shrink-0">{leadingChevron}</span>
      )}
      {icon !== undefined && (
        <span className="shrink-0 text-current">{icon}</span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground shrink-0">{count}</span>
      )}
      {trailingIcon !== undefined && (
        <span className="shrink-0">{trailingIcon}</span>
      )}
    </button>
  )
}

// ============================================
// Main component
// ============================================

export function PluginDetailSidebar({
  schema,
  pluginValues,
  activeView,
  onSelectView,
}: PluginDetailSidebarProps): React.JSX.Element {
  const hasCommands =
    schema.exCommands !== undefined && schema.exCommands.length > 0
  const hasFunctions =
    schema.functions.length > 0 ||
    (schema.functionTemplates !== undefined &&
      schema.functionTemplates.length > 0)
  const hasOptions = schema.options.length > 0
  const isSchemaless = isSchemalessPlugin(schema)

  const tree = useMemo(() => buildGroupTree(schema.options), [schema.options])
  const optionIndex = useMemo(
    () => buildOptionIndex(schema.options),
    [schema.options],
  )
  const visibleCounts = useMemo(
    () => computeVisibleCounts(schema.options, pluginValues, optionIndex),
    [schema.options, pluginValues, optionIndex],
  )

  const isConfigActive = activeView.kind === 'config'
  const activeConfigGroup =
    isConfigActive && activeView.kind === 'config'
      ? activeView.group
      : undefined

  return (
    <TooltipProvider>
      <aside className="w-44 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm truncate">Plugin Detail</h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {/* Overview */}
            <SidebarItem
              icon={<Info className="h-4 w-4" />}
              label="Overview"
              isActive={activeView.kind === 'overview'}
              onClick={() => onSelectView({ kind: 'overview' })}
            />

            {/* Configuration — with warning icon when schema-less */}
            {isSchemaless ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <SidebarItem
                      icon={<Settings className="h-4 w-4" />}
                      label="Configuration"
                      trailingIcon={
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      }
                      isActive={
                        isConfigActive && activeConfigGroup === undefined
                      }
                      onClick={() => onSelectView({ kind: 'config' })}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>No configuration available</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarItem
                icon={<Settings className="h-4 w-4" />}
                label="Configuration"
                count={hasOptions ? schema.options.length : undefined}
                isActive={isConfigActive && activeConfigGroup === undefined}
                onClick={() => onSelectView({ kind: 'config' })}
              />
            )}

            {/* Config sub-groups */}
            {tree.map((node) => (
              <GroupNode
                key={node.id}
                node={node}
                activeId={activeConfigGroup}
                visibleCounts={visibleCounts}
                onSelect={(group) => onSelectView({ kind: 'config', group })}
              />
            ))}

            {/* Separator before commands/functions */}
            {(hasCommands || hasFunctions) && <Separator className="my-2" />}

            {/* Commands */}
            {hasCommands && (
              <SidebarItem
                icon={<Terminal className="h-4 w-4" />}
                label="Commands"
                count={schema.exCommands?.length}
                isActive={activeView.kind === 'commands'}
                onClick={() => onSelectView({ kind: 'commands' })}
              />
            )}

            {/* Functions */}
            {hasFunctions && (
              <SidebarItem
                icon={<Code2 className="h-4 w-4" />}
                label="Functions"
                count={
                  schema.functions.length +
                  (schema.functionTemplates?.length ?? 0)
                }
                isActive={activeView.kind === 'functions'}
                onClick={() => onSelectView({ kind: 'functions' })}
              />
            )}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  )
}

interface GroupNodeProps {
  node: import('../format-utils').GroupTreeNode
  activeId: string | undefined
  visibleCounts: Map<string, number>
  onSelect: (group: string) => void
}

function GroupNode({
  node,
  activeId,
  visibleCounts,
  onSelect,
}: GroupNodeProps): React.JSX.Element {
  const hasChildren = node.children.length > 0
  const isActiveDescendant =
    activeId === node.id || activeId?.startsWith(`${node.id} / `) === true
  const [open, setOpen] = useState(isActiveDescendant)

  useEffect(() => {
    if (isActiveDescendant) {
      setOpen(true)
    }
  }, [isActiveDescendant])

  const totalCount =
    (visibleCounts.get(node.id) ?? 0) +
    node.children.reduce(
      (sum, child) => sum + (visibleCounts.get(child.id) ?? 0),
      0,
    )

  return (
    <>
      <SidebarItem
        label={node.label}
        count={totalCount}
        isActive={node.hasOwnOptions && activeId === node.id}
        selectable={node.hasOwnOptions}
        leadingChevron={
          hasChildren ? (
            open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : undefined
        }
        ariaExpanded={hasChildren ? open : undefined}
        onClick={() => {
          if (node.hasOwnOptions) {
            onSelect(node.id)
            if (hasChildren) {
              setOpen((prev) => !prev)
            }
            return
          }
          if (hasChildren) {
            setOpen((prev) => !prev)
          }
        }}
      />
      {hasChildren && open
        ? node.children.map((child) => (
            <SidebarItem
              key={child.id}
              label={child.label}
              count={visibleCounts.get(child.id) ?? 0}
              isActive={activeId === child.id}
              isIndented
              onClick={() => onSelect(child.id)}
            />
          ))
        : null}
    </>
  )
}
