import { normalizeKeymapKey } from '@/features/plugins/components/schema-fields/plugin-keymap-key-normalization'
import type {
  PluginConfigValue,
  PluginKeymapCommandEntry,
  SchemaPluginKeymapOption,
} from '@/shared/types'

/**
 * Canonical default resolver for plugin-keymap options.
 *
 * Resolves the effective preset, overrides, and rebindLinks from a stored config value,
 * applying the schema's defaultPreset when the stored value has no preset.
 *
 * This is the SINGLE SOURCE OF TRUTH for default resolution — used by:
 * - UI (PluginKeymapField initialization)
 * - Validation (validatePluginKeymapValue)
 * - Lua generator (plugin-section transform)
 *
 * rebindLinks hydration contract:
 * 1. Read from canonical `_meta.rebindLinks`, fallback to legacy top-level `rebindLinks`.
 * 2. Normalize each raw link (newKey, oldKey) via normalizeKeymapKey().
 * 3. Prune invalid links:
 *    - Self-links (normalized newKey === normalized oldKey).
 *    - Links where overrides[newKey] is not a command-array.
 *    - Links where overrides[oldKey] !== false.
 * 4. Deterministic conflict resolution: last-write-wins when multiple raw entries
 *    collapse to the same normalized newKey (Map insertion order).
 *
 * @param value - The stored PluginConfigValue (may be undefined if user hasn't configured)
 * @param option - The schema option definition
 * @returns Resolved config with preset always populated and rebindLinks pruned
 */
export function resolvePluginKeymapDefaults(
  value: PluginConfigValue | undefined,
  option: SchemaPluginKeymapOption,
): {
  preset: string
  overrides: Record<string, PluginKeymapCommandEntry[] | false>
  rebindLinks: Map<string, string>
} {
  // No stored value at all → use schema default preset, no overrides, no links
  if (value === undefined || value === null) {
    return {
      preset: option.defaultPreset,
      overrides: {},
      rebindLinks: new Map(),
    }
  }

  // Not an object → invalid shape, fall back to defaults
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      preset: option.defaultPreset,
      overrides: {},
      rebindLinks: new Map(),
    }
  }

  const obj = value as Record<string, PluginConfigValue>

  // Resolve preset: use stored value if present, otherwise schema default
  const preset =
    typeof obj['preset'] === 'string' ? obj['preset'] : option.defaultPreset

  // Resolve overrides
  const rawOverrides = obj['overrides']
  const overrides: Record<string, PluginKeymapCommandEntry[] | false> = {}

  if (
    rawOverrides !== undefined &&
    rawOverrides !== null &&
    typeof rawOverrides === 'object' &&
    !Array.isArray(rawOverrides)
  ) {
    for (const [key, cmds] of Object.entries(
      rawOverrides as Record<string, PluginConfigValue>,
    )) {
      if (cmds === false) {
        overrides[key] = false
      } else if (Array.isArray(cmds)) {
        overrides[key] = cmds
          .map((entry) => {
            if (typeof entry === 'string') return entry
            if (
              typeof entry === 'object' &&
              entry !== null &&
              'lua' in (entry as Record<string, unknown>)
            ) {
              return {
                lua: String((entry as Record<string, unknown>)['lua']),
              }
            }
            return null // malformed — will be filtered by validation
          })
          .filter((e): e is PluginKeymapCommandEntry => e !== null)
      }
      // else: skip malformed entry (validation will catch it)
    }
  }

  // Resolve rebindLinks from canonical _meta.rebindLinks or legacy top-level rebindLinks
  const rebindLinks = resolveAndPruneRebindLinks(obj, overrides)

  return { preset, overrides, rebindLinks }
}

/**
 * Read, normalize, and prune rebindLinks from a stored config object.
 *
 * Priority: `_meta.rebindLinks` > legacy top-level `rebindLinks` > empty.
 *
 * Pruning invariants:
 * - No self-links.
 * - overrides[newKey] must be a command-array (not false, not absent).
 * - overrides[oldKey] must be false (disabled).
 * - Deterministic: last-write-wins for duplicate normalized newKey.
 */
function resolveAndPruneRebindLinks(
  obj: Record<string, PluginConfigValue>,
  overrides: Record<string, PluginKeymapCommandEntry[] | false>,
): Map<string, string> {
  // Read raw links from canonical or legacy location
  const rawLinks = readRawRebindLinks(obj)
  if (rawLinks === null) {
    return new Map()
  }

  const result = new Map<string, string>()

  for (const [rawNewKey, rawOldKey] of Object.entries(rawLinks)) {
    if (typeof rawOldKey !== 'string') continue

    const normalizedNew = normalizeKeymapKey(rawNewKey)
    const normalizedOld = normalizeKeymapKey(rawOldKey)

    // Prune: self-links
    if (normalizedNew === normalizedOld) continue
    // Prune: empty keys
    if (normalizedNew === '' || normalizedOld === '') continue

    // Prune: referential integrity — newKey must have a command-array override
    const newOverride = findOverrideByNormalizedKey(normalizedNew, overrides)
    if (newOverride === undefined || newOverride === false) continue

    // Prune: referential integrity — oldKey must be disabled (false)
    const oldOverride = findOverrideByNormalizedKey(normalizedOld, overrides)
    if (oldOverride !== false) continue

    // Last-write-wins for duplicate normalized newKey (Map.set overwrites)
    result.set(normalizedNew, normalizedOld)
  }

  return result
}

/**
 * Read raw rebindLinks from the stored config object.
 * Returns null if no rebindLinks found (not an error — just absent).
 */
function readRawRebindLinks(
  obj: Record<string, PluginConfigValue>,
): Record<string, unknown> | null {
  // Canonical: _meta.rebindLinks
  const meta = obj['_meta']
  if (
    meta !== undefined &&
    meta !== null &&
    typeof meta === 'object' &&
    !Array.isArray(meta)
  ) {
    const metaObj = meta as Record<string, PluginConfigValue>
    const links = metaObj['rebindLinks']
    if (
      links !== undefined &&
      links !== null &&
      typeof links === 'object' &&
      !Array.isArray(links)
    ) {
      return links as Record<string, unknown>
    }
  }

  // Legacy: top-level rebindLinks (backward compatibility — read-only path)
  const legacyLinks = obj['rebindLinks']
  if (
    legacyLinks !== undefined &&
    legacyLinks !== null &&
    typeof legacyLinks === 'object' &&
    !Array.isArray(legacyLinks)
  ) {
    return legacyLinks as Record<string, unknown>
  }

  return null
}

/**
 * Find an override entry by normalized key.
 * Searches the overrides map by normalizing each stored key.
 * Returns undefined if not found.
 */
function findOverrideByNormalizedKey(
  normalizedKey: string,
  overrides: Record<string, PluginKeymapCommandEntry[] | false>,
): PluginKeymapCommandEntry[] | false | undefined {
  for (const [k, v] of Object.entries(overrides)) {
    if (normalizeKeymapKey(k) === normalizedKey) {
      return v
    }
  }
  return undefined
}

/**
 * Normalize and prune a rebindLinks Map before persistence.
 *
 * Enforces all hard invariants:
 * - Normalize keys/values via normalizeKeymapKey().
 * - Drop self-links.
 * - Drop links where overrides[newKey] is not a command-array.
 * - Drop links where overrides[oldKey] !== false.
 * - Last-write-wins for duplicate normalized newKey.
 *
 * This is the canonical helper for all mutation paths in PluginKeymapField.
 */
export function normalizeAndPruneRebindLinks(
  rawLinks: Map<string, string>,
  overrides: Map<string, PluginKeymapCommandEntry[] | false>,
): Map<string, string> {
  const result = new Map<string, string>()

  for (const [rawNewKey, rawOldKey] of rawLinks) {
    const normalizedNew = normalizeKeymapKey(rawNewKey)
    const normalizedOld = normalizeKeymapKey(rawOldKey)

    // Prune: self-links
    if (normalizedNew === normalizedOld) continue
    // Prune: empty keys
    if (normalizedNew === '' || normalizedOld === '') continue

    // Prune: referential integrity — newKey must have a command-array override
    const newOverride = findOverrideByNormalizedKeyInMap(
      normalizedNew,
      overrides,
    )
    if (newOverride === undefined || newOverride === false) continue

    // Prune: referential integrity — oldKey must be disabled (false)
    const oldOverride = findOverrideByNormalizedKeyInMap(
      normalizedOld,
      overrides,
    )
    if (oldOverride !== false) continue

    // Last-write-wins for duplicate normalized newKey
    result.set(normalizedNew, normalizedOld)
  }

  return result
}

/**
 * Find an override entry by normalized key in a Map.
 */
function findOverrideByNormalizedKeyInMap(
  normalizedKey: string,
  overrides: Map<string, PluginKeymapCommandEntry[] | false>,
): PluginKeymapCommandEntry[] | false | undefined {
  for (const [k, v] of overrides) {
    if (normalizeKeymapKey(k) === normalizedKey) {
      return v
    }
  }
  return undefined
}
