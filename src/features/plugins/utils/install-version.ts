import type {
  PluginInstallOverride,
  PluginInstallRefKind,
  PluginInstallVersionOverride,
  VimPackVersionSpec,
} from '@/shared/types'

const COMMIT_REF_PATTERN = /^[0-9a-fA-F]{7,40}$/

export type EffectiveInstallVersionSource =
  | 'schema-default'
  | 'user-override'
  | 'none'

export interface EffectiveInstallVersionDisplay {
  readonly source: EffectiveInstallVersionSource
  readonly label: string
  readonly detail: string
}

export type ValidateInstallVersionResult =
  | {
      readonly success: true
      readonly version: PluginInstallVersionOverride
    }
  | {
      readonly success: false
      readonly reason: string
    }

export function isPluginInstallRefKind(
  value: unknown,
): value is PluginInstallRefKind {
  return (
    value === 'branch' ||
    value === 'tag' ||
    value === 'commit' ||
    value === 'ref'
  )
}

export function isCommitRefValue(value: string): boolean {
  return COMMIT_REF_PATTERN.test(value)
}

export function containsDisallowedInstallVersionCharacters(
  value: string,
): boolean {
  for (const character of value) {
    const charCode = character.charCodeAt(0)
    if (charCode <= 31 || charCode === 127) {
      return true
    }
  }

  return false
}

export function normalizeInstallVersionValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmedValue = value.trim()
  if (
    trimmedValue.length === 0 ||
    containsDisallowedInstallVersionCharacters(trimmedValue)
  ) {
    return null
  }

  return trimmedValue
}

export function inferPluginInstallRefKind(value: string): PluginInstallRefKind {
  return isCommitRefValue(value) ? 'commit' : 'ref'
}

export function validatePluginInstallVersionOverride(
  version: PluginInstallVersionOverride,
): ValidateInstallVersionResult {
  const normalizedValue = normalizeInstallVersionValue(version.value)
  if (normalizedValue === null) {
    return {
      success: false,
      reason: 'Install version must be a non-empty single-line string.',
    }
  }

  if (version.mode === 'semver-range') {
    return {
      success: true,
      version: {
        mode: 'semver-range',
        value: normalizedValue,
      },
    }
  }

  if (version.refKind === 'commit' && !isCommitRefValue(normalizedValue)) {
    return {
      success: false,
      reason: 'Commit refs must be 7-40 hexadecimal characters.',
    }
  }

  const normalizedRefKind = isPluginInstallRefKind(version.refKind)
    ? version.refKind
    : inferPluginInstallRefKind(normalizedValue)

  return {
    success: true,
    version: {
      mode: 'ref',
      refKind: normalizedRefKind,
      value: normalizedValue,
    },
  }
}

export function normalizeInstallOverrideName(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

export function getInstallVersionLabel(
  version: VimPackVersionSpec | PluginInstallVersionOverride,
): string {
  if (version.mode === 'semver-range') {
    return `semver range ${version.value}`
  }

  if ('refKind' in version) {
    return `${version.refKind} ${version.value}`
  }

  return `ref ${version.value}`
}

export function getEffectiveInstallVersionDisplay(
  schemaVersion: VimPackVersionSpec | undefined,
  overrideVersion: PluginInstallVersionOverride | undefined,
): EffectiveInstallVersionDisplay {
  if (overrideVersion !== undefined) {
    return {
      source: 'user-override',
      label: `Custom: ${getInstallVersionLabel(overrideVersion)}`,
      detail: "Generated from this project's custom install target.",
    }
  }

  if (schemaVersion !== undefined) {
    return {
      source: 'schema-default',
      label: `Default: ${getInstallVersionLabel(schemaVersion)}`,
      detail: 'Using the schema recommended install target.',
    }
  }

  return {
    source: 'none',
    label: 'Default: latest/default branch',
    detail: 'No schema install pin is configured.',
  }
}

export function installVersionSpecsEqual(
  left: VimPackVersionSpec | PluginInstallVersionOverride | undefined,
  right: VimPackVersionSpec | PluginInstallVersionOverride | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right
  }

  return left.mode === right.mode && left.value === right.value
}

export function hasInstallOverrideVersion(
  override: PluginInstallOverride | undefined,
): override is PluginInstallOverride & {
  readonly version: PluginInstallVersionOverride
} {
  return override?.version !== undefined
}
