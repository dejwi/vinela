import type {
  PluginCategory,
  PluginConfigValue,
  PluginSchema,
  PortDataType,
  SchemaJsonValue,
  SchemaOption,
  SchemaOptionType,
} from '@/shared/types'
import {
  createError,
  PLUGIN_CATEGORIES,
  type ValidationError,
  type ValidationResult,
  type ValidationWarning,
  validationFailure,
  validationSuccess,
} from '@/shared/types'
import { validateTemplate } from './lua-template'
import {
  extractMappingTableTemplatePlaceholders,
  isSafeRawLuaIdentifier,
  validateMappingTableRowForEmit,
  validateMappingTableTemplatePlaceholders,
} from './schema-mapping-table'
import { buildSchemaOptionPathIndex } from './schema-option-paths'
import { validateSetupTemplate } from './setup-template'

// ============================================
// Constants
// ============================================

const VALID_OPTION_TYPES: ReadonlySet<SchemaOptionType> = new Set([
  'string',
  'number',
  'boolean',
  'select',
  'array',
  'mapping-table',
  'object',
  'color',
  'keysequence',
  'lua',
  'plugin-keymap',
])

const VALID_PORT_DATA_TYPES: ReadonlySet<PortDataType> = new Set([
  'any',
  'string',
  'number',
  'boolean',
  'buffer',
  'window',
  'table',
  'void',
])

const VALID_ARRAY_ITEM_TYPES: ReadonlySet<string> = new Set([
  'string',
  'number',
  'select',
])

const VALID_PARAM_EMISSION_UNSET_OPTIONAL: ReadonlySet<string> = new Set([
  'emit-nil',
  'omit-trailing',
])

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const RGB_COLOR_PATTERN = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/
const HSL_COLOR_PATTERN = /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/

interface RawSchemaRecord {
  id?: unknown
  pluginName?: unknown
  pluginRepo?: unknown
  version?: unknown
  pack?: unknown
  options?: unknown
  functions?: unknown
  dependencies?: unknown
  exCommands?: unknown
  exCommandTemplates?: unknown
  functionTemplates?: unknown
  setup?: unknown
  generationRules?: unknown
  capabilities?: unknown
  // Metadata fields
  author?: unknown
  stars?: unknown
  category?: unknown
  tags?: unknown
  tagline?: unknown
  iconUrl?: unknown
}

interface RawSchemaOptionRecord {
  key?: unknown
  emitKey?: unknown
  label?: unknown
  description?: unknown
  type?: unknown
  required?: unknown
  visibleWhen?: unknown
  enabledWhen?: unknown
  group?: unknown
  notices?: unknown
  defaultEmission?: unknown
  emit?: unknown
  multi?: unknown
  options?: unknown
  default?: unknown
  items?: unknown
  validation?: unknown
  properties?: unknown
  columns?: unknown
  conflictGroups?: unknown
}

interface RawSchemaGenerationRuleRecord {
  kind?: unknown
  scope?: unknown
  when?: unknown
  action?: unknown
  warnOnExplicitDescendants?: unknown
  message?: unknown
  mode?: unknown
  preserveKeys?: unknown
  left?: unknown
  right?: unknown
  severity?: unknown
}

interface RawSchemaEmitRecord {
  include?: unknown
  valueRule?: unknown
  stringRule?: unknown
  targetKey?: unknown
  keyColumn?: unknown
  valueColumn?: unknown
  valueTemplate?: unknown
  outputKeyMap?: unknown
}

interface RawSchemaColumnRecord {
  key?: unknown
  label?: unknown
  type?: unknown
  options?: unknown
  default?: unknown
  autoFill?: unknown
}

interface RawSchemaMappingTableAutoFillRecord {
  kind?: unknown
  sourceColumn?: unknown
  values?: unknown
  fallback?: unknown
}

interface RawSchemaConflictGroupRecord {
  column?: unknown
  values?: unknown
  severity?: unknown
  message?: unknown
}

interface RawSchemaConditionRecord {
  key?: unknown
  equals?: unknown
}

interface RawSchemaNoticeRecord {
  severity?: unknown
  surfaces?: unknown
  when?: unknown
  message?: unknown
  details?: unknown
  suggestions?: unknown
}

interface RawSchemaNoticeWhenRecord {
  kind?: unknown
  value?: unknown
}

interface RawSelectOptionRecord {
  value?: unknown
  label?: unknown
}

interface RawArrayItemsRecord {
  itemType?: unknown
  options?: unknown
}

interface RawRangeValidationRecord {
  min?: unknown
  max?: unknown
}

interface RawStringValidationRecord {
  pattern?: unknown
}

interface RawSchemaFunctionRecord {
  name?: unknown
  luaCall?: unknown
  params?: unknown
  returns?: unknown
  paramEmission?: unknown
  label?: unknown
  shortDescription?: unknown
  whatItDoes?: unknown
  technicalNote?: unknown
  isPopular?: unknown
  aliases?: unknown
  category?: unknown
  example?: unknown
  sourceDoc?: unknown
  relatedCommand?: unknown
}

interface RawSchemaFunctionTemplateRecord {
  key?: unknown
  baseFunctionName?: unknown
  label?: unknown
  shortDescription?: unknown
  whatItDoes?: unknown
  defaults?: unknown
  aliases?: unknown
  isPopular?: unknown
}

interface RawSchemaFunctionParamRecord {
  name?: unknown
  type?: unknown
}

interface RawSchemaExCommandRecord {
  name?: unknown
  description?: unknown
  template?: unknown
  example?: unknown
  sourceDoc?: unknown
  params?: unknown
  label?: unknown
  shortDescription?: unknown
  category?: unknown
  whatItDoes?: unknown
  technicalNote?: unknown
  isPopular?: unknown
  aliases?: unknown
}

interface RawSchemaExCommandParamRecord {
  name?: unknown
  label?: unknown
  placeholder?: unknown
  description?: unknown
  type?: unknown
  optional?: unknown
  defaultValue?: unknown
  allowedValues?: unknown
  allowedValueDescriptions?: unknown
  tier?: unknown
  group?: unknown
  escape?: unknown
  emit?: unknown
}

interface RawSchemaExCommandTemplateRecord {
  key?: unknown
  baseCommandName?: unknown
  label?: unknown
  shortDescription?: unknown
  defaults?: unknown
  example?: unknown
  whatItDoes?: unknown
  aliases?: unknown
  isPopular?: unknown
}

// ============================================
// Schema Validation (meta-schema)
// ============================================

/**
 * Validate a PluginSchema definition is well-formed.
 * Checks required fields, option type correctness, function definitions, etc.
 */
export function validateSchema(schema: unknown): ValidationResult {
  if (typeof schema !== 'object' || schema === null) {
    return validationFailure([
      createError('Schema must be a JSON object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    ])
  }

  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const s = schema as RawSchemaRecord

  validateSchemaRequiredFields(s, errors)
  validateSchemaOptionsField(s.options, errors)
  validateSchemaFunctionsField(s.functions, errors)
  validateSchemaDependenciesField(s.dependencies, s.id, errors)
  validateSchemaPackField(s.pack, errors)
  validateSchemaExCommandsField(s.exCommands, errors)
  validateSchemaExCommandTemplatesField(
    s.exCommandTemplates,
    s.exCommands,
    errors,
  )
  validateSchemaFunctionTemplatesField(s.functionTemplates, s.functions, errors)
  validateSchemaSetupField(s.setup, errors)
  validateSchemaGenerationRulesField(s.generationRules, s.options, errors)
  validateSchemaCapabilitiesField(s.capabilities, errors)
  validateSchemaMetadataFields(s, errors)

  if (errors.length > 0) {
    return validationFailure(errors, warnings)
  }
  return validationSuccess()
}

function validateSchemaPackField(
  pack: unknown,
  errors: ValidationError[],
): void {
  if (pack === undefined || pack === null) {
    return
  }

  if (typeof pack !== 'object' || Array.isArray(pack)) {
    errors.push(
      createError('"pack" must be an object', { code: 'INVALID_FIELD_TYPE' }),
    )
    return
  }

  const rawPack = pack as Record<string, unknown>

  if (
    rawPack['name'] !== undefined &&
    (typeof rawPack['name'] !== 'string' || rawPack['name'].trim().length === 0)
  ) {
    errors.push(
      createError('pack.name must be a non-empty string when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  const rawVersion = rawPack['version']
  if (rawVersion === undefined || rawVersion === null) {
    return
  }

  if (typeof rawVersion !== 'object' || Array.isArray(rawVersion)) {
    errors.push(
      createError('pack.version must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const versionRecord = rawVersion as Record<string, unknown>
  const mode = versionRecord['mode']
  const value = versionRecord['value']

  if (mode !== 'ref' && mode !== 'semver-range') {
    errors.push(
      createError('pack.version.mode must be "ref" or "semver-range"', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(
      createError('pack.version.value must be a non-empty string', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

// ============================================
// Setup Field Validation
// ============================================

/**
 * Validate the optional 'setup' field on a schema.
 */
function validateSchemaSetupField(
  setup: unknown,
  errors: ValidationError[],
): void {
  if (setup === undefined || setup === null) {
    return // Optional field, absence is valid
  }

  if (typeof setup !== 'object' || Array.isArray(setup)) {
    errors.push(
      createError('setup must be an object', { code: 'INVALID_FIELD_TYPE' }),
    )
    return
  }

  const s = setup as Record<string, unknown>

  // requirePath is required within setup
  if (
    typeof s['requirePath'] !== 'string' ||
    s['requirePath'].trim().length === 0
  ) {
    errors.push(
      createError(
        'setup.requirePath is required and must be a non-empty string',
        {
          code: 'MISSING_REQUIRED_FIELD',
        },
      ),
    )
  }

  // setupFunction is optional, must be non-empty string if present
  if (s['setupFunction'] !== undefined) {
    if (
      typeof s['setupFunction'] !== 'string' ||
      s['setupFunction'].trim().length === 0
    ) {
      errors.push(
        createError('setup.setupFunction must be a non-empty string', {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
  }

  // optionMapping is optional, must be 'table' or 'individual'
  if (s['optionMapping'] !== undefined) {
    if (s['optionMapping'] !== 'table' && s['optionMapping'] !== 'individual') {
      errors.push(
        createError("setup.optionMapping must be 'table' or 'individual'", {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
  }

  // preSetup is optional, must be string if present
  if (s['preSetup'] !== undefined && typeof s['preSetup'] !== 'string') {
    errors.push(
      createError('setup.preSetup must be a string', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  // postSetup is optional, must be string if present
  if (s['postSetup'] !== undefined && typeof s['postSetup'] !== 'string') {
    errors.push(
      createError('setup.postSetup must be a string', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  const hasRender = s['render'] !== undefined
  if (hasRender) {
    validateSchemaSetupRenderField(s['render'], errors)

    if (s['setupFunction'] !== undefined) {
      errors.push(
        createError(
          'setup.setupFunction cannot be used together with setup.render',
          { code: 'INVALID_FIELD_TYPE' },
        ),
      )
    }
    if (s['optionMapping'] !== undefined) {
      errors.push(
        createError(
          'setup.optionMapping cannot be used together with setup.render',
          { code: 'INVALID_FIELD_TYPE' },
        ),
      )
    }
  }
}

function validateSchemaSetupRenderField(
  render: unknown,
  errors: ValidationError[],
): void {
  if (typeof render !== 'object' || render === null || Array.isArray(render)) {
    errors.push(
      createError('setup.render must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const r = render as Record<string, unknown>
  if (r['kind'] !== 'lua-template') {
    errors.push(
      createError("setup.render.kind must be 'lua-template'", {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  if (typeof r['template'] !== 'string' || r['template'].trim().length === 0) {
    errors.push(
      createError('setup.render.template must be a non-empty string', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  for (const templateError of validateSetupTemplate(r['template'])) {
    errors.push(
      createError(templateError.message, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function collectSchemaOptionKeys(options: unknown): Set<string> {
  if (!Array.isArray(options)) {
    return new Set<string>()
  }

  const pathIndex = buildSchemaOptionPathIndex(
    options as RawSchemaOptionRecord[],
    {
      getKey: (option) =>
        typeof option.key === 'string' && option.key.trim().length > 0
          ? option.key
          : undefined,
      getEmitKey: (option) =>
        typeof option.emitKey === 'string' && option.emitKey.trim().length > 0
          ? option.emitKey
          : undefined,
      isObjectOption: (option) =>
        option.type === 'object' && Array.isArray(option.properties),
      getProperties: (option) =>
        Array.isArray(option.properties)
          ? (option.properties as RawSchemaOptionRecord[])
          : [],
    },
  )

  const keys = new Set<string>()
  for (const entry of pathIndex.entries) {
    keys.add(entry.schemaPath)
  }
  return keys
}

function validateSchemaGenerationRulesField(
  rules: unknown,
  options: unknown,
  errors: ValidationError[],
): void {
  if (rules === undefined) {
    return
  }

  if (!Array.isArray(rules)) {
    errors.push(
      createError('generationRules must be an array when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const optionKeys = collectSchemaOptionKeys(options)
  for (const [index, rule] of rules.entries()) {
    validateSchemaGenerationRule(rule, optionKeys, index, errors)
  }
}

function validateSchemaGenerationRule(
  rule: unknown,
  optionKeys: ReadonlySet<string>,
  index: number,
  errors: ValidationError[],
): void {
  const prefix = `generationRules[${String(index)}]`
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const rawRule = rule as RawSchemaGenerationRuleRecord
  if (
    rawRule.kind !== 'conflict' &&
    rawRule.kind !== 'subtree-gate' &&
    rawRule.kind !== 'subtree-filter'
  ) {
    errors.push(
      createError(`${prefix}.kind is invalid`, { code: 'INVALID_FIELD_TYPE' }),
    )
    return
  }

  if (rawRule.kind === 'conflict') {
    validateRuleKeyReference(rawRule.left, optionKeys, `${prefix}.left`, errors)
    validateRuleKeyReference(
      rawRule.right,
      optionKeys,
      `${prefix}.right`,
      errors,
    )
    if (rawRule.severity !== 'warning' && rawRule.severity !== 'error') {
      errors.push(
        createError(`${prefix}.severity must be "warning" or "error"`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    if (
      rawRule.when !== undefined &&
      rawRule.when !== 'both-explicit' &&
      rawRule.when !== 'both-meaningful'
    ) {
      errors.push(
        createError(`${prefix}.when is invalid`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    validateOptionalNonEmptyString(
      rawRule.message,
      `${prefix}.message must be a non-empty string`,
      errors,
    )
    return
  }

  validateNonEmptyDotPath(rawRule.scope, `${prefix}.scope`, errors)

  if (rawRule.kind === 'subtree-gate') {
    if (rawRule.action !== 'omit-subtree') {
      errors.push(
        createError(`${prefix}.action must be "omit-subtree"`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    validateOptionalBoolean(
      rawRule.warnOnExplicitDescendants,
      `${prefix}.warnOnExplicitDescendants must be a boolean when provided`,
      errors,
    )
    validateOptionalNonEmptyString(
      rawRule.message,
      `${prefix}.message must be a non-empty string when provided`,
      errors,
    )
    validateSchemaOptionCondition(rawRule.when, 'visibleWhen', errors)
    if (typeof rawRule.when === 'object' && rawRule.when !== null) {
      validateRuleKeyReference(
        (rawRule.when as RawSchemaConditionRecord).key,
        optionKeys,
        `${prefix}.when.key`,
        errors,
      )
    }
    return
  }

  if (rawRule.mode !== 'meaningful-only') {
    errors.push(
      createError(`${prefix}.mode must be "meaningful-only"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  if (rawRule.preserveKeys !== undefined) {
    validateOptionalStringArray(
      rawRule.preserveKeys,
      `${prefix}.preserveKeys`,
      `${prefix}.preserveKeys must be an array of non-empty strings when provided`,
      errors,
    )
  }
}

function validateSchemaCapabilitiesField(
  capabilities: unknown,
  errors: ValidationError[],
): void {
  if (capabilities === undefined) {
    return
  }

  if (!Array.isArray(capabilities)) {
    errors.push(
      createError('capabilities must be an array when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  for (const [index, capability] of capabilities.entries()) {
    const prefix = `capabilities[${String(index)}]`
    if (
      typeof capability !== 'object' ||
      capability === null ||
      Array.isArray(capability)
    ) {
      errors.push(
        createError(`${prefix} must be an object`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
      continue
    }

    const record = capability as Record<string, unknown>
    if (record['kind'] === 'lsp-package-installer') {
      if (record['provider'] !== 'mason-registry') {
        errors.push(
          createError(`${prefix}.provider must be "mason-registry"`, {
            code: 'INVALID_FIELD_TYPE',
          }),
        )
      }
      continue
    }

    if (record['kind'] === 'lsp-server-enabler') {
      if (record['api'] !== 'vim.lsp.enable') {
        errors.push(
          createError(`${prefix}.api must be "vim.lsp.enable"`, {
            code: 'INVALID_FIELD_TYPE',
          }),
        )
      }
      validateOptionalNonEmptyString(
        record['minNvimVersion'],
        `${prefix}.minNvimVersion must be a non-empty string`,
        errors,
      )
      continue
    }

    errors.push(
      createError(`${prefix}.kind is invalid`, { code: 'INVALID_FIELD_TYPE' }),
    )
  }
}

function validateRuleKeyReference(
  value: unknown,
  optionKeys: ReadonlySet<string>,
  fieldName: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(
      createError(`${fieldName} must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  if (!optionKeys.has(value)) {
    errors.push(
      createError(`${fieldName} must reference an existing schema option key`, {
        code: 'INVALID_VALIDATION_RULE',
      }),
    )
  }
}

function validateNonEmptyDotPath(
  value: unknown,
  fieldName: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(
      createError(`${fieldName} must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

// ============================================
// Metadata Field Validation
// ============================================

const VALID_PLUGIN_CATEGORIES: ReadonlySet<PluginCategory> = new Set(
  PLUGIN_CATEGORIES,
)

const URL_PATTERN = /^https?:\/\/.+/

function validateOptionalUrl(
  value: unknown,
  fieldName: string,
  errors: ValidationError[],
): void {
  if (value === undefined) return
  if (typeof value !== 'string' || value === '') {
    errors.push(
      createError(`"${fieldName}" must be a non-empty string when provided`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else if (!URL_PATTERN.test(value)) {
    errors.push(
      createError(`"${fieldName}" must be a valid URL (http:// or https://)`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateOptionalNonNegativeInteger(
  value: unknown,
  fieldName: string,
  errors: ValidationError[],
): void {
  if (value === undefined) return
  if (typeof value !== 'number') {
    errors.push(
      createError(`"${fieldName}" must be a number when provided`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else if (!Number.isInteger(value)) {
    errors.push(
      createError(`"${fieldName}" must be an integer`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else if (value < 0) {
    errors.push(
      createError(`"${fieldName}" must be a non-negative integer`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateOptionalBoundedString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  errors: ValidationError[],
): void {
  if (value === undefined) return
  if (typeof value !== 'string' || value === '') {
    errors.push(
      createError(`"${fieldName}" must be a non-empty string when provided`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else if (value.length > maxLength) {
    errors.push(
      createError(`"${fieldName}" must be ${maxLength} characters or fewer`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateOptionalPluginCategory(
  value: unknown,
  errors: ValidationError[],
): void {
  if (value === undefined) return
  if (
    typeof value !== 'string' ||
    !VALID_PLUGIN_CATEGORIES.has(value as PluginCategory)
  ) {
    errors.push(
      createError(
        `"category" must be one of: ${[...VALID_PLUGIN_CATEGORIES].join(', ')}`,
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
  }
}

function validateSchemaMetadataFields(
  schema: RawSchemaRecord,
  errors: ValidationError[],
): void {
  validateOptionalNonEmptyString(
    schema.author,
    '"author" must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonNegativeInteger(schema.stars, 'stars', errors)
  validateOptionalPluginCategory(schema.category, errors)
  validateOptionalStringArray(
    schema.tags,
    'tags',
    '"tags" must be an array of strings when provided',
    errors,
  )
  validateOptionalBoundedString(schema.tagline, 'tagline', 120, errors)
  validateOptionalUrl(schema.iconUrl, 'iconUrl', errors)
}

function validateSchemaRequiredFields(
  schema: RawSchemaRecord,
  errors: ValidationError[],
): void {
  validateRequiredNonEmptyStringField(
    schema.id,
    'Schema must have a non-empty "id" field',
    errors,
  )
  validateRequiredNonEmptyStringField(
    schema.pluginName,
    'Schema must have a non-empty "pluginName" field',
    errors,
  )
  validateRequiredNonEmptyStringField(
    schema.pluginRepo,
    'Schema must have a non-empty "pluginRepo" field',
    errors,
  )
  validateRequiredNonEmptyStringField(
    schema.version,
    'Schema must have a non-empty "version" field',
    errors,
  )
}

function validateRequiredNonEmptyStringField(
  value: unknown,
  message: string,
  errors: ValidationError[],
): void {
  if (typeof value === 'string' && value !== '') {
    return
  }

  errors.push(
    createError(message, {
      code: 'MISSING_REQUIRED_FIELD',
    }),
  )
}

function validateSchemaOptionsField(
  options: unknown,
  errors: ValidationError[],
): void {
  if (!Array.isArray(options)) {
    errors.push(
      createError('"options" must be an array', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const keys = new Set<string>()
  for (const opt of options) {
    errors.push(...validateSchemaOption(opt, keys))
  }
}

function validateSchemaFunctionsField(
  functions: unknown,
  errors: ValidationError[],
): void {
  if (!Array.isArray(functions)) {
    errors.push(
      createError('"functions" must be an array', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const seenFunctionNames = new Set<string>()
  for (const fn of functions) {
    errors.push(...validateSchemaFunction(fn, seenFunctionNames))
  }
}

function validateSchemaDependenciesField(
  dependencies: unknown,
  schemaId: unknown,
  errors: ValidationError[],
): void {
  if (dependencies === undefined) {
    return
  }

  if (!Array.isArray(dependencies)) {
    errors.push(
      createError('"dependencies" must be an array of strings', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  for (const dep of dependencies) {
    if (typeof dep !== 'string') {
      errors.push(
        createError('Each dependency must be a string', {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
      continue
    }

    if (typeof schemaId === 'string' && dep === schemaId) {
      errors.push(
        createError('Plugin cannot depend on itself', {
          code: 'CIRCULAR_DEPENDENCY',
        }),
      )
    }
  }
}

function validateSchemaExCommandsField(
  exCommands: unknown,
  errors: ValidationError[],
): void {
  // exCommands is optional — skip if absent
  if (exCommands === undefined) {
    return
  }

  if (!Array.isArray(exCommands)) {
    errors.push(
      createError('"exCommands" must be an array', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const seenNames = new Set<string>()
  for (const [index, cmd] of exCommands.entries()) {
    errors.push(...validateSchemaExCommand(cmd, index, seenNames))
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Ex-command validation with required field checks, param validation, and template placeholder matching
function validateSchemaExCommand(
  cmd: unknown,
  index: number,
  seenNames: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = `exCommands[${String(index)}]`

  if (typeof cmd !== 'object' || cmd === null) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const c = cmd as RawSchemaExCommandRecord

  // Required string fields
  if (typeof c.name !== 'string' || c.name === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "name" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    if (seenNames.has(c.name)) {
      errors.push(
        createError(`${prefix} has duplicate name "${c.name}"`, {
          code: 'DUPLICATE_EX_COMMAND_NAME',
        }),
      )
    }
    seenNames.add(c.name)
  }

  if (typeof c.description !== 'string' || c.description === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "description" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof c.template !== 'string' || c.template === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "template" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof c.example !== 'string' || c.example === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "example" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof c.sourceDoc !== 'string' || c.sourceDoc === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "sourceDoc" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  // Optional params validation
  if (c.params !== undefined) {
    if (!Array.isArray(c.params)) {
      errors.push(
        createError(`${prefix}.params must be an array`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    } else {
      for (const [pIndex, param] of (c.params as unknown[]).entries()) {
        errors.push(
          ...validateSchemaExCommandParam(
            param,
            `${prefix}.params[${String(pIndex)}]`,
          ),
        )
      }

      // Optional: warn if template placeholders don't match param names
      if (typeof c.template === 'string') {
        const templatePlaceholders = new Set(
          [...c.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]),
        )
        for (const param of c.params as unknown[]) {
          if (
            typeof param === 'object' &&
            param !== null &&
            typeof (param as RawSchemaExCommandParamRecord).name === 'string'
          ) {
            const paramName = (param as RawSchemaExCommandParamRecord)
              .name as string
            if (!templatePlaceholders.has(paramName)) {
              errors.push(
                createError(
                  `${prefix} param "${paramName}" has no matching {${paramName}} placeholder in template`,
                  { code: 'INVALID_EX_COMMAND_TEMPLATE' },
                ),
              )
            }
          }
        }
      }
    }
  }

  // Optional display/catalog field validation
  validateExCommandOptionalFields(c, prefix, errors)

  return errors
}

function validateExCommandOptionalFields(
  c: RawSchemaExCommandRecord,
  prefix: string,
  errors: ValidationError[],
): void {
  validateOptionalNonEmptyString(
    c.label,
    `${prefix}.label must be a non-empty string when provided`,
    errors,
  )
  validateOptionalNonEmptyString(
    c.shortDescription,
    `${prefix}.shortDescription must be a non-empty string when provided`,
    errors,
  )
  validateOptionalNonEmptyString(
    c.category,
    `${prefix}.category must be a non-empty string when provided`,
    errors,
  )
  validateOptionalNonEmptyString(
    c.whatItDoes,
    `${prefix}.whatItDoes must be a non-empty string when provided`,
    errors,
  )
  validateOptionalNonEmptyString(
    c.technicalNote,
    `${prefix}.technicalNote must be a non-empty string when provided`,
    errors,
  )
  validateOptionalBoolean(
    c.isPopular,
    `${prefix}.isPopular must be a boolean when provided`,
    errors,
  )
  validateOptionalStringArray(
    c.aliases,
    `${prefix}.aliases`,
    `${prefix}.aliases must be an array of non-empty strings when provided`,
    errors,
  )
}

function validateSchemaExCommandParam(
  param: unknown,
  prefix: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof param !== 'object' || param === null) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const p = param as RawSchemaExCommandParamRecord

  if (typeof p.name !== 'string' || p.name === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "name" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof p.placeholder !== 'string') {
    errors.push(
      createError(`${prefix} must have a "placeholder" string field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof p.description !== 'string' || p.description === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "description" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }
  validateExCommandParamMetadata(p, prefix, errors)
  validateExCommandParamValues(p, prefix, errors)

  return errors
}

function validateExCommandParamMetadata(
  param: RawSchemaExCommandParamRecord,
  prefix: string,
  errors: ValidationError[],
): void {
  validateOptionalNonEmptyString(
    param.label,
    `${prefix}.label must be a non-empty string`,
    errors,
  )
  validateOptionalBoolean(
    param.optional,
    `${prefix}.optional must be a boolean`,
    errors,
  )
  validateOptionalNonEmptyString(
    param.tier,
    `${prefix}.tier must be a non-empty string`,
    errors,
  )
  if (
    param.tier !== undefined &&
    param.tier !== 'basic' &&
    param.tier !== 'advanced'
  ) {
    errors.push(
      createError(`${prefix}.tier is invalid`, { code: 'INVALID_FIELD_TYPE' }),
    )
  }
  validateOptionalNonEmptyString(
    param.group,
    `${prefix}.group must be a non-empty string`,
    errors,
  )
  if (
    param.defaultValue !== undefined &&
    typeof param.defaultValue !== 'string' &&
    typeof param.defaultValue !== 'number' &&
    typeof param.defaultValue !== 'boolean'
  ) {
    errors.push(
      createError(`${prefix}.defaultValue must be a scalar`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  if (param.escape !== undefined && param.escape !== 'ex-argument') {
    errors.push(
      createError(`${prefix}.escape is invalid`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateExCommandParamValues(
  param: RawSchemaExCommandParamRecord,
  prefix: string,
  errors: ValidationError[],
): void {
  const type = param.type ?? 'string'
  const validType = [
    'string',
    'number',
    'boolean',
    'file-path',
    'directory-path',
    'select',
  ].includes(String(type))
  if (!validType)
    errors.push(
      createError(`${prefix}.type is invalid`, { code: 'INVALID_FIELD_TYPE' }),
    )
  if (type === 'select' && !Array.isArray(param.allowedValues)) {
    errors.push(
      createError(`${prefix}.allowedValues is required for select`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }
  if (type !== 'select' && param.allowedValues !== undefined) {
    errors.push(
      createError(`${prefix}.allowedValues is only valid for select`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  if (!isStringArray(param.allowedValues)) {
    errors.push(
      createError(`${prefix}.allowedValues must be strings`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  validateExCommandAllowedDescriptions(param, prefix, errors)
  validateExCommandDefaultValue(param, type, prefix, errors)
  validateExCommandEmit(param.emit, type, prefix, errors)
}

function isStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  )
}

function validateExCommandAllowedDescriptions(
  param: RawSchemaExCommandParamRecord,
  prefix: string,
  errors: ValidationError[],
): void {
  if (param.allowedValueDescriptions === undefined) return
  if (
    typeof param.allowedValueDescriptions !== 'object' ||
    param.allowedValueDescriptions === null ||
    Array.isArray(param.allowedValueDescriptions)
  ) {
    errors.push(
      createError(`${prefix}.allowedValueDescriptions must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }
  for (const [key, description] of Object.entries(
    param.allowedValueDescriptions,
  )) {
    if (
      !Array.isArray(param.allowedValues) ||
      !param.allowedValues.includes(key) ||
      typeof description !== 'string'
    ) {
      errors.push(
        createError(`${prefix}.allowedValueDescriptions is invalid`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
  }
}

function validateExCommandDefaultValue(
  param: RawSchemaExCommandParamRecord,
  type: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (param.defaultValue === undefined) return
  if (
    (type === 'number' && typeof param.defaultValue !== 'number') ||
    (type === 'boolean' && typeof param.defaultValue !== 'boolean') ||
    (type !== 'number' &&
      type !== 'boolean' &&
      typeof param.defaultValue !== 'string') ||
    (type === 'select' &&
      (!Array.isArray(param.allowedValues) ||
        !param.allowedValues.includes(param.defaultValue as string)))
  ) {
    errors.push(
      createError(`${prefix}.defaultValue is invalid`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateExCommandEmit(
  emit: unknown,
  type: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (emit === undefined) return
  if (typeof emit !== 'object' || emit === null || Array.isArray(emit)) {
    errors.push(
      createError(`${prefix}.emit is invalid`, { code: 'INVALID_FIELD_TYPE' }),
    )
    return
  }
  const record = emit as { kind?: unknown; token?: unknown; prefix?: unknown }
  if (record.kind === 'value' && Object.keys(record).length === 1) return
  if (
    record.kind === 'flag' &&
    typeof record.token === 'string' &&
    record.token !== '' &&
    Object.keys(record).length === 2 &&
    type === 'boolean'
  )
    return
  if (
    record.kind === 'option' &&
    typeof record.prefix === 'string' &&
    record.prefix !== '' &&
    Object.keys(record).length === 2 &&
    type !== 'boolean'
  )
    return
  errors.push(
    createError(`${prefix}.emit is invalid`, { code: 'INVALID_FIELD_TYPE' }),
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: template validation checks each required cross-field compatibility rule.
function validateSchemaExCommandTemplatesField(
  templates: unknown,
  commands: unknown,
  errors: ValidationError[],
): void {
  if (templates === undefined) return
  if (!Array.isArray(templates) || !Array.isArray(commands)) {
    errors.push(
      createError('"exCommandTemplates" must be an array with exCommands', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }
  const byName = new Map(
    commands
      .filter(
        (command): command is RawSchemaExCommandRecord =>
          typeof command === 'object' &&
          command !== null &&
          typeof (command as RawSchemaExCommandRecord).name === 'string',
      )
      .map((command) => [command.name as string, command]),
  )
  const keys = new Set<string>()
  for (const [index, template] of templates.entries()) {
    const prefix = `exCommandTemplates[${String(index)}]`
    if (typeof template !== 'object' || template === null) {
      errors.push(
        createError(`${prefix} must be an object`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
      continue
    }
    const t = template as RawSchemaExCommandTemplateRecord
    if (typeof t.key !== 'string' || t.key === '' || keys.has(t.key))
      errors.push(
        createError(`${prefix}.key must be unique`, {
          code: 'DUPLICATE_EX_COMMAND_TEMPLATE_KEY',
        }),
      )
    if (typeof t.key === 'string') keys.add(t.key)
    validateRequiredNonEmptyStringField(
      t.label,
      `${prefix}.label must be a non-empty string`,
      errors,
    )
    validateRequiredNonEmptyStringField(
      t.shortDescription,
      `${prefix}.shortDescription must be a non-empty string`,
      errors,
    )
    validateOptionalNonEmptyString(
      t.example,
      `${prefix}.example must be a non-empty string when provided`,
      errors,
    )
    if (t.whatItDoes !== undefined && typeof t.whatItDoes !== 'string') {
      errors.push(
        createError(`${prefix}.whatItDoes must be a string when provided`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    validateOptionalStringArray(
      t.aliases,
      `${prefix}.aliases`,
      `${prefix}.aliases must be an array of non-empty strings when provided`,
      errors,
    )
    validateOptionalBoolean(
      t.isPopular,
      `${prefix}.isPopular must be a boolean when provided`,
      errors,
    )
    const base =
      typeof t.baseCommandName === 'string'
        ? byName.get(t.baseCommandName)
        : undefined
    if (!base) {
      errors.push(
        createError(`${prefix}.baseCommandName must reference an Ex command`, {
          code: 'INVALID_EX_COMMAND_TEMPLATE',
        }),
      )
      continue
    }
    if (
      typeof t.defaults !== 'object' ||
      t.defaults === null ||
      Array.isArray(t.defaults)
    ) {
      errors.push(
        createError(`${prefix}.defaults must be an object`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
      continue
    }
    const rawParams: unknown[] = Array.isArray(base.params) ? base.params : []
    const params = new Map(
      rawParams
        .filter(
          (param): param is RawSchemaExCommandParamRecord =>
            typeof param === 'object' && param !== null,
        )
        .map((param) => [param.name, param]),
    )
    for (const [name, value] of Object.entries(t.defaults)) {
      const param = params.get(name)
      if (!param || !isExCommandDefaultCompatible(value, param))
        errors.push(
          createError(`${prefix}.defaults.${name} is invalid`, {
            code: 'INVALID_EX_COMMAND_TEMPLATE',
          }),
        )
    }
  }
}

function isExCommandDefaultCompatible(
  value: unknown,
  param: RawSchemaExCommandParamRecord,
): boolean {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  )
    return false
  const type = param.type ?? 'string'
  if (type === 'number') return typeof value === 'number'
  if (type === 'boolean') return typeof value === 'boolean'
  return (
    typeof value === 'string' &&
    (!Array.isArray(param.allowedValues) || param.allowedValues.includes(value))
  )
}

/**
 * Validate a single schema option definition.
 * Checks required fields, type-specific constraints, and duplicate keys.
 */
function validateSchemaOption(
  opt: unknown,
  seenKeys: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof opt !== 'object' || opt === null) {
    errors.push(
      createError('Each option must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const o = opt as RawSchemaOptionRecord

  // Required fields
  if (typeof o.key !== 'string' || o.key === '') {
    errors.push(
      createError('Option must have a non-empty "key" field', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    if (seenKeys.has(o.key as string)) {
      errors.push(
        createError(`Duplicate option key: "${o.key as string}"`, {
          code: 'DUPLICATE_OPTION_KEY',
        }),
      )
    }
    seenKeys.add(o.key as string)
  }

  if (typeof o.label !== 'string' || o.label === '') {
    errors.push(
      createError('Option must have a non-empty "label" field', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (
    typeof o.type !== 'string' ||
    !VALID_OPTION_TYPES.has(o.type as SchemaOptionType)
  ) {
    errors.push(
      createError(`Invalid option type: "${String(o.type)}"`, {
        code: 'INVALID_OPTION_TYPE',
      }),
    )
    return errors // Can't validate further without valid type
  }

  const optType = o.type as SchemaOptionType

  validateSchemaOptionMetadata(o, optType, errors)

  // Type-specific validation
  switch (optType) {
    case 'select':
      validateSelectOption(o, errors)
      break
    case 'array':
      validateArrayOption(o, errors)
      break
    case 'mapping-table':
      validateMappingTableOption(o, errors)
      break
    case 'object':
      validateObjectOption(o, errors)
      break
    case 'number':
      validateNumberOption(o, errors)
      break
    case 'string':
      validateStringOption(o, errors)
      break
    case 'boolean':
      validateBooleanOption(o, errors)
      break
    case 'color':
      validateColorOption(o, errors)
      break
    case 'keysequence':
    case 'lua':
      validateStringTypeDefault(o, errors)
      break
    case 'plugin-keymap':
      validatePluginKeymapOption(o, errors)
      break
  }

  return errors
}

function validateSchemaOptionMetadata(
  option: RawSchemaOptionRecord,
  optionType: SchemaOptionType,
  errors: ValidationError[],
): void {
  validateOptionalNonEmptyString(
    option.emitKey,
    'Option emitKey must be a non-empty string when provided',
    errors,
  )
  if (
    option.description !== undefined &&
    typeof option.description !== 'string'
  ) {
    errors.push(
      createError('Option description must be a string when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  validateOptionalBoolean(
    option.required,
    'Option required must be a boolean when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    option.group,
    'Option group must be a non-empty string when provided',
    errors,
  )
  validateSchemaOptionCondition(option.visibleWhen, 'visibleWhen', errors)
  validateSchemaOptionCondition(option.enabledWhen, 'enabledWhen', errors)
  validateSchemaOptionNotices(option.notices, errors)
  validateSchemaOptionEmit(option.emit, optionType, errors)

  if (
    option.defaultEmission !== undefined &&
    option.defaultEmission !== 'emit' &&
    option.defaultEmission !== 'explicit-only'
  ) {
    errors.push(
      createError(
        'Option defaultEmission must be "emit" or "explicit-only" when provided',
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
  }
}

function validateSchemaOptionEmitInclude(
  include: unknown,
  errors: ValidationError[],
): void {
  if (include === undefined) {
    return
  }

  if (
    typeof include !== 'object' ||
    include === null ||
    ((include as { kind?: unknown }).kind !== 'always' &&
      (include as { kind?: unknown }).kind !== 'explicit-only' &&
      (include as { kind?: unknown }).kind !== 'non-default' &&
      (include as { kind?: unknown }).kind !== 'non-empty')
  ) {
    errors.push(
      createError('Option emit.include.kind is invalid', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateSchemaOptionEmitValueRule(
  valueRule: unknown,
  errors: ValidationError[],
): void {
  if (valueRule === undefined) {
    return
  }

  const record = valueRule as {
    kind?: unknown
    values?: unknown
    onUnknown?: unknown
  }

  if (record.kind !== 'value-map') {
    errors.push(
      createError('Option emit.valueRule.kind must be "value-map"', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  if (
    typeof record.values !== 'object' ||
    record.values === null ||
    Array.isArray(record.values)
  ) {
    errors.push(
      createError('Option emit.valueRule.values must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else {
    for (const [key, mappedValue] of Object.entries(record.values)) {
      if (key.trim().length === 0) {
        errors.push(
          createError('Option emit.valueRule.values keys must be non-empty', {
            code: 'INVALID_FIELD_TYPE',
          }),
        )
      }
      validateSchemaLuaValue(mappedValue, errors)
    }
  }
  if (
    record.onUnknown !== undefined &&
    record.onUnknown !== 'omit' &&
    record.onUnknown !== 'emit-original' &&
    record.onUnknown !== 'warn-and-omit'
  ) {
    errors.push(
      createError('Option emit.valueRule.onUnknown is invalid', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateSchemaOptionEmitStringRule(
  stringRule: unknown,
  optionType: SchemaOptionType,
  errors: ValidationError[],
): void {
  if (stringRule === undefined) {
    return
  }

  const record = stringRule as {
    kind?: unknown
    trim?: unknown
    omitWhenEmpty?: unknown
    expandWithVimFnExpand?: unknown
    warnWhenRelative?: unknown
  }

  if (optionType !== 'string') {
    errors.push(
      createError(
        'Option emit.stringRule is only supported on string options',
        {
          code: 'INVALID_FIELD_TYPE',
        },
      ),
    )
  }
  if (record.kind !== 'path') {
    errors.push(
      createError('Option emit.stringRule.kind must be "path"', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  validateOptionalBoolean(
    record.trim,
    'Option emit.stringRule.trim must be a boolean when provided',
    errors,
  )
  validateOptionalBoolean(
    record.omitWhenEmpty,
    'Option emit.stringRule.omitWhenEmpty must be a boolean when provided',
    errors,
  )
  validateOptionalBoolean(
    record.expandWithVimFnExpand,
    'Option emit.stringRule.expandWithVimFnExpand must be a boolean when provided',
    errors,
  )
  validateOptionalBoolean(
    record.warnWhenRelative,
    'Option emit.stringRule.warnWhenRelative must be a boolean when provided',
    errors,
  )
}

function validateSchemaOptionEmit(
  emit: unknown,
  optionType: SchemaOptionType,
  errors: ValidationError[],
): void {
  if (emit === undefined) {
    return
  }

  if (typeof emit !== 'object' || emit === null || Array.isArray(emit)) {
    errors.push(
      createError('Option emit must be an object when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const record = emit as RawSchemaEmitRecord
  validateSchemaOptionEmitInclude(record.include, errors)
  validateSchemaOptionEmitValueRule(record.valueRule, errors)
  validateSchemaOptionEmitStringRule(record.stringRule, optionType, errors)
}

function validateSchemaLuaValue(
  value: unknown,
  errors: ValidationError[],
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError('Schema Lua value must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const record = value as Record<string, unknown>
  if (record['kind'] === 'json') {
    if (!isValidSchemaJsonValue(record['value'])) {
      errors.push(
        createError('Schema json value is invalid', {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    return
  }

  if (record['kind'] === 'lua') {
    if (
      typeof record['lua'] !== 'string' ||
      record['lua'].trim().length === 0
    ) {
      errors.push(
        createError('Schema lua value must be a non-empty string', {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
    return
  }

  errors.push(
    createError('Schema Lua value kind is invalid', {
      code: 'INVALID_FIELD_TYPE',
    }),
  )
}

function isValidSchemaJsonValue(value: unknown): value is SchemaJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isValidSchemaJsonValue(entry))
  }

  if (typeof value === 'object') {
    return Object.values(value).every((entry) => isValidSchemaJsonValue(entry))
  }

  return false
}

function validateSchemaOptionCondition(
  value: unknown,
  fieldName: 'visibleWhen' | 'enabledWhen',
  errors: ValidationError[],
): void {
  if (value === undefined) {
    return
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError(`Option ${fieldName} must be an object when provided`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const condition = value as RawSchemaConditionRecord
  if (typeof condition.key !== 'string' || condition.key.trim().length === 0) {
    errors.push(
      createError(`Option ${fieldName}.key must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (
    typeof condition.equals !== 'string' &&
    typeof condition.equals !== 'number' &&
    typeof condition.equals !== 'boolean'
  ) {
    errors.push(
      createError(
        `Option ${fieldName}.equals must be a string, number, or boolean`,
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
  }
}

function validateSchemaOptionNotices(
  notices: unknown,
  errors: ValidationError[],
): void {
  if (notices === undefined) {
    return
  }

  if (!Array.isArray(notices)) {
    errors.push(
      createError('Option notices must be an array when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  for (const [index, notice] of notices.entries()) {
    validateSchemaOptionNotice(
      notice,
      `Option notices[${String(index)}]`,
      errors,
    )
  }
}

function validateSchemaOptionNotice(
  notice: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (typeof notice !== 'object' || notice === null || Array.isArray(notice)) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const rawNotice = notice as RawSchemaNoticeRecord
  if (rawNotice.severity !== 'warning') {
    errors.push(
      createError(`${prefix}.severity must be "warning"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (!Array.isArray(rawNotice.surfaces) || rawNotice.surfaces.length === 0) {
    errors.push(
      createError(`${prefix}.surfaces must be a non-empty array`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else {
    for (const surface of rawNotice.surfaces) {
      if (surface !== 'configuration' && surface !== 'generation') {
        errors.push(
          createError(
            `${prefix}.surfaces entries must be "configuration" or "generation"`,
            { code: 'INVALID_FIELD_TYPE' },
          ),
        )
      }
    }
  }

  if (
    typeof rawNotice.message !== 'string' ||
    rawNotice.message.trim().length === 0
  ) {
    errors.push(
      createError(`${prefix}.message must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  validateOptionalNonEmptyString(
    rawNotice.details,
    `${prefix}.details must be a non-empty string when provided`,
    errors,
  )
  validateOptionalStringArray(
    rawNotice.suggestions,
    `${prefix}.suggestions`,
    `${prefix}.suggestions must be an array of non-empty strings when provided`,
    errors,
  )

  validateSchemaOptionNoticeWhen(rawNotice.when, `${prefix}.when`, errors)
}

function validateSchemaOptionNoticeWhen(
  value: unknown,
  prefix: string,
  errors: ValidationError[],
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const when = value as RawSchemaNoticeWhenRecord
  if (
    when.kind !== 'has-explicit-value' &&
    when.kind !== 'equals' &&
    when.kind !== 'not-equals'
  ) {
    errors.push(
      createError(
        `${prefix}.kind must be "has-explicit-value", "equals", or "not-equals"`,
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
    return
  }

  if (when.kind === 'has-explicit-value') {
    return
  }

  if (
    typeof when.value !== 'string' &&
    typeof when.value !== 'number' &&
    typeof when.value !== 'boolean'
  ) {
    errors.push(
      createError(`${prefix}.value must be a string, number, or boolean`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateSelectOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  if (!Array.isArray(o.options) || o.options.length === 0) {
    errors.push(
      createError('Select option must have a non-empty "options" array', {
        code: 'MISSING_SELECT_OPTIONS',
      }),
    )
  } else {
    validateSelectOptionEntries(o.options, errors, 'Select option')
  }

  if (o.multi === true) {
    validateMultiSelectDefault(o, errors)
    return
  }

  validateSingleSelectDefault(o, errors)
}

function validateSingleSelectDefault(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateDefaultValueType(
    o.default,
    'string',
    'Select option default must be a string',
    errors,
  )

  if (
    typeof o.default === 'string' &&
    Array.isArray(o.options) &&
    o.options.length > 0
  ) {
    const validValues = collectValidSelectValues(o.options)
    if (!validValues.has(o.default)) {
      errors.push(
        createError(
          `Select option default "${o.default}" is not in options[]`,
          {
            code: 'INVALID_DEFAULT_VALUE',
          },
        ),
      )
    }
  }
}

function validateMultiSelectDefault(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  if (o.default === undefined) {
    return
  }

  if (!Array.isArray(o.default)) {
    errors.push(
      createError('Multi-select option default must be an array of strings', {
        code: 'INVALID_DEFAULT_VALUE',
      }),
    )
    return
  }

  for (const item of o.default) {
    if (typeof item !== 'string') {
      errors.push(
        createError('Multi-select option default array items must be strings', {
          code: 'INVALID_DEFAULT_VALUE',
        }),
      )
      return
    }
  }

  if (Array.isArray(o.options) && o.options.length > 0) {
    const validValues = collectValidSelectValues(o.options)
    for (const item of o.default) {
      if (!validValues.has(item)) {
        errors.push(
          createError(
            `Multi-select option default contains "${item}" which is not in options[]`,
            { code: 'INVALID_DEFAULT_VALUE' },
          ),
        )
      }
    }
  }
}

function collectValidSelectValues(options: unknown[]): Set<string> {
  return new Set(
    options
      .filter(
        (entry): entry is RawSelectOptionRecord =>
          typeof entry === 'object' && entry !== null,
      )
      .map((entry) => entry.value)
      .filter((value): value is string => typeof value === 'string'),
  )
}

function validateArrayOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateArrayItemsDefinition(o.items, errors)

  if (o.default !== undefined && !Array.isArray(o.default)) {
    errors.push(
      createError('Array option default must be an array', {
        code: 'INVALID_DEFAULT_VALUE',
      }),
    )
  }

  validateRangeValidationRule(
    o.validation,
    'Array option validation must be an object',
    'Array validation: minItems must be <= maxItems',
    errors,
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates mapping-table column shape, autofill rules, and value maps in schema declaration order
function validateMappingTableOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  const columnKeys = new Set<string>()
  const columns = Array.isArray(o.columns) ? o.columns : []

  if (!Array.isArray(o.columns) || o.columns.length === 0) {
    errors.push(
      createError(
        'Mapping-table option must have a non-empty "columns" array',
        {
          code: 'MISSING_REQUIRED_FIELD',
        },
      ),
    )
  } else {
    const seenColumns = new Set<string>()
    for (const [index, column] of o.columns.entries()) {
      validateMappingTableColumn(column, index, seenColumns, errors)
    }
    for (const key of seenColumns) {
      columnKeys.add(key)
    }

    for (const [index, column] of o.columns.entries()) {
      validateMappingTableColumnAutoFill(column, index, columns, errors)
    }
  }

  if (o.default !== undefined) {
    if (!Array.isArray(o.default)) {
      errors.push(
        createError('Mapping-table option default must be an array', {
          code: 'INVALID_DEFAULT_VALUE',
        }),
      )
    } else {
      for (const [index, row] of o.default.entries()) {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) {
          errors.push(
            createError(
              `Mapping-table option default row ${String(index)} must be an object`,
              { code: 'INVALID_DEFAULT_VALUE' },
            ),
          )
        }
      }
    }
  }

  if (typeof o.emit !== 'object' || o.emit === null || Array.isArray(o.emit)) {
    errors.push(
      createError('Mapping-table option must have an emit object', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    const emit = o.emit as RawSchemaEmitRecord
    const emitKeyColumn =
      typeof emit.keyColumn === 'string' && emit.keyColumn.trim().length > 0
        ? emit.keyColumn
        : undefined
    const emitValueColumn =
      typeof emit.valueColumn === 'string' && emit.valueColumn.trim().length > 0
        ? emit.valueColumn
        : undefined
    const emitValueTemplate =
      typeof emit.valueTemplate === 'string' &&
      emit.valueTemplate.trim().length > 0
        ? emit.valueTemplate
        : undefined

    if (
      typeof emit.targetKey !== 'string' ||
      emit.targetKey.trim().length === 0
    ) {
      errors.push(
        createError('Mapping-table emit.targetKey must be a non-empty string', {
          code: 'MISSING_REQUIRED_FIELD',
        }),
      )
    }
    if (emitKeyColumn === undefined) {
      errors.push(
        createError('Mapping-table emit.keyColumn must be a non-empty string', {
          code: 'MISSING_REQUIRED_FIELD',
        }),
      )
    }
    if (emitValueColumn === undefined) {
      errors.push(
        createError(
          'Mapping-table emit.valueColumn must be a non-empty string',
          {
            code: 'MISSING_REQUIRED_FIELD',
          },
        ),
      )
    }
    if (emitValueTemplate === undefined) {
      errors.push(
        createError(
          'Mapping-table emit.valueTemplate must be a non-empty string',
          {
            code: 'MISSING_REQUIRED_FIELD',
          },
        ),
      )
    }

    if (emitKeyColumn !== undefined && !columnKeys.has(emitKeyColumn)) {
      errors.push(
        createError(
          'Mapping-table emit.keyColumn must reference a declared column',
          {
            code: 'INVALID_VALIDATION_RULE',
          },
        ),
      )
    }
    if (emitValueColumn !== undefined && !columnKeys.has(emitValueColumn)) {
      errors.push(
        createError(
          'Mapping-table emit.valueColumn must reference a declared column',
          {
            code: 'INVALID_VALIDATION_RULE',
          },
        ),
      )
    }

    if (emitValueTemplate !== undefined) {
      for (const placeholderError of validateMappingTableTemplatePlaceholders(
        emitValueTemplate,
      )) {
        errors.push(
          createError(`Mapping-table emit.valueTemplate ${placeholderError}`, {
            code: 'INVALID_VALIDATION_RULE',
          }),
        )
      }

      const placeholders =
        extractMappingTableTemplatePlaceholders(emitValueTemplate)
      for (const placeholder of placeholders) {
        if (
          placeholder.kind === 'row-column' &&
          !columnKeys.has(placeholder.columnKey)
        ) {
          errors.push(
            createError(
              `Mapping-table emit.valueTemplate references undeclared column "${placeholder.columnKey}"`,
              { code: 'INVALID_VALIDATION_RULE' },
            ),
          )
        }
      }

      if (
        placeholders.some((placeholder) => placeholder.kind === 'output-key')
      ) {
        const keyColumnRecord = columns.find(
          (column) =>
            typeof (column as RawSchemaColumnRecord).key === 'string' &&
            (column as RawSchemaColumnRecord).key === emitKeyColumn,
        ) as RawSchemaColumnRecord | undefined
        if (keyColumnRecord?.type !== 'select') {
          errors.push(
            createError(
              'Mapping-table emit.valueTemplate may only interpolate {{outputKey}} from a select keyColumn',
              { code: 'INVALID_VALIDATION_RULE' },
            ),
          )
        }
      }

      for (const placeholder of placeholders) {
        if (placeholder.kind !== 'row-column') {
          continue
        }

        const columnRecord = columns.find(
          (column) =>
            typeof (column as RawSchemaColumnRecord).key === 'string' &&
            (column as RawSchemaColumnRecord).key === placeholder.columnKey,
        ) as RawSchemaColumnRecord | undefined

        if (columnRecord?.type === 'string') {
          errors.push(
            createError(
              `Mapping-table emit.valueTemplate placeholder "row.${placeholder.columnKey}" must not interpolate an unconstrained string column into raw Lua`,
              { code: 'INVALID_VALIDATION_RULE' },
            ),
          )
        }
      }
    }

    if (emit.outputKeyMap !== undefined) {
      if (
        typeof emit.outputKeyMap !== 'object' ||
        emit.outputKeyMap === null ||
        Array.isArray(emit.outputKeyMap)
      ) {
        errors.push(
          createError(
            'Mapping-table emit.outputKeyMap must be an object when provided',
            {
              code: 'INVALID_FIELD_TYPE',
            },
          ),
        )
      } else {
        for (const [sourceKey, outputKey] of Object.entries(
          emit.outputKeyMap,
        )) {
          if (
            sourceKey.trim().length === 0 ||
            typeof outputKey !== 'string' ||
            outputKey.trim().length === 0
          ) {
            errors.push(
              createError(
                'Mapping-table emit.outputKeyMap entries must map non-empty strings to non-empty strings',
                {
                  code: 'INVALID_FIELD_TYPE',
                },
              ),
            )
            continue
          }

          if (!isSafeRawLuaIdentifier(outputKey)) {
            errors.push(
              createError(
                `Mapping-table emit.outputKeyMap value "${outputKey}" is not safe for raw Lua interpolation`,
                { code: 'INVALID_VALIDATION_RULE' },
              ),
            )
          }
        }
      }
    }
  }

  if (o.conflictGroups !== undefined) {
    if (!Array.isArray(o.conflictGroups)) {
      errors.push(
        createError('Mapping-table conflictGroups must be an array', {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    } else {
      for (const [index, group] of o.conflictGroups.entries()) {
        validateMappingTableConflictGroup(group, index, errors)
        const record = group as RawSchemaConflictGroupRecord
        if (
          typeof record.column === 'string' &&
          record.column.trim().length > 0 &&
          !columnKeys.has(record.column)
        ) {
          errors.push(
            createError(
              `Mapping-table conflictGroups[${String(index)}].column must reference a declared column`,
              { code: 'INVALID_VALIDATION_RULE' },
            ),
          )
        }
      }
    }
  }
}

function validateMappingTableColumn(
  column: unknown,
  index: number,
  seenColumns: Set<string>,
  errors: ValidationError[],
): void {
  const prefix = `Mapping-table columns[${String(index)}]`
  if (typeof column !== 'object' || column === null || Array.isArray(column)) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const record = column as RawSchemaColumnRecord
  if (typeof record.key !== 'string' || record.key.trim().length === 0) {
    errors.push(
      createError(`${prefix}.key must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  } else if (seenColumns.has(record.key)) {
    errors.push(
      createError(`${prefix}.key must be unique`, {
        code: 'DUPLICATE_OPTION_KEY',
      }),
    )
  } else {
    seenColumns.add(record.key)
  }

  if (typeof record.label !== 'string' || record.label.trim().length === 0) {
    errors.push(
      createError(`${prefix}.label must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (record.type !== 'string' && record.type !== 'select') {
    errors.push(
      createError(`${prefix}.type must be "string" or "select"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (record.type === 'select') {
    if (!Array.isArray(record.options) || record.options.length === 0) {
      errors.push(
        createError(`${prefix}.options must be a non-empty array`, {
          code: 'MISSING_SELECT_OPTIONS',
        }),
      )
    } else {
      validateSelectOptionEntries(record.options, errors, prefix)
    }
  }
}

function validateMappingTableAutoFillReferences(
  prefix: string,
  columnRecord: RawSchemaColumnRecord,
  autoFill: RawSchemaMappingTableAutoFillRecord,
  columns: readonly unknown[],
  errors: ValidationError[],
): void {
  const targetColumnKey =
    typeof columnRecord.key === 'string' && columnRecord.key.trim().length > 0
      ? columnRecord.key
      : undefined
  const sourceColumnKey =
    typeof autoFill.sourceColumn === 'string' &&
    autoFill.sourceColumn.trim().length > 0
      ? autoFill.sourceColumn
      : undefined

  if (sourceColumnKey === undefined) {
    errors.push(
      createError(`${prefix}.sourceColumn must be a non-empty string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  const sourceColumn =
    sourceColumnKey === undefined
      ? undefined
      : getMappingTableColumnRecordByKey(columns, sourceColumnKey)

  if (sourceColumnKey !== undefined && sourceColumn === undefined) {
    errors.push(
      createError(
        `${prefix}.sourceColumn must reference a declared sibling column`,
        {
          code: 'INVALID_VALIDATION_RULE',
        },
      ),
    )
  }

  if (
    targetColumnKey !== undefined &&
    sourceColumnKey !== undefined &&
    targetColumnKey === sourceColumnKey
  ) {
    errors.push(
      createError(
        `${prefix}.sourceColumn must not match the target column key`,
        {
          code: 'INVALID_VALIDATION_RULE',
        },
      ),
    )
  }

  if (
    autoFill.fallback !== undefined &&
    autoFill.fallback !== 'preserve' &&
    autoFill.fallback !== 'empty' &&
    autoFill.fallback !== 'column-default'
  ) {
    errors.push(
      createError(
        `${prefix}.fallback must be "preserve", "empty", or "column-default" when provided`,
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
  }
}

function validateMappingTableAutoFillValues(
  prefix: string,
  columnRecord: RawSchemaColumnRecord,
  autoFill: RawSchemaMappingTableAutoFillRecord,
  sourceColumn: RawSchemaColumnRecord | undefined,
  errors: ValidationError[],
): void {
  if (
    typeof autoFill.values !== 'object' ||
    autoFill.values === null ||
    Array.isArray(autoFill.values)
  ) {
    errors.push(
      createError(`${prefix}.values must be a non-array object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const sourceValidValues = getMappingTableColumnValidSelectValues(sourceColumn)
  const targetValidValues = getMappingTableColumnValidSelectValues(columnRecord)
  const targetColumnKey =
    typeof columnRecord.key === 'string' && columnRecord.key.trim().length > 0
      ? columnRecord.key
      : undefined
  const sourceColumnKey =
    typeof autoFill.sourceColumn === 'string' &&
    autoFill.sourceColumn.trim().length > 0
      ? autoFill.sourceColumn
      : undefined

  for (const [mappedSourceValue, mappedTargetValue] of Object.entries(
    autoFill.values,
  )) {
    if (mappedSourceValue.trim().length === 0) {
      errors.push(
        createError(`${prefix}.values keys must be non-empty strings`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }

    if (typeof mappedTargetValue !== 'string') {
      errors.push(
        createError(`${prefix}.values must map to string values`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
      continue
    }

    if (
      sourceValidValues !== undefined &&
      !sourceValidValues.has(mappedSourceValue)
    ) {
      errors.push(
        createError(
          `${prefix}.values key "${mappedSourceValue}" is not a valid option for source column "${sourceColumnKey}"`,
          { code: 'INVALID_VALIDATION_RULE' },
        ),
      )
    }

    if (
      targetValidValues !== undefined &&
      !targetValidValues.has(mappedTargetValue)
    ) {
      errors.push(
        createError(
          `${prefix}.values entry "${mappedSourceValue}" maps to invalid target value "${mappedTargetValue}" for column "${targetColumnKey}"`,
          { code: 'INVALID_VALIDATION_RULE' },
        ),
      )
    }
  }
}

function validateMappingTableColumnAutoFill(
  column: unknown,
  index: number,
  columns: readonly unknown[],
  errors: ValidationError[],
): void {
  if (typeof column !== 'object' || column === null || Array.isArray(column)) {
    return
  }

  const columnRecord = column as RawSchemaColumnRecord
  if (columnRecord.autoFill === undefined) {
    return
  }

  const prefix = `Mapping-table columns[${String(index)}].autoFill`
  if (
    typeof columnRecord.autoFill !== 'object' ||
    columnRecord.autoFill === null ||
    Array.isArray(columnRecord.autoFill)
  ) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const autoFill = columnRecord.autoFill as RawSchemaMappingTableAutoFillRecord
  if (autoFill.kind !== 'value-by-column') {
    errors.push(
      createError(`${prefix}.kind must be "value-by-column"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  validateMappingTableAutoFillReferences(
    prefix,
    columnRecord,
    autoFill,
    columns,
    errors,
  )

  const sourceColumnKey =
    typeof autoFill.sourceColumn === 'string' &&
    autoFill.sourceColumn.trim().length > 0
      ? autoFill.sourceColumn
      : undefined
  const sourceColumn =
    sourceColumnKey === undefined
      ? undefined
      : getMappingTableColumnRecordByKey(columns, sourceColumnKey)

  validateMappingTableAutoFillValues(
    prefix,
    columnRecord,
    autoFill,
    sourceColumn,
    errors,
  )
}

function getMappingTableColumnRecordByKey(
  columns: readonly unknown[],
  key: string,
): RawSchemaColumnRecord | undefined {
  return columns.find(
    (column): column is RawSchemaColumnRecord =>
      typeof column === 'object' &&
      column !== null &&
      !Array.isArray(column) &&
      (column as RawSchemaColumnRecord).key === key,
  )
}

function getMappingTableColumnValidSelectValues(
  column: RawSchemaColumnRecord | undefined,
): Set<string> | undefined {
  if (
    column?.type !== 'select' ||
    !Array.isArray(column.options) ||
    column.options.length === 0
  ) {
    return undefined
  }

  return collectValidSelectValues(column.options)
}

function validateMappingTableConflictGroup(
  group: unknown,
  index: number,
  errors: ValidationError[],
): void {
  const prefix = `Mapping-table conflictGroups[${String(index)}]`
  if (typeof group !== 'object' || group === null || Array.isArray(group)) {
    errors.push(
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const record = group as RawSchemaConflictGroupRecord
  validateOptionalNonEmptyString(
    record.column,
    `${prefix}.column must be a non-empty string`,
    errors,
  )
  validateOptionalStringArray(
    record.values,
    `${prefix}.values`,
    `${prefix}.values must be an array of non-empty strings`,
    errors,
  )
  if (record.severity !== 'warning') {
    errors.push(
      createError(`${prefix}.severity must be "warning"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
  validateOptionalNonEmptyString(
    record.message,
    `${prefix}.message must be a non-empty string`,
    errors,
  )
}

function validateArrayItemsDefinition(
  itemsValue: unknown,
  errors: ValidationError[],
): void {
  if (typeof itemsValue !== 'object' || itemsValue === null) {
    errors.push(
      createError('Array option must have an "items" field', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
    return
  }

  const items = itemsValue as RawArrayItemsRecord
  if (
    typeof items.itemType !== 'string' ||
    !VALID_ARRAY_ITEM_TYPES.has(items.itemType)
  ) {
    errors.push(
      createError(`Invalid array items.itemType: "${String(items.itemType)}"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  if (items.itemType === 'select') {
    if (!Array.isArray(items.options) || items.options.length === 0) {
      errors.push(
        createError(
          'Array items of type "select" must have a non-empty "options" array',
          { code: 'MISSING_SELECT_OPTIONS' },
        ),
      )
      return
    }

    validateSelectOptionEntries(items.options, errors, 'Array items')
  }
}

function validateSelectOptionEntries(
  options: unknown[],
  errors: ValidationError[],
  context: string,
): void {
  for (const [index, option] of options.entries()) {
    validateSelectOptionEntry(option, index, errors, context)
  }
}

function validateSelectOptionEntry(
  option: unknown,
  index: number,
  errors: ValidationError[],
  context: string,
): void {
  if (typeof option !== 'object' || option === null) {
    errors.push(
      createError(`${context} options[${String(index)}] must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const entry = option as RawSelectOptionRecord
  if (typeof entry.value !== 'string' || entry.value === '') {
    errors.push(
      createError(
        `${context} options[${String(index)}].value must be a non-empty string`,
        {
          code: 'INVALID_FIELD_TYPE',
        },
      ),
    )
  }

  if (typeof entry.label !== 'string' || entry.label === '') {
    errors.push(
      createError(
        `${context} options[${String(index)}].label must be a non-empty string`,
        {
          code: 'INVALID_FIELD_TYPE',
        },
      ),
    )
  }
}

function validateRangeValidationRule(
  validationValue: unknown,
  invalidTypeMessage: string,
  message: string,
  errors: ValidationError[],
): void {
  if (validationValue === undefined) {
    return
  }

  if (typeof validationValue !== 'object' || validationValue === null) {
    errors.push(
      createError(invalidTypeMessage, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const validation = validationValue as RawRangeValidationRecord
  if (
    validation.min !== undefined &&
    validation.max !== undefined &&
    typeof validation.min === 'number' &&
    typeof validation.max === 'number' &&
    validation.min > validation.max
  ) {
    errors.push(
      createError(message, {
        code: 'INVALID_VALIDATION_RULE',
      }),
    )
  }
}

function validateObjectOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  if (!Array.isArray(o.properties)) {
    errors.push(
      createError('Object option must have a "properties" array', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    const nestedKeys = new Set<string>()
    for (const prop of o.properties as unknown[]) {
      const propErrors = validateSchemaOption(prop, nestedKeys)
      errors.push(...propErrors)
    }
  }
  if (
    o.default !== undefined &&
    (typeof o.default !== 'object' ||
      o.default === null ||
      Array.isArray(o.default))
  ) {
    errors.push(
      createError('Object option default must be an object', {
        code: 'INVALID_DEFAULT_VALUE',
      }),
    )
  }
}

function validateNumberOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  if (o.default !== undefined && typeof o.default !== 'number') {
    errors.push(
      createError('Number option default must be a number', {
        code: 'INVALID_DEFAULT_VALUE',
      }),
    )
  }
  validateRangeValidationRule(
    o.validation,
    'Number option validation must be an object',
    'Number validation: min must be <= max',
    errors,
  )
}

function validateStringOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateDefaultValueType(
    o.default,
    'string',
    'String option default must be a string',
    errors,
  )
  validateStringPatternRule(o.validation, errors)
}

function validateBooleanOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateDefaultValueType(
    o.default,
    'boolean',
    'Boolean option default must be a boolean',
    errors,
  )
}

function validateColorOption(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateDefaultValueType(
    o.default,
    'string',
    'Color option default must be a string',
    errors,
  )
}

function validateStringTypeDefault(
  o: RawSchemaOptionRecord,
  errors: ValidationError[],
): void {
  validateDefaultValueType(
    o.default,
    'string',
    `${String(o.type)} option default must be a string`,
    errors,
  )
}

function validateStringPatternRule(
  validationValue: unknown,
  errors: ValidationError[],
): void {
  if (validationValue === undefined) {
    return
  }

  if (typeof validationValue !== 'object' || validationValue === null) {
    errors.push(
      createError('String option validation must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const validation = validationValue as RawStringValidationRecord
  if (validation.pattern === undefined) {
    return
  }

  if (typeof validation.pattern !== 'string') {
    errors.push(
      createError('String option validation.pattern must be a string', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  try {
    new RegExp(validation.pattern)
  } catch {
    errors.push(
      createError(
        `String option validation.pattern is not a valid regex: "${validation.pattern}"`,
        {
          code: 'INVALID_VALIDATION_RULE',
        },
      ),
    )
  }
}

function validateDefaultValueType(
  value: unknown,
  expectedType: 'string' | 'number' | 'boolean',
  message: string,
  errors: ValidationError[],
): void {
  if (value === undefined || typeof value === expectedType) {
    return
  }

  errors.push(
    createError(message, {
      code: 'INVALID_DEFAULT_VALUE',
    }),
  )
}

/**
 * Validate a single schema function definition.
 */
function validateSchemaFunction(
  fn: unknown,
  seenFunctionNames: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof fn !== 'object' || fn === null) {
    errors.push(
      createError('Each function must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const f = fn as RawSchemaFunctionRecord

  if (typeof f.name !== 'string' || f.name === '') {
    errors.push(
      createError('Function must have a non-empty "name" field', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    if (seenFunctionNames.has(f.name)) {
      errors.push(
        createError(`Duplicate function name: "${f.name}"`, {
          code: 'DUPLICATE_FUNCTION_NAME',
        }),
      )
    }
    seenFunctionNames.add(f.name)
  }

  if (typeof f.luaCall !== 'string' || f.luaCall === '') {
    errors.push(
      createError('Function must have a non-empty "luaCall" field', {
        code: 'INVALID_LUA_CALL',
      }),
    )
  }

  validateFunctionParams(
    f.params,
    errors,
    typeof f.name === 'string' ? f.name : undefined,
  )
  validateFunctionReturns(f.returns, errors)
  validateFunctionMetadata(f, errors)

  // Validate luaCall template against declared params
  if (
    typeof f.luaCall === 'string' &&
    f.luaCall !== '' &&
    Array.isArray(f.params)
  ) {
    const paramSignatures = (
      f.params as Array<{ name?: unknown; type?: unknown; optional?: unknown }>
    )
      .filter((p) => typeof p.name === 'string' && typeof p.type === 'string')
      .map((p) => ({
        name: p.name as string,
        type: p.type as import('@/shared/types').PortDataType,
        optional: typeof p.optional === 'boolean' ? p.optional : undefined,
      }))
    const templateResult = validateTemplate(f.luaCall, paramSignatures)
    if (!templateResult.valid) {
      for (const error of templateResult.errors) {
        errors.push(
          createError(`functions[${String(f.name)}].luaCall: ${error}`, {
            code: 'INVALID_LUA_CALL',
          }),
        )
      }
    }
  }

  return errors
}

function validateFunctionMetadata(
  fn: RawSchemaFunctionRecord,
  errors: ValidationError[],
): void {
  validateFunctionParamEmission(fn.paramEmission, errors)
  validateOptionalNonEmptyString(
    fn.label,
    'Function.label must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.shortDescription,
    'Function.shortDescription must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.whatItDoes,
    'Function.whatItDoes must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.technicalNote,
    'Function.technicalNote must be a non-empty string when provided',
    errors,
  )
  validateOptionalBoolean(
    fn.isPopular,
    'Function.isPopular must be a boolean when provided',
    errors,
  )
  validateOptionalStringArray(
    fn.aliases,
    'Function.aliases',
    'Function.aliases must be an array of non-empty strings when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.category,
    'Function.category must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.example,
    'Function.example must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.sourceDoc,
    'Function.sourceDoc must be a non-empty string when provided',
    errors,
  )
  validateOptionalNonEmptyString(
    fn.relatedCommand,
    'Function.relatedCommand must be a non-empty string when provided',
    errors,
  )
}

function validateFunctionParamEmission(
  value: unknown,
  errors: ValidationError[],
): void {
  if (value === undefined) {
    return
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError('Function.paramEmission must be an object when provided', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const raw = value as { unsetOptional?: unknown }
  if (raw.unsetOptional === undefined) {
    return
  }

  if (
    typeof raw.unsetOptional === 'string' &&
    VALID_PARAM_EMISSION_UNSET_OPTIONAL.has(raw.unsetOptional)
  ) {
    return
  }

  errors.push(
    createError(
      'Function.paramEmission.unsetOptional must be "emit-nil" or "omit-trailing" when provided',
      {
        code: 'INVALID_FIELD_TYPE',
      },
    ),
  )
}

function validateOptionalNonEmptyString(
  value: unknown,
  message: string,
  errors: ValidationError[],
): void {
  if (value === undefined) {
    return
  }

  if (typeof value === 'string' && value !== '') {
    return
  }

  errors.push(
    createError(message, {
      code: 'INVALID_FIELD_TYPE',
    }),
  )
}

function validateOptionalBoolean(
  value: unknown,
  message: string,
  errors: ValidationError[],
): void {
  if (value === undefined) {
    return
  }

  if (typeof value === 'boolean') {
    return
  }

  errors.push(
    createError(message, {
      code: 'INVALID_FIELD_TYPE',
    }),
  )
}

function validateOptionalStringArray(
  value: unknown,
  fieldName: string,
  invalidTypeMessage: string,
  errors: ValidationError[],
): void {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value)) {
    errors.push(
      createError(invalidTypeMessage, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || item === '') {
      errors.push(
        createError(
          `"${fieldName}[${String(index)}]" must be a non-empty string`,
          {
            code: 'INVALID_FIELD_TYPE',
          },
        ),
      )
    }
  }
}

function validateFunctionParams(
  params: unknown,
  errors: ValidationError[],
  functionName: string | undefined,
): void {
  if (!Array.isArray(params)) {
    errors.push(
      createError('Function must have a "params" array', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
    return
  }

  const seenParamNames = new Set<string>()
  for (const param of params) {
    validateFunctionParam(param, errors, seenParamNames, functionName)
  }
}

function validateFunctionParam(
  param: unknown,
  errors: ValidationError[],
  seenParamNames: Set<string>,
  functionName: string | undefined,
): void {
  if (typeof param !== 'object' || param === null) {
    errors.push(
      createError('Each function param must be an object', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  const p = param as RawSchemaFunctionParamRecord
  if (typeof p.name !== 'string' || p.name === '') {
    errors.push(
      createError('Function param must have a non-empty "name" field', {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    if (seenParamNames.has(p.name)) {
      errors.push(
        createError(
          functionName === undefined
            ? `Duplicate function param name: "${p.name}"`
            : `Duplicate function param name: "${p.name}" in function "${functionName}"`,
          {
            code: 'DUPLICATE_FUNCTION_PARAM_NAME',
          },
        ),
      )
    }
    seenParamNames.add(p.name)
  }

  if (
    typeof p.type !== 'string' ||
    !VALID_PORT_DATA_TYPES.has(p.type as PortDataType)
  ) {
    errors.push(
      createError(`Invalid function param type: "${String(p.type)}"`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }
}

function validateFunctionReturns(
  returnsType: unknown,
  errors: ValidationError[],
): void {
  if (returnsType === undefined) {
    return
  }

  if (
    typeof returnsType === 'string' &&
    VALID_PORT_DATA_TYPES.has(returnsType as PortDataType)
  ) {
    return
  }

  errors.push(
    createError(`Invalid function return type: "${String(returnsType)}"`, {
      code: 'INVALID_FIELD_TYPE',
    }),
  )
}

// ============================================
// Function Template Validation
// ============================================

function validateSchemaFunctionTemplatesField(
  functionTemplates: unknown,
  functions: unknown,
  errors: ValidationError[],
): void {
  // functionTemplates is optional — skip if absent
  if (functionTemplates === undefined) {
    return
  }

  if (!Array.isArray(functionTemplates)) {
    errors.push(
      createError('"functionTemplates" must be an array', {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return
  }

  // Build a set of valid function names for reference validation
  const validFunctionNames = new Set<string>()
  if (Array.isArray(functions)) {
    for (const fn of functions) {
      if (typeof fn === 'object' && fn !== null) {
        const f = fn as RawSchemaFunctionRecord
        if (typeof f.name === 'string' && f.name !== '') {
          validFunctionNames.add(f.name)
        }
      }
    }
  }

  const seenKeys = new Set<string>()
  for (const [index, tmpl] of functionTemplates.entries()) {
    errors.push(
      ...validateSchemaFunctionTemplate(
        tmpl,
        index,
        seenKeys,
        validFunctionNames,
        functions,
      ),
    )
  }
}

function validateTemplatKey(
  t: RawSchemaFunctionTemplateRecord,
  prefix: string,
  seenKeys: Set<string>,
): ValidationError[] {
  if (typeof t.key !== 'string' || t.key === '') {
    return [
      createError(`${prefix} must have a non-empty "key" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    ]
  }
  const errors: ValidationError[] = []
  if (seenKeys.has(t.key)) {
    errors.push(
      createError(`${prefix} has duplicate key "${t.key}"`, {
        code: 'DUPLICATE_FUNCTION_NAME',
      }),
    )
  }
  seenKeys.add(t.key)
  return errors
}

function validateTemplateBaseFunctionName(
  t: RawSchemaFunctionTemplateRecord,
  prefix: string,
  validFunctionNames: Set<string>,
): ValidationError[] {
  if (typeof t.baseFunctionName !== 'string' || t.baseFunctionName === '') {
    return [
      createError(`${prefix} must have a non-empty "baseFunctionName" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    ]
  }
  if (!validFunctionNames.has(t.baseFunctionName)) {
    return [
      createError(
        `${prefix} references unknown function "${t.baseFunctionName}"`,
        { code: 'MISSING_REQUIRED_FIELD' },
      ),
    ]
  }
  return []
}

function validateTemplateOptionalFields(
  t: RawSchemaFunctionTemplateRecord,
  prefix: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof t.label !== 'string' || t.label === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "label" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (typeof t.shortDescription !== 'string' || t.shortDescription === '') {
    errors.push(
      createError(`${prefix} must have a non-empty "shortDescription" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  }

  if (t.whatItDoes !== undefined && typeof t.whatItDoes !== 'string') {
    errors.push(
      createError(`${prefix}.whatItDoes must be a string`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  if (t.isPopular !== undefined && typeof t.isPopular !== 'boolean') {
    errors.push(
      createError(`${prefix}.isPopular must be a boolean`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
  }

  return errors
}

function validateTemplateAliases(
  t: RawSchemaFunctionTemplateRecord,
  prefix: string,
): ValidationError[] {
  if (t.aliases === undefined) return []
  if (!Array.isArray(t.aliases)) {
    return [
      createError(`${prefix}.aliases must be an array`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    ]
  }
  const errors: ValidationError[] = []
  for (const alias of t.aliases as unknown[]) {
    if (typeof alias !== 'string' || alias === '') {
      errors.push(
        createError(`${prefix}.aliases items must be non-empty strings`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
  }
  return errors
}

function validateSchemaFunctionTemplate(
  tmpl: unknown,
  index: number,
  seenKeys: Set<string>,
  validFunctionNames: Set<string>,
  functions: unknown,
): ValidationError[] {
  const prefix = `functionTemplates[${String(index)}]`

  if (typeof tmpl !== 'object' || tmpl === null) {
    return [
      createError(`${prefix} must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    ]
  }

  const t = tmpl as RawSchemaFunctionTemplateRecord
  const errors: ValidationError[] = [
    ...validateTemplatKey(t, prefix, seenKeys),
    ...validateTemplateBaseFunctionName(t, prefix, validFunctionNames),
    ...validateTemplateOptionalFields(t, prefix),
    ...validateTemplateAliases(t, prefix),
  ]

  if (t.defaults === undefined) {
    errors.push(
      createError(`${prefix} must have a "defaults" field`, {
        code: 'MISSING_REQUIRED_FIELD',
      }),
    )
  } else {
    errors.push(
      ...validateTemplateDefaults(
        t.defaults,
        prefix,
        typeof t.baseFunctionName === 'string' ? t.baseFunctionName : undefined,
        functions,
      ),
    )
  }

  return errors
}

function buildBaseFunctionParamNames(
  baseFunctionName: string,
  functions: unknown,
): Set<string> {
  const validParamNames = new Set<string>()
  if (!Array.isArray(functions)) return validParamNames

  for (const fn of functions) {
    if (
      typeof fn !== 'object' ||
      fn === null ||
      (fn as RawSchemaFunctionRecord).name !== baseFunctionName
    ) {
      continue
    }
    const params = (fn as RawSchemaFunctionRecord).params
    if (Array.isArray(params)) {
      for (const p of params as unknown[]) {
        if (
          typeof p === 'object' &&
          p !== null &&
          typeof (p as RawSchemaFunctionParamRecord).name === 'string'
        ) {
          validParamNames.add(
            (p as RawSchemaFunctionParamRecord).name as string,
          )
        }
      }
    }
    break
  }
  return validParamNames
}

function validateTemplateDefaultValue(
  value: unknown,
  valuePath: string,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError(`${valuePath} must be an object with "kind" field`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const v = value as Record<string, unknown>
  if (v['kind'] === 'scalar') {
    const val = v['value']
    if (
      typeof val !== 'string' &&
      typeof val !== 'number' &&
      typeof val !== 'boolean'
    ) {
      errors.push(
        createError(
          `${valuePath} scalar value must be string, number, or boolean`,
          { code: 'INVALID_FIELD_TYPE' },
        ),
      )
    }
  } else if (v['kind'] === 'lua') {
    if (typeof v['lua'] !== 'string') {
      errors.push(
        createError(`${valuePath} lua value must have a "lua" string field`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    }
  } else if (v['kind'] === 'multiselect') {
    if (
      !Array.isArray(v['values']) ||
      !v['values'].every((entry) => typeof entry === 'string')
    ) {
      errors.push(
        createError(
          `${valuePath} multiselect value must have a "values" array of strings`,
          { code: 'INVALID_FIELD_TYPE' },
        ),
      )
    }
  } else if (v['kind'] === 'object') {
    if (
      typeof v['entries'] !== 'object' ||
      v['entries'] === null ||
      Array.isArray(v['entries'])
    ) {
      errors.push(
        createError(`${valuePath} object value must have an "entries" object`, {
          code: 'INVALID_FIELD_TYPE',
        }),
      )
    } else {
      for (const [entryName, entryValue] of Object.entries(v['entries'])) {
        errors.push(
          ...validateTemplateDefaultValue(
            entryValue,
            `${valuePath}.entries[${JSON.stringify(entryName)}]`,
          ),
        )
      }
    }
  } else {
    errors.push(
      createError(
        `${valuePath} must have kind "scalar", "lua", "multiselect", or "object", got "${String(v['kind'])}"`,
        { code: 'INVALID_FIELD_TYPE' },
      ),
    )
  }

  return errors
}

function validateTemplateDefaults(
  defaults: unknown,
  prefix: string,
  baseFunctionName: string | undefined,
  functions: unknown,
): ValidationError[] {
  const errors: ValidationError[] = []

  if (
    typeof defaults !== 'object' ||
    defaults === null ||
    Array.isArray(defaults)
  ) {
    errors.push(
      createError(`${prefix}.defaults must be an object`, {
        code: 'INVALID_FIELD_TYPE',
      }),
    )
    return errors
  }

  const validParamNames =
    baseFunctionName !== undefined
      ? buildBaseFunctionParamNames(baseFunctionName, functions)
      : new Set<string>()

  for (const [paramName, value] of Object.entries(
    defaults as Record<string, unknown>,
  )) {
    if (validParamNames.size > 0 && !validParamNames.has(paramName)) {
      errors.push(
        createError(
          `${prefix}.defaults has unknown param "${paramName}" ` +
            `(base function "${baseFunctionName ?? '?'}" has params: [${[...validParamNames].join(', ')}])`,
          { code: 'INVALID_FIELD_TYPE' },
        ),
      )
    }
    errors.push(
      ...validateTemplateDefaultValue(
        value,
        `${prefix}.defaults[${JSON.stringify(paramName)}]`,
      ),
    )
  }

  return errors
}

// ============================================
// Plugin Keymap Schema Validation
// ============================================

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: structural plugin-keymap option validation spans modes, callbacks, and nested command tables with ordered error emission
function validatePluginKeymapOption(
  option: unknown,
  errors: ValidationError[],
): void {
  const opt = option as Record<string, unknown>
  const optKey = String(opt['key'] ?? '<unknown>')

  // --- Required fields ---

  // commands is required and must be a non-empty array
  if (!Array.isArray(opt['commands']) || opt['commands'].length === 0) {
    errors.push(
      createError(
        `plugin-keymap option "${optKey}" must have a non-empty 'commands' array`,
        { code: 'INVALID_FIELD_TYPE', source: optKey },
      ),
    )
    return // Can't validate further without commands
  }

  // presets is required and must be a non-empty array
  if (!Array.isArray(opt['presets']) || opt['presets'].length === 0) {
    errors.push(
      createError(
        `plugin-keymap option "${optKey}" must have a non-empty 'presets' array`,
        { code: 'INVALID_FIELD_TYPE', source: optKey },
      ),
    )
    return // Can't validate further without presets
  }

  // defaultPreset is required and must be a non-empty string
  if (typeof opt['defaultPreset'] !== 'string' || opt['defaultPreset'] === '') {
    errors.push(
      createError(
        `plugin-keymap option "${optKey}" must have a non-empty 'defaultPreset' string`,
        { code: 'INVALID_FIELD_TYPE', source: optKey },
      ),
    )
    return
  }

  // --- Command validation ---

  const commandNames = new Set<string>()
  for (const cmd of opt['commands'] as unknown[]) {
    if (typeof cmd !== 'object' || cmd === null) {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": each command must be an object`,
          { source: optKey },
        ),
      )
      continue
    }
    const c = cmd as Record<string, unknown>
    if (typeof c['name'] !== 'string' || c['name'] === '') {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": command must have a non-empty 'name'`,
          { source: optKey },
        ),
      )
    } else {
      // Uniqueness check for command names
      if (commandNames.has(c['name'])) {
        errors.push(
          createError(
            `plugin-keymap option "${optKey}": duplicate command name "${c['name']}"`,
            { code: 'INVALID_FIELD_VALUE', source: optKey },
          ),
        )
      }
      commandNames.add(c['name'])
    }
    if (typeof c['label'] !== 'string' || c['label'] === '') {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": command must have a non-empty 'label'`,
          { source: optKey },
        ),
      )
    }
  }

  // --- Preset validation ---

  const presetIds = new Set<string>()
  for (const preset of opt['presets'] as unknown[]) {
    if (typeof preset !== 'object' || preset === null) {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": each preset must be an object`,
          { source: optKey },
        ),
      )
      continue
    }
    const p = preset as Record<string, unknown>

    // Preset id is required
    if (typeof p['id'] !== 'string' || p['id'] === '') {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": preset must have a non-empty 'id'`,
          { source: optKey },
        ),
      )
      continue
    }

    // Uniqueness check for preset ids
    if (presetIds.has(p['id'])) {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": duplicate preset id "${p['id']}"`,
          { code: 'INVALID_FIELD_VALUE', source: optKey },
        ),
      )
    }
    presetIds.add(p['id'])

    // Preset label is required
    if (typeof p['label'] !== 'string' || p['label'] === '') {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": preset "${p['id']}" must have a non-empty 'label'`,
          { source: optKey },
        ),
      )
    }

    // Validate that preset has a mappings object
    if (p['mappings'] === undefined || p['mappings'] === null) {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": preset "${p['id']}" must have a 'mappings' object`,
          { source: optKey },
        ),
      )
    } else if (
      typeof p['mappings'] !== 'object' ||
      Array.isArray(p['mappings'])
    ) {
      errors.push(
        createError(
          `plugin-keymap option "${optKey}": preset "${p['id']}" mappings must be an object`,
          { code: 'INVALID_FIELD_TYPE', source: optKey },
        ),
      )
    } else {
      // Validate that preset mapping commands reference valid command names
      for (const [key, cmds] of Object.entries(
        p['mappings'] as Record<string, unknown>,
      )) {
        if (!Array.isArray(cmds)) {
          errors.push(
            createError(
              `plugin-keymap option "${optKey}": preset "${p['id']}" mapping "${key}" must be an array of command names`,
              { code: 'INVALID_FIELD_TYPE', source: optKey },
            ),
          )
          continue
        }
        for (const cmd of cmds) {
          if (
            typeof cmd === 'string' &&
            commandNames.size > 0 &&
            !commandNames.has(cmd)
          ) {
            errors.push(
              createError(
                `Preset "${p['id']}" mapping "${key}" references unknown command "${cmd}"`,
                { code: 'INVALID_FIELD_VALUE', source: optKey },
              ),
            )
          }
        }
      }
    }
  }

  // --- defaultPreset membership check ---

  if (!presetIds.has(opt['defaultPreset'] as string)) {
    errors.push(
      createError(
        `plugin-keymap option "${optKey}": defaultPreset "${String(opt['defaultPreset'])}" does not match any preset id (available: ${[...presetIds].join(', ')})`,
        { code: 'INVALID_FIELD_VALUE', source: optKey },
      ),
    )
  }
}

/**
 * Validate the optional `_meta` editor metadata object in a plugin-keymap value.
 * This is UI-only data — not used for Lua generation.
 */
function validatePluginKeymapMeta(
  meta: PluginConfigValue,
  optionKey: string,
  errors: ValidationError[],
): void {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    errors.push(
      createError(
        `Option "${optionKey}": _meta must be an object when present`,
        { source: optionKey },
      ),
    )
    return
  }

  const metaObj = meta as Record<string, PluginConfigValue>

  // Validate rebindLinks if present
  if (metaObj['rebindLinks'] !== undefined) {
    const links = metaObj['rebindLinks']
    if (typeof links !== 'object' || links === null || Array.isArray(links)) {
      errors.push(
        createError(
          `Option "${optionKey}": _meta.rebindLinks must be an object (string-to-string map)`,
          { source: optionKey },
        ),
      )
      return
    }
    for (const [k, v] of Object.entries(
      links as Record<string, PluginConfigValue>,
    )) {
      if (typeof v !== 'string') {
        errors.push(
          createError(
            `Option "${optionKey}": _meta.rebindLinks["${k}"] must be a string`,
            { source: optionKey },
          ),
        )
      }
    }
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: runtime plugin-keymap value validation must preserve discriminated command shapes and conflict diagnostics
function validatePluginKeymapValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'plugin-keymap' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError(
        `Option "${option.key}" expects an object (plugin-keymap), got ${typeof value}`,
        { source: option.key },
      ),
    )
    return
  }

  const obj = value as Record<string, PluginConfigValue>
  const validCommandNames = new Set(option.commands.map((c) => c.name))
  const validPresetIds = new Set(option.presets.map((p) => p.id))

  // Validate preset (if present — absence means "use defaultPreset")
  if (obj['preset'] !== undefined) {
    if (typeof obj['preset'] !== 'string') {
      errors.push(
        createError(`Option "${option.key}": preset must be a string`, {
          source: option.key,
        }),
      )
    } else if (!validPresetIds.has(obj['preset'])) {
      errors.push(
        createError(
          `Invalid preset "${obj['preset']}" for option "${option.key}" (valid: ${[...validPresetIds].join(', ')})`,
          { code: 'INVALID_FIELD_VALUE', source: option.key },
        ),
      )
    }
  }

  // Validate overrides
  if (obj['overrides'] !== undefined) {
    if (
      typeof obj['overrides'] !== 'object' ||
      obj['overrides'] === null ||
      Array.isArray(obj['overrides'])
    ) {
      errors.push(
        createError(`Option "${option.key}": overrides must be an object`, {
          source: option.key,
        }),
      )
      return
    }
    for (const [key, cmds] of Object.entries(
      obj['overrides'] as Record<string, PluginConfigValue>,
    )) {
      if (cmds === false) {
        // Disabled key — valid only if allowDisable is true
        if (option.allowDisable !== true) {
          errors.push(
            createError(
              `Option "${option.key}": key "${key}" set to false but allowDisable is not enabled`,
              { code: 'INVALID_FIELD_VALUE', source: option.key },
            ),
          )
        }
        continue
      }
      if (!Array.isArray(cmds)) {
        errors.push(
          createError(
            `Option "${option.key}": override "${key}" must be an array of commands or false`,
            { source: option.key },
          ),
        )
        continue
      }
      if (cmds.length === 0) {
        errors.push(
          createError(
            `Option "${option.key}": override "${key}" has empty command list (use false to disable, or remove the override)`,
            { code: 'INVALID_FIELD_VALUE', source: option.key },
          ),
        )
        continue
      }
      for (const cmd of cmds) {
        if (typeof cmd === 'string') {
          if (!validCommandNames.has(cmd)) {
            errors.push(
              createError(
                `Override "${key}" references unknown command "${cmd}"`,
                { code: 'INVALID_FIELD_VALUE', source: option.key },
              ),
            )
          }
        } else if (
          typeof cmd === 'object' &&
          cmd !== null &&
          'lua' in (cmd as Record<string, unknown>)
        ) {
          // Custom Lua entry - validate non-empty
          const lua = (cmd as Record<string, unknown>)['lua']
          if (typeof lua !== 'string' || (lua as string).trim() === '') {
            errors.push(
              createError(`Override "${key}" has empty Lua entry`, {
                source: option.key,
              }),
            )
          }
        } else {
          errors.push(
            createError(
              `Override "${key}" has invalid command entry: must be a string or { lua: "..." }`,
              { source: option.key },
            ),
          )
        }
      }
    }
  }

  // Validate _meta if present (editor metadata — not used for Lua generation)
  if (obj['_meta'] !== undefined) {
    validatePluginKeymapMeta(obj['_meta'], option.key, errors)
  }

  // Reject unknown top-level keys
  // '_meta' is the canonical editor metadata namespace (forward-compatible).
  // 'rebindLinks' is accepted as a legacy compatibility key (read-only migration path).
  const validTopLevelKeys = new Set([
    'preset',
    'overrides',
    '_meta',
    'rebindLinks',
  ])
  for (const key of Object.keys(obj)) {
    if (!validTopLevelKeys.has(key)) {
      errors.push(
        createError(
          `Option "${option.key}": unexpected key "${key}" in plugin-keymap value (expected: preset, overrides, _meta)`,
          { source: option.key },
        ),
      )
    }
  }
}

// ============================================
// Config Validation (user values against schema)
// ============================================

/**
 * Validate user's plugin configuration values against a schema.
 * @param config - The user's configured values
 * @param schema - The plugin schema defining valid options
 * @returns ValidationResult with specific errors per option
 */
export function validateConfig(
  config: Record<string, PluginConfigValue>,
  schema: PluginSchema,
): ValidationResult {
  const errors: ValidationError[] = []

  for (const option of schema.options) {
    const value = config[option.key]
    const optErrors = validateOptionValue(value, option)
    errors.push(...optErrors)
  }

  if (errors.length > 0) {
    return validationFailure(errors)
  }
  return validationSuccess()
}

/**
 * Validate a single option's user-configured value against its schema definition.
 */
function validateOptionValue(
  value: PluginConfigValue | undefined,
  option: SchemaOption,
): ValidationError[] {
  const errors: ValidationError[] = []

  // Required check
  if (value === undefined) {
    if (option.required === true) {
      errors.push(
        createError(`Required option "${option.key}" is missing`, {
          code: 'REQUIRED_VALUE_MISSING',
          source: option.key,
        }),
      )
    }
    // If not required and undefined, skip further validation (use default)
    return errors
  }

  switch (option.type) {
    case 'string':
      validateStringValue(value, option, errors)
      break
    case 'number':
      validateNumberValue(value, option, errors)
      break
    case 'boolean':
      validateBooleanValue(value, option, errors)
      break
    case 'select':
      validateSelectValue(value, option, errors)
      break
    case 'array':
      validateArrayValue(value, option, errors)
      break
    case 'mapping-table':
      validateMappingTableValue(value, option, errors)
      break
    case 'object':
      validateObjectValue(value, option, errors)
      break
    case 'color':
      validateColorValue(value, option, errors)
      break
    case 'keysequence':
      validateKeySequenceValue(value, option, errors)
      break
    case 'lua':
      validateLuaValue(value, option, errors)
      break
    case 'plugin-keymap':
      validatePluginKeymapValue(value, option, errors)
      break
  }

  return errors
}

function validateStringValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'string' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push(
      createError(`Option "${option.key}" must be a string`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  const v = option.validation
  if (v !== undefined) {
    if (v.minLength !== undefined && value.length < v.minLength) {
      errors.push(
        createError(
          `Option "${option.key}" must be at least ${String(v.minLength)} characters`,
          { code: 'STRING_TOO_SHORT', source: option.key },
        ),
      )
    }
    if (v.maxLength !== undefined && value.length > v.maxLength) {
      errors.push(
        createError(
          `Option "${option.key}" must be at most ${String(v.maxLength)} characters`,
          { code: 'STRING_TOO_LONG', source: option.key },
        ),
      )
    }
    if (v.pattern !== undefined) {
      try {
        const regex = new RegExp(v.pattern)
        if (!regex.test(value)) {
          errors.push(
            createError(
              `Option "${option.key}" does not match pattern "${v.pattern}"`,
              { code: 'PATTERN_MISMATCH', source: option.key },
            ),
          )
        }
      } catch {
        errors.push(
          createError(
            `Option "${option.key}" has invalid regex pattern "${v.pattern}"`,
            { code: 'INVALID_VALIDATION_RULE', source: option.key },
          ),
        )
      }
    }
  }
}

function validateMappingTableValue(
  value: PluginConfigValue,
  option: Extract<SchemaOption, { readonly type: 'mapping-table' }>,
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(
      createError(`Option "${option.key}" must be an array of rows`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  for (const row of value) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      errors.push(
        createError(`Option "${option.key}" rows must be objects`, {
          code: 'TYPE_MISMATCH',
          source: option.key,
        }),
      )
      return
    }

    const validatedRow = validateMappingTableRowForEmit(option, row)
    if (!validatedRow.success) {
      errors.push(
        createError(`Option "${option.key}" ${validatedRow.error}`, {
          code: 'TYPE_MISMATCH',
          source: option.key,
        }),
      )
    }
  }
}

function validateNumberValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'number' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'number') {
    errors.push(
      createError(`Option "${option.key}" must be a number`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  const v = option.validation
  if (v !== undefined) {
    if (v.integer === true && !Number.isInteger(value)) {
      errors.push(
        createError(`Option "${option.key}" must be an integer`, {
          code: 'TYPE_MISMATCH',
          source: option.key,
        }),
      )
    }
    if (v.min !== undefined && value < v.min) {
      errors.push(
        createError(`Option "${option.key}" must be >= ${String(v.min)}`, {
          code: 'VALUE_OUT_OF_RANGE',
          source: option.key,
        }),
      )
    }
    if (v.max !== undefined && value > v.max) {
      errors.push(
        createError(`Option "${option.key}" must be <= ${String(v.max)}`, {
          code: 'VALUE_OUT_OF_RANGE',
          source: option.key,
        }),
      )
    }
  }
}

function validateBooleanValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'boolean' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'boolean') {
    errors.push(
      createError(`Option "${option.key}" must be a boolean`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
  }
}

function validateSelectValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'select' },
  errors: ValidationError[],
): void {
  const validValues = option.options.map((o) => o.value)

  if (option.multi === true) {
    validateMultiSelectValue(value, option, validValues, errors)
    return
  }

  validateSingleSelectValue(value, option, validValues, errors)
}

function validateMultiSelectValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'select' },
  validValues: string[],
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(
      createError(`Option "${option.key}" must be an array for multi-select`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push(
        createError(`Option "${option.key}" array items must be strings`, {
          code: 'TYPE_MISMATCH',
          source: option.key,
        }),
      )
      continue
    }

    if (!validValues.includes(item)) {
      errors.push(
        createError(
          `Option "${option.key}" has invalid value "${item}". Valid: ${validValues.join(', ')}`,
          { code: 'INVALID_OPTION_VALUE', source: option.key },
        ),
      )
    }
  }
}

function validateSingleSelectValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'select' },
  validValues: string[],
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push(
      createError(`Option "${option.key}" must be a string`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  if (!validValues.includes(value)) {
    errors.push(
      createError(
        `Option "${option.key}" has invalid value "${value}". Valid: ${validValues.join(', ')}`,
        { code: 'INVALID_OPTION_VALUE', source: option.key },
      ),
    )
  }
}

function validateArrayValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'array' },
  errors: ValidationError[],
): void {
  if (!Array.isArray(value)) {
    errors.push(
      createError(`Option "${option.key}" must be an array`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  validateArrayLengthRules(value, option, errors)

  for (const item of value) {
    validateArrayItemValue(item, option, errors)
  }
}

function validateArrayLengthRules(
  value: PluginConfigValue[],
  option: SchemaOption & { readonly type: 'array' },
  errors: ValidationError[],
): void {
  const validation = option.validation
  if (validation === undefined) {
    return
  }

  if (validation.minItems !== undefined && value.length < validation.minItems) {
    errors.push(
      createError(
        `Option "${option.key}" must have at least ${String(validation.minItems)} items`,
        { code: 'ARRAY_TOO_FEW', source: option.key },
      ),
    )
  }

  if (validation.maxItems !== undefined && value.length > validation.maxItems) {
    errors.push(
      createError(
        `Option "${option.key}" must have at most ${String(validation.maxItems)} items`,
        { code: 'ARRAY_TOO_MANY', source: option.key },
      ),
    )
  }

  if (validation.uniqueItems === true) {
    const serializedItems = value.map((item) => JSON.stringify(item))
    const uniqueSet = new Set(serializedItems)
    if (uniqueSet.size !== serializedItems.length) {
      errors.push(
        createError(`Option "${option.key}" must have unique items`, {
          code: 'ARRAY_NOT_UNIQUE',
          source: option.key,
        }),
      )
    }
  }
}

function validateArrayItemValue(
  item: PluginConfigValue,
  option: SchemaOption & { readonly type: 'array' },
  errors: ValidationError[],
): void {
  switch (option.items.itemType) {
    case 'string':
      if (typeof item !== 'string') {
        errors.push(
          createError(`Option "${option.key}" array items must be strings`, {
            code: 'TYPE_MISMATCH',
            source: option.key,
          }),
        )
      }
      return
    case 'number':
      if (typeof item !== 'number') {
        errors.push(
          createError(`Option "${option.key}" array items must be numbers`, {
            code: 'TYPE_MISMATCH',
            source: option.key,
          }),
        )
      }
      return
    case 'select':
      validateArraySelectItemValue(item, option, errors)
      return
  }
}

function validateArraySelectItemValue(
  item: PluginConfigValue,
  option: SchemaOption & { readonly type: 'array' },
  errors: ValidationError[],
): void {
  if (typeof item !== 'string') {
    errors.push(
      createError(`Option "${option.key}" array items must be strings`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  if (option.items.itemType !== 'select') {
    return
  }

  const validValues = option.items.options.map((o) => o.value)
  if (!validValues.includes(item)) {
    errors.push(
      createError(
        `Option "${option.key}" array item "${item}" is not valid. Valid: ${validValues.join(', ')}`,
        { code: 'INVALID_OPTION_VALUE', source: option.key },
      ),
    )
  }
}

function validateObjectValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'object' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(
      createError(`Option "${option.key}" must be an object`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  // Recursively validate nested properties
  const objValue = value as Record<string, PluginConfigValue>
  for (const prop of option.properties) {
    const propValue = objValue[prop.key]
    const propErrors = validateOptionValue(propValue, prop)
    errors.push(...propErrors)
  }
}

function validateColorValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'color' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push(
      createError(`Option "${option.key}" must be a string`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  const format = option.format ?? 'hex'
  let valid = false

  switch (format) {
    case 'hex':
      valid = HEX_COLOR_PATTERN.test(value)
      break
    case 'rgb':
      valid = RGB_COLOR_PATTERN.test(value)
      break
    case 'hsl':
      valid = HSL_COLOR_PATTERN.test(value)
      break
  }

  if (!valid) {
    errors.push(
      createError(`Option "${option.key}" must be a valid ${format} color`, {
        code: 'INVALID_COLOR_FORMAT',
        source: option.key,
      }),
    )
  }
}

function validateKeySequenceValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'keysequence' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push(
      createError(`Option "${option.key}" must be a string`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
    return
  }

  if (value === '') {
    errors.push(
      createError(`Option "${option.key}" must be a non-empty key sequence`, {
        code: 'INVALID_KEY_SEQUENCE',
        source: option.key,
      }),
    )
  }
}

function validateLuaValue(
  value: PluginConfigValue,
  option: SchemaOption & { readonly type: 'lua' },
  errors: ValidationError[],
): void {
  if (typeof value !== 'string') {
    errors.push(
      createError(`Option "${option.key}" must be a string`, {
        code: 'TYPE_MISMATCH',
        source: option.key,
      }),
    )
  }
}
