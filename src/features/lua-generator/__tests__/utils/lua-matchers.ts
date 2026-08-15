import { expect } from 'vitest'
import {
  expectedAutocmdCallbackRef,
  expectedCallableRef,
} from '@/features/lua-generator/__tests__/utils/callable-keys'

interface LuaMatchers<R = unknown> {
  toContainCallableRegistration(graphName: string, graphId: string): R
  toContainCallableInvocation(graphName: string, graphId: string): R
  toContainAutocmdCallbackRegistration(graphName: string, nodeId: string): R
}

declare module 'vitest' {
  interface Assertion<T> extends LuaMatchers<T> {}
  interface AsymmetricMatchersContaining extends LuaMatchers {}
}

expect.extend({
  toContainCallableRegistration(
    received: unknown,
    graphName: string,
    graphId: string,
  ) {
    const needle = `${expectedCallableRef(graphName, graphId)} = function(params)`
    const pass = typeof received === 'string' && received.includes(needle)
    return {
      pass,
      message: () =>
        pass
          ? `expected lua not to contain callable registration ${JSON.stringify(needle)}`
          : `expected lua to contain callable registration ${JSON.stringify(needle)}`,
    }
  },
  toContainCallableInvocation(
    received: unknown,
    graphName: string,
    graphId: string,
  ) {
    const needle = `${expectedCallableRef(graphName, graphId)}(`
    const pass = typeof received === 'string' && received.includes(needle)
    return {
      pass,
      message: () =>
        pass
          ? `expected lua not to contain callable invocation ${JSON.stringify(needle)}`
          : `expected lua to contain callable invocation ${JSON.stringify(needle)}`,
    }
  },
  toContainAutocmdCallbackRegistration(
    received: unknown,
    graphName: string,
    nodeId: string,
  ) {
    const needle = expectedAutocmdCallbackRef(graphName, nodeId)
    const pass = typeof received === 'string' && received.includes(needle)
    return {
      pass,
      message: () =>
        pass
          ? `expected lua not to contain autocmd callback registration ${JSON.stringify(needle)}`
          : `expected lua to contain autocmd callback registration ${JSON.stringify(needle)}`,
    }
  },
})
