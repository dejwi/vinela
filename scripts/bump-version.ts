import { chmodSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  incrementApplicationVersion,
  parseApplicationVersion,
  readRepositoryVersions,
  replaceCargoPackageVersion,
  type Result,
  type VersionBumpKind,
  updatePackageJsonVersion,
  updateTauriConfVersion,
  validateSynchronizedApplicationVersions,
} from './lib/app-version.ts'

export type BumpIntent =
  | { mode: 'check' }
  | { mode: 'dry-run'; target: BumpTarget }
  | { mode: 'apply'; target: BumpTarget }

export type BumpTarget =
  | { kind: 'exact'; version: string }
  | { kind: 'shortcut'; bump: VersionBumpKind }

export interface VersionFileOperations {
  readFileBytes(relativePath: string): Uint8Array
  replaceFileBytes(relativePath: string, content: Uint8Array): void
}

export type BumpWorkflowResult =
  | {
      success: true
      mode: 'check' | 'dry-run' | 'apply'
      version: string
      previousVersions?: {
        packageJson: string
        tauriConf: string
        cargoToml: string
      }
      updatedPaths?: readonly string[]
    }
  | { success: false; error: string }

const MANIFEST_PATHS = [
  'package.json',
  'src-tauri/tauri.conf.json',
  'src-tauri/Cargo.toml',
] as const

type ManifestPath = (typeof MANIFEST_PATHS)[number]

export function resolveRepositoryRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return join(scriptDir, '..')
}

export function createDefaultVersionFileOperations(rootDir: string): VersionFileOperations {
  return {
    readFileBytes(relativePath: string): Uint8Array {
      return new Uint8Array(readFileSync(join(rootDir, relativePath)))
    },
    replaceFileBytes(relativePath: string, content: Uint8Array): void {
      replaceFileBytesSameDirectory(join(rootDir, relativePath), content)
    },
  }
}

export function replaceFileBytesSameDirectory(
  absolutePath: string,
  content: Uint8Array,
): void {
  const parent = dirname(absolutePath)
  const tempPath = join(
    parent,
    `.vinela-version-bump-${process.pid}-${Date.now()}.tmp`,
  )

  writeFileSync(tempPath, content)
  try {
    const mode = statSync(absolutePath).mode
    chmodSync(tempPath, mode)
  } catch {
    // Preserve default mode when the original file is missing or unreadable.
  }

  try {
    renameSync(tempPath, absolutePath)
  } catch (error) {
    try {
      unlinkSync(tempPath)
    } catch {
      // Best-effort cleanup only.
    }
    throw error
  }
}

function resolveTargetVersion(
  currentVersions: { packageJson: string; tauriConf: string; cargoToml: string },
  target: BumpTarget,
): Result<string> {
  if (target.kind === 'exact') {
    const parsed = parseApplicationVersion(target.version)
    if (!parsed.success) {
      return parsed
    }
    return { success: true, data: parsed.data.canonical }
  }

  const synchronized = validateSynchronizedApplicationVersions(currentVersions)
  if (!synchronized.success) {
    return {
      success: false,
      error: `${synchronized.error}. Shortcut bumps require synchronized manifests; pass an exact target to repair drift.`,
    }
  }

  const parsedCurrent = parseApplicationVersion(synchronized.data)
  if (!parsedCurrent.success) {
    return parsedCurrent
  }

  return incrementApplicationVersion(parsedCurrent.data, target.bump)
}

function buildNextManifestBytes(
  originals: Record<ManifestPath, Uint8Array>,
  targetVersion: string,
): Result<Record<ManifestPath, Uint8Array>> {
  const packageUpdated = updatePackageJsonVersion(originals['package.json'], targetVersion)
  if (!packageUpdated.success) {
    return packageUpdated
  }
  const tauriUpdated = updateTauriConfVersion(
    originals['src-tauri/tauri.conf.json'],
    targetVersion,
  )
  if (!tauriUpdated.success) {
    return tauriUpdated
  }

  const cargoText = new TextDecoder().decode(originals['src-tauri/Cargo.toml'])
  const cargoUpdated = replaceCargoPackageVersion(cargoText, targetVersion)
  if (!cargoUpdated.success) {
    return cargoUpdated
  }

  return {
    success: true,
    data: {
      'package.json': packageUpdated.data,
      'src-tauri/tauri.conf.json': tauriUpdated.data,
      'src-tauri/Cargo.toml': new TextEncoder().encode(cargoUpdated.data),
    },
  }
}

function readOriginalManifestBytes(
  operations: VersionFileOperations,
): Result<Record<ManifestPath, Uint8Array>> {
  const originals = {} as Record<ManifestPath, Uint8Array>
  for (const relativePath of MANIFEST_PATHS) {
    try {
      originals[relativePath] = operations.readFileBytes(relativePath)
    } catch {
      return {
        success: false,
        error: `${relativePath}: file not found or unreadable`,
      }
    }
  }
  return { success: true, data: originals }
}

export function runVersionBumpWorkflow(input: {
  rootDir: string
  intent: BumpIntent
  operations?: VersionFileOperations
}): BumpWorkflowResult {
  const operations = input.operations ?? createDefaultVersionFileOperations(input.rootDir)
  const currentVersions = readRepositoryVersions(input.rootDir, operations)
  if (!currentVersions.success) {
    return { success: false, error: currentVersions.error }
  }

  if (input.intent.mode === 'check') {
    const synchronized = validateSynchronizedApplicationVersions(currentVersions.data)
    if (!synchronized.success) {
      return {
        success: false,
        error: `${synchronized.error}\nObserved versions: package.json=${currentVersions.data.packageJson}, tauri.conf.json=${currentVersions.data.tauriConf}, Cargo.toml=${currentVersions.data.cargoToml}`,
      }
    }
    return {
      success: true,
      mode: 'check',
      version: synchronized.data,
    }
  }

  const targetResult = resolveTargetVersion(currentVersions.data, input.intent.target)
  if (!targetResult.success) {
    return { success: false, error: targetResult.error }
  }

  const targetVersion = targetResult.data
  const alreadySynchronized =
    currentVersions.data.packageJson === targetVersion &&
    currentVersions.data.tauriConf === targetVersion &&
    currentVersions.data.cargoToml === targetVersion

  if (alreadySynchronized) {
    return {
      success: true,
      mode: input.intent.mode,
      version: targetVersion,
      previousVersions: currentVersions.data,
      updatedPaths: [...MANIFEST_PATHS],
    }
  }

  const originals = readOriginalManifestBytes(operations)
  if (!originals.success) {
    return { success: false, error: originals.error }
  }

  const nextBytes = buildNextManifestBytes(originals.data, targetVersion)
  if (!nextBytes.success) {
    return { success: false, error: nextBytes.error }
  }

  const reparsed = parseApplicationVersion(targetVersion)
  if (!reparsed.success) {
    return { success: false, error: reparsed.error }
  }

  if (input.intent.mode === 'dry-run') {
    return {
      success: true,
      mode: 'dry-run',
      version: targetVersion,
      previousVersions: currentVersions.data,
      updatedPaths: [...MANIFEST_PATHS],
    }
  }

  const rollbackFailures: string[] = []
  let mutationStarted = false
  let primaryError: string | undefined

  try {
    mutationStarted = true
    for (const relativePath of MANIFEST_PATHS) {
      operations.replaceFileBytes(relativePath, nextBytes.data[relativePath])
    }

    const verified = readRepositoryVersions(input.rootDir, operations)
    if (!verified.success) {
      throw new Error(`Post-write verification read failed: ${verified.error}`)
    }

    const consistency = validateSynchronizedApplicationVersions(verified.data)
    if (!consistency.success) {
      throw new Error(`Post-write verification failed: ${consistency.error}`)
    }
  } catch (error) {
    primaryError = error instanceof Error ? error.message : String(error)

    for (const relativePath of MANIFEST_PATHS) {
      try {
        operations.replaceFileBytes(relativePath, originals.data[relativePath])
      } catch (rollbackError) {
        const message =
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        rollbackFailures.push(`${relativePath}: ${message}`)
      }
    }

    const rollbackHint =
      'Run `bun run version:bump --check` and inspect the listed manifest files.'
    if (rollbackFailures.length > 0) {
      return {
        success: false,
        error: `${primaryError}\nRollback failures:\n- ${rollbackFailures.join('\n- ')}\n${rollbackHint}`,
      }
    }

    return {
      success: false,
      error: `${primaryError}\n${rollbackHint}`,
    }
  }

  if (!mutationStarted) {
    return { success: false, error: 'Internal error: mutation did not start' }
  }

  return {
    success: true,
    mode: 'apply',
    version: targetVersion,
    previousVersions: currentVersions.data,
    updatedPaths: [...MANIFEST_PATHS],
  }
}

export function printUsage(): void {
  console.log(`Usage:
  bun run version:bump <patch|minor|major|VERSION>
  bun run version:bump --check
  bun run version:bump <patch|minor|major|VERSION> --dry-run`)
}

export function parseCliArgs(argv: string[]): Result<BumpIntent> {
  const args = argv.filter((arg) => arg.length > 0)
  const hasCheck = args.includes('--check')
  const hasDryRun = args.includes('--dry-run')
  const positionals = args.filter((arg) => !arg.startsWith('--'))

  if (args.some((arg) => arg.startsWith('--') && arg !== '--check' && arg !== '--dry-run')) {
    return { success: false, error: 'Unknown flag. Use --check or --dry-run only.' }
  }

  if (hasCheck) {
    if (hasDryRun || positionals.length > 0) {
      return {
        success: false,
        error: '--check is mutually exclusive with a target and --dry-run.',
      }
    }
    return { success: true, data: { mode: 'check' } }
  }

  if (positionals.length !== 1) {
    return {
      success: false,
      error: 'Expected exactly one target: patch, minor, major, or an exact version.',
    }
  }

  const targetArg = positionals[0] ?? ''
  const target: BumpTarget =
    targetArg === 'patch' || targetArg === 'minor' || targetArg === 'major'
      ? { kind: 'shortcut', bump: targetArg }
      : { kind: 'exact', version: targetArg }

  if (hasDryRun) {
    return { success: true, data: { mode: 'dry-run', target } }
  }

  return { success: true, data: { mode: 'apply', target } }
}

export function formatWorkflowSuccess(result: Extract<BumpWorkflowResult, { success: true }>): string {
  const lines = [`Version: ${result.version}`]

  if (result.previousVersions !== undefined) {
    lines.push(
      `Previous versions: package.json=${result.previousVersions.packageJson}, tauri.conf.json=${result.previousVersions.tauriConf}, Cargo.toml=${result.previousVersions.cargoToml}`,
    )
  }

  if (result.updatedPaths !== undefined) {
    lines.push(`Updated files:\n${result.updatedPaths.map((path) => `- ${path}`).join('\n')}`)
  }

  if (result.mode === 'dry-run') {
    lines.unshift('Dry run (no files changed):')
  }

  return lines.join('\n')
}

function main(argv: string[]): number {
  const parsed = parseCliArgs(argv)
  if (!parsed.success) {
    printUsage()
    console.error(parsed.error)
    return 1
  }

  const result = runVersionBumpWorkflow({
    rootDir: resolveRepositoryRoot(),
    intent: parsed.data,
  })

  if (!result.success) {
    console.error(result.error)
    return 1
  }

  console.log(formatWorkflowSuccess(result))
  return 0
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)))
}
