import { createContext, useContext } from 'react'
import type { DisableComputationResult, Graph } from '@/shared/types'

const EMPTY_DISABLE_STATES: DisableComputationResult = {
  statesByGraphId: new Map(),
}

interface GraphManagerContextValue {
  graphs: Graph[]
  disableStates: DisableComputationResult
}

const DEFAULT_GRAPH_MANAGER_CONTEXT: GraphManagerContextValue = {
  graphs: [],
  disableStates: EMPTY_DISABLE_STATES,
}

const GraphManagerContext = createContext<GraphManagerContextValue>(
  DEFAULT_GRAPH_MANAGER_CONTEXT,
)

interface GraphManagerProviderProps {
  value: GraphManagerContextValue
  children: React.ReactNode
}

export function GraphManagerProvider({
  value,
  children,
}: GraphManagerProviderProps): React.JSX.Element {
  return (
    <GraphManagerContext.Provider value={value}>
      {children}
    </GraphManagerContext.Provider>
  )
}

export function useGraphManagerContext(): GraphManagerContextValue {
  return useContext(GraphManagerContext)
}
