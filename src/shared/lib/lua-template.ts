import type {
  RunFunctionDefaultValue,
  RunFunctionParamSignature,
} from '@/shared/types'

// ============================================
// Template Analysis
// ============================================

export type TemplateMode = 'positional' | 'named'

export interface TemplateAnalysis {
  /** Which mode this template uses */
  readonly mode: TemplateMode
  /** List of named placeholder references (empty for positional) */
  readonly namedPlaceholders: readonly string[]
  /** The raw template string */
  readonly template: string
}

// ============================================
// Validation Result (discriminated union)
// ============================================

export type TemplateValidationResult =
  | { readonly valid: true; readonly analysis: TemplateAnalysis }
  | {
      readonly valid: false
      readonly issues: readonly TemplateValidationIssue[]
      readonly errors: readonly string[]
    }

export type TemplateValidationErrorCode =
  | 'MIXED_PLACEHOLDER_MODES'
  | 'NAMED_PLACEHOLDER_UNDECLARED_PARAM'
  | 'REQUIRED_PARAM_NOT_REFERENCED'
  | 'DECLARED_PARAMS_NO_PLACEHOLDER'

export interface TemplateValidationIssue {
  readonly code: TemplateValidationErrorCode
  readonly message: string
}

// ============================================
// Render Result
// ============================================

export type TemplateRenderResult =
  | { readonly success: true; readonly lua: string }
  | { readonly success: false; readonly error: string }

// ============================================
// Constants
// ============================================

/** Matches bare $params (not followed by .) */
const POSITIONAL_RE = /\$params(?!\.)/g

/** Matches $params.<identifier> */
const NAMED_RE = /\$params\.([a-zA-Z_][a-zA-Z0-9_]*)/g

// ============================================
// Analysis
// ============================================

/**
 * Analyze a template string to determine its mode and extract placeholders.
 * Does NOT validate against param declarations — use `validateTemplate` for that.
 */
export function analyzeTemplate(template: string): TemplateAnalysis {
  POSITIONAL_RE.lastIndex = 0
  const hasPositional = POSITIONAL_RE.test(template)
  POSITIONAL_RE.lastIndex = 0

  const namedMatches: string[] = []
  NAMED_RE.lastIndex = 0
  for (
    let match = NAMED_RE.exec(template);
    match !== null;
    match = NAMED_RE.exec(template)
  ) {
    const name = match[1]
    if (name !== undefined && !namedMatches.includes(name)) {
      namedMatches.push(name)
    }
  }
  NAMED_RE.lastIndex = 0

  const hasNamed = namedMatches.length > 0

  if (hasPositional && !hasNamed) {
    return { mode: 'positional', namedPlaceholders: [], template }
  }
  if (hasNamed && !hasPositional) {
    return { mode: 'named', namedPlaceholders: namedMatches, template }
  }
  // Both or neither — default to positional (validation will catch mixed)
  return { mode: 'positional', namedPlaceholders: [], template }
}

// ============================================
// Validation helpers
// ============================================

/** Extract unique named placeholder names from a template string */
function extractNamedMatches(template: string): string[] {
  const namedMatches: string[] = []
  const namedRe = /\$params\.([a-zA-Z_][a-zA-Z0-9_]*)/g
  for (
    let match = namedRe.exec(template);
    match !== null;
    match = namedRe.exec(template)
  ) {
    const name = match[1]
    if (name !== undefined && !namedMatches.includes(name)) {
      namedMatches.push(name)
    }
  }
  return namedMatches
}

/** Validate named placeholders against declared params (rules 2 & 3) */
function validateNamedPlaceholders(
  namedMatches: string[],
  declaredParams: readonly RunFunctionParamSignature[],
  issues: TemplateValidationIssue[],
): void {
  const declaredNames = new Set(declaredParams.map((p) => p.name))

  // Rule 2: named placeholders must reference declared params
  for (const name of namedMatches) {
    if (!declaredNames.has(name)) {
      issues.push({
        code: 'NAMED_PLACEHOLDER_UNDECLARED_PARAM',
        message: `Named placeholder "$params.${name}" does not match any declared parameter. Declared: ${[...declaredNames].join(', ') || '(none)'}`,
      })
    }
  }

  // Rule 3: every required declared param must be referenced
  const referencedNames = new Set(namedMatches)
  for (const param of declaredParams) {
    if (!(param.optional ?? false) && !referencedNames.has(param.name)) {
      issues.push({
        code: 'REQUIRED_PARAM_NOT_REFERENCED',
        message: `Required parameter "${param.name}" is not referenced in the template. Add $params.${param.name} or mark it optional.`,
      })
    }
  }
}

// ============================================
// Validation
// ============================================

/**
 * Validate a template against its declared parameters.
 *
 * Rules:
 * 1. Cannot mix positional ($params) and named ($params.<name>) in one template
 * 2. Named placeholders must reference declared params
 * 3. Every required declared param must appear in at least one placeholder (named mode)
 * 4. Template must contain at least one placeholder if params are declared
 */
export function validateTemplate(
  template: string,
  declaredParams: readonly RunFunctionParamSignature[],
): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = []

  const hasPositional = /\$params(?!\.)/.test(template)
  const namedMatches = extractNamedMatches(template)
  const hasNamed = namedMatches.length > 0

  // Rule 1: no mixing
  if (hasPositional && hasNamed) {
    issues.push({
      code: 'MIXED_PLACEHOLDER_MODES',
      message:
        'Template mixes positional ($params) and named ($params.<name>) placeholders. Use one mode only.',
    })
  }

  // Rules 2 & 3: validate named placeholders
  if (hasNamed) {
    validateNamedPlaceholders(namedMatches, declaredParams, issues)
  }

  // Rule 4: if params are declared, template must have at least one placeholder
  if (declaredParams.length > 0 && !hasPositional && !hasNamed) {
    issues.push({
      code: 'DECLARED_PARAMS_NO_PLACEHOLDER',
      message:
        'Template has declared parameters but no $params placeholder. Add $params or $params.<name> placeholders.',
    })
  }

  if (issues.length > 0) {
    return {
      valid: false,
      issues,
      errors: issues.map((issue) => issue.message),
    }
  }

  return {
    valid: true,
    analysis: analyzeTemplate(template),
  }
}

// ============================================
// Rendering
// ============================================

/**
 * Encode a default value to a Lua literal string.
 */
export function defaultToLua(defaultValue: RunFunctionDefaultValue): string {
  switch (defaultValue.kind) {
    case 'lua':
      return defaultValue.lua
    case 'scalar': {
      const v = defaultValue.value
      if (typeof v === 'string') {
        const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `"${escaped}"`
      }
      if (typeof v === 'number') return String(v)
      if (typeof v === 'boolean') return v ? 'true' : 'false'
      return 'nil'
    }
    case 'multiselect': {
      const values = defaultValue.values.map((s) => {
        const esc = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `"${esc}"`
      })
      return values.length === 0 ? '{}' : `{ ${values.join(', ')} }`
    }
    case 'object': {
      const pairs: string[] = []
      for (const [k, v] of Object.entries(defaultValue.entries)) {
        const keyToken = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `["${k}"]`
        pairs.push(`${keyToken} = ${defaultToLua(v)}`)
      }
      return pairs.length === 0 ? '{}' : `{ ${pairs.join(', ')} }`
    }
    default: {
      const _exhaustive: never = defaultValue
      void _exhaustive
      return 'nil'
    }
  }
}

export function groupDottedKeys(
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
): Record<string, RunFunctionDefaultValue> {
  const result: Record<string, RunFunctionDefaultValue> = {}

  const upsert = (
    target: Record<string, RunFunctionDefaultValue>,
    parts: readonly string[],
    value: RunFunctionDefaultValue,
  ): void => {
    const [head, ...tail] = parts
    if (head === undefined) return
    if (tail.length === 0) {
      target[head] = value
      return
    }
    const existing = target[head]
    const entries: Record<string, RunFunctionDefaultValue> =
      existing?.kind === 'object' ? { ...existing.entries } : {}
    upsert(entries, tail, value)
    target[head] = { kind: 'object', entries }
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!key.includes('.')) {
      result[key] = value
      continue
    }
    const parts = key.split('.').filter((part) => part.length > 0)
    if (parts.length === 0) continue
    upsert(result, parts, value)
  }

  return result
}

/**
 * Render a template with resolved parameter values.
 *
 * Priority per param:
 * 1. `connectedValues[paramName]` — from graph input port (graph context only)
 * 2. `defaults[paramName]` — from paramDefaults
 * 3. `nil` — when no value is available
 *
 * @param template - The luaCall template string
 * @param params - Declared parameters in order
 * @param defaults - Default values keyed by param name
 * @param connectedValues - Optional connected input values (graph context)
 */
interface TemplateParam {
  name: string
  type?: string | undefined
  optional?: boolean | undefined
}

export function renderTemplate(
  template: string,
  params: readonly TemplateParam[],
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues?: Readonly<Record<string, string>>,
): TemplateRenderResult {
  const analysis = analyzeTemplate(template)

  if (analysis.mode === 'positional') {
    // Replace $params with comma-separated values
    const values = params.map((p) => {
      const connected = connectedValues?.[p.name]
      if (connected !== undefined && connected.length > 0) return connected
      const def = defaults[p.name]
      if (def !== undefined) return defaultToLua(def)
      return 'nil'
    })
    const joined = values.join(', ')
    const lua = template.replace(/\$params(?!\.)/g, joined)
    return { success: true, lua }
  }

  // Named mode
  const resolveNamedParamValue = (paramName: string): string => {
    const connected = connectedValues?.[paramName]
    if (connected !== undefined && connected.length > 0) {
      return connected
    }
    const def = defaults[paramName]
    return def !== undefined ? defaultToLua(def) : 'nil'
  }

  NAMED_RE.lastIndex = 0
  const lua = template.replace(NAMED_RE, (_fullMatch, paramName: string) =>
    resolveNamedParamValue(paramName),
  )
  NAMED_RE.lastIndex = 0

  return { success: true, lua }
}
