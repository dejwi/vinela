/**
 * Lua Negative Validity Tests (B1-B4)
 *
 * Dedicated negative tests for Lua validation utilities.
 * Verifies that `assertLuaSyntaxValid`, `assertBlocksBalanced`, and
 * `checkLuaBlockBalance` actually catch errors — not just pass valid code.
 *
 * B1, B4 — require a Neovim-compatible Lua syntax checker (`nvim`, `luajit`, `luac5.1`, `lua5.1`, or compatible bare `luac`) so generated Neovim config syntax is validated against the target LuaJIT/Lua 5.1 dialect.
 * B2, B3 — pure TypeScript, no I/O, run everywhere.
 */

import { describe, expect, it } from 'vitest'
import { checkLuaBlockBalance } from '../orchestrator/lua-block-balance'
import { assertBlocksBalanced, assertLuaSyntaxValid } from './utils/lua-assert'

// ─────────────────────────────────────────────────────────────────────────────
// B1: assertLuaSyntaxValid rejects intentionally broken Lua
// ─────────────────────────────────────────────────────────────────────────────

describe('B1: assertLuaSyntaxValid — rejects broken Lua', () => {
  it('throws for missing closing parenthesis', async () => {
    await expect(assertLuaSyntaxValid('print("hello"')).rejects.toThrow(
      'Lua syntax validation failed',
    )
  })

  it('throws for unterminated string literal', async () => {
    await expect(
      assertLuaSyntaxValid('local x = "unterminated'),
    ).rejects.toThrow()
  })

  it('throws for `end` used as variable name (reserved keyword)', async () => {
    await expect(assertLuaSyntaxValid('local end = 5')).rejects.toThrow()
  })

  it('throws for completely garbage input', async () => {
    await expect(assertLuaSyntaxValid('}{][)(@@##')).rejects.toThrow()
  })

  it('throws for a function with a missing closing paren in its parameter list', async () => {
    await expect(assertLuaSyntaxValid('function foo(\nend')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B2: assertBlocksBalanced rejects unbalanced blocks
// ─────────────────────────────────────────────────────────────────────────────

describe('B2: assertBlocksBalanced — rejects unbalanced blocks', () => {
  // Negative cases — must throw
  it('throws for extra end after function', () => {
    expect(() => assertBlocksBalanced('function foo()\nend\nend')).toThrow(
      'unbalanced',
    )
  })

  it('throws for missing end in function body', () => {
    expect(() => assertBlocksBalanced('function foo()\n  print("hi")')).toThrow(
      'unbalanced',
    )
  })

  it('throws for orphan until (no matching repeat)', () => {
    expect(() => assertBlocksBalanced('until true')).toThrow('unbalanced')
  })

  it('throws for extra end after if block', () => {
    expect(() =>
      assertBlocksBalanced('if true then\n  print("a")\nend\nend'),
    ).toThrow('unbalanced')
  })

  it('throws for missing end in nested if inside function', () => {
    expect(() =>
      assertBlocksBalanced(
        'function foo()\n  if true then\n    print("a")\nend',
      ),
    ).toThrow('unbalanced')
  })

  // Positive cases — must NOT throw
  it('does not throw for correctly balanced function + if', () => {
    expect(() =>
      assertBlocksBalanced(
        'function foo()\n  if true then\n    print("a")\n  end\nend',
      ),
    ).not.toThrow()
  })

  it('does not throw for repeat...until', () => {
    expect(() =>
      assertBlocksBalanced('repeat\n  x = x + 1\nuntil x > 10'),
    ).not.toThrow()
  })

  it('does not throw for for...do...end', () => {
    expect(() =>
      assertBlocksBalanced('for i = 1, 10 do\n  print(i)\nend'),
    ).not.toThrow()
  })

  it('does not throw for while...do...end', () => {
    expect(() =>
      assertBlocksBalanced('while true do\n  break\nend'),
    ).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B3: checkLuaBlockBalance returns correct opener/closer counts
// ─────────────────────────────────────────────────────────────────────────────

describe('B3: checkLuaBlockBalance — correct opener/closer counts', () => {
  it('single function: 1 opener, 1 closer', () => {
    expect(checkLuaBlockBalance('function foo()\nend')).toEqual({
      balanced: true,
      openers: 1,
      closers: 1,
    })
  })

  it('function + if: 2 openers, 2 closers', () => {
    expect(
      checkLuaBlockBalance('function foo()\n  if true then\n  end\nend'),
    ).toEqual({ balanced: true, openers: 2, closers: 2 })
  })

  it('extra end: 1 opener, 2 closers (unbalanced)', () => {
    expect(checkLuaBlockBalance('function foo()\nend\nend')).toEqual({
      balanced: false,
      openers: 1,
      closers: 2,
    })
  })

  it('missing end: 2 openers, 1 closer (unbalanced)', () => {
    expect(
      checkLuaBlockBalance('function foo()\n  if true then\n  end'),
    ).toEqual({ balanced: false, openers: 2, closers: 1 })
  })

  it('for...do counts as 1 opener (not 2)', () => {
    expect(checkLuaBlockBalance('for i = 1, 10 do\nend')).toEqual({
      balanced: true,
      openers: 1,
      closers: 1,
    })
  })

  it('standalone do...end: 1 opener, 1 closer', () => {
    expect(checkLuaBlockBalance('do\nend')).toEqual({
      balanced: true,
      openers: 1,
      closers: 1,
    })
  })

  it('keywords inside string literals are ignored', () => {
    expect(checkLuaBlockBalance('local x = "function end if"')).toEqual({
      balanced: true,
      openers: 0,
      closers: 0,
    })
  })

  it('keywords inside line comments are ignored', () => {
    expect(checkLuaBlockBalance('-- function end if\nlocal x = 1')).toEqual({
      balanced: true,
      openers: 0,
      closers: 0,
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B4: assertLuaSyntaxValid includes line number in error message
// ─────────────────────────────────────────────────────────────────────────────

describe('B4: assertLuaSyntaxValid — includes line number in error message', () => {
  it('error message includes "line N" for Lua with an unclosed table on line 3', async () => {
    const brokenLua = [
      'local x = 1', // line 1
      'local y = 2', // line 2
      'local z = {', // line 3: opens table, never closed
      '  "a",', // line 4
      '', // line 5
    ].join('\n')

    try {
      await assertLuaSyntaxValid(brokenLua)
      expect.fail('Should have thrown a syntax error')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error)
      const msg = (err as Error).message
      expect(msg).toMatch(/line \d+/)
      expect(msg).toContain('Lua syntax validation failed')
    }
  })
})
