// @vitest-environment node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyProjectToScratch } from './project-copy'

describe('copyProjectToScratch', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(tempRoots.map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })))
    tempRoots.length = 0
  })

  it('copies project files while skipping noisy directories', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-copy-test-'))
    tempRoots.push(tempRoot)
    const sourceDir = path.join(tempRoot, 'source')
    const destinationDir = path.join(tempRoot, 'dest')

    await fs.mkdir(path.join(sourceDir, 'schemas'), { recursive: true })
    await fs.mkdir(path.join(sourceDir, '.git'), { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'project.json'), '{}', 'utf8')
    await fs.writeFile(
      path.join(sourceDir, 'schemas', 'schema.json'),
      '{"ok":true}',
      'utf8',
    )
    await fs.writeFile(path.join(sourceDir, '.git', 'ignored'), 'nope', 'utf8')

    await copyProjectToScratch(sourceDir, destinationDir)

    expect(
      await fs.readFile(path.join(destinationDir, 'project.json'), 'utf8'),
    ).toBe('{}')
    expect(
      await fs.readFile(path.join(destinationDir, 'schemas', 'schema.json'), 'utf8'),
    ).toContain('ok')
    await expect(fs.access(path.join(destinationDir, '.git', 'ignored'))).rejects.toBeDefined()
  })

  it('rejects a destination inside the source project before creating it', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-copy-test-'))
    tempRoots.push(tempRoot)
    const sourceDir = path.join(tempRoot, 'source')
    const destinationDir = path.join(sourceDir, 'nested', 'dest')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'project.json'), '{}', 'utf8')

    await expect(copyProjectToScratch(sourceDir, destinationDir)).rejects.toThrow(/outside the source project/i)
    await expect(fs.access(destinationDir)).rejects.toBeDefined()
  })

  it('rejects a destination equal to the source project before deletion', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nvim-copy-test-'))
    tempRoots.push(tempRoot)
    const sourceDir = path.join(tempRoot, 'source')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'project.json'), '{}', 'utf8')

    await expect(copyProjectToScratch(sourceDir, sourceDir)).rejects.toThrow(/outside the source project/i)
    expect(await fs.readFile(path.join(sourceDir, 'project.json'), 'utf8')).toBe('{}')
  })
})
