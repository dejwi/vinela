import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  constants as fsConstants,
  readFileSync,
  type Stats,
} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export const CANONICAL_BUN_VERSION = '1.3.14'
export const AJV_VERSION = '8.20.0'
export const AJV_FORMATS_VERSION = '3.0.1'
export const STRUCTURAL_CONTRACT_PATH = 'schema/plugin-schema.schema.json'

export const APPROVED_SEMANTIC_INPUTS: readonly string[] = [
  'src/shared/lib/schema-validation.ts',
  'src/features/lua-generator/utils/schema-shape-invariants.ts',
  'src/shared/types/schema.ts',
  'src/shared/types/validation.ts',
  'src/shared/lib/lua-template.ts',
  'src/shared/lib/schema-mapping-table.ts',
  'src/shared/lib/schema-option-paths.ts',
  'src/shared/lib/setup-template.ts',
  'src/features/lua-generator/utils/effective-key.ts',
] as const

export const SEMANTIC_FORBIDDEN_MARKERS = [
  'normalizeAutocmdEventNames',
] as const
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
export const NEW_FILE_MODE = 0o644

export const SKILL_DIR = 'skills/vinela-plugin-schema'
export const STRUCTURAL_VALIDATOR_RELATIVE_PATH = `${SKILL_DIR}/scripts/structural-validator.generated.mjs`
export const SEMANTIC_VALIDATOR_RELATIVE_PATH = `${SKILL_DIR}/scripts/semantic-validator.generated.mjs`
export const THIRD_PARTY_NOTICES_RELATIVE_PATH = `${SKILL_DIR}/THIRD_PARTY_NOTICES.md`
export const SCHEMA_VALIDATOR_BUILD_COMMAND = 'bun run schema:validator:build'

export const CANONICAL_PRODUCER_POLICY = `Canonical artifacts are produced on Linux x64 with Bun ${CANONICAL_BUN_VERSION}.`

export const STRUCTURAL_NOTICE_POINTER = '../THIRD_PARTY_NOTICES.md'

export const EXPECTED_STRUCTURAL_PACKAGES: readonly {
  name: string
  version: string
}[] = [
  { name: 'ajv', version: AJV_VERSION },
  { name: 'ajv-formats', version: AJV_FORMATS_VERSION },
] as const

export const SEMANTIC_AUTHORITY_PATHS = {
  schemaValidation: 'src/shared/lib/schema-validation.ts',
  shapeInvariants:
    'src/features/lua-generator/utils/schema-shape-invariants.ts',
} as const

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export type DestinationSnapshot =
  | { readonly state: 'absent' }
  | {
      readonly state: 'present'
      readonly bytes: Uint8Array
      readonly mode: number
    }

export interface BunMetafileImportRecord {
  readonly path: string
  readonly kind?: string
  readonly external?: boolean
}

export interface BunMetafileInputRecord {
  readonly bytes: number
  readonly imports?: readonly BunMetafileImportRecord[]
  readonly format?: string
}

export interface BunMetafileOutputInputRecord {
  readonly bytesInOutput: number
}

export interface BunMetafileOutputRecord {
  readonly bytes: number
  readonly inputs: Readonly<Record<string, BunMetafileOutputInputRecord>>
  readonly imports?: readonly BunMetafileImportRecord[]
}

export interface BunMetafile {
  readonly inputs: Readonly<Record<string, BunMetafileInputRecord>>
  readonly outputs: Readonly<Record<string, BunMetafileOutputRecord>>
}

export type MetafileInputClassification =
  | 'temp-excluded'
  | 'repository'
  | 'package'
  | 'builtin'
  | 'external'
  | 'outside-root'
  | 'node-modules'

export type SemanticInputSetComparison =
  | { readonly equal: true }
  | {
      readonly equal: false
      readonly missing: string[]
      readonly extra: string[]
    }

export type StructuralPackageSetComparison =
  | { readonly equal: true }
  | {
      readonly equal: false
      readonly missing: string[]
      readonly extra: string[]
    }

export interface ThirdPartyPackageNotice {
  readonly name: string
  readonly version: string
  readonly sourceUrl: string
  readonly licenseText: string
}

export type ClassifiedSpawnSyncResult =
  | {
      readonly kind: 'completed'
      readonly status: number
      readonly stdout: string
      readonly stderr: string
    }
  | {
      readonly kind: 'spawn-error'
      readonly error: NodeJS.ErrnoException
    }
  | {
      readonly kind: 'timed-out'
      readonly signal: NodeJS.Signals
      readonly stdout: string
      readonly stderr: string
    }
  | {
      readonly kind: 'signaled'
      readonly signal: NodeJS.Signals
      readonly stdout: string
      readonly stderr: string
    }
  | {
      readonly kind: 'null-status'
      readonly stdout: string
      readonly stderr: string
    }
  | {
      readonly kind: 'buffer-error'
      readonly message: string
      readonly stdout: string
      readonly stderr: string
    }

export interface ExclusiveWriteHandle {
  write(bytes: Uint8Array): Promise<void>
  sync(): Promise<void>
  close(): Promise<void>
  chmod(mode: number): Promise<void>
}

export interface ArtifactFileSystem {
  lstat(targetPath: string): Promise<{
    readonly isFile: boolean
    readonly isDirectory: boolean
    readonly isSymbolicLink: boolean
    readonly mode: number
  } | null>
  readFile(targetPath: string): Promise<Uint8Array>
  openExclusiveWrite(targetPath: string): Promise<ExclusiveWriteHandle>
  rename(fromPath: string, toPath: string): Promise<void>
  remove(targetPath: string): Promise<void>
  verifyBytes(targetPath: string, expected: Uint8Array): Promise<boolean>
  verifyAbsent(targetPath: string): Promise<boolean>
}

export type OperationOutcome =
  | { readonly success: true }
  | { readonly success: false; readonly error: string }

export interface ValidatorArtifactCommitTarget {
  readonly destinationPath: string
  readonly candidateBytes: Uint8Array
}

export interface ValidatorArtifactPairFaultInjection {
  readonly failFirstCommitRename?: boolean
  readonly failSecondCommitRename?: boolean
  readonly failStructuralStaging?: boolean
  readonly failSemanticStaging?: boolean
  readonly failAbsentRollbackRemove?: boolean
  readonly failPresentRollbackRename?: boolean
  readonly failRollbackStageWrite?: boolean
  readonly failCleanupRemovalFor?: string
}

export interface ValidateSemanticBuildGraphInput {
  readonly metafile: BunMetafile
  readonly buildRoot: string
  readonly repositoryRoot: string
  readonly semanticEntryPath: string
  readonly sharedTypesAdapterPath: string
  readonly approvedRepositoryInputs: readonly string[]
}

export interface ValidatorPreflightInput {
  readonly repositoryRoot: string
  readonly nodeModulesRoot: string
  readonly noticePath: string
}

export interface CommitValidatorArtifactPairInput {
  readonly structural: ValidatorArtifactCommitTarget
  readonly semantic: ValidatorArtifactCommitTarget
  readonly fileSystem?: ArtifactFileSystem
  readonly faultInjection?: ValidatorArtifactPairFaultInjection
}

export type PairCommitOutcome =
  | {
      readonly outcome: 'committed'
      readonly structuralChanged: boolean
      readonly semanticChanged: boolean
      readonly rollbackOutcome: OperationOutcome
      readonly verificationOutcome: OperationOutcome
      readonly cleanupOutcome: OperationOutcome
    }
  | {
      readonly outcome: 'failed'
      readonly primaryFailure: { readonly step: string; readonly error: string }
      readonly rollbackOutcome: OperationOutcome
      readonly verificationOutcome: OperationOutcome
      readonly cleanupOutcome: OperationOutcome
    }

export interface StructuralBannerInput {
  readonly contractPath: string
  readonly contractSha256: string
  readonly buildCommand: string
  readonly bunVersion: string
  readonly ajvVersion: string
  readonly ajvFormatsVersion: string
}

export interface SemanticBannerInput {
  readonly schemaValidationSha256: string
  readonly shapeInvariantsSha256: string
  readonly closureDigest: string
  readonly buildCommand: string
  readonly bunVersion: string
}

function ok<T>(data: T): Result<T> {
  return { success: true, data }
}

function err<T>(error: string): Result<T> {
  return { success: false, error }
}

function operationSuccess(): OperationOutcome {
  return { success: true }
}

function operationFailure(error: string): OperationOutcome {
  return { success: false, error }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, label: string): Result<string> {
  if (typeof value !== 'string') {
    return err(`${label} must be a string`)
  }
  return ok(value)
}

function readNumber(value: unknown, label: string): Result<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return err(`${label} must be a finite number`)
  }
  return ok(value)
}

function preserveModeBits(mode: number): number {
  return mode & 0o7777
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function packageIdentity(name: string, version: string): string {
  return `${name}@${version}`
}

function sanitizeDiagnosticPath(inputPath: string): string {
  return (
    inputPath
      .replace(/[\r\n\u2028\u2029\u0085]/g, ' ')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: maintainer diagnostics must strip C0/DEL controls from import paths.
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
  )
}

function isRelevantLockKey(key: string, packageName: string): boolean {
  return key === packageName || key.startsWith(`${packageName}@`)
}

function createStageSuffix(): string {
  return `${process.pid}-${randomBytes(8).toString('hex')}`
}

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function normalizePosixPath(inputPath: string): string {
  const replaced = inputPath.replace(/\\/g, '/')
  const segments = replaced
    .split('/')
    .filter((segment: string) => segment.length > 0 && segment !== '.')
  const normalized: string[] = []
  for (const segment of segments) {
    if (segment === '..') {
      normalized.pop()
      continue
    }
    normalized.push(segment)
  }
  if (replaced.startsWith('/')) {
    return `/${normalized.join('/')}`
  }
  return normalized.join('/')
}

export function toRepositoryRelativePath(
  absolutePath: string,
  repositoryRoot: string,
): string | null {
  const normalizedAbsolute = normalizePosixPath(path.resolve(absolutePath))
  const normalizedRoot = normalizePosixPath(path.resolve(repositoryRoot))
  const rootWithSlash = normalizedRoot.endsWith('/')
    ? normalizedRoot
    : `${normalizedRoot}/`
  if (normalizedAbsolute === normalizedRoot) {
    return ''
  }
  if (!normalizedAbsolute.startsWith(rootWithSlash)) {
    return null
  }
  return normalizePosixPath(normalizedAbsolute.slice(rootWithSlash.length))
}

export function compareSemanticInputSets(
  actual: readonly string[],
  approved: readonly string[],
): SemanticInputSetComparison {
  const actualSet = new Set(actual.map((entry) => normalizePosixPath(entry)))
  const approvedSet = new Set(
    approved.map((entry) => normalizePosixPath(entry)),
  )
  const missing = sortedUnique(
    approved.filter((entry) => !actualSet.has(normalizePosixPath(entry))),
  )
  const extra = sortedUnique(
    actual.filter((entry) => !approvedSet.has(normalizePosixPath(entry))),
  )
  if (missing.length === 0 && extra.length === 0) {
    return { equal: true }
  }
  return { equal: false, missing, extra }
}

function parseBunMetafileImportRecord(
  value: unknown,
): Result<BunMetafileImportRecord> {
  if (!isRecord(value)) {
    return err('metafile import record must be an object')
  }
  const importPath = readString(value['path'], 'metafile import.path')
  if (!importPath.success) {
    return importPath
  }
  const record: {
    path: string
    kind?: string
    external?: boolean
  } = { path: importPath.data }
  if ('kind' in value) {
    const kind = readString(value['kind'], 'metafile import.kind')
    if (!kind.success) {
      return kind
    }
    record.kind = kind.data
  }
  if ('external' in value) {
    if (typeof value['external'] !== 'boolean') {
      return err('metafile import.external must be a boolean')
    }
    record.external = value['external']
  }
  return ok(record)
}

function parseBunMetafileInputRecord(
  value: unknown,
): Result<BunMetafileInputRecord> {
  if (!isRecord(value)) {
    return err('metafile input record must be an object')
  }
  const bytes = readNumber(value['bytes'], 'metafile input.bytes')
  if (!bytes.success) {
    return bytes
  }
  const record: {
    bytes: number
    imports?: BunMetafileImportRecord[]
    format?: string
  } = { bytes: bytes.data }
  if ('format' in value) {
    const format = readString(value['format'], 'metafile input.format')
    if (!format.success) {
      return format
    }
    record.format = format.data
  }
  if ('imports' in value) {
    if (!Array.isArray(value['imports'])) {
      return err('metafile input.imports must be an array')
    }
    const imports: BunMetafileImportRecord[] = []
    for (const [index, entry] of value['imports'].entries()) {
      const parsed = parseBunMetafileImportRecord(entry)
      if (!parsed.success) {
        return err(`metafile input.imports[${index}]: ${parsed.error}`)
      }
      imports.push(parsed.data)
    }
    record.imports = imports
  }
  return ok(record)
}

function parseBunMetafileOutputInputRecord(
  value: unknown,
): Result<BunMetafileOutputInputRecord> {
  if (!isRecord(value)) {
    return err('metafile output input record must be an object')
  }
  const bytesInOutput = readNumber(
    value['bytesInOutput'],
    'metafile output input.bytesInOutput',
  )
  if (!bytesInOutput.success) {
    return bytesInOutput
  }
  return ok({ bytesInOutput: bytesInOutput.data })
}

function parseBunMetafileOutputRecord(
  value: unknown,
): Result<BunMetafileOutputRecord> {
  if (!isRecord(value)) {
    return err('metafile output record must be an object')
  }
  const bytes = readNumber(value['bytes'], 'metafile output.bytes')
  if (!bytes.success) {
    return bytes
  }
  if (!isRecord(value['inputs'])) {
    return err('metafile output.inputs must be an object')
  }
  const inputs: Record<string, BunMetafileOutputInputRecord> = {}
  for (const [key, entry] of Object.entries(value['inputs'])) {
    const parsed = parseBunMetafileOutputInputRecord(entry)
    if (!parsed.success) {
      return err(`metafile output.inputs[${key}]: ${parsed.error}`)
    }
    inputs[key] = parsed.data
  }
  const record: {
    bytes: number
    inputs: Record<string, BunMetafileOutputInputRecord>
    imports?: BunMetafileImportRecord[]
  } = {
    bytes: bytes.data,
    inputs,
  }
  if ('imports' in value) {
    if (!Array.isArray(value['imports'])) {
      return err('metafile output.imports must be an array')
    }
    const imports: BunMetafileImportRecord[] = []
    for (const [index, entry] of value['imports'].entries()) {
      const parsed = parseBunMetafileImportRecord(entry)
      if (!parsed.success) {
        return err(`metafile output.imports[${index}]: ${parsed.error}`)
      }
      imports.push(parsed.data)
    }
    record.imports = imports
  }
  return ok(record)
}

export function parseBunMetafile(metafile: unknown): Result<BunMetafile> {
  if (!isRecord(metafile)) {
    return err('metafile must be an object')
  }
  if (!isRecord(metafile['inputs'])) {
    return err('metafile.inputs must be an object')
  }
  if (!isRecord(metafile['outputs'])) {
    return err('metafile.outputs must be an object')
  }
  const inputs: Record<string, BunMetafileInputRecord> = {}
  for (const [key, entry] of Object.entries(metafile['inputs'])) {
    const parsed = parseBunMetafileInputRecord(entry)
    if (!parsed.success) {
      return err(`metafile.inputs[${key}]: ${parsed.error}`)
    }
    inputs[key] = parsed.data
  }
  const outputs: Record<string, BunMetafileOutputRecord> = {}
  for (const [key, entry] of Object.entries(metafile['outputs'])) {
    const parsed = parseBunMetafileOutputRecord(entry)
    if (!parsed.success) {
      return err(`metafile.outputs[${key}]: ${parsed.error}`)
    }
    outputs[key] = parsed.data
  }
  return ok({ inputs, outputs })
}

function isBuiltinSpecifier(inputPath: string): boolean {
  return (
    inputPath.startsWith('node:') ||
    inputPath.startsWith('bun:') ||
    inputPath.startsWith('<builtin>')
  )
}

function isExternalSpecifier(inputPath: string): boolean {
  if (
    inputPath.startsWith('http://') ||
    inputPath.startsWith('https://') ||
    inputPath.startsWith('//')
  ) {
    return true
  }
  if (inputPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(inputPath)) {
    return false
  }
  return !inputPath.startsWith('.') && !inputPath.includes('/')
}

function lexicalResolvedPath(inputPath: string): string {
  return normalizePosixPath(path.resolve(inputPath))
}

async function fsRealpath(inputPath: string): Promise<string> {
  return normalizePosixPath(await fs.realpath(inputPath))
}

function isVirtualOrPackageSpecifier(inputPath: string): boolean {
  const raw = inputPath.replace(/\\/g, '/')
  if (
    raw.startsWith('./') ||
    raw.startsWith('../') ||
    raw === '.' ||
    raw === '..' ||
    raw.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(raw)
  ) {
    return false
  }
  const normalized = normalizePosixPath(inputPath)
  if (
    normalized.startsWith('node:') ||
    normalized.startsWith('bun:') ||
    normalized.startsWith('<builtin>') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('//') ||
    normalized.startsWith('file:')
  ) {
    return true
  }
  return !normalized.includes('/')
}

interface AccountedMetafileInput {
  readonly key: string
  readonly canonicalPath: string
  readonly relativePath: string | null
}

function resolveMetafileInputKey(
  key: string,
  buildRoot: string,
): Result<string> {
  if (isVirtualOrPackageSpecifier(key)) {
    return err(`metafile input key uses unsupported namespace: ${key}`)
  }
  if (path.isAbsolute(key)) {
    return ok(normalizePosixPath(key))
  }
  return ok(normalizePosixPath(path.resolve(buildRoot, key)))
}

function resolveImportEdgeAbsolutePath(
  importPath: string,
  importerCanonicalDirectory: string,
): Result<string> {
  if (isVirtualOrPackageSpecifier(importPath)) {
    return err(`import edge uses unsupported namespace: ${importPath}`)
  }
  if (path.isAbsolute(importPath)) {
    return ok(normalizePosixPath(importPath))
  }
  if (importPath.startsWith('.')) {
    return ok(
      normalizePosixPath(path.resolve(importerCanonicalDirectory, importPath)),
    )
  }
  return err(`import edge is not a filesystem path: ${importPath}`)
}

function buildInputKeyIndex(
  accountedInputs: readonly AccountedMetafileInput[],
): Result<Map<string, AccountedMetafileInput>> {
  const index = new Map<string, AccountedMetafileInput>()
  const canonicalToKey = new Map<string, string>()
  for (const accounted of accountedInputs) {
    if (index.has(accounted.key)) {
      return err(`duplicate metafile input key: ${accounted.key}`)
    }
    index.set(accounted.key, accounted)
    const existingKey = canonicalToKey.get(accounted.canonicalPath)
    if (existingKey !== undefined && existingKey !== accounted.key) {
      return err(
        `metafile input keys alias the same canonical file: ${existingKey} and ${accounted.key}`,
      )
    }
    canonicalToKey.set(accounted.canonicalPath, accounted.key)
    index.set(accounted.canonicalPath, accounted)
  }
  return ok(index)
}

function lookupAccountedInput(
  index: ReadonlyMap<string, AccountedMetafileInput>,
  keyOrPath: string,
): AccountedMetafileInput | null {
  return index.get(keyOrPath) ?? null
}

async function validateImportRecords(
  imports: readonly BunMetafileImportRecord[] | undefined,
  importer: AccountedMetafileInput,
  inputIndex: ReadonlyMap<string, AccountedMetafileInput>,
  label: string,
  sharedTypesAdapterCanonical: string,
): Promise<Result<undefined>> {
  if (!imports) {
    return ok(undefined)
  }
  const importerDirectory = path.dirname(importer.canonicalPath)
  for (const [index, importRecord] of imports.entries()) {
    if (importRecord.external === true) {
      return err(`${label} import[${index}] is external: ${importRecord.path}`)
    }
    const indexed = lookupAccountedInput(inputIndex, importRecord.path)
    if (indexed !== null) {
      continue
    }
    const aliasTarget =
      importRecord.path === '@/shared/types' ||
      importRecord.path === '@/shared/types/index.ts'
        ? sharedTypesAdapterCanonical
        : null
    if (aliasTarget !== null) {
      const accounted = lookupAccountedInput(inputIndex, aliasTarget)
      if (accounted === null) {
        return err(
          `${label} import[${index}] alias is not accounted in metafile inputs: ${importRecord.path}`,
        )
      }
      continue
    }
    const resolved = resolveImportEdgeAbsolutePath(
      importRecord.path,
      importerDirectory,
    )
    if (!resolved.success) {
      return err(`${label} import[${index}]: ${resolved.error}`)
    }
    let canonicalPath: string
    try {
      canonicalPath = await fsRealpath(resolved.data)
    } catch {
      return err(
        `${label} import[${index}] resolves to missing file: ${importRecord.path}`,
      )
    }
    const accounted = lookupAccountedInput(inputIndex, canonicalPath)
    if (accounted === null) {
      return err(
        `${label} import[${index}] is not accounted in metafile inputs: ${importRecord.path}`,
      )
    }
  }
  return ok(undefined)
}

function validateSemanticOutputImports(
  outputKey: string,
  imports: readonly BunMetafileImportRecord[] | undefined,
): Result<undefined> {
  if (!imports || imports.length === 0) {
    return ok(undefined)
  }
  const firstPath = imports[0]?.path
  const pathSuffix =
    firstPath !== undefined
      ? ` (first path: ${sanitizeDiagnosticPath(firstPath)})`
      : ''
  return err(
    `semantic output retains ${imports.length} runtime import(s): metafile.outputs[${outputKey}]${pathSuffix}`,
  )
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canonical semantic graph validation must account for importer-aware edges, output records, and exact approved closure.
export async function validateSemanticBuildGraph(
  input: ValidateSemanticBuildGraphInput,
): Promise<Result<readonly string[]>> {
  let canonicalRepositoryRoot: string
  let canonicalBuildRoot: string
  let canonicalSemanticEntry: string
  let canonicalSharedTypesAdapter: string
  try {
    canonicalRepositoryRoot = await fsRealpath(input.repositoryRoot)
    canonicalBuildRoot = await fsRealpath(input.buildRoot)
    canonicalSemanticEntry = await fsRealpath(input.semanticEntryPath)
    canonicalSharedTypesAdapter = await fsRealpath(input.sharedTypesAdapterPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to canonicalize semantic build roots: ${message}`)
  }
  if (canonicalSemanticEntry === canonicalSharedTypesAdapter) {
    return err('semantic entry and shared-types adapter must be distinct files')
  }
  const excludedCanonicalPaths = new Set([
    canonicalSemanticEntry,
    canonicalSharedTypesAdapter,
  ])
  const accountedInputs: AccountedMetafileInput[] = []
  for (const [key] of Object.entries(input.metafile.inputs)) {
    const resolvedKey = resolveMetafileInputKey(key, canonicalBuildRoot)
    if (!resolvedKey.success) {
      return err(`metafile.inputs[${key}]: ${resolvedKey.error}`)
    }
    let canonicalPath: string
    try {
      canonicalPath = await fsRealpath(resolvedKey.data)
    } catch {
      return err(`metafile input does not exist: ${key}`)
    }
    const relativePath = toRepositoryRelativePath(
      canonicalPath,
      canonicalRepositoryRoot,
    )
    if (
      relativePath !== null &&
      !excludedCanonicalPaths.has(canonicalPath) &&
      pathContainsNodeModules(canonicalPath)
    ) {
      return err(`unexpected node_modules metafile input: ${key}`)
    }
    if (relativePath === null && !excludedCanonicalPaths.has(canonicalPath)) {
      return err(`metafile input outside repository root: ${key}`)
    }
    accountedInputs.push({ key, canonicalPath, relativePath })
  }
  const inputIndexResult = buildInputKeyIndex(accountedInputs)
  if (!inputIndexResult.success) {
    return inputIndexResult
  }
  const inputIndex = inputIndexResult.data
  for (const accounted of accountedInputs) {
    const record = input.metafile.inputs[accounted.key]
    if (!record) {
      return err(`missing metafile input record for ${accounted.key}`)
    }
    const importValidation = await validateImportRecords(
      record.imports,
      accounted,
      inputIndex,
      `metafile.inputs[${accounted.key}]`,
      canonicalSharedTypesAdapter,
    )
    if (!importValidation.success) {
      return importValidation
    }
  }
  const outputKeys = Object.keys(input.metafile.outputs)
  if (outputKeys.length !== 1) {
    return err(
      `semantic build must emit exactly one output, found ${outputKeys.length}`,
    )
  }
  const outputKey = outputKeys[0]
  if (!outputKey) {
    return err('semantic build output key is missing')
  }
  const outputRecord = input.metafile.outputs[outputKey]
  if (!outputRecord) {
    return err(`missing semantic build output record for ${outputKey}`)
  }
  for (const [inputKey] of Object.entries(outputRecord.inputs)) {
    if (lookupAccountedInput(inputIndex, inputKey) === null) {
      return err(
        `semantic output references unknown metafile input: ${inputKey}`,
      )
    }
  }
  const outputImportValidation = validateSemanticOutputImports(
    outputKey,
    outputRecord.imports,
  )
  if (!outputImportValidation.success) {
    return outputImportValidation
  }
  const repositoryInputs = sortedUnique(
    accountedInputs
      .filter(
        (accounted) => !excludedCanonicalPaths.has(accounted.canonicalPath),
      )
      .map((accounted) => accounted.relativePath)
      .filter((relativePath): relativePath is string => relativePath !== null)
      .map((relativePath) => normalizePosixPath(relativePath)),
  )
  const comparison = compareSemanticInputSets(
    repositoryInputs,
    input.approvedRepositoryInputs,
  )
  if (!comparison.equal) {
    const missing =
      comparison.missing.length > 0
        ? `missing approved inputs: ${comparison.missing.join(', ')}`
        : ''
    const extra =
      comparison.extra.length > 0
        ? `unexpected actual inputs: ${comparison.extra.join(', ')}`
        : ''
    return err([missing, extra].filter((entry) => entry.length > 0).join('; '))
  }
  return ok(repositoryInputs)
}

function pathContainsNodeModules(inputPath: string): boolean {
  return normalizePosixPath(inputPath).split('/').includes('node_modules')
}

function nodeModulesPrefix(nodeModulesRoot: string): string {
  const resolvedNodeModules = normalizePosixPath(path.resolve(nodeModulesRoot))
  return resolvedNodeModules.endsWith('/')
    ? resolvedNodeModules
    : `${resolvedNodeModules}/`
}

export function classifyMetafileInput(
  inputPath: string,
  repositoryRoot: string,
  tempWorkspaceRealPaths: ReadonlySet<string>,
): MetafileInputClassification {
  const normalizedInput = normalizePosixPath(inputPath)
  for (const tempPath of tempWorkspaceRealPaths) {
    if (lexicalResolvedPath(inputPath) === lexicalResolvedPath(tempPath)) {
      return 'temp-excluded'
    }
  }
  if (isBuiltinSpecifier(normalizedInput)) {
    return 'builtin'
  }
  if (isExternalSpecifier(normalizedInput)) {
    return 'external'
  }
  const absolutePath = lexicalResolvedPath(inputPath)
  const relative = toRepositoryRelativePath(absolutePath, repositoryRoot)
  if (relative === null) {
    if (pathContainsNodeModules(absolutePath)) {
      return 'node-modules'
    }
    return 'outside-root'
  }
  if (pathContainsNodeModules(absolutePath)) {
    return 'package'
  }
  return 'repository'
}

function readPackageIdentityFromPath(
  packageDirectory: string,
): Result<{ name: string; version: string }> {
  const packageJsonPath = path.join(packageDirectory, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return err(`missing package.json at ${packageDirectory}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to parse ${packageJsonPath}: ${message}`)
  }
  if (!isRecord(parsed)) {
    return err(`package.json at ${packageDirectory} must be an object`)
  }
  const name = readString(parsed['name'], 'package.json name')
  if (!name.success) {
    return name
  }
  const version = readString(parsed['version'], 'package.json version')
  if (!version.success) {
    return version
  }
  return ok({ name: name.data, version: version.data })
}

function resolvePackageDirectoryFromNodeModulesPath(
  inputPath: string,
): string | null {
  const normalizedInput = normalizePosixPath(path.resolve(inputPath))
  const nodeModulesIndex = normalizedInput.indexOf('/node_modules/')
  if (nodeModulesIndex === -1) {
    return null
  }
  const remainder = normalizedInput.slice(
    nodeModulesIndex + '/node_modules/'.length,
  )
  const segments = remainder.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    return null
  }
  const packageRoot = path.join(
    normalizedInput.slice(0, nodeModulesIndex),
    'node_modules',
    segments[0]?.startsWith('@')
      ? `${segments[0]}/${segments[1] ?? ''}`
      : (segments[0] ?? ''),
  )
  return packageRoot
}

export function extractStructuralPackageIdentities(
  metafileInputs: Readonly<Record<string, BunMetafileInputRecord>>,
  repositoryRoot: string,
  nodeModulesRoot: string,
): Result<Set<string>> {
  const identities = new Set<string>()
  const nodeModulesPrefixPath = nodeModulesPrefix(nodeModulesRoot)
  for (const inputPath of Object.keys(metafileInputs)) {
    const classification = classifyMetafileInput(
      inputPath,
      repositoryRoot,
      new Set(),
    )
    if (classification !== 'package') {
      continue
    }
    const resolvedInput = normalizePosixPath(path.resolve(inputPath))
    if (!resolvedInput.startsWith(nodeModulesPrefixPath)) {
      continue
    }
    const packageDirectory =
      resolvePackageDirectoryFromNodeModulesPath(inputPath)
    if (packageDirectory === null) {
      return err(
        `unable to resolve package directory for metafile input: ${inputPath}`,
      )
    }
    const identity = readPackageIdentityFromPath(packageDirectory)
    if (!identity.success) {
      return identity
    }
    identities.add(packageIdentity(identity.data.name, identity.data.version))
  }
  return ok(identities)
}

export function compareStructuralPackageSets(
  actual: ReadonlySet<string>,
  expected: readonly { name: string; version: string }[],
): StructuralPackageSetComparison {
  const actualSet = new Set(actual)
  const expectedIdentities = expected.map((entry) =>
    packageIdentity(entry.name, entry.version),
  )
  const missing = sortedUnique(
    expectedIdentities.filter((identity) => !actualSet.has(identity)),
  )
  const expectedSet = new Set(expectedIdentities)
  const extra = sortedUnique(
    [...actualSet].filter((identity) => !expectedSet.has(identity)),
  )
  if (missing.length === 0 && extra.length === 0) {
    return { equal: true }
  }
  return { equal: false, missing, extra }
}

function normalizeLicenseText(licenseText: string): string {
  return licenseText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
}

export function renderThirdPartyNotices(
  packages: readonly ThirdPartyPackageNotice[],
): string {
  const lines: string[] = [
    'The structural validator for Vinela plugin schemas bundles third-party JavaScript implementations.',
    '',
  ]
  const sortedPackages = [...packages].sort((left, right) => {
    const byName = left.name.localeCompare(right.name)
    if (byName !== 0) {
      return byName
    }
    return left.version.localeCompare(right.version)
  })
  for (const [index, entry] of sortedPackages.entries()) {
    if (index > 0) {
      lines.push('')
    }
    lines.push(`## ${entry.name} ${entry.version}`)
    lines.push('')
    lines.push(`Source: ${entry.sourceUrl}`)
    lines.push('')
    lines.push(normalizeLicenseText(entry.licenseText))
  }
  return `${lines.join('\n')}\n`
}

function readPackageNotice(
  nodeModulesRoot: string,
  packageName: string,
  expectedVersion: string,
  sourceUrl: string,
): Result<ThirdPartyPackageNotice> {
  const packageDirectory = path.join(nodeModulesRoot, packageName)
  const identity = readPackageIdentityFromPath(packageDirectory)
  if (!identity.success) {
    return identity
  }
  if (identity.data.name !== packageName) {
    return err(
      `expected package name ${packageName}, found ${identity.data.name}`,
    )
  }
  if (identity.data.version !== expectedVersion) {
    return err(
      `expected ${packageName} version ${expectedVersion}, found ${identity.data.version}`,
    )
  }
  const licensePath = path.join(packageDirectory, 'LICENSE')
  if (!existsSync(licensePath)) {
    return err(`missing LICENSE for ${packageName}`)
  }
  const licenseText = readFileSync(licensePath, 'utf8')
  return ok({
    name: packageName,
    version: expectedVersion,
    sourceUrl,
    licenseText,
  })
}

export function readPinnedPackageNotices(
  nodeModulesRoot: string,
): Result<ThirdPartyPackageNotice[]> {
  const ajv = readPackageNotice(
    nodeModulesRoot,
    'ajv',
    AJV_VERSION,
    'https://github.com/ajv-validator/ajv',
  )
  if (!ajv.success) {
    return ajv
  }
  const ajvFormats = readPackageNotice(
    nodeModulesRoot,
    'ajv-formats',
    AJV_FORMATS_VERSION,
    'https://github.com/ajv-validator/ajv-formats',
  )
  if (!ajvFormats.success) {
    return ajvFormats
  }
  return ok([ajv.data, ajvFormats.data])
}

function readPackageLicenseField(packageDirectory: string): Result<string> {
  const packageJsonPath = path.join(packageDirectory, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return err(`missing package.json at ${packageDirectory}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to parse ${packageJsonPath}: ${message}`)
  }
  if (!isRecord(parsed)) {
    return err(`package.json at ${packageDirectory} must be an object`)
  }
  const license = readString(parsed['license'], 'package.json license')
  if (!license.success) {
    return license
  }
  return ok(license.data)
}

function parseRootPackageJson(repositoryRoot: string): Result<{
  packageManager?: string
  devDependencies?: Record<string, string>
}> {
  const packageJsonPath = path.join(repositoryRoot, 'package.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to parse package.json: ${message}`)
  }
  if (!isRecord(parsed)) {
    return err('package.json must be an object')
  }
  const result: {
    packageManager?: string
    devDependencies?: Record<string, string>
  } = {}
  if ('packageManager' in parsed) {
    const packageManager = readString(
      parsed['packageManager'],
      'package.json packageManager',
    )
    if (!packageManager.success) {
      return packageManager
    }
    result.packageManager = packageManager.data
  }
  if ('devDependencies' in parsed) {
    if (!isRecord(parsed['devDependencies'])) {
      return err('package.json devDependencies must be an object')
    }
    const devDependencies: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed['devDependencies'])) {
      const version = readString(value, `devDependencies.${key}`)
      if (!version.success) {
        return version
      }
      devDependencies[key] = version.data
    }
    result.devDependencies = devDependencies
  }
  return ok(result)
}

function parseBunLockPreflight(repositoryRoot: string): Result<{
  workspaceDevDependencies: Record<string, string>
  packageResolutions: ReadonlyMap<string, string>
}> {
  const lockPath = path.join(repositoryRoot, 'bun.lock')
  let parsed: unknown
  try {
    parsed = JSON.parse(
      readFileSync(lockPath, 'utf8').replace(/,\s*([}\]])/g, '$1'),
    ) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to parse bun.lock: ${message}`)
  }
  if (!isRecord(parsed)) {
    return err('bun.lock must be an object')
  }
  if (!isRecord(parsed['workspaces'])) {
    return err('bun.lock workspaces must be an object')
  }
  const rootWorkspace = parsed['workspaces']['']
  if (!isRecord(rootWorkspace)) {
    return err('bun.lock root workspace entry is missing')
  }
  if (!isRecord(rootWorkspace['devDependencies'])) {
    return err('bun.lock root workspace devDependencies must be an object')
  }
  const workspaceDevDependencies: Record<string, string> = {}
  for (const [key, value] of Object.entries(rootWorkspace['devDependencies'])) {
    const version = readString(value, `bun.lock devDependencies.${key}`)
    if (!version.success) {
      return version
    }
    workspaceDevDependencies[key] = version.data
  }
  if (!isRecord(parsed['packages'])) {
    return err('bun.lock packages must be an object')
  }
  const packageResolutions = new Map<string, string>()
  for (const [key, value] of Object.entries(parsed['packages'])) {
    if (!Array.isArray(value) || typeof value[0] !== 'string') {
      return err(`bun.lock packages[${key}] must be a resolution tuple`)
    }
    packageResolutions.set(key, value[0])
  }
  return ok({ workspaceDevDependencies, packageResolutions })
}

function validatePinnedLockResolutions(
  packageResolutions: ReadonlyMap<string, string>,
): Result<undefined> {
  for (const entry of EXPECTED_STRUCTURAL_PACKAGES) {
    const expectedResolution = packageIdentity(entry.name, entry.version)
    const relevantKeys = [...packageResolutions.keys()].filter((key) =>
      isRelevantLockKey(key, entry.name),
    )
    if (relevantKeys.length === 0) {
      return err(
        `bun.lock is missing a relevant ${entry.name} resolution key (expected ${expectedResolution})`,
      )
    }
    if (relevantKeys.length > 1) {
      return err(
        `bun.lock contains duplicate relevant ${entry.name} resolution keys: ${relevantKeys.join(', ')}`,
      )
    }
    const relevantKey = relevantKeys[0]
    if (relevantKey === undefined) {
      return err(
        `bun.lock is missing a relevant ${entry.name} resolution key (expected ${expectedResolution})`,
      )
    }
    const resolution = packageResolutions.get(relevantKey)
    if (resolution !== expectedResolution) {
      return err(
        `bun.lock packages[${relevantKey}] must resolve to ${expectedResolution}, found ${resolution ?? 'missing'}`,
      )
    }
  }
  return ok(undefined)
}

export async function runValidatorPreflight(
  input: ValidatorPreflightInput,
): Promise<Result<undefined>> {
  const rootPackage = parseRootPackageJson(input.repositoryRoot)
  if (!rootPackage.success) {
    return rootPackage
  }
  const expectedPackageManager = `bun@${CANONICAL_BUN_VERSION}`
  if (rootPackage.data.packageManager !== expectedPackageManager) {
    return err(
      `package.json packageManager must be ${expectedPackageManager}, found ${rootPackage.data.packageManager ?? 'missing'}`,
    )
  }
  const devDependencies = rootPackage.data.devDependencies ?? {}
  if (devDependencies['ajv'] !== AJV_VERSION) {
    return err(
      `package.json devDependencies.ajv must be exactly ${AJV_VERSION}, found ${devDependencies['ajv'] ?? 'missing'}`,
    )
  }
  if (devDependencies['ajv-formats'] !== AJV_FORMATS_VERSION) {
    return err(
      `package.json devDependencies["ajv-formats"] must be exactly ${AJV_FORMATS_VERSION}, found ${devDependencies['ajv-formats'] ?? 'missing'}`,
    )
  }
  const lockPreflight = parseBunLockPreflight(input.repositoryRoot)
  if (!lockPreflight.success) {
    return lockPreflight
  }
  if (lockPreflight.data.workspaceDevDependencies['ajv'] !== AJV_VERSION) {
    return err(
      `bun.lock root devDependencies.ajv must be exactly ${AJV_VERSION}`,
    )
  }
  if (
    lockPreflight.data.workspaceDevDependencies['ajv-formats'] !==
    AJV_FORMATS_VERSION
  ) {
    return err(
      `bun.lock root devDependencies["ajv-formats"] must be exactly ${AJV_FORMATS_VERSION}`,
    )
  }
  const lockResolutionCheck = validatePinnedLockResolutions(
    lockPreflight.data.packageResolutions,
  )
  if (!lockResolutionCheck.success) {
    return lockResolutionCheck
  }
  for (const entry of EXPECTED_STRUCTURAL_PACKAGES) {
    const packageDirectory = path.join(input.nodeModulesRoot, entry.name)
    const identity = readPackageIdentityFromPath(packageDirectory)
    if (!identity.success) {
      return identity
    }
    if (identity.data.name !== entry.name) {
      return err(
        `installed ${entry.name} package name mismatch: ${identity.data.name}`,
      )
    }
    if (identity.data.version !== entry.version) {
      return err(
        `installed ${entry.name} version must be ${entry.version}, found ${identity.data.version}`,
      )
    }
    const license = readPackageLicenseField(packageDirectory)
    if (!license.success) {
      return license
    }
    if (license.data !== 'MIT') {
      return err(
        `installed ${entry.name} license must be MIT, found ${license.data}`,
      )
    }
  }
  const noticeCheck = await verifyCommittedNotice(
    input.noticePath,
    input.nodeModulesRoot,
  )
  if (!noticeCheck.success) {
    return noticeCheck
  }
  return ok(undefined)
}

export function classifySpawnSyncResult(
  result: SpawnSyncReturns<string>,
): ClassifiedSpawnSyncResult {
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (result.error) {
    const spawnError = result.error as NodeJS.ErrnoException
    if (spawnError.code === 'ETIMEDOUT') {
      return {
        kind: 'timed-out',
        signal: result.signal ?? 'SIGTERM',
        stdout,
        stderr,
      }
    }
    if (spawnError.code === 'ENOBUFS') {
      return {
        kind: 'buffer-error',
        message: spawnError.message,
        stdout,
        stderr,
      }
    }
    return {
      kind: 'spawn-error',
      error: spawnError,
    }
  }
  if (result.signal) {
    return {
      kind: 'signaled',
      signal: result.signal,
      stdout,
      stderr,
    }
  }
  if (result.status === null) {
    return {
      kind: 'null-status',
      stdout,
      stderr,
    }
  }
  return {
    kind: 'completed',
    status: result.status,
    stdout,
    stderr,
  }
}

class NodeExclusiveWriteHandle implements ExclusiveWriteHandle {
  private readonly fileHandle: fs.FileHandle

  public constructor(fileHandle: fs.FileHandle) {
    this.fileHandle = fileHandle
  }

  public async write(bytes: Uint8Array): Promise<void> {
    await this.fileHandle.write(bytes)
  }

  public async sync(): Promise<void> {
    await this.fileHandle.sync()
  }

  public async close(): Promise<void> {
    await this.fileHandle.close()
  }

  public async chmod(mode: number): Promise<void> {
    await this.fileHandle.chmod(mode)
  }
}

export function createNodeArtifactFileSystem(): ArtifactFileSystem {
  return {
    async lstat(targetPath) {
      try {
        const stats: Stats = await fs.lstat(targetPath)
        return {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          isSymbolicLink: stats.isSymbolicLink(),
          mode: preserveModeBits(stats.mode),
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return null
        }
        throw error
      }
    },
    async readFile(targetPath) {
      const buffer = await fs.readFile(targetPath)
      return new Uint8Array(buffer)
    },
    async openExclusiveWrite(targetPath) {
      const fileHandle = await fs.open(
        targetPath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      )
      return new NodeExclusiveWriteHandle(fileHandle)
    },
    async rename(fromPath, toPath) {
      await fs.rename(fromPath, toPath)
    },
    async remove(targetPath) {
      await fs.rm(targetPath, { force: true })
    },
    async verifyBytes(targetPath, expected) {
      const actual = await fs.readFile(targetPath)
      return sha256Hex(new Uint8Array(actual)) === sha256Hex(expected)
    },
    async verifyAbsent(targetPath) {
      try {
        await fs.lstat(targetPath)
        return false
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          return true
        }
        throw error
      }
    },
  }
}

async function snapshotDestination(
  fileSystem: ArtifactFileSystem,
  destinationPath: string,
): Promise<Result<DestinationSnapshot>> {
  const stats = await fileSystem.lstat(destinationPath)
  if (stats === null) {
    return ok({ state: 'absent' })
  }
  if (stats.isSymbolicLink || stats.isDirectory || !stats.isFile) {
    return err(`destination is not a regular file: ${destinationPath}`)
  }
  const bytes = await fileSystem.readFile(destinationPath)
  return ok({
    state: 'present',
    bytes,
    mode: stats.mode,
  })
}

async function bytesEqual(
  fileSystem: ArtifactFileSystem,
  destinationPath: string,
  expected: Uint8Array,
): Promise<boolean> {
  const stats = await fileSystem.lstat(destinationPath)
  if (stats === null) {
    return false
  }
  return fileSystem.verifyBytes(destinationPath, expected)
}

async function writeStagedArtifact(
  fileSystem: ArtifactFileSystem,
  stagePath: string,
  bytes: Uint8Array,
  mode: number,
): Promise<OperationOutcome> {
  let handle: ExclusiveWriteHandle | null = null
  let operationError: string | undefined
  let closeError: string | undefined
  try {
    handle = await fileSystem.openExclusiveWrite(stagePath)
    await handle.write(bytes)
    await handle.chmod(mode)
    await handle.sync()
  } catch (error) {
    operationError = error instanceof Error ? error.message : String(error)
  }
  if (handle !== null) {
    try {
      await handle.close()
    } catch (error) {
      closeError = error instanceof Error ? error.message : String(error)
    }
  }
  if (operationError !== undefined) {
    if (closeError !== undefined) {
      return operationFailure(`${operationError}; close: ${closeError}`)
    }
    return operationFailure(operationError)
  }
  if (closeError !== undefined) {
    return operationFailure(`close: ${closeError}`)
  }
  return operationSuccess()
}

async function commitStagedArtifact(
  fileSystem: ArtifactFileSystem,
  stagePath: string,
  destinationPath: string,
  failRename: boolean,
): Promise<OperationOutcome> {
  if (failRename) {
    return operationFailure(`injected rename failure for ${destinationPath}`)
  }
  try {
    await fileSystem.rename(stagePath, destinationPath)
    return operationSuccess()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return operationFailure(message)
  }
}

async function restoreAbsentDestination(
  fileSystem: ArtifactFileSystem,
  destinationPath: string,
  failRemove: boolean,
): Promise<OperationOutcome> {
  if (failRemove) {
    return operationFailure(`injected remove failure for ${destinationPath}`)
  }
  try {
    await fileSystem.remove(destinationPath)
    const absent = await fileSystem.verifyAbsent(destinationPath)
    if (!absent) {
      return operationFailure(
        `destination still exists after rollback remove: ${destinationPath}`,
      )
    }
    return operationSuccess()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return operationFailure(message)
  }
}

async function restorePresentDestination(
  fileSystem: ArtifactFileSystem,
  destinationPath: string,
  snapshot: Extract<DestinationSnapshot, { state: 'present' }>,
  rollbackStagePath: string,
  failRename: boolean,
): Promise<OperationOutcome> {
  const writeOutcome = await writeStagedArtifact(
    fileSystem,
    rollbackStagePath,
    snapshot.bytes,
    snapshot.mode,
  )
  if (!writeOutcome.success) {
    return writeOutcome
  }
  if (failRename) {
    return operationFailure(
      `injected rollback rename failure for ${destinationPath}`,
    )
  }
  try {
    await fileSystem.rename(rollbackStagePath, destinationPath)
    const verified = await fileSystem.verifyBytes(
      destinationPath,
      snapshot.bytes,
    )
    if (!verified) {
      return operationFailure(`rollback bytes mismatch for ${destinationPath}`)
    }
    const stats = await fileSystem.lstat(destinationPath)
    if (stats === null || stats.mode !== snapshot.mode) {
      return operationFailure(`rollback mode mismatch for ${destinationPath}`)
    }
    return operationSuccess()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return operationFailure(message)
  }
}

async function verifyDestinationMatchesSnapshot(
  fileSystem: ArtifactFileSystem,
  destinationPath: string,
  snapshot: DestinationSnapshot,
): Promise<OperationOutcome> {
  try {
    if (snapshot.state === 'absent') {
      const absent = await fileSystem.verifyAbsent(destinationPath)
      if (!absent) {
        return operationFailure(
          `expected absent destination is present: ${destinationPath}`,
        )
      }
      return operationSuccess()
    }
    const stats = await fileSystem.lstat(destinationPath)
    if (stats === null) {
      return operationFailure(
        `expected present destination is absent: ${destinationPath}`,
      )
    }
    const verified = await fileSystem.verifyBytes(
      destinationPath,
      snapshot.bytes,
    )
    if (!verified) {
      return operationFailure(`destination bytes mismatch: ${destinationPath}`)
    }
    if (stats.mode !== snapshot.mode) {
      return operationFailure(`destination mode mismatch: ${destinationPath}`)
    }
    return operationSuccess()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return operationFailure(`${destinationPath}: ${message}`)
  }
}

type CleanupPathKind = 'candidate' | 'rollback'

interface RegisteredCleanupPath {
  readonly path: string
  readonly kind: CleanupPathKind
}

async function cleanupRegisteredPaths(
  fileSystem: ArtifactFileSystem,
  registeredPaths: readonly RegisteredCleanupPath[],
): Promise<OperationOutcome> {
  const errors: string[] = []
  for (const entry of registeredPaths) {
    const basenameOnly = path.basename(entry.path)
    const label = `${entry.kind} ${basenameOnly}`
    try {
      await fileSystem.remove(entry.path)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      let absent = false
      try {
        absent = await fileSystem.verifyAbsent(entry.path)
      } catch (verifyError) {
        const verifyMessage =
          verifyError instanceof Error
            ? verifyError.message
            : String(verifyError)
        errors.push(
          `${label}: remove failed (${message}); absence verify failed (${verifyMessage})`,
        )
        continue
      }
      if (absent) {
        errors.push(`${label}: remove failed (${message}); absence verified`)
        continue
      }
      errors.push(`${label}: remove failed (${message}); residual remains`)
      continue
    }
    let absent: boolean
    try {
      absent = await fileSystem.verifyAbsent(entry.path)
    } catch (verifyError) {
      const verifyMessage =
        verifyError instanceof Error ? verifyError.message : String(verifyError)
      errors.push(`${label}: absence verify failed (${verifyMessage})`)
      continue
    }
    if (!absent) {
      errors.push(`${label}: residual remains after removal`)
    }
  }
  if (errors.length > 0) {
    return operationFailure(errors.join('; '))
  }
  return operationSuccess()
}

function deriveEffectiveMode(snapshot: DestinationSnapshot): number {
  if (snapshot.state === 'present') {
    return snapshot.mode
  }
  return NEW_FILE_MODE
}

function createFaultInjectingArtifactFileSystem(
  inner: ArtifactFileSystem,
  faults: ValidatorArtifactPairFaultInjection | undefined,
  structuralDestination: string,
  semanticDestination: string,
): ArtifactFileSystem {
  if (!faults) {
    return inner
  }
  return {
    ...inner,
    async openExclusiveWrite(targetPath) {
      if (
        faults.failStructuralStaging === true &&
        targetPath.includes('.stage-') &&
        targetPath.startsWith(structuralDestination)
      ) {
        throw new Error('injected structural staging failure')
      }
      if (
        faults.failSemanticStaging === true &&
        targetPath.includes('.stage-') &&
        targetPath.startsWith(semanticDestination)
      ) {
        throw new Error('injected semantic staging failure')
      }
      if (
        faults.failRollbackStageWrite === true &&
        targetPath.includes('.rollback-')
      ) {
        throw new Error('injected rollback stage write failure')
      }
      return inner.openExclusiveWrite(targetPath)
    },
    async rename(fromPath, toPath) {
      if (fromPath.includes('.stage-') && toPath === structuralDestination) {
        if (faults.failFirstCommitRename === true) {
          throw new Error(
            `injected rename failure for ${path.basename(toPath)}`,
          )
        }
      }
      if (fromPath.includes('.stage-') && toPath === semanticDestination) {
        if (faults.failSecondCommitRename === true) {
          throw new Error(
            `injected rename failure for ${path.basename(toPath)}`,
          )
        }
      }
      if (
        fromPath.includes('.rollback-') &&
        faults.failPresentRollbackRename === true
      ) {
        throw new Error(
          `injected rollback rename failure for ${path.basename(toPath)}`,
        )
      }
      return inner.rename(fromPath, toPath)
    },
    async remove(targetPath) {
      if (
        faults.failAbsentRollbackRemove === true &&
        (targetPath === structuralDestination ||
          targetPath === semanticDestination)
      ) {
        throw new Error(
          `injected remove failure for ${path.basename(targetPath)}`,
        )
      }
      if (
        faults.failCleanupRemovalFor !== undefined &&
        targetPath === faults.failCleanupRemovalFor
      ) {
        throw new Error(
          `injected cleanup removal failure for ${path.basename(targetPath)}`,
        )
      }
      return inner.remove(targetPath)
    },
  }
}

async function verifyPairMatchesSnapshots(
  fileSystem: ArtifactFileSystem,
  structuralPath: string,
  semanticPath: string,
  structuralSnapshot: DestinationSnapshot,
  semanticSnapshot: DestinationSnapshot,
): Promise<OperationOutcome> {
  const structuralVerification = await verifyDestinationMatchesSnapshot(
    fileSystem,
    structuralPath,
    structuralSnapshot,
  )
  const semanticVerification = await verifyDestinationMatchesSnapshot(
    fileSystem,
    semanticPath,
    semanticSnapshot,
  )
  if (structuralVerification.success && semanticVerification.success) {
    return operationSuccess()
  }
  return operationFailure(
    [
      structuralVerification.success ? undefined : structuralVerification.error,
      semanticVerification.success ? undefined : semanticVerification.error,
    ]
      .filter((entry): entry is string => entry !== undefined)
      .join('; '),
  )
}

interface StagedCandidate {
  readonly destinationPath: string
  readonly stagePath: string
  readonly candidateBytes: Uint8Array
  readonly effectiveMode: number
  readonly snapshot: DestinationSnapshot
}

interface PairWorkflowResult {
  readonly primaryFailure?: { readonly step: string; readonly error: string }
  readonly rollbackOutcome: OperationOutcome
  readonly verificationOutcome: OperationOutcome
  readonly committed?: {
    readonly structuralChanged: boolean
    readonly semanticChanged: boolean
  }
}

type RollbackPhaseState =
  | { readonly phase: 'not-started' }
  | { readonly phase: 'started' }
  | { readonly phase: 'completed'; readonly outcome: OperationOutcome }

type VerificationPhaseState =
  | { readonly phase: 'not-started' }
  | { readonly phase: 'started' }
  | { readonly phase: 'completed'; readonly outcome: OperationOutcome }

interface PairWorkflowAccumulator {
  primaryFailure?: { readonly step: string; readonly error: string }
  rollback: RollbackPhaseState
  verification: VerificationPhaseState
  committed?: {
    readonly structuralChanged: boolean
    readonly semanticChanged: boolean
  }
}

const VERIFICATION_SKIPPED_STAGING_FAILURE = operationFailure(
  'skipped because staging failed',
)
const VERIFICATION_SKIPPED_ROLLBACK_INTERRUPTED = operationFailure(
  'skipped because rollback was interrupted',
)

function createPairWorkflowAccumulator(): PairWorkflowAccumulator {
  return {
    rollback: { phase: 'not-started' },
    verification: { phase: 'not-started' },
  }
}

function recordPrimaryFailure(
  accumulator: PairWorkflowAccumulator,
  failure: { readonly step: string; readonly error: string },
): void {
  if (accumulator.primaryFailure === undefined) {
    accumulator.primaryFailure = failure
  }
}

function startRollbackPhase(accumulator: PairWorkflowAccumulator): void {
  if (accumulator.rollback.phase === 'not-started') {
    accumulator.rollback = { phase: 'started' }
  }
}

function completeRollbackPhase(
  accumulator: PairWorkflowAccumulator,
  outcome: OperationOutcome,
): void {
  if (accumulator.rollback.phase === 'completed') {
    return
  }
  if (
    accumulator.rollback.phase === 'started' ||
    accumulator.rollback.phase === 'not-started'
  ) {
    accumulator.rollback = { phase: 'completed', outcome }
  }
}

function startVerificationPhase(accumulator: PairWorkflowAccumulator): void {
  if (accumulator.verification.phase === 'not-started') {
    accumulator.verification = { phase: 'started' }
  }
}

function completeVerificationPhase(
  accumulator: PairWorkflowAccumulator,
  outcome: OperationOutcome,
): void {
  if (accumulator.verification.phase === 'completed') {
    return
  }
  if (
    accumulator.verification.phase === 'started' ||
    accumulator.verification.phase === 'not-started'
  ) {
    accumulator.verification = { phase: 'completed', outcome }
  }
}

function recordCommittedFacts(
  accumulator: PairWorkflowAccumulator,
  facts: {
    readonly structuralChanged: boolean
    readonly semanticChanged: boolean
  },
): void {
  if (accumulator.committed === undefined) {
    accumulator.committed = facts
  }
}

function handlePairWorkflowException(
  accumulator: PairWorkflowAccumulator,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error)
  if (accumulator.rollback.phase === 'started') {
    completeRollbackPhase(accumulator, operationFailure(message))
    if (accumulator.verification.phase === 'not-started') {
      completeVerificationPhase(
        accumulator,
        VERIFICATION_SKIPPED_ROLLBACK_INTERRUPTED,
      )
    }
    return
  }
  if (accumulator.verification.phase === 'started') {
    completeVerificationPhase(accumulator, operationFailure(message))
    return
  }
  if (accumulator.primaryFailure === undefined) {
    recordPrimaryFailure(accumulator, { step: 'unexpected', error: message })
  }
}

function materializePairWorkflowResult(
  accumulator: PairWorkflowAccumulator,
): PairWorkflowResult {
  const rollbackOutcome =
    accumulator.rollback.phase === 'completed'
      ? accumulator.rollback.outcome
      : operationFailure('rollback phase was not completed')
  const verificationOutcome =
    accumulator.verification.phase === 'completed'
      ? accumulator.verification.outcome
      : operationFailure('verification phase was not completed')
  const workflow: PairWorkflowResult = {
    rollbackOutcome,
    verificationOutcome,
  }
  if (accumulator.primaryFailure !== undefined) {
    return { ...workflow, primaryFailure: accumulator.primaryFailure }
  }
  if (accumulator.committed !== undefined) {
    return { ...workflow, committed: accumulator.committed }
  }
  return {
    ...workflow,
    primaryFailure: {
      step: 'internal',
      error: 'pair workflow completed without a result',
    },
  }
}

export interface ExecutePairFailureRecoveryInput {
  readonly primaryFailure: { readonly step: string; readonly error: string }
  readonly rollback: () => Promise<OperationOutcome>
  readonly verify: () => Promise<OperationOutcome>
}

export async function executePairFailureRecovery(
  input: ExecutePairFailureRecoveryInput,
): Promise<PairWorkflowResult> {
  const accumulator = createPairWorkflowAccumulator()
  recordPrimaryFailure(accumulator, input.primaryFailure)
  try {
    startRollbackPhase(accumulator)
    const rollbackOutcome = await input.rollback()
    completeRollbackPhase(accumulator, rollbackOutcome)
    startVerificationPhase(accumulator)
    const verificationOutcome = await input.verify()
    completeVerificationPhase(accumulator, verificationOutcome)
  } catch (error) {
    handlePairWorkflowException(accumulator, error)
  }
  return materializePairWorkflowResult(accumulator)
}

async function finalizePairWorkflowResult(
  fileSystem: ArtifactFileSystem,
  registeredCleanup: readonly RegisteredCleanupPath[],
  workflow: PairWorkflowResult,
): Promise<PairCommitOutcome> {
  const cleanupOutcome = await cleanupRegisteredPaths(
    fileSystem,
    registeredCleanup,
  )
  if (workflow.primaryFailure) {
    return {
      outcome: 'failed',
      primaryFailure: workflow.primaryFailure,
      rollbackOutcome: workflow.rollbackOutcome,
      verificationOutcome: workflow.verificationOutcome,
      cleanupOutcome,
    }
  }
  if (workflow.committed) {
    if (!workflow.verificationOutcome.success) {
      return {
        outcome: 'failed',
        primaryFailure: {
          step: 'verify-commit',
          error: workflow.verificationOutcome.error,
        },
        rollbackOutcome: workflow.rollbackOutcome,
        verificationOutcome: workflow.verificationOutcome,
        cleanupOutcome,
      }
    }
    if (!cleanupOutcome.success) {
      return {
        outcome: 'failed',
        primaryFailure: {
          step: 'cleanup',
          error: cleanupOutcome.error,
        },
        rollbackOutcome: workflow.rollbackOutcome,
        verificationOutcome: workflow.verificationOutcome,
        cleanupOutcome,
      }
    }
    return {
      outcome: 'committed',
      structuralChanged: workflow.committed.structuralChanged,
      semanticChanged: workflow.committed.semanticChanged,
      rollbackOutcome: workflow.rollbackOutcome,
      verificationOutcome: workflow.verificationOutcome,
      cleanupOutcome,
    }
  }
  return {
    outcome: 'failed',
    primaryFailure: {
      step: 'internal',
      error: 'pair workflow completed without a result',
    },
    rollbackOutcome: workflow.rollbackOutcome,
    verificationOutcome: workflow.verificationOutcome,
    cleanupOutcome,
  }
}

function registerCleanupPath(
  registry: RegisteredCleanupPath[],
  targetPath: string,
  kind: CleanupPathKind,
): void {
  if (!registry.some((entry) => entry.path === targetPath)) {
    registry.push({ path: targetPath, kind })
  }
}

export async function commitValidatorArtifactPair(
  input: CommitValidatorArtifactPairInput,
): Promise<PairCommitOutcome> {
  const baseFileSystem = input.fileSystem ?? createNodeArtifactFileSystem()
  const fileSystem = createFaultInjectingArtifactFileSystem(
    baseFileSystem,
    input.faultInjection,
    input.structural.destinationPath,
    input.semantic.destinationPath,
  )
  const registeredCleanup: RegisteredCleanupPath[] = []
  const structuralSnapshotResult = await snapshotDestination(
    fileSystem,
    input.structural.destinationPath,
  )
  if (!structuralSnapshotResult.success) {
    return {
      outcome: 'failed',
      primaryFailure: {
        step: 'snapshot-structural',
        error: structuralSnapshotResult.error,
      },
      rollbackOutcome: operationSuccess(),
      verificationOutcome: operationFailure('skipped because snapshot failed'),
      cleanupOutcome: operationSuccess(),
    }
  }
  const semanticSnapshotResult = await snapshotDestination(
    fileSystem,
    input.semantic.destinationPath,
  )
  if (!semanticSnapshotResult.success) {
    return {
      outcome: 'failed',
      primaryFailure: {
        step: 'snapshot-semantic',
        error: semanticSnapshotResult.error,
      },
      rollbackOutcome: operationSuccess(),
      verificationOutcome: operationFailure('skipped because snapshot failed'),
      cleanupOutcome: operationSuccess(),
    }
  }
  const structuralSnapshot = structuralSnapshotResult.data
  const semanticSnapshot = semanticSnapshotResult.data
  const structuralMatches = await bytesEqual(
    fileSystem,
    input.structural.destinationPath,
    input.structural.candidateBytes,
  )
  const semanticMatches = await bytesEqual(
    fileSystem,
    input.semantic.destinationPath,
    input.semantic.candidateBytes,
  )
  if (structuralMatches && semanticMatches) {
    return {
      outcome: 'committed',
      structuralChanged: false,
      semanticChanged: false,
      rollbackOutcome: operationSuccess(),
      verificationOutcome: operationSuccess(),
      cleanupOutcome: operationSuccess(),
    }
  }

  const accumulator = createPairWorkflowAccumulator()

  try {
    const stagedCandidates: StagedCandidate[] = []
    if (!structuralMatches) {
      const stagePath = `${input.structural.destinationPath}.stage-${createStageSuffix()}`
      registerCleanupPath(registeredCleanup, stagePath, 'candidate')
      stagedCandidates.push({
        destinationPath: input.structural.destinationPath,
        stagePath,
        candidateBytes: input.structural.candidateBytes,
        effectiveMode: deriveEffectiveMode(structuralSnapshot),
        snapshot: structuralSnapshot,
      })
    }
    if (!semanticMatches) {
      const stagePath = `${input.semantic.destinationPath}.stage-${createStageSuffix()}`
      registerCleanupPath(registeredCleanup, stagePath, 'candidate')
      stagedCandidates.push({
        destinationPath: input.semantic.destinationPath,
        stagePath,
        candidateBytes: input.semantic.candidateBytes,
        effectiveMode: deriveEffectiveMode(semanticSnapshot),
        snapshot: semanticSnapshot,
      })
    }
    for (const candidate of stagedCandidates) {
      const writeOutcome = await writeStagedArtifact(
        fileSystem,
        candidate.stagePath,
        candidate.candidateBytes,
        candidate.effectiveMode,
      )
      if (!writeOutcome.success) {
        recordPrimaryFailure(accumulator, {
          step:
            candidate.destinationPath === input.structural.destinationPath
              ? 'stage-structural'
              : 'stage-semantic',
          error: writeOutcome.error,
        })
        completeRollbackPhase(accumulator, operationSuccess())
        completeVerificationPhase(
          accumulator,
          VERIFICATION_SKIPPED_STAGING_FAILURE,
        )
        break
      }
    }
    const structuralCandidate = stagedCandidates.find(
      (candidate) =>
        candidate.destinationPath === input.structural.destinationPath,
    )
    const semanticCandidate = stagedCandidates.find(
      (candidate) =>
        candidate.destinationPath === input.semantic.destinationPath,
    )
    if (accumulator.primaryFailure === undefined && structuralCandidate) {
      const commitStructural = await commitStagedArtifact(
        fileSystem,
        structuralCandidate.stagePath,
        structuralCandidate.destinationPath,
        input.faultInjection?.failFirstCommitRename === true,
      )
      if (!commitStructural.success) {
        recordPrimaryFailure(accumulator, {
          step: 'commit-structural',
          error: commitStructural.error,
        })
        completeRollbackPhase(accumulator, operationSuccess())
        startVerificationPhase(accumulator)
        const verificationOutcome = await verifyPairMatchesSnapshots(
          fileSystem,
          input.structural.destinationPath,
          input.semantic.destinationPath,
          structuralSnapshot,
          semanticSnapshot,
        )
        completeVerificationPhase(accumulator, verificationOutcome)
      }
    }
    if (accumulator.primaryFailure === undefined && semanticCandidate) {
      const commitSemantic = await commitStagedArtifact(
        fileSystem,
        semanticCandidate.stagePath,
        semanticCandidate.destinationPath,
        input.faultInjection?.failSecondCommitRename === true,
      )
      if (!commitSemantic.success) {
        const recoveryWorkflow = await executePairFailureRecovery({
          primaryFailure: {
            step: 'commit-semantic',
            error: commitSemantic.error,
          },
          rollback: async () => {
            if (!structuralCandidate) {
              return operationSuccess()
            }
            if (structuralSnapshot.state === 'absent') {
              return restoreAbsentDestination(
                fileSystem,
                input.structural.destinationPath,
                input.faultInjection?.failAbsentRollbackRemove === true,
              )
            }
            const rollbackStagePath = `${input.structural.destinationPath}.rollback-${createStageSuffix()}`
            registerCleanupPath(
              registeredCleanup,
              rollbackStagePath,
              'rollback',
            )
            return restorePresentDestination(
              fileSystem,
              input.structural.destinationPath,
              structuralSnapshot,
              rollbackStagePath,
              input.faultInjection?.failPresentRollbackRename === true,
            )
          },
          verify: async () =>
            verifyPairMatchesSnapshots(
              fileSystem,
              input.structural.destinationPath,
              input.semantic.destinationPath,
              structuralSnapshot,
              semanticSnapshot,
            ),
        })
        recordPrimaryFailure(
          accumulator,
          recoveryWorkflow.primaryFailure ?? {
            step: 'commit-semantic',
            error: commitSemantic.error,
          },
        )
        completeRollbackPhase(accumulator, recoveryWorkflow.rollbackOutcome)
        completeVerificationPhase(
          accumulator,
          recoveryWorkflow.verificationOutcome,
        )
      }
    }
    if (accumulator.primaryFailure === undefined) {
      recordCommittedFacts(accumulator, {
        structuralChanged: !structuralMatches,
        semanticChanged: !semanticMatches,
      })
      completeRollbackPhase(accumulator, operationSuccess())
      startVerificationPhase(accumulator)
      const verificationOutcome = await verifyCommittedDestinations(
        fileSystem,
        input.structural.destinationPath,
        input.semantic.destinationPath,
        structuralMatches,
        semanticMatches,
        structuralSnapshot,
        semanticSnapshot,
        input.structural.candidateBytes,
        input.semantic.candidateBytes,
      )
      completeVerificationPhase(accumulator, verificationOutcome)
    }
  } catch (error) {
    handlePairWorkflowException(accumulator, error)
  }

  const workflow = materializePairWorkflowResult(accumulator)
  return finalizePairWorkflowResult(fileSystem, registeredCleanup, workflow)
}

async function verifyCommittedDestinations(
  fileSystem: ArtifactFileSystem,
  structuralPath: string,
  semanticPath: string,
  structuralMatches: boolean,
  semanticMatches: boolean,
  structuralSnapshot: DestinationSnapshot,
  semanticSnapshot: DestinationSnapshot,
  structuralCandidateBytes: Uint8Array,
  semanticCandidateBytes: Uint8Array,
): Promise<OperationOutcome> {
  const errors: string[] = []
  if (!structuralMatches) {
    try {
      const structuralVerify = await fileSystem.verifyBytes(
        structuralPath,
        structuralCandidateBytes,
      )
      const structuralMode = await fileSystem.lstat(structuralPath)
      const expectedMode = deriveEffectiveMode(structuralSnapshot)
      if (!structuralVerify) {
        errors.push('structural bytes mismatch after commit')
      }
      if (structuralMode === null || structuralMode.mode !== expectedMode) {
        errors.push('structural mode mismatch after commit')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${structuralPath}: ${message}`)
    }
  }
  if (!semanticMatches) {
    try {
      const semanticVerify = await fileSystem.verifyBytes(
        semanticPath,
        semanticCandidateBytes,
      )
      const semanticMode = await fileSystem.lstat(semanticPath)
      const expectedMode = deriveEffectiveMode(semanticSnapshot)
      if (!semanticVerify) {
        errors.push('semantic bytes mismatch after commit')
      }
      if (semanticMode === null || semanticMode.mode !== expectedMode) {
        errors.push('semantic mode mismatch after commit')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${semanticPath}: ${message}`)
    }
  }
  if (errors.length === 0) {
    return operationSuccess()
  }
  return operationFailure(errors.join('; '))
}

export function ensureEsmNamedExports(
  text: string,
  exportNames: readonly string[],
): string {
  const ast = validateGeneratedModuleAst(text, exportNames)
  if (ast.success) {
    return text
  }
  if (
    ast.error.startsWith('unexpected exports:') ||
    ast.error.startsWith('missing exports:')
  ) {
    return text
  }
  const missing = exportNames.filter((name) => {
    const declarationPattern = new RegExp(`\\b${name}\\b`)
    return declarationPattern.test(text)
  })
  if (missing.length !== exportNames.length) {
    return text
  }
  const exportBlock = `export {\n  ${exportNames.join(',\n  ')}\n};\n`
  return text.endsWith('\n')
    ? `${text}${exportBlock}`
    : `${text}\n${exportBlock}`
}

export function stripBundlerArtifactComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('//')) {
        return true
      }
      const commentBody = trimmed.slice(2).trim()
      if (
        commentBody.includes('/tmp/') ||
        commentBody.includes('\\tmp\\') ||
        commentBody.endsWith('.mjs') ||
        commentBody.endsWith('.ts') ||
        commentBody.includes('semantic-entry') ||
        commentBody.includes('structural-entry') ||
        commentBody.includes('shared-types-adapter')
      ) {
        return false
      }
      return true
    })
    .join('\n')
}

export function normalizeGeneratedModuleText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: export discovery must cover declarations, named export blocks, and assignment forms in generated ESM.
function collectExportNames(sourceFile: ts.SourceFile): Set<string> {
  const exportNames = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      exportNames.add('default')
      continue
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const exportedName = element.name?.text ?? element.propertyName?.text
          if (exportedName) {
            exportNames.add(exportedName)
          }
        }
      }
      continue
    }
    if (!ts.canHaveModifiers(statement)) {
      continue
    }
    const modifiers = ts.getModifiers(statement)
    const isExported = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    )
    const isDefault = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    )
    if (!isExported) {
      continue
    }
    if (isDefault) {
      exportNames.add('default')
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exportNames.add(declaration.name.text)
        }
      }
      continue
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      exportNames.add(statement.name.text)
    }
  }
  return exportNames
}

function visitForForbiddenImports(node: ts.Node, violations: string[]): void {
  if (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    violations.push(`static import: ${node.moduleSpecifier.text}`)
  }
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    violations.push(`re-export: ${node.moduleSpecifier.text}`)
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    node.arguments.length === 1
  ) {
    const firstArgument = node.arguments[0]
    if (firstArgument && ts.isStringLiteral(firstArgument)) {
      violations.push(`require(): ${firstArgument.text}`)
    }
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1
  ) {
    const firstArgument = node.arguments[0]
    if (firstArgument && ts.isStringLiteral(firstArgument)) {
      violations.push(`dynamic import: ${firstArgument.text}`)
    }
  }
  ts.forEachChild(node, (child) => {
    visitForForbiddenImports(child, violations)
  })
}

export function validateGeneratedModuleAst(
  source: string,
  expectedExports: readonly string[],
): Result<string[]> {
  const sourceFile = ts.createSourceFile(
    'generated.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )
  const violations: string[] = []
  visitForForbiddenImports(sourceFile, violations)
  if (violations.length > 0) {
    return err(violations.join('; '))
  }
  const exportNames = collectExportNames(sourceFile)
  const missingExports = sortedUnique(
    expectedExports.filter((exportName) => !exportNames.has(exportName)),
  )
  const unexpectedExports = sortedUnique(
    [...exportNames].filter(
      (exportName) => !expectedExports.includes(exportName),
    ),
  )
  if (missingExports.length > 0) {
    return err(`missing exports: ${missingExports.join(', ')}`)
  }
  if (unexpectedExports.length > 0) {
    return err(`unexpected exports: ${unexpectedExports.join(', ')}`)
  }
  return ok(sortedUnique([...expectedExports]))
}

export function rejectPathLeaks(
  text: string,
  forbiddenPatterns: readonly string[],
): Result<undefined> {
  const violations: string[] = []
  if (/(?:^|[\s('"[`])\/(?:Users|home|var|tmp|private|opt)\//.test(text)) {
    violations.push('absolute unix path')
  }
  if (/(?:^|[\s('"[`])[A-Za-z]:\\/.test(text)) {
    violations.push('absolute windows path')
  }
  if (/file:\/\//.test(text)) {
    violations.push('file URL')
  }
  if (/sourceMappingURL=/.test(text)) {
    violations.push('source map reference')
  }
  if (/\/tmp\/|\.stage-|\.rollback-|vinela-plugin-schema-/.test(text)) {
    violations.push('temporary path label')
  }
  for (const pattern of forbiddenPatterns) {
    if (text.includes(pattern)) {
      violations.push(`forbidden pattern: ${pattern}`)
    }
  }
  if (violations.length > 0) {
    return err(violations.join('; '))
  }
  return ok(undefined)
}

export async function computeClosureDigest(
  repositoryRoot: string,
  relativePaths: readonly string[],
): Promise<Result<string>> {
  const hash = createHash('sha256')
  const sortedPaths = [...relativePaths]
    .map((entry) => normalizePosixPath(entry))
    .sort((left, right) => left.localeCompare(right))
  for (const relativePath of sortedPaths) {
    const absolutePath = path.join(repositoryRoot, relativePath)
    let bytes: Buffer
    try {
      bytes = await fs.readFile(absolutePath)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return err(`failed to read ${relativePath}: ${message}`)
    }
    hash.update(relativePath)
    hash.update('\0')
    hash.update(bytes)
  }
  return ok(hash.digest('hex'))
}

export function createStructuralBanner(input: StructuralBannerInput): string {
  const lines = [
    '/**',
    ' * @generated',
    ` * Contract: ${input.contractPath}`,
    ` * Contract SHA-256: ${input.contractSha256}`,
    ` * Command: ${input.buildCommand}`,
    ` * Bun: ${input.bunVersion}`,
    ` * Ajv: ${input.ajvVersion}`,
    ` * ajv-formats: ${input.ajvFormatsVersion}`,
    ` * Producer policy: ${CANONICAL_PRODUCER_POLICY}`,
    ` * Third-party notices: ${STRUCTURAL_NOTICE_POINTER}`,
    ' */',
    '',
  ]
  return lines.join('\n')
}

export function createSemanticBanner(input: SemanticBannerInput): string {
  const lines = [
    '/**',
    ' * @generated',
    ` * Authority ${SEMANTIC_AUTHORITY_PATHS.schemaValidation} SHA-256: ${input.schemaValidationSha256}`,
    ` * Authority ${SEMANTIC_AUTHORITY_PATHS.shapeInvariants} SHA-256: ${input.shapeInvariantsSha256}`,
    ` * Closure digest: ${input.closureDigest}`,
    ` * Command: ${input.buildCommand}`,
    ` * Bun: ${input.bunVersion}`,
    ` * Producer policy: ${CANONICAL_PRODUCER_POLICY}`,
    ' */',
    '',
  ]
  return lines.join('\n')
}

export async function verifyCommittedNotice(
  noticePath: string,
  nodeModulesRoot: string,
): Promise<Result<undefined>> {
  const pinned = readPinnedPackageNotices(nodeModulesRoot)
  if (!pinned.success) {
    return pinned
  }
  const expectedText = renderThirdPartyNotices(pinned.data)
  let committed: Buffer
  try {
    committed = await fs.readFile(noticePath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err(`failed to read committed notice at ${noticePath}: ${message}`)
  }
  const expectedBytes = new TextEncoder().encode(expectedText)
  if (sha256Hex(new Uint8Array(committed)) !== sha256Hex(expectedBytes)) {
    return err(
      `committed notice bytes do not match rendered third-party notices`,
    )
  }
  return ok(undefined)
}

export function validateCandidateModuleRuntimeNamespace(
  modulePath: string,
  expectedExports: readonly string[],
): Result<undefined> {
  const script = `
import { pathToFileURL } from 'node:url';
const expected = ${JSON.stringify([...expectedExports].sort())};
const moduleNamespace = await import(pathToFileURL(${JSON.stringify(modulePath)}).href);
const actual = Object.keys(moduleNamespace).sort();
const missing = expected.filter((name) => !actual.includes(name));
const extra = actual.filter((name) => !expected.includes(name));
if (missing.length > 0 || extra.length > 0) {
  const parts = [];
  if (missing.length > 0) parts.push('missing ' + missing.join(', '));
  if (extra.length > 0) parts.push('extra ' + extra.join(', '));
  console.error(parts.join('; '));
  process.exit(2);
}
`
  const result = spawnSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: '' },
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
  })
  if (result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error)
    return err(`runtime namespace import failed: ${message}`)
  }
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    return err(
      stderr.length > 0
        ? `runtime namespace mismatch: ${stderr}`
        : 'runtime namespace validation failed',
    )
  }
  return ok(undefined)
}
