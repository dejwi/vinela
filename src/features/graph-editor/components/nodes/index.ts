import type { ComponentType } from 'react'
import type { NodeType } from '@/shared/types'
import { ActionNode } from './ActionNode'
import { BuiltinNode } from './BuiltinNode'
import { CallableEntryNode } from './CallableEntryNode'
import { CodeBlockNode } from './CodeBlockNode'
import { ConditionNode } from './ConditionNode'
import { GraphRefNode } from './GraphRefNode'
import { LoopNode } from './LoopNode'
import { ReturnNode } from './ReturnNode'
import { RunFunctionNode } from './RunFunctionNode'
import { TriggerNode } from './TriggerNode'

// Base props that all node components receive
interface NodeComponentProps {
  id: string
  // biome-ignore lint/suspicious/noExplicitAny: React Flow passes various data types
  data: any
  selected?: boolean
}

// Registry of node type to component mapping
// Uses the NodeType union from shared types for type safety
export const nodeTypes: Partial<
  Record<NodeType, ComponentType<NodeComponentProps>>
> = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  loop: LoopNode,
  'code-block': CodeBlockNode,
  'callable-entry': CallableEntryNode,
  return: ReturnNode,
  'graph-ref': GraphRefNode,
  'run-function': RunFunctionNode,
  builtin: BuiltinNode,
}

// List of implemented node types for runtime checks
export const implementedNodeTypes: NodeType[] = [
  'trigger',
  'action',
  'condition',
  'loop',
  'code-block',
  'callable-entry',
  'return',
  'graph-ref',
  'run-function',
  'builtin',
]

// Type guard to check if a node type is implemented
export function isImplementedNodeType(type: string): type is NodeType {
  return implementedNodeTypes.includes(type as NodeType)
}

// Re-export components
export {
  TriggerNode,
  ActionNode,
  ConditionNode,
  CodeBlockNode,
  CallableEntryNode,
  ReturnNode,
  GraphRefNode,
  RunFunctionNode,
  BuiltinNode,
  LoopNode,
}
