// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NodeStorageBackend } from './node-storage-backend'

async function seedProjectRoot(projectRoot: string): Promise<void> {
  await fs.writeFile(path.join(projectRoot, 'project.json'), '{}', 'utf8')
}

describe('NodeStorageBackend', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('reads project files and treats missing optional dirs as empty', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const projectRoot = path.join(tempRoot, 'project')
    await fs.mkdir(projectRoot, { recursive: true })
    await seedProjectRoot(projectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot: projectRoot,
      activeProjectRoot: projectRoot,
      projectWriteMode: 'deny',
    })

    expect(await backend.isValidProject(projectRoot)).toBe(true)
    expect(await backend.listProjectDir(projectRoot, 'graphs')).toEqual([])
  })

  it('rejects hidden-only .vinela/project.json as invalid', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const projectRoot = path.join(tempRoot, 'project')
    await fs.mkdir(path.join(projectRoot, '.vinela'), { recursive: true })
    await fs.writeFile(
      path.join(projectRoot, '.vinela', 'project.json'),
      '{}',
      'utf8',
    )

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot: projectRoot,
      activeProjectRoot: projectRoot,
      projectWriteMode: 'deny',
    })

    expect(await backend.isValidProject(projectRoot)).toBe(false)
  })

  it('denies writes in read-only mode and records them', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const projectRoot = path.join(tempRoot, 'project')
    await fs.mkdir(projectRoot, { recursive: true })
    await seedProjectRoot(projectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot: projectRoot,
      activeProjectRoot: projectRoot,
      projectWriteMode: 'deny',
    })

    await expect(
      backend.writeProjectFile(projectRoot, 'plugins.json', []),
    ).rejects.toThrow(/denied/i)
    expect(backend.hasDeniedProjectWrites()).toBe(true)
    expect(backend.getProjectWriteEvents()[0]).toMatchObject({
      relativePath: 'plugins.json',
      allowed: false,
      reason: 'migration',
    })
  })

  it('rejects path traversal outside project root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const projectRoot = path.join(tempRoot, 'project')
    await fs.mkdir(projectRoot, { recursive: true })
    await seedProjectRoot(projectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot: projectRoot,
      activeProjectRoot: projectRoot,
      projectWriteMode: 'allow-source',
    })

    await expect(
      backend.readProjectTextFile(projectRoot, '../outside.json'),
    ).rejects.toThrow(/escapes root/i)
  })

  it('allows allow-copy writes only for the active project copy', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const sourceProjectRoot = path.join(tempRoot, 'source-project')
    const activeProjectRoot = path.join(tempRoot, 'project-copy')
    await fs.mkdir(sourceProjectRoot, { recursive: true })
    await fs.mkdir(activeProjectRoot, { recursive: true })
    await seedProjectRoot(sourceProjectRoot)
    await seedProjectRoot(activeProjectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot,
      activeProjectRoot,
      projectWriteMode: 'allow-copy',
    })

    await backend.writeProjectFile(activeProjectRoot, 'plugins.json', [])

    expect(
      await fs.readFile(path.join(activeProjectRoot, 'plugins.json'), 'utf8'),
    ).toContain('[]')
    expect(backend.getProjectWriteEvents()).toContainEqual({
      operation: 'write-json',
      relativePath: 'plugins.json',
      targetKind: 'project-copy',
      allowed: true,
      reason: 'migration',
    })
  })

  it('denies allow-copy writes that target the source project root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const sourceProjectRoot = path.join(tempRoot, 'source-project')
    const activeProjectRoot = path.join(tempRoot, 'project-copy')
    await fs.mkdir(sourceProjectRoot, { recursive: true })
    await fs.mkdir(activeProjectRoot, { recursive: true })
    await seedProjectRoot(sourceProjectRoot)
    await seedProjectRoot(activeProjectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot,
      activeProjectRoot,
      projectWriteMode: 'allow-copy',
    })

    await expect(
      backend.writeProjectFile(sourceProjectRoot, 'plugins.json', []),
    ).rejects.toThrow(/denied/i)
    await expect(fs.access(path.join(sourceProjectRoot, 'plugins.json'))).rejects.toBeDefined()
    expect(backend.getProjectWriteEvents()).toContainEqual({
      operation: 'write-json',
      relativePath: 'plugins.json',
      targetKind: 'source-project',
      allowed: false,
      reason: 'migration',
    })
  })

  it('allows source project writes only in allow-source mode', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const sourceProjectRoot = path.join(tempRoot, 'source-project')
    await fs.mkdir(sourceProjectRoot, { recursive: true })
    await seedProjectRoot(sourceProjectRoot)

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot,
      activeProjectRoot: sourceProjectRoot,
      projectWriteMode: 'allow-source',
    })

    await backend.writeProjectTextFile(sourceProjectRoot, 'plugins.json', '[]')

    expect(
      await fs.readFile(path.join(sourceProjectRoot, 'plugins.json'), 'utf8'),
    ).toBe('[]')
    expect(backend.getProjectWriteEvents()).toContainEqual({
      operation: 'write-text',
      relativePath: 'plugins.json',
      targetKind: 'source-project',
      allowed: true,
      reason: 'migration',
    })
  })

  it('rejects path traversal outside the project root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'node-storage-'))
    tempRoots.push(tempRoot)
    const projectRoot = path.join(tempRoot, 'project')
    await fs.mkdir(projectRoot, { recursive: true })
    await seedProjectRoot(projectRoot)
    await fs.writeFile(path.join(projectRoot, 'outside.json'), '{}', 'utf8')

    const backend = new NodeStorageBackend({
      appDataRoot: path.join(tempRoot, 'app'),
      sourceProjectRoot: projectRoot,
      activeProjectRoot: projectRoot,
      projectWriteMode: 'allow-source',
    })

    await expect(
      backend.readProjectTextFile(projectRoot, '../outside.json'),
    ).rejects.toThrow(/escapes root/i)
  })
})
