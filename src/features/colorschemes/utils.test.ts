import { describe, expect, it } from 'vitest'
import { getThemePluginSchemaId } from '@/shared/types/colorscheme'

import { getThemeDisplayName, isThemeSchemaId } from './utils'

describe('colorscheme utils', () => {
  describe('getThemeDisplayName', () => {
    it('strips theme prefix and .nvim suffix for prefixed IDs', () => {
      expect(getThemeDisplayName('theme--tokyonight.nvim')).toBe('tokyonight')
    })

    it('does not truncate builtin IDs without theme prefix', () => {
      expect(getThemeDisplayName('tokyonight')).toBe('tokyonight')
    })

    it('formats builtin IDs with dashes as spaces', () => {
      expect(getThemeDisplayName('rose-pine')).toBe('rose pine')
      expect(getThemeDisplayName('vscode-nvim')).toBe('vscode nvim')
    })

    it('returns non-theme IDs unchanged', () => {
      expect(getThemeDisplayName('plugin--not-theme')).toBe('plugin--not-theme')
    })
  })

  describe('isThemeSchemaId', () => {
    it('recognizes builtin theme schema IDs', () => {
      expect(isThemeSchemaId('tokyonight')).toBe(true)
    })
  })

  describe('getThemePluginSchemaId', () => {
    it('normalizes equivalent GitHub refs for builtin themes', () => {
      expect(
        getThemePluginSchemaId('https://github.com/Folke/tokyonight.nvim/'),
      ).toBe('tokyonight')
      expect(
        getThemePluginSchemaId('github.com/folke/tokyonight.nvim.git'),
      ).toBe('tokyonight')
    })
  })
})
