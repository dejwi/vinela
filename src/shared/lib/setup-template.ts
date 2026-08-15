// ============================================
// Plugin Setup Lua Template Rendering
// ============================================

const CONFIG_PLACEHOLDER = '{{config}}'
const REQUIRE_PATH_PLACEHOLDER = '{{requirePath}}'

const ALLOWED_PLACEHOLDERS = new Set([
  CONFIG_PLACEHOLDER,
  REQUIRE_PATH_PLACEHOLDER,
])

export interface SetupTemplateRenderInput {
  readonly template: string
  /** Pre-serialized Lua table literal for {{config}} substitution */
  readonly serializedConfig: string
  /** Pre-serialized Lua string literal for {{requirePath}} substitution */
  readonly serializedRequirePath: string
}

export interface SetupTemplateValidationError {
  readonly path: string
  readonly message: string
}

/**
 * Validate a setup Lua template string.
 * Requires at least one {{config}} token; permits {{requirePath}} zero or more times.
 */
export function validateSetupTemplate(
  template: string,
): SetupTemplateValidationError[] {
  const errors: SetupTemplateValidationError[] = []

  if (template.trim().length === 0) {
    errors.push({
      path: 'setup.render.template',
      message: 'setup.render.template must be a non-empty string',
    })
    return errors
  }

  if (!template.includes(CONFIG_PLACEHOLDER)) {
    errors.push({
      path: 'setup.render.template',
      message: `setup.render.template must contain at least one ${CONFIG_PLACEHOLDER} placeholder`,
    })
  }

  const placeholderPattern = /\{\{[^}]+\}\}/g
  const matches = template.match(placeholderPattern) ?? []
  for (const token of matches) {
    if (!ALLOWED_PLACEHOLDERS.has(token)) {
      errors.push({
        path: 'setup.render.template',
        message: `setup.render.template contains unknown placeholder ${token}`,
      })
    }
  }

  return errors
}

/**
 * Render a setup Lua template by substituting pre-serialized config and requirePath.
 */
export function renderSetupTemplate(input: SetupTemplateRenderInput): string {
  const validationErrors = validateSetupTemplate(input.template)
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]?.message ?? 'Invalid setup template')
  }

  return input.template
    .split(CONFIG_PLACEHOLDER)
    .join(input.serializedConfig)
    .split(REQUIRE_PATH_PLACEHOLDER)
    .join(input.serializedRequirePath)
}
