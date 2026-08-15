import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import { buildOptionIndex } from '../../../utils/conditions'
import { SchemaField } from '../SchemaField'

describe('SchemaField enabledWhen', () => {
  const gate: SchemaOption = {
    key: 'picker.enabled',
    label: 'Picker enabled',
    type: 'boolean',
    default: true,
  }
  const option: SchemaOption = {
    key: 'picker.cwd',
    label: 'Picker CWD',
    type: 'string',
    enabledWhen: { key: 'picker.enabled', equals: true },
    notices: [
      {
        severity: 'warning',
        surfaces: ['configuration'],
        when: { kind: 'has-explicit-value' },
        message: 'Explicit picker cwd warning',
      },
    ],
  }

  it('renders enabled when default true is absent from stored values', () => {
    const values: Record<string, PluginConfigValue> = {}
    render(
      <SchemaField
        option={option}
        value={undefined}
        onChange={vi.fn()}
        allValues={values}
        optionIndex={buildOptionIndex([gate, option])}
      />,
    )

    expect(screen.getByRole('textbox')).toBeEnabled()
  })

  it('renders disabled state when gate mismatches', () => {
    const values: Record<string, PluginConfigValue> = {
      'picker.enabled': false,
    }
    render(
      <SchemaField
        option={option}
        value={undefined}
        onChange={vi.fn()}
        allValues={values}
        optionIndex={buildOptionIndex([gate, option])}
      />,
    )

    expect(
      screen.getByText('Picker CWD').closest('[aria-disabled="true"]'),
    ).not.toBeNull()
    expect(
      screen.queryByText('Explicit picker cwd warning'),
    ).not.toBeInTheDocument()
  })

  it('renders configuration notices only when field is enabled', () => {
    const values: Record<string, PluginConfigValue> = {
      'picker.enabled': true,
      'picker.cwd': '/tmp',
    }

    render(
      <SchemaField
        option={option}
        value={values['picker.cwd']}
        onChange={vi.fn()}
        allValues={values}
        optionIndex={buildOptionIndex([gate, option])}
      />,
    )

    expect(screen.getByText('Explicit picker cwd warning')).toBeInTheDocument()
  })
})
