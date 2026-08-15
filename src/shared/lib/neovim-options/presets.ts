/**
 * Neovim Option Presets
 *
 * Quick-start configurations for common use cases.
 * Each preset defines a set of options that work well together.
 */

import type {
  NeovimOptionStoredValue,
  OptionPreset,
} from '@/shared/types/neovim-options'

// ============================================
// Helper for creating stored values
// ============================================

function bool(value: boolean): NeovimOptionStoredValue {
  return { valueType: 'boolean', value }
}

function num(value: number): NeovimOptionStoredValue {
  return { valueType: 'number', value }
}

function str(value: string): NeovimOptionStoredValue {
  return { valueType: 'string', value }
}

function strList(...values: string[]): NeovimOptionStoredValue {
  return { valueType: 'string-list', value: values }
}

// Note: charList() is available if needed for char-list presets

// ============================================
// Starter Preset
// ============================================

/**
 * Sensible defaults for new Neovim users.
 * Enables the most commonly recommended options without overwhelming complexity.
 */
export const STARTER_PRESET: OptionPreset = {
  id: 'starter',
  name: 'Starter',
  description: 'Sensible defaults for new Neovim users',
  options: {
    // Line Numbers
    number: bool(true),
    relativenumber: bool(true),

    // Visual Appearance
    termguicolors: bool(true),
    signcolumn: str('yes'),
    cursorline: bool(true),

    // Indentation
    expandtab: bool(true),
    tabstop: num(2),
    shiftwidth: num(2),
    autoindent: bool(true),

    // Search
    ignorecase: bool(true),
    smartcase: bool(true),
    incsearch: bool(true),
    inccommand: str('nosplit'),
    scrolloff: num(8),

    // File Handling
    undofile: bool(true),
    hidden: bool(true),
    autoread: bool(true),

    // Windows and Splits
    splitright: bool(true),
    splitbelow: bool(true),

    // Clipboard
    clipboard: strList('unnamedplus'),
  },
}

// ============================================
// IDE-like Preset
// ============================================

/**
 * Settings that make Neovim feel more like a modern IDE.
 * Includes all Starter options plus IDE-specific enhancements.
 */
export const IDE_PRESET: OptionPreset = {
  id: 'ide-like',
  name: 'IDE-like',
  description: 'Settings that make Neovim feel more like a modern IDE',
  options: {
    // All Starter options
    ...STARTER_PRESET.options,

    // Additional Visual Appearance
    winborder: str('rounded'),

    // Additional Indentation
    smartindent: bool(true),

    // Additional Search
    hlsearch: bool(true),

    // Performance (for responsive plugins)
    updatetime: num(250),
    timeoutlen: num(300),

    // Completion
    completeopt: strList('menu', 'menuone', 'noselect'),
    pumheight: num(10),

    // File Handling
    swapfile: bool(true),
    writebackup: bool(true),

    // Mouse
    mouse: str('a'),
  },
}

// ============================================
// Minimal Preset
// ============================================

/**
 * Bare essentials, close to Neovim defaults.
 * For users who want minimal configuration and maximum compatibility.
 */
export const MINIMAL_PRESET: OptionPreset = {
  id: 'minimal',
  name: 'Minimal',
  description: 'Bare essentials, close to Neovim defaults',
  options: {
    // Just the absolute essentials
    termguicolors: bool(true),
    undofile: bool(true),
    hidden: bool(true),
  },
}

// ============================================
// All Presets
// ============================================

export const ALL_PRESETS: readonly OptionPreset[] = [
  STARTER_PRESET,
  IDE_PRESET,
  MINIMAL_PRESET,
]

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): OptionPreset | null {
  return ALL_PRESETS.find((p) => p.id === id) ?? null
}

/**
 * Get the names of options that will change when applying a preset.
 * Compares preset options against current values.
 */
export function getPresetChanges(
  preset: OptionPreset,
  currentOptions: Record<string, NeovimOptionStoredValue>,
): Array<{
  optionName: string
  currentValue: NeovimOptionStoredValue | null
  newValue: NeovimOptionStoredValue
}> {
  const changes: Array<{
    optionName: string
    currentValue: NeovimOptionStoredValue | null
    newValue: NeovimOptionStoredValue
  }> = []

  for (const [optionName, newValue] of Object.entries(preset.options)) {
    const currentValue = currentOptions[optionName] ?? null

    // Only include if it's a new option or the value is different
    if (currentValue === null) {
      changes.push({ optionName, currentValue, newValue })
    } else if (
      currentValue.valueType !== newValue.valueType ||
      JSON.stringify(currentValue.value) !== JSON.stringify(newValue.value)
    ) {
      changes.push({ optionName, currentValue, newValue })
    }
  }

  return changes
}

/**
 * Get the count of changes a preset would make.
 */
export function getPresetChangeCount(
  preset: OptionPreset,
  currentOptions: Record<string, NeovimOptionStoredValue>,
): number {
  return getPresetChanges(preset, currentOptions).length
}
