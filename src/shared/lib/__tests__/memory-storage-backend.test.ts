import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStorageBackend } from '../memory-storage-backend'

describe('MemoryStorageBackend ENOENT errors', () => {
  it('throws ENOENT error for missing app file', async () => {
    const backend = new MemoryStorageBackend()

    try {
      await backend.readAppFile('/nonexistent.json')
      expect.fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error & { code?: string }).code).toBe('ENOENT')
      expect((error as Error).message).toMatch(/not found/i)
    }
  })

  it('throws ENOENT error for missing app text file', async () => {
    const backend = new MemoryStorageBackend()

    try {
      await backend.readAppTextFile('/nonexistent.txt')
      expect.fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error & { code?: string }).code).toBe('ENOENT')
    }
  })

  it('throws ENOENT error for missing project file', async () => {
    const backend = new MemoryStorageBackend()

    try {
      await backend.readProjectFile('/memory/projects/demo', 'nonexistent.json')
      expect.fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error & { code?: string }).code).toBe('ENOENT')
    }
  })

  it('throws ENOENT error for missing project text file', async () => {
    const backend = new MemoryStorageBackend()

    try {
      await backend.readProjectTextFile(
        '/memory/projects/demo',
        'nonexistent.txt',
      )
      expect.fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error & { code?: string }).code).toBe('ENOENT')
    }
  })
})

describe('MemoryStorageBackend browser persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists project files across backend instances', async () => {
    const first = new MemoryStorageBackend()
    await first.writeProjectFile('/memory/projects/demo', 'graphs/test.json', {
      id: 'test',
      name: 'Persisted Graph',
    })

    const second = new MemoryStorageBackend()
    const exists = await second.projectFileExists(
      '/memory/projects/demo',
      'graphs/test.json',
    )
    const stored = await second.readProjectFile<{ id: string; name: string }>(
      '/memory/projects/demo',
      'graphs/test.json',
    )

    expect(exists).toBe(true)
    expect(stored).toEqual({ id: 'test', name: 'Persisted Graph' })
  })

  it('persists removals across backend instances', async () => {
    const first = new MemoryStorageBackend()
    await first.writeAppTextFile('tmp-file.txt', 'temporary-content')

    const second = new MemoryStorageBackend()
    await second.removeAppFile('tmp-file.txt')

    const third = new MemoryStorageBackend()
    const exists = await third.appFileExists('tmp-file.txt')

    expect(exists).toBe(false)
  })
})

describe('MemoryStorageBackend root project layout', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses root-relative keys for project files and directories', async () => {
    const backend = new MemoryStorageBackend()

    await backend.writeProjectFile('/memory/projects/demo', 'project.json', {
      id: 'demo',
      name: 'Demo',
      createdAt: 1,
      lastModifiedAt: 1,
    })
    await backend.ensureProjectDir('/memory/projects/demo', 'graphs')

    const files = backend._debugGetAllFiles()
    const directories = backend._debugGetAllDirectories()

    expect(files['/memory/projects/demo/project.json']).toBeDefined()
    expect(files['/memory/projects/demo/.vinela/project.json']).toBeUndefined()
    expect(directories).toContain('/memory/projects/demo/graphs')
    expect(directories).not.toContain('/memory/projects/demo/.vinela/graphs')
  })

  it('treats root project.json as valid and hidden-only layout as invalid', async () => {
    const backend = new MemoryStorageBackend()

    await backend.writeProjectFile(
      '/memory/projects/root-only',
      'project.json',
      {
        id: 'root',
        name: 'Root',
        createdAt: 1,
        lastModifiedAt: 1,
      },
    )

    expect(await backend.isValidProject('/memory/projects/root-only')).toBe(
      true,
    )

    window.localStorage.setItem(
      'vinela::memory-storage::v1',
      JSON.stringify({
        version: 1,
        files: [['/memory/projects/hidden-only/.vinela/project.json', '{}']],
        directories: [],
      }),
    )

    const hiddenOnly = new MemoryStorageBackend()
    expect(
      await hiddenOnly.isValidProject('/memory/projects/hidden-only'),
    ).toBe(false)
  })
})
