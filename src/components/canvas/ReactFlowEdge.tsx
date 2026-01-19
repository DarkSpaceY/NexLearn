import React from 'react'
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow'
import { Edge as AppEdge } from '@/types'
import { useAppStore } from '@/stores/appStore'

interface ReactFlowEdgeData {
  edge: AppEdge
}

export function ReactFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<ReactFlowEdgeData>) {
  const { ui } = useAppStore()
  const isDark = ui.theme === 'dark'
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY: targetY - 15, // 将目标点稍微上移20px，但不影响箭头位置
    targetPosition,
  })

  const strokeColor = isDark ? '#ffffff' : '#000000'

  return (
    <>
      <path
        id={id}
        style={{
          stroke: strokeColor,
          strokeWidth: 3,
          fill: 'none',
        }}
        d={edgePath}
        markerEnd={`url(#react-flow__arrowclosed-${strokeColor.replace('#', '')})`}
      />

      {/* 自定义箭头标记 */}
      <defs>
        <marker
          id={`react-flow__arrowclosed-${strokeColor.replace('#', '')}`}
          markerWidth="12"
          markerHeight="12"
          viewBox="-10 -10 20 20"
          orient="auto"
          refX="0"
          refY="0"
        >
          <polygon
            points="0,-2 5,0 0,2"
            fill={strokeColor}
          />
        </marker>
      </defs>

      {/* 边标签渲染器 - 可以用来显示边的元数据 */}
      <EdgeLabelRenderer>
        {data?.edge?.meta?.label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
              background: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
              color: strokeColor,
              padding: '2px 4px',
              borderRadius: '4px',
              border: `1px solid ${strokeColor}`,
            }}
            className="nodrag nopan"
          >
            {data.edge.meta.label}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
