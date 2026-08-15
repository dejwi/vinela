import { realpathSync } from 'node:fs'
import { open as defaultOpen } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {null | boolean | number | string | JsonValue[] | JsonObject} JsonValue */
/** @typedef {{ [key: string]: JsonValue }} JsonObject */

/**
 * @typedef StructuralError
 * @property {string} instancePath
 * @property {string} keyword
 * @property {string} message
 * @property {{ additionalProperty?: string, missingProperty?: string, allowedValues?: JsonValue[] }} params
 */

/**
 * @typedef SemanticError
 * @property {string} message
 * @property {string} [code]
 * @property {string} [source]
 */

/** @typedef {{ readonly valid: true, readonly errors: readonly [], readonly warnings: readonly SemanticError[] } | { readonly valid: false, readonly errors: readonly SemanticError[], readonly warnings: readonly SemanticError[] }} SemanticValidationResult */
/** @typedef {((value: JsonObject) => boolean) & { readonly errors: readonly StructuralError[] | null }} StructuralValidator */
/** @typedef {{ readonly validatePluginSchemaStructure: StructuralValidator }} StructuralValidatorModule */
/** @typedef {{ readonly LuaGenerationError: new (message: string) => Error, readonly assertSchemaShape: (value: JsonObject) => void, readonly validateSchema: (value: JsonObject) => SemanticValidationResult }} SemanticValidatorModule */

/** @typedef {{ readonly kind: 'usage' } | { readonly kind: 'ok', readonly path: string }} ParseArgumentsResult */
/** @typedef {{ readonly kind: 'ok', readonly bytes: Buffer } | { readonly kind: 'oversize' } | { readonly kind: 'read-error', readonly message: string }} ReadBoundedDocumentResult */
/** @typedef {{ readonly kind: 'ok', readonly value: JsonObject } | { readonly kind: 'document-error', readonly message: string, readonly code: 1 }} ParseDocumentResult */
/** @typedef {{ readonly kind: 'ok' } | { readonly kind: 'internal-error', readonly message: string }} NamespaceCheckResult */
/** @typedef {{ readonly kind: 'ok', readonly structural: StructuralValidatorModule, readonly semantic: SemanticValidatorModule } | { readonly kind: 'internal-error', readonly message: string }} LoadedGeneratedModulesResult */
/** @typedef {{ readonly exitCode: 0, readonly stdout: string, readonly stderr: '' } | { readonly exitCode: 1, readonly stdout: '', readonly stderr: string } | { readonly exitCode: 2, readonly stdout: '', readonly stderr: string }} ValidatorCoreResult */

/**
 * @typedef BoundedReadHandle
 * @property {(buffer: Buffer, offset: number, length: number, position: number) => Promise<{ readonly bytesRead: number }>} read
 * @property {() => Promise<void>} close
 */

/** @typedef {(path: string, flags: 'r') => Promise<BoundedReadHandle>} OpenReadOnly */
/** @typedef {(path: string) => Promise<unknown>} ImportModule */
/** @typedef {{ readonly open?: OpenReadOnly }} ReadBoundedDocumentDependencies */
/** @typedef {{ readonly import?: ImportModule }} LoadGeneratedModulesDependencies */
/** @typedef {ReadBoundedDocumentDependencies & LoadGeneratedModulesDependencies} ValidatorCoreDependencies */

export const MAX_BYTES = 2 * 1024 * 1024
export const USAGE = 'usage: node validate-plugin-schema.mjs [path]\n'
export const STRUCTURAL_EXPORTS = /** @type {const} */ ([
  'validatePluginSchemaStructure',
])
export const SEMANTIC_EXPORTS = /** @type {const} */ ([
  'LuaGenerationError',
  'assertSchemaShape',
  'validateSchema',
])

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {string} value
 * @returns {string}
 */
export function sanitizeLine(value) {
  return value
    .replace(/[\r\n\u2028\u2029\u0085]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
}

/**
 * @param {string} prefix
 * @param {string} message
 * @returns {string}
 */
function renderDiagnosticLine(prefix, message) {
  const line = sanitizeLine(`${prefix}: ${message}`)
  return `${line}\n`
}

/**
 * @param {readonly string[]} lines
 * @returns {string}
 */
function renderSanitizedLines(lines) {
  return lines.map((line) => `${sanitizeLine(line)}\n`).join('')
}

/**
 * @param {readonly string[]} argv
 * @param {string} cwd
 * @returns {ParseArgumentsResult}
 */
export function parseArguments(argv, cwd) {
  if (argv.length === 0) {
    return { kind: 'ok', path: resolve(cwd, 'vinela.schema.json') }
  }
  if (argv.length > 1) {
    return { kind: 'usage' }
  }
  const operand = argv[0]
  if (
    operand === undefined ||
    operand === '-' ||
    operand === '--' ||
    operand.startsWith('-')
  ) {
    return { kind: 'usage' }
  }
  return { kind: 'ok', path: resolve(cwd, operand) }
}

/**
 * @param {string} filePath
 * @param {ReadBoundedDocumentDependencies} [dependencies]
 * @returns {Promise<ReadBoundedDocumentResult>}
 */
export async function readBoundedDocument(filePath, dependencies = {}) {
  const openFn = dependencies.open ?? /** @type {OpenReadOnly} */ (defaultOpen)
  /** @type {BoundedReadHandle | undefined} */
  let handle
  /** @type {ReadBoundedDocumentResult | undefined} */
  let result
  try {
    handle = await openFn(filePath, 'r')
    /** @type {Buffer[]} */
    const chunks = []
    let total = 0
    const buffer = Buffer.alloc(64 * 1024)
    while (total <= MAX_BYTES) {
      const remainingAllowance = MAX_BYTES + 1 - total
      if (remainingAllowance === 0) {
        break
      }
      const toRead = Math.min(buffer.length, remainingAllowance)
      const { bytesRead } = await handle.read(buffer, 0, toRead, total)
      if (bytesRead === 0) {
        break
      }
      total += bytesRead
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)))
      if (total > MAX_BYTES) {
        result = { kind: 'oversize' }
        break
      }
    }
    if (result === undefined) {
      result = { kind: 'ok', bytes: Buffer.concat(chunks) }
    }
  } catch (error) {
    result = { kind: 'read-error', message: errorMessage(error) }
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close()
      } catch (closeError) {
        result = { kind: 'read-error', message: errorMessage(closeError) }
      }
    }
  }
  return result ?? {
    kind: 'read-error',
    message: 'read completed without a result',
  }
}

/**
 * @param {Buffer} bytes
 * @returns {ParseDocumentResult}
 */
export function parseDocument(bytes) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return { kind: 'document-error', message: 'invalid UTF-8', code: 1 }
  }
  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { kind: 'document-error', message: 'invalid JSON', code: 1 }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'document-error', message: 'root must be an object', code: 1 }
  }
  return { kind: 'ok', value: /** @type {JsonObject} */ (parsed) }
}

/**
 * @param {string} instancePath
 * @returns {string}
 */
function normalizeAjvPath(instancePath) {
  if (!instancePath) {
    return '/'
  }
  return instancePath.startsWith('/') ? instancePath : `/${instancePath}`
}

/**
 * @param {StructuralError} error
 * @returns {string}
 */
function renderStructureError(error) {
  const pathPart = normalizeAjvPath(error.instancePath)
  const keyword = typeof error.keyword === 'string' ? error.keyword : 'invalid'
  const message =
    typeof error.message === 'string' ? error.message : 'invalid value'
  const params =
    error.params && typeof error.params === 'object' ? error.params : {}
  const details = []
  if (typeof params.additionalProperty === 'string') {
    details.push(`additional property "${params.additionalProperty}"`)
  }
  if (typeof params.missingProperty === 'string') {
    details.push(`missing property "${params.missingProperty}"`)
  }
  if (Array.isArray(params.allowedValues)) {
    details.push(`allowed values: ${params.allowedValues.map(String).join(', ')}`)
  }
  const suffix = details.length > 0 ? ` (${details.join('; ')})` : ''
  return `structure: ${pathPart} ${keyword}: ${message}${suffix}`
}

/**
 * @param {readonly StructuralError[]} errors
 * @returns {readonly string[]}
 */
export function renderStructureErrors(errors) {
  const rendered = errors.map(renderStructureError).map(sanitizeLine)
  rendered.sort((left, right) => left.localeCompare(right))
  return [...new Set(rendered)]
}

/**
 * @param {SemanticError} error
 * @returns {string}
 */
function renderSemanticError(error) {
  const code =
    typeof error.code === 'string' && error.code.length > 0
      ? `[${error.code}] `
      : ''
  const message =
    typeof error.message === 'string' ? error.message : 'invalid schema'
  const source = typeof error.source === 'string' ? error.source : 'schema'
  return sanitizeLine(`semantic: ${code}${message} (${source})`)
}

/**
 * @param {readonly SemanticError[]} errors
 * @returns {readonly string[]}
 */
export function renderSemanticErrors(errors) {
  const rendered = errors.map(renderSemanticError)
  rendered.sort((left, right) => left.localeCompare(right))
  return rendered
}

/**
 * @param {unknown} value
 * @returns {value is object}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null
}

/**
 * @param {unknown} moduleNamespace
 * @param {readonly string[]} expectedExports
 * @param {string} label
 * @returns {NamespaceCheckResult}
 */
export function assertExactNamespace(
  moduleNamespace,
  expectedExports,
  label,
) {
  if (!isObject(moduleNamespace)) {
    return {
      kind: 'internal-error',
      message: `${label} export contract mismatch (namespace is not an object)`,
    }
  }
  const actual = Object.keys(moduleNamespace).sort()
  const expected = [...expectedExports].sort()
  if (
    actual.length !== expected.length ||
    !actual.every((name, index) => name === expected[index])
  ) {
    const missing = expected.filter((name) => !actual.includes(name))
    const extra = actual.filter((name) => !expected.includes(name))
    const parts = []
    if (missing.length > 0) {
      parts.push(`missing ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      parts.push(`extra ${extra.join(', ')}`)
    }
    return {
      kind: 'internal-error',
      message: `${label} export contract mismatch (${parts.join('; ')})`,
    }
  }
  return { kind: 'ok' }
}

/**
 * @param {unknown} value
 * @returns {value is SemanticValidationResult}
 */
function isSemanticValidationResult(value) {
  if (!isObject(value)) {
    return false
  }
  const valid = Reflect.get(value, 'valid')
  const errors = Reflect.get(value, 'errors')
  const warnings = Reflect.get(value, 'warnings')
  if (!Array.isArray(errors) || !Array.isArray(warnings)) {
    return false
  }
  return valid === false || (valid === true && errors.length === 0)
}

/**
 * @param {string} scriptDir
 * @param {LoadGeneratedModulesDependencies} [dependencies]
 * @returns {Promise<LoadedGeneratedModulesResult>}
 */
export async function loadGeneratedModules(scriptDir, dependencies = {}) {
  const importFn = dependencies.import ?? ((path) => import(path))
  const structuralPath = join(scriptDir, 'structural-validator.generated.mjs')
  const semanticPath = join(scriptDir, 'semantic-validator.generated.mjs')
  /** @type {unknown} */
  let structural
  /** @type {unknown} */
  let semantic
  try {
    structural = await importFn(structuralPath)
    semantic = await importFn(semanticPath)
  } catch (error) {
    return { kind: 'internal-error', message: errorMessage(error) }
  }
  const structuralNamespace = assertExactNamespace(
    structural,
    STRUCTURAL_EXPORTS,
    'structural validator',
  )
  if (structuralNamespace.kind !== 'ok') {
    return structuralNamespace
  }
  const semanticNamespace = assertExactNamespace(
    semantic,
    SEMANTIC_EXPORTS,
    'semantic validator',
  )
  if (semanticNamespace.kind !== 'ok') {
    return semanticNamespace
  }
  if (!isObject(structural) || !isObject(semantic)) {
    return {
      kind: 'internal-error',
      message: 'generated validator namespace contract mismatch',
    }
  }
  const structuralValidator = Reflect.get(
    structural,
    'validatePluginSchemaStructure',
  )
  const validateSchema = Reflect.get(semantic, 'validateSchema')
  const assertSchemaShape = Reflect.get(semantic, 'assertSchemaShape')
  const LuaGenerationError = Reflect.get(semantic, 'LuaGenerationError')
  if (typeof structuralValidator !== 'function') {
    return {
      kind: 'internal-error',
      message: 'structural validator export contract mismatch',
    }
  }
  if (
    typeof validateSchema !== 'function' ||
    typeof assertSchemaShape !== 'function' ||
    typeof LuaGenerationError !== 'function'
  ) {
    return {
      kind: 'internal-error',
      message: 'semantic validator export contract mismatch',
    }
  }
  return {
    kind: 'ok',
    structural: {
      validatePluginSchemaStructure:
        /** @type {StructuralValidator} */ (structuralValidator),
    },
    semantic: {
      validateSchema:
        /** @type {(value: JsonObject) => SemanticValidationResult} */ (
          validateSchema
        ),
      assertSchemaShape:
        /** @type {(value: JsonObject) => void} */ (assertSchemaShape),
      LuaGenerationError:
        /** @type {new (message: string) => Error} */ (LuaGenerationError),
    },
  }
}

/**
 * @param {{ readonly argv: readonly string[], readonly cwd: string, readonly scriptDir: string, readonly dependencies?: ValidatorCoreDependencies }} input
 * @returns {Promise<ValidatorCoreResult>}
 */
export async function runValidatorCore({
  argv,
  cwd,
  scriptDir,
  dependencies = {},
}) {
  const args = parseArguments(argv, cwd)
  if (args.kind === 'usage') {
    return { exitCode: 2, stdout: '', stderr: USAGE }
  }

  const documentRead = await readBoundedDocument(args.path, dependencies)
  if (documentRead.kind === 'oversize') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: renderDiagnosticLine(
        'document',
        'exceeds 2097152-byte limit',
      ),
    }
  }
  if (documentRead.kind === 'read-error') {
    return {
      exitCode: 2,
      stdout: '',
      stderr: renderDiagnosticLine('read', documentRead.message),
    }
  }

  const parsed = parseDocument(documentRead.bytes)
  if (parsed.kind === 'document-error') {
    return {
      exitCode: parsed.code,
      stdout: '',
      stderr: renderDiagnosticLine('document', parsed.message),
    }
  }

  const modules = await loadGeneratedModules(scriptDir, dependencies)
  if (modules.kind === 'internal-error') {
    return {
      exitCode: 2,
      stdout: '',
      stderr: renderDiagnosticLine('internal', modules.message),
    }
  }

  const { structural, semantic } = modules
  const structureValid = structural.validatePluginSchemaStructure(parsed.value)
  if (!structureValid) {
    const errors = Array.isArray(
      structural.validatePluginSchemaStructure.errors,
    )
      ? structural.validatePluginSchemaStructure.errors
      : []
    return {
      exitCode: 1,
      stdout: '',
      stderr: renderSanitizedLines(renderStructureErrors(errors)),
    }
  }

  const semanticResult = semantic.validateSchema(parsed.value)
  if (!isSemanticValidationResult(semanticResult)) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: renderDiagnosticLine(
        'internal',
        'semantic validator result contract mismatch',
      ),
    }
  }
  if (!semanticResult.valid) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: renderSanitizedLines(renderSemanticErrors(semanticResult.errors)),
    }
  }

  try {
    semantic.assertSchemaShape(parsed.value)
  } catch (error) {
    if (error instanceof semantic.LuaGenerationError) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: renderDiagnosticLine('invariant', error.message),
      }
    }
    return {
      exitCode: 2,
      stdout: '',
      stderr: renderDiagnosticLine('internal', errorMessage(error)),
    }
  }

  return { exitCode: 0, stdout: 'valid: schema is valid\n', stderr: '' }
}

/** @returns {Promise<void>} */
async function main() {
  /** @type {ValidatorCoreResult} */
  let result
  try {
    result = await runValidatorCore({
      argv: process.argv.slice(2),
      cwd: process.cwd(),
      scriptDir: dirname(fileURLToPath(import.meta.url)),
    })
  } catch (error) {
    result = {
      exitCode: 2,
      stdout: '',
      stderr: renderDiagnosticLine('internal', errorMessage(error)),
    }
  }
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr)
  }
  process.exitCode = result.exitCode
}

const invokedPath = process.argv[1]
if (
  invokedPath !== undefined &&
  realpathSync(resolve(invokedPath)) ===
    realpathSync(fileURLToPath(import.meta.url))
) {
  await main()
}
