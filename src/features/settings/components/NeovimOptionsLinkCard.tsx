/**
 * NeovimOptionsLinkCard Component
 *
 * Link card for the Settings page to navigate to the Neovim Options page.
 * Shows icon, title, description, and modified count or total options.
 */

import { ArrowRight, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface NeovimOptionsLinkCardProps {
  /** Number of modified options */
  modifiedCount: number
}

export function NeovimOptionsLinkCard({
  modifiedCount,
}: NeovimOptionsLinkCardProps): React.JSX.Element {
  return (
    <Link
      to="/neovim-options"
      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-primary/10">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">Configure Neovim Options</p>
          <p className="text-sm text-muted-foreground">
            {modifiedCount > 0
              ? `${modifiedCount} option${modifiedCount !== 1 ? 's' : ''} modified from defaults`
              : '67 options available across 11 categories'}
          </p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  )
}
