export interface NeovimEventCatalogEntry {
  name: string
  category: 'file' | 'mode' | 'ui' | 'lsp' | 'diagnostics' | 'custom'
  /** Short hint shown in the event list row */
  patternGuidance: string
  /** Brief description shown in the list */
  description: string
  /** Detailed description for tooltip */
  details: string
  /** Help tag for reference */
  sourceDoc: string
}

export const NEOVIM_EVENT_CATALOG: readonly NeovimEventCatalogEntry[] = [
  {
    name: 'BufEnter',
    category: 'file',
    patternGuidance: '*.lua, *',
    description: 'Entering a buffer.',
    details:
      'Fires when entering a buffer. Useful for buffer-local setup that should run whenever buffer focus changes.',
    sourceDoc: ':help BufEnter',
  },
  {
    name: 'BufNewFile',
    category: 'file',
    patternGuidance: '*.lua, *.md',
    description: 'New file buffer created.',
    details:
      'Triggered when editing a file that does not yet exist on disk. Use file patterns to target specific file types.',
    sourceDoc: ':help BufNewFile',
  },
  {
    name: 'BufReadPre',
    category: 'file',
    patternGuidance: '*.lua, *',
    description: 'Before reading a file into a buffer.',
    details:
      'Fires just before Neovim reads an existing file from disk. Good for preprocessing or setting buffer-local options.',
    sourceDoc: ':help BufReadPre',
  },
  {
    name: 'BufReadPost',
    category: 'file',
    patternGuidance: '*.lua, *',
    description: 'After reading a file into a buffer.',
    details:
      'Fires after the file has been read into the buffer but before modelines are processed. Use for post-load setup.',
    sourceDoc: ':help BufReadPost',
  },
  {
    name: 'BufWritePre',
    category: 'file',
    patternGuidance: '*.lua, *',
    description: 'Before writing buffer to disk.',
    details:
      'Fires just before saving the buffer. Ideal for auto-formatting or ensuring code quality before write.',
    sourceDoc: ':help BufWritePre',
  },
  {
    name: 'BufWritePost',
    category: 'file',
    patternGuidance: '*.lua, *',
    description: 'After writing buffer to disk.',
    details:
      'Fires after the buffer has been saved. Use for post-save actions like updating tags or triggering builds.',
    sourceDoc: ':help BufWritePost',
  },
  {
    name: 'FileType',
    category: 'file',
    patternGuidance: 'lua, typescript',
    description: 'When filetype is set.',
    details:
      'Triggered when Neovim detects or sets the filetype for a buffer. Pattern should be a filetype name like "lua" or "typescript".',
    sourceDoc: ':help FileType',
  },
  {
    name: 'CursorHold',
    category: 'mode',
    patternGuidance: '*',
    description: 'Idle time elapsed in Normal mode.',
    details:
      "Fires after the user has been idle in Normal mode for 'updatetime' milliseconds. Useful for deferred actions like showing diagnostics.",
    sourceDoc: ':help CursorHold',
  },
  {
    name: 'InsertEnter',
    category: 'mode',
    patternGuidance: '*',
    description: 'Before entering Insert mode.',
    details:
      'Fires just before switching to Insert or Replace mode. Use for context-aware setup when editing begins.',
    sourceDoc: ':help InsertEnter',
  },
  {
    name: 'InsertLeave',
    category: 'mode',
    patternGuidance: '*',
    description: 'After leaving Insert mode.',
    details:
      'Fires when returning to Normal mode from Insert. Good for cleanup or triggering actions after text entry.',
    sourceDoc: ':help InsertLeave',
  },
  {
    name: 'TextYankPost',
    category: 'mode',
    patternGuidance: '*',
    description: 'After yanking (copying) text.',
    details:
      'Fires after text has been yanked to a register. Use for highlighting yanked text or custom clipboard handling.',
    sourceDoc: ':help TextYankPost',
  },
  {
    name: 'OptionSet',
    category: 'ui',
    patternGuidance: 'number, relativenumber',
    description: 'When an option is changed.',
    details:
      'Fires when a Neovim option is modified at runtime. Pattern should be the option name like "number" or "relativenumber".',
    sourceDoc: ':help OptionSet',
  },
  {
    name: 'ColorScheme',
    category: 'ui',
    patternGuidance: '*',
    description: 'After colorscheme loads.',
    details:
      'Fires after a colorscheme has been loaded. Use to apply custom highlights that persist across theme changes.',
    sourceDoc: ':help ColorScheme',
  },
  {
    name: 'DirChanged',
    category: 'ui',
    patternGuidance: 'window, tabpage, global',
    description: 'Working directory changed.',
    details:
      'Fires when Neovim changes its current working directory. Patterns: window, tabpage, global, or auto.',
    sourceDoc: ':help DirChanged',
  },
  {
    name: 'TermOpen',
    category: 'ui',
    patternGuidance: '*',
    description: 'Terminal buffer opens.',
    details:
      'Fires when a terminal buffer is created. Use to set terminal-specific options or keymaps.',
    sourceDoc: ':help TermOpen',
  },
  {
    name: 'User',
    category: 'custom',
    patternGuidance: 'MyCustomEvent',
    description: 'Custom user-defined event.',
    details:
      'Fires when triggered by :doautocmd User <name>. Pattern should be your custom event name. Great for plugin integration.',
    sourceDoc: ':help User',
  },
  {
    name: 'VimEnter',
    category: 'ui',
    patternGuidance: '*',
    description: 'After startup completes.',
    details:
      'Fires after all initialization is done and Neovim is ready. Use for final setup that requires full initialization.',
    sourceDoc: ':help VimEnter',
  },
  {
    name: 'VimLeavePre',
    category: 'ui',
    patternGuidance: '*',
    description: 'Before exiting Neovim.',
    details:
      'Fires just before Neovim exits. Use for cleanup, saving session data, or graceful shutdown tasks.',
    sourceDoc: ':help VimLeavePre',
  },
  {
    name: 'WinEnter',
    category: 'ui',
    patternGuidance: '*',
    description: 'Entering a different window.',
    details:
      'Fires after entering a new window. Use for window-specific setup or updating UI elements based on active window.',
    sourceDoc: ':help WinEnter',
  },
  {
    name: 'WinLeave',
    category: 'ui',
    patternGuidance: '*',
    description: 'Leaving current window.',
    details:
      'Fires before leaving the current window. Use for cleanup or saving window-local state.',
    sourceDoc: ':help WinLeave',
  },
  {
    name: 'LspAttach',
    category: 'lsp',
    patternGuidance: '*',
    description: 'LSP client attaches to buffer.',
    details:
      'Fires when a language server attaches to a buffer. Use to set up LSP-specific keymaps or buffer options.',
    sourceDoc: ':help LspAttach',
  },
  {
    name: 'LspDetach',
    category: 'lsp',
    patternGuidance: '*',
    description: 'LSP client detaches from buffer.',
    details:
      'Fires just before a language server detaches. Use for cleanup of LSP-specific settings.',
    sourceDoc: ':help LspDetach',
  },
  {
    name: 'LspProgress',
    category: 'lsp',
    patternGuidance: '*',
    description: 'LSP progress notification.',
    details:
      'Fires when language server sends progress updates. Use for showing progress indicators in the UI.',
    sourceDoc: ':help LspProgress',
  },
  {
    name: 'DiagnosticChanged',
    category: 'diagnostics',
    patternGuidance: '*',
    description: 'Diagnostics updated for buffer.',
    details:
      'Fires when diagnostic results change for a buffer. Use for updating diagnostic displays or status indicators.',
    sourceDoc: ':help DiagnosticChanged',
  },
]

const eventByLowerName = new Map<string, NeovimEventCatalogEntry>(
  NEOVIM_EVENT_CATALOG.map((entry) => [entry.name.toLowerCase(), entry]),
)

/**
 * Canonical Neovim autocmd event names accepted by validation/generation paths.
 *
 * NOTE:
 * - Keep this list broad (not just UI catalog entries) to avoid contract drift.
 * - "User*" custom events are handled separately via canonical "User" prefix logic.
 */
export const KNOWN_AUTOCMD_EVENT_NAMES: readonly string[] = [
  'BufAdd',
  'BufDelete',
  'BufEnter',
  'BufFilePost',
  'BufFilePre',
  'BufHidden',
  'BufLeave',
  'BufNew',
  'BufNewFile',
  'BufRead',
  'BufReadCmd',
  'BufReadPost',
  'BufReadPre',
  'BufUnload',
  'BufWinEnter',
  'BufWinLeave',
  'BufWipeout',
  'BufWrite',
  'BufWriteCmd',
  'BufWritePost',
  'BufWritePre',
  'FileAppendCmd',
  'FileAppendPost',
  'FileAppendPre',
  'FileChangedRO',
  'FileChangedShell',
  'FileChangedShellPost',
  'FileReadCmd',
  'FileReadPost',
  'FileReadPre',
  'FileType',
  'FileWriteCmd',
  'FileWritePost',
  'FileWritePre',
  'CursorHold',
  'CursorHoldI',
  'CursorMoved',
  'CursorMovedI',
  'FocusGained',
  'FocusLost',
  'InsertChange',
  'InsertCharPre',
  'InsertEnter',
  'InsertLeave',
  'CmdlineChanged',
  'CmdlineEnter',
  'CmdlineLeave',
  'CmdUndefined',
  'CmdwinEnter',
  'CmdwinLeave',
  'FuncUndefined',
  'ColorScheme',
  'ColorSchemePre',
  'DirChanged',
  'DisplayChanged',
  'HighlightChanged',
  'OptionSet',
  'PackChanged',
  'PackChangedPre',
  'Progress',
  'TermOpen',
  'TermClose',
  'TermEnter',
  'TermLeave',
  'TermRequest',
  'TermResponse',
  'VimEnter',
  'VimLeave',
  'VimLeavePre',
  'VimResized',
  'VimResume',
  'VimSuspend',
  'WinClosed',
  'WinEnter',
  'WinLeave',
  'WinNew',
  'WinResized',
  'WinScrolled',
  'User',
  'LspAttach',
  'LspDetach',
  'LspNotify',
  'LspProgress',
  'LspRequest',
  'LspTokenUpdate',
  'DiagnosticChanged',
  'DiagnosticHide',
  'DiagnosticShow',
  'CompleteChanged',
  'CompleteDone',
  'CompleteDonePre',
  'MenuPopup',
  'ModeChanged',
  'QuickFixCmdPost',
  'QuickFixCmdPre',
  'RemoteReply',
  'SafeState',
  'SafeStateAgain',
  'SessionLoadPost',
  'ShellCmdPost',
  'ShellFilterPost',
  'SourceCmd',
  'SourcePost',
  'SourcePre',
  'SpellFileMissing',
  'StdinReadPost',
  'StdinReadPre',
  'SwapExists',
  'Syntax',
  'TabClosed',
  'TabEnter',
  'TabLeave',
  'TabNew',
  'TabNewEntered',
  'TextChanged',
  'TextChangedI',
  'TextChangedP',
  'TextYankPost',
  'UIEnter',
  'UILeave',
  'UndoBreak',
]

const knownAutocmdEventNameByLower = new Map<string, string>(
  KNOWN_AUTOCMD_EVENT_NAMES.map((eventName) => [
    eventName.toLowerCase(),
    eventName,
  ]),
)

export function canonicalizeAutocmdEventName(eventName: string): string | null {
  const trimmed = eventName.trim()
  if (trimmed.length === 0) {
    return null
  }

  // Canonical custom event contract: uppercase "User" prefix only.
  if (trimmed.startsWith('User')) {
    return trimmed
  }

  const canonical = knownAutocmdEventNameByLower.get(trimmed.toLowerCase())
  if (canonical === undefined || canonical === 'User') {
    return null
  }

  return canonical
}

export function isValidAutocmdEventName(eventName: string): boolean {
  return canonicalizeAutocmdEventName(eventName) !== null
}

export function normalizeAutocmdEventNames(
  events: readonly string[],
): string[] {
  const normalizedEvents: string[] = []
  const seenLowercase = new Set<string>()

  for (const eventName of events) {
    const canonical = canonicalizeAutocmdEventName(eventName)
    if (canonical === null) {
      continue
    }

    const canonicalLower = canonical.toLowerCase()
    if (seenLowercase.has(canonicalLower)) {
      continue
    }

    seenLowercase.add(canonicalLower)
    normalizedEvents.push(canonical)
  }

  return normalizedEvents
}

export function normalizeNeovimEventName(eventName: string): string | null {
  const normalized = eventName.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  return eventByLowerName.get(normalized)?.name ?? null
}

export function getNeovimEvent(
  eventName: string,
): NeovimEventCatalogEntry | null {
  const normalized = eventName.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }
  return eventByLowerName.get(normalized) ?? null
}
