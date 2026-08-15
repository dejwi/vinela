import { describe, expect, it } from 'vitest'

describe('lua-matchers', () => {
  it('matches callable registration', () => {
    const lua = '_G._vinela_callables["My_Graph_abc123"] = function(params)'
    expect(lua).toContainCallableRegistration('My Graph', 'abc123-xxx')
  })

  it('matches callable invocation', () => {
    const lua = '_G._vinela_callables["My_Graph_abc123"]({})'
    expect(lua).toContainCallableInvocation('My Graph', 'abc123-xxx')
  })

  it('matches autocmd callback registration', () => {
    const lua =
      '_G._vinela_callables["autocmd_callback_My_Graph_abc123"] = function()'
    expect(lua).toContainAutocmdCallbackRegistration('My Graph', 'abc123-xxx')
  })
})
