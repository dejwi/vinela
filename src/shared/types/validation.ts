/**
 * Result of any validation operation.
 * Used for schema validation, Lua syntax checking, etc.
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  message: string
  /** Line number if applicable (1-indexed) */
  line?: number
  /** Column number if applicable (1-indexed) */
  column?: number
  /** Error code for programmatic handling */
  code?: string
  /** Source file or context */
  source?: string
}

export interface ValidationWarning {
  message: string
  line?: number
  column?: number
  code?: string
  source?: string
}

/**
 * Helper to create a successful validation result
 */
export function validationSuccess(): ValidationResult {
  return { valid: true, errors: [], warnings: [] }
}

/**
 * Helper to create a failed validation result
 */
export function validationFailure(
  errors: ValidationError[],
  warnings: ValidationWarning[] = [],
): ValidationResult {
  return { valid: false, errors, warnings }
}

/**
 * Helper to create a simple error
 */
export function createError(
  message: string,
  options?: Partial<Omit<ValidationError, 'message'>>,
): ValidationError {
  return { message, ...options }
}

// ============================================
// Schema Validation Error Codes
// ============================================

/**
 * Specific error codes for schema validation.
 * Used in ValidationError.code field.
 */
export type SchemaValidationCode =
  | 'MISSING_REQUIRED_FIELD' // Required field missing in schema definition
  | 'INVALID_FIELD_TYPE' // Field has wrong type
  | 'INVALID_OPTION_TYPE' // Unknown option type
  | 'DUPLICATE_OPTION_KEY' // Two options have same key
  | 'DUPLICATE_FUNCTION_NAME' // Duplicate function name within a schema
  | 'DUPLICATE_FUNCTION_PARAM_NAME' // Duplicate param name within a function
  | 'INVALID_DEFAULT_VALUE' // Default value doesn't match option type
  | 'INVALID_VALIDATION_RULE' // Validation rule is malformed
  | 'MISSING_SELECT_OPTIONS' // Select type without options
  | 'INVALID_LUA_CALL' // Function luaCall template is malformed
  | 'CIRCULAR_DEPENDENCY' // Plugin depends on itself
  | 'UNKNOWN_DEPENDENCY' // Dependency not found in loaded schemas
  | 'DUPLICATE_EX_COMMAND_NAME' // Duplicate exCommand name within a schema
  | 'INVALID_EX_COMMAND_TEMPLATE' // Ex command template doesn't match params

/**
 * Specific error codes for config validation (user values against schema).
 */
export type ConfigValidationCode =
  | 'REQUIRED_VALUE_MISSING' // Required option not configured
  | 'TYPE_MISMATCH' // Value type doesn't match schema type
  | 'VALUE_OUT_OF_RANGE' // Number out of min/max range
  | 'STRING_TOO_SHORT' // String shorter than minLength
  | 'STRING_TOO_LONG' // String longer than maxLength
  | 'PATTERN_MISMATCH' // String doesn't match pattern
  | 'INVALID_OPTION_VALUE' // Select value not in options list
  | 'ARRAY_TOO_FEW' // Array has fewer items than minItems
  | 'ARRAY_TOO_MANY' // Array has more items than maxItems
  | 'ARRAY_NOT_UNIQUE' // Array has duplicate items (uniqueItems)
  | 'INVALID_COLOR_FORMAT' // Color doesn't match expected format
  | 'INVALID_KEY_SEQUENCE' // Key sequence is malformed
