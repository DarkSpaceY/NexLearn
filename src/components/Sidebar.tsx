import React, { useRef, useEffect } from 'react'
import { X, Send, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { apiClient, buildRequestConfig } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { nodes, ui, chat, setChatDraft, addChatMessage, setChatLoading } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages, isOpen])

  const handleSendMessage = async () => {
    if (!chat.draft.trim() || chat.isLoading) return

    const userMessageContent = chat.draft.trim()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: userMessageContent,
      timestamp: new Date(),
    }

    addChatMessage(userMessage)
    setChatDraft('')
    setChatLoading(true)

    try {
      // 获取当前选中的节点
      const selectedNode = nodes.find(n => n.id === ui.selectedNodeId)
      
      // 构建上下文
      const context = {
        visibleText: selectedNode 
          ? `当前选中节点: ${selectedNode.theme}\n摘要: ${selectedNode.summary}\n内容片段: ${selectedNode.contentMd?.substring(0, 500)}...` 
          : '当前未选中任何节点',
        nodeTree: nodes.slice(0, 20).map(n => `- ${n.theme}`).join('\n') + (nodes.length > 20 ? '\n...更多节点' : ''),
      }

      // 调用 API：优先使用真实接口，不可用时自动回退到占位实现
      const config = buildRequestConfig(useAppStore.getState().preferences)
      const response = await apiClient.chatSafe({
        message: userMessageContent,
        history: useAppStore.getState().chat.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        context,
        config
      })

      const aiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: response.reply,
        timestamp: new Date(response.generatedAt),
      }
      addChatMessage(aiMessage)
    } catch (error) {
      console.error('Chat failed:', error)
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: '抱歉，对话服务暂时不可用。请稍后再试。',
        timestamp: new Date(),
      }
      addChatMessage(errorMessage)
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-lg z-[60] flex flex-col transition-all duration-300 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">AI 对话助手</h2>
        <button
          className="p-2 hover:bg-accent rounded-md transition-colors"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {chat.messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">开始与AI助手对话</p>
              <p className="text-xs mt-2">助手已接入当前节点上下文</p>
            </div>
          ) : (
            chat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          {chat.isLoading && (
             <div className="flex justify-start">
               <div className="bg-muted px-4 py-3 rounded-lg flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span className="text-xs text-muted-foreground">AI 正在思考...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={chat.draft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              disabled={chat.isLoading}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chat.draft.trim() || chat.isLoading}
              className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
