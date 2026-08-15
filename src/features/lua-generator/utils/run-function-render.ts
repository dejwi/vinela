import {
  defaultToLua,
  groupDottedKeys,
  renderTemplate,
} from '@/shared/lib/lua-template'
import type {
  RunFunctionDefaultValue,
  RunFunctionParamSignature,
} from '@/shared/types'

export interface RunFunctionNormalizationContext {
  readonly ownerKind: 'graph-node' | 'project-keymap'
  readonly ownerLabel: string
  readonly functionLabel: string
}

export interface RunFunctionNormalizationDiagnostic {
  readonly severity: 'warning' | 'error'
  readonly code:
    | 'run-function-param-coerced'
    | 'run-function-param-dropped'
    | 'run-function-param-invalid-table-shape'
  readonly message: string
  readonly paramName: string
  readonly details?: string | undefined
}

export interface RunFunctionNormalizationResult {
  readonly defaults: Record<string, RunFunctionDefaultValue>
  readonly diagnostics: RunFunctionNormalizationDiagnostic[]
}

interface NormalizeDefaultsInput {
  readonly params: readonly RunFunctionParamSignature[]
  readonly paramDefaults: Readonly<Record<string, RunFunctionDefaultValue>>
  readonly context: RunFunctionNormalizationContext
}

interface RenderRunFunctionLuaInput {
  readonly luaCall: string
  readonly params: readonly RunFunctionParamSignature[]
  readonly paramDefaults: Readonly<Record<string, RunFunctionDefaultValue>>
  readonly connectedValues?: Readonly<Record<string, string>>
  readonly positionalParamsMode?: 'argument-list' | 'options-table'
}

export interface RenderRunFunctionLuaResult {
  readonly success: true
  readonly lua: string
}

export interface RenderRunFunctionLuaFailure {
  readonly success: false
  readonly error: string
}

export type RenderRunFunctionLuaOutcome =
  | RenderRunFunctionLuaResult
  | RenderRunFunctionLuaFailure

function isFiniteNumberString(value: string): number | undefined {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return undefined
  }

  const coercedValue = Number(trimmedValue)
  return Number.isFinite(coercedValue) ? coercedValue : undefined
}

function createDiagnostic(
  severity: RunFunctionNormalizationDiagnostic['severity'],
  code: RunFunctionNormalizationDiagnostic['code'],
  paramName: string,
  message: string,
  details?: string,
): RunFunctionNormalizationDiagnostic {
  return { severity, code, paramName, message, details }
}

function findExactParam(
  params: readonly RunFunctionParamSignature[],
  paramName: string,
): RunFunctionParamSignature | undefined {
  return params.find((param) => param.name === paramName)
}

function findNestedShapeParam(
  param: RunFunctionParamSignature,
  pathSegments: readonly string[],
): RunFunctionParamSignature | undefined {
  let currentParam: RunFunctionParamSignature | undefined = param

  for (const segment of pathSegments) {
    if (
      currentParam?.type !== 'table' ||
      currentParam.objectShape === undefined
    ) {
      return undefined
    }

    currentParam = currentParam.objectShape.find(
      (childParam) => childParam.name === segment,
    )
  }

  return currentParam
}

function findSignatureForParamName(
  params: readonly RunFunctionParamSignature[],
  paramName: string,
): RunFunctionParamSignature | undefined {
  const exactParam = findExactParam(params, paramName)
  if (exactParam !== undefined) {
    return exactParam
  }

  const [rootName, ...tail] = paramName.split('.')
  if (rootName === undefined || tail.length === 0) {
    return undefined
  }

  const rootParam = findExactParam(params, rootName)
  return rootParam === undefined
    ? undefined
    : findNestedShapeParam(rootParam, tail)
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: signature-aware normalization intentionally branches by PortDataType and table shape
function normalizeScalarForSignature(
  paramName: string,
  value: RunFunctionDefaultValue,
  signature: RunFunctionParamSignature,
): RunFunctionNormalizationResult {
  if (value.kind === 'lua') {
    return { defaults: { [paramName]: value }, diagnostics: [] }
  }

  switch (signature.type) {
    case 'number': {
      if (value.kind !== 'scalar') {
        return {
          defaults: {},
          diagnostics: [
            createDiagnostic(
              'warning',
              'run-function-param-dropped',
              paramName,
              `Dropped invalid number default for parameter "${paramName}"`,
            ),
          ],
        }
      }

      if (typeof value.value === 'number' && Number.isFinite(value.value)) {
        return { defaults: { [paramName]: value }, diagnostics: [] }
      }

      if (typeof value.value === 'string') {
        const coercedValue = isFiniteNumberString(value.value)
        if (coercedValue !== undefined) {
          return {
            defaults: {
              [paramName]: { kind: 'scalar', value: coercedValue },
            },
            diagnostics: [
              createDiagnostic(
                'warning',
                'run-function-param-coerced',
                paramName,
                `Coerced numeric string default for parameter "${paramName}"`,
              ),
            ],
          }
        }
      }

      return {
        defaults: {},
        diagnostics: [
          createDiagnostic(
            'warning',
            'run-function-param-dropped',
            paramName,
            `Dropped invalid number default for parameter "${paramName}"`,
          ),
        ],
      }
    }

    case 'boolean': {
      if (value.kind === 'scalar' && typeof value.value === 'boolean') {
        return { defaults: { [paramName]: value }, diagnostics: [] }
      }

      if (
        value.kind === 'scalar' &&
        (value.value === 'true' || value.value === 'false')
      ) {
        return {
          defaults: {
            [paramName]: { kind: 'scalar', value: value.value === 'true' },
          },
          diagnostics: [
            createDiagnostic(
              'warning',
              'run-function-param-coerced',
              paramName,
              `Coerced boolean string default for parameter "${paramName}"`,
            ),
          ],
        }
      }

      return {
        defaults: {},
        diagnostics: [
          createDiagnostic(
            'warning',
            'run-function-param-dropped',
            paramName,
            `Dropped invalid boolean default for parameter "${paramName}"`,
          ),
        ],
      }
    }

    case 'string': {
      if (value.kind !== 'scalar' || typeof value.value !== 'string') {
        return {
          defaults: {},
          diagnostics: [
            createDiagnostic(
              'warning',
              'run-function-param-dropped',
              paramName,
              `Dropped invalid string default for parameter "${paramName}"`,
            ),
          ],
        }
      }

      if (
        signature.allowedValues !== undefined &&
        !signature.allowedValues.includes(value.value)
      ) {
        return {
          defaults: {},
          diagnostics: [
            createDiagnostic(
              'warning',
              'run-function-param-dropped',
              paramName,
              `Dropped invalid select default for parameter "${paramName}"`,
            ),
          ],
        }
      }

      return { defaults: { [paramName]: value }, diagnostics: [] }
    }

    case 'table': {
      if (signature.objectShape === undefined) {
        return { defaults: { [paramName]: value }, diagnostics: [] }
      }

      if (value.kind !== 'object') {
        return {
          defaults: {},
          diagnostics: [
            createDiagnostic(
              'warning',
              'run-function-param-invalid-table-shape',
              paramName,
              `Dropped invalid table-shaped default for parameter "${paramName}"`,
            ),
          ],
        }
      }

      const normalizedEntries: Record<string, RunFunctionDefaultValue> = {}
      const diagnostics: RunFunctionNormalizationDiagnostic[] = []

      for (const [entryKey, entryValue] of Object.entries(value.entries)) {
        const childSignature = signature.objectShape.find(
          (candidate) => candidate.name === entryKey,
        )

        if (childSignature === undefined) {
          diagnostics.push(
            createDiagnostic(
              'warning',
              'run-function-param-invalid-table-shape',
              `${paramName}.${entryKey}`,
              `Dropped unknown table field "${entryKey}" for parameter "${paramName}"`,
            ),
          )
          continue
        }

        const normalizedChild = normalizeScalarForSignature(
          `${paramName}.${entryKey}`,
          entryValue,
          childSignature,
        )
        diagnostics.push(...normalizedChild.diagnostics)
        const normalizedValue =
          normalizedChild.defaults[`${paramName}.${entryKey}`]
        if (normalizedValue !== undefined) {
          normalizedEntries[entryKey] = normalizedValue
        }
      }

      return {
        defaults:
          Object.keys(normalizedEntries).length === 0
            ? {}
            : { [paramName]: { kind: 'object', entries: normalizedEntries } },
        diagnostics,
      }
    }

    case 'any':
    case 'buffer':
    case 'window':
    case 'void': {
      return { defaults: { [paramName]: value }, diagnostics: [] }
    }
  }
}

function collectSuspiciousOptsDiagnostics(
  functionLabel: string,
  paramName: string,
  value: RunFunctionDefaultValue,
): RunFunctionNormalizationDiagnostic[] {
  if (!functionLabel.startsWith('Snacks.picker.') || value.kind !== 'object') {
    return []
  }

  const diagnostics: RunFunctionNormalizationDiagnostic[] = []
  const suspiciousFieldPattern = /(width|height|count|limit|len)$/i

  const visit = (
    prefix: string,
    currentValue: RunFunctionDefaultValue,
  ): void => {
    if (currentValue.kind === 'object') {
      for (const [entryKey, entryValue] of Object.entries(
        currentValue.entries,
      )) {
        visit(`${prefix}.${entryKey}`, entryValue)
      }
      return
    }

    if (
      currentValue.kind === 'scalar' &&
      typeof currentValue.value === 'string' &&
      suspiciousFieldPattern.test(prefix)
    ) {
      diagnostics.push(
        createDiagnostic(
          'warning',
          'run-function-param-coerced',
          paramName,
          `Suspicious string default at "${prefix}" may need a numeric value`,
        ),
      )
    }
  }

  visit(paramName, value)
  return diagnostics
}

export function normalizeRunFunctionParamDefaults(
  input: NormalizeDefaultsInput,
): RunFunctionNormalizationResult {
  const defaults: Record<string, RunFunctionDefaultValue> = {}
  const diagnostics: RunFunctionNormalizationDiagnostic[] = []

  for (const [paramName, value] of Object.entries(input.paramDefaults)) {
    const signature = findSignatureForParamName(input.params, paramName)
    if (signature === undefined) {
      defaults[paramName] = value
      continue
    }

    const normalized = normalizeScalarForSignature(paramName, value, signature)
    diagnostics.push(...normalized.diagnostics)

    const normalizedValue = normalized.defaults[paramName]
    if (normalizedValue !== undefined) {
      defaults[paramName] = normalizedValue
      diagnostics.push(
        ...collectSuspiciousOptsDiagnostics(
          input.context.functionLabel,
          paramName,
          normalizedValue,
        ),
      )
    }
  }

  return { defaults, diagnostics }
}

function mergeStructuredAndOpts(
  paramDefaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  optsParamName: string = 'opts',
): {
  structuredOnly: Record<string, RunFunctionDefaultValue>
  opts: RunFunctionDefaultValue | undefined
  hasBoth: boolean
} {
  const opts = paramDefaults[optsParamName]
  const structuredOnly: Record<string, RunFunctionDefaultValue> = {}
  for (const [key, value] of Object.entries(paramDefaults)) {
    if (key !== optsParamName) {
      structuredOnly[key] = value
    }
  }

  return {
    structuredOnly,
    opts,
    hasBoth: Object.keys(structuredOnly).length > 0 && opts !== undefined,
  }
}

function buildStructuredTableLua(
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
): string {
  const grouped = groupDottedKeys(defaults)
  const pairs = Object.entries(grouped).map(
    ([key, value]) => `${key} = ${defaultToLua(value)}`,
  )
  return pairs.length === 0 ? '{}' : `{ ${pairs.join(', ')} }`
}

function isSnacksPickerSingleOptionsTemplate(luaCall: string): boolean {
  return /^Snacks\.picker\.[a-zA-Z0-9_]+\(\$params\)$/.test(luaCall)
}

function resolveParamLuaValue(
  paramName: string,
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues: Readonly<Record<string, string>>,
): string | undefined {
  const connectedValue = connectedValues[paramName]
  if (connectedValue !== undefined && connectedValue.length > 0) {
    return connectedValue
  }

  const defaultValue = defaults[paramName]
  return defaultValue === undefined ? undefined : defaultToLua(defaultValue)
}

function listResolvedParamKeys(
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues: Readonly<Record<string, string>>,
): string[] {
  return [
    ...new Set([...Object.keys(defaults), ...Object.keys(connectedValues)]),
  ]
}

function findNestedShapeSignatureForKey(
  params: readonly RunFunctionParamSignature[],
  paramKey: string,
): RunFunctionParamSignature | undefined {
  const [rootName, ...tail] = paramKey.split('.')
  if (rootName === undefined || tail.length === 0) {
    return undefined
  }

  const rootParam = findExactParam(params, rootName)
  return rootParam === undefined
    ? undefined
    : findNestedShapeParam(rootParam, tail)
}

function isDeclaredStructuredParamKey(
  params: readonly RunFunctionParamSignature[],
  paramKey: string,
): boolean {
  if (paramKey === 'opts') {
    return false
  }

  if (findExactParam(params, paramKey) !== undefined) {
    return true
  }

  return findNestedShapeSignatureForKey(params, paramKey) !== undefined
}

function hasConnectedLuaValue(
  paramName: string,
  connectedValues: Readonly<Record<string, string>>,
): boolean {
  const connectedValue = connectedValues[paramName]
  return connectedValue !== undefined && connectedValue.length > 0
}

export function hasResolvedValueForParam(
  param: RunFunctionParamSignature,
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues: Readonly<Record<string, string>>,
): boolean {
  if (hasConnectedLuaValue(param.name, connectedValues)) {
    return true
  }

  if (defaults[param.name] !== undefined) {
    return true
  }

  if (param.type !== 'table' || param.objectShape === undefined) {
    return false
  }

  const nestedPrefix = `${param.name}.`
  for (const paramKey of listResolvedParamKeys(defaults, connectedValues)) {
    if (!paramKey.startsWith(nestedPrefix)) {
      continue
    }

    const tail = paramKey.slice(nestedPrefix.length).split('.')
    if (findNestedShapeParam(param, tail) === undefined) {
      continue
    }

    if (
      resolveParamLuaValue(paramKey, defaults, connectedValues) !== undefined
    ) {
      return true
    }
  }

  return false
}

function collectStructuredPickerDefaults(
  params: readonly RunFunctionParamSignature[],
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues: Readonly<Record<string, string>>,
): Record<string, RunFunctionDefaultValue> {
  const resolvedDefaults: Record<string, RunFunctionDefaultValue> = {}
  const shadowedRoots = new Set<string>()

  for (const param of params) {
    if (param.name === 'opts') {
      continue
    }

    const luaValue = resolveParamLuaValue(param.name, defaults, connectedValues)
    if (luaValue !== undefined) {
      resolvedDefaults[param.name] = { kind: 'lua', lua: luaValue }
      if (!param.name.includes('.')) {
        shadowedRoots.add(param.name)
      }
    }
  }

  for (const paramKey of listResolvedParamKeys(defaults, connectedValues)) {
    if (!paramKey.includes('.') || resolvedDefaults[paramKey] !== undefined) {
      continue
    }

    if (!isDeclaredStructuredParamKey(params, paramKey)) {
      continue
    }

    const [rootName] = paramKey.split('.')
    if (rootName !== undefined && shadowedRoots.has(rootName)) {
      continue
    }

    const luaValue = resolveParamLuaValue(paramKey, defaults, connectedValues)
    if (luaValue !== undefined) {
      resolvedDefaults[paramKey] = { kind: 'lua', lua: luaValue }
    }
  }

  return resolvedDefaults
}

function composePickerOptionsExpression(
  params: readonly RunFunctionParamSignature[],
  defaults: Readonly<Record<string, RunFunctionDefaultValue>>,
  connectedValues: Readonly<Record<string, string>>,
): string {
  const structuredLua = buildStructuredTableLua(
    collectStructuredPickerDefaults(params, defaults, connectedValues),
  )
  const optsLua = resolveParamLuaValue('opts', defaults, connectedValues)

  if (structuredLua !== '{}' && optsLua !== undefined) {
    return `vim.tbl_extend("force", ${optsLua}, ${structuredLua})`
  }

  if (structuredLua !== '{}') {
    return structuredLua
  }

  return optsLua ?? '{}'
}

export function renderRunFunctionLua(
  input: RenderRunFunctionLuaInput,
): RenderRunFunctionLuaOutcome {
  const connectedValues = input.connectedValues ?? {}
  const defaultsForRender: Record<string, RunFunctionDefaultValue> = {
    ...input.paramDefaults,
  }

  const hasOptsParam = input.params.some((param) => param.name === 'opts')
  const usesOnlyOptsParam =
    input.params.length === 1 && input.params[0]?.name === 'opts'

  if (hasOptsParam && usesOnlyOptsParam) {
    const { structuredOnly, opts, hasBoth } =
      mergeStructuredAndOpts(defaultsForRender)
    if (hasBoth && opts?.kind === 'lua') {
      defaultsForRender['opts'] = {
        kind: 'lua',
        lua: `vim.tbl_extend("force", ${opts.lua}, ${buildStructuredTableLua(structuredOnly)})`,
      }
    } else if (Object.keys(structuredOnly).length > 0 && opts === undefined) {
      defaultsForRender['opts'] = {
        kind: 'lua',
        lua: buildStructuredTableLua(structuredOnly),
      }
    } else if (Object.keys(structuredOnly).length === 0 && opts === undefined) {
      defaultsForRender['opts'] = { kind: 'lua', lua: '{}' }
    }
  }

  if (isSnacksPickerSingleOptionsTemplate(input.luaCall)) {
    return {
      success: true,
      lua: input.luaCall.replace(
        '$params',
        composePickerOptionsExpression(
          input.params,
          defaultsForRender,
          connectedValues,
        ),
      ),
    }
  }

  if (
    input.positionalParamsMode === 'options-table' &&
    /\$params(?!\.)/.test(input.luaCall)
  ) {
    return {
      success: true,
      lua: input.luaCall.replace(
        /\$params(?!\.)/g,
        buildStructuredTableLua(defaultsForRender),
      ),
    }
  }

  const renderResult = renderTemplate(
    input.luaCall,
    input.params,
    defaultsForRender,
    connectedValues,
  )

  return renderResult.success
    ? { success: true, lua: renderResult.lua }
    : { success: false, error: renderResult.error }
}
