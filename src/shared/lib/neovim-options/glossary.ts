/**
 * Neovim Glossary
 *
 * Definitions of technical terms for beginners.
 * Used by GlossaryPopover to explain jargon in plain language.
 */

import type { GlossaryEntry, GlossaryTerm } from '@/shared/types/neovim-options'

export const GLOSSARY: Record<GlossaryTerm, string> = {
  buffer:
    'A file loaded into memory for editing. You can have multiple buffers open and switch between them without saving.',

  mode: "Neovim's current input state. Normal mode is for navigating, Insert mode is for typing, Visual mode is for selecting. There are several others.",

  mapping:
    'A custom keyboard shortcut you define. For example, making Space+f open the file finder.',

  register:
    'A storage slot for copied or cut text. Neovim has many registers so you can have multiple clipboards.',

  window:
    'A viewport showing a buffer. You can split the screen to show multiple windows at once.',

  tab: "A collection of windows, similar to browser tabs. Each tab can have its own layout of splits. Don't confuse with indentation tabs!",

  split:
    'Dividing the screen to show multiple windows side-by-side or stacked. Use :split (horizontal) or :vsplit (vertical).',

  provider:
    'An external program Neovim uses for certain features, like clipboard integration or Python plugins.',

  autocommand:
    'An action that runs automatically when something happens, like opening a file or saving. Written as autocmd in config files.',
}

/**
 * Get the definition for a glossary term.
 */
export function getGlossaryDefinition(term: GlossaryTerm): string {
  return GLOSSARY[term] ?? 'Definition not found.'
}

/**
 * Get all glossary entries.
 */
export function getAllGlossaryEntries(): GlossaryEntry[] {
  return (Object.keys(GLOSSARY) as GlossaryTerm[]).map((term) => ({
    term,
    definition: GLOSSARY[term],
  }))
}

/**
 * Check if a string is a valid glossary term.
 */
export function isGlossaryTerm(term: string): term is GlossaryTerm {
  return term in GLOSSARY
}
