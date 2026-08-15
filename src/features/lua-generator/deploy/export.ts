// src/features/lua-generator/deploy/export.ts

import { APP_NAME } from '@/shared/lib/app-identity'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  scopedMkdir,
  scopedReadDir,
  scopedReadTextFile,
  scopedWriteTextFile,
} from '@/shared/lib/scoped-fs'
import { isMemoryMode } from '@/shared/lib/storage'
import type { ExportOptions, ExportResult } from '../types'
import { safePathExists } from './path-resolution'

/**
 * Export a standalone project directory with generated init.lua.
 *
 * Creates a self-contained directory that can be copied to
 * ~/.config/nvim/ on any machine.
 *
 * @param options - Export configuration
 * @param code - Generated Lua code string
 */
export async function exportProject(
  options: ExportOptions,
  code: string,
): Promise<ExportResult> {
  // ── Memory mode guard ──────────────────────────────────────────
  if (isMemoryMode()) {
    return {
      success: false,
      error: 'Export is not available in browser mode.',
      errorCode: 'memory-mode',
    }
  }

  const {
    projectPath,
    destinationPath,
    includeSourceGraphs = false,
    includeSchemas = true,
  } = options

  try {
    // ── Validate destination ───────────────────────────────────────
    const destExists = await safePathExists(destinationPath)
    if (destExists) {
      // Check if directory is empty
      const entries = await scopedReadDir(destinationPath)
      if (entries.length > 0) {
        return {
          success: false,
          error: `Destination directory is not empty: ${destinationPath}`,
          errorCode: 'destination-not-empty',
        }
      }
    }

    // ── Read mandatory source project marker ───────────────────────
    const projectJson = await scopedReadTextFile(
      `${projectPath}/${PROJECT_PATHS.PROJECT_JSON}`,
    )

    // ── Create destination structure ───────────────────────────────
    await scopedMkdir(destinationPath)

    const filesWritten: string[] = []

    // ── Write init.lua ─────────────────────────────────────────────
    await scopedWriteTextFile(`${destinationPath}/init.lua`, code)
    filesWritten.push('init.lua')

    // ── Copy project.json (mandatory) ──────────────────────────────
    await scopedWriteTextFile(
      `${destinationPath}/${PROJECT_PATHS.PROJECT_JSON}`,
      projectJson,
    )
    filesWritten.push(PROJECT_PATHS.PROJECT_JSON)

    // ── Copy schemas ───────────────────────────────────────────────
    if (includeSchemas) {
      await copyDirectoryContents(
        `${projectPath}/${PROJECT_PATHS.SCHEMAS}`,
        `${destinationPath}/${PROJECT_PATHS.SCHEMAS}`,
        filesWritten,
        PROJECT_PATHS.SCHEMAS,
      )
    }

    // ── Copy source graphs ─────────────────────────────────────────
    if (includeSourceGraphs) {
      await copyDirectoryContents(
        `${projectPath}/${PROJECT_PATHS.GRAPHS}`,
        `${destinationPath}/${PROJECT_PATHS.GRAPHS}`,
        filesWritten,
        PROJECT_PATHS.GRAPHS,
      )
    }

    // ── Generate README.md ─────────────────────────────────────────
    const readme = await generateReadme(projectJson)
    await scopedWriteTextFile(`${destinationPath}/README.md`, readme)
    filesWritten.push('README.md')

    return {
      success: true,
      exportedTo: destinationPath,
      filesWritten,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown export error'

    if (
      message.includes('permission') ||
      message.includes('EACCES') ||
      message.includes('EPERM')
    ) {
      return {
        success: false,
        error: `Permission denied: cannot write to ${destinationPath}`,
        errorCode: 'permission-denied',
      }
    }

    return {
      success: false,
      error: `Export failed: ${message}`,
      errorCode: 'write-failed',
    }
  }
}

// ── Internal Helpers ───────────────────────────────────────────────

/**
 * Copy all files from a source directory to a destination directory.
 * Silently skips if source directory doesn't exist.
 */
async function copyDirectoryContents(
  srcDir: string,
  destDir: string,
  filesWritten: string[],
  relativePrefix: string,
): Promise<void> {
  await scopedMkdir(destDir)

  const exists = await safePathExists(srcDir)
  if (!exists) return

  const entries = await scopedReadDir(srcDir)
  for (const entry of entries) {
    if (!entry.isFile) continue

    try {
      const content = await scopedReadTextFile(`${srcDir}/${entry.name}`)
      await scopedWriteTextFile(`${destDir}/${entry.name}`, content)
      filesWritten.push(`${relativePrefix}/${entry.name}`)
    } catch {
      console.warn(`Export: could not copy ${entry.name}`)
    }
  }
}

/**
 * Generate a README.md for the exported project.
 * Uses the already-read project.json for name/description.
 */
async function generateReadme(projectJsonStr: string): Promise<string> {
  let projectName = 'My Neovim Config'
  let projectDescription = ''

  try {
    const projectJson = JSON.parse(projectJsonStr) as {
      name?: string
      description?: string
    }
    if (projectJson.name) {
      projectName = projectJson.name
    }
    if (projectJson.description) {
      projectDescription = projectJson.description
    }
  } catch {
    // Use defaults
  }

  const timestamp = new Date().toISOString().split('T')[0] ?? 'unknown'

  const lines: string[] = [`# ${projectName}`, '']

  if (projectDescription) {
    lines.push(projectDescription, '')
  }

  lines.push(
    `Generated by [${APP_NAME}](https://github.com/${APP_NAME}/${APP_NAME}) on ${timestamp}.`,
    '',
    '## Requirements',
    '',
    '- Neovim >= 0.10',
    '- Git (for plugin installation via `vim.pack`)',
    '',
    '## Installation',
    '',
    '1. Back up your existing Neovim configuration:',
    '   ```sh',
    '   mv ~/.config/nvim ~/.config/nvim.bak',
    '   ```',
    '',
    '2. Copy `init.lua` to your Neovim config directory:',
    '   ```sh',
    '   mkdir -p ~/.config/nvim',
    '   cp init.lua ~/.config/nvim/init.lua',
    '   ```',
    '',
    '3. Start Neovim:',
    '   ```sh',
    '   nvim',
    '   ```',
    '',
    '4. Install plugins (if any are configured):',
    '   ```vim',
    '   :packupdate',
    '   ```',
    '',
    '## Re-importing',
    '',
    `To re-import this project into ${APP_NAME}, open this exported project folder (the folder containing \`project.json\`) as a project.`,
    '',
    '---',
    '',
    `*Generated on ${timestamp}*`,
    '',
  )

  return lines.join('\n')
}
