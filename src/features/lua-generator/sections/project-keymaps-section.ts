/**
 * Project Keymaps Section Generator
 *
 * Generates vim.keymap.set() calls for project keymaps.
 * Supports 6 action types: run-action, run-function, set-option,
 * set-variable, code-block, run-custom-action.
 *
 * Uses canonical ManualKeymapAction types from features/keymaps/types.ts
 * to avoid shape drift between keymaps storage and generation.
 */

import { resolveKeymapActivation } from '@/features/keymaps/profile-inclusion'
import type {
  ManualKeymapAction,
  ManualRunActionConfig,
  ProjectKeymap,
} from '@/features/keymaps/types'
import { getActiveProfileIds } from '@/features/profiles/profile-state'
import { findActionByKey } from '@/shared/data/neovim/action-catalog-entries'
import { CALLABLE_REGISTRY_GLOBAL } from '@/shared/lib/app-identity'
import type { TemplateValidationIssue } from '@/shared/lib/lua-template'
import { validateTemplate } from '@/shared/lib/lua-template'
import type {
  LegacyGenerationDiagnostic,
  ProjectKeymapsSectionInput,
  SectionResult,
} from '../types'
import { escapeLuaString } from '../utils/lua-string'
import {
  normalizeRunFunctionParamDefaults,
  renderRunFunctionLua,
} from '../utils/run-function-render'

/**
 * Generate the project keymaps section.
 *
 * Emits vim.keymap.set() calls for effectively active keymaps with proper
 * handling for all 6 action types.
 *
 * @param input - Keymaps configuration
 * @returns SectionResult with generated code and diagnostics
 */
export function generateProjectKeymapsSection(
  input: ProjectKeymapsSectionInput,
): SectionResult {
  const { keymaps, callableKeyByGraphId } = input
  const profiles = input.profiles ?? []
  const activeProfileIds = getActiveProfileIds(
    profiles,
    input.profileOverrides ?? {},
  )
  const diagnostics: LegacyGenerationDiagnostic[] = []

  const activeKeymaps = keymaps.filter(
    (k) => resolveKeymapActivation(k, profiles, activeProfileIds).enabled,
  )

  if (activeKeymaps.length === 0) {
    return {
      id: 'project-keymaps',
      code: [],
      diagnostics: [],
    }
  }

  // Sort keymaps deterministically: by key sequence, then by first mode
  const sortedKeymaps = [...activeKeymaps].sort((a, b) => {
    const keyCompare = a.keySequence.localeCompare(b.keySequence)
    if (keyCompare !== 0) return keyCompare
    const modeA = a.modes[0] ?? ''
    const modeB = b.modes[0] ?? ''
    return modeA.localeCompare(modeB)
  })

  const code: string[] = []

  // Emit each keymap
  for (const keymap of sortedKeymaps) {
    const keymapCode = generateKeymap(keymap, diagnostics, callableKeyByGraphId)
    if (keymapCode) {
      code.push(keymapCode)
    }
  }

  if (code.length === 0) {
    return {
      id: 'project-keymaps',
      code: [],
      diagnostics,
    }
  }

  // Add header comment at the beginning
  code.unshift('-- Keymaps')

  return {
    id: 'project-keymaps',
    code,
    diagnostics,
  }
}

/**
 * Generate a single vim.keymap.set() line for a keymap.
 */
function generateKeymap(
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
  callableKeyByGraphId: ReadonlyMap<string, string> | undefined,
): string | null {
  // Validate key sequence
  if (!keymap.keySequence.trim()) {
    diagnostics.push({
      severity: 'error',
      message: 'Keymap with empty key sequence — skipping',
    })
    return null
  }

  // Validate modes
  if (keymap.modes.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': no modes specified — skipping`,
      context: keymap.keySequence,
    })
    return null
  }

  // Generate modes argument
  const modesArg =
    keymap.modes.length === 1 && keymap.modes[0] !== undefined
      ? `"${escapeForLuaString(keymap.modes[0])}"`
      : `{ ${keymap.modes.map((m) => `"${escapeForLuaString(m)}"`).join(', ')} }`

  // Generate RHS based on action type
  const rhs = generateRHS(keymap, diagnostics, callableKeyByGraphId)
  if (rhs === null) {
    return null
  }

  // Build opts table
  const opts = buildOptsTable(keymap)
  const optsArg = opts.length > 0 ? `{ ${opts.join(', ')} }` : '{}'

  // Escape the key sequence
  const escapedKeySequence = escapeForLuaString(keymap.keySequence)

  return `vim.keymap.set(${modesArg}, "${escapedKeySequence}", ${rhs}, ${optsArg})`
}

/**
 * Generate the right-hand side (RHS) for a keymap based on action type.
 * Uses the canonical ManualKeymapAction discriminated union.
 */
function generateRHS(
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
  callableKeyByGraphId: ReadonlyMap<string, string> | undefined,
): string | null {
  const { action } = keymap

  switch (action.actionType) {
    case 'run-action':
      return generateRunActionRHS(action.config, keymap, diagnostics)

    case 'run-function':
      return generateRunFunctionRHS(action, keymap, diagnostics)

    case 'set-option':
      return generateSetOptionRHS(action)

    case 'set-variable':
      return generateSetVariableRHS(action)

    case 'code-block':
      return generateCodeBlockRHS(action, keymap, diagnostics)

    case 'run-custom-action':
      return generateRunCustomActionRHS(
        action,
        keymap,
        diagnostics,
        callableKeyByGraphId,
      )

    default: {
      // Exhaustive check — this should never be reached if all action types are handled
      const exhaustiveCheck: never = action
      diagnostics.push({
        severity: 'error',
        message: `Keymap '${keymap.keySequence}': unknown action type '${(exhaustiveCheck as { actionType: string }).actionType}'`,
        context: keymap.keySequence,
      })
      return null
    }
  }
}

/**
 * Normalize a command string into the canonical `<cmd>...<CR>` form.
 *
 * Rules applied (in order, case-insensitive on the `<cmd>`/`<CR>` tokens):
 *   1. If the value is already in `<cmd>...<CR>` form (starts with `<cmd>`
 *      case-insensitively), preserve as-is — do NOT append another `<CR>`.
 *      Strip any redundant leading `:` that appears immediately after the
 *      opening `<cmd>` token.
 *   2. Otherwise, strip a single leading `:` if present, then wrap with
 *      `<cmd>` prefix. Do NOT append a trailing `<CR>` if the trimmed value
 *      already contains `<CR>` (covers hybrid forms like `:cprev<CR>zz`).
 *   3. Append `<CR>` only when the value does not already end — or contain —
 *      a `<CR>` terminator.
 *
 * Normalization is performed before Lua escaping.
 */
export function normalizeCommandRHS(raw: string): string {
  const trimmed = raw.trim()

  // Case 1: already has <cmd> prefix (case-insensitive match)
  if (/^<cmd>/i.test(trimmed)) {
    // Strip redundant `:` immediately after the `<cmd>` token
    // e.g. `<cmd>:write<CR>` → `<cmd>write<CR>`
    const stripped = trimmed.replace(/^(<cmd>):/i, '$1')
    // Enforce terminating <CR> — <cmd> mappings require it
    return /<CR>$/i.test(stripped) ? stripped : `${stripped}<CR>`
  }

  // Case 2: strip leading `:` if present
  const stripped = trimmed.startsWith(':') ? trimmed.slice(1) : trimmed

  // Case 3: append <CR> only when not already present anywhere in the string.
  // A <CR> anywhere (not just at the end) signals an intentional hybrid form
  // like `:cprev<CR>zz` where the trailing keys are not a command — leave as-is.
  const hasCR = /<CR>/i.test(stripped)
  return hasCR ? `<cmd>${stripped}` : `<cmd>${stripped}<CR>`
}

/**
 * Generate RHS for run-action type.
 * Uses canonical ManualRunActionConfig from keymaps/types.ts:
 *   - actionType: 'command' | 'keys'  (from RunActionActionConfig)
 *   - action: string
 */
function generateRunActionRHS(
  config: ManualRunActionConfig,
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
): string | null {
  if (!config.action?.trim()) {
    diagnostics.push({
      severity: 'warning',
      message: `Keymap '${keymap.keySequence}': empty action — keymap will do nothing`,
      context: keymap.keySequence,
    })
    return '""'
  }

  if (config.actionType === 'command') {
    // Normalize to canonical <cmd>...<CR> form before escaping
    const normalized = normalizeCommandRHS(config.action)
    return `"${escapeForLuaString(normalized)}"`
  } else {
    // Keys action: raw key sequence (no normalization)
    return `"${escapeForLuaString(config.action)}"`
  }
}

/**
 * Generate RHS for run-function type.
 * Uses canonical ManualKeymapAction run-function variant:
 *   - functionSource: RunFunctionSource (discriminated union)
 *   - signature: RunFunctionSignatureSnapshot | null
 *   - paramDefaults: Record<string, RunFunctionDefaultValue>
 */
function generateRunFunctionRHS(
  action: Extract<ManualKeymapAction, { actionType: 'run-function' }>,
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
): string | null {
  if (!action.signature) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': function signature not captured — cannot generate`,
      context: keymap.keySequence,
    })
    return null
  }

  const luaCall = action.signature.luaCall
  const declaredParams = action.signature.params
  const validationResult = validateTemplate(luaCall, declaredParams)
  if (!validationResult.valid) {
    if (isKeymapNoPlaceholderCompatibilityCase(validationResult.issues)) {
      // Keymap-only legacy compatibility fallback: keep generation for
      // declared params + no placeholder templates by warning and using raw call.
      diagnostics.push({
        severity: 'warning',
        message: `Keymap '${keymap.keySequence}': run-function template declared parameters but no placeholder — using raw luaCall for keymap compatibility`,
        context: keymap.keySequence,
      })
      return `function()\n  ${luaCall}\nend`
    }

    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': invalid run-function template — ${validationResult.errors.join(' ')}`,
      context: keymap.keySequence,
    })
    return null
  }

  const mode = validationResult.analysis.mode
  const normalizedDefaultsResult = normalizeRunFunctionParamDefaults({
    params: declaredParams,
    paramDefaults: action.paramDefaults,
    context: {
      ownerKind: 'project-keymap',
      ownerLabel: keymap.keySequence,
      functionLabel: action.selectedFunctionKey,
    },
  })

  for (const diagnostic of normalizedDefaultsResult.diagnostics) {
    diagnostics.push({
      severity: diagnostic.severity,
      message: `${action.selectedFunctionKey} param "${diagnostic.paramName}": ${diagnostic.message}`,
      context: keymap.keySequence,
    })
  }

  if (mode === 'named') {
    const renderResult = renderRunFunctionLua({
      luaCall,
      params: declaredParams,
      paramDefaults: normalizedDefaultsResult.defaults,
      positionalParamsMode: 'options-table',
    })
    if (!renderResult.success) {
      diagnostics.push({
        severity: 'error',
        message: `Keymap '${keymap.keySequence}': failed to render run-function template — ${renderResult.error}`,
        context: keymap.keySequence,
      })
      return null
    }

    return `function()\n  ${renderResult.lua}\nend`
  }

  const renderResult = renderRunFunctionLua({
    luaCall,
    params: declaredParams,
    paramDefaults: normalizedDefaultsResult.defaults,
    positionalParamsMode: 'options-table',
  })
  if (!renderResult.success) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': failed to render run-function template — ${renderResult.error}`,
      context: keymap.keySequence,
    })
    return null
  }

  // Wrap in function() ... end
  return `function()\n  ${renderResult.lua}\nend`
}

function isKeymapNoPlaceholderCompatibilityCase(
  issues: readonly TemplateValidationIssue[],
): boolean {
  return issues.some((issue) => issue.code === 'DECLARED_PARAMS_NO_PLACEHOLDER')
}

/**
 * Generate RHS for set-option type.
 * Uses canonical SetOptionValueConfig discriminated union:
 *   - { valueMode: 'suggested'; suggestedValue: ActionScalarValue }
 *   - { valueMode: 'raw'; rawValue: string }
 */
function generateSetOptionRHS(
  action: Extract<ManualKeymapAction, { actionType: 'set-option' }>,
): string {
  const optApi = action.scope === 'local' ? 'vim.opt_local' : 'vim.opt'
  const { valueConfig } = action

  if (valueConfig.valueMode === 'suggested') {
    // Suggested value: serialize the suggestedValue (canonical field name)
    const luaValue = serializeValueForOption(valueConfig.suggestedValue)
    return `function()\n  ${optApi}.${action.optionName} = ${luaValue}\nend`
  } else {
    // Raw value: emit verbatim rawValue
    return `function()\n  ${optApi}.${action.optionName} = ${valueConfig.rawValue}\nend`
  }
}

/**
 * Generate RHS for set-variable type.
 * Uses canonical ManualKeymapAction set-variable variant:
 *   - scope: 'g' | 'b' | 'w' | 't' | 'v'  (includes 'v' for vim scope)
 *   - value: ActionScalarValue
 */
function generateSetVariableRHS(
  action: Extract<ManualKeymapAction, { actionType: 'set-variable' }>,
): string {
  let varApi: string
  switch (action.scope) {
    case 'g':
      varApi = 'vim.g'
      break
    case 'b':
      varApi = 'vim.b'
      break
    case 'w':
      varApi = 'vim.w'
      break
    case 't':
      varApi = 'vim.t'
      break
    case 'v':
      varApi = 'vim.v'
      break
    default: {
      const exhaustiveScope: never = action.scope
      varApi = `vim.${exhaustiveScope}`
    }
  }

  let luaValue: string
  if (action.valueType === 'raw') {
    luaValue = String(action.value)
  } else {
    luaValue = serializeValueForOption(action.value)
  }

  return `function()\n  ${varApi}.${action.variableName} = ${luaValue}\nend`
}

/**
 * Generate RHS for code-block type.
 */
function generateCodeBlockRHS(
  action: Extract<ManualKeymapAction, { actionType: 'code-block' }>,
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
): string | null {
  const code = action.code?.trim() ?? ''

  if (!code) {
    diagnostics.push({
      severity: 'warning',
      message: `Keymap '${keymap.keySequence}': empty code block — keymap will do nothing`,
      context: keymap.keySequence,
    })
    return null
  }

  // Wrap code in function block with proper indentation
  const lines = code.split('\n')
  const indentedCode = lines.map((line) => `  ${line}`).join('\n')

  return `function()\n${indentedCode}\nend`
}

/**
 * Generate RHS for run-custom-action type.
 *
 * Calls the callable graph via the global callable registry, matching the
 * canonical callable-key flow used by callable-entry.ts (registration) and
 * graph-ref.ts (call):
 *   _G._vinela_callables["<callableKeyByGraphId.get(graphId)>"]({})
 */
function generateRunCustomActionRHS(
  action: Extract<ManualKeymapAction, { actionType: 'run-custom-action' }>,
  keymap: ProjectKeymap,
  diagnostics: LegacyGenerationDiagnostic[],
  callableKeyByGraphId: ReadonlyMap<string, string> | undefined,
): string | null {
  const graphId = action.graphId?.trim() ?? ''
  if (!graphId) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': run-custom-action is missing graphId — skipping`,
      context: keymap.keySequence,
    })
    return null
  }

  if (!callableKeyByGraphId) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': callable key map unavailable for run-custom-action graph '${graphId}' — skipping`,
      context: keymap.keySequence,
    })
    return null
  }

  const callableKey = callableKeyByGraphId.get(graphId)
  if (!callableKey) {
    diagnostics.push({
      severity: 'error',
      message: `Keymap '${keymap.keySequence}': unresolved callable key for run-custom-action graph '${graphId}' — skipping`,
      context: keymap.keySequence,
    })
    return null
  }

  const callableRef = `_G.${CALLABLE_REGISTRY_GLOBAL}["${escapeForLuaString(callableKey)}"]`

  return `function()\n  ${callableRef}({})\nend`
}

/**
 * Resolve the `desc` string for a keymap's opts table.
 *
 * Priority order:
 *   1. User-entered description (non-empty after trim) — always wins.
 *   2. Catalog entry fallback when action is `run-action` in `catalog` mode
 *      with a non-empty `selectedActionKey`:
 *        - Preferred: `shortDescription`
 *        - Fallback:  `label`
 *   3. `undefined` — omit `desc` from opts.
 */
function resolveDesc(keymap: ProjectKeymap): string | undefined {
  // Priority 1: explicit user description
  if (keymap.description.trim()) {
    return keymap.description
  }

  // Priority 2: catalog action fallback
  const { action } = keymap
  if (action.actionType === 'run-action') {
    const { config } = action
    if (config.mode === 'catalog' && config.selectedActionKey) {
      const entry = findActionByKey(config.selectedActionKey)
      if (entry) {
        return entry.shortDescription || entry.label
      }
    }
  }

  // Priority 3: no desc
  return undefined
}

/**
 * Build the opts table for vim.keymap.set.
 */
function buildOptsTable(keymap: ProjectKeymap): string[] {
  const opts: string[] = []

  // desc: use explicit description or catalog fallback
  const desc = resolveDesc(keymap)
  if (desc) {
    opts.push(`desc = "${escapeForLuaString(desc)}"`)
  }

  // silent: include only if true (default is false)
  if (keymap.silent) {
    opts.push('silent = true')
  }

  // noremap: vim.keymap.set defaults to noremap=true
  // So we only include if false (to set remap=true)
  if (!keymap.noremap) {
    opts.push('remap = true')
  }

  // expr: include only if true
  if (keymap.expr) {
    opts.push('expr = true')
  }

  return opts
}

/**
 * Serialize a value for use in option/variable assignments.
 */
function serializeValueForOption(value: unknown): string {
  if (value === null || value === undefined) {
    return 'nil'
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'string') {
    return `"${escapeForLuaString(value)}"`
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '{}'
    }
    const items = value.map((v) => serializeValueForOption(v))
    return `{ ${items.join(', ')} }`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return '{}'
    }
    const pairs = entries.map(([k, v]) => {
      const keyStr = isValidLuaIdentifier(k)
        ? k
        : `["${escapeForLuaString(k)}"]`
      return `${keyStr} = ${serializeValueForOption(v)}`
    })
    return `{ ${pairs.join(', ')} }`
  }

  return `"${escapeForLuaString(String(value))}"`
}

/**
 * Check if a string is a valid Lua identifier.
 */
function isValidLuaIdentifier(str: string): boolean {
  if (str.length === 0) return false

  // Must start with letter or underscore
  const firstChar = str.charCodeAt(0)
  if (
    !(firstChar >= 0x41 && firstChar <= 0x5a) && // A-Z
    !(firstChar >= 0x61 && firstChar <= 0x7a) && // a-z
    firstChar !== 0x5f // _
  ) {
    return false
  }

  // Remaining chars must be alphanumeric or underscore
  for (let i = 1; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (
      !(code >= 0x41 && code <= 0x5a) && // A-Z
      !(code >= 0x61 && code <= 0x7a) && // a-z
      !(code >= 0x30 && code <= 0x39) && // 0-9
      code !== 0x5f // _
    ) {
      return false
    }
  }

  return true
}

/**
 * Escape a string for use in Lua double-quoted string.
 */
function escapeForLuaString(value: string): string {
  return escapeLuaString(value)
}
