import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Result<T> = { success: true; data: T } | { success: false; error: string }

export const U64_MAX = 18446744073709551615n
export const U64_MAX_STRING = '18446744073709551615'

export type CoreComponent = 'major' | 'minor' | 'patch'

export type ParsedApplicationVersion = {
  major: string
  minor: string
  patch: string
  prerelease: string | undefined
  build: string | undefined
  canonical: string
}

export type VersionBumpKind = 'patch' | 'minor' | 'major'

export interface RepositoryVersions {
  packageJson: string
  tauriConf: string
  cargoToml: string
}

export interface VersionFileReadOperations {
  readFileBytes(relativePath: string): Uint8Array
}

const CORE_IDENTIFIER_PATTERN = /^(0|[1-9][0-9]*)$/
const IDENTIFIER_PATTERN = /^[0-9A-Za-z-]+$/

export function ok<T>(data: T): Result<T> {
  return { success: true, data }
}

export function err<T>(error: string): Result<T> {
  return { success: false, error }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateCoreComponent(
  value: string,
  component: CoreComponent,
): Result<string> {
  if (!CORE_IDENTIFIER_PATTERN.test(value)) {
    return err(
      `Invalid ${component} identifier "${value}": must be 0 or a non-zero-leading decimal integer`,
    )
  }

  const numeric = BigInt(value)
  if (numeric > U64_MAX) {
    return err(
      `${component} component ${value} exceeds Cargo/Tauri maximum ${U64_MAX_STRING}`,
    )
  }

  return ok(value)
}

function validatePrereleaseIdentifiers(prerelease: string): Result<string> {
  if (prerelease.length === 0) {
    return err('Prerelease metadata must not be empty')
  }

  const identifiers = prerelease.split('.')
  for (const identifier of identifiers) {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      return err(`Invalid prerelease identifier "${identifier}"`)
    }
    if (/^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0')) {
      return err(`Numeric prerelease identifier "${identifier}" must not have leading zeros`)
    }
  }

  return ok(prerelease)
}

function validateBuildIdentifiers(build: string): Result<string> {
  if (build.length === 0) {
    return err('Build metadata must not be empty')
  }

  const identifiers = build.split('.')
  for (const identifier of identifiers) {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      return err(`Invalid build identifier "${identifier}"`)
    }
  }

  return ok(build)
}

export function parseApplicationVersion(input: string): Result<ParsedApplicationVersion> {
  if (input !== input.trim()) {
    return err('Version must not contain leading or trailing whitespace')
  }
  if (input.startsWith('v')) {
    return err('Version must not start with a leading v prefix')
  }

  const match =
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      input,
    )
  if (match === null) {
    return err(`Version "${input}" is not valid Cargo/Tauri-compatible SemVer syntax`)
  }

  const major = match[1] ?? ''
  const minor = match[2] ?? ''
  const patch = match[3] ?? ''
  const prerelease = match[4]
  const build = match[5]

  const majorResult = validateCoreComponent(major, 'major')
  if (!majorResult.success) {
    return majorResult
  }
  const minorResult = validateCoreComponent(minor, 'minor')
  if (!minorResult.success) {
    return minorResult
  }
  const patchResult = validateCoreComponent(patch, 'patch')
  if (!patchResult.success) {
    return patchResult
  }

  if (prerelease !== undefined) {
    const prereleaseResult = validatePrereleaseIdentifiers(prerelease)
    if (!prereleaseResult.success) {
      return prereleaseResult
    }
  }

  if (build !== undefined) {
    const buildResult = validateBuildIdentifiers(build)
    if (!buildResult.success) {
      return buildResult
    }
  }

  return ok({
    major,
    minor,
    patch,
    prerelease,
    build,
    canonical: input,
  })
}

export function formatStableApplicationVersion(parsed: ParsedApplicationVersion): string {
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`
}

export function incrementApplicationVersion(
  current: ParsedApplicationVersion,
  kind: VersionBumpKind,
): Result<string> {
  if (current.prerelease !== undefined || current.build !== undefined) {
    return err(
      `Cannot apply ${kind} shortcut to version "${current.canonical}" with prerelease or build metadata; pass an exact target instead`,
    )
  }

  const major = BigInt(current.major)
  const minor = BigInt(current.minor)
  const patch = BigInt(current.patch)

  let nextMajor = major
  let nextMinor = minor
  let nextPatch = patch

  if (kind === 'patch') {
    nextPatch += 1n
  } else if (kind === 'minor') {
    nextMinor += 1n
    nextPatch = 0n
  } else {
    nextMajor += 1n
    nextMinor = 0n
    nextPatch = 0n
  }

  const component =
    kind === 'patch' ? 'patch' : kind === 'minor' ? 'minor' : 'major'
  const nextValue = kind === 'patch' ? nextPatch : kind === 'minor' ? nextMinor : nextMajor
  if (nextValue > U64_MAX) {
    return err(
      `${kind} increment from ${current.canonical} would overflow ${component} beyond Cargo/Tauri maximum ${U64_MAX_STRING}`,
    )
  }

  return ok(`${nextMajor.toString()}.${nextMinor.toString()}.${nextPatch.toString()}`)
}

function readJsonRootVersion(
  fileLabel: string,
  bytes: Uint8Array,
): Result<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return err(`${fileLabel}: malformed JSON`)
  }

  if (!isRecord(parsed)) {
    return err(`${fileLabel}: root JSON value must be an object`)
  }

  const version = parsed['version']
  if (typeof version !== 'string') {
    return err(`${fileLabel}: root "version" must be a string`)
  }

  return ok(version)
}

export function locateCargoPackageVersion(
  cargoToml: string,
): Result<{ start: number; end: number; version: string }> {
  const lines = cargoToml.split('\n')
  let inPackageSection = false
  let packageSectionCount = 0
  let matchCount = 0
  let located:
    | {
        lineIndex: number
        start: number
        end: number
        version: string
      }
    | undefined

  let offset = 0
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? ''
    const trimmed = line.trim()

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const sectionName = trimmed.slice(1, -1).trim()
      inPackageSection = sectionName === 'package'
      if (inPackageSection) {
        packageSectionCount += 1
      }
    } else if (inPackageSection) {
      const versionMatch = /^version\s*=\s*"([^"]*)"\s*$/.exec(trimmed)
      if (versionMatch !== null) {
        matchCount += 1
        const version = versionMatch[1] ?? ''
        const valueStart = line.indexOf('"') + 1
        const valueEnd = valueStart + version.length
        located = {
          lineIndex,
          start: offset + valueStart,
          end: offset + valueEnd,
          version,
        }
      }
    }

    offset += line.length + 1
  }

  if (packageSectionCount === 0) {
    return err('src-tauri/Cargo.toml: missing [package] section')
  }
  if (packageSectionCount > 1) {
    return err('src-tauri/Cargo.toml: duplicate [package] sections are not supported')
  }
  if (matchCount === 0) {
    return err('src-tauri/Cargo.toml: missing [package].version assignment')
  }
  if (matchCount > 1) {
    return err('src-tauri/Cargo.toml: duplicate [package].version assignments')
  }
  if (located === undefined) {
    return err('src-tauri/Cargo.toml: could not locate [package].version assignment')
  }

  return ok({
    start: located.start,
    end: located.end,
    version: located.version,
  })
}

export function replaceCargoPackageVersion(cargoToml: string, nextVersion: string): Result<string> {
  const located = locateCargoPackageVersion(cargoToml)
  if (!located.success) {
    return located
  }

  const updated =
    cargoToml.slice(0, located.data.start) +
    nextVersion +
    cargoToml.slice(located.data.end)

  return ok(updated)
}

function readFileBytesFromRoot(
  rootDir: string,
  relativePath: string,
  operations?: VersionFileReadOperations,
): Uint8Array {
  if (operations !== undefined) {
    return operations.readFileBytes(relativePath)
  }
  return new Uint8Array(readFileSync(join(rootDir, relativePath)))
}

export function readRepositoryVersions(
  rootDir: string,
  operations?: VersionFileReadOperations,
): Result<RepositoryVersions> {
  const paths = {
    packageJson: 'package.json',
    tauriConf: 'src-tauri/tauri.conf.json',
    cargoToml: 'src-tauri/Cargo.toml',
  } as const

  let packageBytes: Uint8Array
  let tauriBytes: Uint8Array
  let cargoBytes: Uint8Array

  try {
    packageBytes = readFileBytesFromRoot(rootDir, paths.packageJson, operations)
  } catch {
    return err('package.json: file not found or unreadable')
  }
  try {
    tauriBytes = readFileBytesFromRoot(rootDir, paths.tauriConf, operations)
  } catch {
    return err('src-tauri/tauri.conf.json: file not found or unreadable')
  }
  try {
    cargoBytes = readFileBytesFromRoot(rootDir, paths.cargoToml, operations)
  } catch {
    return err('src-tauri/Cargo.toml: file not found or unreadable')
  }

  const packageVersion = readJsonRootVersion('package.json', packageBytes)
  if (!packageVersion.success) {
    return packageVersion
  }
  const tauriVersion = readJsonRootVersion('src-tauri/tauri.conf.json', tauriBytes)
  if (!tauriVersion.success) {
    return tauriVersion
  }

  const cargoToml = new TextDecoder().decode(cargoBytes)
  const cargoLocated = locateCargoPackageVersion(cargoToml)
  if (!cargoLocated.success) {
    return cargoLocated
  }

  return ok({
    packageJson: packageVersion.data,
    tauriConf: tauriVersion.data,
    cargoToml: cargoLocated.data.version,
  })
}

export function validateSynchronizedApplicationVersions(
  versions: RepositoryVersions,
): Result<string> {
  const parsedPackage = parseApplicationVersion(versions.packageJson)
  if (!parsedPackage.success) {
    return err(`package.json version invalid: ${parsedPackage.error}`)
  }
  const parsedTauri = parseApplicationVersion(versions.tauriConf)
  if (!parsedTauri.success) {
    return err(`tauri.conf.json version invalid: ${parsedTauri.error}`)
  }
  const parsedCargo = parseApplicationVersion(versions.cargoToml)
  if (!parsedCargo.success) {
    return err(`Cargo.toml version invalid: ${parsedCargo.error}`)
  }

  const canonical = parsedPackage.data.canonical
  if (parsedTauri.data.canonical !== canonical) {
    return err(
      `Version drift: package.json=${canonical}, tauri.conf.json=${parsedTauri.data.canonical}`,
    )
  }
  if (parsedCargo.data.canonical !== canonical) {
    return err(
      `Version drift: package.json=${canonical}, Cargo.toml=${parsedCargo.data.canonical}`,
    )
  }

  return ok(canonical)
}

export function updatePackageJsonVersion(bytes: Uint8Array, nextVersion: string): Result<Uint8Array> {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return err('package.json: malformed JSON')
  }
  if (!isRecord(parsed)) {
    return err('package.json: root JSON value must be an object')
  }
  if (typeof parsed['version'] !== 'string') {
    return err('package.json: root "version" must be a string')
  }

  parsed['version'] = nextVersion
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`
  return ok(new TextEncoder().encode(serialized))
}

export function updateTauriConfVersion(bytes: Uint8Array, nextVersion: string): Result<Uint8Array> {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return err('src-tauri/tauri.conf.json: malformed JSON')
  }
  if (!isRecord(parsed)) {
    return err('src-tauri/tauri.conf.json: root JSON value must be an object')
  }
  if (typeof parsed['version'] !== 'string') {
    return err('src-tauri/tauri.conf.json: root "version" must be a string')
  }

  parsed['version'] = nextVersion
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`
  return ok(new TextEncoder().encode(serialized))
}
