import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DeployResult } from '../../types'
import { DeployPanel } from '../DeployPanel'

describe('DeployPanel', () => {
  it('shows no failure guidance on success', () => {
    const result: DeployResult = {
      success: true,
      outputPath: '/home/user/.config/nvim/init.lua',
      backupCreated: false,
      backupPath: undefined,
    }

    render(<DeployPanel deployResult={result} />)

    expect(
      screen.getByText('Configuration deployed successfully'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Deploy failed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/output-file symlinks/)).not.toBeInTheDocument()
  })

  it('shows directory-creation guidance for directory-creation-failed', () => {
    const result: DeployResult = {
      success: false,
      error: 'Could not create output directory',
      errorCode: 'directory-creation-failed',
    }

    render(<DeployPanel deployResult={result} />)

    expect(
      screen.getByText(/missing directory-link destination/),
    ).toBeInTheDocument()
    expect(screen.getByText(/never removes or retargets/)).toBeInTheDocument()
  })

  it('shows output-file symlink guidance for write-failed leaf policy', () => {
    const result: DeployResult = {
      success: false,
      error:
        'Failed to write init.lua: Vinela will not write through output-file symlinks',
      errorCode: 'write-failed',
    }

    render(<DeployPanel deployResult={result} />)

    expect(screen.getByText(/output file is a symlink/)).toBeInTheDocument()
    expect(screen.getByText(/will not follow or replace/)).toBeInTheDocument()
  })

  it('shows permission guidance only for permission-denied', () => {
    const result: DeployResult = {
      success: false,
      error: 'Permission denied',
      errorCode: 'permission-denied',
    }

    render(<DeployPanel deployResult={result} />)

    expect(screen.getByText(/write permissions/)).toBeInTheDocument()
    expect(screen.queryByText(/output-file symlinks/)).not.toBeInTheDocument()
  })
})
