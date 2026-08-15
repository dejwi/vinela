// Tests for LuaBuilder

import { describe, expect, it } from 'vitest'
import { LuaBuilder, LuaBuilderError } from '../lua-builder'

describe('LuaBuilder', () => {
  describe('basic line emission', () => {
    it('emits single lines with default indentation', () => {
      const b = new LuaBuilder()
      b.line('vim.opt.number = true')
      expect(b.build()).toBe('vim.opt.number = true\n')
    })

    it('emits multiple lines', () => {
      const b = new LuaBuilder()
      b.line('local x = 1')
      b.line('local y = 2')
      expect(b.build()).toBe('local x = 1\nlocal y = 2\n')
    })
  })

  describe('indent/dedent', () => {
    it('nesting works for 3+ levels', () => {
      const b = new LuaBuilder()
      b.line('start')
      b.indent().indent().indent()
      b.line('deep')
      b.dedent().dedent().dedent()
      b.line('end')
      expect(b.build()).toBe('start\n      deep\nend\n')
    })

    it('throws on dedent below zero', () => {
      const b = new LuaBuilder()
      expect(() => b.dedent()).toThrow(LuaBuilderError)
      expect(() => b.dedent()).toThrow(
        'Cannot dedent: indent level is already 0',
      )
    })

    it('dedent returns builder for chaining', () => {
      const b = new LuaBuilder()
      b.indent()
      expect(b.dedent()).toBe(b)
    })

    it('indent returns builder for chaining', () => {
      const b = new LuaBuilder()
      expect(b.indent()).toBe(b)
    })
  })

  describe('block()', () => {
    it('emits start/body/end and balances indentation', () => {
      const b = new LuaBuilder()
      b.block(
        'do',
        (inner) => {
          inner.line('print("hello")')
        },
        'end',
      )

      expect(b.build()).toBe('do\n  print("hello")\nend\n')
    })

    it('dedents correctly even if callback throws', () => {
      const b = new LuaBuilder()
      b.line('before')

      expect(() => {
        b.block(
          'do',
          (inner) => {
            inner.line('inside')
            throw new Error('test error')
          },
          'end',
        )
      }).toThrow('test error')

      // Should be back at level 0, can build
      expect(b.build()).toBe('before\ndo\n  inside\nend\n')
    })

    it('supports nested blocks', () => {
      const b = new LuaBuilder()
      b.block(
        'if condition then',
        (outer) => {
          outer.block(
            'if nested then',
            (inner) => {
              inner.line('print("deep")')
            },
            'end',
          )
        },
        'end',
      )

      expect(b.build()).toBe(
        'if condition then\n  if nested then\n    print("deep")\n  end\nend\n',
      )
    })

    it('returns builder for chaining', () => {
      const b = new LuaBuilder()
      const result = b.block('do', () => {}, 'end')
      expect(result).toBe(b)
    })
  })

  describe('line() with multi-line input', () => {
    it('preserves relative indentation', () => {
      const b = new LuaBuilder({ strictIndentBalance: false })
      b.indent()
      b.line('first\n  second\n    third')
      expect(b.build()).toBe('  first\n    second\n      third\n')
    })

    it('handles blank lines in multi-line input', () => {
      const b = new LuaBuilder({ strictIndentBalance: false })
      b.indent()
      b.line('before\n\nafter')
      expect(b.build()).toBe('  before\n\n  after\n')
    })

    it('handles windows line endings', () => {
      const b = new LuaBuilder()
      b.line('line1\r\nline2')
      expect(b.build()).toBe('line1\nline2\n')
    })
  })

  describe('lines() variadic', () => {
    it('adds multiple lines', () => {
      const b = new LuaBuilder()
      b.lines('a', 'b', 'c')
      expect(b.build()).toBe('a\nb\nc\n')
    })

    it('returns builder for chaining', () => {
      const b = new LuaBuilder()
      expect(b.lines('a')).toBe(b)
    })
  })

  describe('comment()', () => {
    it('single-line comment', () => {
      const b = new LuaBuilder()
      b.comment('This is a comment')
      expect(b.build()).toBe('-- This is a comment\n')
    })

    it('multi-line comment', () => {
      const b = new LuaBuilder()
      b.comment('line1\nline2')
      expect(b.build()).toBe('-- line1\n-- line2\n')
    })

    it('empty comment', () => {
      const b = new LuaBuilder()
      b.comment('')
      expect(b.build()).toBe('--\n')
    })

    it('comment with blank lines', () => {
      const b = new LuaBuilder()
      b.comment('before\n\nafter')
      expect(b.build()).toBe('-- before\n--\n-- after\n')
    })

    it('comment respects indentation', () => {
      const b = new LuaBuilder({ strictIndentBalance: false })
      b.indent()
      b.comment('indented')
      expect(b.build()).toBe('  -- indented\n')
    })

    it('returns builder for chaining', () => {
      const b = new LuaBuilder()
      expect(b.comment('test')).toBe(b)
    })
  })

  describe('blank()', () => {
    it('emits exactly one empty line', () => {
      const b = new LuaBuilder()
      b.line('before')
      b.blank()
      b.line('after')
      expect(b.build()).toBe('before\n\nafter\n')
    })

    it('returns builder for chaining', () => {
      const b = new LuaBuilder()
      expect(b.blank()).toBe(b)
    })
  })

  describe('build()', () => {
    it('enforces strict indent balance by default', () => {
      const b = new LuaBuilder()
      b.indent()
      b.line('inside')

      expect(() => b.build()).toThrow(LuaBuilderError)
      expect(() => b.build()).toThrow('UNCLOSED_BLOCK:')
    })

    it('allows unclosed blocks when strictIndentBalance is false', () => {
      const b = new LuaBuilder({ strictIndentBalance: false })
      b.indent()
      b.line('inside')

      expect(b.build()).toBe('  inside\n')
    })

    it('ensures trailing newline by default', () => {
      const b = new LuaBuilder()
      b.line('test')
      expect(b.build()).toBe('test\n')
    })

    it('skips trailing newline when ensureTrailingNewline is false', () => {
      const b = new LuaBuilder({ ensureTrailingNewline: false })
      b.line('test')
      expect(b.build()).toBe('test')
    })

    it('uses custom newline character', () => {
      const b = new LuaBuilder({ newline: '\r\n' })
      b.line('test')
      expect(b.build()).toBe('test\r\n')
    })

    it('does not add extra newline when already present', () => {
      const b = new LuaBuilder()
      b.line('test')
      b.line('') // Empty line
      // Buffer is ['test', ''], joined with '\n' = 'test\n'
      // Already ends with newline, so no extra added
      expect(b.build()).toBe('test\n')
    })
  })

  describe('custom indent unit', () => {
    it('uses 4 spaces', () => {
      const b = new LuaBuilder({
        indentUnit: '    ',
        strictIndentBalance: false,
      })
      b.indent()
      b.line('indented')
      expect(b.build()).toBe('    indented\n')
    })

    it('uses tabs', () => {
      const b = new LuaBuilder({ indentUnit: '\t', strictIndentBalance: false })
      b.indent()
      b.line('indented')
      expect(b.build()).toBe('\tindented\n')
    })
  })

  describe('complex scenarios', () => {
    it('can build a complete if statement', () => {
      const b = new LuaBuilder()
      b.comment('Check if ready')
      b.block(
        'if vim.g.ready then',
        (ifBody) => {
          ifBody.line('print("Ready!")')
          ifBody.block(
            'if vim.g.verbose then',
            (verboseBody) => {
              verboseBody.line('print("Details...")')
            },
            'end',
          )
        },
        'end',
      )

      const expected = `\
-- Check if ready
if vim.g.ready then
  print("Ready!")
  if vim.g.verbose then
    print("Details...")
  end
end
`
      expect(b.build()).toBe(expected)
    })

    it('caches indent prefixes', () => {
      // Just verify it works - caching is internal implementation detail
      const b = new LuaBuilder({ strictIndentBalance: false })
      for (let i = 0; i < 10; i++) {
        b.indent()
        b.line(`level ${i}`)
      }
      const result = b.build()
      expect(result).toContain('level 0')
      expect(result).toContain('        level 9') // 20 spaces
    })
  })
})
