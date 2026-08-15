/**
 * useLspPrerequisites Hook
 *
 * Checks if Mason and nvim-lspconfig plugins are installed and enabled.
 * Used by the LSP page to show appropriate UI states.
 */

import { usePluginStore } from '@/features/plugins/store'

interface LspPrerequisitesResult {
  /** Is mason.nvim installed and enabled? */
  isMasonInstalled: boolean
  /** Is nvim-lspconfig installed and enabled? */
  isLspconfigInstalled: boolean
  /** Are all prerequisites met? */
  allPrerequisitesMet: boolean
}

export function useLspPrerequisites(): LspPrerequisitesResult {
  const installedPlugins = usePluginStore((s) => s.installedPlugins)

  const isMasonInstalled = installedPlugins.some(
    (p) => p.schemaId === 'mason-nvim' && p.enabled,
  )
  const isLspconfigInstalled = installedPlugins.some(
    (p) => p.schemaId === 'nvim-lspconfig' && p.enabled,
  )

  return {
    isMasonInstalled,
    isLspconfigInstalled,
    allPrerequisitesMet: isMasonInstalled && isLspconfigInstalled,
  }
}
