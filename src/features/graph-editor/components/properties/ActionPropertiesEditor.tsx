import type { ActionConfig, ActionNodeData, GraphNode } from '@/shared/types'
import { useGraphEditorStore } from '../../store'
import { CreateAutocmdActionEditor } from './actions/CreateAutocmdActionEditor'
import { GetVariableActionEditor } from './actions/GetVariableActionEditor'
import { RunActionActionEditor } from './actions/RunActionActionEditor'
import { SetHighlightActionEditor } from './actions/SetHighlightActionEditor'
import { SetKeymapActionEditor } from './actions/SetKeymapActionEditor'
import { SetOptionActionEditor } from './actions/SetOptionActionEditor'
import { SetVariableActionEditor } from './actions/SetVariableActionEditor'
import { type NodePropertiesEditorProps, PropertiesNotice } from './shared'

function isActionNode(node: GraphNode): node is GraphNode<ActionNodeData> {
  return node.data.nodeType === 'action'
}

interface ActionConfigEditorProps {
  data: ActionNodeData
  nodeId: string
  onChange: (config: ActionConfig) => void
}

function ActionConfigEditor({
  data,
  nodeId,
  onChange,
}: ActionConfigEditorProps): React.JSX.Element {
  switch (data.actionConfig.actionConfigType) {
    case 'set-option':
      return (
        <SetOptionActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
    case 'run-action':
      return (
        <RunActionActionEditor config={data.actionConfig} onChange={onChange} />
      )
    case 'set-keymap':
      return (
        <SetKeymapActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
    case 'set-variable':
      return (
        <SetVariableActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
    case 'get-variable':
      return (
        <GetVariableActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
    case 'create-autocmd':
      return (
        <CreateAutocmdActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
    case 'set-highlight':
      return (
        <SetHighlightActionEditor
          config={data.actionConfig}
          nodeId={nodeId}
          onChange={onChange}
        />
      )
  }
}

export function ActionPropertiesEditor({
  node,
}: NodePropertiesEditorProps): React.JSX.Element {
  const updateNodeData = useGraphEditorStore((state) => state.updateNodeData)

  if (!isActionNode(node)) {
    return (
      <PropertiesNotice
        title="Unexpected node type"
        description="Action editor can only be used with action nodes."
      />
    )
  }

  const handleActionConfigChange = (nextConfig: ActionConfig): void => {
    updateNodeData<ActionNodeData>(node.id, {
      actionType: nextConfig.actionConfigType,
      actionConfig: nextConfig,
    })
  }

  return (
    <ActionConfigEditor
      data={node.data}
      nodeId={node.id}
      onChange={handleActionConfigChange}
    />
  )
}
