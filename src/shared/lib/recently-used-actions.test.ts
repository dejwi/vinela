// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  addRecentlyUsedAction,
  clearRecentlyUsedActions,
  getRecentlyUsedActions,
} from './recently-used-actions'

function getKeys(): string[] {
  return getRecentlyUsedActions().map((action) => action.key)
}

describe('recently used actions', () => {
  beforeEach(() => {
    clearRecentlyUsedActions()
  })

  it('stores and retrieves actions in most-recent-first order', () => {
    addRecentlyUsedAction('write')
    addRecentlyUsedAction('quit')

    expect(getKeys()).toEqual(['quit', 'write'])
  })

  it('keeps only the 5 most recent actions', () => {
    addRecentlyUsedAction('a')
    addRecentlyUsedAction('b')
    addRecentlyUsedAction('c')
    addRecentlyUsedAction('d')
    addRecentlyUsedAction('e')
    addRecentlyUsedAction('f')

    expect(getKeys()).toEqual(['f', 'e', 'd', 'c', 'b'])
  })

  it('moves repeated actions to the front without duplication', () => {
    addRecentlyUsedAction('write')
    addRecentlyUsedAction('quit')
    addRecentlyUsedAction('write')

    expect(getKeys()).toEqual(['write', 'quit'])
  })
})
