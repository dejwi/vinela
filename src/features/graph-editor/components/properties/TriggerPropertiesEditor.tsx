import { isTriggerNode } from '@/shared/types'
import {
  type NodePropertiesEditorProps,
  PropertiesNotice,
  PropertiesSection,
} from './shared'

export function TriggerPropertiesEditor({
  node,
}: NodePropertiesEditorProps): React.JSX.Element {
  if (!isTriggerNode(node)) {
    return (
      <PropertiesNotice
        title="Unexpected node type"
        description="Trigger editor can only be used with trigger nodes."
      />
    )
  }

  return (
    <div className="space-y-4">
      <PropertiesSection
        title="Trigger"
        description="This trigger runs when Neovim starts."
      >
        <PropertiesNotice
          title="On Startup"
          description="Startup triggers execute automatically when Neovim initializes. No additional configuration is required."
        />
      </PropertiesSection>
    </div>
  )
}
