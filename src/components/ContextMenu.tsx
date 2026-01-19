import React, { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { createNode } from '@/lib/nodeUtils'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCreateNode?: () => void
}

export function ContextMenu({ x, y, onClose, onCreateNode }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { nodes, edges, addNode, updateNode, deleteNode, setSelectedNode, ui } = useAppStore()
  const isDark = ui.theme === 'dark'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleCreateNode = () => {
    // 触发对话框显示
    onCreateNode?.()
    onClose()
  }

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText.trim()) {
        // 创建新节点，使用剪贴板内容作为主题
        onCreateNode?.()
        onClose()
      }
    } catch (error) {
      console.error('无法读取剪贴板:', error)
    }
  }

  const handleFitView = () => {
    // 调整视图以适应所有节点
    // 这里可以触发ReactFlow的fitView功能
    onClose()
  }

  const handleSelectAll = () => {
    // 选择所有节点
    // 这里可以实现全选功能
    onClose()
  }

  const handleClearCanvas = () => {
    // 清空画布
    if (window.confirm('确定要清空整个画布吗？此操作无法撤销。')) {
      // 删除所有节点和边
      nodes.forEach(node => deleteNode(node.id))
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 border rounded-lg shadow-lg py-1 min-w-48 ${
        isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      }`}
      style={{ left: x, top: y }}
    >
      {/* 添加节点 */}
      <button
        className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
          isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'
        }`}
        onClick={handleCreateNode}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加节点
      </button>

      {/* 从剪贴板创建 */}
      <button
        className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
          isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'
        }`}
        onClick={handlePaste}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        从剪贴板创建
      </button>

      <div className={`border-t my-1 ${isDark ? 'border-gray-600' : 'border-gray-300'}`} />

      {/* 视图操作 */}
      <button
        className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
          isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'
        }`}
        onClick={handleFitView}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" />
        </svg>
        适应视图
      </button>

      <button
        className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
          isDark ? 'hover:bg-gray-700 text-white' : 'hover:bg-gray-100 text-gray-900'
        }`}
        onClick={handleSelectAll}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
          <polyline points="9,9 15,15" strokeWidth="2"/>
          <polyline points="15,9 9,15" strokeWidth="2"/>
        </svg>
        全选
      </button>

      <div className={`border-t my-1 ${isDark ? 'border-gray-600' : 'border-gray-300'}`} />

      {/* 危险操作 */}
      <button
        className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 ${
          isDark ? 'hover:bg-red-800 text-red-400' : 'hover:bg-red-50 text-red-600'
        }`}
        onClick={handleClearCanvas}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        清空画布
      </button>

      <div className={`border-t my-1 ${isDark ? 'border-gray-600' : 'border-gray-300'}`} />

      {/* 取消 */}
      <button
        className={`w-full px-3 py-2 text-left transition-colors ${
          isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
        }`}
        onClick={onClose}
      >
        取消
      </button>
    </div>
  )
}