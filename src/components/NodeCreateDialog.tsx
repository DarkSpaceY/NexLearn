import React, { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { apiClient } from '@/lib/api'
import { Node } from '@/types'
import { buildNodeContext, parseTocFromMarkdown } from '@/lib/nodeUtils'

interface NodeCreateDialogProps {
  isOpen: boolean
  x: number
  y: number
  onClose: () => void
}

export function NodeCreateDialog({ isOpen, x, y, onClose }: NodeCreateDialogProps) {
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [isPublic, setIsPublic] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSubmittingRef = useRef(false)
  const { addNode, updateNode, nodes, currentProject, preferences, ui } = useAppStore()
  const isDark = ui.theme === 'dark'

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // 重置表单
  useEffect(() => {
    if (isOpen) {
      setTheme('')
      setDescription('')
      setParentId(null)
      setTags([])
      setPriority('medium')
      setIsPublic(false)
      isSubmittingRef.current = false
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!theme.trim() || isSubmittingRef.current) return
    isSubmittingRef.current = true

    const nodeId = crypto.randomUUID()
    const canvasPos = { x, y }
    const projectId = currentProject?.id || 'default'

    // 创建初始节点（显示生成状态）
    const initialNode: Node = {
      id: nodeId,
      projectId,
      parentId: parentId || undefined,
      theme: theme.trim(),
      summary: description.trim() || '',
      contentMd: '',
      toc: [],
      annotations: [],
      favorites: false,
      animations: [],
      position: canvasPos,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
      status: 'generating',
    }

    // 添加节点到画布并显示生成状态
    addNode(initialNode)
    
    // 立即关闭弹窗，让生成在后台进行，并在节点上显示遮罩
    onClose()

    // 后台执行生成逻辑
    const generateInBackground = async () => {
      try {
        const context = buildNodeContext(initialNode, nodes, useAppStore.getState().edges, description.trim())

        const result = await apiClient.generateNode(nodeId, {
          theme: theme.trim(),
          description: description.trim() || undefined,
          language: 'zh-CN',
          length: 'medium',
          context
        })

        // 更新节点内容
        updateNode(nodeId, {
          summary: result.summary,
          contentMd: result.contentMd,
          toc: parseTocFromMarkdown(result.contentMd),
          status: 'completed',
          metadata: {
            ...initialNode.metadata,
            updatedAt: new Date(),
          },
        })

      } catch (error) {
        const message = error instanceof Error ? error.message : '生成失败'

        // 更新节点状态为错误
        updateNode(nodeId, {
          status: 'error',
          summary: `生成失败：${message}`,
          metadata: {
            ...initialNode.metadata,
            updatedAt: new Date(),
          },
        })
      }
    }

    generateInBackground()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e)
    }
  }

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()])
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`border rounded-lg shadow-xl w-full max-w-md ${
          isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
        }`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            创建新节点
          </h3>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${
              isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {/* 节点主题 */}
          <div className="mb-4">
            <label htmlFor="theme" className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              节点主题 *
            </label>
            <input
              ref={inputRef}
              id="theme"
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入节点主题..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
              }`}
              required
            />
          </div>

          {/* 描述 */}
          <div className="mb-4">
            <label htmlFor="description" className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              描述（可选）
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述这个节点的内容..."
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
          </div>

          {/* 父节点选择 */}
          <div className="mb-4">
            <label htmlFor="parent" className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              父节点（可选）
            </label>
            <select
              id="parent"
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
              }`}
            >
              <option value="">无父节点</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.theme}
                </option>
              ))}
            </select>
          </div>

          {/* 标签 */}
          <div className="mb-4">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              标签
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                    isDark ? 'bg-blue-600 text-blue-100' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="输入标签，按回车添加..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const input = e.target as HTMLInputElement
                  addTag(input.value)
                  input.value = ''
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
          </div>

          {/* 优先级和公开性 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="priority" className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                优先级
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                }`}
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mr-2"
                />
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  公开
                </span>
              </label>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-sm border rounded-md transition-colors ${
                isDark
                  ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!theme.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              生成节点
            </button>
          </div>

          {/* 快捷键提示 */}
          <div className={`mt-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            提示：按 Ctrl+Enter 或 Cmd+Enter 快速生成
          </div>
        </form>
      </div>
    </div>
  )
}
