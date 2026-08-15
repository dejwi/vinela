import type { GraphNode, NodeType } from '@/shared/types'
import {
  MissingEditorCard,
  type NodePropertiesEditorComponent,
  PropertiesNotice,
} from './shared'

interface NodePropertiesRouterProps {
  node: GraphNode
}

interface NodeEditorRoute {
  filePath: string
  exportName: string
}

const NODE_EDITOR_ROUTES: Partial<Record<NodeType, NodeEditorRoute>> = {
  trigger: {
    filePath: './TriggerPropertiesEditor.tsx',
    exportName: 'TriggerPropertiesEditor',
  },
  condition: {
    filePath: './ConditionPropertiesEditor.tsx',
    exportName: 'ConditionPropertiesEditor',
  },
  action: {
    filePath: './ActionPropertiesEditor.tsx',
    exportName: 'ActionPropertiesEditor',
  },
  'run-function': {
    filePath: './RunFunctionPropertiesEditor.tsx',
    exportName: 'RunFunctionPropertiesEditor',
  },
  builtin: {
    filePath: './BuiltinPropertiesEditor.tsx',
    exportName: 'BuiltinPropertiesEditor',
  },
  loop: {
    filePath: './LoopPropertiesEditor.tsx',
    exportName: 'LoopPropertiesEditor',
  },
  'code-block': {
    filePath: './CodeBlockPropertiesEditor.tsx',
    exportName: 'CodeBlockPropertiesEditor',
  },
  // Inline editors intentionally remain on-node for now:
  // - callable-entry
  // - return
  // - graph-ref
}

type EditorModule = Record<string, unknown>

const editorModules = import.meta.glob('./*.tsx', {
  eager: true,
}) as Record<string, EditorModule>

function resolveNodeEditor(
  route: NodeEditorRoute,
): NodePropertiesEditorComponent | null {
  const editorModule = editorModules[route.filePath]
  if (!editorModule) {
    return null
  }

  const candidate = editorModule[route.exportName] ?? editorModule['default']

  if (typeof candidate !== 'function') {
    return null
  }

  return candidate as NodePropertiesEditorComponent
}

function toLabel(value: string): string {
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

export function NodePropertiesRouter({ node }: NodePropertiesRouterProps) {
  const route = NODE_EDITOR_ROUTES[node.data.nodeType]

  if (!route) {
    return (
      <PropertiesNotice
        title="Inline Node Configuration"
        description={`${toLabel(node.data.nodeType)} nodes do not have a dedicated properties editor yet.`}
      />
    )
  }

  const EditorComponent = resolveNodeEditor(route)

  if (!EditorComponent) {
    return (
      <MissingEditorCard
        nodeType={toLabel(node.data.nodeType)}
        editorName={route.exportName}
      />
    )
  }

  return <EditorComponent node={node} />
}
