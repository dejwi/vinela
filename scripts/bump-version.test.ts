// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { U64_MAX_STRING } from './lib/app-version'
import {
  parseCliArgs,
  runVersionBumpWorkflow,
  type VersionFileOperations,
} from './bump-version'

function createFixtureRepo(version: {
  packageJson: string
  tauriConf: string
  cargoToml: string
}): string {
  const root = mkdtempSync(join(tmpdir(), 'vinela-bump-fixture-'))
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

function createMemoryOperations(
  root: string,
  hooks?: {
    onReplace?: (relativePath: string) => void
    throwOnReplace?: string
    mutateThenThrowOnReplace?: string
    failReadAfterWrite?: boolean
    failRollbackFor?: string
  },
): VersionFileOperations {
  const files = new Map<string, Uint8Array>([
    ['package.json', new Uint8Array(readFileSync(join(root, 'package.json')))],
    [
      'src-tauri/tauri.conf.json',
      new Uint8Array(readFileSync(join(root, 'src-tauri/tauri.conf.json'))),
    ],
    [
      'src-tauri/Cargo.toml',
      new Uint8Array(readFileSync(join(root, 'src-tauri/Cargo.toml'))),
    ],
  ])
  let wrote = false
  let rollbackPhase = false

  return {
    readFileBytes(relativePath: string): Uint8Array {
      if (hooks?.failReadAfterWrite && wrote) {
        throw new Error(`read failed for ${relativePath}`)
      }
      const bytes = files.get(relativePath)
      if (bytes === undefined) {
        throw new Error(`missing ${relativePath}`)
      }
      return bytes
    },
    replaceFileBytes(relativePath: string, content: Uint8Array): void {
      hooks?.onReplace?.(relativePath)
      if (hooks?.throwOnReplace === relativePath) {
        throw new Error(`replace failed before write for ${relativePath}`)
      }
      if (
        hooks?.mutateThenThrowOnReplace === relativePath &&
        !rollbackPhase
      ) {
        files.set(relativePath, new TextEncoder().encode('partial'))
        writeFileSync(join(root, relativePath), new TextEncoder().encode('partial'))
        rollbackPhase = true
        throw new Error(`replace failed after partial write for ${relativePath}`)
      }
      if (hooks?.failRollbackFor === relativePath && rollbackPhase) {
        throw new Error(`rollback failed for ${relativePath}`)
      }
      files.set(relativePath, content)
      wrote = true
      writeFileSync(join(root, relativePath), content)
    },
  }
}

describe('parseCliArgs', () => {
  it('parses check, dry-run, exact, and shortcut modes', () => {
    expect(parseCliArgs(['--check']).success).toBe(true)
    expect(parseCliArgs(['patch', '--dry-run']).success).toBe(true)
    expect(parseCliArgs(['0.2.0-beta.1+build.7']).success).toBe(true)
    expect(parseCliArgs(['--check', 'patch']).success).toBe(false)
  })
})

describe('runVersionBumpWorkflow', () => {
  it('applies exact stable version updates', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })

    const result = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: '0.2.0' } },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.version).toBe('0.2.0')
    }
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('0.2.0')
    rmSync(root, { recursive: true, force: true })
  })

  it('accepts combined prerelease-plus-build exact targets', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })

    const target = '0.2.0-beta.1+build.7'
    const result = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: target } },
    })
    expect(result.success).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('supports patch/minor/major shortcuts', () => {
    const root = createFixtureRepo({
      packageJson: '1.2.3',
      tauriConf: '1.2.3',
      cargoToml: '1.2.3',
    })

    const patch = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'shortcut', bump: 'patch' } },
    })
    expect(patch.success).toBe(true)
    if (patch.success) {
      expect(patch.version).toBe('1.2.4')
    }
    rmSync(root, { recursive: true, force: true })
  })

  it('rejects shortcut drift and prerelease current versions', () => {
    const driftRoot = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.1',
      cargoToml: '0.1.0',
    })
    expect(
      runVersionBumpWorkflow({
        rootDir: driftRoot,
        intent: { mode: 'apply', target: { kind: 'shortcut', bump: 'patch' } },
      }).success,
    ).toBe(false)
    rmSync(driftRoot, { recursive: true, force: true })

    const prereleaseRoot = createFixtureRepo({
      packageJson: '0.1.0-beta.1',
      tauriConf: '0.1.0-beta.1',
      cargoToml: '0.1.0-beta.1',
    })
    expect(
      runVersionBumpWorkflow({
        rootDir: prereleaseRoot,
        intent: { mode: 'apply', target: { kind: 'shortcut', bump: 'patch' } },
      }).success,
    ).toBe(false)
    rmSync(prereleaseRoot, { recursive: true, force: true })
  })

  it('converges drift with an exact target and is idempotent', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.1',
      cargoToml: '0.1.2',
    })

    const first = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: '0.2.0' } },
    })
    expect(first.success).toBe(true)

    const second = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: '0.2.0' } },
    })
    expect(second.success).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('supports read-only check and dry-run without writes', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })
    const before = readFileSync(join(root, 'package.json'), 'utf8')

    expect(
      runVersionBumpWorkflow({ rootDir: root, intent: { mode: 'check' } }).success,
    ).toBe(true)
    expect(
      runVersionBumpWorkflow({
        rootDir: root,
        intent: { mode: 'dry-run', target: { kind: 'exact', version: '0.2.0' } },
      }).success,
    ).toBe(true)
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before)
    rmSync(root, { recursive: true, force: true })
  })

  it('rejects invalid targets before replacement', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })
    const replacements: string[] = []
    const operations = createMemoryOperations(root, {
      onReplace: (path) => replacements.push(path),
    })

    const overflow = `${BigInt(U64_MAX_STRING) + 1n}.0.0`
    expect(
      runVersionBumpWorkflow({
        rootDir: root,
        intent: { mode: 'apply', target: { kind: 'exact', version: overflow } },
        operations,
      }).success,
    ).toBe(false)
    expect(replacements).toHaveLength(0)
    rmSync(root, { recursive: true, force: true })
  })

  it('restores all manifests after mutate-then-throw and rollback failures', () => {
    const root = createFixtureRepo({
      packageJson: '0.1.0',
      tauriConf: '0.1.0',
      cargoToml: '0.1.0',
    })
    const originals = {
      packageJson: readFileSync(join(root, 'package.json'), 'utf8'),
      tauriConf: readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8'),
      cargoToml: readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8'),
    }

    const mutateThrow = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: '0.2.0' } },
      operations: createMemoryOperations(root, {
        mutateThenThrowOnReplace: 'src-tauri/Cargo.toml',
      }),
    })
    expect(mutateThrow.success).toBe(false)
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(originals.packageJson)
    expect(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')).toBe(
      originals.tauriConf,
    )
    expect(readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8')).toBe(originals.cargoToml)

    const rollbackFailure = runVersionBumpWorkflow({
      rootDir: root,
      intent: { mode: 'apply', target: { kind: 'exact', version: '0.2.0' } },
      operations: createMemoryOperations(root, {
        mutateThenThrowOnReplace: 'src-tauri/Cargo.toml',
        failRollbackFor: 'package.json',
      }),
    })
    expect(rollbackFailure.success).toBe(false)
    if (!rollbackFailure.success) {
      expect(rollbackFailure.error).toContain('Rollback failures')
      expect(rollbackFailure.error).toContain('package.json')
      expect(rollbackFailure.error).toContain('version:bump --check')
    }

    rmSync(root, { recursive: true, force: true })
  })

  it('rejects synchronized out-of-range versions in check mode', () => {
    const overflow = `${BigInt(U64_MAX_STRING) + 1n}.0.0`
    const root = createFixtureRepo({
      packageJson: overflow,
      tauriConf: overflow,
      cargoToml: overflow,
    })

    expect(runVersionBumpWorkflow({ rootDir: root, intent: { mode: 'check' } }).success).toBe(
      false,
    )
    rmSync(root, { recursive: true, force: true })
  })
})
