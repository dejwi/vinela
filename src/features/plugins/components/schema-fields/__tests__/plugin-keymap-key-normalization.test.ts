import { describe, expect, it } from 'vitest'
import { normalizeKeymapKey } from '../plugin-keymap-key-normalization'

describe('normalizeKeymapKey', () => {
  // ---------------------------------------------------------------------------
  // Basic trimming
  // ---------------------------------------------------------------------------

  it('trims outer whitespace', () => {
    // <CR> is in the alias map → always lowercased to cr
    expect(normalizeKeymapKey('  <CR>  ')).toBe('<cr>')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeKeymapKey('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeKeymapKey('   ')).toBe('')
  })

  // ---------------------------------------------------------------------------
  // Angle-bracket token normalization
  // ---------------------------------------------------------------------------

  it('normalizes token body inside angle brackets', () => {
    // Aliased keys are lowercased (Enter/Return → cr)
    expect(normalizeKeymapKey('<CR>')).toBe('<cr>')
    // Non-aliased special keys preserve original casing; only modifier letters are lowercased
    expect(normalizeKeymapKey('<C-Space>')).toBe('<c-Space>')
    expect(normalizeKeymapKey('<Tab>')).toBe('<Tab>')
    expect(normalizeKeymapKey('<Esc>')).toBe('<Esc>')
  })

  it('strips internal spaces inside angle brackets', () => {
    // rawTerminal after space-stripping is lowercase 'space' in all three cases
    expect(normalizeKeymapKey('< c-space >')).toBe('<c-space>')
    expect(normalizeKeymapKey('<C- Space>')).toBe('<c-Space>')
    expect(normalizeKeymapKey('< C - Space >')).toBe('<c-Space>')
  })

  it('normalizes equivalent forms to the same key (case-insensitive modifier, same terminal casing)', () => {
    // All forms have a lowercase terminal 'space' → all collapse to <c-space>
    const forms = ['<c-space>', '< c-space >']
    const normalized = forms.map(normalizeKeymapKey)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('<c-space>')
    // <C-SPACE> has rawTerminal 'SPACE' → <c-SPACE> (different from <c-space>)
    expect(normalizeKeymapKey('<C-SPACE>')).toBe('<c-SPACE>')
  })

  it('terminal casing is preserved when rawTerminal differs', () => {
    // <C-Space> has rawTerminal 'Space' (capital S) → <c-Space>
    expect(normalizeKeymapKey('<C-Space>')).toBe('<c-Space>')
    // <c-space> has rawTerminal 'space' (all lower) → <c-space>
    expect(normalizeKeymapKey('<c-space>')).toBe('<c-space>')
  })

  it('handles multiple tokens in sequence', () => {
    // Single uppercase letters are the rawTerminal — casing preserved
    expect(normalizeKeymapKey('<C-W><C-J>')).toBe('<c-W><c-J>')
  })

  // ---------------------------------------------------------------------------
  // Plain key sequences (no angle brackets)
  // ---------------------------------------------------------------------------

  it('collapses internal whitespace runs to single spaces', () => {
    expect(normalizeKeymapKey('g  g')).toBe('g g')
    expect(normalizeKeymapKey('  g   g  ')).toBe('g g')
  })

  it('preserves plain lowercase keys unchanged', () => {
    expect(normalizeKeymapKey('j')).toBe('j')
    expect(normalizeKeymapKey('gg')).toBe('gg')
  })

  it('preserves plain uppercase keys unchanged (no angle brackets)', () => {
    // Plain uppercase letters are NOT lowercased — only token bodies inside <>
    expect(normalizeKeymapKey('G')).toBe('G')
    expect(normalizeKeymapKey('ZZ')).toBe('ZZ')
  })

  // ---------------------------------------------------------------------------
  // Duplicate detection equivalence
  // ---------------------------------------------------------------------------

  it('<CR> and <cr> collide after normalization (cr is in alias map → always lowercase)', () => {
    // <CR> → terminalLower 'cr' → alias map returns 'cr' → <cr>
    // <cr> → terminalLower 'cr' → alias map returns 'cr' → <cr>
    expect(normalizeKeymapKey('<CR>')).toBe(normalizeKeymapKey('<cr>'))
    expect(normalizeKeymapKey('<CR>')).toBe('<cr>')
  })

  it('different keys do not collide', () => {
    expect(normalizeKeymapKey('<CR>')).not.toBe(normalizeKeymapKey('<Tab>'))
    expect(normalizeKeymapKey('<C-j>')).not.toBe(normalizeKeymapKey('<C-k>'))
  })

  // ---------------------------------------------------------------------------
  // Mixed token + plain text
  // ---------------------------------------------------------------------------

  it('handles mixed angle-bracket and plain text', () => {
    // 'leader' is already lowercase → preserved as-is
    expect(normalizeKeymapKey('<leader>ff')).toBe('<leader>ff')
    // 'Leader' has original casing → preserved as 'Leader'
    expect(normalizeKeymapKey('<Leader>FF')).toBe('<Leader>FF')
  })
})

// ---------------------------------------------------------------------------
// Modifier alias canonicalization (Caveat 3)
// ---------------------------------------------------------------------------

describe('normalizeKeymapKey — modifier alias canonicalization', () => {
  it('<C-a>, <c-a>, <Ctrl-a>, <Control-a> normalize identically', () => {
    const forms = ['<C-a>', '<c-a>', '<Ctrl-a>', '<Control-a>']
    const normalized = forms.map(normalizeKeymapKey)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('<c-a>')
  })

  it('<Alt-x> and <A-x> normalize identically', () => {
    expect(normalizeKeymapKey('<Alt-x>')).toBe(normalizeKeymapKey('<A-x>'))
    expect(normalizeKeymapKey('<A-x>')).toBe('<a-x>')
  })

  it('<Meta-x> and <M-x> normalize identically', () => {
    expect(normalizeKeymapKey('<Meta-x>')).toBe(normalizeKeymapKey('<M-x>'))
    expect(normalizeKeymapKey('<M-x>')).toBe('<m-x>')
  })

  it('Alt and Meta remain distinct canonical modifiers', () => {
    expect(normalizeKeymapKey('<A-x>')).not.toBe(normalizeKeymapKey('<M-x>'))
  })

  it('<Shift-a> and <S-a> normalize identically', () => {
    expect(normalizeKeymapKey('<Shift-a>')).toBe(normalizeKeymapKey('<S-a>'))
    expect(normalizeKeymapKey('<S-a>')).toBe('<s-a>')
  })

  it('case-insensitive modifier matching: <CTRL-a> normalizes to <c-a>', () => {
    expect(normalizeKeymapKey('<CTRL-a>')).toBe('<c-a>')
    expect(normalizeKeymapKey('<CONTROL-a>')).toBe('<c-a>')
    expect(normalizeKeymapKey('<ALT-x>')).toBe('<a-x>')
    expect(normalizeKeymapKey('<META-x>')).toBe('<m-x>')
    expect(normalizeKeymapKey('<SHIFT-a>')).toBe('<s-a>')
  })
})

// ---------------------------------------------------------------------------
// Modifier order canonicalization (Caveat 3)
// ---------------------------------------------------------------------------

describe('normalizeKeymapKey — modifier order canonicalization', () => {
  it('<S-C-Tab> and <C-S-Tab> normalize identically', () => {
    expect(normalizeKeymapKey('<S-C-Tab>')).toBe(
      normalizeKeymapKey('<C-S-Tab>'),
    )
  })

  it('canonical order is C, M, A, S', () => {
    // <S-C-Tab> should normalize to <c-s-Tab> (C before S; Tab casing preserved)
    expect(normalizeKeymapKey('<S-C-Tab>')).toBe('<c-s-Tab>')
    expect(normalizeKeymapKey('<C-S-Tab>')).toBe('<c-s-Tab>')
  })

  it('<A-C-x> and <C-A-x> normalize identically', () => {
    expect(normalizeKeymapKey('<A-C-x>')).toBe(normalizeKeymapKey('<C-A-x>'))
    expect(normalizeKeymapKey('<C-A-x>')).toBe('<c-a-x>')
  })

  it('deduplicates repeated modifiers', () => {
    // <C-C-a> should deduplicate to <c-a>
    expect(normalizeKeymapKey('<C-C-a>')).toBe('<c-a>')
  })

  it('three modifiers in non-canonical order normalize to canonical', () => {
    // <S-A-C-x> → canonical C, A, S order → <c-a-s-x>
    expect(normalizeKeymapKey('<S-A-C-x>')).toBe('<c-a-s-x>')
    expect(normalizeKeymapKey('<C-A-S-x>')).toBe('<c-a-s-x>')
  })
})

// ---------------------------------------------------------------------------
// Special key-name equivalence (Caveat 3)
// ---------------------------------------------------------------------------

describe('normalizeKeymapKey — special key-name equivalence', () => {
  it('<cr>, <CR>, <Enter> normalize identically', () => {
    const forms = ['<cr>', '<CR>', '<Enter>']
    const normalized = forms.map(normalizeKeymapKey)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('<cr>')
  })

  it('<Enter> collides with <CR> in duplicate detection', () => {
    expect(normalizeKeymapKey('<Enter>')).toBe(normalizeKeymapKey('<CR>'))
  })

  it('<C-Enter> and <C-CR> normalize identically', () => {
    expect(normalizeKeymapKey('<C-Enter>')).toBe(normalizeKeymapKey('<C-CR>'))
    expect(normalizeKeymapKey('<C-Enter>')).toBe('<c-cr>')
  })

  it('<Return> normalizes to <cr>', () => {
    expect(normalizeKeymapKey('<Return>')).toBe('<cr>')
  })

  it('case-insensitive special key: <enter> and <ENTER> normalize identically', () => {
    expect(normalizeKeymapKey('<enter>')).toBe(normalizeKeymapKey('<ENTER>'))
    expect(normalizeKeymapKey('<enter>')).toBe('<cr>')
  })
})

// ---------------------------------------------------------------------------
// Original casing preservation for non-aliased special keys
// ---------------------------------------------------------------------------

describe('normalizeKeymapKey — original casing preserved for non-aliased keys', () => {
  it('preserves casing of <Down>, <Up>, <Left>, <Right>', () => {
    expect(normalizeKeymapKey('<Down>')).toBe('<Down>')
    expect(normalizeKeymapKey('<Up>')).toBe('<Up>')
    expect(normalizeKeymapKey('<Left>')).toBe('<Left>')
    expect(normalizeKeymapKey('<Right>')).toBe('<Right>')
  })

  it('preserves casing of <Tab>', () => {
    expect(normalizeKeymapKey('<Tab>')).toBe('<Tab>')
  })

  it('preserves casing of <F1> through a representative sample', () => {
    expect(normalizeKeymapKey('<F1>')).toBe('<F1>')
    expect(normalizeKeymapKey('<F12>')).toBe('<F12>')
  })

  it('lowercased variants of non-aliased keys preserve their own casing', () => {
    // <down> has rawTerminal 'down' → stays <down>
    expect(normalizeKeymapKey('<down>')).toBe('<down>')
    expect(normalizeKeymapKey('<up>')).toBe('<up>')
    expect(normalizeKeymapKey('<tab>')).toBe('<tab>')
    expect(normalizeKeymapKey('<f1>')).toBe('<f1>')
  })

  it('modifier + non-aliased key preserves terminal casing', () => {
    expect(normalizeKeymapKey('<C-Down>')).toBe('<c-Down>')
    expect(normalizeKeymapKey('<C-Up>')).toBe('<c-Up>')
    expect(normalizeKeymapKey('<S-Tab>')).toBe('<s-Tab>')
    expect(normalizeKeymapKey('<C-F1>')).toBe('<c-F1>')
  })
})
