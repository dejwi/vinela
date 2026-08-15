import type { ActionCatalogEntry } from './action-catalog'
export type { ActionCatalogEntry }

export const ACTION_CATALOG: readonly ActionCatalogEntry[] = [
  // ============================================
  // FILE (Commands + Keys)
  // ============================================
  {
    key: 'write',
    type: 'command',
    category: 'file',
    label: 'Save File',
    shortDescription: 'Write the current buffer to disk',
    whatItDoes:
      "Saves your current file. If the file doesn't exist yet, you'll need to provide a filename.",
    technicalNote:
      'Fails with an error if the buffer has no associated file and no filename is provided.',
    template: ':write',
    example: ':write',
    sourceDoc: ':help :write',
    isPopular: true,
    aliases: ['save', 'w'],
  },
  {
    key: 'write-quit',
    type: 'command',
    category: 'file',
    label: 'Save and Quit',
    shortDescription: 'Save file and close Neovim',
    whatItDoes:
      'Saves your current file and exits Neovim. A common way to finish editing.',
    technicalNote:
      'Equivalent to :write followed by :quit. Fails if the write fails for any reason.',
    template: ':wq',
    example: ':wq',
    sourceDoc: ':help :wq',
    isPopular: true,
    aliases: ['wq', 'save and exit'],
  },
  {
    key: 'quit',
    type: 'command',
    category: 'file',
    label: 'Quit',
    shortDescription: 'Close the current window',
    whatItDoes:
      "Closes the current window. If it's the last window, exits Neovim. Fails if there are unsaved changes.",
    technicalNote:
      'Use :q! to force quit without saving changes. Windows are distinct from buffers.',
    template: ':quit',
    example: ':quit',
    sourceDoc: ':help :quit',
    isPopular: true,
    aliases: ['q', 'close', 'exit'],
  },
  {
    key: 'make-into-location-list',
    type: 'command',
    category: 'lists',
    label: 'Make (Location List)',
    shortDescription: 'Run make and populate location list',
    whatItDoes:
      'Runs the make command and populates the location list with any errors.',
    technicalNote:
      'Like :make but populates the window-local location list instead of the global quickfix list.',
    template: ':lmake',
    example: ':lmake',
    sourceDoc: ':help :lmake',
    aliases: ['local build'],
  },
  {
    key: 'write-quit-all',
    type: 'command',
    category: 'file',
    label: 'Save All and Quit',
    shortDescription: 'Save all files and exit',
    whatItDoes: 'Saves all modified buffers and exits Neovim.',
    technicalNote:
      'Writes all changed buffers to disk, then quits. Fails if any write operation fails.',
    template: ':wqa',
    example: ':wqa',
    sourceDoc: ':help :wqa',
    aliases: ['wqa', 'save all and exit'],
  },
  {
    key: 'edit-force',
    type: 'command',
    category: 'file',
    label: 'Reload File (Discard Changes)',
    shortDescription: 'Reload file, discarding unsaved changes',
    whatItDoes:
      'Reloads the current file from disk, throwing away any unsaved changes. Use with caution!',
    technicalNote:
      'The ! (bang) modifier forces the operation, bypassing unsaved change warnings.',
    template: ':e!',
    example: ':e!',
    sourceDoc: ':help :e!',
    aliases: ['reload', 'revert', 'discard changes'],
  },
  {
    key: 'edit',
    type: 'command',
    category: 'file',
    label: 'Open File',
    shortDescription: 'Open a file for editing',
    whatItDoes:
      'Opens a file in the current window. If no filename is given, reloads the current file.',
    technicalNote:
      'Creates a new buffer if the file is not already loaded. Fails if current buffer has unsaved changes.',
    template: ':edit {path}',
    example: ':edit ~/.config/nvim/init.lua',
    sourceDoc: ':help :edit',
    params: [
      {
        name: 'path',
        type: 'file-path',
        label: 'File Path',
        placeholder: 'path/to/file',
        description: 'Path to the file to open',
        required: true,
      },
    ],
    aliases: ['open', 'e'],
  },
  {
    key: 'write-as',
    type: 'command',
    category: 'file',
    label: 'Save As',
    shortDescription: 'Save file with a new name',
    whatItDoes:
      'Saves the current buffer to a new file. The original file is unchanged.',
    technicalNote:
      'Creates a copy at the new path but keeps editing the original buffer. Use :saveas to switch to the new file.',
    template: ':write {path}',
    example: ':write backup.txt',
    sourceDoc: ':help :write',
    params: [
      {
        name: 'path',
        type: 'file-path',
        label: 'File Path',
        placeholder: 'path/to/file',
        description: 'Path for the new file',
        required: true,
      },
    ],
    aliases: ['save as'],
  },
  {
    key: 'terminal',
    type: 'command',
    category: 'file',
    label: 'Open Terminal',
    shortDescription: 'Open a terminal in Neovim',
    whatItDoes:
      'Opens a terminal emulator inside Neovim. You can run shell commands without leaving the editor.',
    technicalNote:
      'Opens in a new buffer. Use Ctrl-\\ Ctrl-N to exit terminal mode and return to normal mode.',
    template: ':terminal',
    example: ':terminal',
    sourceDoc: ':help :terminal',
    isPopular: true,
    aliases: ['term', 'shell'],
  },
  {
    key: 'shell-command',
    type: 'command',
    category: 'file',
    label: 'Run Shell Command',
    shortDescription: 'Execute a shell command',
    whatItDoes:
      'Runs an external shell command and shows the output. Useful for quick commands without opening a terminal.',
    technicalNote:
      'Pauses Neovim, runs the command, displays output, and waits for Enter. Use % for current filename.',
    template: ':!{command}',
    example: ':!ls -la',
    sourceDoc: ':help :!',
    params: [
      {
        name: 'command',
        type: 'string',
        label: 'Command',
        placeholder: 'ls -la',
        description: 'Shell command to execute',
        required: true,
      },
    ],
    aliases: ['shell', 'exec', 'run'],
  },
  {
    key: 'split-command',
    type: 'command',
    category: 'file',
    label: 'Split Horizontal (Command)',
    shortDescription: 'Open a horizontal split with the current file',
    whatItDoes:
      'Creates a new window above or below the current one by running a command. Optionally opens a different file in the new split.',
    template: ':split',
    example: ':split',
    sourceDoc: ':help :split',
    aliases: ['hsplit', 'split window'],
  },
  {
    key: 'save-all',
    type: 'command',
    category: 'file',
    label: 'Save All',
    shortDescription: 'Save every open modified file',
    whatItDoes:
      'Writes all modified buffers to disk in one go. Handy when you have several files open that all need saving.',
    template: ':wall',
    example: ':wall',
    sourceDoc: ':help :wall',
    aliases: ['write all', 'save all files'],
  },
  {
    key: 'update',
    type: 'command',
    category: 'file',
    label: 'Save If Modified',
    shortDescription: 'Write buffer only if it has unsaved changes',
    whatItDoes:
      'Saves the current buffer only when it has unsaved changes. A smarter alternative to :write that avoids unnecessary disk writes.',
    technicalNote:
      'Only writes if buffer is modified, avoiding unnecessary disk writes and preserving the file modification timestamp when nothing changed.',
    template: ':update',
    example: ':update',
    sourceDoc: ':help :update',
    aliases: ['smart save'],
  },
  {
    key: 'edit-vimrc',
    type: 'command',
    category: 'file',
    label: 'Edit Neovim Config',
    shortDescription: 'Open your Neovim configuration file',
    whatItDoes:
      'Opens your Neovim configuration file (init.lua or init.vim) for editing.',
    technicalNote:
      '$MYVIMRC is set by Neovim to your init file path automatically.',
    template: ':edit $MYVIMRC',
    example: ':edit $MYVIMRC',
    sourceDoc: ':help $MYVIMRC',
    aliases: ['config', 'init.lua', 'vimrc', 'settings'],
  },
  {
    key: 'explore',
    type: 'command',
    category: 'file',
    label: 'Open File Explorer',
    shortDescription: 'Open built-in file explorer (netrw)',
    whatItDoes:
      'Opens the Neovim built-in file explorer (netrw) for the current directory. Lets you browse, open, and manage files without leaving the editor.',
    technicalNote:
      'Uses netrw which is bundled with Neovim. Depends on netrw being enabled (not disabled with noload or noauto).',
    template: ':Explore',
    example: ':Explore',
    sourceDoc: ':help :Explore',
    aliases: ['netrw', 'file browser', 'directory'],
  },
  {
    key: 'colorscheme',
    type: 'command',
    category: 'file',
    label: 'Set Colorscheme',
    shortDescription: 'Switch to a different colorscheme',
    whatItDoes:
      'Switches Neovim to a different colorscheme (color theme). You can preview themes instantly without restarting.',
    technicalNote:
      'Built-in schemes include default, desert, evening, industry, etc. Plugin colorschemes must be loaded first.',
    template: ':colorscheme {name}',
    example: ':colorscheme desert',
    sourceDoc: ':help :colorscheme',
    params: [
      {
        name: 'name',
        type: 'string',
        label: 'Colorscheme Name',
        placeholder: 'desert',
        description: 'Name of the colorscheme to apply',
        required: true,
      },
    ],
    aliases: ['theme', 'color scheme', 'color theme'],
  },
  {
    key: 'copy-file-path',
    type: 'command',
    category: 'file',
    label: 'Copy File Path to Clipboard',
    shortDescription: "Copy the current file's full path to clipboard",
    whatItDoes:
      'Copies the full absolute path of the current file to your system clipboard, so you can paste it in a terminal or other application.',
    technicalNote:
      'expand("%:p") expands to the full file path. @+ is the system clipboard register.',
    template: ':let @+ = expand("%:p")',
    example: ':let @+ = expand("%:p")',
    sourceDoc: ':help expand()',
    aliases: ['copy path', 'file path', 'yank path'],
  },

  // ============================================
  // COPY & PASTE (Clipboard + Registers unified)
  // ============================================
  {
    key: 'yank-clipboard',
    type: 'keys',
    category: 'copy-paste',
    label: 'Copy to System Clipboard',
    shortDescription: 'Copy selected text to system clipboard',
    whatItDoes:
      'Copies the selected text to your system clipboard so you can paste it in other applications (Ctrl+V).',
    technicalNote: 'Uses the + register which maps to the system clipboard.',
    template: '"+y',
    example: '"+y',
    sourceDoc: ':help "+',
    isPopular: true,
    aliases: ['copy', 'clipboard copy', 'system copy'],
  },
  {
    key: 'yank-line-clipboard',
    type: 'keys',
    category: 'copy-paste',
    label: 'Copy Line to Clipboard',
    shortDescription: 'Copy current line to system clipboard',
    whatItDoes: 'Copies the entire current line to your system clipboard.',
    technicalNote:
      'yy is a linewise operation; the newline is included in the copied content.',
    template: '"+yy',
    example: '"+yy',
    sourceDoc: ':help "+',
    isPopular: true,
    aliases: ['copy line'],
  },
  {
    key: 'paste-clipboard',
    type: 'keys',
    category: 'copy-paste',
    label: 'Paste from Clipboard',
    shortDescription: 'Paste from system clipboard after cursor',
    whatItDoes:
      'Pastes text from your system clipboard (what you copied with Ctrl+C in other apps) after the cursor.',
    technicalNote:
      'Linewise yanks are pasted on a new line below; characterwise yanks are pasted after the cursor.',
    template: '"+p',
    example: '"+p',
    sourceDoc: ':help "+',
    isPopular: true,
    aliases: ['paste', 'clipboard paste'],
  },
  {
    key: 'show-help-for-word',
    type: 'keys',
    category: 'help',
    label: 'Show Help for Word',
    shortDescription: 'Open help for word under cursor',
    whatItDoes: 'Opens the help documentation for the word under the cursor.',
    technicalNote:
      'Behavior depends on keywordprg setting. Default runs :help for Vim keywords, man for other filetypes.',
    template: 'K',
    example: 'K',
    sourceDoc: ':help K',
    aliases: ['help word', 'lookup'],
  },
  {
    key: 'cut-clipboard',
    type: 'keys',
    category: 'copy-paste',
    label: 'Cut to System Clipboard',
    shortDescription: 'Cut selected text to system clipboard',
    whatItDoes:
      'Deletes the selected text and puts it in your system clipboard.',
    template: '"+d',
    example: '"+d',
    sourceDoc: ':help "+',
    isPopular: true,
    aliases: ['cut', 'clipboard cut'],
  },
  {
    key: 'cut-line-clipboard',
    type: 'keys',
    category: 'copy-paste',
    label: 'Cut Line to Clipboard',
    shortDescription: 'Cut current line to system clipboard',
    whatItDoes:
      'Deletes the entire current line and puts it in your system clipboard.',
    template: '"+dd',
    example: '"+dd',
    sourceDoc: ':help "+',
    aliases: ['cut line'],
  },
  {
    key: 'yank-to-register',
    type: 'keys',
    category: 'copy-paste',
    label: 'Yank to Register',
    shortDescription: 'Copy text to a named register',
    whatItDoes:
      'Copies text to a named storage slot (a-z). Unlike the clipboard, registers are Neovim-internal and persist across sessions.',
    technicalNote:
      'Use uppercase (A-Z) to append to a register instead of replacing.',
    template: '"{register}y',
    example: '"ay',
    sourceDoc: ':help registers',
    params: [
      {
        name: 'register',
        type: 'character',
        label: 'Register',
        placeholder: 'a',
        description: 'Register name (a-z to store, A-Z to append)',
        required: true,
      },
    ],
    aliases: ['copy to register'],
  },
  {
    key: 'paste-from-register',
    type: 'keys',
    category: 'copy-paste',
    label: 'Paste from Register',
    shortDescription: 'Paste text from a named register',
    whatItDoes:
      'Pastes text from a named storage slot that you previously yanked to.',
    template: '"{register}p',
    example: '"ap',
    sourceDoc: ':help registers',
    params: [
      {
        name: 'register',
        type: 'character',
        label: 'Register',
        placeholder: 'a',
        description: 'Register name to paste from',
        required: true,
      },
    ],
    aliases: ['paste from register'],
  },
  {
    key: 'delete-blackhole',
    type: 'keys',
    category: 'copy-paste',
    label: 'Delete Without Saving',
    shortDescription: 'Delete text without affecting registers',
    whatItDoes:
      'Deletes text without storing it anywhere. Useful when you want to delete without overwriting your clipboard or yank register.',
    technicalNote:
      'Uses the black hole register "_" which discards anything written to it.',
    template: '"_d',
    example: '"_d',
    sourceDoc: ':help "_',
    isPopular: true,
    aliases: ['black hole delete', 'true delete'],
  },
  {
    key: 'paste-last-yank',
    type: 'keys',
    category: 'copy-paste',
    label: 'Paste Last Yank',
    shortDescription: 'Paste what you last yanked (not deleted)',
    whatItDoes:
      'Pastes from the yank register (0), which only contains yanked text, not deleted text. Useful after deleting something.',
    technicalNote:
      'Register 0 always contains the last yank, while registers 1-9 store deleted text.',
    template: '"0p',
    example: '"0p',
    sourceDoc: ':help "0',
    isPopular: true,
    aliases: ['paste yank', 'paste copied'],
  },
  {
    key: 'paste-replace-without-yank',
    type: 'keys',
    category: 'copy-paste',
    label: 'Paste Over Selection (Keep Clipboard)',
    shortDescription: 'Replace selected text without overwriting clipboard',
    whatItDoes:
      'In visual mode, replaces selected text with clipboard without overwriting what you copied. The deleted text goes to the black hole register instead.',
    technicalNote:
      '"_d deletes to black hole register, then P pastes before cursor. This preserves the + register contents.',
    template: '"_dP',
    example: '"_dP',
    sourceDoc: ':help "_',
    isPopular: true,
    aliases: ['paste keep', 'visual paste', 'replace without yank'],
  },

  // ============================================
  // NAVIGATION (Marks + Jumps + Go-to unified)
  // ============================================
  {
    key: 'set-mark',
    type: 'keys',
    category: 'navigation',
    label: 'Set Mark',
    shortDescription: 'Save current position as a bookmark',
    whatItDoes:
      'Creates a bookmark at your cursor position. Use lowercase letters (a-z) for marks within this file, or uppercase (A-Z) for marks that work across files.',
    technicalNote:
      'Lowercase marks are buffer-local, uppercase marks are global.',
    template: 'm{mark}',
    example: 'ma',
    sourceDoc: ':help m',
    params: [
      {
        name: 'mark',
        type: 'character',
        label: 'Mark Letter',
        placeholder: 'a',
        description: 'Letter to identify this mark (a-z local, A-Z global)',
        required: true,
      },
    ],
    isPopular: true,
    aliases: ['bookmark', 'save position'],
  },
  {
    key: 'jump-to-mark',
    type: 'keys',
    category: 'navigation',
    label: 'Jump to Mark',
    shortDescription: 'Go to the line of a saved mark',
    whatItDoes:
      'Jumps to the beginning of the line where you set a mark. Great for quickly navigating to important spots in your code.',
    technicalNote:
      "Jumps to the first non-blank character of the mark's line. Use `{mark} for exact column position.",
    template: "'{mark}",
    example: "'a",
    sourceDoc: ":help '",
    params: [
      {
        name: 'mark',
        type: 'character',
        label: 'Mark Letter',
        placeholder: 'a',
        description: 'The mark to jump to',
        required: true,
      },
    ],
    isPopular: true,
    aliases: ['goto mark', 'go to bookmark'],
  },
  {
    key: 'jump-to-tag-definition',
    type: 'keys',
    category: 'help',
    label: 'Jump to Tag Definition',
    shortDescription: 'Jump to definition of tag under cursor',
    whatItDoes:
      'Jumps to the definition of the tag (function, class, etc.) under the cursor.',
    technicalNote:
      'Requires a tags file generated by ctags or similar. Use Ctrl-T to jump back to previous location.',
    template: '<C-]>',
    example: '<C-]>',
    sourceDoc: ':help CTRL-]',
    aliases: ['goto definition', 'jump to definition'],
  },
  {
    key: 'jump-previous',
    type: 'keys',
    category: 'navigation',
    label: 'Jump to Previous Position',
    shortDescription: 'Go back to where you were before',
    whatItDoes:
      'Returns to your previous cursor position before the last jump. Like an "undo" for navigation.',
    technicalNote:
      "Uses the ' (single quote) mark which tracks the last jump position before the current one.",
    template: "''",
    example: "''",
    sourceDoc: ":help ''",
    isPopular: true,
    aliases: ['go back', 'previous position', 'undo jump'],
  },
  {
    key: 'jump-last-edit',
    type: 'keys',
    category: 'navigation',
    label: 'Jump to Last Edit',
    shortDescription: 'Go to where you last made a change',
    whatItDoes:
      'Jumps to the position where you last edited text. Useful for returning to your work.',
    template: "'.",
    example: "'.",
    sourceDoc: ":help '.",
    isPopular: true,
    aliases: ['last edit', 'last change'],
  },
  {
    key: 'go-to-line',
    type: 'keys',
    category: 'navigation',
    label: 'Go to Line Number',
    shortDescription: 'Jump to a specific line',
    whatItDoes: 'Jumps directly to a specific line number in the file.',
    template: '{line}G',
    example: '42G',
    sourceDoc: ':help G',
    params: [
      {
        name: 'line',
        type: 'number',
        label: 'Line Number',
        placeholder: '1',
        description: 'Line number to jump to',
        required: true,
      },
    ],
    isPopular: true,
    aliases: ['goto line', 'jump to line'],
  },
  {
    key: 'go-to-first-line',
    type: 'keys',
    category: 'navigation',
    label: 'Go to First Line',
    shortDescription: 'Jump to the beginning of file',
    whatItDoes: 'Jumps to the very first line of the file.',
    template: 'gg',
    example: 'gg',
    sourceDoc: ':help gg',
    isPopular: true,
    aliases: ['top of file', 'beginning'],
  },
  {
    key: 'go-to-last-line',
    type: 'keys',
    category: 'navigation',
    label: 'Go to Last Line',
    shortDescription: 'Jump to the end of file',
    whatItDoes: 'Jumps to the very last line of the file.',
    template: 'G',
    example: 'G',
    sourceDoc: ':help G',
    isPopular: true,
    aliases: ['bottom of file', 'end of file'],
  },
  {
    key: 'match-bracket',
    type: 'keys',
    category: 'navigation',
    label: 'Jump to Matching Bracket',
    shortDescription: 'Go to matching (), {}, or []',
    whatItDoes:
      'Jumps between matching pairs of brackets, parentheses, or braces. Essential for navigating code.',
    template: '%',
    example: '%',
    sourceDoc: ':help %',
    isPopular: true,
    aliases: ['matching paren', 'matching brace'],
  },
  {
    key: 'jump-back',
    type: 'keys',
    category: 'navigation',
    label: 'Jump Back',
    shortDescription: 'Go to previous position in jump list',
    whatItDoes:
      'Goes back to where you were before your last jump. Like browser back button for cursor positions.',
    technicalNote:
      'Navigates the jump list, which records positions before long-distance movements (searches, marks, G, gg, etc.).',
    template: '<C-o>',
    example: '<C-o>',
    sourceDoc: ':help CTRL-O',
    isPopular: true,
    aliases: ['go back', 'previous location'],
  },
  {
    key: 'jump-forward',
    type: 'keys',
    category: 'navigation',
    label: 'Jump Forward',
    shortDescription: 'Go to next position in jump list',
    whatItDoes: 'Goes forward in your jump history (after using jump back).',
    technicalNote:
      'Reverses the effect of Ctrl-O. Only works if you have previously jumped backward in the jump list.',
    template: '<C-i>',
    example: '<C-i>',
    sourceDoc: ':help CTRL-I',
    aliases: ['go forward', 'next location'],
  },
  {
    key: 'search-word-forward',
    type: 'keys',
    category: 'navigation',
    label: 'Search Word Under Cursor',
    shortDescription: 'Find next occurrence of current word',
    whatItDoes:
      'Searches forward for the word under your cursor. Great for finding all uses of a variable.',
    template: '*',
    example: '*',
    sourceDoc: ':help *',
    isPopular: true,
    aliases: ['find word', 'search current word'],
  },
  {
    key: 'search-word-backward',
    type: 'keys',
    category: 'navigation',
    label: 'Search Word Backward',
    shortDescription: 'Find previous occurrence of current word',
    whatItDoes: 'Searches backward for the word under your cursor.',
    template: '#',
    example: '#',
    sourceDoc: ':help #',
    aliases: ['find word backward'],
  },
  {
    key: 'search-next',
    type: 'keys',
    category: 'navigation',
    label: 'Next Search Result',
    shortDescription: 'Jump to next search match',
    whatItDoes: 'Jumps to the next occurrence of your last search pattern.',
    technicalNote:
      'Direction depends on the last search: repeats / searches forward, ? searches backward.',
    template: 'n',
    example: 'n',
    sourceDoc: ':help n',
    isPopular: true,
    aliases: ['find next', 'next match'],
  },
  {
    key: 'search-prev',
    type: 'keys',
    category: 'navigation',
    label: 'Previous Search Result',
    shortDescription: 'Jump to previous search match',
    whatItDoes: 'Jumps to the previous occurrence of your last search pattern.',
    technicalNote:
      'Searches in the opposite direction of n: reverses / to backward, ? to forward.',
    template: 'N',
    example: 'N',
    sourceDoc: ':help N',
    aliases: ['find previous', 'prev match'],
  },

  // ============================================
  // EDITING (Text manipulation + Undo/Redo + Repeat)
  // ============================================
  {
    key: 'undo',
    type: 'keys',
    category: 'editing',
    label: 'Undo',
    shortDescription: 'Undo the last change',
    whatItDoes: 'Reverses your last edit. Keep pressing to undo more changes.',
    technicalNote:
      'Neovim maintains an undo tree (not just a linear history), allowing you to recover any previous state.',
    template: 'u',
    example: 'u',
    sourceDoc: ':help u',
    isPopular: true,
    aliases: ['ctrl+z'],
  },
  {
    key: 'redo',
    type: 'keys',
    category: 'editing',
    label: 'Redo',
    shortDescription: 'Redo the last undone change',
    whatItDoes: 'Restores a change you just undid. The opposite of undo.',
    technicalNote:
      'Redoes changes in the current undo branch. Making a new edit after undo creates a new branch.',
    template: '<C-r>',
    example: '<C-r>',
    sourceDoc: ':help CTRL-R',
    isPopular: true,
    aliases: ['ctrl+y'],
  },
  {
    key: 'repeat',
    type: 'keys',
    category: 'editing',
    label: 'Repeat Last Change',
    shortDescription: 'Repeat the last edit command',
    whatItDoes:
      'Repeats your last editing action. Incredibly powerful for repetitive edits.',
    technicalNote:
      'Records the full editing operation including inserts, deletes, and formatting. Works with counts.',
    template: '.',
    example: '.',
    sourceDoc: ':help .',
    isPopular: true,
    aliases: ['dot command', 'repeat edit'],
  },
  {
    key: 'toggle-case',
    type: 'keys',
    category: 'editing',
    label: 'Toggle Case',
    shortDescription: 'Switch character case (upper/lower)',
    whatItDoes:
      'Switches the case of the character under the cursor. Lowercase becomes uppercase and vice versa.',
    technicalNote:
      'Moves cursor one character right after toggling. In visual mode, toggles all selected characters.',
    template: '~',
    example: '~',
    sourceDoc: ':help ~',
    aliases: ['swap case', 'change case'],
  },
  {
    key: 'uppercase-line',
    type: 'keys',
    category: 'editing',
    label: 'Uppercase Line',
    shortDescription: 'Convert current line to UPPERCASE',
    whatItDoes: 'Converts all letters in the current line to uppercase.',
    template: 'gUU',
    example: 'gUU',
    sourceDoc: ':help gU',
    aliases: ['upper', 'caps'],
  },
  {
    key: 'lowercase-line',
    type: 'keys',
    category: 'editing',
    label: 'Lowercase Line',
    shortDescription: 'Convert current line to lowercase',
    whatItDoes: 'Converts all letters in the current line to lowercase.',
    template: 'guu',
    example: 'guu',
    sourceDoc: ':help gu',
    aliases: ['lower'],
  },
  {
    key: 'indent-right',
    type: 'keys',
    category: 'editing',
    label: 'Indent Line Right',
    shortDescription: 'Add indentation to current line',
    whatItDoes:
      'Shifts the current line to the right by one indentation level (usually 2 or 4 spaces).',
    technicalNote:
      'Amount is controlled by shiftwidth setting. Works in visual mode to indent multiple lines.',
    template: '>>',
    example: '>>',
    sourceDoc: ':help >>',
    isPopular: true,
    aliases: ['indent', 'tab'],
  },
  {
    key: 'indent-left',
    type: 'keys',
    category: 'editing',
    label: 'Indent Line Left',
    shortDescription: 'Remove indentation from current line',
    whatItDoes: 'Shifts the current line to the left by one indentation level.',
    technicalNote:
      'Removes shiftwidth characters of indentation. Works in visual mode to outdent multiple lines.',
    template: '<<',
    example: '<<',
    sourceDoc: ':help <<',
    isPopular: true,
    aliases: ['outdent', 'unindent', 'dedent'],
  },
  {
    key: 'join-lines',
    type: 'keys',
    category: 'editing',
    label: 'Join Lines',
    shortDescription: 'Merge current line with next line',
    whatItDoes:
      'Joins the current line with the line below it, adding a space between them.',
    technicalNote:
      'Removes the line break and leading whitespace, inserting one space. Use gJ to join without adding space.',
    template: 'J',
    example: 'J',
    sourceDoc: ':help J',
    isPopular: true,
    aliases: ['merge lines', 'combine lines'],
  },
  {
    key: 'increment-number',
    type: 'keys',
    category: 'editing',
    label: 'Increment Number',
    shortDescription: 'Add 1 to number under cursor',
    whatItDoes:
      'Finds the next number on the line and increases it by 1. Great for quickly adjusting values.',
    technicalNote:
      'Works with decimal, octal (0 prefix), and hexadecimal (0x prefix) numbers.',
    template: '<C-a>',
    example: '<C-a>',
    sourceDoc: ':help CTRL-A',
    aliases: ['add', 'increase', 'plus one'],
  },
  {
    key: 'decrement-number',
    type: 'keys',
    category: 'editing',
    label: 'Decrement Number',
    shortDescription: 'Subtract 1 from number under cursor',
    whatItDoes: 'Finds the next number on the line and decreases it by 1.',
    technicalNote:
      'Supports decimal, octal (0 prefix), and hex (0x prefix). Use a count prefix to decrement by more.',
    template: '<C-x>',
    example: '<C-x>',
    sourceDoc: ':help CTRL-X',
    aliases: ['subtract', 'decrease', 'minus one'],
  },
  {
    key: 'close-other-windows',
    type: 'keys',
    category: 'layout',
    label: 'Close Other Windows',
    shortDescription: 'Make current window the only one',
    whatItDoes:
      'Closes all windows except the current one. Quick way to focus on one file.',
    technicalNote:
      'Fails if any other window has unsaved changes. Buffers remain loaded even after their windows close.',
    template: '<C-w>o',
    example: '<C-w>o',
    sourceDoc: ':help CTRL-W_o',
    aliases: ['only window', 'maximize'],
  },
  {
    key: 'change-inner-word',
    type: 'keys',
    category: 'editing',
    label: 'Change Word',
    shortDescription: 'Delete word and enter insert mode',
    whatItDoes:
      'Deletes the word under the cursor and puts you in insert mode to type a replacement.',
    technicalNote:
      'ciw targets the inner word, excluding surrounding whitespace. Use caw to include whitespace.',
    template: 'ciw',
    example: 'ciw',
    sourceDoc: ':help ciw',
    isPopular: true,
    aliases: ['replace word', 'edit word'],
  },
  {
    key: 'delete-inner-word',
    type: 'keys',
    category: 'editing',
    label: 'Delete Word',
    shortDescription: 'Delete the word under cursor',
    whatItDoes: 'Deletes the entire word that the cursor is on.',
    template: 'diw',
    example: 'diw',
    sourceDoc: ':help diw',
    isPopular: true,
    aliases: ['remove word'],
  },
  {
    key: 'change-inner-quotes',
    type: 'keys',
    category: 'editing',
    label: 'Change Inside Quotes',
    shortDescription: 'Replace text inside quotes',
    whatItDoes:
      'Deletes the text inside quotes and puts you in insert mode to type a replacement.',
    template: 'ci"',
    example: 'ci"',
    sourceDoc: ':help ci"',
    isPopular: true,
    aliases: ['change string', 'edit quoted'],
  },
  {
    key: 'change-inner-parens',
    type: 'keys',
    category: 'editing',
    label: 'Change Inside Parentheses',
    shortDescription: 'Replace text inside ()',
    whatItDoes:
      'Deletes the text inside parentheses and puts you in insert mode.',
    template: 'ci(',
    example: 'ci(',
    sourceDoc: ':help ci(',
    aliases: ['change parens', 'edit arguments'],
  },
  {
    key: 'change-inner-braces',
    type: 'keys',
    category: 'editing',
    label: 'Change Inside Braces',
    shortDescription: 'Replace text inside {}',
    whatItDoes:
      'Deletes the text inside curly braces and puts you in insert mode. Great for replacing function bodies.',
    template: 'ci{',
    example: 'ci{',
    sourceDoc: ':help ci{',
    aliases: ['change block', 'edit body'],
  },
  {
    key: 'select-all',
    type: 'keys',
    category: 'editing',
    label: 'Select All',
    shortDescription: 'Select entire file contents',
    whatItDoes: 'Selects all text in the file, from first line to last.',
    technicalNote:
      'gg jumps to line 1, V enters linewise visual mode, G jumps to last line.',
    template: 'ggVG',
    example: 'ggVG',
    sourceDoc: ':help visual-mode',
    isPopular: true,
    aliases: ['select everything', 'ctrl+a'],
  },
  {
    key: 'reselect',
    type: 'keys',
    category: 'editing',
    label: 'Reselect Last Selection',
    shortDescription: 'Select the same text again',
    whatItDoes:
      'Reselects the text that was last selected in Visual mode. Useful after an operation.',
    template: 'gv',
    example: 'gv',
    sourceDoc: ':help gv',
    aliases: ['select again', 'previous selection'],
  },

  // ============================================
  // LAYOUT (Tabs + Windows unified)
  // ============================================
  {
    key: 'split-horizontal',
    type: 'keys',
    category: 'layout',
    label: 'Split Horizontally',
    shortDescription: 'Split window into top and bottom',
    whatItDoes:
      'Creates a new window above or below the current one, showing the same file.',
    technicalNote:
      'Creates a horizontal divider, stacking windows vertically. Both windows show the same buffer initially.',
    template: '<C-w>s',
    example: '<C-w>s',
    sourceDoc: ':help CTRL-W_s',
    isPopular: true,
    aliases: ['horizontal split', 'split window'],
  },
  {
    key: 'split-vertical',
    type: 'keys',
    category: 'layout',
    label: 'Split Vertically',
    shortDescription: 'Split window into left and right',
    whatItDoes:
      'Creates a new window to the side of the current one, showing the same file.',
    technicalNote:
      'Creates a vertical divider, stacking windows horizontally. Both windows show the same buffer initially.',
    template: '<C-w>v',
    example: '<C-w>v',
    sourceDoc: ':help CTRL-W_v',
    isPopular: true,
    aliases: ['vertical split', 'vsplit'],
  },
  {
    key: 'vsplit-command',
    type: 'command',
    category: 'layout',
    label: 'Vertical Split (Command)',
    shortDescription: 'Split window vertically',
    whatItDoes:
      'Creates a vertical split. Optionally opens a file in the new window.',
    template: ':vs',
    example: ':vs',
    sourceDoc: ':help :vs',
    aliases: ['vsplit'],
  },
  {
    key: 'quit-all',
    type: 'command',
    category: 'file',
    label: 'Quit All',
    shortDescription: 'Close all windows and exit',
    whatItDoes:
      'Closes all windows and exits Neovim. Fails if any buffer has unsaved changes.',
    technicalNote:
      'Use :qa! to force quit without saving. All unsaved changes will be lost.',
    template: ':qa',
    example: ':qa',
    sourceDoc: ':help :qa',
    aliases: ['qa', 'quit all', 'exit all'],
  },
  {
    key: 'close-window',
    type: 'keys',
    category: 'layout',
    label: 'Close Window',
    shortDescription: 'Close the current window',
    whatItDoes:
      'Closes the current window. The buffer (file) stays open in memory.',
    technicalNote:
      'Closes the window view only; the buffer remains loaded. Fails if it is the last window for an unsaved buffer.',
    template: '<C-w>c',
    example: '<C-w>c',
    sourceDoc: ':help CTRL-W_c',
    isPopular: true,
    aliases: ['close split'],
  },
  {
    key: 'quit-window',
    type: 'keys',
    category: 'layout',
    label: 'Quit Window',
    shortDescription: 'Close window (same as :quit)',
    whatItDoes:
      'Closes the current window. If it is the last window, exits Neovim.',
    technicalNote:
      'Equivalent to :quit. Fails if the buffer has unsaved changes and is not shown in another window.',
    template: '<C-w>q',
    example: '<C-w>q',
    sourceDoc: ':help CTRL-W_q',
    aliases: ['close window'],
  },
  {
    key: 'next-window',
    type: 'keys',
    category: 'layout',
    label: 'Next Window',
    shortDescription: 'Move to the next window',
    whatItDoes: 'Cycles to the next window in order (down and right).',
    technicalNote:
      'Cycles through windows in top-to-bottom, left-to-right order. Wraps to first window after last.',
    template: '<C-w>w',
    example: '<C-w>w',
    sourceDoc: ':help CTRL-W_w',
    isPopular: true,
    aliases: ['cycle window'],
  },
  {
    key: 'move-cursor-to-top-left',
    type: 'keys',
    category: 'layout',
    label: 'Move Cursor to Top-Left Window',
    shortDescription: 'Jump to top-left window',
    whatItDoes: 'Moves the cursor to the top-left window.',
    technicalNote:
      'Jumps to the topmost, leftmost window in the current tab page.',
    template: '<C-w>t',
    example: '<C-w>t',
    sourceDoc: ':help CTRL-W_t',
    aliases: ['top left window'],
  },
  {
    key: 'window-down',
    type: 'keys',
    category: 'layout',
    label: 'Window Down',
    shortDescription: 'Move to window below',
    whatItDoes: 'Moves cursor to the window below the current one.',
    template: '<C-w>j',
    example: '<C-w>j',
    sourceDoc: ':help CTRL-W_j',
  },
  {
    key: 'window-up',
    type: 'keys',
    category: 'layout',
    label: 'Window Up',
    shortDescription: 'Move to window above',
    whatItDoes: 'Moves cursor to the window above the current one.',
    template: '<C-w>k',
    example: '<C-w>k',
    sourceDoc: ':help CTRL-W_k',
  },
  {
    key: 'move-cursor-to-bottom-right',
    type: 'keys',
    category: 'layout',
    label: 'Move Cursor to Bottom-Right Window',
    shortDescription: 'Jump to bottom-right window',
    whatItDoes: 'Moves the cursor to the bottom-right window.',
    technicalNote:
      'Jumps to the bottommost, rightmost window in the current tab page.',
    template: '<C-w>b',
    example: '<C-w>b',
    sourceDoc: ':help CTRL-W_b',
    aliases: ['bottom right window'],
  },
  {
    key: 'equalize-windows',
    type: 'keys',
    category: 'layout',
    label: 'Equalize Windows',
    shortDescription: 'Make all windows equal size',
    whatItDoes: 'Resizes all windows to be approximately equal in size.',
    technicalNote:
      'Distributes available space equally among all windows, respecting minimum height/width settings.',
    template: '<C-w>=',
    example: '<C-w>=',
    sourceDoc: ':help CTRL-W_=',
    aliases: ['equal size', 'balance windows'],
  },
  {
    key: 'next-tab',
    type: 'keys',
    category: 'layout',
    label: 'Next Tab',
    shortDescription: 'Switch to the next tab',
    whatItDoes:
      "Moves to the next tab page. If you're on the last tab, wraps around to the first.",
    template: 'gt',
    example: 'gt',
    sourceDoc: ':help gt',
    isPopular: true,
    aliases: ['tab right'],
  },
  {
    key: 'rotate-windows',
    type: 'keys',
    category: 'layout',
    label: 'Rotate Windows',
    shortDescription: 'Rotate window positions downward/right',
    whatItDoes: 'Rotates the position of windows in the current row or column.',
    technicalNote:
      'Rotates windows downward/rightward in the current split group. Use Ctrl-W R to rotate upward/leftward.',
    template: '<C-w>r',
    example: '<C-w>r',
    sourceDoc: ':help CTRL-W_r',
    aliases: ['rotate'],
  },
  {
    key: 'go-to-tab',
    type: 'keys',
    category: 'layout',
    label: 'Go to Tab Number',
    shortDescription: 'Jump to a specific tab by number',
    whatItDoes: 'Jumps directly to a specific tab. Tab 1 is the leftmost tab.',
    technicalNote:
      'Tab numbers are 1-indexed. Without a count, gt moves to the next tab.',
    template: '{number}gt',
    example: '3gt',
    sourceDoc: ':help gt',
    params: [
      {
        name: 'number',
        type: 'number',
        label: 'Tab Number',
        placeholder: '1',
        description: 'Tab number (1 = first tab)',
        required: true,
      },
    ],
    aliases: ['switch to tab', 'jump to tab'],
  },
  {
    key: 'new-tab',
    type: 'command',
    category: 'layout',
    label: 'New Tab',
    shortDescription: 'Open a new tab',
    whatItDoes: 'Creates a new tab page with an empty buffer.',
    technicalNote:
      'Tabs in Neovim/Vim are containers for windows (layouts), not individual files like browser tabs.',
    template: ':tabnew',
    example: ':tabnew',
    sourceDoc: ':help :tabnew',
    aliases: ['create tab'],
  },
  {
    key: 'close-tab',
    type: 'command',
    category: 'layout',
    label: 'Close Tab',
    shortDescription: 'Close the current tab',
    whatItDoes: 'Closes the current tab page and all its windows.',
    technicalNote:
      'Closes all windows in the tab. Fails if any window has unsaved changes. Buffers remain loaded.',
    template: ':tabclose',
    example: ':tabclose',
    sourceDoc: ':help :tabclose',
    aliases: ['close tab'],
  },
  {
    key: 'prev-tab',
    type: 'keys',
    category: 'layout',
    label: 'Previous Tab',
    shortDescription: 'Switch to the previous tab',
    whatItDoes:
      "Moves to the previous tab page. If you're on the first tab, wraps around to the last.",
    template: 'gT',
    example: 'gT',
    sourceDoc: ':help gT',
    aliases: ['tab left', 'tab prev'],
  },
  {
    key: 'open-buffer-in-tab',
    type: 'command',
    category: 'layout',
    label: 'Open Buffer in New Tab',
    shortDescription: 'Open the current buffer in a new tab',
    whatItDoes:
      'Opens the file you are currently editing in a brand-new tab page, letting you view it side-by-side with other tabs.',
    technicalNote: '% expands to the current buffer file path',
    template: ':tabnew %',
    example: ':tabnew %',
    sourceDoc: ':help :tabnew',
    aliases: ['buffer in tab', 'file in tab'],
  },
  {
    key: 'window-left',
    type: 'keys',
    category: 'layout',
    label: 'Window Left',
    shortDescription: 'Move to the window to the left',
    whatItDoes:
      'Moves the cursor to the window immediately to the left of the current one.',
    template: '<C-w>h',
    example: '<C-w>h',
    sourceDoc: ':help CTRL-W_h',
  },
  {
    key: 'window-right',
    type: 'keys',
    category: 'layout',
    label: 'Window Right',
    shortDescription: 'Move to the window to the right',
    whatItDoes:
      'Moves the cursor to the window immediately to the right of the current one.',
    template: '<C-w>l',
    example: '<C-w>l',
    sourceDoc: ':help CTRL-W_l',
  },
  {
    key: 'window-previous',
    type: 'keys',
    category: 'layout',
    label: 'Previous Window',
    shortDescription: 'Return to the previously active window',
    whatItDoes:
      'Move to the previously active window — like Alt+Tab but for splits.',
    template: '<C-w>p',
    example: '<C-w>p',
    sourceDoc: ':help CTRL-W_p',
    aliases: ['last window', 'alternate window'],
  },
  {
    key: 'tab-first',
    type: 'command',
    category: 'layout',
    label: 'First Tab',
    shortDescription: 'Switch to the very first tab',
    whatItDoes: 'Jumps to the leftmost tab page.',
    template: ':tabfirst',
    example: ':tabfirst',
    sourceDoc: ':help :tabfirst',
    aliases: ['first tab'],
  },
  {
    key: 'tab-last',
    type: 'command',
    category: 'layout',
    label: 'Last Tab',
    shortDescription: 'Switch to the very last tab',
    whatItDoes: 'Jumps to the rightmost tab page.',
    template: ':tablast',
    example: ':tablast',
    sourceDoc: ':help :tablast',
    aliases: ['last tab'],
  },
  {
    key: 'window-increase-height',
    type: 'keys',
    category: 'layout',
    label: 'Increase Window Height',
    shortDescription: 'Make the current window taller',
    whatItDoes:
      'Increases the height of the current window by one row. Use a count prefix (e.g. 5<C-w>+) to resize by more.',
    template: '<C-w>+',
    example: '<C-w>+',
    sourceDoc: ':help CTRL-W_+',
    aliases: ['taller window', 'resize height up'],
  },
  {
    key: 'window-decrease-height',
    type: 'keys',
    category: 'layout',
    label: 'Decrease Window Height',
    shortDescription: 'Make the current window shorter',
    whatItDoes:
      'Decreases the height of the current window by one row. Use a count prefix to resize by more.',
    template: '<C-w>-',
    example: '<C-w>-',
    sourceDoc: ':help CTRL-W_-',
    aliases: ['shorter window', 'resize height down'],
  },
  {
    key: 'window-increase-width',
    type: 'keys',
    category: 'layout',
    label: 'Increase Window Width',
    shortDescription: 'Make the current window wider',
    whatItDoes:
      'Increases the width of the current window by one column. Use a count prefix to resize by more.',
    template: '<C-w>>',
    example: '<C-w>>',
    sourceDoc: ':help CTRL-W_>',
    aliases: ['wider window', 'resize width up'],
  },
  {
    key: 'window-decrease-width',
    type: 'keys',
    category: 'layout',
    label: 'Decrease Window Width',
    shortDescription: 'Make the current window narrower',
    whatItDoes:
      'Decreases the width of the current window by one column. Use a count prefix to resize by more.',
    template: '<C-w><',
    example: '<C-w><',
    sourceDoc: ':help CTRL-W_<',
    aliases: ['narrower window', 'resize width down'],
  },

  // ============================================
  // LISTS (Quickfix + Location List unified)
  // ============================================
  {
    key: 'quickfix-open',
    type: 'command',
    category: 'lists',
    label: 'Open Quickfix List',
    shortDescription: 'Show the quickfix window',
    whatItDoes:
      'Opens the quickfix window which shows compiler errors, search results, or other lists.',
    technicalNote:
      'Quickfix is global across all windows, unlike the location list which is window-local.',
    template: ':copen',
    example: ':copen',
    sourceDoc: ':help :copen',
    isPopular: true,
    aliases: ['show errors', 'error list'],
  },
  {
    key: 'quickfix-close',
    type: 'command',
    category: 'lists',
    label: 'Close Quickfix List',
    shortDescription: 'Hide the quickfix window',
    whatItDoes: 'Closes the quickfix window.',
    template: ':cclose',
    example: ':cclose',
    sourceDoc: ':help :cclose',
    aliases: ['hide errors'],
  },
  {
    key: 'quickfix-next',
    type: 'command',
    category: 'lists',
    label: 'Next Quickfix Item',
    shortDescription: 'Jump to next error/result',
    whatItDoes:
      'Jumps to the next item in the quickfix list (next error, next search result, etc.).',
    technicalNote:
      'Navigates the global quickfix list. Wraps to first item after last if wrapscan is set.',
    template: ':cnext',
    example: ':cnext',
    sourceDoc: ':help :cnext',
    isPopular: true,
    aliases: ['next error', 'cn'],
  },
  {
    key: 'quickfix-prev',
    type: 'command',
    category: 'lists',
    label: 'Previous Quickfix Item',
    shortDescription: 'Jump to previous error/result',
    whatItDoes: 'Jumps to the previous item in the quickfix list.',
    technicalNote:
      'Navigates backward in the global quickfix list. Wraps to last item if wrapscan is set.',
    template: ':cprev',
    example: ':cprev',
    sourceDoc: ':help :cprev',
    aliases: ['previous error', 'cp'],
  },
  {
    key: 'make-into-quickfix',
    type: 'command',
    category: 'lists',
    label: 'Make (Build)',
    shortDescription: 'Run make and populate quickfix',
    whatItDoes:
      'Runs the make command and populates the quickfix list with any errors.',
    technicalNote:
      'Uses makeprg setting (default: "make"). Parses output using errorformat to populate quickfix list.',
    template: ':make',
    example: ':make',
    sourceDoc: ':help :make',
    aliases: ['build', 'compile'],
  },
  {
    key: 'loclist-close',
    type: 'command',
    category: 'lists',
    label: 'Close Location List',
    shortDescription: 'Hide the location list window',
    whatItDoes: 'Closes the location list window.',
    template: ':lclose',
    example: ':lclose',
    sourceDoc: ':help :lclose',
  },
  {
    key: 'loclist-next',
    type: 'command',
    category: 'lists',
    label: 'Next Location',
    shortDescription: 'Jump to next location list item',
    whatItDoes: 'Jumps to the next item in the location list.',
    technicalNote:
      'Navigates the window-local location list. Each window has its own independent location list.',
    template: ':lnext',
    example: ':lnext',
    sourceDoc: ':help :lnext',
    aliases: ['ln'],
  },
  {
    key: 'loclist-prev',
    type: 'command',
    category: 'lists',
    label: 'Previous Location',
    shortDescription: 'Jump to previous location list item',
    whatItDoes: 'Jumps to the previous item in the location list.',
    technicalNote:
      'Navigates backward in the window-local location list. Independent from other windows.',
    template: ':lprev',
    example: ':lprev',
    sourceDoc: ':help :lprev',
    aliases: ['lp'],
  },
  {
    key: 'loclist-open',
    type: 'command',
    category: 'lists',
    label: 'Open Location List',
    shortDescription: 'Show the location list window',
    whatItDoes:
      'Opens the location list window for the current window. The location list is a window-local version of the quickfix list, often populated by LSP or linters.',
    technicalNote:
      'Each window has its own independent location list, unlike the global quickfix list.',
    template: ':lopen',
    example: ':lopen',
    sourceDoc: ':help :lopen',
    aliases: ['show locations', 'location list'],
  },
  {
    key: 'quickfix-next-centered',
    type: 'command',
    category: 'lists',
    label: 'Next Quickfix Item (Centered)',
    shortDescription: 'Jump to next error and center cursor',
    whatItDoes:
      'Jumps to the next quickfix item and centers the cursor vertically in the window. Keeps the result visible without straining your eyes.',
    technicalNote:
      ':cnext jumps to the next item, then zz centers the screen on the cursor line.',
    template: ':cnext | normal! zz',
    example: ':cnext | normal! zz',
    sourceDoc: ':help :cnext',
    aliases: ['next error centered'],
  },
  {
    key: 'quickfix-prev-centered',
    type: 'command',
    category: 'lists',
    label: 'Previous Quickfix Item (Centered)',
    shortDescription: 'Jump to previous error and center cursor',
    whatItDoes:
      'Jumps to the previous quickfix item and centers the cursor vertically in the window.',
    technicalNote:
      ':cprev jumps to the previous item, then zz centers the screen on the cursor line.',
    template: ':cprev | normal! zz',
    example: ':cprev | normal! zz',
    sourceDoc: ':help :cprev',
    aliases: ['prev error centered'],
  },
  {
    key: 'loclist-next-centered',
    type: 'command',
    category: 'lists',
    label: 'Next Location (Centered)',
    shortDescription: 'Jump to next location list item and center cursor',
    whatItDoes:
      'Jumps to the next location list item and centers the cursor vertically in the window.',
    technicalNote:
      ':lnext jumps to the next item in the window-local location list, then zz centers the screen.',
    template: ':lnext | normal! zz',
    example: ':lnext | normal! zz',
    sourceDoc: ':help :lnext',
    aliases: ['next location centered'],
  },
  {
    key: 'loclist-prev-centered',
    type: 'command',
    category: 'lists',
    label: 'Previous Location (Centered)',
    shortDescription: 'Jump to previous location list item and center cursor',
    whatItDoes:
      'Jumps to the previous location list item and centers the cursor vertically in the window.',
    technicalNote:
      ':lprev jumps to the previous item in the window-local location list, then zz centers the screen.',
    template: ':lprev | normal! zz',
    example: ':lprev | normal! zz',
    sourceDoc: ':help :lprev',
    aliases: ['prev location centered'],
  },

  // ============================================
  // FOLDING
  // ============================================
  {
    key: 'fold-open',
    type: 'keys',
    category: 'folding',
    label: 'Open Fold',
    shortDescription: 'Expand the fold under cursor',
    whatItDoes:
      'Opens (expands) the fold at the cursor position to show the hidden code.',
    template: 'zo',
    example: 'zo',
    sourceDoc: ':help zo',
    isPopular: true,
    aliases: ['expand fold', 'unfold'],
  },
  {
    key: 'fold-close',
    type: 'keys',
    category: 'folding',
    label: 'Close Fold',
    shortDescription: 'Collapse the fold under cursor',
    whatItDoes:
      'Closes (collapses) the fold at the cursor position to hide the code.',
    template: 'zc',
    example: 'zc',
    sourceDoc: ':help zc',
    isPopular: true,
    aliases: ['collapse fold', 'fold'],
  },
  {
    key: 'fold-toggle',
    type: 'keys',
    category: 'folding',
    label: 'Toggle Fold',
    shortDescription: 'Open or close fold under cursor',
    whatItDoes:
      'Toggles the fold at cursor: opens it if closed, closes it if open.',
    technicalNote:
      'Toggles one level of folding at cursor. Use zA to toggle all nested folds recursively.',
    template: 'za',
    example: 'za',
    sourceDoc: ':help za',
    isPopular: true,
    aliases: ['toggle collapse'],
  },
  {
    key: 'fold-open-all',
    type: 'keys',
    category: 'folding',
    label: 'Open All Folds',
    shortDescription: 'Expand all folds in file',
    whatItDoes: 'Opens all folds in the entire file, showing all code.',
    technicalNote:
      'Sets foldlevel to the deepest fold level in the buffer, opening all folds recursively.',
    template: 'zR',
    example: 'zR',
    sourceDoc: ':help zR',
    aliases: ['expand all', 'unfold all'],
  },
  {
    key: 'fold-close-all',
    type: 'keys',
    category: 'folding',
    label: 'Close All Folds',
    shortDescription: 'Collapse all folds in file',
    whatItDoes: 'Closes all folds in the entire file, hiding nested code.',
    technicalNote:
      'Sets foldlevel to 0, closing all folds at all levels. Depends on foldmethod setting.',
    template: 'zM',
    example: 'zM',
    sourceDoc: ':help zM',
    aliases: ['collapse all', 'fold all'],
  },

  // ============================================
  // BUFFER OPERATIONS (8 new actions)
  // ============================================
  {
    key: 'buffer-next',
    type: 'command',
    category: 'file',
    label: 'Next Buffer',
    shortDescription: 'Switch to the next buffer',
    whatItDoes:
      'Switches to the next buffer in the buffer list. Buffers are open files in memory, independent of windows.',
    technicalNote:
      'Buffers remain loaded even when not visible. Each window displays one buffer at a time.',
    template: ':bnext',
    example: ':bnext',
    sourceDoc: ':help :bnext',
    aliases: ['bnext', 'next buffer'],
  },
  {
    key: 'buffer-prev',
    type: 'command',
    category: 'file',
    label: 'Previous Buffer',
    shortDescription: 'Switch to the previous buffer',
    whatItDoes:
      'Switches to the previous buffer in the buffer list. Buffers are open files in memory.',
    technicalNote:
      'Cycles backward through loaded buffers. Wraps to last buffer after first.',
    template: ':bprev',
    example: ':bprev',
    sourceDoc: ':help :bprev',
    aliases: ['bprev', 'previous buffer'],
  },
  {
    key: 'buffer-delete',
    type: 'command',
    category: 'file',
    label: 'Delete Buffer',
    shortDescription: 'Delete the current buffer',
    whatItDoes:
      'Removes the current buffer (open file) from memory. Fails if the buffer has unsaved changes.',
    technicalNote:
      'Closes the buffer and its windows. Use :bdelete! to force deletion without saving.',
    template: ':bdelete',
    example: ':bdelete',
    sourceDoc: ':help :bdelete',
    aliases: ['bdelete', 'delete buffer'],
  },
  {
    key: 'buffer-delete-force',
    type: 'command',
    category: 'file',
    label: 'Force Delete Buffer',
    shortDescription: 'Force delete the current buffer',
    whatItDoes:
      'Removes the current buffer from memory even if it has unsaved changes. Use with caution!',
    technicalNote:
      'The ! (bang) modifier discards unsaved changes without warning. Data loss is permanent.',
    template: ':bdelete!',
    example: ':bdelete!',
    sourceDoc: ':help :bdelete',
    aliases: ['force delete buffer'],
  },
  {
    key: 'buffer-list',
    type: 'command',
    category: 'file',
    label: 'List Buffers',
    shortDescription: 'Show all open buffers',
    whatItDoes:
      'Displays a list of all buffers (open files) with their status and numbers.',
    technicalNote:
      'Shows buffer number, indicators (% = current, # = alternate, + = modified), and file path.',
    template: ':ls',
    example: ':ls',
    sourceDoc: ':help :ls',
    aliases: ['ls', 'buffers', 'list buffers'],
  },
  {
    key: 'buffer-first',
    type: 'command',
    category: 'file',
    label: 'First Buffer',
    shortDescription: 'Switch to the first buffer',
    whatItDoes:
      'Jumps to the first buffer in the buffer list (lowest buffer number).',
    technicalNote:
      'Buffer numbers are assigned sequentially as files are opened.',
    template: ':bfirst',
    example: ':bfirst',
    sourceDoc: ':help :bfirst',
    aliases: ['bfirst', 'first buffer'],
  },
  {
    key: 'buffer-last',
    type: 'command',
    category: 'file',
    label: 'Last Buffer',
    shortDescription: 'Switch to the last buffer',
    whatItDoes:
      'Jumps to the last buffer in the buffer list (highest buffer number).',
    technicalNote:
      'Typically the most recently opened file, unless buffers were deleted.',
    template: ':blast',
    example: ':blast',
    sourceDoc: ':help :blast',
    aliases: ['blast', 'last buffer'],
  },
  {
    key: 'buffer-alternate',
    type: 'command',
    category: 'file',
    label: 'Alternate Buffer',
    shortDescription: 'Switch to the alternate buffer',
    whatItDoes:
      'Switches to the alternate buffer (the last buffer you were editing). Like Alt+Tab for files.',
    technicalNote:
      'The # symbol refers to the alternate buffer. Use Ctrl-^ in normal mode as a shortcut.',
    template: ':buffer #',
    example: ':buffer #',
    sourceDoc: ':help :buffer',
    aliases: ['alternate buffer', 'previous buffer'],
  },

  // ============================================
  // SEARCH COMMANDS (5 new actions)
  // ============================================
  {
    key: 'search-forward-command',
    type: 'command',
    category: 'search',
    label: 'Search Forward',
    shortDescription: 'Search forward for pattern',
    whatItDoes: 'Starts a forward search for the given pattern.',
    technicalNote:
      'Stores pattern in search register (/). Use n to repeat forward, N to repeat backward. Wraps if wrapscan is set.',
    template: '/{pattern}',
    example: '/function',
    sourceDoc: ':help /',
    params: [
      {
        name: 'pattern',
        type: 'string',
        label: 'Search Pattern',
        placeholder: 'pattern to find',
        description: 'Pattern to search for',
        required: true,
      },
    ],
    aliases: ['forward search'],
  },
  {
    key: 'search-backward-command',
    type: 'command',
    category: 'search',
    label: 'Search Backward',
    shortDescription: 'Search backward for pattern',
    whatItDoes: 'Starts a backward search for the given pattern.',
    technicalNote:
      'Stores pattern in search register (?). Use n to repeat backward, N to repeat forward. Wraps if wrapscan is set.',
    template: '?{pattern}',
    example: '?function',
    sourceDoc: ':help ?',
    params: [
      {
        name: 'pattern',
        type: 'string',
        label: 'Search Pattern',
        placeholder: 'pattern to find',
        description: 'Pattern to search for',
        required: true,
      },
    ],
    aliases: ['backward search'],
  },
  {
    key: 'search-clear-highlight',
    type: 'command',
    category: 'search',
    label: 'Clear Search Highlight',
    shortDescription: 'Clear search highlighting',
    whatItDoes: 'Removes the highlighting of search matches.',
    technicalNote:
      'Clears highlight display temporarily; search pattern remains active. Highlighting returns on next search or :set hlsearch.',
    template: ':nohlsearch',
    example: ':nohlsearch',
    sourceDoc: ':help :nohlsearch',
    aliases: ['nohlsearch', 'clear highlight', 'no hl'],
  },
  {
    key: 'search-substitute-global',
    type: 'command',
    category: 'search',
    label: 'Substitute in File',
    shortDescription: 'Replace pattern globally in file',
    whatItDoes:
      'Replaces all occurrences of a pattern with a replacement in the entire file.',
    technicalNote:
      'The % range means entire file. The g flag replaces all occurrences per line; without g, only the first per line.',
    template: ':%s/{pattern}/{replacement}/g',
    example: ':%s/foo/bar/g',
    sourceDoc: ':help :s',
    params: [
      {
        name: 'pattern',
        type: 'string',
        label: 'Pattern to Replace',
        placeholder: 'old text',
        description: 'Pattern to search for',
        required: true,
      },
      {
        name: 'replacement',
        type: 'string',
        label: 'Replacement',
        placeholder: 'new text',
        description: 'Text to replace with',
        required: false,
      },
    ],
    aliases: ['substitute', 'replace', 'find and replace'],
  },
  {
    key: 'search-vimgrep-project',
    type: 'command',
    category: 'search',
    label: 'Search Project Files',
    shortDescription: 'Search for pattern across all project files',
    whatItDoes: 'Searches for a pattern across all files in the project.',
    technicalNote:
      'Results populate the quickfix list. Use :copen to view results.',
    template: ':vimgrep /{pattern}/gj **/*',
    example: ':vimgrep /function/gj **/*',
    sourceDoc: ':help :vimgrep',
    params: [
      {
        name: 'pattern',
        type: 'string',
        label: 'Search Pattern',
        placeholder: 'pattern to find',
        description: 'Pattern to search for across all files',
        required: true,
      },
    ],
    aliases: ['vimgrep', 'project search', 'grep'],
  },

  // ============================================
  // HELP COMMANDS (3 new actions)
  // ============================================
  {
    key: 'help-topic',
    type: 'command',
    category: 'help',
    label: 'Open Help Topic',
    shortDescription: 'Open help for a topic',
    whatItDoes: 'Opens the help documentation for the specified topic.',
    template: ':help {topic}',
    example: ':help motion.txt',
    sourceDoc: ':help :help',
    params: [
      {
        name: 'topic',
        type: 'string',
        label: 'Help Topic',
        placeholder: 'topic or command',
        description: 'Help topic to look up',
        required: true,
      },
    ],
    aliases: ['help', 'documentation'],
  },
  {
    key: 'help-search',
    type: 'command',
    category: 'help',
    label: 'Search Help',
    shortDescription: 'Search help documentation',
    whatItDoes: 'Searches all help files for the given pattern.',
    template: ':helpgrep {pattern}',
    example: ':helpgrep visual',
    sourceDoc: ':help :helpgrep',
    params: [
      {
        name: 'pattern',
        type: 'string',
        label: 'Search Pattern',
        placeholder: 'pattern to find',
        description: 'Pattern to search for in help',
        required: true,
      },
    ],
    aliases: ['helpgrep', 'search help'],
  },
  {
    key: 'help-close',
    type: 'command',
    category: 'help',
    label: 'Close Help Window',
    shortDescription: 'Close the help window',
    whatItDoes: 'Closes the help/documentation window.',
    template: ':helpclose',
    example: ':helpclose',
    sourceDoc: ':help :helpclose',
    aliases: ['close help', 'quit help'],
  },

  // ============================================
  // LSP NAVIGATION (Navigation with centered cursor)
  // ============================================
  {
    key: 'scroll-down-centered',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Down (Centered)',
    shortDescription: 'Scroll down half page and center cursor',
    whatItDoes:
      'Scrolls down half a page and keeps the cursor centered in the window.',
    technicalNote:
      'zz centers the cursor line. Useful for maintaining context while scrolling.',
    template: '<C-d>zz',
    example: '<C-d>zz',
    sourceDoc: ':help CTRL-D',
    isPopular: true,
    aliases: ['scroll down center', 'half page down center'],
  },
  {
    key: 'scroll-up-centered',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Up (Centered)',
    shortDescription: 'Scroll up half page and center cursor',
    whatItDoes:
      'Scrolls up half a page and keeps the cursor centered in the window.',
    technicalNote:
      'zz centers the cursor line. Useful for maintaining context while scrolling.',
    template: '<C-u>zz',
    example: '<C-u>zz',
    sourceDoc: ':help CTRL-U',
    isPopular: true,
    aliases: ['scroll up center', 'half page up center'],
  },
  {
    key: 'search-next-centered',
    type: 'keys',
    category: 'navigation',
    label: 'Next Search Result (Centered)',
    shortDescription: 'Go to next match and center',
    whatItDoes: 'Jumps to the next search match and centers it in the window.',
    technicalNote:
      'n repeats the search, zz centers, and zv opens any folds. Keeps search results visible.',
    template: 'nzzzv',
    example: 'nzzzv',
    sourceDoc: ':help n',
    isPopular: true,
    aliases: ['next search center', 'find next center'],
  },
  {
    key: 'search-prev-centered',
    type: 'keys',
    category: 'navigation',
    label: 'Previous Search Result (Centered)',
    shortDescription: 'Go to previous match and center',
    whatItDoes:
      'Jumps to the previous search match and centers it in the window.',
    technicalNote:
      'N repeats search backward, zz centers, and zv opens any folds.',
    template: 'Nzzzv',
    example: 'Nzzzv',
    sourceDoc: ':help N',
    aliases: ['prev search center', 'find prev center'],
  },
  {
    key: 'scroll-down-line',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Down One Line',
    shortDescription: 'Scroll the viewport down by one line',
    whatItDoes:
      'Scrolls the window content down by one line without moving the cursor. Great for peeking at what is below without losing your place.',
    template: '<C-e>',
    example: '<C-e>',
    sourceDoc: ':help CTRL-E',
    aliases: ['scroll down viewport'],
  },
  {
    key: 'scroll-up-line',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Up One Line',
    shortDescription: 'Scroll the viewport up by one line',
    whatItDoes:
      'Scrolls the window content up by one line without moving the cursor. The opposite of Ctrl-E.',
    template: '<C-y>',
    example: '<C-y>',
    sourceDoc: ':help CTRL-Y',
    aliases: ['scroll up viewport'],
  },
  {
    key: 'scroll-down-with-cursor',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Down + Move Cursor',
    shortDescription: 'Scroll viewport down and move cursor down',
    whatItDoes:
      'Scrolls the viewport down one line while also moving the cursor down one line. Keeps your relative position on screen.',
    technicalNote:
      '<C-e> scrolls the viewport down, j moves the cursor down. Together they keep the cursor at the same visual row.',
    template: '<C-e>j',
    example: '<C-e>j',
    sourceDoc: ':help CTRL-E',
    aliases: ['scroll and move down'],
  },
  {
    key: 'scroll-up-with-cursor',
    type: 'keys',
    category: 'navigation',
    label: 'Scroll Up + Move Cursor',
    shortDescription: 'Scroll viewport up and move cursor up',
    whatItDoes:
      'Scrolls the viewport up one line while also moving the cursor up one line. Keeps your relative position on screen.',
    technicalNote:
      '<C-y> scrolls the viewport up, k moves the cursor up. Together they keep the cursor at the same visual row.',
    template: '<C-y>k',
    example: '<C-y>k',
    sourceDoc: ':help CTRL-Y',
    aliases: ['scroll and move up'],
  },
  {
    key: 'center-cursor',
    type: 'keys',
    category: 'navigation',
    label: 'Center Cursor on Screen',
    shortDescription: 'Scroll so the cursor line is in the middle',
    whatItDoes:
      'Redraws the screen so that the line your cursor is on appears in the center of the window. Useful after a long jump to get your bearings.',
    template: 'zz',
    example: 'zz',
    sourceDoc: ':help zz',
    aliases: ['center screen', 'center view'],
  },

  // ============================================
  // VISUAL EDITING
  // ============================================
  {
    key: 'move-line-down-visual',
    type: 'keys',
    category: 'editing',
    label: 'Move Selection Down',
    shortDescription: 'Move selected lines down',
    whatItDoes:
      'Moves the selected lines down one line while preserving the selection.',
    technicalNote:
      ':m moves lines, gv reselects, and = reindents. Works in visual mode.',
    template: ":m '>+1<CR>gv=gv",
    example: ":m '>+1<CR>gv=gv",
    sourceDoc: ':help :move',
    isPopular: true,
    aliases: ['move lines down', 'shift selection down'],
  },
  {
    key: 'move-line-up-visual',
    type: 'keys',
    category: 'editing',
    label: 'Move Selection Up',
    shortDescription: 'Move selected lines up',
    whatItDoes:
      'Moves the selected lines up one line while preserving the selection.',
    technicalNote:
      ':m moves lines, gv reselects, and = reindents. Works in visual mode.',
    template: ":m '<-2<CR>gv=gv",
    example: ":m '<-2<CR>gv=gv",
    sourceDoc: ':help :move',
    isPopular: true,
    aliases: ['move lines up', 'shift selection up'],
  },

  // ============================================
  // DIAGNOSTICS (LSP)
  // ============================================
  {
    key: 'diagnostic-open-float',
    type: 'command',
    category: 'diagnostics',
    label: 'Show Diagnostic at Cursor',
    shortDescription: 'Show diagnostic message in floating window',
    whatItDoes:
      'Opens a floating window showing the diagnostic (error/warning) at the cursor position.',
    technicalNote:
      'Requires an LSP server to be attached. Shows the most severe diagnostic if multiple exist.',
    template: ':lua vim.diagnostic.open_float()',
    example: ':lua vim.diagnostic.open_float()',
    sourceDoc: ':help vim.diagnostic.open_float()',
    isPopular: true,
    aliases: ['show error', 'show warning', 'diagnostic float'],
  },

  // ============================================
  // FILE PATH & CLIPBOARD (3 new actions)
  // ============================================
  {
    key: 'copy-file-path-with-line',
    type: 'command',
    category: 'file',
    label: 'Copy File Path with Line Number',
    shortDescription: 'Copy relative file path and line number to clipboard',
    whatItDoes:
      'Copies the relative file path with the current line number (e.g. "src/app.ts:42") to your system clipboard. Perfect for sharing code references or navigating error logs.',
    technicalNote:
      "expand('%:.') gives the path relative to cwd, line('.') gives the current line number, setreg('+', ...) writes to the system clipboard.",
    template: ":call setreg('+', expand('%:.') .. ':' .. line('.'))",
    example: ":call setreg('+', expand('%:.') .. ':' .. line('.'))",
    sourceDoc: ':help setreg()',
    isPopular: true,
    aliases: [
      'copy location',
      'copy path line',
      'file line clipboard',
      'yank location',
    ],
  },
  {
    key: 'copy-relative-file-path',
    type: 'command',
    category: 'file',
    label: 'Copy Relative File Path',
    shortDescription: 'Copy the relative file path to clipboard',
    whatItDoes:
      "Copies the current file's path (relative to the working directory) to your system clipboard, so you can paste it in a terminal or other application.",
    technicalNote:
      "expand('%') gives the file path as Neovim sees it (typically relative to cwd). setreg('+', ...) writes to the system clipboard register.",
    template: ":call setreg('+', expand('%'))",
    example: ":call setreg('+', expand('%'))",
    sourceDoc: ':help expand()',
    aliases: ['copy path', 'relative path', 'yank path relative'],
  },
  {
    key: 'open-file-from-clipboard',
    type: 'command',
    category: 'file',
    label: 'Open File from Clipboard',
    shortDescription: 'Open the file whose path is in the clipboard',
    whatItDoes:
      'Opens a file using the path currently stored in your system clipboard. Useful after copying a file path from a terminal, error log, or another editor.',
    technicalNote:
      '<C-r>+ inserts the system clipboard contents into the command line. The path is then passed to :edit.',
    template: ':e <C-r>+',
    example: ':e <C-r>+',
    sourceDoc: ':help c_CTRL-R',
    aliases: ['open clipboard', 'go to clipboard', 'paste path open'],
  },

  // ============================================
  // LSP / NAVIGATION EXTRAS (2 new actions)
  // ============================================
  {
    key: 'goto-definition-new-tab',
    type: 'command',
    category: 'navigation',
    label: 'Go to Definition in New Tab',
    shortDescription: 'Open LSP definition in a new tab',
    whatItDoes:
      'Opens the definition of the symbol under the cursor in a brand-new tab, so you can view it side-by-side with the original file.',
    technicalNote:
      ':tab split duplicates the current window into a new tab, then vim.lsp.buf.definition() navigates to the definition within that tab.',
    template: ':tab split | lua vim.lsp.buf.definition()',
    example: ':tab split | lua vim.lsp.buf.definition()',
    sourceDoc: ':help :tab',
    aliases: [
      'definition new tab',
      'goto definition tab',
      'lsp definition tab',
    ],
  },
  {
    key: 'disable-key',
    type: 'keys',
    category: 'editing',
    label: 'Disable Key',
    shortDescription: 'Map a key to do nothing',
    whatItDoes:
      'Disables a key by mapping it to a no-operation. Useful for preventing accidental presses of keys you never want to use.',
    technicalNote:
      '<Nop> is a special key code meaning "no operation". The mapping effectively swallows the key press.',
    template: '<Nop>',
    example: '<Nop>',
    sourceDoc: ':help <Nop>',
    aliases: ['nop', 'no operation', 'unbind', 'unmap'],
  },
]

// ============================================
// Helper Functions
// ============================================

export function getPopularActions(): readonly ActionCatalogEntry[] {
  return ACTION_CATALOG.filter((action) => action.isPopular)
}

export function getActionsByCategory(
  category: string,
): readonly ActionCatalogEntry[] {
  return ACTION_CATALOG.filter((action) => action.category === category)
}

export function findActionByKey(key: string): ActionCatalogEntry | undefined {
  return ACTION_CATALOG.find((action) => action.key === key)
}

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const action of ACTION_CATALOG) {
    counts[action.category] = (counts[action.category] ?? 0) + 1
  }
  return counts
}

/**
 * Search actions by query (matches label, description, aliases, template, example).
 */
export function searchActions(query: string): readonly ActionCatalogEntry[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (normalizedQuery.length === 0) {
    return ACTION_CATALOG
  }

  return ACTION_CATALOG.filter((action) => {
    // Search in label
    if (action.label.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    // Search in short description
    if (action.shortDescription.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    // Search in whatItDoes
    if (action.whatItDoes.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    // Search in aliases
    if (
      action.aliases?.some((alias) =>
        alias.toLowerCase().includes(normalizedQuery),
      )
    ) {
      return true
    }
    // Search in template
    if (action.template.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    // Search in example
    if (action.example.toLowerCase().includes(normalizedQuery)) {
      return true
    }
    return false
  })
}

// Re-export resolveActionTemplate for convenience
export { resolveActionTemplate } from './action-catalog'
