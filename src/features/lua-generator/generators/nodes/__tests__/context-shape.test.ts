import { describe, expect, it } from 'vitest'
import { createMockContext } from './helpers/mock-context'

describe('GenerationContext invariants', () => {
  it('populates callableKeyByGraphId when callableSymbolByGraphId is non-empty', () => {
    const { context } = createMockContext({
      callableSymbolByGraphId: new Map([['g1', '_g1']]),
    })

    expect(context.callableKeyByGraphId?.get('g1')).toBeDefined()
  })
})
