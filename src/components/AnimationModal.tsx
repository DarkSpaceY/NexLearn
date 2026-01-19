import React, { useState, useEffect } from 'react'
import { X, Play, RefreshCw, Maximize2, Minimize2 } from 'lucide-react'

interface AnimationModalProps {
  isOpen: boolean
  onClose: () => void
  code: string
  title?: string
}

export function AnimationModal({ isOpen, onClose, code, title }: AnimationModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [key, setKey] = useState(0) // Used to reload iframe

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleReload = () => {
    setKey(prev => prev + 1)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-background border border-border rounded-xl shadow-2xl grid grid-rows-[auto,1fr,auto] overflow-hidden transition-all duration-300 min-h-0 ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{title || '交互式动画演示'}</h3>
              <p className="text-xs text-muted-foreground">可交互 · 实时渲染</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReload}
              className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title="重新加载"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-100 hover:text-red-600 rounded-md text-muted-foreground transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white relative min-h-0 overflow-hidden">
          <iframe
            key={key}
            srcDoc={code}
            className="block w-full h-full border-none"
            sandbox="allow-scripts allow-popups allow-forms"
            title="Animation Preview"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground flex justify-between">
          <span>提示：直接在画布上操作以进行交互</span>
          <span>Powered by HTML5 Canvas & JS</span>
        </div>
      </div>
    </div>
  )
}
