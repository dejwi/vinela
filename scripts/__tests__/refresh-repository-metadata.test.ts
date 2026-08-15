import { describe, expect, it } from 'vitest'

import {
  evaluateRefreshOutcome,
  parseCliOptions,
} from '../refresh-repository-metadata'
import type {
  RepositoryMetadataEntry,
  RepositoryMetadataSnapshot,
} from '../../src/shared/types'

function createEntry(repoSlug: string): RepositoryMetadataEntry {
  return {
    repoSlug,
    repoUrl: `https://github.com/${repoSlug}`,
    owner: repoSlug.split('/')[0] ?? 'owner',
    author: repoSlug.split('/')[0] ?? 'owner',
    authorSource: 'repo-owner',
    name: repoSlug.split('/')[1] ?? 'repo',
    fetchedAt: '2026-07-04T00:00:00.000Z',
    unavailable: {
      downloads: 'not-publicly-available',
    },
  }
}

function createSnapshot(
  repositories: readonly RepositoryMetadataEntry[],
): RepositoryMetadataSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-04T00:00:00.000Z',
    provider: 'github-rest',
    repositories: [...repositories],
  }
}

describe('refresh-repository-metadata helpers', () => {
  it('parses allow-partial and dry-run flags', () => {
    expect(parseCliOptions(['--allow-partial', '--dry-run'])).toEqual({
      allowPartial: true,
      dryRun: true,
    })
  })

  it('does not write the runtime snapshot in partial mode when coverage is incomplete', () => {
    const previousSnapshot = createSnapshot([createEntry('owner/one')])

    const outcome = evaluateRefreshOutcome(
      { allowPartial: true, dryRun: false },
      ['owner/one', 'owner/two'],
      previousSnapshot,
      [createEntry('owner/one')],
      ['owner/two: GitHub REST returned 403 Forbidden'],
    )

    expect(outcome.shouldWriteRuntimeSnapshot).toBe(false)
    expect(outcome.missingRepoSlugs).toEqual(['owner/two'])
    expect(outcome.completionMessage).toBe(
      'Partial mode did not write the runtime snapshot.',
    )
  })

  it('does not write the runtime snapshot in dry-run mode', () => {
    const previousSnapshot = createSnapshot([createEntry('owner/one')])

    const outcome = evaluateRefreshOutcome(
      { allowPartial: false, dryRun: true },
      ['owner/one'],
      previousSnapshot,
      [createEntry('owner/one')],
      [],
    )

    expect(outcome.shouldWriteRuntimeSnapshot).toBe(false)
    expect(outcome.missingRepoSlugs).toEqual([])
    expect(outcome.completionMessage).toBe(
      'Dry run completed without writing the runtime snapshot.',
    )
  })

  it('writes the runtime snapshot only for complete normal refreshes', () => {
    const previousSnapshot = createSnapshot([createEntry('owner/one')])

    const outcome = evaluateRefreshOutcome(
      { allowPartial: false, dryRun: false },
      ['owner/one', 'owner/two'],
      previousSnapshot,
      [createEntry('owner/one'), createEntry('owner/two')],
      [],
    )

    expect(outcome.shouldWriteRuntimeSnapshot).toBe(true)
    expect(outcome.missingRepoSlugs).toEqual([])
    expect(outcome.nextSnapshot.repositories.map((entry) => entry.repoSlug)).toEqual([
      'owner/one',
      'owner/two',
    ])
  })
})
