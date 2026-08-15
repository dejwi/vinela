import type { ComponentType } from 'react'
import type { GraphNode, NodeData } from '@/shared/types'

export interface NodePropertiesEditorProps<T extends NodeData = NodeData> {
  node: GraphNode<T>
}

export type NodePropertiesEditorComponent<T extends NodeData = NodeData> =
  ComponentType<NodePropertiesEditorProps<T>>
