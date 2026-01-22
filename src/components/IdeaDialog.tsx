import React, { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, Plus } from 'lucide-react'
import { Node } from '@/types'
import { apiClient, buildRequestConfig } from '@/lib/api'
import { buildNodeContext, parseTocFromMarkdown } from '@/lib/nodeUtils'
import { useAppStore } from '@/stores/appStore'

interface IdeaDialogProps {
  node: Node
  isOpen: boolean
  onClose: () => void
}

export function IdeaDialog({ node, isOpen, onClose }: IdeaDialogProps) {
  const [ideas, setIdeas] = useState<string[]>([])
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addNode, updateNode, addEdge, preferences } = useAppStore()

  // 移除自动触发，仅通过用户点击触发，避免重复调用
  // useEffect(() => {
  //   if (isOpen && node) {
  //     generateIdeas()
  //   }
  // }, [isOpen, node])

  const generateIdeas = async () => {
    if (!node) return

    setIsGenerating(true)
    setError(null)
    setIdeas([])
    setSelectedIdeas(new Set())

    try {
      // 统一的上下文构建
      const nodes = useAppStore.getState().nodes
      const edges = useAppStore.getState().edges
      const context = buildNodeContext(node, nodes, edges, node.summary)
      const config = buildRequestConfig(useAppStore.getState().preferences)

      const result = await apiClient.generateIdeas(node.id, {
        theme: node.theme,
        language: preferences.language,
        context,
        config
      })

      setIdeas(result.ideas)
    } catch (error: any) {
      console.error('Failed to generate ideas:', error)
      setError(error.message || '生成联想推荐失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleIdeaSelection = (index: number) => {
    const newSelected = new Set(selectedIdeas)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedIdeas(newSelected)
  }

  const createSelectedNodes = async () => {
    if (selectedIdeas.size === 0) return

    setIsCreating(true)
    setError(null)

    try {
      const selectedIdeaTexts = Array.from(selectedIdeas).map(index => ideas[index])

      for (const ideaText of selectedIdeaTexts) {
        // 创建子节点（先显示生成状态）
        const childNodeId = crypto.randomUUID()
        const childNode: Node = {
          id: childNodeId,
          projectId: node.projectId,
          parentId: node.id,
          theme: ideaText,
          summary: '',
          contentMd: '',
          toc: [],
          annotations: [],
          favorites: false,
          animations: [],
          position: {
            x: node.position.x + Math.random() * 300 - 150, // 随机位置
            y: node.position.y + 150 + Math.random() * 100
          },
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
          status: 'generating',
          progress: 0,
        }

        // 添加节点
        addNode(childNode)

        // 创建边连接父子节点
        const edgeId = crypto.randomUUID()
        const edge = {
          id: edgeId,
          projectId: node.projectId,
          fromNodeId: node.id,
          toNodeId: childNodeId,
          fromAnchor: 'bottom' as const,
          toAnchor: 'top' as const,
          meta: {
            type: 'parent-child'
          }
        }
        addEdge(edge)

        // 异步生成子节点内容
        try {
          // 获取子节点的上下文（统一构建：已添加边，能正确识别父/兄弟/子）
          const childContext = buildNodeContext(childNode, useAppStore.getState().nodes, useAppStore.getState().edges, '')
          const config = buildRequestConfig(useAppStore.getState().preferences)

          const result = await apiClient.generateNode(childNodeId, {
            theme: ideaText,
            description: ideaText,
            language: preferences.language,
            length: preferences.generationLength,
            style: preferences.writingStyle || undefined,
            context: childContext,
            config
          })

          const updatedChildNode: Node = {
            ...childNode,
            summary: result.summary,
            contentMd: result.contentMd,
            toc: parseTocFromMarkdown(result.contentMd),
            status: 'completed',
            metadata: {
              ...childNode.metadata,
              updatedAt: new Date(),
            },
          }

          updateNode(childNodeId, {
            summary: result.summary,
            contentMd: result.contentMd,
            toc: parseTocFromMarkdown(result.contentMd),
            status: 'completed',
            metadata: {
              ...childNode.metadata,
              updatedAt: new Date(),
            },
          })
        } catch (error) {
          console.error(`Failed to generate content for idea "${ideaText}":`, error)

          const errorChildNode: Node = {
            ...childNode,
            status: 'error',
            metadata: {
              ...childNode.metadata,
              updatedAt: new Date(),
            },
          }

          updateNode(childNodeId, {
            status: 'error',
            metadata: {
              ...childNode.metadata,
              updatedAt: new Date(),
            },
          })
        }
      }

      onClose()
    } catch (error: any) {
      console.error('Failed to create nodes:', error)
      setError(error.message || '创建节点失败')
    } finally {
      setIsCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">联想推荐</h2>
            <p className="text-sm text-muted-foreground mt-1">
              基于主题 "{node.theme}" 生成的相关知识点
            </p>
          </div>
          {/* 新增：联想推荐按钮，手动触发generateIdeas */}
          <button
            onClick={generateIdeas}
            disabled={isGenerating}
            className="ml-2 px-10 py-3 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                生成联想推荐
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isGenerating ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mr-3" />
              <span className="text-muted-foreground">正在生成联想推荐...</span>
            </div>
          ) : ideas.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                选择要创建为子节点的知识点（可多选）：
              </p>

              {ideas.map((idea, index) => (
                <div
                  key={index}
                  className={`p-4 border border-border rounded-lg cursor-pointer transition-colors ${
                    selectedIdeas.has(index)
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => toggleIdeaSelection(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                      selectedIdeas.has(index)
                        ? 'bg-primary border-primary'
                        : 'border-border'
                    }`}>
                      {selectedIdeas.has(index) && (
                        <CheckCircle className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{idea}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !isGenerating && !error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无联想推荐</p>
            </div>
          ) : null}
        </div>

        {/* 底部按钮 */}
        {ideas.length > 0 && (
          <div className="flex justify-end gap-3 p-6 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              onClick={createSelectedNodes}
              disabled={selectedIdeas.size === 0 || isCreating}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  创建 {selectedIdeas.size} 个节点
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
