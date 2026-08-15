// @vitest-environment node

import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  APPROVED_SEMANTIC_INPUTS,
  type ArtifactFileSystem,
  type BunMetafile,
  type BunMetafileImportRecord,
  CANONICAL_BUN_VERSION,
  type ClassifiedSpawnSyncResult,
  classifySpawnSyncResult,
  commitValidatorArtifactPair,
  compareSemanticInputSets,
  compareStructuralPackageSets,
  createNodeArtifactFileSystem,
  EXPECTED_STRUCTURAL_PACKAGES,
  type ExclusiveWriteHandle,
  executePairFailureRecovery,
  NEW_FILE_MODE,
  type PairCommitOutcome,
  parseBunMetafile,
  readPinnedPackageNotices,
  renderThirdPartyNotices,
  runValidatorPreflight,
  SEMANTIC_FORBIDDEN_MARKERS,
  SEMANTIC_VALIDATOR_RELATIVE_PATH,
  STRUCTURAL_NOTICE_POINTER,
  STRUCTURAL_VALIDATOR_RELATIVE_PATH,
  THIRD_PARTY_NOTICES_RELATIVE_PATH,
  type ThirdPartyPackageNotice,
  validateGeneratedModuleAst,
  validateSemanticBuildGraph,
} from './plugin-schema-validator-build-support.ts'

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject

interface JsonObject {
  [key: string]: JsonValue
}

interface StructuralError {
  readonly instancePath: string
  readonly keyword: string
  readonly message: string
  readonly params: {
    readonly additionalProperty?: string
    readonly missingProperty?: string
    readonly allowedValues?: readonly JsonValue[]
  }
}

interface SemanticError {
  readonly message: string
  readonly code?: string
  readonly source?: string
}

type SemanticValidationResult =
  | {
      readonly valid: true
      readonly errors: readonly []
      readonly warnings: readonly SemanticError[]
    }
  | {
      readonly valid: false
      readonly errors: readonly SemanticError[]
      readonly warnings: readonly SemanticError[]
    }

type StructuralValidator = ((value: JsonObject) => boolean) & {
  readonly errors: readonly StructuralError[] | null
}

interface StructuralValidatorModule {
  readonly validatePluginSchemaStructure: StructuralValidator
}

interface SemanticValidatorModule {
  readonly LuaGenerationError: new (message: string) => Error
  readonly assertSchemaShape: (value: JsonObject) => void
  readonly validateSchema: (value: JsonObject) => SemanticValidationResult
}

type ParseArgumentsResult =
  | { readonly kind: 'usage' }
  | { readonly kind: 'ok'; readonly path: string }

type ReadBoundedDocumentResult =
  | { readonly kind: 'ok'; readonly bytes: Buffer }
  | { readonly kind: 'oversize' }
  | { readonly kind: 'read-error'; readonly message: string }

type ParseDocumentResult =
  | { readonly kind: 'ok'; readonly value: JsonObject }
  | {
      readonly kind: 'document-error'
      readonly message: string
      readonly code: 1
    }

type NamespaceCheckResult =
  | { readonly kind: 'ok' }
  | { readonly kind: 'internal-error'; readonly message: string }

type LoadedGeneratedModulesResult =
  | {
      readonly kind: 'ok'
      readonly structural: StructuralValidatorModule
      readonly semantic: SemanticValidatorModule
    }
  | { readonly kind: 'internal-error'; readonly message: string }

type ValidatorCoreResult =
  | { readonly exitCode: 0; readonly stdout: string; readonly stderr: '' }
  | { readonly exitCode: 1; readonly stdout: ''; readonly stderr: string }
  | { readonly exitCode: 2; readonly stdout: ''; readonly stderr: string }

interface BoundedReadHandle {
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>
  close(): Promise<void>
}

interface ValidatorCoreDependencies {
  readonly open?: (path: string, flags: 'r') => Promise<BoundedReadHandle>
  readonly import?: (path: string) => Promise<unknown>
}

interface ValidatorCoreModule {
  readonly MAX_BYTES: number
  readonly USAGE: string
  readonly STRUCTURAL_EXPORTS: readonly ['validatePluginSchemaStructure']
  readonly SEMANTIC_EXPORTS: readonly [
    'LuaGenerationError',
    'assertSchemaShape',
    'validateSchema',
  ]
  sanitizeLine(value: string): string
  parseArguments(argv: readonly string[], cwd: string): ParseArgumentsResult
  readBoundedDocument(
    filePath: string,
    dependencies?: ValidatorCoreDependencies,
  ): Promise<ReadBoundedDocumentResult>
  parseDocument(bytes: Buffer): ParseDocumentResult
  renderStructureErrors(errors: readonly StructuralError[]): readonly string[]
  renderSemanticErrors(errors: readonly SemanticError[]): readonly string[]
  assertExactNamespace(
    moduleNamespace: unknown,
    expectedExports: readonly string[],
    label: string,
  ): NamespaceCheckResult
  loadGeneratedModules(
    scriptDir: string,
    dependencies?: ValidatorCoreDependencies,
  ): Promise<LoadedGeneratedModulesResult>
  runValidatorCore(input: {
    readonly argv: readonly string[]
    readonly cwd: string
    readonly scriptDir: string
    readonly dependencies?: ValidatorCoreDependencies
  }): Promise<ValidatorCoreResult>
}

const VALIDATOR_CORE_EXPORT_NAMES = [
  'MAX_BYTES',
  'SEMANTIC_EXPORTS',
  'STRUCTURAL_EXPORTS',
  'USAGE',
  'assertExactNamespace',
  'loadGeneratedModules',
  'parseArguments',
  'parseDocument',
  'readBoundedDocument',
  'renderSemanticErrors',
  'renderStructureErrors',
  'runValidatorCore',
  'sanitizeLine',
] as const

function hasExactStringArray(
  value: unknown,
  expected: readonly string[],
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  )
}

function isValidatorCoreModule(value: unknown): value is ValidatorCoreModule {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const actualExports = Object.keys(value).sort((left, right) =>
    left.localeCompare(right),
  )
  const expectedExports = [...VALIDATOR_CORE_EXPORT_NAMES].sort((left, right) =>
    left.localeCompare(right),
  )
  if (
    actualExports.length !== expectedExports.length ||
    !actualExports.every((entry, index) => entry === expectedExports[index])
  ) {
    return false
  }
  return (
    typeof Reflect.get(value, 'MAX_BYTES') === 'number' &&
    typeof Reflect.get(value, 'USAGE') === 'string' &&
    hasExactStringArray(Reflect.get(value, 'STRUCTURAL_EXPORTS'), [
      'validatePluginSchemaStructure',
    ]) &&
    hasExactStringArray(Reflect.get(value, 'SEMANTIC_EXPORTS'), [
      'LuaGenerationError',
      'assertSchemaShape',
      'validateSchema',
    ]) &&
    VALIDATOR_CORE_EXPORT_NAMES.filter(
      (name) =>
        name !== 'MAX_BYTES' &&
        name !== 'USAGE' &&
        name !== 'STRUCTURAL_EXPORTS' &&
        name !== 'SEMANTIC_EXPORTS',
    ).every((name) => typeof Reflect.get(value, name) === 'function')
  )
}

const importUnknownModule: (specifier: string) => Promise<unknown> = (
  specifier,
) => import(specifier)
const validatorCoreBoundary = await importUnknownModule(
  new URL(
    '../skills/vinela-plugin-schema/scripts/validate-plugin-schema.mjs',
    import.meta.url,
  ).href,
)
if (!isValidatorCoreModule(validatorCoreBoundary)) {
  throw new Error('validator CLI/core module export contract mismatch')
}
const {
  assertExactNamespace,
  MAX_BYTES: CORE_MAX_BYTES,
  parseArguments,
  parseDocument,
  readBoundedDocument,
  renderSemanticErrors,
  renderStructureErrors,
  runValidatorCore,
  SEMANTIC_EXPORTS,
  STRUCTURAL_EXPORTS,
  USAGE,
} = validatorCoreBoundary

const REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url))
const VALIDATOR_CLI = join(
  REPOSITORY_ROOT,
  'skills/vinela-plugin-schema/scripts/validate-plugin-schema.mjs',
)
const SKILL_SCRIPTS_DIR = join(
  REPOSITORY_ROOT,
  'skills/vinela-plugin-schema/scripts',
)
const STARTER_PATH = join(
  REPOSITORY_ROOT,
  'skills/vinela-plugin-schema/assets/vinela.schema.json',
)
const STRUCTURAL_VALIDATOR_PATH = join(
  REPOSITORY_ROOT,
  STRUCTURAL_VALIDATOR_RELATIVE_PATH,
)
const SEMANTIC_VALIDATOR_PATH = join(
  REPOSITORY_ROOT,
  SEMANTIC_VALIDATOR_RELATIVE_PATH,
)
const THIRD_PARTY_NOTICES_PATH = join(
  REPOSITORY_ROOT,
  THIRD_PARTY_NOTICES_RELATIVE_PATH,
)
const NODE_MODULES_ROOT = join(REPOSITORY_ROOT, 'node_modules')
const BUILDER_SCRIPT = join(
  REPOSITORY_ROOT,
  'scripts/build-plugin-schema-validator.ts',
)
const MAX_DOCUMENT_BYTES = CORE_MAX_BYTES

const CANONICAL_SCHEMA_URL =
  'https://raw.githubusercontent.com/dejwi/vinela/main/schema/plugin-schema.schema.json'

const RUNTIME_SCRIPT_NAMES = [
  'validate-plugin-schema.mjs',
  'structural-validator.generated.mjs',
  'semantic-validator.generated.mjs',
] as const

const temporaryDirectories: string[] = []

interface FileSnapshot {
  readonly bytes: Uint8Array
  readonly mode: number
  readonly mtimeMs: number
}

function minimalSchema(): JsonObject {
  return {
    $schema: CANONICAL_SCHEMA_URL,
    id: 'github:example/example.nvim',
    pluginName: 'example.nvim',
    pluginRepo: 'https://github.com/example/example.nvim',
    version: '1.0.0',
    options: [],
    functions: [],
  }
}

function runValidator(
  args: readonly string[],
  cwd: string,
  options?: { validatorPath?: string },
): ClassifiedSpawnSyncResult {
  const validatorPath = options?.validatorPath ?? VALIDATOR_CLI
  const raw = spawnSync('node', [validatorPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_PATH: '' },
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
  })
  return classifySpawnSyncResult(raw)
}

function expectCompleted(
  result: ClassifiedSpawnSyncResult,
): asserts result is Extract<ClassifiedSpawnSyncResult, { kind: 'completed' }> {
  expect(
    result.kind,
    result.kind === 'completed'
      ? ''
      : `expected completed subprocess, got ${result.kind}: stdout=${'stdout' in result ? result.stdout : ''} stderr=${'stderr' in result ? result.stderr : ''}`,
  ).toBe('completed')
}

function replaceLiteral(
  value: string,
  search: string,
  replacement: string,
): string {
  return value.split(search).join(replacement)
}

async function createTemporaryDirectory(
  prefix = 'vinela-plugin-schema-',
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeSchema(directory: string, value: object): Promise<string> {
  const schemaPath = join(directory, 'vinela.schema.json')
  await writeFile(schemaPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return schemaPath
}

async function copyInstalledFootprint(skillRoot: string): Promise<string> {
  const scriptsDirectory = join(skillRoot, 'scripts')
  await mkdir(scriptsDirectory, { recursive: true })
  await copyFile(
    THIRD_PARTY_NOTICES_PATH,
    join(skillRoot, basename(THIRD_PARTY_NOTICES_RELATIVE_PATH)),
  )
  for (const scriptName of RUNTIME_SCRIPT_NAMES) {
    await copyFile(
      join(SKILL_SCRIPTS_DIR, scriptName),
      join(scriptsDirectory, scriptName),
    )
  }
  return join(scriptsDirectory, 'validate-plugin-schema.mjs')
}

async function snapshotFile(filePath: string): Promise<FileSnapshot> {
  const [fileBytes, fileStats] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ])
  return {
    bytes: new Uint8Array(fileBytes),
    mode: fileStats.mode & 0o7777,
    mtimeMs: fileStats.mtimeMs,
  }
}

function expectSnapshotUnchanged(
  before: FileSnapshot,
  after: FileSnapshot,
): void {
  expect(after.mode).toBe(before.mode)
  expect(after.mtimeMs).toBe(before.mtimeMs)
  expect(Buffer.from(after.bytes)).toEqual(Buffer.from(before.bytes))
}

function runDriftCheckFromCwd(cwd: string): ClassifiedSpawnSyncResult {
  const raw = spawnSync('bun', [BUILDER_SCRIPT, '--check'], {
    cwd,
    encoding: 'utf8',
    timeout: 105_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  return classifySpawnSyncResult(raw)
}

function expectNoStageResidue(directory: string): Promise<void> {
  return readdir(directory).then((entries) => {
    expect(entries.some((entry) => entry.includes('.stage-'))).toBe(false)
    expect(entries.some((entry) => entry.includes('.rollback-'))).toBe(false)
  })
}

type FailableOperation =
  | 'open'
  | 'write'
  | 'chmod'
  | 'sync'
  | 'close'
  | 'rename'
  | 'remove'
  | 'verifyAbsent'
  | 'lstat'
  | 'verifyBytes'

type FaultTiming = 'before' | 'after'

interface OperationFailureSpec {
  readonly operation: FailableOperation
  readonly pathMatcher: (targetPath: string) => boolean
  readonly errorMessage: string
  readonly succeedBeforeFail?: number
  readonly timing?: FaultTiming
}

interface RecordedOperation {
  readonly operation: FailableOperation
  readonly targetPath: string
  readonly secondaryPath?: string
}

interface FaultInjectingTestFileSystem extends ArtifactFileSystem {
  readonly recordedOperations: readonly RecordedOperation[]
  countOperation(
    operation: FailableOperation,
    pathMatcher?: (targetPath: string) => boolean,
  ): number
  countStageCloses(kind: 'structural' | 'semantic' | 'rollback'): number
}

function createFaultInjectingTestFileSystem(
  failures: readonly OperationFailureSpec[],
): FaultInjectingTestFileSystem {
  const inner = createNodeArtifactFileSystem()
  const operationCounts = new Map<string, number>()
  const recordedOperations: RecordedOperation[] = []

  function record(
    operation: FailableOperation,
    targetPath: string,
    secondaryPath?: string,
  ): void {
    recordedOperations.push({
      operation,
      targetPath,
      ...(secondaryPath === undefined ? {} : { secondaryPath }),
    })
  }

  function shouldFail(
    operation: FailableOperation,
    targetPath: string,
    timing: FaultTiming,
  ): string | null {
    for (const spec of failures) {
      if (spec.operation !== operation || !spec.pathMatcher(targetPath)) {
        continue
      }
      const specTiming = spec.timing ?? 'before'
      if (specTiming !== timing) {
        continue
      }
      const key = `${spec.operation}:${spec.timing ?? 'before'}:${spec.errorMessage}:${targetPath}`
      const count = (operationCounts.get(key) ?? 0) + 1
      operationCounts.set(key, count)
      const allowed = spec.succeedBeforeFail ?? 0
      if (count > allowed) {
        return spec.errorMessage
      }
    }
    return null
  }

  function countOperation(
    operation: FailableOperation,
    pathMatcher?: (targetPath: string) => boolean,
  ): number {
    return recordedOperations.filter(
      (entry) =>
        entry.operation === operation &&
        (pathMatcher === undefined || pathMatcher(entry.targetPath)),
    ).length
  }

  function countStageCloses(
    kind: 'structural' | 'semantic' | 'rollback',
  ): number {
    return recordedOperations.filter(
      (entry) =>
        entry.operation === 'close' &&
        (kind === 'rollback'
          ? entry.targetPath.includes('.rollback-')
          : entry.targetPath.includes('.stage-') &&
            (kind === 'structural'
              ? entry.targetPath.includes('structural')
              : entry.targetPath.includes('semantic'))),
    ).length
  }

  const fileSystem: FaultInjectingTestFileSystem = {
    recordedOperations,
    countOperation,
    countStageCloses,
    async lstat(targetPath) {
      record('lstat', targetPath)
      const failure = shouldFail('lstat', targetPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      const stats = await inner.lstat(targetPath)
      const afterFailure = shouldFail('lstat', targetPath, 'after')
      if (afterFailure !== null) {
        throw new Error(afterFailure)
      }
      return stats
    },
    async readFile(targetPath) {
      return inner.readFile(targetPath)
    },
    async openExclusiveWrite(targetPath) {
      record('open', targetPath)
      const failure = shouldFail('open', targetPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      const handle = await inner.openExclusiveWrite(targetPath)
      return {
        async write(bytes) {
          record('write', targetPath)
          const writeFailure = shouldFail('write', targetPath, 'before')
          if (writeFailure !== null) {
            throw new Error(writeFailure)
          }
          await handle.write(bytes)
          const afterFailure = shouldFail('write', targetPath, 'after')
          if (afterFailure !== null) {
            throw new Error(afterFailure)
          }
        },
        async chmod(mode) {
          record('chmod', targetPath)
          const chmodFailure = shouldFail('chmod', targetPath, 'before')
          if (chmodFailure !== null) {
            throw new Error(chmodFailure)
          }
          await handle.chmod(mode)
          const afterFailure = shouldFail('chmod', targetPath, 'after')
          if (afterFailure !== null) {
            throw new Error(afterFailure)
          }
        },
        async sync() {
          record('sync', targetPath)
          const syncFailure = shouldFail('sync', targetPath, 'before')
          if (syncFailure !== null) {
            throw new Error(syncFailure)
          }
          await handle.sync()
          const afterFailure = shouldFail('sync', targetPath, 'after')
          if (afterFailure !== null) {
            throw new Error(afterFailure)
          }
        },
        async close() {
          record('close', targetPath)
          const closeFailure = shouldFail('close', targetPath, 'before')
          if (closeFailure !== null) {
            throw new Error(closeFailure)
          }
          await handle.close()
          const afterFailure = shouldFail('close', targetPath, 'after')
          if (afterFailure !== null) {
            throw new Error(afterFailure)
          }
        },
      } satisfies ExclusiveWriteHandle
    },
    async rename(fromPath, toPath) {
      record('rename', fromPath, toPath)
      const failure = shouldFail('rename', fromPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      await inner.rename(fromPath, toPath)
      const afterFailure = shouldFail('rename', fromPath, 'after')
      if (afterFailure !== null) {
        throw new Error(afterFailure)
      }
    },
    async remove(targetPath) {
      record('remove', targetPath)
      const failure = shouldFail('remove', targetPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      await inner.remove(targetPath)
      const afterFailure = shouldFail('remove', targetPath, 'after')
      if (afterFailure !== null) {
        throw new Error(afterFailure)
      }
    },
    async verifyBytes(targetPath, expected) {
      record('verifyBytes', targetPath)
      const failure = shouldFail('verifyBytes', targetPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      const result = await inner.verifyBytes(targetPath, expected)
      const afterFailure = shouldFail('verifyBytes', targetPath, 'after')
      if (afterFailure !== null) {
        throw new Error(afterFailure)
      }
      return result
    },
    async verifyAbsent(targetPath) {
      record('verifyAbsent', targetPath)
      const failure = shouldFail('verifyAbsent', targetPath, 'before')
      if (failure !== null) {
        throw new Error(failure)
      }
      const result = await inner.verifyAbsent(targetPath)
      const afterFailure = shouldFail('verifyAbsent', targetPath, 'after')
      if (afterFailure !== null) {
        throw new Error(afterFailure)
      }
      return result
    },
  }
  return fileSystem
}

interface SemanticGraphFixture {
  readonly repositoryRoot: string
  readonly buildRoot: string
  readonly semanticEntryPath: string
  readonly sharedTypesAdapterPath: string
  readonly outputKey: string
  readonly approvedAbsolute: string
  readonly approvedInputKey: string
  addRepositoryInput(
    relativePath: string,
    bytes?: string,
  ): Promise<{ absolutePath: string; relativePath: string }>
  addOutsideTempInput(
    basename: string,
    bytes?: string,
  ): Promise<{ absolutePath: string; key: string }>
  addSymlinkAlias(
    aliasRelativePath: string,
    targetAbsolutePath: string,
  ): Promise<string>
  buildMetafile(mutate?: (metafile: BunMetafile) => BunMetafile): BunMetafile
}

async function createSemanticGraphFixture(): Promise<SemanticGraphFixture> {
  const workspace = await createTemporaryDirectory('vinela-semantic-graph-')
  const repositoryRoot = join(workspace, 'repo')
  const outsideRoot = join(workspace, 'outside')
  const buildRoot = repositoryRoot
  await mkdir(repositoryRoot, { recursive: true })
  await mkdir(outsideRoot, { recursive: true })
  await mkdir(join(repositoryRoot, 'src/shared/lib'), { recursive: true })
  await mkdir(join(repositoryRoot, 'src/features/lua-generator/utils'), {
    recursive: true,
  })
  await mkdir(join(repositoryRoot, 'src/shared/types'), { recursive: true })
  for (const relativePath of APPROVED_SEMANTIC_INPUTS) {
    const absolutePath = join(repositoryRoot, relativePath)
    await mkdir(join(absolutePath, '..'), { recursive: true })
    await writeFile(
      absolutePath,
      `// approved materialized bytes for ${relativePath}\n`,
      'utf8',
    )
  }
  const semanticEntryPath = join(outsideRoot, 'semantic-entry.ts')
  const sharedTypesAdapterPath = join(outsideRoot, 'shared-types-adapter.ts')
  await writeFile(semanticEntryPath, 'export {};\n', 'utf8')
  await writeFile(sharedTypesAdapterPath, 'export {};\n', 'utf8')
  const approvedInputKey = APPROVED_SEMANTIC_INPUTS[0] as string
  const approvedAbsolute = join(repositoryRoot, approvedInputKey)
  const outputKey = join(buildRoot, 'semantic-out/out.js')

  async function addRepositoryInput(
    relativePath: string,
    bytes = `// extra repo input ${relativePath}\n`,
  ): Promise<{ absolutePath: string; relativePath: string }> {
    const absolutePath = join(repositoryRoot, relativePath)
    await mkdir(join(absolutePath, '..'), { recursive: true })
    await writeFile(absolutePath, bytes, 'utf8')
    return { absolutePath, relativePath }
  }

  async function addOutsideTempInput(
    basename: string,
    bytes = `// outside temp ${basename}\n`,
  ): Promise<{ absolutePath: string; key: string }> {
    const absolutePath = join(outsideRoot, basename)
    await mkdir(join(absolutePath, '..'), { recursive: true })
    await writeFile(absolutePath, bytes, 'utf8')
    return { absolutePath, key: absolutePath }
  }

  async function addSymlinkAlias(
    aliasRelativePath: string,
    targetAbsolutePath: string,
  ): Promise<string> {
    const aliasPath = join(repositoryRoot, aliasRelativePath)
    await mkdir(join(aliasPath, '..'), { recursive: true })
    await symlink(targetAbsolutePath, aliasPath)
    return aliasPath
  }

  const buildMetafile = (
    mutate?: (metafile: BunMetafile) => BunMetafile,
  ): BunMetafile => {
    const inputs: Record<
      string,
      { bytes: number; imports?: BunMetafileImportRecord[] }
    > = {
      [semanticEntryPath]: { bytes: 1, imports: [] },
      [sharedTypesAdapterPath]: { bytes: 1, imports: [] },
    }
    for (const relativePath of APPROVED_SEMANTIC_INPUTS) {
      inputs[join(repositoryRoot, relativePath)] = { bytes: 1, imports: [] }
    }
    const outputInputs: Record<string, { bytesInOutput: number }> = {}
    for (const key of Object.keys(inputs)) {
      if (key !== semanticEntryPath && key !== sharedTypesAdapterPath) {
        outputInputs[key] = { bytesInOutput: 1 }
      }
    }
    const base: BunMetafile = {
      inputs,
      outputs: {
        [outputKey]: {
          bytes: 1,
          inputs: outputInputs,
        },
      },
    }
    return mutate ? mutate(base) : base
  }

  return {
    repositoryRoot,
    buildRoot,
    semanticEntryPath,
    sharedTypesAdapterPath,
    outputKey,
    approvedAbsolute,
    approvedInputKey,
    addRepositoryInput,
    addOutsideTempInput,
    addSymlinkAlias,
    buildMetafile,
  }
}

async function runSemanticGraphValidation(
  fixture: SemanticGraphFixture,
  metafile: BunMetafile,
): Promise<Awaited<ReturnType<typeof validateSemanticBuildGraph>>> {
  return validateSemanticBuildGraph({
    metafile,
    buildRoot: fixture.buildRoot,
    repositoryRoot: fixture.repositoryRoot,
    semanticEntryPath: fixture.semanticEntryPath,
    sharedTypesAdapterPath: fixture.sharedTypesAdapterPath,
    approvedRepositoryInputs: APPROVED_SEMANTIC_INPUTS,
  })
}

function semanticOutputRecord(
  metafile: BunMetafile,
  outputKey: string,
): BunMetafile['outputs'][string] {
  const record = metafile.outputs[outputKey]
  if (!record) {
    throw new Error(`missing output record for ${outputKey}`)
  }
  return record
}

const FIXTURE_AJV_LICENSE = 'MIT License fixture text for ajv\n'
const FIXTURE_AJV_FORMATS_LICENSE = 'MIT License fixture text for ajv-formats\n'

const FIXTURE_PACKAGE_NOTICES: readonly ThirdPartyPackageNotice[] = [
  {
    name: 'ajv',
    version: AJV_VERSION,
    sourceUrl: 'https://github.com/ajv-validator/ajv',
    licenseText: FIXTURE_AJV_LICENSE,
  },
  {
    name: 'ajv-formats',
    version: AJV_FORMATS_VERSION,
    sourceUrl: 'https://github.com/ajv-validator/ajv-formats',
    licenseText: FIXTURE_AJV_FORMATS_LICENSE,
  },
] as const

async function createPreflightFixture(): Promise<{
  repositoryRoot: string
  nodeModulesRoot: string
  noticePath: string
}> {
  const root = await createTemporaryDirectory('vinela-preflight-')
  const repositoryRoot = root
  const nodeModulesRoot = join(root, 'node_modules')
  const noticePath = join(root, 'THIRD_PARTY_NOTICES.md')
  const noticeText = renderThirdPartyNotices(FIXTURE_PACKAGE_NOTICES)
  await writeFile(
    join(repositoryRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'preflight-fixture',
        packageManager: `bun@${CANONICAL_BUN_VERSION}`,
        devDependencies: {
          ajv: AJV_VERSION,
          'ajv-formats': AJV_FORMATS_VERSION,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  await writeFile(
    join(repositoryRoot, 'bun.lock'),
    `${JSON.stringify(
      {
        lockfileVersion: 1,
        workspaces: {
          '': {
            devDependencies: {
              ajv: AJV_VERSION,
              'ajv-formats': AJV_FORMATS_VERSION,
            },
          },
        },
        packages: {
          ajv: [`ajv@${AJV_VERSION}`, {}],
          'ajv-formats': [`ajv-formats@${AJV_FORMATS_VERSION}`, {}],
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  for (const entry of FIXTURE_PACKAGE_NOTICES) {
    const packageDirectory = join(nodeModulesRoot, entry.name)
    await mkdir(packageDirectory, { recursive: true })
    await writeFile(
      join(packageDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: entry.name,
          version: entry.version,
          license: 'MIT',
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
    await writeFile(
      join(packageDirectory, 'LICENSE'),
      entry.licenseText,
      'utf8',
    )
  }
  await writeFile(noticePath, noticeText, 'utf8')
  return { repositoryRoot, nodeModulesRoot, noticePath }
}

function buildDocumentOfByteLength(targetBytes: number): Buffer {
  const base = minimalSchema()
  let low = 0
  let high = targetBytes
  let bestLength = 0
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const byteLength = Buffer.byteLength(
      JSON.stringify({ ...base, description: 'x'.repeat(mid) }),
      'utf8',
    )
    if (byteLength <= targetBytes) {
      bestLength = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  let padding = 'x'.repeat(bestLength)
  while (true) {
    const text = JSON.stringify({ ...base, description: padding })
    const byteLength = Buffer.byteLength(text, 'utf8')
    if (byteLength === targetBytes) {
      return Buffer.from(text, 'utf8')
    }
    if (byteLength > targetBytes) {
      padding = padding.slice(0, padding.length - (byteLength - targetBytes))
      continue
    }
    padding += 'x'.repeat(targetBytes - byteLength)
  }
}

function packageIdentity(name: string, version: string): string {
  return `${name}@${version}`
}

const SORTED_APPROVED_SEMANTIC_CLOSURE = [...APPROVED_SEMANTIC_INPUTS].sort(
  (left, right) => left.localeCompare(right),
)

type PreflightFixture = Awaited<ReturnType<typeof createPreflightFixture>>

function expectSemanticGraphSuccess(
  result: Awaited<ReturnType<typeof validateSemanticBuildGraph>>,
): void {
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data).toEqual(SORTED_APPROVED_SEMANTIC_CLOSURE)
  }
}

function expectSemanticGraphFailure(
  result: Awaited<ReturnType<typeof validateSemanticBuildGraph>>,
  expectedError: string,
): void {
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error).toBe(expectedError)
  }
}

type ExpectedOperationOutcome =
  | { success: true }
  | { success: false; error: string }

type ExpectedDestination =
  | { state: 'absent' }
  | { state: 'present'; bytes: Uint8Array; mode: number }

interface OperationCounts {
  readonly open?: number
  readonly write?: number
  readonly chmod?: number
  readonly sync?: number
  readonly close?: number
  readonly rename?: number
  readonly remove?: number
  readonly verifyAbsent?: number
  readonly lstat?: number
  readonly verifyBytes?: number
  readonly stageCloses?: {
    readonly structural?: number
    readonly semantic?: number
    readonly rollback?: number
  }
}

interface OperationCheckpoint {
  readonly operation: FailableOperation
  readonly pathMatcher?: (targetPath: string) => boolean
}

interface TransactionFixture {
  readonly directory: string
  readonly structuralPath: string
  readonly semanticPath: string
  readonly sentinelPath: string
  readonly sentinelSnapshot: FileSnapshot
  readonly structuralInitial: ExpectedDestination
  readonly semanticInitial: ExpectedDestination
}

const TRANSACTION_SENTINEL_BYTES = new TextEncoder().encode(
  'unrelated-sentinel-bytes',
)
const TRANSACTION_SENTINEL_MODE = 0o640

function presentDestination(
  content: string | Uint8Array,
  mode: number,
): ExpectedDestination {
  const bytes =
    typeof content === 'string' ? new TextEncoder().encode(content) : content
  return { state: 'present', bytes, mode }
}

async function createTransactionFixture(config: {
  readonly structural?: ExpectedDestination | null
  readonly semantic?: ExpectedDestination | null
}): Promise<TransactionFixture> {
  const directory = await createTemporaryDirectory('vinela-txn-')
  const structuralPath = join(directory, 'structural.generated.mjs')
  const semanticPath = join(directory, 'semantic.generated.mjs')
  const sentinelPath = join(directory, 'unrelated.sentinel')
  await writeFile(sentinelPath, TRANSACTION_SENTINEL_BYTES)
  await chmod(sentinelPath, TRANSACTION_SENTINEL_MODE)
  const sentinelSnapshot = await snapshotFile(sentinelPath)
  const structuralInitial: ExpectedDestination = config.structural ?? {
    state: 'absent',
  }
  const semanticInitial: ExpectedDestination = config.semantic ?? {
    state: 'absent',
  }
  if (structuralInitial.state === 'present') {
    await writeFile(structuralPath, structuralInitial.bytes)
    await chmod(structuralPath, structuralInitial.mode)
  }
  if (semanticInitial.state === 'present') {
    await writeFile(semanticPath, semanticInitial.bytes)
    await chmod(semanticPath, semanticInitial.mode)
  }
  return {
    directory,
    structuralPath,
    semanticPath,
    sentinelPath,
    sentinelSnapshot,
    structuralInitial,
    semanticInitial,
  }
}

async function assertExpectedDestination(
  path: string,
  expected: ExpectedDestination,
): Promise<void> {
  if (expected.state === 'absent') {
    await expect(stat(path)).rejects.toThrow()
    return
  }
  const [bytes, fileStats] = await Promise.all([readFile(path), stat(path)])
  expect(Buffer.from(bytes)).toEqual(Buffer.from(expected.bytes))
  expect(fileStats.mode & 0o7777).toBe(expected.mode)
}

async function assertSentinelUnchanged(
  path: string,
  snapshot: FileSnapshot,
): Promise<void> {
  const after = await snapshotFile(path)
  expectSnapshotUnchanged(snapshot, after)
}

async function collectStageResidueBasenames(
  directory: string,
): Promise<Set<string>> {
  const entries = await readdir(directory)
  return new Set(entries.filter((entry) => entry.includes('.stage-')))
}

async function collectRollbackResidueBasenames(
  directory: string,
): Promise<Set<string>> {
  const entries = await readdir(directory)
  return new Set(entries.filter((entry) => entry.includes('.rollback-')))
}

function captureUniqueRecordedPath(
  operations: readonly RecordedOperation[],
  predicate: (operation: RecordedOperation) => boolean,
): string {
  const matches = operations.filter(predicate).map((entry) => entry.targetPath)
  expect(matches.length, 'expected exactly one matching recorded path').toBe(1)
  return matches[0] as string
}

function assertOperationCounts(
  fileSystem: FaultInjectingTestFileSystem,
  expected: OperationCounts,
): void {
  if (expected.open !== undefined) {
    expect(fileSystem.countOperation('open')).toBe(expected.open)
  }
  if (expected.write !== undefined) {
    expect(fileSystem.countOperation('write')).toBe(expected.write)
  }
  if (expected.chmod !== undefined) {
    expect(fileSystem.countOperation('chmod')).toBe(expected.chmod)
  }
  if (expected.sync !== undefined) {
    expect(fileSystem.countOperation('sync')).toBe(expected.sync)
  }
  if (expected.close !== undefined) {
    expect(fileSystem.countOperation('close')).toBe(expected.close)
  }
  if (expected.rename !== undefined) {
    expect(fileSystem.countOperation('rename')).toBe(expected.rename)
  }
  if (expected.remove !== undefined) {
    expect(fileSystem.countOperation('remove')).toBe(expected.remove)
  }
  if (expected.verifyAbsent !== undefined) {
    expect(fileSystem.countOperation('verifyAbsent')).toBe(
      expected.verifyAbsent,
    )
  }
  if (expected.lstat !== undefined) {
    expect(fileSystem.countOperation('lstat')).toBe(expected.lstat)
  }
  if (expected.verifyBytes !== undefined) {
    expect(fileSystem.countOperation('verifyBytes')).toBe(expected.verifyBytes)
  }
  if (expected.stageCloses?.structural !== undefined) {
    expect(fileSystem.countStageCloses('structural')).toBe(
      expected.stageCloses.structural,
    )
  }
  if (expected.stageCloses?.semantic !== undefined) {
    expect(fileSystem.countStageCloses('semantic')).toBe(
      expected.stageCloses.semantic,
    )
  }
  if (expected.stageCloses?.rollback !== undefined) {
    expect(fileSystem.countStageCloses('rollback')).toBe(
      expected.stageCloses.rollback,
    )
  }
}

function assertOperationCheckpoints(
  operations: readonly RecordedOperation[],
  checkpoints: readonly OperationCheckpoint[],
): void {
  let searchFrom = 0
  for (const checkpoint of checkpoints) {
    const matchIndex = operations.findIndex(
      (entry, index) =>
        index >= searchFrom &&
        entry.operation === checkpoint.operation &&
        (checkpoint.pathMatcher === undefined ||
          checkpoint.pathMatcher(entry.targetPath)),
    )
    expect(
      matchIndex,
      `missing ordered checkpoint ${checkpoint.operation}`,
    ).toBeGreaterThanOrEqual(0)
    searchFrom = matchIndex + 1
  }
}

interface ExactFailedPairExpectation {
  readonly primaryFailure: { readonly step: string; readonly error: string }
  readonly rollbackOutcome: ExpectedOperationOutcome
  readonly verificationOutcome: ExpectedOperationOutcome
  readonly cleanupOutcome: ExpectedOperationOutcome
  readonly structuralDestination: ExpectedDestination
  readonly semanticDestination: ExpectedDestination
  readonly operationCounts: OperationCounts
  readonly operationCheckpoints?: readonly OperationCheckpoint[]
  readonly candidateResidue: ReadonlySet<string>
  readonly rollbackResidue: ReadonlySet<string>
}

interface ExactCommittedPairExpectation {
  readonly structuralChanged: boolean
  readonly semanticChanged: boolean
  readonly rollbackOutcome: ExpectedOperationOutcome
  readonly verificationOutcome: ExpectedOperationOutcome
  readonly cleanupOutcome: ExpectedOperationOutcome
  readonly structuralDestination: ExpectedDestination
  readonly semanticDestination: ExpectedDestination
  readonly operationCounts: OperationCounts
  readonly operationCheckpoints?: readonly OperationCheckpoint[]
  readonly candidateResidue: ReadonlySet<string>
  readonly rollbackResidue: ReadonlySet<string>
}

async function assertExactFailedPairOutcome(input: {
  readonly outcome: PairCommitOutcome
  readonly fileSystem: FaultInjectingTestFileSystem
  readonly fixture: TransactionFixture
  readonly expected: ExactFailedPairExpectation
}): Promise<void> {
  expect(input.outcome).toEqual({
    outcome: 'failed',
    primaryFailure: input.expected.primaryFailure,
    rollbackOutcome: input.expected.rollbackOutcome,
    verificationOutcome: input.expected.verificationOutcome,
    cleanupOutcome: input.expected.cleanupOutcome,
  })
  await assertExpectedDestination(
    input.fixture.structuralPath,
    input.expected.structuralDestination,
  )
  await assertExpectedDestination(
    input.fixture.semanticPath,
    input.expected.semanticDestination,
  )
  await assertSentinelUnchanged(
    input.fixture.sentinelPath,
    input.fixture.sentinelSnapshot,
  )
  assertOperationCounts(input.fileSystem, input.expected.operationCounts)
  if (input.expected.operationCheckpoints !== undefined) {
    assertOperationCheckpoints(
      input.fileSystem.recordedOperations,
      input.expected.operationCheckpoints,
    )
  }
  expect(await collectStageResidueBasenames(input.fixture.directory)).toEqual(
    input.expected.candidateResidue,
  )
  expect(
    await collectRollbackResidueBasenames(input.fixture.directory),
  ).toEqual(input.expected.rollbackResidue)
}

async function assertExactCommittedPairOutcome(input: {
  readonly outcome: PairCommitOutcome
  readonly fileSystem: FaultInjectingTestFileSystem
  readonly fixture: TransactionFixture
  readonly expected: ExactCommittedPairExpectation
}): Promise<void> {
  expect(input.outcome).toEqual({
    outcome: 'committed',
    structuralChanged: input.expected.structuralChanged,
    semanticChanged: input.expected.semanticChanged,
    rollbackOutcome: input.expected.rollbackOutcome,
    verificationOutcome: input.expected.verificationOutcome,
    cleanupOutcome: input.expected.cleanupOutcome,
  })
  await assertExpectedDestination(
    input.fixture.structuralPath,
    input.expected.structuralDestination,
  )
  await assertExpectedDestination(
    input.fixture.semanticPath,
    input.expected.semanticDestination,
  )
  await assertSentinelUnchanged(
    input.fixture.sentinelPath,
    input.fixture.sentinelSnapshot,
  )
  assertOperationCounts(input.fileSystem, input.expected.operationCounts)
  if (input.expected.operationCheckpoints !== undefined) {
    assertOperationCheckpoints(
      input.fileSystem.recordedOperations,
      input.expected.operationCheckpoints,
    )
  }
  expect(await collectStageResidueBasenames(input.fixture.directory)).toEqual(
    input.expected.candidateResidue,
  )
  expect(
    await collectRollbackResidueBasenames(input.fixture.directory),
  ).toEqual(input.expected.rollbackResidue)
}

function isStageStructuralPath(targetPath: string): boolean {
  return targetPath.includes('.stage-') && targetPath.includes('structural')
}

function isStageSemanticPath(targetPath: string): boolean {
  return targetPath.includes('.stage-') && targetPath.includes('semantic')
}

function isRollbackPath(targetPath: string): boolean {
  return targetPath.includes('.rollback-')
}

const STAGING_SKIP_VERIFICATION: ExpectedOperationOutcome = {
  success: false,
  error: 'skipped because staging failed',
}

const SUCCESS_OUTCOME: ExpectedOperationOutcome = { success: true }

const EMPTY_RESIDUE = new Set<string>()

async function runPairCommit(input: {
  readonly fixture: TransactionFixture
  readonly structuralBytes: Uint8Array
  readonly semanticBytes: Uint8Array
  readonly fileSystem?: FaultInjectingTestFileSystem
  readonly faultInjection?: Parameters<
    typeof commitValidatorArtifactPair
  >[0]['faultInjection']
}): Promise<{
  readonly outcome: PairCommitOutcome
  readonly fileSystem: FaultInjectingTestFileSystem
}> {
  const fileSystem = input.fileSystem ?? createFaultInjectingTestFileSystem([])
  const outcome = await commitValidatorArtifactPair({
    structural: {
      destinationPath: input.fixture.structuralPath,
      candidateBytes: input.structuralBytes,
    },
    semantic: {
      destinationPath: input.fixture.semanticPath,
      candidateBytes: input.semanticBytes,
    },
    fileSystem,
    ...(input.faultInjection === undefined
      ? {}
      : { faultInjection: input.faultInjection }),
  })
  return { outcome, fileSystem }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('plugin schema validator — isolated installed footprint', () => {
  it('validates from a copied skill layout with a separate plugin cwd and empty NODE_PATH', async () => {
    const layoutRoot = await createTemporaryDirectory()
    const pluginDirectory = await createTemporaryDirectory('vinela-plugin-cwd-')
    const isolatedValidator = await copyInstalledFootprint(layoutRoot)
    await writeSchema(pluginDirectory, minimalSchema())

    expect((await readdir(join(layoutRoot, 'scripts'))).sort()).toEqual(
      [...RUNTIME_SCRIPT_NAMES].sort(),
    )
    const semanticText = await readFile(
      join(layoutRoot, 'scripts', 'semantic-validator.generated.mjs'),
      'utf8',
    )
    for (const marker of SEMANTIC_FORBIDDEN_MARKERS) {
      expect(semanticText).not.toContain(marker)
    }

    const result = runValidator([], pluginDirectory, {
      validatorPath: isolatedValidator,
    })

    expectCompleted(result)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('valid:')
    expect(result.stderr).toBe('')
  })
})

describe('plugin schema validator — structural, semantic, and invariant failures', () => {
  it('accepts every public function-template default variant', async () => {
    const directory = await createTemporaryDirectory()
    const schemaPath = await writeSchema(directory, {
      ...minimalSchema(),
      functions: [
        {
          name: 'configure',
          luaCall: "require('example').configure($params)",
          params: [
            { name: 'enabled', type: 'boolean' },
            { name: 'level', type: 'any' },
            {
              name: 'roots',
              type: 'string',
              multi: true,
              allowedValues: ['cwd', 'config'],
            },
            { name: 'options', type: 'table' },
          ],
        },
      ],
      functionTemplates: [
        {
          key: 'configured',
          baseFunctionName: 'configure',
          label: 'Configured',
          shortDescription: 'Configure the plugin.',
          defaults: {
            enabled: { kind: 'scalar', value: true },
            level: { kind: 'lua', lua: 'vim.log.levels.INFO' },
            roots: { kind: 'multiselect', values: ['cwd'] },
            options: {
              kind: 'object',
              entries: {
                hidden: { kind: 'scalar', value: true },
                nested: {
                  kind: 'object',
                  entries: { timeout: { kind: 'scalar', value: 1000 } },
                },
              },
            },
          },
        },
      ],
    })

    const result = await runValidatorCore({
      argv: [schemaPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('valid:')
  })

  it('rejects an unknown top-level property structurally', async () => {
    const directory = await createTemporaryDirectory()
    const schemaPath = await writeSchema(directory, {
      ...minimalSchema(),
      unknownField: true,
    })

    const result = runValidator([schemaPath], directory)

    expectCompleted(result)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('structure:')
    expect(result.stderr).toContain('unknownField')
  })

  it('reports duplicate option keys through semantic validation', async () => {
    const directory = await createTemporaryDirectory()
    const schemaPath = await writeSchema(directory, {
      ...minimalSchema(),
      options: [
        { key: 'enabled', label: 'Enabled', type: 'boolean' },
        { key: 'enabled', label: 'Enabled again', type: 'boolean' },
      ],
    })

    const result = await runValidatorCore({
      argv: [schemaPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('semantic: [DUPLICATE_OPTION_KEY]')
  })

  it('reports effective Lua key collisions through shape invariants', async () => {
    const directory = await createTemporaryDirectory()
    const schemaPath = await writeSchema(directory, {
      ...minimalSchema(),
      options: [
        { key: 'first', emitKey: 'shared', label: 'First', type: 'boolean' },
        { key: 'second', emitKey: 'shared', label: 'Second', type: 'boolean' },
      ],
    })

    const result = await runValidatorCore({
      argv: [schemaPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('invariant:')
    expect(result.stderr).toContain('effective key collision')
  })
})

describe('plugin schema validator core — document diagnostics', () => {
  it('returns exact diagnostics for malformed JSON and invalid UTF-8', () => {
    const malformed = parseDocument(Buffer.from('{ invalid', 'utf8'))
    const invalidUtf8 = parseDocument(Buffer.from([0xff, 0xfe, 0x7b, 0x7d]))

    expect(malformed).toEqual({
      kind: 'document-error',
      message: 'invalid JSON',
      code: 1,
    })
    expect(invalidUtf8).toEqual({
      kind: 'document-error',
      message: 'invalid UTF-8',
      code: 1,
    })
  })

  it('rejects non-object JSON roots with the exact object-root diagnostic', () => {
    const roots = ['null', '[]', '"hello"', '42', 'true'] as const
    for (const text of roots) {
      const parsed = parseDocument(Buffer.from(text, 'utf8'))
      expect(parsed, text).toEqual({
        kind: 'document-error',
        message: 'root must be an object',
        code: 1,
      })
    }
  })

  it('accepts exactly 2 MiB and rejects 2 MiB + 1 byte through the orchestrator', async () => {
    const directory = await createTemporaryDirectory()
    const exactPath = join(directory, 'exact.json')
    const oversizedPath = join(directory, 'oversized.json')
    await writeFile(exactPath, buildDocumentOfByteLength(MAX_DOCUMENT_BYTES))
    await writeFile(
      oversizedPath,
      buildDocumentOfByteLength(MAX_DOCUMENT_BYTES + 1),
    )

    const exact = await runValidatorCore({
      argv: [exactPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })
    const oversized = await runValidatorCore({
      argv: [oversizedPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })

    expect(exact.exitCode).toBe(0)
    expect(oversized.exitCode).toBe(1)
    expect(oversized.stderr).toBe('document: exceeds 2097152-byte limit\n')
  })
})

describe('plugin schema validator core — usage parsing', () => {
  it('returns exact usage for -, --, flags, and extra operands', () => {
    const syntheticCwd = join(REPOSITORY_ROOT, 'synthetic-validator-cwd')
    expect(parseArguments([], syntheticCwd)).toEqual({
      kind: 'ok',
      path: join(syntheticCwd, 'vinela.schema.json'),
    })
    expect(parseArguments(['schema.json'], syntheticCwd)).toEqual({
      kind: 'ok',
      path: join(syntheticCwd, 'schema.json'),
    })
    expect(parseArguments(['/absolute/schema.json'], syntheticCwd)).toEqual({
      kind: 'ok',
      path: '/absolute/schema.json',
    })
    expect(parseArguments(['-'], REPOSITORY_ROOT)).toEqual({ kind: 'usage' })
    expect(parseArguments(['--'], REPOSITORY_ROOT)).toEqual({ kind: 'usage' })
    expect(parseArguments(['--help'], REPOSITORY_ROOT)).toEqual({
      kind: 'usage',
    })
    expect(parseArguments(['one.json', 'two.json'], REPOSITORY_ROOT)).toEqual({
      kind: 'usage',
    })
  })
})

describe('plugin schema validator — usage and read errors', () => {
  it('returns read exit 2 for a missing file', async () => {
    const directory = await createTemporaryDirectory()
    const missing = runValidator(['/definitely/missing/schema.json'], directory)

    expectCompleted(missing)
    expect(missing.status).toBe(2)
    expect(missing.stderr).toContain('read:')
  })

  it('returns exact usage exit 2 for a flag operand', () => {
    const result = runValidator(['--help'], REPOSITORY_ROOT)

    expectCompleted(result)
    expect(result.status).toBe(2)
    expect(result.stderr).toBe(USAGE)
  })
})

describe('plugin schema validator — starter schema', () => {
  it('validates the starter after deterministic placeholder replacement', async () => {
    const directory = await createTemporaryDirectory()
    const starter = await readFile(STARTER_PATH, 'utf8')
    const replaced = replaceLiteral(
      replaceLiteral(
        replaceLiteral(
          replaceLiteral(starter, 'replace-with-plugin-id', 'sample-plugin'),
          'Replace with plugin name',
          'sample-plugin.nvim',
        ),
        'replace-owner',
        'sample-owner',
      ),
      'replace-repository',
      'sample-plugin.nvim',
    )
    const schemaPath = join(directory, 'vinela.schema.json')
    await writeFile(schemaPath, replaced, 'utf8')

    const result = await runValidatorCore({
      argv: [schemaPath],
      cwd: directory,
      scriptDir: SKILL_SCRIPTS_DIR,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('valid:')
  })
})

describe('plugin schema validator — missing or corrupt generated modules', () => {
  it('returns concise internal exit 2 without a stack trace', async () => {
    const layoutRoot = await createTemporaryDirectory()
    const pluginDirectory = await createTemporaryDirectory('vinela-plugin-cwd-')
    const isolatedValidator = await copyInstalledFootprint(layoutRoot)
    await writeSchema(pluginDirectory, minimalSchema())
    await rm(join(layoutRoot, 'scripts', 'structural-validator.generated.mjs'))

    const missing = runValidator([], pluginDirectory, {
      validatorPath: isolatedValidator,
    })

    expectCompleted(missing)
    expect(missing.status).toBe(2)
    expect(missing.stderr).toMatch(/^internal: /)
    expect(missing.stderr).not.toContain('    at ')

    await writeFile(
      join(layoutRoot, 'scripts', 'structural-validator.generated.mjs'),
      'export const validatePluginSchemaStructure = 1\n',
      'utf8',
    )
    const corrupt = await runValidatorCore({
      argv: [],
      cwd: pluginDirectory,
      scriptDir: join(layoutRoot, 'scripts'),
      dependencies: {
        import: importUnknownModule,
      },
    })

    expect(corrupt.exitCode).toBe(2)
    expect(corrupt.stderr).toMatch(/^internal: /)
    expect(corrupt.stderr).not.toContain('    at ')
  })
})

describe('generated module AST checks', () => {
  it('rejects external imports and asserts exact exports for both generated modules', async () => {
    const structuralText = await readFile(STRUCTURAL_VALIDATOR_PATH, 'utf8')
    const semanticText = await readFile(SEMANTIC_VALIDATOR_PATH, 'utf8')

    const structuralAst = validateGeneratedModuleAst(structuralText, [
      'validatePluginSchemaStructure',
    ])
    const semanticAst = validateGeneratedModuleAst(semanticText, [
      'validateSchema',
      'assertSchemaShape',
      'LuaGenerationError',
    ])

    expect(structuralAst.success).toBe(true)
    expect(semanticAst.success).toBe(true)
    if (structuralAst.success) {
      expect(structuralAst.data).toEqual(['validatePluginSchemaStructure'])
    }
    if (semanticAst.success) {
      expect(semanticAst.data.sort()).toEqual(
        ['LuaGenerationError', 'assertSchemaShape', 'validateSchema'].sort(),
      )
    }
  })
})

describe('semantic input set comparator', () => {
  it('accepts exact approved equality', () => {
    const comparison = compareSemanticInputSets(
      [...APPROVED_SEMANTIC_INPUTS],
      APPROVED_SEMANTIC_INPUTS,
    )
    expect(comparison).toEqual({ equal: true })
  })

  it('reports sorted missing and extra entries', () => {
    const missingOnly = compareSemanticInputSets(
      APPROVED_SEMANTIC_INPUTS.slice(1),
      APPROVED_SEMANTIC_INPUTS,
    )
    const extraOnly = compareSemanticInputSets(
      [...APPROVED_SEMANTIC_INPUTS, 'src/extra/file.ts'],
      APPROVED_SEMANTIC_INPUTS,
    )

    expect(missingOnly.equal).toBe(false)
    if (!missingOnly.equal) {
      expect(missingOnly.missing).toEqual([APPROVED_SEMANTIC_INPUTS[0]])
      expect(missingOnly.extra).toEqual([])
    }
    expect(extraOnly.equal).toBe(false)
    if (!extraOnly.equal) {
      expect(extraOnly.missing).toEqual([])
      expect(extraOnly.extra).toEqual(['src/extra/file.ts'])
    }
  })

  it('normalizes separators and collapses dot segments without false positives', () => {
    const normalized = compareSemanticInputSets(
      APPROVED_SEMANTIC_INPUTS.map((entry) => entry.replace(/\//g, '\\')),
      APPROVED_SEMANTIC_INPUTS,
    )
    const trap = compareSemanticInputSets(
      ['src/shared/lib/../types/schema.ts'],
      ['src/shared/types/schema.ts'],
    )
    const prefixTrap = compareSemanticInputSets(
      ['src/shared/types/schema.ts.backup'],
      ['src/shared/types/schema.ts'],
    )

    expect(normalized).toEqual({ equal: true })
    expect(trap).toEqual({ equal: true })
    expect(prefixTrap.equal).toBe(false)
    if (!prefixTrap.equal) {
      expect(prefixTrap.missing).toEqual(['src/shared/types/schema.ts'])
      expect(prefixTrap.extra).toEqual(['src/shared/types/schema.ts.backup'])
    }
  })
})

describe('metafile parse validation', () => {
  it('fails closed on malformed metafile shapes', () => {
    const cases: unknown[] = [
      null,
      'metafile',
      {},
      { inputs: {}, outputs: { out: { bytes: 'bad', inputs: {} } } },
      {
        inputs: { entry: { bytes: 1, imports: [{}] } },
        outputs: { out: { bytes: 1, inputs: {} } },
      },
      {
        inputs: { entry: { bytes: 1 } },
        outputs: { out: { bytes: 1, inputs: { missingBytesInOutput: {} } } },
      },
    ]

    for (const [index, metafile] of cases.entries()) {
      const parsed = parseBunMetafile(metafile)
      expect(parsed.success, `fixture ${index}`).toBe(false)
    }

    const valid = parseBunMetafile({
      inputs: {
        entry: { bytes: 12 },
      },
      outputs: {
        out: {
          bytes: 12,
          inputs: {
            entry: { bytesInOutput: 12 },
          },
        },
      },
    })
    expect(valid.success).toBe(true)
  })
})

describe('structural package set comparator', () => {
  it('accepts the expected pinned package identities and rejects drift', () => {
    const expectedIdentities = new Set(
      EXPECTED_STRUCTURAL_PACKAGES.map((entry) =>
        packageIdentity(entry.name, entry.version),
      ),
    )

    expect(
      compareStructuralPackageSets(
        expectedIdentities,
        EXPECTED_STRUCTURAL_PACKAGES,
      ),
    ).toEqual({
      equal: true,
    })

    const missing = compareStructuralPackageSets(
      new Set([
        packageIdentity('ajv', EXPECTED_STRUCTURAL_PACKAGES[0]?.version ?? ''),
      ]),
      EXPECTED_STRUCTURAL_PACKAGES,
    )
    const extra = compareStructuralPackageSets(
      new Set([
        ...expectedIdentities,
        packageIdentity('leftover-package', '1.0.0'),
      ]),
      EXPECTED_STRUCTURAL_PACKAGES,
    )

    expect(missing.equal).toBe(false)
    if (!missing.equal) {
      expect(missing.missing).toContain(
        packageIdentity(
          'ajv-formats',
          EXPECTED_STRUCTURAL_PACKAGES[1]?.version ?? '',
        ),
      )
    }
    expect(extra.equal).toBe(false)
    if (!extra.equal) {
      expect(extra.extra).toEqual(['leftover-package@1.0.0'])
    }
  })
})

describe('executePairFailureRecovery production executor seam', () => {
  it('preserves rollback failure when verification throws', async () => {
    const result = await executePairFailureRecovery({
      primaryFailure: {
        step: 'commit-semantic',
        error: 'injected rename failure for semantic.generated.mjs',
      },
      rollback: async () => ({
        success: false,
        error: 'rollback-sentinel',
      }),
      verify: async () => {
        throw new Error('verification-escaped-sentinel')
      },
    })
    expect(result.primaryFailure).toEqual({
      step: 'commit-semantic',
      error: 'injected rename failure for semantic.generated.mjs',
    })
    expect(result.rollbackOutcome).toEqual({
      success: false,
      error: 'rollback-sentinel',
    })
    expect(result.verificationOutcome).toEqual({
      success: false,
      error: 'verification-escaped-sentinel',
    })
  })

  it('records interrupted rollback and skips verification when rollback throws (B8)', async () => {
    let verificationCalls = 0
    const result = await executePairFailureRecovery({
      primaryFailure: {
        step: 'commit-semantic',
        error: 'injected rename failure for semantic.generated.mjs',
      },
      rollback: async () => {
        throw new Error('rollback-escaped-sentinel')
      },
      verify: async () => {
        verificationCalls += 1
        return { success: true }
      },
    })
    expect(result.primaryFailure).toEqual({
      step: 'commit-semantic',
      error: 'injected rename failure for semantic.generated.mjs',
    })
    expect(result.rollbackOutcome).toEqual({
      success: false,
      error: 'rollback-escaped-sentinel',
    })
    expect(result.verificationOutcome).toEqual({
      success: false,
      error: 'skipped because rollback was interrupted',
    })
    expect(verificationCalls).toBe(0)
  })

  it('retains typed rollback and verification outcomes without alteration', async () => {
    const result = await executePairFailureRecovery({
      primaryFailure: {
        step: 'commit-semantic',
        error: 'injected rename failure for semantic.generated.mjs',
      },
      rollback: async () => ({ success: true }),
      verify: async () => ({
        success: false,
        error:
          'expected present destination is absent: /tmp/semantic.generated.mjs',
      }),
    })
    expect(result.primaryFailure).toEqual({
      step: 'commit-semantic',
      error: 'injected rename failure for semantic.generated.mjs',
    })
    expect(result.rollbackOutcome).toEqual({ success: true })
    expect(result.verificationOutcome).toEqual({
      success: false,
      error:
        'expected present destination is absent: /tmp/semantic.generated.mjs',
    })
  })
})

describe('commitValidatorArtifactPair staging ownership matrix', () => {
  it('commits both absent candidates with one open/close each and 0o644 modes (A1)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([])
    const structuralBytes = new TextEncoder().encode('new-structural-a1')
    const semanticBytes = new TextEncoder().encode('new-semantic-a1')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes,
      fileSystem,
    })
    await assertExactCommittedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        structuralChanged: true,
        semanticChanged: true,
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(
          structuralBytes,
          NEW_FILE_MODE,
        ),
        semanticDestination: presentDestination(semanticBytes, NEW_FILE_MODE),
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 1 },
          rename: 2,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'open', pathMatcher: isStageSemanticPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          { operation: 'rename', pathMatcher: isStageSemanticPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('preserves distinct present modes on successful two-candidate commit (A2)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: presentDestination('old-semantic', 0o622),
    })
    const fileSystem = createFaultInjectingTestFileSystem([])
    const structuralBytes = new TextEncoder().encode('new-structural-a2')
    const semanticBytes = new TextEncoder().encode('new-semantic-a2')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes,
      fileSystem,
    })
    await assertExactCommittedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        structuralChanged: true,
        semanticChanged: true,
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: presentDestination(semanticBytes, 0o622),
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 1 },
          rename: 2,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'open', pathMatcher: isStageSemanticPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          { operation: 'rename', pathMatcher: isStageSemanticPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })
})

describe('commitValidatorArtifactPair transaction fault matrix', () => {
  it('fails structural staging open with exact four-outcome contract (A3)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected structural staging failure',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'injected structural staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          stageCloses: { structural: 0, semantic: 0 },
          rename: 0,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails semantic staging open after structural stage closes (A4)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('semantic') && targetPath.includes('.stage-'),
        errorMessage: 'injected semantic staging failure',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-semantic',
          error: 'injected semantic staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
          remove: 2,
          verifyAbsent: 2,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'open', pathMatcher: isStageSemanticPath },
          { operation: 'remove', pathMatcher: isStageStructuralPath },
          { operation: 'verifyAbsent', pathMatcher: isStageStructuralPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails structural staging write with exact four-outcome contract (A5)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'write',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected structural write failure',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'injected structural write failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          write: 1,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'write', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails structural staging chmod with exact four-outcome contract (A6)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'chmod',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected structural chmod failure',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'injected structural chmod failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          write: 1,
          chmod: 1,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
          sync: 0,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'write', pathMatcher: isStageStructuralPath },
          { operation: 'chmod', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails structural staging sync with exact four-outcome contract (A7)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'sync',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected structural sync failure',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'injected structural sync failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          write: 1,
          chmod: 1,
          sync: 1,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
        },
        operationCheckpoints: [
          { operation: 'open', pathMatcher: isStageStructuralPath },
          { operation: 'write', pathMatcher: isStageStructuralPath },
          { operation: 'chmod', pathMatcher: isStageStructuralPath },
          { operation: 'sync', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageStructuralPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails structural staging close after delegate with one close attempt (A8)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'close',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'vinela-close-sentinel',
        timing: 'after',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural-close'),
      semanticBytes: new TextEncoder().encode('new-semantic-close'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'close: vinela-close-sentinel',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          write: 1,
          chmod: 1,
          sync: 1,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails structural write and delegated close with combined primary error (A9)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'write',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'vinela-write-sentinel',
      },
      {
        operation: 'close',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'vinela-close-sentinel',
        timing: 'after',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural-combined'),
      semanticBytes: new TextEncoder().encode('new-semantic-combined'),
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-structural',
          error: 'vinela-write-sentinel; close: vinela-close-sentinel',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 1,
          stageCloses: { structural: 1, semantic: 0 },
          rename: 0,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('records rollback-stage write failure with mixed destination state (A10)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'write',
        pathMatcher: (targetPath) => targetPath.includes('.rollback-'),
        errorMessage: 'injected rollback stage write failure',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: 'injected rollback stage write failure',
        },
        verificationOutcome: {
          success: false,
          error: `destination bytes mismatch: ${fixture.structuralPath}`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 3,
          stageCloses: { structural: 1, semantic: 1, rollback: 1 },
          rename: 1,
        },
        operationCheckpoints: [
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          { operation: 'open', pathMatcher: isRollbackPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('cleans both candidates after first commit rename failure (B1)', async () => {
    const fixture = await createTransactionFixture({})
    const { outcome, fileSystem } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      faultInjection: { failFirstCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-structural',
          error: `injected rename failure for ${fixture.structuralPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 1 },
          remove: 2,
          verifyAbsent: 4,
        },
        operationCheckpoints: [
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('restores both absent destinations after failed second rename (B2)', async () => {
    const fixture = await createTransactionFixture({})
    const { outcome, fileSystem } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 1 },
          rename: 1,
          remove: 3,
        },
        operationCheckpoints: [
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          {
            operation: 'remove',
            pathMatcher: (p) => p === fixture.structuralPath,
          },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('restores present/present snapshots after failed second rename (B3)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o600),
      semantic: presentDestination('old-semantic', 0o604),
    })
    const { outcome, fileSystem } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: fixture.structuralInitial,
        semanticDestination: fixture.semanticInitial,
        operationCounts: {
          open: 3,
          stageCloses: { structural: 1, semantic: 1, rollback: 1 },
          rename: 2,
        },
        operationCheckpoints: [
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          { operation: 'open', pathMatcher: isRollbackPath },
          { operation: 'close', pathMatcher: isRollbackPath },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('restores absent/present snapshots after failed second rename (B4)', async () => {
    const fixture = await createTransactionFixture({
      structural: null,
      semantic: presentDestination('old-semantic', 0o604),
    })
    const { outcome, fileSystem } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: fixture.semanticInitial,
        operationCounts: {
          open: 2,
          stageCloses: { structural: 1, semantic: 1 },
          rename: 1,
          remove: 3,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('restores present/absent snapshots after failed second rename (B5)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o600),
      semantic: null,
    })
    const { outcome, fileSystem } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: SUCCESS_OUTCOME,
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: fixture.structuralInitial,
        semanticDestination: { state: 'absent' },
        operationCounts: {
          open: 3,
          stageCloses: { structural: 1, semantic: 1, rollback: 1 },
          rename: 2,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('preserves absent rollback-remove failure when verification throws (B6)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'verification-escaped-sentinel',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: {
        failSecondCommitRename: true,
        failAbsentRollbackRemove: true,
      },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: `injected remove failure for ${fixture.structuralPath}`,
        },
        verificationOutcome: {
          success: false,
          error: `expected absent destination is present: ${fixture.structuralPath}; ${fixture.semanticPath}: verification-escaped-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(
          structuralBytes,
          NEW_FILE_MODE,
        ),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          rename: 1,
          stageCloses: { rollback: 0 },
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('preserves present rollback-rename failure when verification throws (B7)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'verification-escaped-sentinel-b7',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: {
        failSecondCommitRename: true,
        failPresentRollbackRename: true,
      },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: `injected rollback rename failure for ${fixture.structuralPath}`,
        },
        verificationOutcome: {
          success: false,
          error: `destination bytes mismatch: ${fixture.structuralPath}; ${fixture.semanticPath}: verification-escaped-sentinel-b7`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          stageCloses: { rollback: 1 },
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('preserves snapshot verification failure after successful rollback (B9)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o600),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'vinela-verify-absent-sentinel',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: { failSecondCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: {
          success: false,
          error: `${fixture.semanticPath}: vinela-verify-absent-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: fixture.structuralInitial,
        semanticDestination: { state: 'absent' },
        operationCounts: {
          verifyAbsent: 4,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('aggregates both snapshot verification failures after first rename failure (B10)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath === fixture.structuralPath,
        errorMessage: 'structural-snapshot-sentinel',
        succeedBeforeFail: 0,
      },
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'semantic-snapshot-sentinel',
        succeedBeforeFail: 0,
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: { failFirstCommitRename: true },
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-structural',
          error: `injected rename failure for ${fixture.structuralPath}`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: {
          success: false,
          error: `${fixture.structuralPath}: structural-snapshot-sentinel; ${fixture.semanticPath}: semantic-snapshot-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          verifyAbsent: 4,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails verify-commit on structural verifyBytes without fabricating rollback failure (B11)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyBytes',
        pathMatcher: (targetPath) => targetPath === fixture.structuralPath,
        errorMessage: 'vinela-verify-bytes-sentinel',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const semanticBytes = new TextEncoder().encode('new-semantic')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes,
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'verify-commit',
          error: `${fixture.structuralPath}: vinela-verify-bytes-sentinel`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: {
          success: false,
          error: `${fixture.structuralPath}: vinela-verify-bytes-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(
          structuralBytes,
          NEW_FILE_MODE,
        ),
        semanticDestination: presentDestination(semanticBytes, NEW_FILE_MODE),
        operationCounts: {
          stageCloses: { structural: 1, semantic: 1 },
          rename: 2,
          verifyBytes: 2,
        },
        operationCheckpoints: [
          { operation: 'close', pathMatcher: isStageStructuralPath },
          { operation: 'close', pathMatcher: isStageSemanticPath },
          { operation: 'rename', pathMatcher: isStageStructuralPath },
          { operation: 'rename', pathMatcher: isStageSemanticPath },
          {
            operation: 'verifyBytes',
            pathMatcher: (targetPath) => targetPath === fixture.structuralPath,
          },
        ],
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('fails verify-commit on semantic lstat without fabricating rollback failure (B12)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'lstat',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'vinela-lstat-sentinel',
        succeedBeforeFail: 2,
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural-lstat')
    const semanticBytes = new TextEncoder().encode('new-semantic-lstat')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes,
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'verify-commit',
          error: `${fixture.semanticPath}: vinela-lstat-sentinel`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: {
          success: false,
          error: `${fixture.semanticPath}: vinela-lstat-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(
          structuralBytes,
          NEW_FILE_MODE,
        ),
        semanticDestination: presentDestination(semanticBytes, NEW_FILE_MODE),
        operationCounts: {
          rename: 2,
          lstat: 6,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('aggregates two destination verification failures in structural-then-semantic order (B13)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyBytes',
        pathMatcher: (targetPath) => targetPath === fixture.structuralPath,
        errorMessage: 'structural-verify-sentinel',
        succeedBeforeFail: 0,
      },
      {
        operation: 'verifyBytes',
        pathMatcher: (targetPath) => targetPath === fixture.semanticPath,
        errorMessage: 'semantic-verify-sentinel',
        succeedBeforeFail: 0,
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const semanticBytes = new TextEncoder().encode('new-semantic')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes,
      fileSystem,
    })
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'verify-commit',
          error: `${fixture.structuralPath}: structural-verify-sentinel; ${fixture.semanticPath}: semantic-verify-sentinel`,
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: {
          success: false,
          error: `${fixture.structuralPath}: structural-verify-sentinel; ${fixture.semanticPath}: semantic-verify-sentinel`,
        },
        cleanupOutcome: SUCCESS_OUTCOME,
        structuralDestination: presentDestination(
          structuralBytes,
          NEW_FILE_MODE,
        ),
        semanticDestination: presentDestination(semanticBytes, NEW_FILE_MODE),
        operationCounts: {
          rename: 2,
          verifyBytes: 2,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('reports candidate remove failure before deletion with residual basename (C1)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('semantic') && targetPath.includes('.stage-'),
        errorMessage: 'injected semantic staging failure',
      },
      {
        operation: 'remove',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected candidate before-delete',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    const stagePath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' &&
        entry.targetPath.includes('structural') &&
        entry.targetPath.includes('.stage-'),
    )
    const stageBasename = basename(stagePath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-semantic',
          error: 'injected semantic staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: {
          success: false,
          error: `candidate ${stageBasename}: remove failed (injected candidate before-delete); residual remains`,
        },
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          remove: 2,
          verifyAbsent: 2,
        },
        operationCheckpoints: [
          { operation: 'remove', pathMatcher: isStageStructuralPath },
          { operation: 'remove', pathMatcher: isStageSemanticPath },
        ],
        candidateResidue: new Set([stageBasename]),
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
    await rm(stagePath, { force: true })
    await expectNoStageResidue(fixture.directory)
  })

  it('reports candidate remove-after-deletion with absence verified and no residue (C2)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('semantic') && targetPath.includes('.stage-'),
        errorMessage: 'injected semantic staging failure',
      },
      {
        operation: 'remove',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected candidate cleanup after-delete',
        timing: 'after',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    const stagePath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' &&
        entry.targetPath.includes('structural') &&
        entry.targetPath.includes('.stage-'),
    )
    const stageBasename = basename(stagePath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-semantic',
          error: 'injected semantic staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: {
          success: false,
          error: `candidate ${stageBasename}: remove failed (injected candidate cleanup after-delete); absence verified`,
        },
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          remove: 2,
          verifyAbsent: 2,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('reports candidate absence-verify failure after successful remove (C3)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('semantic') && targetPath.includes('.stage-'),
        errorMessage: 'injected semantic staging failure',
      },
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'candidate-absence-verify-sentinel',
        succeedBeforeFail: 0,
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    const stagePath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' &&
        entry.targetPath.includes('structural') &&
        entry.targetPath.includes('.stage-'),
    )
    const stageBasename = basename(stagePath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-semantic',
          error: 'injected semantic staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: {
          success: false,
          error: `candidate ${stageBasename}: absence verify failed (candidate-absence-verify-sentinel)`,
        },
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          remove: 2,
          verifyAbsent: 2,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
    await expect(stat(stagePath)).rejects.toThrow()
  })

  it('reports rollback residual when remove fails before deletion (C4)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'remove',
        pathMatcher: (targetPath) => targetPath.includes('.rollback-'),
        errorMessage: 'rollback-before-delete-sentinel',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: {
        failSecondCommitRename: true,
        failPresentRollbackRename: true,
      },
    })
    const rollbackPath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' && entry.targetPath.includes('.rollback-'),
    )
    const rollbackBasename = basename(rollbackPath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: `injected rollback rename failure for ${fixture.structuralPath}`,
        },
        verificationOutcome: {
          success: false,
          error: `destination bytes mismatch: ${fixture.structuralPath}`,
        },
        cleanupOutcome: {
          success: false,
          error: `rollback ${rollbackBasename}: remove failed (rollback-before-delete-sentinel); residual remains`,
        },
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          stageCloses: { rollback: 1 },
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: new Set([rollbackBasename]),
      },
    })
    await rm(rollbackPath, { force: true })
    await expectNoStageResidue(fixture.directory)
  })

  it('reports rollback cleanup after-delete when rollback rename fails (C5)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'remove',
        pathMatcher: (targetPath) => targetPath.includes('.rollback-'),
        errorMessage: 'injected rollback cleanup after-delete',
        timing: 'after',
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: {
        failSecondCommitRename: true,
        failPresentRollbackRename: true,
      },
    })
    const rollbackPath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' && entry.targetPath.includes('.rollback-'),
    )
    const rollbackBasename = basename(rollbackPath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: `injected rollback rename failure for ${fixture.structuralPath}`,
        },
        verificationOutcome: {
          success: false,
          error: `destination bytes mismatch: ${fixture.structuralPath}`,
        },
        cleanupOutcome: {
          success: false,
          error: `rollback ${rollbackBasename}: remove failed (injected rollback cleanup after-delete); absence verified`,
        },
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          stageCloses: { rollback: 1 },
          remove: 3,
          verifyAbsent: 4,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
  })

  it('reports rollback absence-verify failure after successful remove (C6)', async () => {
    const fixture = await createTransactionFixture({
      structural: presentDestination('old-structural', 0o611),
      semantic: null,
    })
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'verifyAbsent',
        pathMatcher: (targetPath) => targetPath.includes('.rollback-'),
        errorMessage: 'rollback-absence-verify-sentinel',
        succeedBeforeFail: 0,
      },
    ])
    const structuralBytes = new TextEncoder().encode('new-structural')
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes,
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
      faultInjection: {
        failSecondCommitRename: true,
        failPresentRollbackRename: true,
      },
    })
    const rollbackPath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' && entry.targetPath.includes('.rollback-'),
    )
    const rollbackBasename = basename(rollbackPath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'commit-semantic',
          error: `injected rename failure for ${fixture.semanticPath}`,
        },
        rollbackOutcome: {
          success: false,
          error: `injected rollback rename failure for ${fixture.structuralPath}`,
        },
        verificationOutcome: {
          success: false,
          error: `destination bytes mismatch: ${fixture.structuralPath}`,
        },
        cleanupOutcome: {
          success: false,
          error: `rollback ${rollbackBasename}: absence verify failed (rollback-absence-verify-sentinel)`,
        },
        structuralDestination: presentDestination(structuralBytes, 0o611),
        semanticDestination: { state: 'absent' },
        operationCounts: {
          stageCloses: { rollback: 1 },
          remove: 3,
          verifyAbsent: 4,
        },
        candidateResidue: EMPTY_RESIDUE,
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
    await expect(stat(rollbackPath)).rejects.toThrow()
  })

  it('continues cleanup after first registered path fails and leaves only injected residual (C7)', async () => {
    const fixture = await createTransactionFixture({})
    const fileSystem = createFaultInjectingTestFileSystem([
      {
        operation: 'open',
        pathMatcher: (targetPath) =>
          targetPath.includes('semantic') && targetPath.includes('.stage-'),
        errorMessage: 'injected semantic staging failure',
      },
      {
        operation: 'remove',
        pathMatcher: (targetPath) =>
          targetPath.includes('structural') && targetPath.includes('.stage-'),
        errorMessage: 'injected first cleanup residual',
      },
    ])
    const { outcome } = await runPairCommit({
      fixture,
      structuralBytes: new TextEncoder().encode('new-structural'),
      semanticBytes: new TextEncoder().encode('new-semantic'),
      fileSystem,
    })
    const stagePath = captureUniqueRecordedPath(
      fileSystem.recordedOperations,
      (entry) =>
        entry.operation === 'open' &&
        entry.targetPath.includes('structural') &&
        entry.targetPath.includes('.stage-'),
    )
    const stageBasename = basename(stagePath)
    await assertExactFailedPairOutcome({
      outcome,
      fileSystem,
      fixture,
      expected: {
        primaryFailure: {
          step: 'stage-semantic',
          error: 'injected semantic staging failure',
        },
        rollbackOutcome: SUCCESS_OUTCOME,
        verificationOutcome: STAGING_SKIP_VERIFICATION,
        cleanupOutcome: {
          success: false,
          error: `candidate ${stageBasename}: remove failed (injected first cleanup residual); residual remains`,
        },
        structuralDestination: { state: 'absent' },
        semanticDestination: { state: 'absent' },
        operationCounts: {
          remove: 2,
          verifyAbsent: 2,
        },
        operationCheckpoints: [
          { operation: 'remove', pathMatcher: isStageStructuralPath },
          { operation: 'verifyAbsent', pathMatcher: isStageStructuralPath },
          { operation: 'remove', pathMatcher: isStageSemanticPath },
          { operation: 'verifyAbsent', pathMatcher: isStageSemanticPath },
        ],
        candidateResidue: new Set([stageBasename]),
        rollbackResidue: EMPTY_RESIDUE,
      },
    })
    await rm(stagePath, { force: true })
    await expectNoStageResidue(fixture.directory)
  })
})
describe('commitValidatorArtifactPair successful commit', () => {
  it('preserves distinct existing modes when bytes change, applies 0o644 to absent outputs, and skips matching candidates', async () => {
    const directory = await createTemporaryDirectory('vinela-artifact-success-')
    const structuralPath = join(directory, 'structural.generated.mjs')
    const semanticPath = join(directory, 'semantic.generated.mjs')
    const matchingBytes = new TextEncoder().encode('already-matching')
    const distinctBytes = new TextEncoder().encode('distinct-existing')
    await writeFile(structuralPath, matchingBytes)
    await writeFile(semanticPath, distinctBytes)
    await chmod(structuralPath, 0o600)
    await chmod(semanticPath, 0o605)

    const skipOutcome = await commitValidatorArtifactPair({
      structural: {
        destinationPath: structuralPath,
        candidateBytes: matchingBytes,
      },
      semantic: {
        destinationPath: semanticPath,
        candidateBytes: distinctBytes,
      },
    })

    expect(skipOutcome.outcome).toBe('committed')
    if (skipOutcome.outcome === 'committed') {
      expect(skipOutcome.structuralChanged).toBe(false)
      expect(skipOutcome.semanticChanged).toBe(false)
    }
    expect((await stat(structuralPath)).mode & 0o7777).toBe(0o600)
    expect((await stat(semanticPath)).mode & 0o7777).toBe(0o605)

    const changedStructuralPath = join(
      directory,
      'changed-structural.generated.mjs',
    )
    const changedSemanticPath = join(
      directory,
      'changed-semantic.generated.mjs',
    )
    await writeFile(changedStructuralPath, 'old-structural', 'utf8')
    await writeFile(changedSemanticPath, 'old-semantic', 'utf8')
    await chmod(changedStructuralPath, 0o600)
    await chmod(changedSemanticPath, 0o605)
    const changedOutcome = await commitValidatorArtifactPair({
      structural: {
        destinationPath: changedStructuralPath,
        candidateBytes: new TextEncoder().encode('new-structural-bytes'),
      },
      semantic: {
        destinationPath: changedSemanticPath,
        candidateBytes: new TextEncoder().encode('new-semantic-bytes'),
      },
    })
    expect(changedOutcome.outcome).toBe('committed')
    expect(await readFile(changedStructuralPath, 'utf8')).toBe(
      'new-structural-bytes',
    )
    expect(await readFile(changedSemanticPath, 'utf8')).toBe(
      'new-semantic-bytes',
    )
    expect((await stat(changedStructuralPath)).mode & 0o7777).toBe(0o600)
    expect((await stat(changedSemanticPath)).mode & 0o7777).toBe(0o605)
    await expectNoStageResidue(directory)

    const absentStructuralPath = join(
      directory,
      'absent-structural.generated.mjs',
    )
    const absentSemanticPath = join(directory, 'absent-semantic.generated.mjs')
    const writeOutcome = await commitValidatorArtifactPair({
      structural: {
        destinationPath: absentStructuralPath,
        candidateBytes: new TextEncoder().encode('fresh-structural'),
      },
      semantic: {
        destinationPath: absentSemanticPath,
        candidateBytes: new TextEncoder().encode('fresh-semantic'),
      },
      fileSystem: createNodeArtifactFileSystem(),
    })

    expect(writeOutcome.outcome).toBe('committed')
    expect((await stat(absentStructuralPath)).mode & 0o7777).toBe(NEW_FILE_MODE)
    expect((await stat(absentSemanticPath)).mode & 0o7777).toBe(NEW_FILE_MODE)
    await expectNoStageResidue(directory)
  })
})

describe('third-party notice rendering', () => {
  it('matches committed THIRD_PARTY_NOTICES.md with exact pinned versions and licenses', async () => {
    const pinned = readPinnedPackageNotices(NODE_MODULES_ROOT)
    expect(pinned.success).toBe(true)
    if (!pinned.success) {
      return
    }

    const rendered = renderThirdPartyNotices(pinned.data)
    const committed = await readFile(THIRD_PARTY_NOTICES_PATH, 'utf8')

    expect(rendered).toBe(committed)
    for (const entry of EXPECTED_STRUCTURAL_PACKAGES) {
      expect(committed).toContain(`## ${entry.name} ${entry.version}`)
      expect(committed).toContain('Source:')
    }
    expect(committed).toContain('MIT')
  })
})

describe('structural banner notice pointer', () => {
  it('points to the installed notice path and the isolated layout contains the notice file', async () => {
    const structuralText = await readFile(STRUCTURAL_VALIDATOR_PATH, 'utf8')
    expect(structuralText).toContain(
      `Third-party notices: ${STRUCTURAL_NOTICE_POINTER}`,
    )

    const layoutRoot = await createTemporaryDirectory()
    await copyInstalledFootprint(layoutRoot)
    const noticeBytes = await readFile(
      join(layoutRoot, 'THIRD_PARTY_NOTICES.md'),
    )
    const committedNotice = await readFile(THIRD_PARTY_NOTICES_PATH)
    expect(Buffer.from(noticeBytes)).toEqual(Buffer.from(committedNotice))
  })
})

describe('classifySpawnSyncResult', () => {
  it('classifies timeout, spawn error, signal, null status, buffer error, and completion', () => {
    const timeout = classifySpawnSyncResult({
      stdout: 'out',
      stderr: 'err',
      status: null,
      signal: 'SIGTERM',
      output: ['out', 'err'],
      pid: 1,
      error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
    } satisfies SpawnSyncReturns<string>)
    expect(timeout.kind).toBe('timed-out')
    if (timeout.kind === 'timed-out') {
      expect(timeout.signal).toBe('SIGTERM')
      expect(timeout.stdout).toBe('out')
      expect(timeout.stderr).toBe('err')
    }

    const spawnError = classifySpawnSyncResult({
      stdout: '',
      stderr: '',
      status: null,
      signal: null,
      output: ['', ''],
      pid: 0,
      error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }),
    } satisfies SpawnSyncReturns<string>)
    expect(spawnError.kind).toBe('spawn-error')

    const signaled = classifySpawnSyncResult({
      stdout: 'stdout',
      stderr: 'stderr',
      status: null,
      signal: 'SIGKILL',
      output: ['stdout', 'stderr'],
      pid: 2,
    })
    expect(signaled.kind).toBe('signaled')

    const nullStatus = classifySpawnSyncResult({
      stdout: '',
      stderr: '',
      status: null,
      signal: null,
      output: ['', ''],
      pid: 3,
    })
    expect(nullStatus.kind).toBe('null-status')

    const bufferError = classifySpawnSyncResult({
      stdout: 'partial',
      stderr: 'partial-err',
      status: null,
      signal: null,
      output: ['partial', 'partial-err'],
      pid: 4,
      error: Object.assign(new Error('maxBuffer exceeded'), {
        code: 'ENOBUFS',
      }),
    } satisfies SpawnSyncReturns<string>)
    expect(bufferError.kind).toBe('buffer-error')

    const completed = classifySpawnSyncResult({
      stdout: 'ok',
      stderr: '',
      status: 0,
      signal: null,
      output: ['ok', ''],
      pid: 5,
    })
    expect(completed.kind).toBe('completed')
    if (completed.kind === 'completed') {
      expect(completed.status).toBe(0)
    }
  })
})

describe('canonical producer metadata', () => {
  it('pins the expected Bun version constant used by generated banners', () => {
    expect(CANONICAL_BUN_VERSION).toBe('1.3.14')
  })
})

describe('validateSemanticBuildGraph production validator', () => {
  it('accepts the approved repository closure with missing and empty output imports', async () => {
    const fixture = await createSemanticGraphFixture()
    const missingImports = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile(),
    )
    expect(missingImports.success).toBe(true)
    if (missingImports.success) {
      expect(missingImports.data).toEqual(SORTED_APPROVED_SEMANTIC_CLOSURE)
    }

    const emptyImports = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        outputs: {
          [fixture.outputKey]: {
            ...semanticOutputRecord(metafile, fixture.outputKey),
            imports: [],
          },
        },
      })),
    )
    expect(emptyImports.success).toBe(true)
    if (emptyImports.success) {
      expect(emptyImports.data).toEqual(SORTED_APPROVED_SEMANTIC_CLOSURE)
    }
  })

  it('rejects non-empty semantic output imports with exact diagnostics', async () => {
    const fixture = await createSemanticGraphFixture()
    const hostilePath = 'node:fs\r\nwith\u0007controls'
    const sanitizedFirstPath = 'node:fs  with controls'
    const result = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        outputs: {
          [fixture.outputKey]: {
            ...semanticOutputRecord(metafile, fixture.outputKey),
            imports: [{ path: hostilePath, external: false }],
          },
        },
      })),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe(
        `semantic output retains 1 runtime import(s): metafile.outputs[${fixture.outputKey}] (first path: ${sanitizedFirstPath})`,
      )
    }
  })

  it('accepts direct-key, importer-relative, and shared-types alias edges and rejects combined closure drift', async () => {
    const fixture = await createSemanticGraphFixture()
    const shapeInvariantsPath = join(
      fixture.repositoryRoot,
      'src/features/lua-generator/utils/schema-shape-invariants.ts',
    )

    const directKeySuccess = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [shapeInvariantsPath]: {
            bytes: 1,
            imports: [{ path: fixture.approvedAbsolute, external: false }],
          },
        },
      })),
    )
    expectSemanticGraphSuccess(directKeySuccess)

    const importerRelativeSuccess = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [shapeInvariantsPath]: {
            bytes: 1,
            imports: [{ path: './effective-key.ts', external: false }],
          },
        },
      })),
    )
    expectSemanticGraphSuccess(importerRelativeSuccess)

    const sharedTypesAliasSuccess = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [shapeInvariantsPath]: {
            bytes: 1,
            imports: [{ path: '@/shared/types', external: false }],
          },
        },
      })),
    )
    expectSemanticGraphSuccess(sharedTypesAliasSuccess)

    const removedKeys = [
      join(
        fixture.repositoryRoot,
        'src/features/lua-generator/utils/effective-key.ts',
      ),
      join(fixture.repositoryRoot, 'src/shared/types/validation.ts'),
    ]
    const extraA = await fixture.addRepositoryInput('src/aaa/extra-a.ts')
    const extraZ = await fixture.addRepositoryInput('src/zzz/extra-z.ts')
    const combined = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => {
        const nextInputs = { ...metafile.inputs }
        const nextOutputInputs = {
          ...semanticOutputRecord(metafile, fixture.outputKey).inputs,
        }
        for (const key of removedKeys) {
          delete nextInputs[key]
          delete nextOutputInputs[key]
        }
        return {
          ...metafile,
          inputs: {
            ...nextInputs,
            [extraA.absolutePath]: { bytes: 1, imports: [] },
            [extraZ.absolutePath]: { bytes: 1, imports: [] },
          },
          outputs: {
            [fixture.outputKey]: {
              ...semanticOutputRecord(metafile, fixture.outputKey),
              inputs: nextOutputInputs,
            },
          },
        }
      }),
    )
    const sortedMissing = [
      'src/features/lua-generator/utils/effective-key.ts',
      'src/shared/types/validation.ts',
    ].sort((left, right) => left.localeCompare(right))
    expectSemanticGraphFailure(
      combined,
      `missing approved inputs: ${sortedMissing.join(', ')}; unexpected actual inputs: src/aaa/extra-a.ts, src/zzz/extra-z.ts`,
    )
  })

  it('rejects canonical input and output accounting drift with stable errors', async () => {
    const fixture = await createSemanticGraphFixture()

    const outsideTemp = await fixture.addOutsideTempInput('unexpected-temp.ts')
    const unexpectedTemp = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [outsideTemp.key]: { bytes: 1, imports: [] },
        },
      })),
    )
    expectSemanticGraphFailure(
      unexpectedTemp,
      `metafile input outside repository root: ${outsideTemp.key}`,
    )

    const missingOutputPath = join(
      fixture.repositoryRoot,
      'src/missing-output.ts',
    )
    const unknownOutputInput = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        outputs: {
          [fixture.outputKey]: {
            ...semanticOutputRecord(metafile, fixture.outputKey),
            inputs: {
              ...semanticOutputRecord(metafile, fixture.outputKey).inputs,
              [missingOutputPath]: {
                bytesInOutput: 1,
              },
            },
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      unknownOutputInput,
      `semantic output references unknown metafile input: ${missingOutputPath}`,
    )

    const aliasPath = await fixture.addSymlinkAlias(
      'alias/schema-validation.ts',
      fixture.approvedAbsolute,
    )
    const duplicateAlias = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [aliasPath]: { bytes: 1, imports: [] },
        },
      })),
    )
    expectSemanticGraphFailure(
      duplicateAlias,
      `metafile input keys alias the same canonical file: ${fixture.approvedAbsolute} and ${aliasPath}`,
    )

    const nonexistentKey = join(fixture.repositoryRoot, 'src/does-not-exist.ts')
    const nonexistentInput = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [nonexistentKey]: {
            bytes: 1,
            imports: [],
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      nonexistentInput,
      `metafile input does not exist: ${nonexistentKey}`,
    )
  })

  it('rejects unaccounted and unsupported importer edges with stable errors', async () => {
    const fixture = await createSemanticGraphFixture()

    const externalEdge = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [fixture.approvedAbsolute]: {
            bytes: 1,
            imports: [{ path: 'ajv', external: true }],
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      externalEdge,
      `metafile.inputs[${fixture.approvedAbsolute}] import[0] is external: ajv`,
    )

    await fixture.addRepositoryInput('src/shared/lib/untracked-neighbor.ts')
    const unaccountedRelative = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [fixture.approvedAbsolute]: {
            bytes: 1,
            imports: [{ path: './untracked-neighbor.ts', external: false }],
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      unaccountedRelative,
      `metafile.inputs[${fixture.approvedAbsolute}] import[0] is not accounted in metafile inputs: ./untracked-neighbor.ts`,
    )

    const builtinEdge = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [fixture.approvedAbsolute]: {
            bytes: 1,
            imports: [{ path: 'node:fs', external: false }],
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      builtinEdge,
      `metafile.inputs[${fixture.approvedAbsolute}] import[0]: import edge uses unsupported namespace: node:fs`,
    )

    const urlEdge = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [fixture.approvedAbsolute]: {
            bytes: 1,
            imports: [
              {
                path: 'https://example.com/module.mjs',
                external: false,
              },
            ],
          },
        },
      })),
    )
    expectSemanticGraphFailure(
      urlEdge,
      `metafile.inputs[${fixture.approvedAbsolute}] import[0]: import edge is not a filesystem path: https://example.com/module.mjs`,
    )
  })

  it('rejects canonical paths outside the repository root via symlink traps', async () => {
    const fixture = await createSemanticGraphFixture()
    const outsideFile = join(fixture.repositoryRoot, '../outside/leak.ts')
    await mkdir(join(outsideFile, '..'), { recursive: true })
    await writeFile(outsideFile, 'export const leak = 1;\n', 'utf8')
    const trapLink = join(fixture.repositoryRoot, 'src/shared/lib/trap.ts')
    await symlink(outsideFile, trapLink)

    const rejected = await runSemanticGraphValidation(
      fixture,
      fixture.buildMetafile((metafile) => ({
        ...metafile,
        inputs: {
          ...metafile.inputs,
          [trapLink]: { bytes: 1, imports: [] },
        },
      })),
    )
    expectSemanticGraphFailure(
      rejected,
      `metafile input outside repository root: ${trapLink}`,
    )
  })
})

describe('validator preflight', () => {
  it('accepts the pinned repository metadata before generation', async () => {
    const result = await runValidatorPreflight({
      repositoryRoot: REPOSITORY_ROOT,
      nodeModulesRoot: NODE_MODULES_ROOT,
      noticePath: THIRD_PARTY_NOTICES_PATH,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a self-contained fixture baseline', async () => {
    const fixture = await createPreflightFixture()
    const result = await runValidatorPreflight(fixture)
    expect(result.success).toBe(true)
  })

  it('rejects one-field drift across package manager, metadata, lock tuples, installs, and notices', async () => {
    const cases: Array<{
      label: string
      mutate: (fixture: PreflightFixture) => Promise<void>
      expectedError: string | ((fixture: PreflightFixture) => string)
    }> = [
      {
        label: 'missing packageManager',
        expectedError:
          'package.json packageManager must be bun@1.3.14, found missing',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as Record<string, unknown>
          delete packageJson['packageManager']
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong packageManager',
        expectedError:
          'package.json packageManager must be bun@1.3.14, found bun@1.3.13',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as Record<string, unknown>
          packageJson['packageManager'] = 'bun@1.3.13'
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv devDependency',
        expectedError:
          'package.json devDependencies.ajv must be exactly 8.20.0, found 8.19.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          packageJson.devDependencies['ajv'] = '8.19.0'
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv devDependency',
        expectedError:
          'package.json devDependencies.ajv must be exactly 8.20.0, found missing',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          delete packageJson.devDependencies['ajv']
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'ranged ajv devDependency',
        expectedError:
          'package.json devDependencies.ajv must be exactly 8.20.0, found ^8.20.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          packageJson.devDependencies['ajv'] = `^${AJV_VERSION}`
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv-formats devDependency',
        expectedError:
          'package.json devDependencies["ajv-formats"] must be exactly 3.0.1, found missing',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          delete packageJson.devDependencies['ajv-formats']
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv-formats devDependency',
        expectedError:
          'package.json devDependencies["ajv-formats"] must be exactly 3.0.1, found 3.0.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          packageJson.devDependencies['ajv-formats'] = '3.0.0'
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'ranged ajv-formats devDependency',
        expectedError:
          'package.json devDependencies["ajv-formats"] must be exactly 3.0.1, found ^3.0.1',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.repositoryRoot, 'package.json'),
              'utf8',
            ),
          ) as { devDependencies: Record<string, string> }
          packageJson.devDependencies['ajv-formats'] = `^${AJV_FORMATS_VERSION}`
          await writeFile(
            join(fixture.repositoryRoot, 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv lock root devDependency',
        expectedError:
          'bun.lock root devDependencies.ajv must be exactly 8.20.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            workspaces: Record<
              string,
              { devDependencies: Record<string, string> }
            >
          }
          const rootWorkspace = lock.workspaces['']
          if (!rootWorkspace) {
            throw new Error('missing root workspace')
          }
          delete rootWorkspace.devDependencies['ajv']
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv lock root devDependency',
        expectedError:
          'bun.lock root devDependencies.ajv must be exactly 8.20.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            workspaces: Record<
              string,
              { devDependencies: Record<string, string> }
            >
          }
          const rootWorkspace = lock.workspaces['']
          if (!rootWorkspace) {
            throw new Error('missing root workspace')
          }
          rootWorkspace.devDependencies['ajv'] = '8.19.0'
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv-formats lock root devDependency',
        expectedError:
          'bun.lock root devDependencies["ajv-formats"] must be exactly 3.0.1',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            workspaces: Record<
              string,
              { devDependencies: Record<string, string> }
            >
          }
          const rootWorkspace = lock.workspaces['']
          if (!rootWorkspace) {
            throw new Error('missing root workspace')
          }
          delete rootWorkspace.devDependencies['ajv-formats']
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv-formats lock root devDependency',
        expectedError:
          'bun.lock root devDependencies["ajv-formats"] must be exactly 3.0.1',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            workspaces: Record<
              string,
              { devDependencies: Record<string, string> }
            >
          }
          const rootWorkspace = lock.workspaces['']
          if (!rootWorkspace) {
            throw new Error('missing root workspace')
          }
          rootWorkspace.devDependencies['ajv-formats'] = '3.0.0'
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv lock tuple with decoy resolution',
        expectedError:
          'bun.lock packages[ajv] must resolve to ajv@8.20.0, found ajv@8.19.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          lock.packages['ajv'] = ['ajv@8.19.0', {}]
          lock.packages['decoy-ajv'] = [`ajv@${AJV_VERSION}`, {}]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'alternate ajv lock key with old tuple',
        expectedError:
          'bun.lock packages[ajv@8.19.0] must resolve to ajv@8.20.0, found ajv@8.19.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          delete lock.packages['ajv']
          lock.packages['ajv@8.19.0'] = ['ajv@8.19.0', {}]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'duplicate ajv lock keys',
        expectedError:
          'bun.lock contains duplicate relevant ajv resolution keys: ajv, ajv@8.20.0-alt',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          lock.packages[`ajv@${AJV_VERSION}-alt`] = [`ajv@${AJV_VERSION}`, {}]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv lock key',
        expectedError:
          'bun.lock is missing a relevant ajv resolution key (expected ajv@8.20.0)',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          delete lock.packages['ajv']
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv-formats lock tuple with decoy',
        expectedError:
          'bun.lock packages[ajv-formats] must resolve to ajv-formats@3.0.1, found ajv-formats@3.0.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          lock.packages['decoy-ajv-formats'] = [
            `ajv-formats@${AJV_FORMATS_VERSION}`,
            {},
          ]
          lock.packages['ajv-formats'] = ['ajv-formats@3.0.0', {}]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'alternate ajv-formats lock key with old tuple',
        expectedError:
          'bun.lock packages[ajv-formats@3.0.0] must resolve to ajv-formats@3.0.1, found ajv-formats@3.0.0',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          delete lock.packages['ajv-formats']
          lock.packages['ajv-formats@3.0.0'] = ['ajv-formats@3.0.0', {}]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'duplicate ajv-formats lock keys',
        expectedError:
          'bun.lock contains duplicate relevant ajv-formats resolution keys: ajv-formats, ajv-formats@3.0.1-alt',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          lock.packages[`ajv-formats@${AJV_FORMATS_VERSION}-alt`] = [
            `ajv-formats@${AJV_FORMATS_VERSION}`,
            {},
          ]
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv-formats lock key',
        expectedError:
          'bun.lock is missing a relevant ajv-formats resolution key (expected ajv-formats@3.0.1)',
        mutate: async (fixture) => {
          const lock = JSON.parse(
            await readFile(join(fixture.repositoryRoot, 'bun.lock'), 'utf8'),
          ) as {
            packages: Record<string, [string, Record<string, unknown>?]>
          }
          delete lock.packages['ajv-formats']
          await writeFile(
            join(fixture.repositoryRoot, 'bun.lock'),
            `${JSON.stringify(lock, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv installed package',
        expectedError: (fixture) =>
          `missing package.json at ${join(fixture.nodeModulesRoot, 'ajv')}`,
        mutate: async (fixture) => {
          await rm(join(fixture.nodeModulesRoot, 'ajv'), {
            recursive: true,
            force: true,
          })
        },
      },
      {
        label: 'wrong ajv installed package name',
        expectedError: 'installed ajv package name mismatch: not-ajv',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['name'] = 'not-ajv'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'wrong ajv installed version',
        expectedError: 'installed ajv version must be 8.20.0, found 8.19.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['version'] = '8.19.0'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'non-MIT ajv license field',
        expectedError: 'installed ajv license must be MIT, found Apache-2.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['license'] = 'Apache-2.0'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv-formats license file',
        expectedError: 'missing LICENSE for ajv-formats',
        mutate: async (fixture) => {
          await rm(join(fixture.nodeModulesRoot, 'ajv-formats', 'LICENSE'))
        },
      },
      {
        label: 'wrong ajv-formats installed version',
        expectedError:
          'installed ajv-formats version must be 3.0.1, found 3.0.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['version'] = '3.0.0'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv-formats installed package',
        expectedError: (fixture) =>
          `missing package.json at ${join(fixture.nodeModulesRoot, 'ajv-formats')}`,
        mutate: async (fixture) => {
          await rm(join(fixture.nodeModulesRoot, 'ajv-formats'), {
            recursive: true,
            force: true,
          })
        },
      },
      {
        label: 'wrong ajv-formats installed package name',
        expectedError:
          'installed ajv-formats package name mismatch: not-ajv-formats',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['name'] = 'not-ajv-formats'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'non-MIT ajv-formats license field',
        expectedError:
          'installed ajv-formats license must be MIT, found Apache-2.0',
        mutate: async (fixture) => {
          const packageJson = JSON.parse(
            await readFile(
              join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
              'utf8',
            ),
          ) as Record<string, string>
          packageJson['license'] = 'Apache-2.0'
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv-formats', 'package.json'),
            `${JSON.stringify(packageJson, null, 2)}\n`,
            'utf8',
          )
        },
      },
      {
        label: 'missing notice file',
        expectedError: (fixture) =>
          `failed to read committed notice at ${fixture.noticePath}:`,
        mutate: async (fixture) => {
          await rm(fixture.noticePath)
        },
      },
      {
        label: 'stale ajv license after notice generation',
        expectedError:
          'committed notice bytes do not match rendered third-party notices',
        mutate: async (fixture) => {
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv', 'LICENSE'),
            'changed ajv license text\n',
            'utf8',
          )
        },
      },
      {
        label: 'stale ajv-formats license after notice generation',
        expectedError:
          'committed notice bytes do not match rendered third-party notices',
        mutate: async (fixture) => {
          await writeFile(
            join(fixture.nodeModulesRoot, 'ajv-formats', 'LICENSE'),
            'changed ajv-formats license text\n',
            'utf8',
          )
        },
      },
      {
        label: 'missing ajv license',
        expectedError: 'missing LICENSE for ajv',
        mutate: async (fixture) => {
          await rm(join(fixture.nodeModulesRoot, 'ajv', 'LICENSE'))
        },
      },
      {
        label: 'stale notice bytes',
        expectedError:
          'committed notice bytes do not match rendered third-party notices',
        mutate: async (fixture) => {
          await writeFile(fixture.noticePath, 'stale notice\n', 'utf8')
        },
      },
    ]

    for (const testCase of cases) {
      const fixture = await createPreflightFixture()
      await testCase.mutate(fixture)
      const result = await runValidatorPreflight(fixture)
      expect(result.success, testCase.label).toBe(false)
      if (!result.success) {
        const expected =
          typeof testCase.expectedError === 'function'
            ? testCase.expectedError(fixture)
            : testCase.expectedError
        if (expected.endsWith(':')) {
          expect(result.error.startsWith(expected), testCase.label).toBe(true)
        } else {
          expect(result.error, testCase.label).toBe(expected)
        }
      }
    }
  })
})

describe('schema validator drift check from non-repository cwd', () => {
  it('completes when invoked via absolute builder path outside the repository', async () => {
    const outsideCwd = await createTemporaryDirectory('vinela-outside-cwd-')
    const structuralBefore = await readFile(STRUCTURAL_VALIDATOR_PATH)
    const semanticBefore = await readFile(SEMANTIC_VALIDATOR_PATH)
    const result = runDriftCheckFromCwd(outsideCwd)
    const structuralAfter = await readFile(STRUCTURAL_VALIDATOR_PATH)
    const semanticAfter = await readFile(SEMANTIC_VALIDATOR_PATH)
    expectCompleted(result)
    expect(result.status).toBe(0)
    expect(Buffer.from(structuralAfter)).toEqual(Buffer.from(structuralBefore))
    expect(Buffer.from(semanticAfter)).toEqual(Buffer.from(semanticBefore))
  }, 120_000)
})

describe('generated module AST exact namespace checks', () => {
  it('rejects missing, extra, and default exports', () => {
    const missing = validateGeneratedModuleAst('export const x = 1;', [
      'validatePluginSchemaStructure',
    ])
    const extra = validateGeneratedModuleAst(
      'export function validatePluginSchemaStructure() {}\nexport const extra = 1;',
      ['validatePluginSchemaStructure'],
    )
    const defaultExport = validateGeneratedModuleAst(
      'export default function validatePluginSchemaStructure() {}',
      ['validatePluginSchemaStructure'],
    )
    expect(missing.success).toBe(false)
    expect(extra.success).toBe(false)
    expect(defaultExport.success).toBe(false)
    if (!missing.success) {
      expect(missing.error).toContain('missing exports')
    }
    if (!extra.success) {
      expect(extra.error).toContain('unexpected exports')
    }
    if (!defaultExport.success) {
      expect(
        defaultExport.error.includes('unexpected exports') ||
          defaultExport.error.includes('missing exports'),
      ).toBe(true)
    }
  })
})

describe('plugin schema validator core — hostile diagnostic sanitization', () => {
  it('sanitizes hostile semantic code, message, and source controls into exact one-line output', () => {
    const hostileControls =
      'bad\r\nfield\u2028value\u2029tail\u0085end\u0007del'
    const structuralErrors = renderStructureErrors([
      {
        instancePath: '/',
        keyword: 'additionalProperties',
        message: 'must NOT have additional properties',
        params: { additionalProperty: hostileControls },
      },
    ])
    expect(structuralErrors).toEqual([
      'structure: / additionalProperties: must NOT have additional properties (additional property "bad  field value tail end del")',
    ])

    const semanticErrors = renderSemanticErrors([
      {
        code: 'HOST\r\nILE',
        message: 'message\rwith\ncontrols\u2028\u2029\u0085\u0001\u007f',
        source: 'source\r\npath\u2028\u2029\u0085\u0001\u007f',
      },
    ])
    expect(semanticErrors).toEqual([
      'semantic: [HOST  ILE] message with controls      (source  path     )',
    ])
  })
})

describe('plugin schema validator core — exact namespace exports', () => {
  it('rejects missing, extra, and default exports through assertExactNamespace', () => {
    const missing = assertExactNamespace(
      {},
      [...STRUCTURAL_EXPORTS],
      'structural validator',
    )
    const extra = assertExactNamespace(
      {
        validatePluginSchemaStructure: () => true,
        extraExport: 1,
      },
      [...STRUCTURAL_EXPORTS],
      'structural validator',
    )
    expect(missing.kind).toBe('internal-error')
    expect(extra.kind).toBe('internal-error')
    if (missing.kind === 'internal-error') {
      expect(missing.message).toContain('missing validatePluginSchemaStructure')
    }
    if (extra.kind === 'internal-error') {
      expect(extra.message).toBe(
        'structural validator export contract mismatch (extra extraExport)',
      )
    }

    const semanticExtra = assertExactNamespace(
      {
        LuaGenerationError: class extends Error {},
        assertSchemaShape: () => {},
        validateSchema: () => ({ valid: true }),
        extraExport: 1,
      },
      [...SEMANTIC_EXPORTS],
      'semantic validator',
    )
    expect(semanticExtra.kind).toBe('internal-error')
    if (semanticExtra.kind === 'internal-error') {
      expect(semanticExtra.message).toBe(
        'semantic validator export contract mismatch (extra extraExport)',
      )
    }
  })
})

describe('plugin schema validator core — bounded read close seam', () => {
  it('covers every bounded open/read/close path with one read-only fake handle matrix', async () => {
    type ReadBehavior = 'success' | 'oversize' | 'read-rejection'

    interface ReadRequest {
      readonly offset: number
      readonly length: number
      readonly position: number
      readonly bytesRead: number
    }

    interface BoundedReadHarness {
      readonly dependencies: ValidatorCoreDependencies
      readonly openCalls: Array<{ readonly path: string; readonly flags: 'r' }>
      readonly readRequests: ReadRequest[]
      readonly handles: BoundedReadHandle[]
      readonly closeAttempts: () => number
      readonly closeSettlements: () => number
    }

    const documentBytes = Buffer.from(JSON.stringify(minimalSchema()), 'utf8')
    const READ_SENTINEL = 'vinela-read-sentinel'
    const CLOSE_SENTINEL = 'vinela-close\r\nsentinel\u0007'
    const virtualPath = '/virtual/vinela.schema.json'

    function createHarness(
      readBehavior: ReadBehavior,
      closeError: string | null = null,
    ): BoundedReadHarness {
      const openCalls: Array<{ readonly path: string; readonly flags: 'r' }> =
        []
      const readRequests: ReadRequest[] = []
      const handles: BoundedReadHandle[] = []
      let closeAttempts = 0
      let closeSettlements = 0
      const dependencies: ValidatorCoreDependencies = {
        open: async (path, flags) => {
          openCalls.push({ path, flags })
          const handle: BoundedReadHandle = {
            async read(buffer, offset, length, position) {
              if (readBehavior === 'read-rejection') {
                readRequests.push({
                  offset,
                  length,
                  position,
                  bytesRead: 0,
                })
                throw new Error(READ_SENTINEL)
              }
              const bytesRead =
                readBehavior === 'oversize'
                  ? length
                  : Math.min(
                      length,
                      Math.max(0, documentBytes.length - position),
                    )
              if (bytesRead > 0) {
                if (readBehavior === 'oversize') {
                  buffer.fill(0x78, offset, offset + bytesRead)
                } else {
                  documentBytes.copy(
                    buffer,
                    offset,
                    position,
                    position + bytesRead,
                  )
                }
              }
              readRequests.push({ offset, length, position, bytesRead })
              return { bytesRead }
            },
            async close() {
              closeAttempts += 1
              await Promise.resolve()
              closeSettlements += 1
              if (closeError !== null) {
                throw new Error(closeError)
              }
            },
          }
          handles.push(handle)
          return handle
        },
      }
      return {
        dependencies,
        openCalls,
        readRequests,
        handles,
        closeAttempts: () => closeAttempts,
        closeSettlements: () => closeSettlements,
      }
    }

    function expectBoundedHarness(harness: BoundedReadHarness): void {
      expect(harness.openCalls).toEqual([{ path: virtualPath, flags: 'r' }])
      expect(harness.handles).toHaveLength(1)
      expect(Object.keys(harness.handles[0] ?? {}).sort()).toEqual([
        'close',
        'read',
      ])
      expect(harness.closeAttempts()).toBe(1)
      expect(harness.closeSettlements()).toBe(1)
      for (const [index, request] of harness.readRequests.entries()) {
        expect(request.offset).toBe(0)
        expect(request.length).toBeLessThanOrEqual(64 * 1024)
        expect(request.length).toBeLessThanOrEqual(
          MAX_DOCUMENT_BYTES + 1 - request.position,
        )
        expect(request.position).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES)
        if (index === 0) {
          expect(request.position).toBe(0)
        } else {
          const previous = harness.readRequests[index - 1]
          expect(previous).toBeDefined()
          expect(request.position).toBe(
            (previous?.position ?? 0) + (previous?.bytesRead ?? 0),
          )
        }
      }
    }

    const successful = createHarness('success')
    const successfulRead = await readBoundedDocument(
      virtualPath,
      successful.dependencies,
    )
    expect(successfulRead).toEqual({ kind: 'ok', bytes: documentBytes })
    expectBoundedHarness(successful)

    const oversized = createHarness('oversize')
    const oversizedRead = await readBoundedDocument(
      virtualPath,
      oversized.dependencies,
    )
    expect(oversizedRead).toEqual({ kind: 'oversize' })
    expectBoundedHarness(oversized)

    const rejected = createHarness('read-rejection')
    const rejectedRead = await readBoundedDocument(
      virtualPath,
      rejected.dependencies,
    )
    expect(rejectedRead).toEqual({
      kind: 'read-error',
      message: READ_SENTINEL,
    })
    expectBoundedHarness(rejected)

    for (const priorBehavior of [
      'success',
      'oversize',
      'read-rejection',
    ] as const) {
      const closeRejected = createHarness(priorBehavior, CLOSE_SENTINEL)
      const closeRejectedRead = await readBoundedDocument(
        virtualPath,
        closeRejected.dependencies,
      )
      expect(closeRejectedRead, priorBehavior).toEqual({
        kind: 'read-error',
        message: CLOSE_SENTINEL,
      })
      expectBoundedHarness(closeRejected)

      const orchestratedHarness = createHarness(priorBehavior, CLOSE_SENTINEL)
      const orchestrated = await runValidatorCore({
        argv: [virtualPath],
        cwd: '/virtual',
        scriptDir: SKILL_SCRIPTS_DIR,
        dependencies: orchestratedHarness.dependencies,
      })
      expect(orchestrated, priorBehavior).toEqual({
        exitCode: 2,
        stdout: '',
        stderr: 'read: vinela-close  sentinel \n',
      })
      expectBoundedHarness(orchestratedHarness)
    }

    let rejectedOpenCalls = 0
    const rejectedOpenCloseAttempts = 0
    const openRejected = await readBoundedDocument(virtualPath, {
      open: async (path, flags) => {
        rejectedOpenCalls += 1
        expect({ path, flags }).toEqual({ path: virtualPath, flags: 'r' })
        throw new Error('vinela-open-sentinel')
      },
    })
    expect(openRejected).toEqual({
      kind: 'read-error',
      message: 'vinela-open-sentinel',
    })
    expect(rejectedOpenCalls).toBe(1)
    expect(rejectedOpenCloseAttempts).toBe(0)
  })
})
