/**
 * Neovim Options Storage
 *
 * Functions for reading and writing project-level Neovim options.
 * File is optional - when absent, UI resolves to defaults from catalog.
 */

import { v4 as uuidv4 } from 'uuid'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  projectFileExists,
  readProjectTextFile,
  writeProjectTextFile,
} from '@/shared/lib/storage-api'
import type {
  HighlightOverride,
  HighlightOverrideSource,
  NeovimOptionStoredValue,
  ProjectNeovimOptionsFile,
} from '@/shared/types/neovim-options'

const CURRENT_VERSION = 1 as const

/**
 * Read the neovim-options.json file for a project.
 * Returns null if the file doesn't exist (caller should use defaults).
 */
export async function readNeovimOptions(
  projectPath: string,
): Promise<ProjectNeovimOptionsFile | null> {
  try {
    const exists = await projectFileExists(
      projectPath,
      PROJECT_PATHS.NEOVIM_OPTIONS,
    )
    if (!exists) {
      return null
    }

    const content = await readProjectTextFile(
      projectPath,
      PROJECT_PATHS.NEOVIM_OPTIONS,
    )
    const parsed: unknown = JSON.parse(content)

    // Validate basic structure
    if (!isValidOptionsFile(parsed)) {
      console.warn(
        '[neovim-options] Invalid options file structure, treating as empty',
      )
      return null
    }

    const parsedObject = parsed as unknown as Record<string, unknown>
    const normalizedHighlightOverrides = normalizeHighlightOverrides(
      parsedObject['highlightOverrides'],
    )

    const normalizedFile: ProjectNeovimOptionsFile = {
      version: parsed.version,
      options: parsed.options,
      updatedAt: parsed.updatedAt,
    }

    if (typeof parsedObject['leaderKey'] === 'string') {
      normalizedFile.leaderKey = parsedObject['leaderKey']
    }

    if (normalizedHighlightOverrides.length > 0) {
      normalizedFile.highlightOverrides = normalizedHighlightOverrides
    }

    return normalizedFile
  } catch (error) {
    console.error('[neovim-options] Failed to read options:', error)
    return null
  }
}

/**
 * Normalize and validate highlight overrides loaded from storage.
 */
export function normalizeHighlightOverrides(
  value: unknown,
): HighlightOverride[] {
  if (!Array.isArray(value)) {
    return []
  }

  const usedIds = new Set<string>()
  const normalized: HighlightOverride[] = []

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }

    let id = readString(entry, 'id', uuidv4())
    if (usedIds.has(id)) {
      id = uuidv4()
    }
    usedIds.add(id)

    const override: HighlightOverride = {
      id,
      groupName: readString(entry, 'groupName', 'Normal'),
      foreground: readString(entry, 'foreground', ''),
      background: readString(entry, 'background', ''),
      bold: readBoolean(entry, 'bold', false),
      italic: readBoolean(entry, 'italic', false),
      underline: readBoolean(entry, 'underline', false),
      strikethrough: readBoolean(entry, 'strikethrough', false),
      undercurl: readBoolean(entry, 'undercurl', false),
      link: readString(entry, 'link', ''),
      enabled: readBoolean(entry, 'enabled', true),
      source: normalizeHighlightOverrideSource(entry['source']),
    }

    normalized.push(override)
  }

  return normalized
}

/**
 * Write the neovim-options.json file for a project.
 */
export async function writeNeovimOptions(
  projectPath: string,
  options: Record<string, NeovimOptionStoredValue>,
  leaderKey?: string,
  highlightOverrides?: HighlightOverride[],
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Preserve existing values if not provided
    const existing = await readNeovimOptions(projectPath)
    const fileData: ProjectNeovimOptionsFile = {
      version: CURRENT_VERSION,
      options,
      updatedAt: Date.now(),
    }
    // Only include leaderKey if it has a value
    const finalLeaderKey = leaderKey ?? existing?.leaderKey
    if (finalLeaderKey !== undefined) {
      fileData.leaderKey = finalLeaderKey
    }
    // Only include highlightOverrides if provided or existing
    const finalHighlightOverrides =
      highlightOverrides ?? existing?.highlightOverrides
    if (
      finalHighlightOverrides !== undefined &&
      finalHighlightOverrides.length > 0
    ) {
      fileData.highlightOverrides = finalHighlightOverrides
    }

    await writeProjectTextFile(
      projectPath,
      PROJECT_PATHS.NEOVIM_OPTIONS,
      JSON.stringify(fileData, null, 2),
    )

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[neovim-options] Failed to write options:', error)
    return { success: false, error: message }
  }
}

/**
 * Read the leader key for a project.
 * Returns null if not set (caller should use default).
 */
export async function readLeaderKey(
  projectPath: string,
): Promise<string | null> {
  const fileData = await readNeovimOptions(projectPath)
  return fileData?.leaderKey ?? null
}

/**
 * Write just the leader key for a project.
 */
export async function writeLeaderKey(
  projectPath: string,
  leaderKey: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await readNeovimOptions(projectPath)
    const fileData: ProjectNeovimOptionsFile = {
      version: CURRENT_VERSION,
      options: existing?.options ?? {},
      leaderKey,
      updatedAt: Date.now(),
    }

    const existingHighlightOverrides = existing?.highlightOverrides
    if (
      existingHighlightOverrides !== undefined &&
      existingHighlightOverrides.length > 0
    ) {
      fileData.highlightOverrides = existingHighlightOverrides
    }

    await writeProjectTextFile(
      projectPath,
      PROJECT_PATHS.NEOVIM_OPTIONS,
      JSON.stringify(fileData, null, 2),
    )

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[neovim-options] Failed to write leader key:', error)
    return { success: false, error: message }
  }
}

/**
 * Update a single option value.
 */
export async function updateOptionValue(
  projectPath: string,
  optionName: string,
  value: NeovimOptionStoredValue,
): Promise<{ success: true } | { success: false; error: string }> {
  const current = await readNeovimOptions(projectPath)
  const options = current?.options ?? {}

  const updated = {
    ...options,
    [optionName]: value,
  }

  return writeNeovimOptions(
    projectPath,
    updated,
    current?.leaderKey,
    current?.highlightOverrides,
  )
}

/**
 * Remove a single option override (reset to default).
 */
export async function removeOptionValue(
  projectPath: string,
  optionName: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const current = await readNeovimOptions(projectPath)
  const options = current?.options ?? {}

  const { [optionName]: _removed, ...rest } = options
  void _removed // Explicitly ignore the removed value

  return writeNeovimOptions(
    projectPath,
    rest,
    current?.leaderKey,
    current?.highlightOverrides,
  )
}

/**
 * Check if the options file exists.
 */
export async function optionsFileExists(projectPath: string): Promise<boolean> {
  return projectFileExists(projectPath, PROJECT_PATHS.NEOVIM_OPTIONS)
}

/**
 * Type guard for validating options file structure.
 */
function isValidOptionsFile(data: unknown): data is ProjectNeovimOptionsFile {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // Check version
  if (obj['version'] !== CURRENT_VERSION) {
    return false
  }

  // Check options is an object
  if (typeof obj['options'] !== 'object' || obj['options'] === null) {
    return false
  }

  // Check updatedAt is a number
  if (typeof obj['updatedAt'] !== 'number') {
    return false
  }

  return true
}

function normalizeHighlightOverrideSource(
  value: unknown,
): HighlightOverrideSource {
  if (!isRecord(value)) {
    return { kind: 'custom' }
  }

  if (
    value['kind'] === 'preset' &&
    typeof value['presetId'] === 'string' &&
    value['presetId'].trim().length > 0
  ) {
    return { kind: 'preset', presetId: value['presetId'] }
  }

  return { kind: 'custom' }
}

function readString(
  obj: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = obj[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function readBoolean(
  obj: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = obj[key]
  return typeof value === 'boolean' ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
