import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type {
  GraphSourcedKeymap,
  KeymapFilters,
  KeymapSort,
  ManualKeymapEntry,
} from '../../types'
import { useFilteredKeymaps } from '../useKeymapSearch'

const sort: KeymapSort = { field: 'keySequence', direction: 'asc' }
const baseFilters: KeymapFilters = {
  search: '',
  modeFilter: 'all',
  sourceFilter: 'all',
  actionTypeFilter: 'all',
  profileFilter: 'all',
}

function manual(id: string, profileIds?: string[]): ManualKeymapEntry {
  return {
    source: 'project',
    keymapId: id,
    keymap: {
      id,
      modes: ['n'],
      keySequence: id,
      description: id,
      action: { actionType: 'code-block', code: 'print("x")' },
      silent: true,
      noremap: true,
      expr: false,
      enabled: true,
      ...(profileIds ? { profileIds } : {}),
    },
  }
}

const graphEntry: GraphSourcedKeymap = {
  source: 'graph',
  graphId: 'graph-1',
  graphName: 'Graph',
  nodeId: 'node-1',
  keySequence: 'gg',
  modes: ['n'],
  command: ':echo',
  description: 'graph keymap',
  hasConnectedLogic: false,
}

function filterIds(profileFilter: string): string[] {
  const entries = [manual('a', ['work']), manual('b'), graphEntry]
  const { result } = renderHook(() =>
    useFilteredKeymaps(entries, { ...baseFilters, profileFilter }, sort),
  )
  return result.current.map((entry) =>
    entry.source === 'project' ? entry.keymapId : entry.nodeId,
  )
}

describe('useFilteredKeymaps profile filter', () => {
  it('keeps everything when set to all', () => {
    expect(filterIds('all')).toEqual(['a', 'b', 'node-1'])
  })

  it('keeps only shortcuts assigned to the selected profile', () => {
    expect(filterIds('work')).toEqual(['a'])
  })

  it('keeps only unassigned manual shortcuts for none', () => {
    expect(filterIds('none')).toEqual(['b'])
  })
})
