import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

export function Toolbar() {
  const { ui, setSidebarOpen } = useAppStore()

  return (
    <div
      className={`fixed top-1/2 transform -translate-y-1/2 z-[60] transition-all duration-300 ${
        ui.sidebarOpen ? 'right-96 opacity-100' : 'right-0 opacity-100'
      }`}
      style={{ pointerEvents: 'auto' }}
    >
      {/* 右侧抽屉栏展开/收起按钮 */}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg rounded-l-lg px-1 py-10 transition-all duration-300 border border-r-0 border-border"
        onClick={() => setSidebarOpen(!ui.sidebarOpen)}
        title={ui.sidebarOpen ? "收起抽屉栏" : "展开AI对话助手"}
        style={{ pointerEvents: 'auto' }}
      >
        {ui.sidebarOpen ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>
    </div>
  )
}