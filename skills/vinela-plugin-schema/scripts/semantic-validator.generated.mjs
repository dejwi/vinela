/**
 * @generated
 * Authority src/shared/lib/schema-validation.ts SHA-256: 81012255f90d367ff8f117ecbeb1d65a420dfcc6d84f4f2ccd70306b9fb12ded
 * Authority src/features/lua-generator/utils/schema-shape-invariants.ts SHA-256: 841c188b8bbb92d6a51eacf00edb44f89ce128e073e839aa171b03cf8d8040e9
 * Closure digest: ea4b659e907d1f85a073588a9c47de9d5cd61bb897d435ae99a83f3aaf1996f0
 * Command: bun run schema:validator:build
 * Bun: 1.3.14
 * Producer policy: Canonical artifacts are produced on Linux x64 with Bun 1.3.14.
 */
var PLUGIN_CATEGORIES = [
  "editor",
  "lsp",
  "ui",
  "navigation",
  "git",
  "debugging",
  "syntax",
  "utility"
];
function validationSuccess() {
  return { valid: true, errors: [], warnings: [] };
}
function validationFailure(errors, warnings = []) {
  return { valid: false, errors, warnings };
}
function createError(message, options) {
  return { message, ...options };
}
var POSITIONAL_RE = /\$params(?!\.)/g;
var NAMED_RE = /\$params\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
function analyzeTemplate(template) {
  POSITIONAL_RE.lastIndex = 0;
  const hasPositional = POSITIONAL_RE.test(template);
  POSITIONAL_RE.lastIndex = 0;
  const namedMatches = [];
  NAMED_RE.lastIndex = 0;
  for (let match = NAMED_RE.exec(template);match !== null; match = NAMED_RE.exec(template)) {
    const name = match[1];
    if (name !== undefined && !namedMatches.includes(name)) {
      namedMatches.push(name);
    }
  }
  NAMED_RE.lastIndex = 0;
  const hasNamed = namedMatches.length > 0;
  if (hasPositional && !hasNamed) {
    return { mode: "positional", namedPlaceholders: [], template };
  }
  if (hasNamed && !hasPositional) {
    return { mode: "named", namedPlaceholders: namedMatches, template };
  }
  return { mode: "positional", namedPlaceholders: [], template };
}
function extractNamedMatches(template) {
  const namedMatches = [];
  const namedRe = /\$params\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  for (let match = namedRe.exec(template);match !== null; match = namedRe.exec(template)) {
    const name = match[1];
    if (name !== undefined && !namedMatches.includes(name)) {
      namedMatches.push(name);
    }
  }
  return namedMatches;
}
function validateNamedPlaceholders(namedMatches, declaredParams, issues) {
  const declaredNames = new Set(declaredParams.map((p) => p.name));
  for (const name of namedMatches) {
    if (!declaredNames.has(name)) {
      issues.push({
        code: "NAMED_PLACEHOLDER_UNDECLARED_PARAM",
        message: `Named placeholder "$params.${name}" does not match any declared parameter. Declared: ${[...declaredNames].join(", ") || "(none)"}`
      });
    }
  }
  const referencedNames = new Set(namedMatches);
  for (const param of declaredParams) {
    if (!(param.optional ?? false) && !referencedNames.has(param.name)) {
      issues.push({
        code: "REQUIRED_PARAM_NOT_REFERENCED",
        message: `Required parameter "${param.name}" is not referenced in the template. Add $params.${param.name} or mark it optional.`
      });
    }
  }
}
function validateTemplate(template, declaredParams) {
  const issues = [];
  const hasPositional = /\$params(?!\.)/.test(template);
  const namedMatches = extractNamedMatches(template);
  const hasNamed = namedMatches.length > 0;
  if (hasPositional && hasNamed) {
    issues.push({
      code: "MIXED_PLACEHOLDER_MODES",
      message: "Template mixes positional ($params) and named ($params.<name>) placeholders. Use one mode only."
    });
  }
  if (hasNamed) {
    validateNamedPlaceholders(namedMatches, declaredParams, issues);
  }
  if (declaredParams.length > 0 && !hasPositional && !hasNamed) {
    issues.push({
      code: "DECLARED_PARAMS_NO_PLACEHOLDER",
      message: "Template has declared parameters but no $params placeholder. Add $params or $params.<name> placeholders."
    });
  }
  if (issues.length > 0) {
    return {
      valid: false,
      issues,
      errors: issues.map((issue) => issue.message)
    };
  }
  return {
    valid: true,
    analysis: analyzeTemplate(template)
  };
}

var TEMPLATE_PLACEHOLDER_PATTERN = /{{\s*([^}]+?)\s*}}/g;
var SAFE_RAW_LUA_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
function parsePlaceholderToken(token) {
  if (token === "outputKey") {
    return { success: true, value: { kind: "output-key" } };
  }
  if (token.startsWith("row.")) {
    const columnKey = token.slice(4);
    if (columnKey.length === 0) {
      return {
        success: false,
        error: "row placeholder must reference a column key"
      };
    }
    return {
      success: true,
      value: { kind: "row-column", columnKey }
    };
  }
  return {
    success: false,
    error: `unsupported placeholder "${token}"`
  };
}
function extractMappingTableTemplatePlaceholders(template) {
  const placeholders = [];
  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    const rawToken = match[1];
    if (rawToken === undefined) {
      continue;
    }
    const parsed = parsePlaceholderToken(rawToken.trim());
    if (parsed.success) {
      placeholders.push(parsed.value);
    }
  }
  return placeholders;
}
function validateMappingTableTemplatePlaceholders(template) {
  const errors = [];
  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    const rawToken = match[1];
    if (rawToken === undefined) {
      continue;
    }
    const parsed = parsePlaceholderToken(rawToken.trim());
    if (!parsed.success) {
      errors.push(parsed.error);
    }
  }
  return errors;
}
function isSafeRawLuaIdentifier(value) {
  return SAFE_RAW_LUA_IDENTIFIER_PATTERN.test(value);
}

function buildSchemaOptionPathIndex(options, accessors) {
  const entries = [];
  const bySchemaPath = new Map;
  const byEffectiveEmitPath = new Map;
  const visit = (option, parentSchemaPath, parentEmitPath) => {
    const key = accessors.getKey(option);
    if (key === undefined || key.trim().length === 0) {
      return;
    }
    const localEmitKey = accessors.getEmitKey(option) ?? key;
    const schemaPath = parentSchemaPath === undefined ? key : `${parentSchemaPath}.${key}`;
    const effectiveEmitPath = parentEmitPath === undefined ? localEmitKey : `${parentEmitPath}.${localEmitKey}`;
    const entry = {
      option,
      schemaPath,
      effectiveEmitPath
    };
    entries.push(entry);
    bySchemaPath.set(schemaPath, entry);
    byEffectiveEmitPath.set(effectiveEmitPath, entry);
    if (!accessors.isObjectOption(option)) {
      return;
    }
    for (const property of accessors.getProperties(option)) {
      visit(property, schemaPath, effectiveEmitPath);
    }
  };
  for (const option of options) {
    visit(option, undefined, undefined);
  }
  return {
    entries,
    bySchemaPath,
    byEffectiveEmitPath
  };
}

var CONFIG_PLACEHOLDER = "{{config}}";
var REQUIRE_PATH_PLACEHOLDER = "{{requirePath}}";
var ALLOWED_PLACEHOLDERS = new Set([
  CONFIG_PLACEHOLDER,
  REQUIRE_PATH_PLACEHOLDER
]);
function validateSetupTemplate(template) {
  const errors = [];
  if (template.trim().length === 0) {
    errors.push({
      path: "setup.render.template",
      message: "setup.render.template must be a non-empty string"
    });
    return errors;
  }
  if (!template.includes(CONFIG_PLACEHOLDER)) {
    errors.push({
      path: "setup.render.template",
      message: `setup.render.template must contain at least one ${CONFIG_PLACEHOLDER} placeholder`
    });
  }
  const placeholderPattern = /\{\{[^}]+\}\}/g;
  const matches = template.match(placeholderPattern) ?? [];
  for (const token of matches) {
    if (!ALLOWED_PLACEHOLDERS.has(token)) {
      errors.push({
        path: "setup.render.template",
        message: `setup.render.template contains unknown placeholder ${token}`
      });
    }
  }
  return errors;
}

var VALID_OPTION_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "select",
  "array",
  "mapping-table",
  "object",
  "color",
  "keysequence",
  "lua",
  "plugin-keymap"
]);
var VALID_PORT_DATA_TYPES = new Set([
  "any",
  "string",
  "number",
  "boolean",
  "buffer",
  "window",
  "table",
  "void"
]);
var VALID_ARRAY_ITEM_TYPES = new Set([
  "string",
  "number",
  "select"
]);
var VALID_PARAM_EMISSION_UNSET_OPTIONAL = new Set([
  "emit-nil",
  "omit-trailing"
]);
function validateSchema(schema) {
  if (typeof schema !== "object" || schema === null) {
    return validationFailure([
      createError("Schema must be a JSON object", {
        code: "INVALID_FIELD_TYPE"
      })
    ]);
  }
  const errors = [];
  const warnings = [];
  const s = schema;
  validateSchemaRequiredFields(s, errors);
  validateSchemaOptionsField(s.options, errors);
  validateSchemaFunctionsField(s.functions, errors);
  validateSchemaDependenciesField(s.dependencies, s.id, errors);
  validateSchemaPackField(s.pack, errors);
  validateSchemaExCommandsField(s.exCommands, errors);
  validateSchemaExCommandTemplatesField(s.exCommandTemplates, s.exCommands, errors);
  validateSchemaFunctionTemplatesField(s.functionTemplates, s.functions, errors);
  validateSchemaSetupField(s.setup, errors);
  validateSchemaGenerationRulesField(s.generationRules, s.options, errors);
  validateSchemaCapabilitiesField(s.capabilities, errors);
  validateSchemaMetadataFields(s, errors);
  if (errors.length > 0) {
    return validationFailure(errors, warnings);
  }
  return validationSuccess();
}
function validateSchemaPackField(pack, errors) {
  if (pack === undefined || pack === null) {
    return;
  }
  if (typeof pack !== "object" || Array.isArray(pack)) {
    errors.push(createError('"pack" must be an object', { code: "INVALID_FIELD_TYPE" }));
    return;
  }
  const rawPack = pack;
  if (rawPack["name"] !== undefined && (typeof rawPack["name"] !== "string" || rawPack["name"].trim().length === 0)) {
    errors.push(createError("pack.name must be a non-empty string when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  const rawVersion = rawPack["version"];
  if (rawVersion === undefined || rawVersion === null) {
    return;
  }
  if (typeof rawVersion !== "object" || Array.isArray(rawVersion)) {
    errors.push(createError("pack.version must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const versionRecord = rawVersion;
  const mode = versionRecord["mode"];
  const value = versionRecord["value"];
  if (mode !== "ref" && mode !== "semver-range") {
    errors.push(createError('pack.version.mode must be "ref" or "semver-range"', {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(createError("pack.version.value must be a non-empty string", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateSchemaSetupField(setup, errors) {
  if (setup === undefined || setup === null) {
    return;
  }
  if (typeof setup !== "object" || Array.isArray(setup)) {
    errors.push(createError("setup must be an object", { code: "INVALID_FIELD_TYPE" }));
    return;
  }
  const s = setup;
  if (typeof s["requirePath"] !== "string" || s["requirePath"].trim().length === 0) {
    errors.push(createError("setup.requirePath is required and must be a non-empty string", {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (s["setupFunction"] !== undefined) {
    if (typeof s["setupFunction"] !== "string" || s["setupFunction"].trim().length === 0) {
      errors.push(createError("setup.setupFunction must be a non-empty string", {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  }
  if (s["optionMapping"] !== undefined) {
    if (s["optionMapping"] !== "table" && s["optionMapping"] !== "individual") {
      errors.push(createError("setup.optionMapping must be 'table' or 'individual'", {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  }
  if (s["preSetup"] !== undefined && typeof s["preSetup"] !== "string") {
    errors.push(createError("setup.preSetup must be a string", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (s["postSetup"] !== undefined && typeof s["postSetup"] !== "string") {
    errors.push(createError("setup.postSetup must be a string", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  const hasRender = s["render"] !== undefined;
  if (hasRender) {
    validateSchemaSetupRenderField(s["render"], errors);
    if (s["setupFunction"] !== undefined) {
      errors.push(createError("setup.setupFunction cannot be used together with setup.render", { code: "INVALID_FIELD_TYPE" }));
    }
    if (s["optionMapping"] !== undefined) {
      errors.push(createError("setup.optionMapping cannot be used together with setup.render", { code: "INVALID_FIELD_TYPE" }));
    }
  }
}
function validateSchemaSetupRenderField(render, errors) {
  if (typeof render !== "object" || render === null || Array.isArray(render)) {
    errors.push(createError("setup.render must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const r = render;
  if (r["kind"] !== "lua-template") {
    errors.push(createError("setup.render.kind must be 'lua-template'", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  if (typeof r["template"] !== "string" || r["template"].trim().length === 0) {
    errors.push(createError("setup.render.template must be a non-empty string", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const templateError of validateSetupTemplate(r["template"])) {
    errors.push(createError(templateError.message, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function collectSchemaOptionKeys(options) {
  if (!Array.isArray(options)) {
    return new Set;
  }
  const pathIndex = buildSchemaOptionPathIndex(options, {
    getKey: (option) => typeof option.key === "string" && option.key.trim().length > 0 ? option.key : undefined,
    getEmitKey: (option) => typeof option.emitKey === "string" && option.emitKey.trim().length > 0 ? option.emitKey : undefined,
    isObjectOption: (option) => option.type === "object" && Array.isArray(option.properties),
    getProperties: (option) => Array.isArray(option.properties) ? option.properties : []
  });
  const keys = new Set;
  for (const entry of pathIndex.entries) {
    keys.add(entry.schemaPath);
  }
  return keys;
}
function validateSchemaGenerationRulesField(rules, options, errors) {
  if (rules === undefined) {
    return;
  }
  if (!Array.isArray(rules)) {
    errors.push(createError("generationRules must be an array when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const optionKeys = collectSchemaOptionKeys(options);
  for (const [index, rule] of rules.entries()) {
    validateSchemaGenerationRule(rule, optionKeys, index, errors);
  }
}
function validateSchemaGenerationRule(rule, optionKeys, index, errors) {
  const prefix = `generationRules[${String(index)}]`;
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const rawRule = rule;
  if (rawRule.kind !== "conflict" && rawRule.kind !== "subtree-gate" && rawRule.kind !== "subtree-filter") {
    errors.push(createError(`${prefix}.kind is invalid`, { code: "INVALID_FIELD_TYPE" }));
    return;
  }
  if (rawRule.kind === "conflict") {
    validateRuleKeyReference(rawRule.left, optionKeys, `${prefix}.left`, errors);
    validateRuleKeyReference(rawRule.right, optionKeys, `${prefix}.right`, errors);
    if (rawRule.severity !== "warning" && rawRule.severity !== "error") {
      errors.push(createError(`${prefix}.severity must be "warning" or "error"`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    if (rawRule.when !== undefined && rawRule.when !== "both-explicit" && rawRule.when !== "both-meaningful") {
      errors.push(createError(`${prefix}.when is invalid`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    validateOptionalNonEmptyString(rawRule.message, `${prefix}.message must be a non-empty string`, errors);
    return;
  }
  validateNonEmptyDotPath(rawRule.scope, `${prefix}.scope`, errors);
  if (rawRule.kind === "subtree-gate") {
    if (rawRule.action !== "omit-subtree") {
      errors.push(createError(`${prefix}.action must be "omit-subtree"`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    validateOptionalBoolean(rawRule.warnOnExplicitDescendants, `${prefix}.warnOnExplicitDescendants must be a boolean when provided`, errors);
    validateOptionalNonEmptyString(rawRule.message, `${prefix}.message must be a non-empty string when provided`, errors);
    validateSchemaOptionCondition(rawRule.when, "visibleWhen", errors);
    if (typeof rawRule.when === "object" && rawRule.when !== null) {
      validateRuleKeyReference(rawRule.when.key, optionKeys, `${prefix}.when.key`, errors);
    }
    return;
  }
  if (rawRule.mode !== "meaningful-only") {
    errors.push(createError(`${prefix}.mode must be "meaningful-only"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (rawRule.preserveKeys !== undefined) {
    validateOptionalStringArray(rawRule.preserveKeys, `${prefix}.preserveKeys`, `${prefix}.preserveKeys must be an array of non-empty strings when provided`, errors);
  }
}
function validateSchemaCapabilitiesField(capabilities, errors) {
  if (capabilities === undefined) {
    return;
  }
  if (!Array.isArray(capabilities)) {
    errors.push(createError("capabilities must be an array when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const [index, capability] of capabilities.entries()) {
    const prefix = `capabilities[${String(index)}]`;
    if (typeof capability !== "object" || capability === null || Array.isArray(capability)) {
      errors.push(createError(`${prefix} must be an object`, {
        code: "INVALID_FIELD_TYPE"
      }));
      continue;
    }
    const record = capability;
    if (record["kind"] === "lsp-package-installer") {
      if (record["provider"] !== "mason-registry") {
        errors.push(createError(`${prefix}.provider must be "mason-registry"`, {
          code: "INVALID_FIELD_TYPE"
        }));
      }
      continue;
    }
    if (record["kind"] === "lsp-server-enabler") {
      if (record["api"] !== "vim.lsp.enable") {
        errors.push(createError(`${prefix}.api must be "vim.lsp.enable"`, {
          code: "INVALID_FIELD_TYPE"
        }));
      }
      validateOptionalNonEmptyString(record["minNvimVersion"], `${prefix}.minNvimVersion must be a non-empty string`, errors);
      continue;
    }
    errors.push(createError(`${prefix}.kind is invalid`, { code: "INVALID_FIELD_TYPE" }));
  }
}
function validateRuleKeyReference(value, optionKeys, fieldName, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(createError(`${fieldName} must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  if (!optionKeys.has(value)) {
    errors.push(createError(`${fieldName} must reference an existing schema option key`, {
      code: "INVALID_VALIDATION_RULE"
    }));
  }
}
function validateNonEmptyDotPath(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(createError(`${fieldName} must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
var VALID_PLUGIN_CATEGORIES = new Set(PLUGIN_CATEGORIES);
var URL_PATTERN = /^https?:\/\/.+/;
function validateOptionalUrl(value, fieldName, errors) {
  if (value === undefined)
    return;
  if (typeof value !== "string" || value === "") {
    errors.push(createError(`"${fieldName}" must be a non-empty string when provided`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else if (!URL_PATTERN.test(value)) {
    errors.push(createError(`"${fieldName}" must be a valid URL (http:// or https://)`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateOptionalNonNegativeInteger(value, fieldName, errors) {
  if (value === undefined)
    return;
  if (typeof value !== "number") {
    errors.push(createError(`"${fieldName}" must be a number when provided`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else if (!Number.isInteger(value)) {
    errors.push(createError(`"${fieldName}" must be an integer`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else if (value < 0) {
    errors.push(createError(`"${fieldName}" must be a non-negative integer`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateOptionalBoundedString(value, fieldName, maxLength, errors) {
  if (value === undefined)
    return;
  if (typeof value !== "string" || value === "") {
    errors.push(createError(`"${fieldName}" must be a non-empty string when provided`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else if (value.length > maxLength) {
    errors.push(createError(`"${fieldName}" must be ${maxLength} characters or fewer`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateOptionalPluginCategory(value, errors) {
  if (value === undefined)
    return;
  if (typeof value !== "string" || !VALID_PLUGIN_CATEGORIES.has(value)) {
    errors.push(createError(`"category" must be one of: ${[...VALID_PLUGIN_CATEGORIES].join(", ")}`, { code: "INVALID_FIELD_TYPE" }));
  }
}
function validateSchemaMetadataFields(schema, errors) {
  validateOptionalNonEmptyString(schema.author, '"author" must be a non-empty string when provided', errors);
  validateOptionalNonNegativeInteger(schema.stars, "stars", errors);
  validateOptionalPluginCategory(schema.category, errors);
  validateOptionalStringArray(schema.tags, "tags", '"tags" must be an array of strings when provided', errors);
  validateOptionalBoundedString(schema.tagline, "tagline", 120, errors);
  validateOptionalUrl(schema.iconUrl, "iconUrl", errors);
}
function validateSchemaRequiredFields(schema, errors) {
  validateRequiredNonEmptyStringField(schema.id, 'Schema must have a non-empty "id" field', errors);
  validateRequiredNonEmptyStringField(schema.pluginName, 'Schema must have a non-empty "pluginName" field', errors);
  validateRequiredNonEmptyStringField(schema.pluginRepo, 'Schema must have a non-empty "pluginRepo" field', errors);
  validateRequiredNonEmptyStringField(schema.version, 'Schema must have a non-empty "version" field', errors);
}
function validateRequiredNonEmptyStringField(value, message, errors) {
  if (typeof value === "string" && value !== "") {
    return;
  }
  errors.push(createError(message, {
    code: "MISSING_REQUIRED_FIELD"
  }));
}
function validateSchemaOptionsField(options, errors) {
  if (!Array.isArray(options)) {
    errors.push(createError('"options" must be an array', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const keys = new Set;
  for (const opt of options) {
    errors.push(...validateSchemaOption(opt, keys));
  }
}
function validateSchemaFunctionsField(functions, errors) {
  if (!Array.isArray(functions)) {
    errors.push(createError('"functions" must be an array', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const seenFunctionNames = new Set;
  for (const fn of functions) {
    errors.push(...validateSchemaFunction(fn, seenFunctionNames));
  }
}
function validateSchemaDependenciesField(dependencies, schemaId, errors) {
  if (dependencies === undefined) {
    return;
  }
  if (!Array.isArray(dependencies)) {
    errors.push(createError('"dependencies" must be an array of strings', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const dep of dependencies) {
    if (typeof dep !== "string") {
      errors.push(createError("Each dependency must be a string", {
        code: "INVALID_FIELD_TYPE"
      }));
      continue;
    }
    if (typeof schemaId === "string" && dep === schemaId) {
      errors.push(createError("Plugin cannot depend on itself", {
        code: "CIRCULAR_DEPENDENCY"
      }));
    }
  }
}
function validateSchemaExCommandsField(exCommands, errors) {
  if (exCommands === undefined) {
    return;
  }
  if (!Array.isArray(exCommands)) {
    errors.push(createError('"exCommands" must be an array', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const seenNames = new Set;
  for (const [index, cmd] of exCommands.entries()) {
    errors.push(...validateSchemaExCommand(cmd, index, seenNames));
  }
}
function validateSchemaExCommand(cmd, index, seenNames) {
  const errors = [];
  const prefix = `exCommands[${String(index)}]`;
  if (typeof cmd !== "object" || cmd === null) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const c = cmd;
  if (typeof c.name !== "string" || c.name === "") {
    errors.push(createError(`${prefix} must have a non-empty "name" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    if (seenNames.has(c.name)) {
      errors.push(createError(`${prefix} has duplicate name "${c.name}"`, {
        code: "DUPLICATE_EX_COMMAND_NAME"
      }));
    }
    seenNames.add(c.name);
  }
  if (typeof c.description !== "string" || c.description === "") {
    errors.push(createError(`${prefix} must have a non-empty "description" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof c.template !== "string" || c.template === "") {
    errors.push(createError(`${prefix} must have a non-empty "template" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof c.example !== "string" || c.example === "") {
    errors.push(createError(`${prefix} must have a non-empty "example" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof c.sourceDoc !== "string" || c.sourceDoc === "") {
    errors.push(createError(`${prefix} must have a non-empty "sourceDoc" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (c.params !== undefined) {
    if (!Array.isArray(c.params)) {
      errors.push(createError(`${prefix}.params must be an array`, {
        code: "INVALID_FIELD_TYPE"
      }));
    } else {
      for (const [pIndex, param] of c.params.entries()) {
        errors.push(...validateSchemaExCommandParam(param, `${prefix}.params[${String(pIndex)}]`));
      }
      if (typeof c.template === "string") {
        const templatePlaceholders = new Set([...c.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
        for (const param of c.params) {
          if (typeof param === "object" && param !== null && typeof param.name === "string") {
            const paramName = param.name;
            if (!templatePlaceholders.has(paramName)) {
              errors.push(createError(`${prefix} param "${paramName}" has no matching {${paramName}} placeholder in template`, { code: "INVALID_EX_COMMAND_TEMPLATE" }));
            }
          }
        }
      }
    }
  }
  validateExCommandOptionalFields(c, prefix, errors);
  return errors;
}
function validateExCommandOptionalFields(c, prefix, errors) {
  validateOptionalNonEmptyString(c.label, `${prefix}.label must be a non-empty string when provided`, errors);
  validateOptionalNonEmptyString(c.shortDescription, `${prefix}.shortDescription must be a non-empty string when provided`, errors);
  validateOptionalNonEmptyString(c.category, `${prefix}.category must be a non-empty string when provided`, errors);
  validateOptionalNonEmptyString(c.whatItDoes, `${prefix}.whatItDoes must be a non-empty string when provided`, errors);
  validateOptionalNonEmptyString(c.technicalNote, `${prefix}.technicalNote must be a non-empty string when provided`, errors);
  validateOptionalBoolean(c.isPopular, `${prefix}.isPopular must be a boolean when provided`, errors);
  validateOptionalStringArray(c.aliases, `${prefix}.aliases`, `${prefix}.aliases must be an array of non-empty strings when provided`, errors);
}
function validateSchemaExCommandParam(param, prefix) {
  const errors = [];
  if (typeof param !== "object" || param === null) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const p = param;
  if (typeof p.name !== "string" || p.name === "") {
    errors.push(createError(`${prefix} must have a non-empty "name" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof p.placeholder !== "string") {
    errors.push(createError(`${prefix} must have a "placeholder" string field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof p.description !== "string" || p.description === "") {
    errors.push(createError(`${prefix} must have a non-empty "description" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  validateExCommandParamMetadata(p, prefix, errors);
  validateExCommandParamValues(p, prefix, errors);
  return errors;
}
function validateExCommandParamMetadata(param, prefix, errors) {
  validateOptionalNonEmptyString(param.label, `${prefix}.label must be a non-empty string`, errors);
  validateOptionalBoolean(param.optional, `${prefix}.optional must be a boolean`, errors);
  validateOptionalNonEmptyString(param.tier, `${prefix}.tier must be a non-empty string`, errors);
  if (param.tier !== undefined && param.tier !== "basic" && param.tier !== "advanced") {
    errors.push(createError(`${prefix}.tier is invalid`, { code: "INVALID_FIELD_TYPE" }));
  }
  validateOptionalNonEmptyString(param.group, `${prefix}.group must be a non-empty string`, errors);
  if (param.defaultValue !== undefined && typeof param.defaultValue !== "string" && typeof param.defaultValue !== "number" && typeof param.defaultValue !== "boolean") {
    errors.push(createError(`${prefix}.defaultValue must be a scalar`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (param.escape !== undefined && param.escape !== "ex-argument") {
    errors.push(createError(`${prefix}.escape is invalid`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateExCommandParamValues(param, prefix, errors) {
  const type = param.type ?? "string";
  const validType = [
    "string",
    "number",
    "boolean",
    "file-path",
    "directory-path",
    "select"
  ].includes(String(type));
  if (!validType)
    errors.push(createError(`${prefix}.type is invalid`, { code: "INVALID_FIELD_TYPE" }));
  if (type === "select" && !Array.isArray(param.allowedValues)) {
    errors.push(createError(`${prefix}.allowedValues is required for select`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (type !== "select" && param.allowedValues !== undefined) {
    errors.push(createError(`${prefix}.allowedValues is only valid for select`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (!isStringArray(param.allowedValues)) {
    errors.push(createError(`${prefix}.allowedValues must be strings`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateExCommandAllowedDescriptions(param, prefix, errors);
  validateExCommandDefaultValue(param, type, prefix, errors);
  validateExCommandEmit(param.emit, type, prefix, errors);
}
function isStringArray(value) {
  return value === undefined || Array.isArray(value) && value.every((item) => typeof item === "string");
}
function validateExCommandAllowedDescriptions(param, prefix, errors) {
  if (param.allowedValueDescriptions === undefined)
    return;
  if (typeof param.allowedValueDescriptions !== "object" || param.allowedValueDescriptions === null || Array.isArray(param.allowedValueDescriptions)) {
    errors.push(createError(`${prefix}.allowedValueDescriptions must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const [key, description] of Object.entries(param.allowedValueDescriptions)) {
    if (!Array.isArray(param.allowedValues) || !param.allowedValues.includes(key) || typeof description !== "string") {
      errors.push(createError(`${prefix}.allowedValueDescriptions is invalid`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  }
}
function validateExCommandDefaultValue(param, type, prefix, errors) {
  if (param.defaultValue === undefined)
    return;
  if (type === "number" && typeof param.defaultValue !== "number" || type === "boolean" && typeof param.defaultValue !== "boolean" || type !== "number" && type !== "boolean" && typeof param.defaultValue !== "string" || type === "select" && (!Array.isArray(param.allowedValues) || !param.allowedValues.includes(param.defaultValue))) {
    errors.push(createError(`${prefix}.defaultValue is invalid`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateExCommandEmit(emit, type, prefix, errors) {
  if (emit === undefined)
    return;
  if (typeof emit !== "object" || emit === null || Array.isArray(emit)) {
    errors.push(createError(`${prefix}.emit is invalid`, { code: "INVALID_FIELD_TYPE" }));
    return;
  }
  const record = emit;
  if (record.kind === "value" && Object.keys(record).length === 1)
    return;
  if (record.kind === "flag" && typeof record.token === "string" && record.token !== "" && Object.keys(record).length === 2 && type === "boolean")
    return;
  if (record.kind === "option" && typeof record.prefix === "string" && record.prefix !== "" && Object.keys(record).length === 2 && type !== "boolean")
    return;
  errors.push(createError(`${prefix}.emit is invalid`, { code: "INVALID_FIELD_TYPE" }));
}
function validateSchemaExCommandTemplatesField(templates, commands, errors) {
  if (templates === undefined)
    return;
  if (!Array.isArray(templates) || !Array.isArray(commands)) {
    errors.push(createError('"exCommandTemplates" must be an array with exCommands', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const byName = new Map(commands.filter((command) => typeof command === "object" && command !== null && typeof command.name === "string").map((command) => [command.name, command]));
  const keys = new Set;
  for (const [index, template] of templates.entries()) {
    const prefix = `exCommandTemplates[${String(index)}]`;
    if (typeof template !== "object" || template === null) {
      errors.push(createError(`${prefix} must be an object`, {
        code: "INVALID_FIELD_TYPE"
      }));
      continue;
    }
    const t = template;
    if (typeof t.key !== "string" || t.key === "" || keys.has(t.key))
      errors.push(createError(`${prefix}.key must be unique`, {
        code: "DUPLICATE_EX_COMMAND_TEMPLATE_KEY"
      }));
    if (typeof t.key === "string")
      keys.add(t.key);
    validateRequiredNonEmptyStringField(t.label, `${prefix}.label must be a non-empty string`, errors);
    validateRequiredNonEmptyStringField(t.shortDescription, `${prefix}.shortDescription must be a non-empty string`, errors);
    validateOptionalNonEmptyString(t.example, `${prefix}.example must be a non-empty string when provided`, errors);
    if (t.whatItDoes !== undefined && typeof t.whatItDoes !== "string") {
      errors.push(createError(`${prefix}.whatItDoes must be a string when provided`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    validateOptionalStringArray(t.aliases, `${prefix}.aliases`, `${prefix}.aliases must be an array of non-empty strings when provided`, errors);
    validateOptionalBoolean(t.isPopular, `${prefix}.isPopular must be a boolean when provided`, errors);
    const base = typeof t.baseCommandName === "string" ? byName.get(t.baseCommandName) : undefined;
    if (!base) {
      errors.push(createError(`${prefix}.baseCommandName must reference an Ex command`, {
        code: "INVALID_EX_COMMAND_TEMPLATE"
      }));
      continue;
    }
    if (typeof t.defaults !== "object" || t.defaults === null || Array.isArray(t.defaults)) {
      errors.push(createError(`${prefix}.defaults must be an object`, {
        code: "INVALID_FIELD_TYPE"
      }));
      continue;
    }
    const rawParams = Array.isArray(base.params) ? base.params : [];
    const params = new Map(rawParams.filter((param) => typeof param === "object" && param !== null).map((param) => [param.name, param]));
    for (const [name, value] of Object.entries(t.defaults)) {
      const param = params.get(name);
      if (!param || !isExCommandDefaultCompatible(value, param))
        errors.push(createError(`${prefix}.defaults.${name} is invalid`, {
          code: "INVALID_EX_COMMAND_TEMPLATE"
        }));
    }
  }
}
function isExCommandDefaultCompatible(value, param) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
    return false;
  const type = param.type ?? "string";
  if (type === "number")
    return typeof value === "number";
  if (type === "boolean")
    return typeof value === "boolean";
  return typeof value === "string" && (!Array.isArray(param.allowedValues) || param.allowedValues.includes(value));
}
function validateSchemaOption(opt, seenKeys) {
  const errors = [];
  if (typeof opt !== "object" || opt === null) {
    errors.push(createError("Each option must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const o = opt;
  if (typeof o.key !== "string" || o.key === "") {
    errors.push(createError('Option must have a non-empty "key" field', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    if (seenKeys.has(o.key)) {
      errors.push(createError(`Duplicate option key: "${o.key}"`, {
        code: "DUPLICATE_OPTION_KEY"
      }));
    }
    seenKeys.add(o.key);
  }
  if (typeof o.label !== "string" || o.label === "") {
    errors.push(createError('Option must have a non-empty "label" field', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof o.type !== "string" || !VALID_OPTION_TYPES.has(o.type)) {
    errors.push(createError(`Invalid option type: "${String(o.type)}"`, {
      code: "INVALID_OPTION_TYPE"
    }));
    return errors;
  }
  const optType = o.type;
  validateSchemaOptionMetadata(o, optType, errors);
  switch (optType) {
    case "select":
      validateSelectOption(o, errors);
      break;
    case "array":
      validateArrayOption(o, errors);
      break;
    case "mapping-table":
      validateMappingTableOption(o, errors);
      break;
    case "object":
      validateObjectOption(o, errors);
      break;
    case "number":
      validateNumberOption(o, errors);
      break;
    case "string":
      validateStringOption(o, errors);
      break;
    case "boolean":
      validateBooleanOption(o, errors);
      break;
    case "color":
      validateColorOption(o, errors);
      break;
    case "keysequence":
    case "lua":
      validateStringTypeDefault(o, errors);
      break;
    case "plugin-keymap":
      validatePluginKeymapOption(o, errors);
      break;
  }
  return errors;
}
function validateSchemaOptionMetadata(option, optionType, errors) {
  validateOptionalNonEmptyString(option.emitKey, "Option emitKey must be a non-empty string when provided", errors);
  if (option.description !== undefined && typeof option.description !== "string") {
    errors.push(createError("Option description must be a string when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateOptionalBoolean(option.required, "Option required must be a boolean when provided", errors);
  validateOptionalNonEmptyString(option.group, "Option group must be a non-empty string when provided", errors);
  validateSchemaOptionCondition(option.visibleWhen, "visibleWhen", errors);
  validateSchemaOptionCondition(option.enabledWhen, "enabledWhen", errors);
  validateSchemaOptionNotices(option.notices, errors);
  validateSchemaOptionEmit(option.emit, optionType, errors);
  if (option.defaultEmission !== undefined && option.defaultEmission !== "emit" && option.defaultEmission !== "explicit-only") {
    errors.push(createError('Option defaultEmission must be "emit" or "explicit-only" when provided', { code: "INVALID_FIELD_TYPE" }));
  }
}
function validateSchemaOptionEmitInclude(include, errors) {
  if (include === undefined) {
    return;
  }
  if (typeof include !== "object" || include === null || include.kind !== "always" && include.kind !== "explicit-only" && include.kind !== "non-default" && include.kind !== "non-empty") {
    errors.push(createError("Option emit.include.kind is invalid", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateSchemaOptionEmitValueRule(valueRule, errors) {
  if (valueRule === undefined) {
    return;
  }
  const record = valueRule;
  if (record.kind !== "value-map") {
    errors.push(createError('Option emit.valueRule.kind must be "value-map"', {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (typeof record.values !== "object" || record.values === null || Array.isArray(record.values)) {
    errors.push(createError("Option emit.valueRule.values must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
  } else {
    for (const [key, mappedValue] of Object.entries(record.values)) {
      if (key.trim().length === 0) {
        errors.push(createError("Option emit.valueRule.values keys must be non-empty", {
          code: "INVALID_FIELD_TYPE"
        }));
      }
      validateSchemaLuaValue(mappedValue, errors);
    }
  }
  if (record.onUnknown !== undefined && record.onUnknown !== "omit" && record.onUnknown !== "emit-original" && record.onUnknown !== "warn-and-omit") {
    errors.push(createError("Option emit.valueRule.onUnknown is invalid", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateSchemaOptionEmitStringRule(stringRule, optionType, errors) {
  if (stringRule === undefined) {
    return;
  }
  const record = stringRule;
  if (optionType !== "string") {
    errors.push(createError("Option emit.stringRule is only supported on string options", {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (record.kind !== "path") {
    errors.push(createError('Option emit.stringRule.kind must be "path"', {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateOptionalBoolean(record.trim, "Option emit.stringRule.trim must be a boolean when provided", errors);
  validateOptionalBoolean(record.omitWhenEmpty, "Option emit.stringRule.omitWhenEmpty must be a boolean when provided", errors);
  validateOptionalBoolean(record.expandWithVimFnExpand, "Option emit.stringRule.expandWithVimFnExpand must be a boolean when provided", errors);
  validateOptionalBoolean(record.warnWhenRelative, "Option emit.stringRule.warnWhenRelative must be a boolean when provided", errors);
}
function validateSchemaOptionEmit(emit, optionType, errors) {
  if (emit === undefined) {
    return;
  }
  if (typeof emit !== "object" || emit === null || Array.isArray(emit)) {
    errors.push(createError("Option emit must be an object when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const record = emit;
  validateSchemaOptionEmitInclude(record.include, errors);
  validateSchemaOptionEmitValueRule(record.valueRule, errors);
  validateSchemaOptionEmitStringRule(record.stringRule, optionType, errors);
}
function validateSchemaLuaValue(value, errors) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(createError("Schema Lua value must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const record = value;
  if (record["kind"] === "json") {
    if (!isValidSchemaJsonValue(record["value"])) {
      errors.push(createError("Schema json value is invalid", {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    return;
  }
  if (record["kind"] === "lua") {
    if (typeof record["lua"] !== "string" || record["lua"].trim().length === 0) {
      errors.push(createError("Schema lua value must be a non-empty string", {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    return;
  }
  errors.push(createError("Schema Lua value kind is invalid", {
    code: "INVALID_FIELD_TYPE"
  }));
}
function isValidSchemaJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isValidSchemaJsonValue(entry));
  }
  if (typeof value === "object") {
    return Object.values(value).every((entry) => isValidSchemaJsonValue(entry));
  }
  return false;
}
function validateSchemaOptionCondition(value, fieldName, errors) {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(createError(`Option ${fieldName} must be an object when provided`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const condition = value;
  if (typeof condition.key !== "string" || condition.key.trim().length === 0) {
    errors.push(createError(`Option ${fieldName}.key must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (typeof condition.equals !== "string" && typeof condition.equals !== "number" && typeof condition.equals !== "boolean") {
    errors.push(createError(`Option ${fieldName}.equals must be a string, number, or boolean`, { code: "INVALID_FIELD_TYPE" }));
  }
}
function validateSchemaOptionNotices(notices, errors) {
  if (notices === undefined) {
    return;
  }
  if (!Array.isArray(notices)) {
    errors.push(createError("Option notices must be an array when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const [index, notice] of notices.entries()) {
    validateSchemaOptionNotice(notice, `Option notices[${String(index)}]`, errors);
  }
}
function validateSchemaOptionNotice(notice, prefix, errors) {
  if (typeof notice !== "object" || notice === null || Array.isArray(notice)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const rawNotice = notice;
  if (rawNotice.severity !== "warning") {
    errors.push(createError(`${prefix}.severity must be "warning"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (!Array.isArray(rawNotice.surfaces) || rawNotice.surfaces.length === 0) {
    errors.push(createError(`${prefix}.surfaces must be a non-empty array`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else {
    for (const surface of rawNotice.surfaces) {
      if (surface !== "configuration" && surface !== "generation") {
        errors.push(createError(`${prefix}.surfaces entries must be "configuration" or "generation"`, { code: "INVALID_FIELD_TYPE" }));
      }
    }
  }
  if (typeof rawNotice.message !== "string" || rawNotice.message.trim().length === 0) {
    errors.push(createError(`${prefix}.message must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateOptionalNonEmptyString(rawNotice.details, `${prefix}.details must be a non-empty string when provided`, errors);
  validateOptionalStringArray(rawNotice.suggestions, `${prefix}.suggestions`, `${prefix}.suggestions must be an array of non-empty strings when provided`, errors);
  validateSchemaOptionNoticeWhen(rawNotice.when, `${prefix}.when`, errors);
}
function validateSchemaOptionNoticeWhen(value, prefix, errors) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const when = value;
  if (when.kind !== "has-explicit-value" && when.kind !== "equals" && when.kind !== "not-equals") {
    errors.push(createError(`${prefix}.kind must be "has-explicit-value", "equals", or "not-equals"`, { code: "INVALID_FIELD_TYPE" }));
    return;
  }
  if (when.kind === "has-explicit-value") {
    return;
  }
  if (typeof when.value !== "string" && typeof when.value !== "number" && typeof when.value !== "boolean") {
    errors.push(createError(`${prefix}.value must be a string, number, or boolean`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateSelectOption(o, errors) {
  if (!Array.isArray(o.options) || o.options.length === 0) {
    errors.push(createError('Select option must have a non-empty "options" array', {
      code: "MISSING_SELECT_OPTIONS"
    }));
  } else {
    validateSelectOptionEntries(o.options, errors, "Select option");
  }
  if (o.multi === true) {
    validateMultiSelectDefault(o, errors);
    return;
  }
  validateSingleSelectDefault(o, errors);
}
function validateSingleSelectDefault(o, errors) {
  validateDefaultValueType(o.default, "string", "Select option default must be a string", errors);
  if (typeof o.default === "string" && Array.isArray(o.options) && o.options.length > 0) {
    const validValues = collectValidSelectValues(o.options);
    if (!validValues.has(o.default)) {
      errors.push(createError(`Select option default "${o.default}" is not in options[]`, {
        code: "INVALID_DEFAULT_VALUE"
      }));
    }
  }
}
function validateMultiSelectDefault(o, errors) {
  if (o.default === undefined) {
    return;
  }
  if (!Array.isArray(o.default)) {
    errors.push(createError("Multi-select option default must be an array of strings", {
      code: "INVALID_DEFAULT_VALUE"
    }));
    return;
  }
  for (const item of o.default) {
    if (typeof item !== "string") {
      errors.push(createError("Multi-select option default array items must be strings", {
        code: "INVALID_DEFAULT_VALUE"
      }));
      return;
    }
  }
  if (Array.isArray(o.options) && o.options.length > 0) {
    const validValues = collectValidSelectValues(o.options);
    for (const item of o.default) {
      if (!validValues.has(item)) {
        errors.push(createError(`Multi-select option default contains "${item}" which is not in options[]`, { code: "INVALID_DEFAULT_VALUE" }));
      }
    }
  }
}
function collectValidSelectValues(options) {
  return new Set(options.filter((entry) => typeof entry === "object" && entry !== null).map((entry) => entry.value).filter((value) => typeof value === "string"));
}
function validateArrayOption(o, errors) {
  validateArrayItemsDefinition(o.items, errors);
  if (o.default !== undefined && !Array.isArray(o.default)) {
    errors.push(createError("Array option default must be an array", {
      code: "INVALID_DEFAULT_VALUE"
    }));
  }
  validateRangeValidationRule(o.validation, "Array option validation must be an object", "Array validation: minItems must be <= maxItems", errors);
}
function validateMappingTableOption(o, errors) {
  const columnKeys = new Set;
  const columns = Array.isArray(o.columns) ? o.columns : [];
  if (!Array.isArray(o.columns) || o.columns.length === 0) {
    errors.push(createError('Mapping-table option must have a non-empty "columns" array', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    const seenColumns = new Set;
    for (const [index, column] of o.columns.entries()) {
      validateMappingTableColumn(column, index, seenColumns, errors);
    }
    for (const key of seenColumns) {
      columnKeys.add(key);
    }
    for (const [index, column] of o.columns.entries()) {
      validateMappingTableColumnAutoFill(column, index, columns, errors);
    }
  }
  if (o.default !== undefined) {
    if (!Array.isArray(o.default)) {
      errors.push(createError("Mapping-table option default must be an array", {
        code: "INVALID_DEFAULT_VALUE"
      }));
    } else {
      for (const [index, row] of o.default.entries()) {
        if (typeof row !== "object" || row === null || Array.isArray(row)) {
          errors.push(createError(`Mapping-table option default row ${String(index)} must be an object`, { code: "INVALID_DEFAULT_VALUE" }));
        }
      }
    }
  }
  if (typeof o.emit !== "object" || o.emit === null || Array.isArray(o.emit)) {
    errors.push(createError("Mapping-table option must have an emit object", {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    const emit = o.emit;
    const emitKeyColumn = typeof emit.keyColumn === "string" && emit.keyColumn.trim().length > 0 ? emit.keyColumn : undefined;
    const emitValueColumn = typeof emit.valueColumn === "string" && emit.valueColumn.trim().length > 0 ? emit.valueColumn : undefined;
    const emitValueTemplate = typeof emit.valueTemplate === "string" && emit.valueTemplate.trim().length > 0 ? emit.valueTemplate : undefined;
    if (typeof emit.targetKey !== "string" || emit.targetKey.trim().length === 0) {
      errors.push(createError("Mapping-table emit.targetKey must be a non-empty string", {
        code: "MISSING_REQUIRED_FIELD"
      }));
    }
    if (emitKeyColumn === undefined) {
      errors.push(createError("Mapping-table emit.keyColumn must be a non-empty string", {
        code: "MISSING_REQUIRED_FIELD"
      }));
    }
    if (emitValueColumn === undefined) {
      errors.push(createError("Mapping-table emit.valueColumn must be a non-empty string", {
        code: "MISSING_REQUIRED_FIELD"
      }));
    }
    if (emitValueTemplate === undefined) {
      errors.push(createError("Mapping-table emit.valueTemplate must be a non-empty string", {
        code: "MISSING_REQUIRED_FIELD"
      }));
    }
    if (emitKeyColumn !== undefined && !columnKeys.has(emitKeyColumn)) {
      errors.push(createError("Mapping-table emit.keyColumn must reference a declared column", {
        code: "INVALID_VALIDATION_RULE"
      }));
    }
    if (emitValueColumn !== undefined && !columnKeys.has(emitValueColumn)) {
      errors.push(createError("Mapping-table emit.valueColumn must reference a declared column", {
        code: "INVALID_VALIDATION_RULE"
      }));
    }
    if (emitValueTemplate !== undefined) {
      for (const placeholderError of validateMappingTableTemplatePlaceholders(emitValueTemplate)) {
        errors.push(createError(`Mapping-table emit.valueTemplate ${placeholderError}`, {
          code: "INVALID_VALIDATION_RULE"
        }));
      }
      const placeholders = extractMappingTableTemplatePlaceholders(emitValueTemplate);
      for (const placeholder of placeholders) {
        if (placeholder.kind === "row-column" && !columnKeys.has(placeholder.columnKey)) {
          errors.push(createError(`Mapping-table emit.valueTemplate references undeclared column "${placeholder.columnKey}"`, { code: "INVALID_VALIDATION_RULE" }));
        }
      }
      if (placeholders.some((placeholder) => placeholder.kind === "output-key")) {
        const keyColumnRecord = columns.find((column) => typeof column.key === "string" && column.key === emitKeyColumn);
        if (keyColumnRecord?.type !== "select") {
          errors.push(createError("Mapping-table emit.valueTemplate may only interpolate {{outputKey}} from a select keyColumn", { code: "INVALID_VALIDATION_RULE" }));
        }
      }
      for (const placeholder of placeholders) {
        if (placeholder.kind !== "row-column") {
          continue;
        }
        const columnRecord = columns.find((column) => typeof column.key === "string" && column.key === placeholder.columnKey);
        if (columnRecord?.type === "string") {
          errors.push(createError(`Mapping-table emit.valueTemplate placeholder "row.${placeholder.columnKey}" must not interpolate an unconstrained string column into raw Lua`, { code: "INVALID_VALIDATION_RULE" }));
        }
      }
    }
    if (emit.outputKeyMap !== undefined) {
      if (typeof emit.outputKeyMap !== "object" || emit.outputKeyMap === null || Array.isArray(emit.outputKeyMap)) {
        errors.push(createError("Mapping-table emit.outputKeyMap must be an object when provided", {
          code: "INVALID_FIELD_TYPE"
        }));
      } else {
        for (const [sourceKey, outputKey] of Object.entries(emit.outputKeyMap)) {
          if (sourceKey.trim().length === 0 || typeof outputKey !== "string" || outputKey.trim().length === 0) {
            errors.push(createError("Mapping-table emit.outputKeyMap entries must map non-empty strings to non-empty strings", {
              code: "INVALID_FIELD_TYPE"
            }));
            continue;
          }
          if (!isSafeRawLuaIdentifier(outputKey)) {
            errors.push(createError(`Mapping-table emit.outputKeyMap value "${outputKey}" is not safe for raw Lua interpolation`, { code: "INVALID_VALIDATION_RULE" }));
          }
        }
      }
    }
  }
  if (o.conflictGroups !== undefined) {
    if (!Array.isArray(o.conflictGroups)) {
      errors.push(createError("Mapping-table conflictGroups must be an array", {
        code: "INVALID_FIELD_TYPE"
      }));
    } else {
      for (const [index, group] of o.conflictGroups.entries()) {
        validateMappingTableConflictGroup(group, index, errors);
        const record = group;
        if (typeof record.column === "string" && record.column.trim().length > 0 && !columnKeys.has(record.column)) {
          errors.push(createError(`Mapping-table conflictGroups[${String(index)}].column must reference a declared column`, { code: "INVALID_VALIDATION_RULE" }));
        }
      }
    }
  }
}
function validateMappingTableColumn(column, index, seenColumns, errors) {
  const prefix = `Mapping-table columns[${String(index)}]`;
  if (typeof column !== "object" || column === null || Array.isArray(column)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const record = column;
  if (typeof record.key !== "string" || record.key.trim().length === 0) {
    errors.push(createError(`${prefix}.key must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  } else if (seenColumns.has(record.key)) {
    errors.push(createError(`${prefix}.key must be unique`, {
      code: "DUPLICATE_OPTION_KEY"
    }));
  } else {
    seenColumns.add(record.key);
  }
  if (typeof record.label !== "string" || record.label.trim().length === 0) {
    errors.push(createError(`${prefix}.label must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (record.type !== "string" && record.type !== "select") {
    errors.push(createError(`${prefix}.type must be "string" or "select"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (record.type === "select") {
    if (!Array.isArray(record.options) || record.options.length === 0) {
      errors.push(createError(`${prefix}.options must be a non-empty array`, {
        code: "MISSING_SELECT_OPTIONS"
      }));
    } else {
      validateSelectOptionEntries(record.options, errors, prefix);
    }
  }
}
function validateMappingTableAutoFillReferences(prefix, columnRecord, autoFill, columns, errors) {
  const targetColumnKey = typeof columnRecord.key === "string" && columnRecord.key.trim().length > 0 ? columnRecord.key : undefined;
  const sourceColumnKey = typeof autoFill.sourceColumn === "string" && autoFill.sourceColumn.trim().length > 0 ? autoFill.sourceColumn : undefined;
  if (sourceColumnKey === undefined) {
    errors.push(createError(`${prefix}.sourceColumn must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  const sourceColumn = sourceColumnKey === undefined ? undefined : getMappingTableColumnRecordByKey(columns, sourceColumnKey);
  if (sourceColumnKey !== undefined && sourceColumn === undefined) {
    errors.push(createError(`${prefix}.sourceColumn must reference a declared sibling column`, {
      code: "INVALID_VALIDATION_RULE"
    }));
  }
  if (targetColumnKey !== undefined && sourceColumnKey !== undefined && targetColumnKey === sourceColumnKey) {
    errors.push(createError(`${prefix}.sourceColumn must not match the target column key`, {
      code: "INVALID_VALIDATION_RULE"
    }));
  }
  if (autoFill.fallback !== undefined && autoFill.fallback !== "preserve" && autoFill.fallback !== "empty" && autoFill.fallback !== "column-default") {
    errors.push(createError(`${prefix}.fallback must be "preserve", "empty", or "column-default" when provided`, { code: "INVALID_FIELD_TYPE" }));
  }
}
function validateMappingTableAutoFillValues(prefix, columnRecord, autoFill, sourceColumn, errors) {
  if (typeof autoFill.values !== "object" || autoFill.values === null || Array.isArray(autoFill.values)) {
    errors.push(createError(`${prefix}.values must be a non-array object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const sourceValidValues = getMappingTableColumnValidSelectValues(sourceColumn);
  const targetValidValues = getMappingTableColumnValidSelectValues(columnRecord);
  const targetColumnKey = typeof columnRecord.key === "string" && columnRecord.key.trim().length > 0 ? columnRecord.key : undefined;
  const sourceColumnKey = typeof autoFill.sourceColumn === "string" && autoFill.sourceColumn.trim().length > 0 ? autoFill.sourceColumn : undefined;
  for (const [mappedSourceValue, mappedTargetValue] of Object.entries(autoFill.values)) {
    if (mappedSourceValue.trim().length === 0) {
      errors.push(createError(`${prefix}.values keys must be non-empty strings`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
    if (typeof mappedTargetValue !== "string") {
      errors.push(createError(`${prefix}.values must map to string values`, {
        code: "INVALID_FIELD_TYPE"
      }));
      continue;
    }
    if (sourceValidValues !== undefined && !sourceValidValues.has(mappedSourceValue)) {
      errors.push(createError(`${prefix}.values key "${mappedSourceValue}" is not a valid option for source column "${sourceColumnKey}"`, { code: "INVALID_VALIDATION_RULE" }));
    }
    if (targetValidValues !== undefined && !targetValidValues.has(mappedTargetValue)) {
      errors.push(createError(`${prefix}.values entry "${mappedSourceValue}" maps to invalid target value "${mappedTargetValue}" for column "${targetColumnKey}"`, { code: "INVALID_VALIDATION_RULE" }));
    }
  }
}
function validateMappingTableColumnAutoFill(column, index, columns, errors) {
  if (typeof column !== "object" || column === null || Array.isArray(column)) {
    return;
  }
  const columnRecord = column;
  if (columnRecord.autoFill === undefined) {
    return;
  }
  const prefix = `Mapping-table columns[${String(index)}].autoFill`;
  if (typeof columnRecord.autoFill !== "object" || columnRecord.autoFill === null || Array.isArray(columnRecord.autoFill)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const autoFill = columnRecord.autoFill;
  if (autoFill.kind !== "value-by-column") {
    errors.push(createError(`${prefix}.kind must be "value-by-column"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateMappingTableAutoFillReferences(prefix, columnRecord, autoFill, columns, errors);
  const sourceColumnKey = typeof autoFill.sourceColumn === "string" && autoFill.sourceColumn.trim().length > 0 ? autoFill.sourceColumn : undefined;
  const sourceColumn = sourceColumnKey === undefined ? undefined : getMappingTableColumnRecordByKey(columns, sourceColumnKey);
  validateMappingTableAutoFillValues(prefix, columnRecord, autoFill, sourceColumn, errors);
}
function getMappingTableColumnRecordByKey(columns, key) {
  return columns.find((column) => typeof column === "object" && column !== null && !Array.isArray(column) && column.key === key);
}
function getMappingTableColumnValidSelectValues(column) {
  if (column?.type !== "select" || !Array.isArray(column.options) || column.options.length === 0) {
    return;
  }
  return collectValidSelectValues(column.options);
}
function validateMappingTableConflictGroup(group, index, errors) {
  const prefix = `Mapping-table conflictGroups[${String(index)}]`;
  if (typeof group !== "object" || group === null || Array.isArray(group)) {
    errors.push(createError(`${prefix} must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const record = group;
  validateOptionalNonEmptyString(record.column, `${prefix}.column must be a non-empty string`, errors);
  validateOptionalStringArray(record.values, `${prefix}.values`, `${prefix}.values must be an array of non-empty strings`, errors);
  if (record.severity !== "warning") {
    errors.push(createError(`${prefix}.severity must be "warning"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  validateOptionalNonEmptyString(record.message, `${prefix}.message must be a non-empty string`, errors);
}
function validateArrayItemsDefinition(itemsValue, errors) {
  if (typeof itemsValue !== "object" || itemsValue === null) {
    errors.push(createError('Array option must have an "items" field', {
      code: "MISSING_REQUIRED_FIELD"
    }));
    return;
  }
  const items = itemsValue;
  if (typeof items.itemType !== "string" || !VALID_ARRAY_ITEM_TYPES.has(items.itemType)) {
    errors.push(createError(`Invalid array items.itemType: "${String(items.itemType)}"`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  if (items.itemType === "select") {
    if (!Array.isArray(items.options) || items.options.length === 0) {
      errors.push(createError('Array items of type "select" must have a non-empty "options" array', { code: "MISSING_SELECT_OPTIONS" }));
      return;
    }
    validateSelectOptionEntries(items.options, errors, "Array items");
  }
}
function validateSelectOptionEntries(options, errors, context) {
  for (const [index, option] of options.entries()) {
    validateSelectOptionEntry(option, index, errors, context);
  }
}
function validateSelectOptionEntry(option, index, errors, context) {
  if (typeof option !== "object" || option === null) {
    errors.push(createError(`${context} options[${String(index)}] must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const entry = option;
  if (typeof entry.value !== "string" || entry.value === "") {
    errors.push(createError(`${context} options[${String(index)}].value must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (typeof entry.label !== "string" || entry.label === "") {
    errors.push(createError(`${context} options[${String(index)}].label must be a non-empty string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateRangeValidationRule(validationValue, invalidTypeMessage, message, errors) {
  if (validationValue === undefined) {
    return;
  }
  if (typeof validationValue !== "object" || validationValue === null) {
    errors.push(createError(invalidTypeMessage, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const validation = validationValue;
  if (validation.min !== undefined && validation.max !== undefined && typeof validation.min === "number" && typeof validation.max === "number" && validation.min > validation.max) {
    errors.push(createError(message, {
      code: "INVALID_VALIDATION_RULE"
    }));
  }
}
function validateObjectOption(o, errors) {
  if (!Array.isArray(o.properties)) {
    errors.push(createError('Object option must have a "properties" array', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    const nestedKeys = new Set;
    for (const prop of o.properties) {
      const propErrors = validateSchemaOption(prop, nestedKeys);
      errors.push(...propErrors);
    }
  }
  if (o.default !== undefined && (typeof o.default !== "object" || o.default === null || Array.isArray(o.default))) {
    errors.push(createError("Object option default must be an object", {
      code: "INVALID_DEFAULT_VALUE"
    }));
  }
}
function validateNumberOption(o, errors) {
  if (o.default !== undefined && typeof o.default !== "number") {
    errors.push(createError("Number option default must be a number", {
      code: "INVALID_DEFAULT_VALUE"
    }));
  }
  validateRangeValidationRule(o.validation, "Number option validation must be an object", "Number validation: min must be <= max", errors);
}
function validateStringOption(o, errors) {
  validateDefaultValueType(o.default, "string", "String option default must be a string", errors);
  validateStringPatternRule(o.validation, errors);
}
function validateBooleanOption(o, errors) {
  validateDefaultValueType(o.default, "boolean", "Boolean option default must be a boolean", errors);
}
function validateColorOption(o, errors) {
  validateDefaultValueType(o.default, "string", "Color option default must be a string", errors);
}
function validateStringTypeDefault(o, errors) {
  validateDefaultValueType(o.default, "string", `${String(o.type)} option default must be a string`, errors);
}
function validateStringPatternRule(validationValue, errors) {
  if (validationValue === undefined) {
    return;
  }
  if (typeof validationValue !== "object" || validationValue === null) {
    errors.push(createError("String option validation must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const validation = validationValue;
  if (validation.pattern === undefined) {
    return;
  }
  if (typeof validation.pattern !== "string") {
    errors.push(createError("String option validation.pattern must be a string", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  try {
    new RegExp(validation.pattern);
  } catch {
    errors.push(createError(`String option validation.pattern is not a valid regex: "${validation.pattern}"`, {
      code: "INVALID_VALIDATION_RULE"
    }));
  }
}
function validateDefaultValueType(value, expectedType, message, errors) {
  if (value === undefined || typeof value === expectedType) {
    return;
  }
  errors.push(createError(message, {
    code: "INVALID_DEFAULT_VALUE"
  }));
}
function validateSchemaFunction(fn, seenFunctionNames) {
  const errors = [];
  if (typeof fn !== "object" || fn === null) {
    errors.push(createError("Each function must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const f = fn;
  if (typeof f.name !== "string" || f.name === "") {
    errors.push(createError('Function must have a non-empty "name" field', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    if (seenFunctionNames.has(f.name)) {
      errors.push(createError(`Duplicate function name: "${f.name}"`, {
        code: "DUPLICATE_FUNCTION_NAME"
      }));
    }
    seenFunctionNames.add(f.name);
  }
  if (typeof f.luaCall !== "string" || f.luaCall === "") {
    errors.push(createError('Function must have a non-empty "luaCall" field', {
      code: "INVALID_LUA_CALL"
    }));
  }
  validateFunctionParams(f.params, errors, typeof f.name === "string" ? f.name : undefined);
  validateFunctionReturns(f.returns, errors);
  validateFunctionMetadata(f, errors);
  if (typeof f.luaCall === "string" && f.luaCall !== "" && Array.isArray(f.params)) {
    const paramSignatures = f.params.filter((p) => typeof p.name === "string" && typeof p.type === "string").map((p) => ({
      name: p.name,
      type: p.type,
      optional: typeof p.optional === "boolean" ? p.optional : undefined
    }));
    const templateResult = validateTemplate(f.luaCall, paramSignatures);
    if (!templateResult.valid) {
      for (const error of templateResult.errors) {
        errors.push(createError(`functions[${String(f.name)}].luaCall: ${error}`, {
          code: "INVALID_LUA_CALL"
        }));
      }
    }
  }
  return errors;
}
function validateFunctionMetadata(fn, errors) {
  validateFunctionParamEmission(fn.paramEmission, errors);
  validateOptionalNonEmptyString(fn.label, "Function.label must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.shortDescription, "Function.shortDescription must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.whatItDoes, "Function.whatItDoes must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.technicalNote, "Function.technicalNote must be a non-empty string when provided", errors);
  validateOptionalBoolean(fn.isPopular, "Function.isPopular must be a boolean when provided", errors);
  validateOptionalStringArray(fn.aliases, "Function.aliases", "Function.aliases must be an array of non-empty strings when provided", errors);
  validateOptionalNonEmptyString(fn.category, "Function.category must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.example, "Function.example must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.sourceDoc, "Function.sourceDoc must be a non-empty string when provided", errors);
  validateOptionalNonEmptyString(fn.relatedCommand, "Function.relatedCommand must be a non-empty string when provided", errors);
}
function validateFunctionParamEmission(value, errors) {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(createError("Function.paramEmission must be an object when provided", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const raw = value;
  if (raw.unsetOptional === undefined) {
    return;
  }
  if (typeof raw.unsetOptional === "string" && VALID_PARAM_EMISSION_UNSET_OPTIONAL.has(raw.unsetOptional)) {
    return;
  }
  errors.push(createError('Function.paramEmission.unsetOptional must be "emit-nil" or "omit-trailing" when provided', {
    code: "INVALID_FIELD_TYPE"
  }));
}
function validateOptionalNonEmptyString(value, message, errors) {
  if (value === undefined) {
    return;
  }
  if (typeof value === "string" && value !== "") {
    return;
  }
  errors.push(createError(message, {
    code: "INVALID_FIELD_TYPE"
  }));
}
function validateOptionalBoolean(value, message, errors) {
  if (value === undefined) {
    return;
  }
  if (typeof value === "boolean") {
    return;
  }
  errors.push(createError(message, {
    code: "INVALID_FIELD_TYPE"
  }));
}
function validateOptionalStringArray(value, fieldName, invalidTypeMessage, errors) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(createError(invalidTypeMessage, {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item === "") {
      errors.push(createError(`"${fieldName}[${String(index)}]" must be a non-empty string`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  }
}
function validateFunctionParams(params, errors, functionName) {
  if (!Array.isArray(params)) {
    errors.push(createError('Function must have a "params" array', {
      code: "MISSING_REQUIRED_FIELD"
    }));
    return;
  }
  const seenParamNames = new Set;
  for (const param of params) {
    validateFunctionParam(param, errors, seenParamNames, functionName);
  }
}
function validateFunctionParam(param, errors, seenParamNames, functionName) {
  if (typeof param !== "object" || param === null) {
    errors.push(createError("Each function param must be an object", {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const p = param;
  if (typeof p.name !== "string" || p.name === "") {
    errors.push(createError('Function param must have a non-empty "name" field', {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    if (seenParamNames.has(p.name)) {
      errors.push(createError(functionName === undefined ? `Duplicate function param name: "${p.name}"` : `Duplicate function param name: "${p.name}" in function "${functionName}"`, {
        code: "DUPLICATE_FUNCTION_PARAM_NAME"
      }));
    }
    seenParamNames.add(p.name);
  }
  if (typeof p.type !== "string" || !VALID_PORT_DATA_TYPES.has(p.type)) {
    errors.push(createError(`Invalid function param type: "${String(p.type)}"`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
}
function validateFunctionReturns(returnsType, errors) {
  if (returnsType === undefined) {
    return;
  }
  if (typeof returnsType === "string" && VALID_PORT_DATA_TYPES.has(returnsType)) {
    return;
  }
  errors.push(createError(`Invalid function return type: "${String(returnsType)}"`, {
    code: "INVALID_FIELD_TYPE"
  }));
}
function validateSchemaFunctionTemplatesField(functionTemplates, functions, errors) {
  if (functionTemplates === undefined) {
    return;
  }
  if (!Array.isArray(functionTemplates)) {
    errors.push(createError('"functionTemplates" must be an array', {
      code: "INVALID_FIELD_TYPE"
    }));
    return;
  }
  const validFunctionNames = new Set;
  if (Array.isArray(functions)) {
    for (const fn of functions) {
      if (typeof fn === "object" && fn !== null) {
        const f = fn;
        if (typeof f.name === "string" && f.name !== "") {
          validFunctionNames.add(f.name);
        }
      }
    }
  }
  const seenKeys = new Set;
  for (const [index, tmpl] of functionTemplates.entries()) {
    errors.push(...validateSchemaFunctionTemplate(tmpl, index, seenKeys, validFunctionNames, functions));
  }
}
function validateTemplatKey(t, prefix, seenKeys) {
  if (typeof t.key !== "string" || t.key === "") {
    return [
      createError(`${prefix} must have a non-empty "key" field`, {
        code: "MISSING_REQUIRED_FIELD"
      })
    ];
  }
  const errors = [];
  if (seenKeys.has(t.key)) {
    errors.push(createError(`${prefix} has duplicate key "${t.key}"`, {
      code: "DUPLICATE_FUNCTION_NAME"
    }));
  }
  seenKeys.add(t.key);
  return errors;
}
function validateTemplateBaseFunctionName(t, prefix, validFunctionNames) {
  if (typeof t.baseFunctionName !== "string" || t.baseFunctionName === "") {
    return [
      createError(`${prefix} must have a non-empty "baseFunctionName" field`, {
        code: "MISSING_REQUIRED_FIELD"
      })
    ];
  }
  if (!validFunctionNames.has(t.baseFunctionName)) {
    return [
      createError(`${prefix} references unknown function "${t.baseFunctionName}"`, { code: "MISSING_REQUIRED_FIELD" })
    ];
  }
  return [];
}
function validateTemplateOptionalFields(t, prefix) {
  const errors = [];
  if (typeof t.label !== "string" || t.label === "") {
    errors.push(createError(`${prefix} must have a non-empty "label" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (typeof t.shortDescription !== "string" || t.shortDescription === "") {
    errors.push(createError(`${prefix} must have a non-empty "shortDescription" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  }
  if (t.whatItDoes !== undefined && typeof t.whatItDoes !== "string") {
    errors.push(createError(`${prefix}.whatItDoes must be a string`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  if (t.isPopular !== undefined && typeof t.isPopular !== "boolean") {
    errors.push(createError(`${prefix}.isPopular must be a boolean`, {
      code: "INVALID_FIELD_TYPE"
    }));
  }
  return errors;
}
function validateTemplateAliases(t, prefix) {
  if (t.aliases === undefined)
    return [];
  if (!Array.isArray(t.aliases)) {
    return [
      createError(`${prefix}.aliases must be an array`, {
        code: "INVALID_FIELD_TYPE"
      })
    ];
  }
  const errors = [];
  for (const alias of t.aliases) {
    if (typeof alias !== "string" || alias === "") {
      errors.push(createError(`${prefix}.aliases items must be non-empty strings`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  }
  return errors;
}
function validateSchemaFunctionTemplate(tmpl, index, seenKeys, validFunctionNames, functions) {
  const prefix = `functionTemplates[${String(index)}]`;
  if (typeof tmpl !== "object" || tmpl === null) {
    return [
      createError(`${prefix} must be an object`, {
        code: "INVALID_FIELD_TYPE"
      })
    ];
  }
  const t = tmpl;
  const errors = [
    ...validateTemplatKey(t, prefix, seenKeys),
    ...validateTemplateBaseFunctionName(t, prefix, validFunctionNames),
    ...validateTemplateOptionalFields(t, prefix),
    ...validateTemplateAliases(t, prefix)
  ];
  if (t.defaults === undefined) {
    errors.push(createError(`${prefix} must have a "defaults" field`, {
      code: "MISSING_REQUIRED_FIELD"
    }));
  } else {
    errors.push(...validateTemplateDefaults(t.defaults, prefix, typeof t.baseFunctionName === "string" ? t.baseFunctionName : undefined, functions));
  }
  return errors;
}
function buildBaseFunctionParamNames(baseFunctionName, functions) {
  const validParamNames = new Set;
  if (!Array.isArray(functions))
    return validParamNames;
  for (const fn of functions) {
    if (typeof fn !== "object" || fn === null || fn.name !== baseFunctionName) {
      continue;
    }
    const params = fn.params;
    if (Array.isArray(params)) {
      for (const p of params) {
        if (typeof p === "object" && p !== null && typeof p.name === "string") {
          validParamNames.add(p.name);
        }
      }
    }
    break;
  }
  return validParamNames;
}
function validateTemplateDefaultValue(value, valuePath) {
  const errors = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(createError(`${valuePath} must be an object with "kind" field`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const v = value;
  if (v["kind"] === "scalar") {
    const val = v["value"];
    if (typeof val !== "string" && typeof val !== "number" && typeof val !== "boolean") {
      errors.push(createError(`${valuePath} scalar value must be string, number, or boolean`, { code: "INVALID_FIELD_TYPE" }));
    }
  } else if (v["kind"] === "lua") {
    if (typeof v["lua"] !== "string") {
      errors.push(createError(`${valuePath} lua value must have a "lua" string field`, {
        code: "INVALID_FIELD_TYPE"
      }));
    }
  } else if (v["kind"] === "multiselect") {
    if (!Array.isArray(v["values"]) || !v["values"].every((entry) => typeof entry === "string")) {
      errors.push(createError(`${valuePath} multiselect value must have a "values" array of strings`, { code: "INVALID_FIELD_TYPE" }));
    }
  } else if (v["kind"] === "object") {
    if (typeof v["entries"] !== "object" || v["entries"] === null || Array.isArray(v["entries"])) {
      errors.push(createError(`${valuePath} object value must have an "entries" object`, {
        code: "INVALID_FIELD_TYPE"
      }));
    } else {
      for (const [entryName, entryValue] of Object.entries(v["entries"])) {
        errors.push(...validateTemplateDefaultValue(entryValue, `${valuePath}.entries[${JSON.stringify(entryName)}]`));
      }
    }
  } else {
    errors.push(createError(`${valuePath} must have kind "scalar", "lua", "multiselect", or "object", got "${String(v["kind"])}"`, { code: "INVALID_FIELD_TYPE" }));
  }
  return errors;
}
function validateTemplateDefaults(defaults, prefix, baseFunctionName, functions) {
  const errors = [];
  if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) {
    errors.push(createError(`${prefix}.defaults must be an object`, {
      code: "INVALID_FIELD_TYPE"
    }));
    return errors;
  }
  const validParamNames = baseFunctionName !== undefined ? buildBaseFunctionParamNames(baseFunctionName, functions) : new Set;
  for (const [paramName, value] of Object.entries(defaults)) {
    if (validParamNames.size > 0 && !validParamNames.has(paramName)) {
      errors.push(createError(`${prefix}.defaults has unknown param "${paramName}" ` + `(base function "${baseFunctionName ?? "?"}" has params: [${[...validParamNames].join(", ")}])`, { code: "INVALID_FIELD_TYPE" }));
    }
    errors.push(...validateTemplateDefaultValue(value, `${prefix}.defaults[${JSON.stringify(paramName)}]`));
  }
  return errors;
}
function validatePluginKeymapOption(option, errors) {
  const opt = option;
  const optKey = String(opt["key"] ?? "<unknown>");
  if (!Array.isArray(opt["commands"]) || opt["commands"].length === 0) {
    errors.push(createError(`plugin-keymap option "${optKey}" must have a non-empty 'commands' array`, { code: "INVALID_FIELD_TYPE", source: optKey }));
    return;
  }
  if (!Array.isArray(opt["presets"]) || opt["presets"].length === 0) {
    errors.push(createError(`plugin-keymap option "${optKey}" must have a non-empty 'presets' array`, { code: "INVALID_FIELD_TYPE", source: optKey }));
    return;
  }
  if (typeof opt["defaultPreset"] !== "string" || opt["defaultPreset"] === "") {
    errors.push(createError(`plugin-keymap option "${optKey}" must have a non-empty 'defaultPreset' string`, { code: "INVALID_FIELD_TYPE", source: optKey }));
    return;
  }
  const commandNames = new Set;
  for (const cmd of opt["commands"]) {
    if (typeof cmd !== "object" || cmd === null) {
      errors.push(createError(`plugin-keymap option "${optKey}": each command must be an object`, { source: optKey }));
      continue;
    }
    const c = cmd;
    if (typeof c["name"] !== "string" || c["name"] === "") {
      errors.push(createError(`plugin-keymap option "${optKey}": command must have a non-empty 'name'`, { source: optKey }));
    } else {
      if (commandNames.has(c["name"])) {
        errors.push(createError(`plugin-keymap option "${optKey}": duplicate command name "${c["name"]}"`, { code: "INVALID_FIELD_VALUE", source: optKey }));
      }
      commandNames.add(c["name"]);
    }
    if (typeof c["label"] !== "string" || c["label"] === "") {
      errors.push(createError(`plugin-keymap option "${optKey}": command must have a non-empty 'label'`, { source: optKey }));
    }
  }
  const presetIds = new Set;
  for (const preset of opt["presets"]) {
    if (typeof preset !== "object" || preset === null) {
      errors.push(createError(`plugin-keymap option "${optKey}": each preset must be an object`, { source: optKey }));
      continue;
    }
    const p = preset;
    if (typeof p["id"] !== "string" || p["id"] === "") {
      errors.push(createError(`plugin-keymap option "${optKey}": preset must have a non-empty 'id'`, { source: optKey }));
      continue;
    }
    if (presetIds.has(p["id"])) {
      errors.push(createError(`plugin-keymap option "${optKey}": duplicate preset id "${p["id"]}"`, { code: "INVALID_FIELD_VALUE", source: optKey }));
    }
    presetIds.add(p["id"]);
    if (typeof p["label"] !== "string" || p["label"] === "") {
      errors.push(createError(`plugin-keymap option "${optKey}": preset "${p["id"]}" must have a non-empty 'label'`, { source: optKey }));
    }
    if (p["mappings"] === undefined || p["mappings"] === null) {
      errors.push(createError(`plugin-keymap option "${optKey}": preset "${p["id"]}" must have a 'mappings' object`, { source: optKey }));
    } else if (typeof p["mappings"] !== "object" || Array.isArray(p["mappings"])) {
      errors.push(createError(`plugin-keymap option "${optKey}": preset "${p["id"]}" mappings must be an object`, { code: "INVALID_FIELD_TYPE", source: optKey }));
    } else {
      for (const [key, cmds] of Object.entries(p["mappings"])) {
        if (!Array.isArray(cmds)) {
          errors.push(createError(`plugin-keymap option "${optKey}": preset "${p["id"]}" mapping "${key}" must be an array of command names`, { code: "INVALID_FIELD_TYPE", source: optKey }));
          continue;
        }
        for (const cmd of cmds) {
          if (typeof cmd === "string" && commandNames.size > 0 && !commandNames.has(cmd)) {
            errors.push(createError(`Preset "${p["id"]}" mapping "${key}" references unknown command "${cmd}"`, { code: "INVALID_FIELD_VALUE", source: optKey }));
          }
        }
      }
    }
  }
  if (!presetIds.has(opt["defaultPreset"])) {
    errors.push(createError(`plugin-keymap option "${optKey}": defaultPreset "${String(opt["defaultPreset"])}" does not match any preset id (available: ${[...presetIds].join(", ")})`, { code: "INVALID_FIELD_VALUE", source: optKey }));
  }
}
function effectiveKey(option) {
  return option.emitKey ?? option.key;
}

var EFFECTIVE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

class LuaGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LuaGenerationError";
  }
}
function assertSchemaShape(schema) {
  const seenEffectiveKeys = new Map;
  for (const option of schema.options) {
    const emittedKey = effectiveKey(option);
    if (!EFFECTIVE_KEY_PATTERN.test(emittedKey)) {
      throw new LuaGenerationError(`Schema "${schema.id}": option "${option.key}" has invalid effective key "${emittedKey}".`);
    }
    if (emittedKey.endsWith(".") || emittedKey.includes("..")) {
      throw new LuaGenerationError(`Schema "${schema.id}": option "${option.key}" has invalid effective key "${emittedKey}".`);
    }
    const priorOwner = seenEffectiveKeys.get(emittedKey);
    if (priorOwner !== undefined) {
      throw new LuaGenerationError(`Schema "${schema.id}": effective key collision "${emittedKey}" between "${priorOwner}" and "${option.key}".`);
    }
    seenEffectiveKeys.set(emittedKey, option.key);
  }
}
export {
  validateSchema,
  assertSchemaShape,
  LuaGenerationError
};
