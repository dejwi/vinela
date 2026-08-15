import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react'
import { X } from 'lucide-react'
import { memo, useState } from 'react'

export const DeletableEdge = memo(function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
  style,
}: EdgeProps): React.ReactElement {
  const [hovered, setHovered] = useState(false)
  const { deleteElements } = useReactFlow()

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = (event: React.MouseEvent): void => {
    event.stopPropagation()
    void deleteElements({ edges: [{ id }] })
  }

  const isInteractive = hovered || (selected ?? false)

  const edgeStyle: React.CSSProperties = {
    ...style,
    stroke: selected ? '#f59e0b' : hovered ? '#aaa' : '#888',
    strokeWidth: isInteractive ? 2.5 : 2,
  }

  // Build BaseEdge props — markerEnd must be omitted (not undefined) under
  // exactOptionalPropertyTypes when the value is absent.
  const baseEdgeProps = {
    path: edgePath,
    style: edgeStyle,
    ...(markerEnd !== undefined && { markerEnd }),
  }

  return (
    <>
      {/* Invisible wide path for easier hover/click targeting.
          The path element is a React Flow hit-testing convention; event handlers
          are intentional here even though it is a non-interactive SVG element. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG hit-test path — React Flow pattern */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Visible edge */}
      <BaseEdge {...baseEdgeProps} />
      {/* Delete button rendered via portal above the SVG canvas.
          The div is a positioning container only; role="none" is correct. */}
      <EdgeLabelRenderer>
        <div
          role="none"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nopan nodrag"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {isInteractive && (
            <button
              type="button"
              onClick={handleDelete}
              className="edge-delete-button"
              aria-label="Delete connection"
              title="Delete connection"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
