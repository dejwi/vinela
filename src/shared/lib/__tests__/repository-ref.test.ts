import { describe, expect, it } from 'vitest'
import { getRepoOwner, parseRepositoryRef } from '../repository-ref'

describe('parseRepositoryRef', () => {
  it.each([
    'https://github.com/folke/tokyonight.nvim',
    'http://github.com/folke/tokyonight.nvim',
    'github.com/folke/tokyonight.nvim',
    'folke/tokyonight.nvim',
    'folke/tokyonight.nvim.git',
    'https://github.com/folke/tokyonight.nvim/',
  ])('parses supported repository refs: %s', (repoRef) => {
    expect(parseRepositoryRef(repoRef)).toEqual({
      success: true,
      owner: 'folke',
      name: 'tokyonight.nvim',
      repoSlug: 'folke/tokyonight.nvim',
      repoUrl: 'https://github.com/folke/tokyonight.nvim',
    })
  })

  it('normalizes mixed-case repository refs', () => {
    expect(
      parseRepositoryRef('https://github.com/Folke/TokyoNight.nvim'),
    ).toEqual({
      success: true,
      owner: 'folke',
      name: 'tokyonight.nvim',
      repoSlug: 'folke/tokyonight.nvim',
      repoUrl: 'https://github.com/folke/tokyonight.nvim',
    })
  })

  it('rejects malformed refs', () => {
    const result = parseRepositoryRef(
      'https://gitlab.com/folke/tokyonight.nvim',
    )
    expect(result.success).toBe(false)
    expect(result).toMatchObject({
      success: false,
      error: 'Repository reference must be a GitHub owner/repo pair',
    })
  })

  it('rejects refs missing the repo name', () => {
    expect(parseRepositoryRef('github.com/folke')).toEqual({
      success: false,
      error: 'Repository reference must be a GitHub owner/repo pair',
    })
  })
})

describe('getRepoOwner', () => {
  it('returns the parsed owner when available', () => {
    expect(getRepoOwner('github.com/rose-pine/neovim')).toBe('rose-pine')
  })

  it('returns a stable fallback for malformed refs', () => {
    expect(getRepoOwner('not a repo ref')).toBe('notareporef')
  })

  it('returns Unknown when no usable fallback is available', () => {
    expect(getRepoOwner('')).toBe('Unknown')
  })
})
