import type { EdgeTypes } from '@xyflow/react'
import { DeletableEdge } from './DeletableEdge'

// Registry of edge type to component mapping.
// 'default' overrides React Flow's built-in bezier edge with our deletable variant.
export const edgeTypes: EdgeTypes = {
  default: DeletableEdge,
}

// Re-export components
export { DeletableEdge }
