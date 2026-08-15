import { describe, expect, it } from 'vitest'
import type { GenerationResult } from '@/features/lua-generator/types'
import { requireSuccessfulInitLua } from './generation-result-assertions'

describe('requireSuccessfulInitLua', () => {
  it('returns initLua for successful generation results', () => {
    const result: GenerationResult = {
      success: true,
      initLua: '-- generated',
      diagnostics: [],
      metadata: {
        graphsGenerated: 1,
        nodesGenerated: 1,
        pluginsConfigured: 0,
        linesOfCode: 1,
        generationTimeMs: 1,
        phaseTimingsMs: {},
      },
    }

    expect(requireSuccessfulInitLua(result)).toBe('-- generated')
  })

  it('throws with all diagnostic messages for failed generation results', () => {
    const result: GenerationResult = {
      success: false,
      diagnostics: [
        {
          id: 'ERR_ONE',
          severity: 'error',
          category: 'config',
          message: 'first',
        },
        {
          id: 'ERR_TWO',
          severity: 'error',
          category: 'config',
          message: 'second',
        },
      ],
      metadata: {
        graphsGenerated: 0,
        nodesGenerated: 0,
        pluginsConfigured: 0,
        linesOfCode: 0,
        generationTimeMs: 1,
        phaseTimingsMs: {},
      },
    }

    expect(() => requireSuccessfulInitLua(result)).toThrow(
      'Expected successful generation result with initLua, but generation failed: first; second',
    )
  })
})
