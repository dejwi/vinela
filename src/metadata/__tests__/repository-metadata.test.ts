import { describe, expect, it } from 'vitest'
import { catalog } from '@/colorschemes'
import builtinSchemas from '@/schemas'

import {
  getRepositoryMetadata,
  getRepositoryMetadataEntries,
  getRepositoryMetadataSnapshotInfo,
} from '..'

describe('repository metadata snapshot', () => {
  it('normalizes repository refs during lookup', () => {
    const entry = getRepositoryMetadata('github.com/Folke/tokyonight.nvim/')
    expect(entry).toBeDefined()
    expect(entry?.repoSlug).toBe('folke/tokyonight.nvim')
  })

  it('exposes snapshot info', () => {
    expect(getRepositoryMetadataSnapshotInfo()).toMatchObject({
      provider: 'github-rest',
    })
  })

  it('covers every bundled builtin schema repository', () => {
    for (const schema of builtinSchemas) {
      expect(
        getRepositoryMetadata(schema.pluginRepo),
        schema.pluginRepo,
      ).toBeDefined()
    }
  })

  it('covers every bundled colorscheme repository', () => {
    for (const entry of catalog) {
      expect(
        getRepositoryMetadata(entry.pluginRepo || entry.repoUrl),
        entry.pluginRepo || entry.repoUrl,
      ).toBeDefined()
    }
  })

  it('is sorted by repoSlug', () => {
    const repoSlugs = getRepositoryMetadataEntries().map(
      (entry) => entry.repoSlug,
    )
    const sortedRepoSlugs = [...repoSlugs].sort((left, right) =>
      left.localeCompare(right),
    )
    expect(repoSlugs).toEqual(sortedRepoSlugs)
  })
})
