/**
 * HighlightOverridesSection Component
 *
 * UI for managing highlight group overrides on the Neovim Options page.
 * Allows users to customize colors, transparency, and text styles.
 */

import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import {
  ALL_HIGHLIGHT_PRESETS,
  applyPreset,
  isPresetActive,
} from '@/shared/lib/neovim-options/highlight-presets'
import type {
  HighlightOverride,
  HighlightOverrideSource,
} from '@/shared/types/neovim-options'

interface HighlightOverridesSectionProps {
  overrides: HighlightOverride[]
  onChange: (overrides: HighlightOverride[]) => void
}

const COMMON_HIGHLIGHT_GROUPS = [
  'Normal',
  'NormalFloat',
  'NormalNC',
  'SignColumn',
  'StatusLine',
  'LineNr',
  'CursorLine',
  'Visual',
  'Comment',
  'String',
  'Function',
  'Keyword',
]

function getSourceBadge(source: HighlightOverrideSource): string {
  if (source.kind === 'preset') {
    const preset = ALL_HIGHLIGHT_PRESETS.find((p) => p.id === source.presetId)
    return `From: ${preset?.name ?? 'Preset'}`
  }
  return 'Custom'
}

function createCustomOverride(groupName: string): HighlightOverride {
  return {
    id: uuidv4(),
    groupName,
    foreground: '',
    background: '',
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    undercurl: false,
    link: '',
    enabled: true,
    source: { kind: 'custom' },
  }
}

export function HighlightOverridesSection({
  overrides,
  onChange,
}: HighlightOverridesSectionProps): React.JSX.Element {
  const activePresetId = ALL_HIGHLIGHT_PRESETS.find((p) =>
    isPresetActive(p.id, overrides),
  )?.id

  const handleAddOverride = useCallback(() => {
    onChange([...overrides, createCustomOverride('Normal')])
  }, [overrides, onChange])

  const handleAddCommonGroup = useCallback(
    (groupName: string) => {
      const existing = overrides.find((o) => o.groupName === groupName)
      if (existing) {
        if (!existing.enabled) {
          const updated = overrides.map((override) =>
            override.id === existing.id
              ? { ...override, enabled: true }
              : override,
          )
          onChange(updated)
        }
        return
      }
      onChange([...overrides, createCustomOverride(groupName)])
    },
    [overrides, onChange],
  )

  const handleUpdateOverride = useCallback(
    (overrideId: string, updates: Partial<HighlightOverride>) => {
      const updated = overrides.map((o) =>
        o.id === overrideId ? { ...o, ...updates } : o,
      )
      onChange(updated)
    },
    [overrides, onChange],
  )

  const handleDeleteOverride = useCallback(
    (overrideId: string) => {
      onChange(overrides.filter((o) => o.id !== overrideId))
    },
    [overrides, onChange],
  )

  const handleApplyPreset = useCallback(
    (presetId: string) => {
      const preset = ALL_HIGHLIGHT_PRESETS.find((p) => p.id === presetId)
      if (!preset) return

      // Remove existing preset overrides and add new ones
      const withoutPreset = overrides.filter(
        (o) => !(o.source.kind === 'preset' && o.source.presetId === presetId),
      )
      onChange([...withoutPreset, ...applyPreset(preset)])
    },
    [overrides, onChange],
  )

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold">Background & Highlights</h3>
        <p className="text-sm text-muted-foreground">
          Override highlight groups to customize colors, transparency, and text
          styles. These are applied after the colorscheme loads.
        </p>
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Presets:</span>
        <Select
          value={activePresetId ?? 'none'}
          onValueChange={(value) => {
            if (value === 'none') {
              // Remove all preset-based overrides
              onChange(overrides.filter((o) => o.source.kind !== 'preset'))
            } else {
              handleApplyPreset(value)
            }
          }}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {ALL_HIGHLIGHT_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Overrides List */}
      <div className="space-y-3">
        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No highlight overrides configured. Add one or select a preset above.
          </p>
        ) : (
          overrides.map((override) => (
            <HighlightOverrideCard
              key={override.id}
              override={override}
              onUpdate={(updates) => handleUpdateOverride(override.id, updates)}
              onDelete={() => handleDeleteOverride(override.id)}
            />
          ))
        )}
      </div>

      {/* Common Groups Quick-Add */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Quick Add:</span>
        <div className="flex flex-wrap gap-2">
          {COMMON_HIGHLIGHT_GROUPS.map((group) => (
            <Button
              key={group}
              variant="outline"
              size="sm"
              onClick={() => handleAddCommonGroup(group)}
              disabled={overrides.some(
                (o) => o.groupName === group && o.enabled,
              )}
            >
              {group}
            </Button>
          ))}
        </div>
      </div>

      {/* Add Custom Override */}
      <Button variant="outline" onClick={handleAddOverride} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Custom Override
      </Button>
    </div>
  )
}

interface HighlightOverrideCardProps {
  override: HighlightOverride
  onUpdate: (updates: Partial<HighlightOverride>) => void
  onDelete: () => void
}

function HighlightOverrideCard({
  override,
  onUpdate,
  onDelete,
}: HighlightOverrideCardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const rowClassName = override.enabled
    ? 'border rounded-lg p-4 space-y-4 bg-card'
    : 'border border-dashed rounded-lg p-4 space-y-4 bg-muted/30 opacity-85'

  return (
    <div className={rowClassName}>
      {/* Header Row */}
      <div className="flex items-center gap-4">
        <Switch
          checked={override.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
        />

        <Select
          value={override.groupName}
          onValueChange={(value) => onUpdate({ groupName: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMON_HIGHLIGHT_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs px-2 py-1 rounded bg-muted">
          {getSourceBadge(override.source)}
        </span>

        {!override.enabled && (
          <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">
            Disabled
          </span>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={override.source.kind === 'preset'}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t">
          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`fg-${override.id}`}>Foreground</Label>
              <Input
                id={`fg-${override.id}`}
                value={override.foreground}
                onChange={(e) => onUpdate({ foreground: e.target.value })}
                placeholder="#ffffff, white, NONE, or leave empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`bg-${override.id}`}>Background</Label>
              <Input
                id={`bg-${override.id}`}
                value={override.background}
                onChange={(e) => onUpdate({ background: e.target.value })}
                placeholder="#000000, black, NONE, or leave empty"
              />
            </div>
          </div>

          {/* Link */}
          <div className="space-y-2">
            <Label htmlFor={`link-${override.id}`}>
              Link to Group (optional)
            </Label>
            <Input
              id={`link-${override.id}`}
              value={override.link}
              onChange={(e) => onUpdate({ link: e.target.value })}
              placeholder="e.g., Normal, Comment, or leave empty"
            />
          </div>

          {/* Style Toggles */}
          <div className="flex flex-wrap gap-4">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={override.bold}
                onChange={(e) => onUpdate({ bold: e.target.checked })}
                className="rounded"
              />
              Bold
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={override.italic}
                onChange={(e) => onUpdate({ italic: e.target.checked })}
                className="rounded"
              />
              Italic
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={override.underline}
                onChange={(e) => onUpdate({ underline: e.target.checked })}
                className="rounded"
              />
              Underline
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={override.strikethrough}
                onChange={(e) => onUpdate({ strikethrough: e.target.checked })}
                className="rounded"
              />
              Strikethrough
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={override.undercurl}
                onChange={(e) => onUpdate({ undercurl: e.target.checked })}
                className="rounded"
              />
              Undercurl
            </Label>
          </div>
        </div>
      )}
    </div>
  )
}
