// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  incrementApplicationVersion,
  locateCargoPackageVersion,
  parseApplicationVersion,
  readRepositoryVersions,
  replaceCargoPackageVersion,
  U64_MAX_STRING,
  validateSynchronizedApplicationVersions,
} from './app-version'

describe('parseApplicationVersion', () => {
  const validCases = [
    '0.2.0',
    '0.2.0-beta.1',
    '0.2.0+build.7',
    '0.2.0-beta.1+build.7',
    `${U64_MAX_STRING}.${U64_MAX_STRING}.${U64_MAX_STRING}`,
    '9007199254740993.0.0',
  ]

  it.each(validCases)('accepts %s', (version) => {
    const result = parseApplicationVersion(version)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.canonical).toBe(version)
    }
  })

  const invalidCases = [
    ['v0.2.0', 'leading v'],
    [' 0.2.0', 'whitespace'],
    ['0.2', 'missing patch'],
    ['01.2.3', 'leading-zero major'],
    ['0.02.3', 'leading-zero minor'],
    ['0.2.03', 'leading-zero patch'],
    ['0.2.0-beta.01', 'leading-zero numeric prerelease'],
    ['0.2.0+', 'empty build'],
    ['0.2.0-+build', 'build before prerelease'],
    [`${BigInt(U64_MAX_STRING) + 1n}.0.0`, 'major overflow'],
    [`0.${BigInt(U64_MAX_STRING) + 1n}.0`, 'minor overflow'],
    [`0.0.${BigInt(U64_MAX_STRING) + 1n}`, 'patch overflow'],
  ] as const

  it.each(invalidCases)('rejects %s (%s)', (version) => {
    expect(parseApplicationVersion(version).success).toBe(false)
  })

  it('reports component-specific range errors', () => {
    const overflow = `${BigInt(U64_MAX_STRING) + 1n}.0.0`
    const result = parseApplicationVersion(overflow)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('major component')
    }
  })
})

describe('incrementApplicationVersion', () => {
  it('increments patch, minor, and major', () => {
    const base = parseApplicationVersion('1.2.3')
    expect(base.success).toBe(true)
    if (!base.success) {
      return
    }

    expect(incrementApplicationVersion(base.data, 'patch')).toEqual({
      success: true,
      data: '1.2.4',
    })
    expect(incrementApplicationVersion(base.data, 'minor')).toEqual({
      success: true,
      data: '1.3.0',
    })
    expect(incrementApplicationVersion(base.data, 'major')).toEqual({
      success: true,
      data: '2.0.0',
    })
  })

  it('rejects prerelease/build shortcuts', () => {
    const prerelease = parseApplicationVersion('1.2.3-beta.1')
    expect(prerelease.success).toBe(true)
    if (!prerelease.success) {
      return
    }
    expect(incrementApplicationVersion(prerelease.data, 'patch').success).toBe(false)
  })

  it('rejects overflow at u64::MAX', () => {
    const atMax = parseApplicationVersion(`${U64_MAX_STRING}.0.0`)
    expect(atMax.success).toBe(true)
    if (!atMax.success) {
      return
    }
    expect(incrementApplicationVersion(atMax.data, 'major').success).toBe(false)
  })
})

describe('cargo package version locator', () => {
  it('reads only [package].version and ignores dependency versions', () => {
    const cargo = `[dependencies]
serde = { version = "1.0.0" }

[package]
name = "vinela"
version = "0.1.10"

[package.metadata.tauri]
version = "9.9.9"
`
    const located = locateCargoPackageVersion(cargo)
    expect(located.success).toBe(true)
    if (located.success) {
      expect(located.data.version).toBe('0.1.10')
    }

    const replaced = replaceCargoPackageVersion(cargo, '0.2.0')
    expect(replaced.success).toBe(true)
    if (replaced.success) {
      expect(replaced.data).toContain('version = "0.2.0"')
      expect(replaced.data).toContain('serde = { version = "1.0.0" }')
      expect(replaced.data).toContain('[package.metadata.tauri]\nversion = "9.9.9"')
    }
  })

  it('rejects duplicate or missing package versions', () => {
    expect(locateCargoPackageVersion('[package]\nname = "x"').success).toBe(false)
    expect(
      locateCargoPackageVersion('[package]\nversion = "1.0.0"\nversion = "2.0.0"').success,
    ).toBe(false)
  })
})

function createFixtureRepo(version: {
  packageJson: string
  tauriConf: string
  cargoToml: string
}): string {
  const root = mkdtempSync(join(tmpdir(), 'vinela-version-fixture-'))
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify({ name: 'vinela', version: version.packageJson }, null, 2)}\n`,
  )
  mkdirSync(join(root, 'src-tauri'), { recursive: true })
  writeFileSync(
    join(root, 'src-tauri/tauri.conf.json'),
    `${JSON.stringify({ version: version.tauriConf }, null, 2)}\n`,
  )
  writeFileSync(
    join(root, 'src-tauri/Cargo.toml'),
    `[package]\nname = "vinela"\nversion = "${version.cargoToml}"\n`,
  )
  return root
}

describe('readRepositoryVersions', () => {
  it('reads synchronized versions', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })
    const result = readRepositoryVersions(root)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(validateSynchronizedApplicationVersions(result.data).success).toBe(true)
    }
    rmSync(root, { recursive: true, force: true })
  })

  it('rejects non-string JSON versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'vinela-version-fixture-'))
    writeFileSync(join(root, 'package.json'), '{"version":1}\n')
    mkdirSync(join(root, 'src-tauri'), { recursive: true })
    writeFileSync(join(root, 'src-tauri/tauri.conf.json'), '{"version":"0.1.0"}\n')
    writeFileSync(join(root, 'src-tauri/Cargo.toml'), '[package]\nversion = "0.1.0"\n')

    const result = readRepositoryVersions(root)
    expect(result.success).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })
})

describe('replaceFileBytesSameDirectory', () => {
  it('replaces file contents and cleans up temp files on failure', async () => {
    const { replaceFileBytesSameDirectory } = await import('../bump-version')
    const root = mkdtempSync(join(tmpdir(), 'vinela-replace-fixture-'))
    const target = join(root, 'package.json')
    writeFileSync(target, '{"version":"0.1.0"}\n')

    replaceFileBytesSameDirectory(target, new TextEncoder().encode('{"version":"0.2.0"}\n'))
    expect(readFileSync(target, 'utf8')).toBe('{"version":"0.2.0"}\n')

    rmSync(root, { recursive: true, force: true })
  })
})
