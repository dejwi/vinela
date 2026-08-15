---
name: nvim-research
description: Research installed Neovim API documentation to find Lua API calls, events, options, and supported patterns
---

# Neovim Research Skill

This skill provides guidance for researching Neovim's Lua API and supported configuration patterns.

## Installed Neovim runtime docs

The docs correspond to the `nvim` executable on `PATH`. Primary files:
- `api.txt` - Core API functions
- `lua.txt` - Lua integration
- `options.txt` - Vim/Neovim options
- `autocmd.txt` - Autocommand system
- `map.txt` - Key mapping

Before researching, check that `nvim` is available:
```sh
command -v nvim
```
If it is unavailable, stop and report that `nvim` is unavailable on `PATH`.

Discover the documentation directory without loading user configuration:
```sh
NVIM_DOCS="$(nvim --clean --headless -c 'lua io.write(vim.env.VIMRUNTIME .. "/doc")' -c 'qa!')"
```
Verify `"$NVIM_DOCS/api.txt"` is readable. If it is not, stop and report that the installed runtime docs are unreadable. Do not fall back to repository or network content.

## Common Research Tasks

### Finding API Functions
Search the installed runtime docs for function signatures:
```
grep -R "vim.api.nvim_" "$NVIM_DOCS"
grep -R "vim.keymap" "$NVIM_DOCS"
```

### Finding Events
```
grep -R -E "BufEnter|BufLeave|FileType" "$NVIM_DOCS"
```

### Finding Options
```
grep -R "vim.opt\." "$NVIM_DOCS"
grep -E "^'[a-z]+'" "$NVIM_DOCS/options.txt"
```

## Key Neovim Lua APIs

### Keymaps
```lua
vim.keymap.set(mode, lhs, rhs, opts)
-- mode: "n", "i", "v", "x", "s", "o", "c", "t"
-- opts: { noremap, silent, buffer, desc }
```

### Autocommands
```lua
vim.api.nvim_create_autocmd(event, {
  pattern = "*.lua",
  callback = function(ev)
    -- ev.buf, ev.file, ev.match available
  end,
})
```

### Options
```lua
vim.opt.number = true
vim.opt.tabstop = 2
vim.o.background = "dark"
vim.bo.filetype = "lua"  -- buffer-local
vim.wo.number = true      -- window-local
```

### Commands
```lua
vim.api.nvim_create_user_command("Name", function(opts)
  -- opts.args, opts.fargs, opts.bang
end, { nargs = "*" })
```

## How to Use This Skill

1. Identify what Neovim concept you need
2. Search the appropriate docs
3. Cross-check findings against the installed official docs
