/**
 * PresetSelector Component
 *
 * Dropdown or button group for selecting quick configuration presets.
 */

import { ChevronDown, Sparkles } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ALL_PRESETS } from '@/shared/lib/neovim-options/presets'
import type { OptionPreset } from '@/shared/types/neovim-options'

export interface PresetSelectorProps {
  onSelectPreset: (preset: OptionPreset) => void
}

export function PresetSelector({
  onSelectPreset,
}: PresetSelectorProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Apply Preset
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick Configuration</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALL_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => onSelectPreset(preset)}
            className="flex flex-col items-start gap-1 py-3"
          >
            <span className="font-medium">{preset.name}</span>
            <span className="text-xs text-muted-foreground line-clamp-2">
              {preset.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
