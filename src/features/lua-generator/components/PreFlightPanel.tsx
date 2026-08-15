import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  MinusCircle,
} from 'lucide-react'
import { useKeymapStore } from '@/features/keymaps/store'
import { usePluginStore } from '@/features/plugins/store'
import {
  getTargetNeovimCallout,
  type TargetNeovimPreflightState,
} from '../lib/target-neovim'
import { useGenerationStore } from '../store'

interface PreFlightItem {
  label: string
  status: 'included' | 'empty' | 'disabled'
  detail: string
}

function usePreFlightItems(): PreFlightItem[] {
  const installedPlugins = usePluginStore((s) => s.installedPlugins)
  const manualKeymaps = useKeymapStore((s) => s.manualKeymaps)

  const enabledPlugins = installedPlugins.filter((p) => p.enabled)
  const enabledKeymaps = manualKeymaps.filter((k) => k.enabled)

  return [
    {
      label: 'Plugins',
      status: enabledPlugins.length > 0 ? 'included' : 'empty',
      detail:
        enabledPlugins.length > 0
          ? `${enabledPlugins.length} plugin(s) with setup calls`
          : 'No plugins installed',
    },
    {
      label: 'Keymaps',
      status: enabledKeymaps.length > 0 ? 'included' : 'empty',
      detail:
        enabledKeymaps.length > 0
          ? `${enabledKeymaps.length} keymap(s)`
          : 'No manual keymaps configured',
    },
    {
      label: 'Neovim Options',
      status: 'included',
      detail: 'vim.opt settings from your configuration',
    },
    {
      label: 'Graphs',
      status: 'included',
      detail: 'Startup and callable graph logic',
    },
  ]
}

function StatusIcon({
  status,
}: {
  status: PreFlightItem['status']
}): React.JSX.Element {
  switch (status) {
    case 'included':
      return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    case 'empty':
      return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
    case 'disabled':
      return <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0" />
  }
}

function TargetNeovimCalloutPanel({
  preflight,
}: {
  preflight: TargetNeovimPreflightState
}): React.JSX.Element | null {
  if (preflight.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        Detecting local Neovim version...
      </div>
    )
  }

  if (preflight.kind !== 'ready') {
    return null
  }

  const callout = getTargetNeovimCallout(preflight.snapshot)
  if (callout === null) {
    return null
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {callout.title}
          </p>
          <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
            {callout.message}
          </p>
        </div>
      </div>
    </div>
  )
}

export function PreFlightPanel(): React.JSX.Element {
  const items = usePreFlightItems()
  const preflight = useGenerationStore((s) => s.targetNeovimPreflight)

  return (
    <div className="space-y-3">
      <TargetNeovimCalloutPanel preflight={preflight} />
      <p className="text-sm text-muted-foreground">
        The following will be included in your generated{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">init.lua</code>:
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50"
          >
            <StatusIcon status={item.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
