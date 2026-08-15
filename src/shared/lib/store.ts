import { temporal } from 'zundo'
import type { StateCreator } from 'zustand'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Type helper for immer + temporal stores (with undo/redo)
export function createTemporalStore<T extends object>(
  initializer: StateCreator<T, [['zustand/immer', never]], []>,
) {
  return create<T>()(
    temporal(immer(initializer), {
      limit: 100, // Max undo history
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }),
  )
}

// Type helper for simple immer stores (no undo needed)
export function createStore<T extends object>(
  initializer: StateCreator<T, [['zustand/immer', never]], []>,
) {
  return create<T>()(immer(initializer))
}
