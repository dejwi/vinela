/**
 * LSP Section Generator
 *
 * Generates schema-capability-driven LSP installer and enable blocks
 * for configured LSP servers.
 */

import { getServerDefinition } from '@/shared/data/lsp-server-catalog'
import { APP_LOG_PREFIX } from '@/shared/lib/app-identity'
import type { PluginCapability } from '@/shared/types'
import type {
  LegacyGenerationDiagnostic,
  LspSectionInput,
  ResolvedPluginForGeneration,
  SectionResult,
} from '../types'

/**
 * Generate the LSP section.
 *
 * Emits capability-driven install and enable blocks when the corresponding
 * plugin schemas are installed and enabled.
 *
 * @param input - LSP configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generateLSPSection(input: LspSectionInput): SectionResult {
  const { enabledServers, resolvedPlugins } = input
  const diagnostics: LegacyGenerationDiagnostic[] = []
  const skippedReasons: string[] = []

  // If no servers enabled, return empty
  if (enabledServers.length === 0) {
    return {
      id: 'lsp',
      code: [],
      diagnostics: [],
    }
  }

  // Check capability gates
  const installerInfo = getPluginCapability(
    resolvedPlugins,
    'lsp-package-installer',
  )
  const enablerInfo = getPluginCapability(resolvedPlugins, 'lsp-server-enabler')

  // Sort servers alphabetically for deterministic output
  const sortedServers = [...enabledServers].sort((a, b) => a.localeCompare(b))

  const code: string[] = []

  // Emit Mason auto-install block (if gate passes)
  if (installerInfo.installed && installerInfo.enabled) {
    const masonCode = generateMasonBlock(sortedServers, diagnostics)
    if (masonCode.length > 0) {
      code.push(...masonCode)
    }
  } else {
    skippedReasons.push(
      'lsp-package-installer skipped: no enabled plugin declares installer capability',
    )
  }

  // Emit vim.lsp.enable() block (if gate passes)
  if (enablerInfo.installed && enablerInfo.enabled) {
    // Add blank line if Mason block was emitted
    if (code.length > 0) {
      code.push('')
    }
    code.push(
      ...generateLspEnableBlock(
        sortedServers,
        enablerInfo.capability.minNvimVersion,
        diagnostics,
      ),
    )
  } else {
    skippedReasons.push(
      'lsp-enable skipped: no enabled plugin declares lsp-server-enabler capability',
    )
  }

  const result: SectionResult = {
    id: 'lsp',
    code,
    diagnostics,
  }

  if (skippedReasons.length > 0) {
    result.skippedReasons = skippedReasons
  }

  return result
}

/**
 * Look up the first matching capability and plugin enable state.
 */
function getPluginCapability<K extends PluginCapability['kind']>(
  resolvedPlugins: ResolvedPluginForGeneration[],
  capabilityKind: K,
):
  | {
      readonly installed: false
      readonly enabled: false
    }
  | {
      readonly installed: true
      readonly enabled: boolean
      readonly capability: Extract<PluginCapability, { readonly kind: K }>
    } {
  let installedCapability:
    | Extract<PluginCapability, { readonly kind: K }>
    | undefined

  for (const resolvedPlugin of resolvedPlugins) {
    const capability = resolvedPlugin.schema.capabilities?.find(
      (entry): entry is Extract<PluginCapability, { readonly kind: K }> =>
        entry.kind === capabilityKind,
    )

    if (capability === undefined) {
      continue
    }

    if (resolvedPlugin.plugin.enabled) {
      return {
        installed: true,
        enabled: true,
        capability,
      }
    }

    installedCapability = capability
  }

  if (installedCapability !== undefined) {
    return {
      installed: true,
      enabled: false,
      capability: installedCapability,
    }
  }

  return { installed: false, enabled: false }
}

/**
 * Generate the Mason auto-install block.
 */
function generateMasonBlock(
  serverNames: string[],
  diagnostics: LegacyGenerationDiagnostic[],
): string[] {
  const masonPackages: string[] = []

  for (const serverName of serverNames) {
    const serverDef = getServerDefinition(serverName)

    if (!serverDef) {
      diagnostics.push({
        severity: 'warning',
        message: `LSP server '${serverName}' not found in catalog — emitting as-is for vim.lsp.enable()`,
        context: serverName,
      })
      continue
    }

    if (serverDef.masonPackage === null) {
      diagnostics.push({
        severity: 'info',
        message: `LSP server '${serverName}' has no Mason package — must be installed manually`,
        context: serverName,
      })
      continue
    }

    masonPackages.push(serverDef.masonPackage)
  }

  if (masonPackages.length === 0) {
    return []
  }

  const code: string[] = []

  code.push('-- LSP server auto-install (Mason)')
  code.push('local mr = require("mason-registry")')
  code.push('mr.refresh(function()')
  code.push('  for _, tool in ipairs({')

  for (const pkg of masonPackages) {
    code.push(`    "${escapeForLuaString(pkg)}",`)
  }

  code.push('  }) do')
  code.push('    local ok, p = pcall(mr.get_package, tool)')
  code.push('    if ok and not p:is_installed() then')
  code.push('      p:install()')
  code.push('    end')
  code.push('  end')
  code.push('end)')

  return code
}

/**
 * Generate the vim.lsp.enable() block.
 */
function generateLspEnableBlock(
  serverNames: string[],
  minNvimVersion: string,
  _diagnostics: LegacyGenerationDiagnostic[],
): string[] {
  const code: string[] = []

  code.push('-- LSP servers')
  code.push(
    `if vim.fn.has("nvim-${escapeForLuaString(minNvimVersion)}") == 1 then`,
  )
  code.push('  vim.lsp.enable({')

  for (const serverName of serverNames) {
    code.push(`    "${escapeForLuaString(serverName)}",`)
  }

  code.push('  })')
  code.push('else')
  code.push(
    `  vim.notify("${APP_LOG_PREFIX} LSP enable requires Neovim ${escapeForLuaString(minNvimVersion)}+", vim.log.levels.WARN)`,
  )
  code.push('end')

  return code
}

/**
 * Escape a string for use in Lua double-quoted string.
 */
function escapeForLuaString(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Backslash first
    .replace(/"/g, '\\"') // Double quotes
    .replace(/\n/g, '\\n') // Newlines
    .replace(/\r/g, '\\r') // Carriage returns
}
