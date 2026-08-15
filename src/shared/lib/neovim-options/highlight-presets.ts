/**
 * Highlight Presets
 *
 * Pre-defined highlight configurations for common customizations
 * like transparent backgrounds.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  HighlightOverride,
  HighlightPreset,
} from '@/shared/types/neovim-options'

export const TRANSPARENT_BG_PRESET: HighlightPreset = {
  id: 'transparent-bg',
  name: 'Transparent Background',
  description:
    'Makes the editor background transparent, showing your terminal/wallpaper',
  overrides: [
    {
      groupName: 'Normal',
      foreground: '',
      background: 'NONE',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      undercurl: false,
      link: '',
      enabled: true,
    },
    {
      groupName: 'NormalFloat',
      foreground: '',
      background: 'NONE',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      undercurl: false,
      link: '',
      enabled: true,
    },
    {
      groupName: 'NormalNC',
      foreground: '',
      background: 'NONE',
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      undercurl: false,
      link: '',
      enabled: true,
    },
  ],
}

export const ALL_HIGHLIGHT_PRESETS: readonly HighlightPreset[] = [
  TRANSPARENT_BG_PRESET,
]

/**
 * Apply a preset: create HighlightOverride[] with source provenance.
 */
export function applyPreset(preset: HighlightPreset): HighlightOverride[] {
  return preset.overrides.map((o) => ({
    id: uuidv4(),
    ...o,
    source: { kind: 'preset' as const, presetId: preset.id },
  }))
}

/**
 * Check if a preset is currently active (all its overrides exist and are enabled).
 */
export function isPresetActive(
  presetId: string,
  overrides: HighlightOverride[],
): boolean {
  const preset = ALL_HIGHLIGHT_PRESETS.find((p) => p.id === presetId)
  if (!preset) return false

  return preset.overrides.every((po) =>
    overrides.some(
      (o) =>
        o.source.kind === 'preset' &&
        o.source.presetId === presetId &&
        o.groupName === po.groupName &&
        o.enabled,
    ),
  )
}

/**
 * Toggle a preset: if active, disable all its overrides; if inactive, add/enable them.
 */
export function togglePreset(
  presetId: string,
  currentOverrides: HighlightOverride[],
): HighlightOverride[] {
  const preset = ALL_HIGHLIGHT_PRESETS.find((p) => p.id === presetId)
  if (!preset) return currentOverrides

  if (isPresetActive(presetId, currentOverrides)) {
    // Disable: remove preset-sourced overrides for this preset
    return currentOverrides.filter(
      (o) => !(o.source.kind === 'preset' && o.source.presetId === presetId),
    )
  } else {
    // Enable: remove old preset overrides, add fresh ones
    const withoutOld = currentOverrides.filter(
      (o) => !(o.source.kind === 'preset' && o.source.presetId === presetId),
    )
    return [...withoutOld, ...applyPreset(preset)]
  }
}
