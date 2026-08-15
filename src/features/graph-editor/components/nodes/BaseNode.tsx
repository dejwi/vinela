import { Handle, Position } from '@xyflow/react'
import type { ReactNode } from 'react'
import { memo } from 'react'
import { cn } from '@/shared/lib/utils'
import type { Port, PortDataType } from '@/shared/types'

interface BaseNodeProps {
  label: string
  icon?: ReactNode | undefined
  color?: string | undefined
  inputs?: Port[] | undefined
  outputs?: Port[] | undefined
  children?: ReactNode | undefined
  selected?: boolean | undefined
  /** Optional tutorial target ID for spotlight highlighting */
  tutorialTarget?: string | undefined
}

// Port color mapping based on data type
const PORT_COLORS: Record<PortDataType, string> = {
  string: 'border-green-500',
  number: 'border-blue-500',
  boolean: 'border-yellow-500',
  buffer: 'border-purple-500',
  window: 'border-pink-500',
  table: 'border-orange-500',
  any: 'border-gray-500',
  void: 'border-gray-400',
}

function getPortColor(dataType: PortDataType): string {
  return PORT_COLORS[dataType]
}

export const BaseNode = memo(function BaseNode({
  label,
  icon,
  color = 'border-border',
  inputs = [],
  outputs = [],
  children,
  selected,
  tutorialTarget,
}: BaseNodeProps) {
  return (
    <div
      data-tutorial={tutorialTarget}
      className={cn(
        'min-w-[180px] rounded-lg border shadow-lg bg-[#1a1a1a]',
        color,
        selected && 'ring-2 ring-primary',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-[#252525] rounded-t-lg">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="font-medium text-sm">{label}</span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        {/* Input Ports */}
        {inputs.map((port) => (
          <div
            key={port.id}
            className="relative flex items-center min-h-[24px]"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={port.id}
              className={cn(
                '!w-3 !h-3 !border-2 !bg-[#1a1a1a] !-left-1.5',
                getPortColor(port.dataType),
              )}
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
            <span className="text-xs text-muted-foreground pl-3">
              {port.label}
              {port.required === true && (
                <span className="text-destructive">*</span>
              )}
            </span>
          </div>
        ))}

        {/* Node-specific content */}
        {children}

        {/* Output Ports */}
        {outputs.map((port) => (
          <div
            key={port.id}
            className="relative flex items-center justify-end min-h-[24px]"
          >
            <span className="text-xs text-muted-foreground pr-3">
              {port.label}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              className={cn(
                '!w-3 !h-3 !border-2 !bg-[#1a1a1a] !-right-1.5',
                getPortColor(port.dataType),
              )}
              style={{ top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
})
