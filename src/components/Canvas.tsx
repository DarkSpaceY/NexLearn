import React, { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { ReactFlowCanvasWithProvider } from './canvas/ReactFlowCanvas'
import { ContextMenu } from './ContextMenu'
import { NodeCreateDialog } from './NodeCreateDialog'
import { Node } from '@/types'

interface CanvasProps {
  onNodeDoubleClick?: (node: Node) => void
  onNodeIdeaClick?: (node: Node) => void
}

export function Canvas({ onNodeDoubleClick, onNodeIdeaClick }: CanvasProps) {
  const { nodes, edges } = useAppStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createPosition, setCreatePosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setContextMenu({ x: e.clientX, y: e.clientY })
    setCreatePosition({ x, y })
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // 点击空白区域关闭右键菜单
    if (contextMenu) {
      setContextMenu(null)
    }
  }

  const handleCreateNode = () => {
    setContextMenu(null)
    setShowCreateDialog(true)
  }

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setContextMenu({ x: e.clientX, y: e.clientY })
    setCreatePosition({ x, y })
  }

  return (
    <div className="canvas-container flex-1 relative" style={{ height: '100vh' }}>
      {/* ReactFlow Canvas */}
      <div
        className="w-full h-full"
        onContextMenu={handleCanvasContextMenu}
      >
        <ReactFlowCanvasWithProvider
          nodes={nodes}
          edges={edges}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeIdeaClick={onNodeIdeaClick}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCreateNode={() => {
            setShowCreateDialog(true)
            setContextMenu(null)
          }}
        />
      )}

      {/* 创建节点对话框 */}
      <NodeCreateDialog
        isOpen={showCreateDialog}
        x={createPosition.x}
        y={createPosition.y}
        onClose={() => setShowCreateDialog(false)}
      />
    </div>
  )
}