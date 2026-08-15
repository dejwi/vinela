/**
 * Self-tests (mutation probes) for the strong assertion helpers in lua-assertions.ts.
 *
 * Each test verifies that the helper correctly *fails* when given wrong input,
 * and correctly *passes* when given valid input. This prevents the helpers
 * themselves from having silent false-pass bugs.
 */

import { describe, expect, it } from 'vitest'
import {
  expectFullAutocmdCall,
  expectFullKeymapCall,
  expectNoOccurrence,
} from './lua-assertions'

describe('helper self-tests', () => {
  it('expectFullKeymapCall rejects wrong rhs on same line', () => {
    const lua = `vim.keymap.set("n", "<leader>f", ":wrongcmd<cr>", { remap = false })`
    expect(() =>
      expectFullKeymapCall(lua, {
        modes: 'n',
        lhs: '<leader>f',
        rhs: ':vsplit<cr>',
      }),
    ).toThrow()
  })

  it('expectNoOccurrence passes when snippet is only in comment', () => {
    const lua = `-- vim.opt_local.number\nvim.opt.number = true`
    // Should NOT throw — the snippet only appears in a comment
    expectNoOccurrence(lua, 'vim.opt_local.number')
  })

  it('expectFullAutocmdCall scopes once check to call line', () => {
    // once = true on an unrelated line, not the autocmd call line
    const lua = `local x = { once = true }\nvim.api.nvim_create_autocmd("BufEnter", { pattern = "*", callback = function() end })`
    // Should NOT throw — once = true is NOT on the autocmd call line
    expectFullAutocmdCall(lua, { events: ['BufEnter'], once: false })
  })
})
