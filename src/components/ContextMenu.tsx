import React, { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCreateNode?: () => void
}

export function ContextMenu({ x, y, onClose, onCreateNode }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { ui } = useAppStore()
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
    onCreateNode?.()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 border rounded-lg shadow-lg py-1 min-w-48 ${
        isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      }`}
      style={{ left: x, top: y }}
    >
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
    </div>
  )
}
