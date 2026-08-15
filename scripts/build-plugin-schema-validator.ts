import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import standaloneCode from 'ajv/dist/standalone/index.js'
import addFormats from 'ajv-formats'
import type { BunPlugin } from 'bun'
import {
  AJV_FORMATS_VERSION,
  AJV_VERSION,
  APPROVED_SEMANTIC_INPUTS,
  type BunMetafile,
  CANONICAL_BUN_VERSION,
  classifyMetafileInput,
  commitValidatorArtifactPair,
  compareStructuralPackageSets,
  computeClosureDigest,
  createSemanticBanner,
  createStructuralBanner,
  EXPECTED_STRUCTURAL_PACKAGES,
  ensureEsmNamedExports,
  extractStructuralPackageIdentities,
  normalizeGeneratedModuleText,
  parseBunMetafile,
  type Result,
  rejectPathLeaks,
  runValidatorPreflight,
  SCHEMA_VALIDATOR_BUILD_COMMAND,
  SEMANTIC_AUTHORITY_PATHS,
  SEMANTIC_FORBIDDEN_MARKERS,
  SEMANTIC_VALIDATOR_RELATIVE_PATH,
  STRUCTURAL_CONTRACT_PATH,
  STRUCTURAL_NOTICE_POINTER,
  STRUCTURAL_VALIDATOR_RELATIVE_PATH,
  sha256Hex,
  stripBundlerArtifactComments,
  THIRD_PARTY_NOTICES_RELATIVE_PATH,
  validateCandidateModuleRuntimeNamespace,
  validateGeneratedModuleAst,
  validateSemanticBuildGraph,
} from './plugin-schema-validator-build-support.ts'

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const NODE_MODULES_ROOT = path.join(REPOSITORY_ROOT, 'node_modules')
const STRUCTURAL_STABLE_KEY = 'plugin-schema-contract'
const TEMP_SEMANTIC_ENTRY = 'semantic-entry.ts'
const TEMP_SHARED_TYPES_ADAPTER = 'shared-types-adapter.ts'
const TEMP_STRUCTURAL_ENTRY = 'structural-entry.mjs'

interface GeneratedValidatorSet {
  readonly structuralBytes: Uint8Array
  readonly semanticBytes: Uint8Array
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function okResult<T>(data: T): Result<T> {
  return { success: true, data }
}

async function withRepositoryWorkingDirectory<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previousWorkingDirectory = process.cwd()
  process.chdir(REPOSITORY_ROOT)
  try {
    return await operation()
  } finally {
    process.chdir(previousWorkingDirectory)
  }
}

function verifyBunVersion(): void {
  const actual = process.versions['bun']
  if (actual !== CANONICAL_BUN_VERSION) {
    fail(
      `expected Bun ${CANONICAL_BUN_VERSION}, found ${actual ?? 'unknown (not running under Bun)'}`,
    )
  }
  const packageJson = JSON.parse(
    readFileSync(path.join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  ) as { packageManager?: string }
  if (packageJson.packageManager !== `bun@${CANONICAL_BUN_VERSION}`) {
    fail(`package.json packageManager must be bun@${CANONICAL_BUN_VERSION}`)
  }
}

function createSharedTypesAdapterSource(repositoryRoot: string): string {
  const schemaTypes = path.join(repositoryRoot, 'src/shared/types/schema.ts')
  const validationTypes = path.join(
    repositoryRoot,
    'src/shared/types/validation.ts',
  )
  const runFunctionTypes = path.join(
    repositoryRoot,
    'src/shared/types/run-function.ts',
  )
  return `export { PLUGIN_CATEGORIES } from '${schemaTypes}';
export { createError, validationFailure, validationSuccess } from '${validationTypes}';
export type { PluginCategory, PluginConfigValue, PluginSchema, PortDataType, SchemaJsonValue, SchemaMappingTableColumn, SchemaMappingTableOption, SchemaOption, SchemaOptionType, ValidationError, ValidationResult, ValidationWarning } from '${schemaTypes}';
export type { RunFunctionDefaultValue, RunFunctionParamSignature } from '${runFunctionTypes}';
`
}

function createSemanticEntrySource(repositoryRoot: string): string {
  const schemaValidation = path.join(
    repositoryRoot,
    'src/shared/lib/schema-validation.ts',
  )
  const shapeInvariants = path.join(
    repositoryRoot,
    'src/features/lua-generator/utils/schema-shape-invariants.ts',
  )
  return `export { validateSchema } from '${schemaValidation}';
export { assertSchemaShape, LuaGenerationError } from '${shapeInvariants}';
`
}

function createNarrowSharedTypesPlugin(adapterPath: string): BunPlugin {
  return {
    name: 'narrow-shared-types',
    setup(build) {
      build.onResolve({ filter: /^@\/shared\/types$/ }, () => ({
        path: adapterPath,
      }))
      build.onResolve({ filter: /^@\/shared\/types\/index\.ts$/ }, () => ({
        path: adapterPath,
      }))
    },
  }
}

async function compileStructuralStandaloneSource(): Promise<string> {
  const contractPath = path.join(REPOSITORY_ROOT, STRUCTURAL_CONTRACT_PATH)
  const schema = JSON.parse(readFileSync(contractPath, 'utf8')) as object
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    validateFormats: true,
    allowUnionTypes: true,
    code: { source: true, esm: true, lines: true },
  })
  addFormats(ajv)
  ajv.addSchema(schema, STRUCTURAL_STABLE_KEY)
  return standaloneCode(ajv, {
    validatePluginSchemaStructure: STRUCTURAL_STABLE_KEY,
  })
}

function validateStructuralMetafilePackages(
  metafile: BunMetafile,
  repositoryRoot: string,
  tempStructuralEntryRealPath: string,
): Result<undefined> {
  const tempPaths = new Set([tempStructuralEntryRealPath])
  const actualPackages = extractStructuralPackageIdentities(
    metafile.inputs,
    repositoryRoot,
    NODE_MODULES_ROOT,
  )
  if (!actualPackages.success) {
    return actualPackages
  }
  const comparison = compareStructuralPackageSets(
    actualPackages.data,
    EXPECTED_STRUCTURAL_PACKAGES,
  )
  if (!comparison.equal) {
    const missing =
      comparison.missing.length > 0
        ? `missing noticed packages: ${comparison.missing.join(', ')}`
        : ''
    const extra =
      comparison.extra.length > 0
        ? `unexpected bundled packages: ${comparison.extra.join(', ')}`
        : ''
    return {
      success: false,
      error: [missing, extra].filter((entry) => entry.length > 0).join('; '),
    }
  }
  for (const inputKey of Object.keys(metafile.inputs)) {
    const classification = classifyMetafileInput(
      inputKey,
      repositoryRoot,
      tempPaths,
    )
    if (classification === 'temp-excluded' || classification === 'package') {
      continue
    }
    return {
      success: false,
      error: `unexpected structural metafile input ${inputKey} (${classification})`,
    }
  }
  return okResult(undefined)
}

async function validateGeneratedModule(
  label: string,
  bytes: Uint8Array,
  expectedExports: readonly string[],
  forbiddenMarkers: readonly string[],
  workspace: string,
): Promise<Result<undefined>> {
  const text = new TextDecoder().decode(bytes)
  const pathLeak = rejectPathLeaks(text, [
    REPOSITORY_ROOT,
    'file://',
    'sourceMappingURL',
  ])
  if (!pathLeak.success) {
    return pathLeak
  }
  for (const marker of forbiddenMarkers) {
    if (text.includes(marker)) {
      return {
        success: false,
        error: `${label} contains forbidden marker ${marker}`,
      }
    }
  }
  const ast = validateGeneratedModuleAst(text, expectedExports)
  if (!ast.success) {
    return ast
  }
  const candidatePath = path.join(workspace, `${label}.candidate.mjs`)
  await fs.writeFile(candidatePath, bytes)
  const runtime = validateCandidateModuleRuntimeNamespace(
    candidatePath,
    expectedExports,
  )
  if (!runtime.success) {
    return runtime
  }
  return okResult(undefined)
}

async function buildStructuralCandidate(
  workspace: string,
  contractSha256: string,
): Promise<Result<Uint8Array>> {
  const standaloneSource = await compileStructuralStandaloneSource()
  const entryPath = path.join(workspace, TEMP_STRUCTURAL_ENTRY)
  writeFileSync(entryPath, standaloneSource, 'utf8')
  try {
    symlinkSync(NODE_MODULES_ROOT, path.join(workspace, 'node_modules'), 'dir')
  } catch {
    // junction/symlink may already exist in reused workspace
  }
  const buildResult = await Bun.build({
    entrypoints: [entryPath],
    target: 'node',
    format: 'esm',
    packages: 'bundle',
    splitting: false,
    minify: false,
    sourcemap: 'none',
    metafile: true,
    outdir: path.join(workspace, 'structural-out'),
    root: workspace,
  })
  if (!buildResult.success) {
    const logs = buildResult.logs.map((entry) => String(entry)).join('\n')
    return { success: false, error: `structural Bun.build failed: ${logs}` }
  }
  if (buildResult.outputs.length !== 1) {
    return {
      success: false,
      error: 'structural Bun.build must emit exactly one output',
    }
  }
  if (!buildResult.metafile) {
    return { success: false, error: 'structural Bun.build missing metafile' }
  }
  const parsedMetafile = parseBunMetafile(buildResult.metafile)
  if (!parsedMetafile.success) {
    return parsedMetafile
  }
  const packageValidation = validateStructuralMetafilePackages(
    parsedMetafile.data,
    REPOSITORY_ROOT,
    realpathSync(entryPath),
  )
  if (!packageValidation.success) {
    return packageValidation
  }
  const structuralOutput = buildResult.outputs[0]
  if (!structuralOutput) {
    return {
      success: false,
      error: 'structural Bun.build missing output artifact',
    }
  }
  const body = normalizeGeneratedModuleText(
    ensureEsmNamedExports(
      stripBundlerArtifactComments(await structuralOutput.text()),
      ['validatePluginSchemaStructure'],
    ),
  )
  const banner = createStructuralBanner({
    contractPath: STRUCTURAL_CONTRACT_PATH,
    contractSha256,
    buildCommand: SCHEMA_VALIDATOR_BUILD_COMMAND,
    bunVersion: CANONICAL_BUN_VERSION,
    ajvVersion: AJV_VERSION,
    ajvFormatsVersion: AJV_FORMATS_VERSION,
  })
  if (!body.includes('validatePluginSchemaStructure')) {
    return {
      success: false,
      error: 'structural output missing validatePluginSchemaStructure export',
    }
  }
  if (!banner.includes(STRUCTURAL_NOTICE_POINTER)) {
    return { success: false, error: 'structural banner missing notice pointer' }
  }
  const combined = normalizeGeneratedModuleText(`${banner}${body}`)
  const moduleValidation = await validateGeneratedModule(
    'structural-validator.generated.mjs',
    new TextEncoder().encode(combined),
    ['validatePluginSchemaStructure'],
    [],
    workspace,
  )
  if (!moduleValidation.success) {
    return moduleValidation
  }
  return okResult(new TextEncoder().encode(combined))
}

async function buildSemanticCandidate(
  workspace: string,
  schemaValidationSha256: string,
  shapeInvariantsSha256: string,
): Promise<Result<Uint8Array>> {
  const adapterPath = path.join(workspace, TEMP_SHARED_TYPES_ADAPTER)
  const entryPath = path.join(workspace, TEMP_SEMANTIC_ENTRY)
  writeFileSync(
    adapterPath,
    createSharedTypesAdapterSource(REPOSITORY_ROOT),
    'utf8',
  )
  writeFileSync(entryPath, createSemanticEntrySource(REPOSITORY_ROOT), 'utf8')
  const buildResult = await Bun.build({
    entrypoints: [entryPath],
    target: 'node',
    format: 'esm',
    packages: 'bundle',
    splitting: false,
    minify: false,
    sourcemap: 'none',
    metafile: true,
    outdir: path.join(workspace, 'semantic-out'),
    root: workspace,
    tsconfig: path.join(REPOSITORY_ROOT, 'tsconfig.json'),
    plugins: [createNarrowSharedTypesPlugin(adapterPath)],
  })
  if (!buildResult.success) {
    const logs = buildResult.logs.map((entry) => String(entry)).join('\n')
    return { success: false, error: `semantic Bun.build failed: ${logs}` }
  }
  if (buildResult.outputs.length !== 1) {
    return {
      success: false,
      error: 'semantic Bun.build must emit exactly one output',
    }
  }
  if (!buildResult.metafile) {
    return { success: false, error: 'semantic Bun.build missing metafile' }
  }
  const parsedMetafile = parseBunMetafile(buildResult.metafile)
  if (!parsedMetafile.success) {
    return parsedMetafile
  }
  const closure = await validateSemanticBuildGraph({
    metafile: parsedMetafile.data,
    buildRoot: REPOSITORY_ROOT,
    repositoryRoot: REPOSITORY_ROOT,
    semanticEntryPath: entryPath,
    sharedTypesAdapterPath: adapterPath,
    approvedRepositoryInputs: APPROVED_SEMANTIC_INPUTS,
  })
  if (!closure.success) {
    return closure
  }
  const digest = await computeClosureDigest(REPOSITORY_ROOT, closure.data)
  if (!digest.success) {
    return digest
  }
  const semanticOutput = buildResult.outputs[0]
  if (!semanticOutput) {
    return {
      success: false,
      error: 'semantic Bun.build missing output artifact',
    }
  }
  const body = normalizeGeneratedModuleText(
    stripBundlerArtifactComments(await semanticOutput.text()),
  )
  const banner = createSemanticBanner({
    schemaValidationSha256,
    shapeInvariantsSha256,
    closureDigest: digest.data,
    buildCommand: SCHEMA_VALIDATOR_BUILD_COMMAND,
    bunVersion: CANONICAL_BUN_VERSION,
  })
  const combined = normalizeGeneratedModuleText(`${banner}${body}`)
  const moduleValidation = await validateGeneratedModule(
    'semantic-validator.generated.mjs',
    new TextEncoder().encode(combined),
    ['validateSchema', 'assertSchemaShape', 'LuaGenerationError'],
    SEMANTIC_FORBIDDEN_MARKERS,
    workspace,
  )
  if (!moduleValidation.success) {
    return moduleValidation
  }
  return okResult(new TextEncoder().encode(combined))
}

async function generateValidatorSet(): Promise<Result<GeneratedValidatorSet>> {
  const contractBytes = await fs.readFile(
    path.join(REPOSITORY_ROOT, STRUCTURAL_CONTRACT_PATH),
  )
  const contractSha256 = sha256Hex(new Uint8Array(contractBytes))
  const schemaValidationBytes = await fs.readFile(
    path.join(REPOSITORY_ROOT, SEMANTIC_AUTHORITY_PATHS.schemaValidation),
  )
  const shapeInvariantsBytes = await fs.readFile(
    path.join(REPOSITORY_ROOT, SEMANTIC_AUTHORITY_PATHS.shapeInvariants),
  )
  const schemaValidationSha256 = sha256Hex(
    new Uint8Array(schemaValidationBytes),
  )
  const shapeInvariantsSha256 = sha256Hex(new Uint8Array(shapeInvariantsBytes))
  const workspace = mkdtempSync(path.join(tmpdir(), 'vinela-validator-build-'))
  try {
    return await withRepositoryWorkingDirectory(async () => {
      const structural = await buildStructuralCandidate(
        workspace,
        contractSha256,
      )
      if (!structural.success) {
        return structural
      }
      const semantic = await buildSemanticCandidate(
        workspace,
        schemaValidationSha256,
        shapeInvariantsSha256,
      )
      if (!semantic.success) {
        return semantic
      }
      return okResult({
        structuralBytes: structural.data,
        semanticBytes: semantic.data,
      })
    })
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

async function readFileBytesIfExists(
  filePath: string,
): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await fs.readFile(filePath))
  } catch {
    return null
  }
}

async function runPreflight(): Promise<void> {
  const noticePath = path.join(
    REPOSITORY_ROOT,
    THIRD_PARTY_NOTICES_RELATIVE_PATH,
  )
  const preflight = await runValidatorPreflight({
    repositoryRoot: REPOSITORY_ROOT,
    nodeModulesRoot: NODE_MODULES_ROOT,
    noticePath,
  })
  if (!preflight.success) {
    fail(preflight.error)
  }
}

async function runCheckMode(): Promise<void> {
  await runPreflight()
  const setA = await generateValidatorSet()
  if (!setA.success) {
    fail(setA.error)
  }
  const setB = await generateValidatorSet()
  if (!setB.success) {
    fail(setB.error)
  }
  if (
    !bytesEqual(setA.data.structuralBytes, setB.data.structuralBytes) ||
    !bytesEqual(setA.data.semanticBytes, setB.data.semanticBytes)
  ) {
    fail('dual generation produced nondeterministic validator bytes')
  }
  const structuralPath = path.join(
    REPOSITORY_ROOT,
    STRUCTURAL_VALIDATOR_RELATIVE_PATH,
  )
  const semanticPath = path.join(
    REPOSITORY_ROOT,
    SEMANTIC_VALIDATOR_RELATIVE_PATH,
  )
  const committedStructural = await readFileBytesIfExists(structuralPath)
  const committedSemantic = await readFileBytesIfExists(semanticPath)
  const stale: string[] = []
  if (
    committedStructural === null ||
    !bytesEqual(committedStructural, setA.data.structuralBytes)
  ) {
    stale.push(STRUCTURAL_VALIDATOR_RELATIVE_PATH)
  }
  if (
    committedSemantic === null ||
    !bytesEqual(committedSemantic, setA.data.semanticBytes)
  ) {
    stale.push(SEMANTIC_VALIDATOR_RELATIVE_PATH)
  }
  if (stale.length > 0) {
    fail(`stale or missing generated artifacts: ${stale.join(', ')}`)
  }
}

async function runBuildMode(): Promise<void> {
  await runPreflight()
  const generated = await generateValidatorSet()
  if (!generated.success) {
    fail(generated.error)
  }
  const structuralPath = path.join(
    REPOSITORY_ROOT,
    STRUCTURAL_VALIDATOR_RELATIVE_PATH,
  )
  const semanticPath = path.join(
    REPOSITORY_ROOT,
    SEMANTIC_VALIDATOR_RELATIVE_PATH,
  )
  const commit = await commitValidatorArtifactPair({
    structural: {
      destinationPath: structuralPath,
      candidateBytes: generated.data.structuralBytes,
    },
    semantic: {
      destinationPath: semanticPath,
      candidateBytes: generated.data.semanticBytes,
    },
  })
  if (commit.outcome === 'failed') {
    const parts = [
      `${commit.primaryFailure.step}: ${commit.primaryFailure.error}`,
      `rollback: ${commit.rollbackOutcome.success ? 'ok' : commit.rollbackOutcome.error}`,
      `verification: ${commit.verificationOutcome.success ? 'ok' : commit.verificationOutcome.error}`,
      `cleanup: ${commit.cleanupOutcome.success ? 'ok' : commit.cleanupOutcome.error}`,
    ]
    fail(
      `validator artifact commit failed; manual recovery may be required\n${parts.join('\n')}`,
    )
  }
  const changed: string[] = []
  if (commit.structuralChanged) {
    changed.push(STRUCTURAL_VALIDATOR_RELATIVE_PATH)
  }
  if (commit.semanticChanged) {
    changed.push(SEMANTIC_VALIDATOR_RELATIVE_PATH)
  }
  if (changed.length === 0) {
    console.log('validator artifacts already up to date')
    return
  }
  console.log(`updated: ${changed.join(', ')}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    fail('usage: bun run scripts/build-plugin-schema-validator.ts [--check]')
  }
  verifyBunVersion()
  if (args[0] === '--check') {
    await runCheckMode()
    return
  }
  await runBuildMode()
}

await main()
