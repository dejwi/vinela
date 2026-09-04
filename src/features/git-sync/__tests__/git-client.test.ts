import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  exists: vi.fn(),
  browser: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: { create: mocks.create },
}))
vi.mock('@/shared/lib/storage-api', () => ({ projectFileExists: mocks.exists }))
vi.mock('@/shared/lib/tauri-runtime', () => ({
  isBrowserOnlyRuntime: mocks.browser,
}))

import {
  commitGitChanges,
  fetchGitRemote,
  inspectGitRepository,
  pullGitFastForward,
  pushGitRemote,
  readGitSnapshot,
  stageAllGitChanges,
} from '../git-client'

function command(output: {
  code: number | null
  stdout: string
  stderr: string
}): void {
  mocks.create.mockReturnValue({ execute: vi.fn().mockResolvedValue(output) })
}

describe('git client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.browser.mockReturnValue(false)
    mocks.exists.mockResolvedValue(true)
  })

  it('does not invoke Git in browser or memory mode', async () => {
    mocks.browser.mockReturnValue(true)
    await expect(inspectGitRepository('/project')).resolves.toEqual({
      success: true,
      repository: false,
    })
    await expect(inspectGitRepository('/memory/project')).resolves.toEqual({
      success: true,
      repository: false,
    })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('requires a Git root and uses the constrained command options', async () => {
    command({ code: 0, stdout: '', stderr: '' })
    mocks.create
      .mockReturnValueOnce({
        execute: vi.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' }),
      })
      .mockReturnValueOnce({
        execute: vi.fn().mockResolvedValue({
          code: 0,
          stdout: '# branch.oid abc\n# branch.head main\n',
          stderr: '',
        }),
      })
    const result = await inspectGitRepository('/project')
    expect(result).toMatchObject({ success: true, repository: true })
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      'git-project-root',
      ['rev-parse', '--show-prefix'],
      {
        cwd: '/project',
        env: { GIT_TERMINAL_PROMPT: '0' },
      },
    )
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      'git-status',
      [
        '--no-optional-locks',
        'status',
        '--porcelain=v2',
        '--branch',
        '--untracked-files=all',
      ],
      {
        cwd: '/project',
        env: { GIT_TERMINAL_PROMPT: '0' },
      },
    )
  })

  it('parses status records and accepts stderr from successful Git commands', async () => {
    command({
      code: 0,
      stdout:
        '# branch.oid (initial)\n# branch.head (detached)\n# branch.ab +2 -3\n1 M. N... 1 1 1 abc def file\n2 R. N... 1 1 1 abc def R100 old\tnew\nu UU N... 1 1 1 1 abc def file\n? new\n',
      stderr: 'warning: CRLF will be replaced\n',
    })
    await expect(readGitSnapshot('/project')).resolves.toEqual({
      success: true,
      snapshot: {
        headOid: null,
        branch: null,
        upstream: null,
        ahead: 2,
        behind: 3,
        changedFiles: 4,
        conflictedFiles: 1,
      },
    })
  })

  it('passes commit messages as one argument', async () => {
    command({ code: 0, stdout: '', stderr: '' })
    await commitGitChanges('/project', '- update project files')
    expect(mocks.create).toHaveBeenCalledWith(
      'git-commit',
      ['commit', '--message', '- update project files'],
      {
        cwd: '/project',
        env: { GIT_TERMINAL_PROMPT: '0' },
      },
    )
  })

  it('passes configured literal arguments to Git aliases', async () => {
    command({ code: 0, stdout: '', stderr: '' })
    await fetchGitRemote('/project')
    await pullGitFastForward('/project')
    await stageAllGitChanges('/project')
    await pushGitRemote('/project')
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      'git-fetch',
      ['fetch', '--quiet'],
      expect.anything(),
    )
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      'git-pull-ff-only',
      ['pull', '--quiet', '--ff-only'],
      expect.anything(),
    )
    expect(mocks.create).toHaveBeenNthCalledWith(
      3,
      'git-add-all',
      ['add', '--all'],
      expect.anything(),
    )
    expect(mocks.create).toHaveBeenNthCalledWith(
      4,
      'git-push',
      ['push', '--quiet'],
      expect.anything(),
    )
  })

  it('normalizes .git existence-check rejections', async () => {
    mocks.exists.mockRejectedValue(new Error('Storage unavailable'))
    await expect(inspectGitRepository('/project')).resolves.toEqual({
      success: false,
      error: 'Storage unavailable',
    })
  })
})
