import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Node as AppNode } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { apiClient, buildRequestConfig } from '@/lib/api'
import { buildNodeContext, parseTocFromMarkdown } from '@/lib/nodeUtils'

function GeneratingState() {
  const steps = [
    '正在分析上下文...',
    '构建知识结构...',
    '生成核心内容...',
    '优化表达细节...',
    '即将完成...'
  ]
  const [index, setIndex] = React.useState(0)
  const [fade, setFade] = React.useState(true)
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex(prev => (prev + 1) % steps.length)
        setFade(true)
      }, 500)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 text-primary h-full">
        <div className="flex space-x-1 shrink-0">
             <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
             <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
             <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
        </div>
        <span 
            className={`text-xs transition-opacity duration-500 whitespace-nowrap overflow-hidden text-ellipsis ${fade ? 'opacity-100' : 'opacity-0'}`}
        >
            {steps[index]}
        </span>
    </div>
  )
}

interface ReactFlowNodeData {
  node: AppNode
  onIdeaClick?: (node: AppNode) => void
  onDoubleClick?: (node: AppNode) => void
}

export function ReactFlowNode({ data, selected }: NodeProps<ReactFlowNodeData>) {
  const { ui, updateNode, deleteNode, preferences } = useAppStore()
  const { node, onIdeaClick, onDoubleClick } = data
  const isDark = ui.theme === 'dark'
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  const handleDoubleClick = () => {
    onDoubleClick?.(node)
  }

  const handleIdeaClick = () => {
    // 显示联想推荐对话框
    onIdeaClick?.(node)
  }

  const handleFavoriteClick = () => {
    updateNode(node.id, {
      ...node,
      favorites: !node.favorites,
    })
  }

  const handleRegenerateClick = async () => {
    // 开始生成：仅设置状态为 generating，移除进度条相关逻辑
    updateNode(node.id, {
      status: 'generating',
      summary: '',
      contentMd: '',
      toc: [],
    })

    try {
      const nodes = useAppStore.getState().nodes
      const edges = useAppStore.getState().edges
      const context = buildNodeContext(node, nodes, edges, node.summary || '')
      const config = buildRequestConfig(useAppStore.getState().preferences)

      const result = await apiClient.generateNode(node.id, {
        theme: node.theme,
        description: node.summary,
        language: preferences.language,
        length: preferences.generationLength,
        style: preferences.writingStyle || undefined,
        context,
        config
      })

      updateNode(node.id, {
        summary: result.summary,
        contentMd: result.contentMd,
        toc: parseTocFromMarkdown(result.contentMd),
        status: 'completed',
        metadata: {
          ...node.metadata,
          updatedAt: new Date(),
          version: node.metadata.version + 1,
        },
      })
    } catch (error: any) {
      console.error('Failed to regenerate node:', error)
      updateNode(node.id, {
        status: 'error',
        metadata: {
          ...node.metadata,
          updatedAt: new Date(),
        },
      })
    }
  }

  const handleDeleteClick = () => {
    // 打开自定义删除确认界面
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    deleteNode(node.id)
    setShowDeleteConfirm(false)
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  return (
    <div
      className={`
        relative w-48 h-28 rounded-lg border-2 p-3 cursor-pointer
        ${selected ? 'ring-2 ring-blue-500' : ''}
        ${isDark
          ? 'bg-gray-800 border-white text-white'
          : 'bg-gray-100 border-black text-black'
        }
        transition-all duration-200 hover:shadow-lg
      `}
      onDoubleClick={handleDoubleClick}
    >
      {showDeleteConfirm && (
        <div
          className={`
            absolute right-[-190px] top-2 w-44 rounded-md border text-xs shadow-lg z-20
            ${isDark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
          `}
        >
          <div className="px-3 py-2">
            <div className="mb-2">
              确定要删除该节点？
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className={`px-2 py-0.5 rounded border text-xs ${
                  isDark
                    ? 'border-gray-600 hover:bg-gray-800'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-0.5 rounded text-xs bg-red-500 text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 连接点 - 顶部 */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`w-3 h-3 ${isDark ? 'bg-white border-white' : 'bg-black border-black'}`}
        style={{
          backgroundColor: isDark ? '#ffffff' : '#000000',
          borderColor: isDark ? '#ffffff' : '#000000',
          top: '-8px',
        }}
      />

      {/* 连接点 - 底部 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`w-3 h-3 ${isDark ? 'bg-white border-white' : 'bg-black border-black'}`}
        style={{
          backgroundColor: isDark ? '#ffffff' : '#000000',
          borderColor: isDark ? '#ffffff' : '#000000',
          bottom: '-8px',
        }}
      />

      {/* 节点内容 */}
      <div className="relative h-full flex flex-col">
        {/* 主题和摘要 */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-1 line-clamp-2 leading-tight">
            {node.theme}
          </h3>
          <div className="text-xs opacity-80 leading-tight h-[2.5em] overflow-hidden">
            {node.status === 'generating' ? (
              <GeneratingState />
            ) : node.status === 'error' ? (
              <span className="text-red-500">生成失败</span>
            ) : (
              <p className="line-clamp-2">{node.summary}</p>
            )}
          </div>
        </div>

        {/* 右侧按钮栏 */}
        <div className="absolute right-[-35px] top-1 flex flex-col gap-1">
          {/* 收藏按钮 */}
          <button
            onClick={handleFavoriteClick}
            className={`w-4 h-4 flex items-center justify-center rounded ${
              node.favorites
                ? 'bg-yellow-400 text-yellow-900'
                : isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
            }`}
            title="收藏"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </button>

          {/* 重新生成按钮 */}
          <button
            onClick={handleRegenerateClick}
            className={`w-4 h-4 flex items-center justify-center rounded ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
            }`}
            title="重新生成"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="m20.49 15.1-2.49-2.49A8 8 0 0 0 5.64 5.64l-2.49 2.49A10 10 0 0 1 20.49 15.1z"></path>
              <path d="M3.51 8.9l2.49 2.49A8 8 0 0 0 18.36 18.36l2.49-2.49A10 10 0 0 1 3.51 8.9z"></path>
            </svg>
          </button>

          {/* 删除按钮 */}
          <button
            onClick={handleDeleteClick}
            className={`w-4 h-4 flex items-center justify-center rounded ${
              isDark ? 'hover:bg-red-800' : 'hover:bg-red-200'
            }`}
            title="删除"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* 联想推荐按钮 */}
          <button
            onClick={handleIdeaClick}
            className={`w-4 h-4 flex items-center justify-center rounded ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
            }`}
            title="联想推荐"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.2 3-3.3 3-5.7 0-3.9-3.1-7-7-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
