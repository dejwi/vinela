import { describe, expect, it } from 'vitest'
import { searchActions } from './action-catalog-entries'

describe('searchActions', () => {
  it('finds Save File when searching by command template', () => {
    const results = searchActions(':write')

    expect(results.some((action) => action.key === 'write')).toBe(true)
  })

  it('finds Go to First Line when searching by example text', () => {
    const results = searchActions('gg')

    expect(results.some((action) => action.key === 'go-to-first-line')).toBe(
      true,
    )
  })
})
