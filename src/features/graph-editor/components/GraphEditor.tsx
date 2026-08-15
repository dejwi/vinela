import { Canvas } from './Canvas'
import { NodePropertiesPanel } from './NodePropertiesPanel'

export function GraphEditor() {
  return (
    <div className="h-full min-h-0 flex">
      <div className="flex-1 min-w-0 min-h-0">
        <Canvas />
      </div>
      <NodePropertiesPanel />
    </div>
  )
}
