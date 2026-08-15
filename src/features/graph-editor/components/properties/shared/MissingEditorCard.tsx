import { Wrench } from 'lucide-react'
import { PropertiesNotice } from './PropertiesNotice'

interface MissingEditorCardProps {
  nodeType: string
  editorName?: string
}

export function MissingEditorCard({
  nodeType,
  editorName,
}: MissingEditorCardProps) {
  const editorLabel = editorName ? ` (${editorName})` : ''

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wrench className="h-4 w-4" />
        Editor Unavailable
      </div>
      <PropertiesNotice
        title={`No properties editor registered for ${nodeType}${editorLabel}`}
        description="This node type is supported by the router, but its editor component has not been implemented yet."
      />
    </div>
  )
}
