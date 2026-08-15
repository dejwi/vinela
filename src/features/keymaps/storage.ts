import { PROJECT_PATHS } from '@/shared/lib/paths'
import {
  projectFileExists,
  readProjectFile,
  writeProjectFile,
} from '@/shared/lib/storage-api'
import type {
  ActionScalarValue,
  RunFunctionDefaultValue,
  RunFunctionParamSignature,
  RunFunctionSignatureSnapshot,
  RunFunctionSource,
  SetOptionValueConfig,
} from '@/shared/types'
import {
  isKeymapMode,
  isPortDataType,
  isRunFunctionDefaultValue,
  isRunFunctionSource,
  isSetOptionValueConfig,
  isVariableScope,
} from '@/shared/types'
import type {
  KeymapsFile,
  ManualKeymapAction,
  ManualKeymapActionType,
  ProjectKeymap,
} from './types'

// ============================================
// Normalization Helpers (same patterns as graph.ts)
// ============================================

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function readString(
  source: UnknownRecord,
  key: string,
  fallback: string,
): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

function readBoolean(
  source: UnknownRecord,
  key: string,
  fallback: boolean,
): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}

function readStringArray(source: UnknownRecord, key: string): string[] {
  const value = source[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function readActionScalarValue(
  source: UnknownRecord,
  key: string,
  fallback: ActionScalarValue,
): ActionScalarValue {
  const value = source[key]
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  return fallback
}

function readPortDataType(
  source: UnknownRecord,
  key: string,
  fallback: import('@/shared/types').PortDataType,
): import('@/shared/types').PortDataType {
  const value = readString(source, key, fallback)
  return isPortDataType(value) ? value : fallback
}

// isKeymapMode is imported from @/shared/types

const MANUAL_ACTION_TYPES: ManualKeymapActionType[] = [
  'run-action',
  'run-function',
  'set-option',
  'set-variable',
  'code-block',
  'run-custom-action',
]

function isManualActionType(value: string): value is ManualKeymapActionType {
  return MANUAL_ACTION_TYPES.includes(value as ManualKeymapActionType)
}

// ============================================
// Param Values Normalization Helper
// ============================================

function normalizeParamValues(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}

// ============================================
// Run Function Normalization Helpers
// ============================================

function normalizeRunFunctionSource(raw: unknown): RunFunctionSource {
  if (isRunFunctionSource(raw)) {
    return raw
  }
  return { type: 'core', functionName: '' }
}

function normalizeRunFunctionSignature(
  raw: unknown,
): RunFunctionSignatureSnapshot | null {
  if (!isRecord(raw)) return null
  const params = raw['params']
  const rawReturns = raw['returns']
  const luaCall = raw['luaCall']

  if (!Array.isArray(params) || typeof luaCall !== 'string') return null

  const normalizedParams = params
    .map((param) => normalizeRunFunctionParamSignature(param))
    .filter(
      (param): param is RunFunctionParamSignature =>
        param !== null && param.name.length > 0,
    )

  const returnsStr = typeof rawReturns === 'string' ? rawReturns : 'void'

  return {
    params: normalizedParams,
    returns: isPortDataType(returnsStr) ? returnsStr : 'void',
    luaCall,
  }
}

function normalizeAllowedValueDescriptions(
  raw: unknown,
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(raw)) {
    return undefined
  }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }

  return Object.keys(result).length === 0 ? undefined : result
}

function normalizeRunFunctionParamSignature(
  raw: unknown,
): RunFunctionParamSignature | null {
  if (!isRecord(raw)) {
    return null
  }

  const normalizedObjectShape = Array.isArray(raw['objectShape'])
    ? raw['objectShape']
        .map((entry) => normalizeRunFunctionParamSignature(entry))
        .filter(
          (entry): entry is RunFunctionParamSignature =>
            entry !== null && entry.name.length > 0,
        )
    : undefined

  return {
    name: readString(raw, 'name', ''),
    type: readPortDataType(raw, 'type', 'any'),
    optional:
      typeof raw['optional'] === 'boolean' ? raw['optional'] : undefined,
    description:
      typeof raw['description'] === 'string' ? raw['description'] : undefined,
    tier:
      raw['tier'] === 'basic' || raw['tier'] === 'advanced'
        ? raw['tier']
        : undefined,
    group: typeof raw['group'] === 'string' ? raw['group'] : undefined,
    allowedValues: Array.isArray(raw['allowedValues'])
      ? raw['allowedValues'].filter(
          (value): value is string => typeof value === 'string',
        )
      : undefined,
    allowedValueDescriptions: normalizeAllowedValueDescriptions(
      raw['allowedValueDescriptions'],
    ),
    multi: typeof raw['multi'] === 'boolean' ? raw['multi'] : undefined,
    objectShape:
      normalizedObjectShape !== undefined && normalizedObjectShape.length > 0
        ? normalizedObjectShape
        : undefined,
  }
}

function normalizeRunFunctionParamDefaults(
  raw: unknown,
): Record<string, RunFunctionDefaultValue> {
  if (!isRecord(raw)) return {}
  const result: Record<string, RunFunctionDefaultValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (isRunFunctionDefaultValue(value)) {
      result[key] = value
    }
  }
  return result
}

// ============================================
// Action Normalization
// ============================================

function normalizeRunActionConfig(
  raw: UnknownRecord,
): ManualKeymapAction & { actionType: 'run-action' } {
  // Config is nested — read from raw['config'], not from raw directly
  const rawConfig = raw['config']
  const cfg: UnknownRecord = isRecord(rawConfig) ? rawConfig : {}

  const mode = cfg['mode']
  const actionTypeValue = cfg['actionType']

  return {
    actionType: 'run-action',
    config: {
      mode:
        mode === 'catalog' ||
        mode === 'custom-command' ||
        mode === 'custom-keys'
          ? mode
          : 'custom-command',
      actionType: actionTypeValue === 'keys' ? 'keys' : 'command',
      action: readString(cfg, 'action', ''),
      selectedActionKey: readString(cfg, 'selectedActionKey', ''),
      paramValues: normalizeParamValues(cfg['paramValues']),
    },
  }
}

function normalizeManualAction(raw: unknown): ManualKeymapAction | null {
  if (!isRecord(raw)) {
    return null
  }

  const actionType = raw['actionType']
  if (typeof actionType !== 'string') {
    return null
  }

  if (!isManualActionType(actionType)) {
    return null
  }

  switch (actionType) {
    case 'run-action':
      return normalizeRunActionConfig(raw)
    case 'run-function': {
      return {
        actionType: 'run-function',
        selectedFunctionKey: readString(raw, 'selectedFunctionKey', ''),
        functionSource: normalizeRunFunctionSource(raw['functionSource']),
        signature: normalizeRunFunctionSignature(raw['signature']),
        paramDefaults: normalizeRunFunctionParamDefaults(raw['paramDefaults']),
      }
    }
    case 'set-option': {
      const scope = raw['scope']
      const rawValueConfig = raw['valueConfig']
      const valueConfig: SetOptionValueConfig = isSetOptionValueConfig(
        rawValueConfig,
      )
        ? rawValueConfig
        : { valueMode: 'suggested', suggestedValue: true }
      return {
        actionType: 'set-option',
        optionName: readString(raw, 'optionName', ''),
        scope: scope === 'local' || scope === 'global' ? scope : 'global',
        valueConfig,
      }
    }
    case 'set-variable': {
      const scope = raw['scope']
      const valueType = raw['valueType']
      return {
        actionType: 'set-variable',
        scope:
          typeof scope === 'string' && isVariableScope(scope) ? scope : 'g',
        variableName: readString(raw, 'variableName', ''),
        valueType:
          valueType === 'string' ||
          valueType === 'number' ||
          valueType === 'boolean' ||
          valueType === 'raw'
            ? valueType
            : 'string',
        value: readActionScalarValue(raw, 'value', ''),
      }
    }
    case 'code-block':
      return {
        actionType: 'code-block',
        code: readString(raw, 'code', ''),
      }
    case 'run-custom-action':
      return {
        actionType: 'run-custom-action',
        graphId: readString(raw, 'graphId', ''),
        graphName: readString(raw, 'graphName', ''),
      }
    default:
      return null
  }
}

// ============================================
// ProjectKeymap Normalization
// ============================================

/**
 * Normalize a single ProjectKeymap from disk.
 * Returns null if the entry is too malformed to recover.
 */
function normalizeProjectKeymap(raw: unknown): ProjectKeymap | null {
  if (!isRecord(raw)) {
    return null
  }

  const id = readString(raw, 'id', '')
  if (id.length === 0) {
    return null
  }

  const keySequence = readString(raw, 'keySequence', '')
  if (keySequence.length === 0) {
    return null
  }

  const modes = readStringArray(raw, 'modes').filter(isKeymapMode)
  if (modes.length === 0) {
    return null
  }

  const action = normalizeManualAction(raw['action'])
  if (action === null) {
    return null
  }

  return {
    id,
    modes,
    keySequence,
    action,
    description: readString(raw, 'description', ''),
    silent: readBoolean(raw, 'silent', true),
    noremap: readBoolean(raw, 'noremap', true),
    expr: readBoolean(raw, 'expr', false),
    enabled: readBoolean(raw, 'enabled', true),
  }
}

// ============================================
// KeymapsFile Normalization
// ============================================

/**
 * Normalize a keymaps file from disk.
 * Handles missing/malformed fields with safe defaults.
 * Unknown action types are silently skipped.
 */
function normalizeKeymapsFile(raw: unknown): KeymapsFile {
  if (!isRecord(raw)) {
    return { version: 1, keymaps: [] }
  }

  const rawKeymaps = raw['keymaps']
  if (!Array.isArray(rawKeymaps)) {
    return { version: 1, keymaps: [] }
  }

  const keymaps: ProjectKeymap[] = []
  for (const entry of rawKeymaps) {
    const normalized = normalizeProjectKeymap(entry)
    if (normalized !== null) {
      keymaps.push(normalized)
    }
  }

  return { version: 1, keymaps }
}

// ============================================
// Public API
// ============================================

/**
 * Load manual keymaps from keymaps.json.
 * Returns empty array if file doesn't exist.
 * Throws on parse errors, permission errors, etc.
 */
export async function loadKeymaps(
  projectPath: string,
): Promise<ProjectKeymap[]> {
  // Check if file exists first
  const exists = await projectFileExists(projectPath, PROJECT_PATHS.KEYMAPS)
  if (!exists) {
    return []
  }

  // File exists - any error here is a real error, don't swallow it
  const file = await readProjectFile<KeymapsFile>(
    projectPath,
    PROJECT_PATHS.KEYMAPS,
  )
  return normalizeKeymapsFile(file).keymaps
}

/**
 * Save manual keymaps to keymaps.json.
 */
export async function saveKeymaps(
  projectPath: string,
  keymaps: ProjectKeymap[],
): Promise<void> {
  const file: KeymapsFile = {
    version: 1,
    keymaps,
  }
  await writeProjectFile(projectPath, PROJECT_PATHS.KEYMAPS, file)
}

/** @internal — exported for testing only */
export { normalizeManualAction, normalizeRunFunctionSignature }
