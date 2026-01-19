import * as Tooltip from '@radix-ui/react-tooltip'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, Copy, Heart, Wand2, Network, MessageSquare, PlusCircle, Edit3 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Node } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { apiClient } from '@/lib/api'
import copy from 'clipboard-copy'
import { buildNodeContext, parseTocFromMarkdown, createNode } from '@/lib/nodeUtils'
import { runPython, PyProgress } from '@/lib/pythonSandbox'
import { MindMapGraph } from './MindMapGraph'

interface NodeDetailViewProps {
  node: Node
  onClose: () => void
}

import { AnimationModal } from './AnimationModal'

export function NodeDetailView({ node: initialNode, onClose }: NodeDetailViewProps) {
  // 从 store 中订阅最新的 node 数据
  const node = useAppStore(state => state.nodes.find(n => n.id === initialNode.id) || initialNode)
  const { ui, updateNode } = useAppStore()
  const isDark = ui.theme === 'dark'
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set())
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number} | null>(null)
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null)
  const [sandboxOpen, setSandboxOpen] = useState(false)
  const [sandboxLanguage, setSandboxLanguage] = useState<'html' | 'javascript' | 'python' | 'java' | 'cpp'>('javascript')
  const [sandboxCode, setSandboxCode] = useState('')
  const [sandboxStdin, setSandboxStdin] = useState('')
  const [sandboxStdout, setSandboxStdout] = useState('')
  const [sandboxStderr, setSandboxStderr] = useState('')
  const [sandboxIframeDoc, setSandboxIframeDoc] = useState<string | null>(null)
  const sandboxTokenRef = useRef<string>('')
  const pyodideRef = useRef<any>(null)
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const codeHighlightRef = useRef<HTMLDivElement | null>(null)
  const [pythonInstalling, setPythonInstalling] = useState(false)
  const [pythonProgress, setPythonProgress] = useState(0)
  const [pythonMessages, setPythonMessages] = useState<string[]>([])
  
  const [animationModal, setAnimationModal] = useState<{ isOpen: boolean; code: string; title: string; animId?: string }>({ 
    isOpen: false, 
    code: '', 
    title: '',
    animId: undefined
  })
  
  const [annotationDialog, setAnnotationDialog] = useState<{ 
    isOpen: boolean; 
    text: string; 
    targetText: string;
    range?: { start: number; end: number }
  }>({
    isOpen: false,
    text: '',
    targetText: ''
  })

  // 监听动画状态变化，实现自动更新
  useEffect(() => {
    if (animationModal.isOpen && animationModal.animId) {
      const anim = node.animations?.find(a => a.id === animationModal.animId)
      if (anim && anim.meta?.status === 'completed' && anim.meta.code) {
        // 如果当前显示的是占位代码（通过检测是否包含 loader 样式特征），或者代码内容更新了
        const isPlaceholder = animationModal.code.includes('class="loader"')
        if (isPlaceholder || anim.meta.code !== animationModal.code) {
             setAnimationModal(prev => ({
               ...prev,
               code: anim.meta.code!,
               title: anim.meta.title || prev.title
             }))
        }
      }
    }
  }, [node.animations, animationModal.isOpen, animationModal.animId, animationModal.code])

  // 生成代码块ID的计数器
  const codeBlockCounter = React.useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const sidePanelRef = useRef<HTMLDivElement>(null)
  const computedToc = React.useMemo(() => {
    const content = node.contentMd || ''
    if (!content) return []
    const lines = content.split('\n')
    const toc: Array<{ level: number; text: string; anchor: string; lineIndex: number }> = []
    let inFence = false
    lines.forEach((raw, index) => {
      const line = raw.trimEnd()
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence
        return
      }
      if (inFence) return
      const match = /^(#{1,3})\s+(.+)$/.exec(line.trimStart())
      if (!match) return
      const level = match[1].length
      const text = match[2].trim()
      if (!text) return
      const slug = text.replace(/\s+/g, '-').toLowerCase()
      const anchor = `h${level}-${slug}`
      toc.push({ level, text, anchor, lineIndex: index })
    })
    return toc
  }, [node.contentMd])

  const handleCopyCode = useCallback(async (code: string, index: number) => {
    try {
      await copy(code)
      const blockId = `code-${index}`
      setCopiedBlocks(prev => new Set(prev).add(blockId))
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const newSet = new Set(prev)
          newSet.delete(blockId)
          return newSet
        })
      }, 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }, [])

  const normalizeSandboxLanguage = useCallback((raw: string): 'html' | 'javascript' | 'python' | 'java' | 'cpp' => {
    const lang = raw.trim().toLowerCase()
    if (lang === 'js' || lang === 'javascript' || lang === 'jsx' || lang === 'ts' || lang === 'tsx') return 'javascript'
    if (lang === 'html') return 'html'
    if (lang === 'py' || lang === 'python') return 'python'
    if (lang === 'java') return 'java'
    if (lang === 'cpp' || lang === 'c++') return 'cpp'
    return 'javascript'
  }, [])

  const openSandboxFromCodeBlock = useCallback((code: string, rawLanguage: string) => {
    setSandboxOpen(true)
    setSandboxCode(code)
    setSandboxLanguage(normalizeSandboxLanguage(rawLanguage))
    setSandboxStdout('')
    setSandboxStderr('')
    setSandboxIframeDoc(null)
    setSandboxStdin('')
  }, [normalizeSandboxLanguage])

  useEffect(() => {
    if (!sandboxOpen) return

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as any
      if (!data || data.token !== sandboxTokenRef.current) return

      if (data.type === 'log') {
        setSandboxStdout(prev => (prev ? `${prev}\n${data.payload}` : String(data.payload)))
        return
      }
      if (data.type === 'error') {
        setSandboxStderr(prev => (prev ? `${prev}\n${data.payload}` : String(data.payload)))
        return
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [sandboxOpen])

  const onCodeScrollSync = useCallback(() => {
    // 将文本域滚动位置同步到高亮层，保证两者一致
    const ta = codeTextareaRef.current
    const hi = codeHighlightRef.current
    if (ta && hi) {
      hi.scrollTop = ta.scrollTop
      hi.scrollLeft = ta.scrollLeft
    }
  }, [])

  const highlightLang = useCallback(() => {
    // 将当前语言映射到高亮库支持的名称
    switch (sandboxLanguage) {
      case 'javascript': return 'javascript'
      case 'html': return 'html'
      case 'python': return 'python'
      case 'java': return 'java'
      case 'cpp': return 'cpp'
      default: return 'javascript'
    }
  }, [sandboxLanguage])

  const runSandbox = useCallback(async () => {
    setSandboxStdout('')
    setSandboxStderr('')

    if (sandboxLanguage === 'html') {
      setSandboxIframeDoc(sandboxCode)
      return
    }

    if (sandboxLanguage === 'python') {
      try {
        // 使用抽取的 Python 沙箱工具执行，并展示进度
        setPythonInstalling(true)
        setPythonProgress(0)
        setPythonMessages([])
        const onProgress = (p: PyProgress) => {
          if (typeof p.percent === 'number') setPythonProgress(Math.max(0, Math.min(100, p.percent)))
          if (p.message) setPythonMessages(prev => [...prev, p.message!].slice(-10))
        }
        const { stdout, stderr } = await runPython(sandboxCode || '', sandboxStdin || '', onProgress)
        setSandboxStdout(stdout || '')
        setSandboxStderr(stderr || '')
        setSandboxIframeDoc(null)
        setPythonInstalling(false)
      } catch (error: any) {
        setSandboxStderr(error?.message || 'Python 沙箱运行失败')
        setPythonInstalling(false)
      }
      return
    }

    if (sandboxLanguage === 'javascript') {
      const token = crypto.randomUUID()
      sandboxTokenRef.current = token

      const safeCode = sandboxCode.replace(/<\/script>/gi, '<\\/script>')
      const srcDoc = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        const token = ${JSON.stringify(token)};
        const send = (type, payload) => parent.postMessage({ token, type, payload }, '*');
        const format = (args) => args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
        }).join(' ');
        console.log = (...args) => send('log', format(args));
        console.error = (...args) => send('error', format(args));
        window.onerror = (message) => {
          send('error', String(message));
        };
        try {
          (function () {
${safeCode}
          })();
        } catch (e) {
          send('error', e && e.stack ? e.stack : String(e));
        }
      })();
    </script>
  </body>
</html>`

      setSandboxIframeDoc(srcDoc)
      return
    }

    try {
      // 执行代码：优先调用后端接口，不可用时回退到占位实现
      const result = await apiClient.executeCodeSafe({
        code: sandboxCode,
        language: sandboxLanguage,
        stdin: sandboxStdin,
      })
      setSandboxStdout(result.stdout || '')
      setSandboxStderr(result.stderr || '')
      setSandboxIframeDoc(result.output || null)
    } catch (error: any) {
      setSandboxStderr(error?.message || '运行失败')
    }
  }, [sandboxCode, sandboxLanguage, sandboxStdin])

  const [viewMode, setViewMode] = useState<'text' | 'mindmap'>('text')
  const [mindmapData, setMindmapData] = useState<{ nodes: any[], edges: any[] } | null>(null)
  const [selectedMindmapNode, setSelectedMindmapNode] = useState<string | null>(null)

  // 根据 TOC 生成思维导图数据
  useEffect(() => {
    if (!computedToc.length) {
      setMindmapData(null)
      return
    }

    const nodes: any[] = []
    const edges: any[] = []
    
    const lines = (node.contentMd || '').split('\n')
    
    // 计算每一行的起始字符索引
    const lineStartIndices: number[] = [0]
    let currentLength = 0
    lines.forEach(line => {
      currentLength += line.length + 1 // +1 for newline
      lineStartIndices.push(currentLength)
    })

    // 根节点
    const rootId = 'root'
    // 计算根节点是否有内容
    const firstHeaderLine = computedToc.length > 0 ? computedToc[0].lineIndex : lines.length
    const rootHasContent = lines.slice(0, firstHeaderLine).some(l => l.trim().length > 0)
    
    // 计算根节点的统计信息
    const rootEndChar = lineStartIndices[firstHeaderLine] || currentLength
    const rootAnnotations = (node.annotations || []).filter(a => {
      const start = a.range?.start || 0
      return start >= 0 && start < rootEndChar
    })
    const rootAnimations = (node.animations || []).filter(a => {
      const start = a.meta?.range?.start
      if (typeof start === 'number') {
        return start >= 0 && start < rootEndChar
      }
      return false
    })

    nodes.push({
      id: rootId,
      text: node.theme,
      position: { x: 0, y: 0 },
      hasContent: rootHasContent,
      stats: {
        hasAnnotations: rootAnnotations.some(a => a.type !== 'favorite'),
        hasFavorites: rootAnnotations.some(a => a.type === 'favorite'),
        hasAnimations: rootAnimations.length > 0
      }
    })

    // 构建层级关系
    const stack: { id: string; level: number }[] = [{ id: rootId, level: 0 }]

    computedToc.forEach((item, index) => {
      const id = item.anchor || `node-${index}`
      
      // 找到父节点
      while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
        stack.pop()
      }
      const parent = stack[stack.length - 1]

      // 计算是否有内容
      const startLine = item.lineIndex + 1 // 内容从标题下一行开始
      const nextItem = computedToc[index + 1]
      const endLine = nextItem ? nextItem.lineIndex : lines.length
      const hasContent = lines.slice(startLine, endLine).some(l => l.trim().length > 0)

      // 计算统计信息
      // 注意：统计范围包括标题行本身，以便包含标题上的标记
      const sectionStartChar = lineStartIndices[item.lineIndex]
      const sectionEndChar = lineStartIndices[endLine] || currentLength

      const sectionAnnotations = (node.annotations || []).filter(a => {
        const start = a.range?.start || 0
        return start >= sectionStartChar && start < sectionEndChar
      })

      const sectionAnimations = (node.animations || []).filter(a => {
        const start = a.meta?.range?.start
        if (typeof start === 'number') {
          return start >= sectionStartChar && start < sectionEndChar
        }
        return false
      })

      nodes.push({
        id,
        text: item.text,
        parentId: parent.id,
        anchor: item.anchor, // 保存 anchor 用于定位
        position: { x: 0, y: 0 }, // D3 会自动计算
        hasContent,
        stats: {
          hasAnnotations: sectionAnnotations.some(a => a.type !== 'favorite'),
          hasFavorites: sectionAnnotations.some(a => a.type === 'favorite'),
          hasAnimations: sectionAnimations.length > 0
        }
      })

      edges.push({
        id: `edge-${parent.id}-${id}`,
        fromId: parent.id,
        toId: id
      })

      stack.push({ id, level: item.level })
    })

    setMindmapData({ nodes, edges })
  }, [computedToc, node.theme, node.contentMd, node.annotations, node.animations])

  const handleMindMapClick = useCallback(() => {
    setViewMode(prev => prev === 'text' ? 'mindmap' : 'text')
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedMindmapNode(prev => prev === nodeId ? null : nodeId)
  }, [])

  // 使用 useMemo 缓存 components 对象，防止重渲染导致 DOM 重建和选区丢失
  const markdownComponents = React.useMemo(() => ({
    pre: ({ children }: any) => <>{children}</>,

    span: ({ className, children, ...props }: any) => {
      if (className?.includes('animation-link')) {
        const animId = props['data-animation-id']
        const anim = node.animations?.find(a => a.id === animId)
        const isGenerating = anim?.meta?.status === 'generating'

        return (
          <span
            className={`
              relative inline-block px-1 mx-0.5 rounded cursor-pointer transition-colors border-b-2 border-primary/30
              ${isGenerating ? 'bg-yellow-100 dark:bg-yellow-900/30 text-foreground animate-pulse' : 'bg-primary/5 hover:bg-primary/10 text-primary font-medium'}
            `}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!anim) return

              if (anim.meta?.status === 'completed' && anim.meta.code) {
                setAnimationModal({
                  isOpen: true,
                  code: anim.meta.code,
                  title: anim.meta.title || '交互式动画',
                  animId: anim.id
                })
                return
              }

              if (anim.meta?.status === 'generating') {
                const loadingCode = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                        background: transparent; 
                        font-family: system-ui, -apple-system, sans-serif;
                      }
                      .container {
                        text-align: center;
                        padding: 40px;
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                      }
                      .loader {
                        width: 48px;
                        height: 48px;
                        border: 5px solid #3b82f6;
                        border-bottom-color: transparent;
                        border-radius: 50%;
                        display: inline-block;
                        box-sizing: border-box;
                        animation: rotation 1s linear infinite;
                        margin-bottom: 20px;
                      }
                      @keyframes rotation {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                      .text {
                        color: #64748b;
                        font-size: 16px;
                        font-weight: 500;
                        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                      }
                      @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: .5; }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <span class="loader"></span>
                      <div class="text">正在生成交互式动画...</div>
                      <div style="color: #94a3b8; font-size: 13px; margin-top: 8px;">AI 正在编写代码并构建可视化效果</div>
                    </div>
                  </body>
                  </html>
                `
                setAnimationModal({
                  isOpen: true,
                  code: loadingCode,
                  title: '正在生成...',
                  animId: anim.id
                })
                return
              }

              if (anim.meta?.status === 'error') {
                alert('动画生成失败')
              }
            }}
            title={isGenerating ? '正在生成动画...' : '点击播放交互式动画'}
          >
            {children}
            {isGenerating && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
            )}
          </span>
        )
      }
      if (className?.includes('annotation-highlight')) {
        const title = props.title || ''
        // 移除原生 title 属性以避免双重提示
        const { title: _, ...rest } = props
        return (
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span 
                  className="border-b-2 border-dashed border-blue-500 cursor-help hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  {...rest}
                >
                  {children}
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content 
                  className="z-50 max-w-xs px-3 py-2 text-sm text-white bg-black rounded-md shadow-md animate-in fade-in-0 zoom-in-95"
                  sideOffset={5}
                >
                  {title}
                  <Tooltip.Arrow className="fill-black" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )
      }
      if (className?.includes('favorite-highlight')) {
        return (
          <span 
            className="border-b-2 border-dashed border-yellow-500 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors"
            {...props}
          >
            {children}
          </span>
        )
      }
      return <span className={className} {...props}>{children}</span>
    },
    a: ({ href, children, ...props }: any) => {
        if (href?.startsWith('animation:')) {
            const animId = href.replace('animation:', '')
            const anim = node.animations?.find(a => a.id === animId)
            const isGenerating = anim?.meta?.status === 'generating'
            
            return (
                <span 
                    className={`
                        relative inline-block px-1 mx-0.5 rounded cursor-pointer transition-colors border-b-2 border-primary/30
                        ${isGenerating ? 'bg-yellow-100 dark:bg-yellow-900/30 text-foreground animate-pulse' : 'bg-primary/5 hover:bg-primary/10 text-primary font-medium'}
                    `}
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (anim) {
                          if (anim.meta?.status === 'completed' && anim.meta.code) {
                              setAnimationModal({
                                      isOpen: true,
                                      code: anim.meta.code,
                                      title: anim.meta.title || '交互式动画',
                                      animId: anim.id
                                  })
                              } else if (anim.meta?.status === 'generating') {
                                  // 占位加载动画
                                  const loadingCode = `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <style>
                                        body { 
                                          display: flex; 
                                          justify-content: center; 
                                          align-items: center; 
                                          height: 100vh; 
                                          margin: 0; 
                                          background: transparent; 
                                          font-family: system-ui, -apple-system, sans-serif;
                                        }
                                        .container {
                                          text-align: center;
                                          padding: 40px;
                                          background: white;
                                          border-radius: 16px;
                                          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                                        }
                                        .loader {
                                          width: 48px;
                                          height: 48px;
                                          border: 5px solid #3b82f6;
                                          border-bottom-color: transparent;
                                          border-radius: 50%;
                                          display: inline-block;
                                          box-sizing: border-box;
                                          animation: rotation 1s linear infinite;
                                          margin-bottom: 20px;
                                        }
                                        @keyframes rotation {
                                          0% { transform: rotate(0deg); }
                                          100% { transform: rotate(360deg); }
                                        }
                                        .text {
                                          color: #64748b;
                                          font-size: 16px;
                                          font-weight: 500;
                                          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                                        }
                                        @keyframes pulse {
                                          0%, 100% { opacity: 1; }
                                          50% { opacity: .5; }
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="container">
                                        <span class="loader"></span>
                                        <div class="text">正在生成交互式动画...</div>
                                        <div style="color: #94a3b8; font-size: 13px; margin-top: 8px;">AI 正在编写代码并构建可视化效果</div>
                                      </div>
                                    </body>
                                    </html>
                                  `
                                  setAnimationModal({
                                      isOpen: true,
                                      code: loadingCode,
                                      title: '正在生成...',
                                      animId: anim.id
                                  })
                          } else if (anim.meta?.status === 'error') {
                              alert('动画生成失败')
                          }
                        }
                    }}
                    title={isGenerating ? '正在生成动画...' : '点击播放交互式动画'}
                >
                    {children}
                    {isGenerating && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                        </span>
                    )}
                </span>
            )
        }
        
        if (href?.startsWith('highlight:')) {
             return (
                 <span className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-0.5 rounded cursor-help" title="高亮">
                    {children}
                 </span>
             )
        }
        
        return <a href={href} {...props} className="text-primary underline hover:no-underline">{children}</a>
    },

    code({ inline, className, children }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const code = String(children).replace(/\n$/, '')
      
      // Mermaid 图表支持 - 已移除
      // if (!inline && match && match[1] === 'mermaid') {
      //   return <MermaidDiagram chart={code} isDark={isDark} />
      // }

      // 注意：在 memoized 组件中，ref 的变化不会触发重渲染，但这里的逻辑依赖 ref 来生成 ID
      // 我们使用一个简单的方式生成 ID，不依赖 ref 的自增副作用
      const blockId = `code-${code.substring(0, 10).replace(/\s/g, '')}`

      return !inline && match ? (
        <div className="relative group my-4">
          {/* 复制按钮等 UI */}
          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => handleCopyCode(code, 0)} // 简化 index 传递
              className="p-1.5 bg-card/80 hover:bg-card border border-border rounded-md transition-colors"
              title="复制代码"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => openSandboxFromCodeBlock(code, match[1])}
              className="p-1.5 bg-card/80 hover:bg-card border border-border rounded-md transition-colors"
              title="在沙箱中打开"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <SyntaxHighlighter
            style={isDark ? (vscDarkPlus as any) : (materialLight as any)}
            language={match[1]}
            showLineNumbers={true}
            wrapLines={true}
            customStyle={{
              margin: 0,
              borderRadius: '8px',
              fontSize: '0.875rem',
              lineHeight: '1.5',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              background: isDark ? '#1e1e1e' : '#f5f5f5',
              padding: '1rem',
              border: `1px solid ${isDark ? '#333' : '#e5e5e5'}`
            }}
            codeTagProps={{
              style: {
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className={`${className} bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground border border-border/50`}
        >
          {children}
        </code>
      )
    },
    h1: ({ children, ...props }: any) => (
      <h1
        id={`h1-${String(children).replace(/\s+/g, '-').toLowerCase()}`}
        className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-border text-foreground scroll-mt-20"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2
        id={`h2-${String(children).replace(/\s+/g, '-').toLowerCase()}`}
        className="text-2xl font-semibold mt-6 mb-3 text-foreground scroll-mt-20"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3
        id={`h3-${String(children).replace(/\s+/g, '-').toLowerCase()}`}
        className="text-xl font-semibold mt-5 mb-2 text-foreground scroll-mt-20"
        {...props}
      >
        {children}
      </h3>
    ),
    ul: ({ children, ...props }: any) => (
      <ul
        className="list-disc list-inside space-y-1 my-4 pl-6 text-foreground"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol
        className="list-decimal list-inside space-y-1 my-4 pl-6 text-foreground"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li
        className="text-foreground leading-relaxed mb-2"
        {...props}
      >
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote
        className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/30 rounded-r-md italic text-foreground"
        {...props}
      >
        {children}
      </blockquote>
    ),
    strong: ({ children, ...props }: any) => (
      <strong
        className="font-bold text-foreground"
        {...props}
      >
        {children}
      </strong>
    ),
    em: ({ children, ...props }: any) => (
      <em
        className="italic text-foreground"
        {...props}
      >
        {children}
      </em>
    ),
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-6">
        <table
          className="w-full border-collapse border border-border bg-card rounded-lg overflow-hidden shadow-sm"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th
        className="bg-muted/50 text-foreground font-semibold border border-border px-4 py-3 text-left"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td
        className="text-foreground border border-border px-4 py-3"
        {...props}
      >
        {children}
      </td>
    )
  }), [isDark, copiedBlocks, handleCopyCode, openSandboxFromCodeBlock, node.animations]) // 依赖项：主题和复制状态

  // 统一的 Markdown 渲染样式
  const markdownProseClasses = `
    prose prose-sm max-w-none dark:prose-invert
    prose-headings:text-foreground prose-headings:font-semibold
    prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-4
    prose-strong:text-foreground prose-strong:font-semibold
    prose-em:text-foreground prose-em:italic
    prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
    prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:shadow-sm
    prose-blockquote:text-foreground prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic
    prose-ul:text-foreground prose-ol:text-foreground
    prose-li:text-foreground prose-li:mb-2
    prose-a:text-primary prose-a:underline hover:prose-a:no-underline
    prose-table:text-foreground
    prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2
    prose-td:text-foreground prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2
    prose-hr:border-border prose-hr:my-8
  `.replace(/\s+/g, ' ').trim()

  // 简单的文本高亮与动画处理函数
  const processContent = useCallback((content: string, annotations: any[], animations: any[]) => {
    if (!content) return ''
    
    // 1. Collect all entities with ranges
    const entities: { start: number; end: number; type: string; data: any }[] = []
    
    // Annotations & Favorites
    if (annotations) {
      annotations.forEach(anno => {
        if (anno.range) {
          entities.push({ ...anno.range, type: anno.type, data: anno })
        } else if (anno.text) {
           // Fallback for old annotations without range
           const idx = content.indexOf(anno.text)
           if (idx !== -1) {
             entities.push({ start: idx, end: idx + anno.text.length, type: anno.type, data: anno })
           }
        }
      })
    }
    
    // Animations
    if (animations) {
      animations.forEach(anim => {
        if (anim.meta?.range) {
           entities.push({ ...anim.meta.range, type: 'animation', data: anim })
        } else if (anim.meta?.note) {
           // Fallback
           const idx = content.indexOf(anim.meta.note)
           if (idx !== -1) {
             entities.push({ start: idx, end: idx + anim.meta.note.length, type: 'animation', data: anim })
           }
        }
      })
    }
    
    if (entities.length === 0) return content
    
    // 2. Create markers
    const markers: { index: number; type: 'start' | 'end'; entity: any }[] = []
    entities.forEach(e => {
       // Validate range
       if (e.start >= 0 && e.end <= content.length && e.start < e.end) {
         markers.push({ index: e.start, type: 'start', entity: e })
         markers.push({ index: e.end, type: 'end', entity: e })
       }
    })
    
    // Sort markers: index asc. If index equal, 'end' before 'start'
    markers.sort((a, b) => {
       if (a.index !== b.index) return a.index - b.index
       if (a.type !== b.type) return a.type === 'end' ? -1 : 1
       return 0
    })
    
    // 3. Build string
    let result = ''
    let lastIndex = 0
    
    markers.forEach(m => {
       // Append text before marker
       if (m.index > lastIndex) {
         result += content.slice(lastIndex, m.index)
         lastIndex = m.index
       }
       
       if (m.type === 'start') {
          // Open tag
          if (m.entity.type === 'favorite') {
             result += `<span id="fav-${m.entity.data.id}" class="favorite-highlight" data-favorite-id="${m.entity.data.id}">`
          } else if (m.entity.type === 'comment') {
             result += `<span class="annotation-highlight" title="${m.entity.data.text}">`
          } else if (m.entity.type === 'highlight') {
             result += `<a href="highlight:true">`
          } else if (m.entity.type === 'animation') {
             result += `<span class="animation-link" data-animation-id="${m.entity.data.id}">`
          }
       } else {
          // Close tag
          if (m.entity.type === 'highlight') {
            result += `</a>`
            return
          }
          result += `</span>`
       }
    })
    
    // Append remaining text
    if (lastIndex < content.length) {
       result += content.slice(lastIndex)
    }
    
    return result
  }, [])

  // 渲染思维导图节点内容
  const renderMindmapContent = useCallback(() => {
    if (!selectedMindmapNode) return null
    
    const lines = (node.contentMd || '').split('\n')
    const lineStartIndices: number[] = [0]
    let totalLength = 0
    lines.forEach(line => {
      totalLength += line.length + 1
      lineStartIndices.push(totalLength)
    })

    let content = ''
    let sectionStartChar = 0
    let sectionEndChar = 0
    let prefix = ''

    if (selectedMindmapNode === 'root') {
      const firstHeaderLine = computedToc.length > 0 ? computedToc[0].lineIndex : lines.length
      sectionStartChar = 0
      sectionEndChar = lineStartIndices[firstHeaderLine] || totalLength
      content = lines.slice(0, firstHeaderLine).join('\n')
      prefix = `# ${node.theme}\n\n`
    } else {
      const itemIndex = computedToc.findIndex(t => t.anchor === selectedMindmapNode)
      if (itemIndex === -1) return null

      const item = computedToc[itemIndex]
      const nextItem = computedToc[itemIndex + 1]
      const endLine = nextItem ? nextItem.lineIndex : lines.length
      sectionStartChar = lineStartIndices[item.lineIndex] || 0
      sectionEndChar = lineStartIndices[endLine] || totalLength
      content = lines.slice(item.lineIndex, endLine).join('\n')
    }

    const offset = prefix.length
    const adjustedAnnotations = (node.annotations || [])
      .filter(a => {
        const start = a.range?.start
        if (typeof start !== 'number') return false
        return start >= sectionStartChar && start < sectionEndChar
      })
      .map(a => ({
        ...a,
        range: {
          start: a.range.start - sectionStartChar + offset,
          end: a.range.end - sectionStartChar + offset,
        }
      }))

    const adjustedAnimations = (node.animations || [])
      .filter(a => {
        const start = a.meta?.range?.start
        if (typeof start !== 'number') return false
        return start >= sectionStartChar && start < sectionEndChar
      })
      .map(a => ({
        ...a,
        meta: {
          ...a.meta,
          range: {
            start: a.meta.range.start - sectionStartChar + offset,
            end: a.meta.range.end - sectionStartChar + offset,
          }
        }
      }))

    const markdown = `${prefix}${content}`
    
    return (
      <div className="h-full flex flex-col">
        <div 
          ref={sidePanelRef}
          className={`flex-1 overflow-y-auto p-4 ${markdownProseClasses}`}
        >
           <ReactMarkdown
              key={selectedMindmapNode}
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {processContent(markdown, adjustedAnnotations, adjustedAnimations)}
            </ReactMarkdown>
        </div>
      </div>
    )
  }, [selectedMindmapNode, computedToc, node.annotations, node.animations, node.contentMd, node.theme, markdownComponents, markdownProseClasses, processContent])

  // 移除滚动逻辑，因为现在只显示对应内容
  useEffect(() => {
    if (selectedMindmapNode && sidePanelRef.current) {
        sidePanelRef.current.scrollTop = 0
    }
  }, [selectedMindmapNode])

  // 划词高亮滚动事件与位置计算已移除

  const handleSectionClick = (anchor: string) => {
    setSelectedSection(anchor)
    // 滚动到指定位置
    const element = document.getElementById(anchor)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleTextSelection = useCallback(() => {
    // 延迟执行以避免与React渲染冲突
    setTimeout(() => {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const text = selection.toString().trim()
        if (text.length > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          
          // 确保选区在内容区域内
          if (contentRef.current && !contentRef.current.contains(selection.anchorNode)) {
            return
          }

          // 计算 Markdown 中的位置
          if (contentRef.current) {
            const preRange = range.cloneRange()
            preRange.selectNodeContents(contentRef.current)
            preRange.setEnd(range.startContainer, range.startOffset)
            const preText = preRange.toString()
            const occurrences = preText.split(text).length - 1
            
            let startIdx = -1
            const contentMd = node.contentMd || ''
            for (let i = 0; i <= occurrences; i++) {
              startIdx = contentMd.indexOf(text, startIdx + 1)
              if (startIdx === -1) break
            }
            
            if (startIdx !== -1) {
              setSelectionRange({ start: startIdx, end: startIdx + text.length })
            } else {
              setSelectionRange(null)
            }
          }

          setSelectedText(text)
          setToolbarPosition({
            x: rect.left + rect.width / 2,
            y: rect.top < 60 ? rect.bottom + 10 : rect.top - 50
          })
        } else {
          setSelectedText('')
          setSelectionRange(null)
          setToolbarPosition(null)
        }
      } else {
        setSelectedText('')
        setSelectionRange(null)
        setToolbarPosition(null)
      }
    }, 10)
  }, [node.contentMd])

  const handleToolbarAction = async (action: string) => {
    // 悬浮工具条动作：不涉及高亮，仅实现批注/收藏/加入聊天/生成动画/扩展
    const { updateNode, addNode, addEdge, setSidebarOpen, setChatDraft, nodes, edges } = useAppStore.getState()
    const text = selectedText.trim()
    if (!text) return

    if (action === 'annotate') {
      // 批注：打开自定义对话框
      setAnnotationDialog({
        isOpen: true,
        text: '',
        targetText: text,
        range: selectionRange || undefined
      })
      setToolbarPosition(null)
      return
    }

    if (action === 'favorite') {
      // 收藏：记录原文到收藏库
      const idx = selectionRange ? selectionRange.start : (node.contentMd || '').indexOf(text)
      const range = selectionRange || { start: Math.max(0, idx), end: Math.max(0, idx) + text.length }
      
      const favAnno = {
        id: crypto.randomUUID(),
        range,
        text,
        originalText: text,
        author: '用户',
        timestamp: new Date(),
        type: 'favorite' as const,
      }
      updateNode(node.id, { annotations: [...(node.annotations || []), favAnno] })
      setSelectedText('')
      setSelectionRange(null)
      setToolbarPosition(null)
      return
    }

    if (action === 'add_to_chat') {
      // 加入聊天：打开侧栏，并填充草稿为选中文本
      setSidebarOpen(true)
      setChatDraft(text)
      setSelectedText('')
      setToolbarPosition(null)
      return
    }

    if (action === 'generate_animation') {
      // 生成动画：添加占位动画条目并后台生成
      const animationId = crypto.randomUUID()
      const newAnim = {
        id: animationId,
        filePath: '',
        meta: { 
          title: `生成中: ${text.slice(0, 10)}...`, 
          source: 'selection', 
          note: text,
          status: 'generating',
          range: selectionRange || undefined
        }
      }
      updateNode(node.id, { animations: [...(node.animations || []), newAnim] })
      setSelectedText('')
      setSelectionRange(null)
      setToolbarPosition(null)

      // 后台生成
      ;(async () => {
        try {
          const result = await apiClient.generateAnimationSafe(text, { theme: node.theme })
          
          const currentNode = useAppStore.getState().nodes.find(n => n.id === node.id)
          if (!currentNode) return

          const updatedAnims = (currentNode.animations || []).map(a => {
            if (a.id === animationId) {
               return {
                 ...a,
                 meta: { 
                   ...a.meta, 
                   title: `动画: ${text.slice(0, 10)}`, 
                   status: 'completed',
                   code: result.code 
                 }
               }
            }
            return a
          })
          
          updateNode(node.id, { animations: updatedAnims })
        } catch (err) {
          console.error('Animation generation failed:', err)
          alert('动画生成请求超时或失败，请检查网络连接')
          const currentNode = useAppStore.getState().nodes.find(n => n.id === node.id)
          if (!currentNode) return

          const updatedAnims = (currentNode.animations || []).map(a => {
            if (a.id === animationId) {
               return {
                 ...a,
                 meta: { 
                   ...a.meta, 
                   title: `生成失败: ${text.slice(0, 10)}`, 
                   status: 'error' 
                 }
               }
            }
            return a
          })
          updateNode(node.id, { animations: updatedAnims })
        }
      })()
      return
    }

    if (action === 'expand') {
      // 扩展：基于选中文本创建子节点，并后台生成内容
      const parent = node
      const child = createNode(text.slice(0, 64), { x: parent.position.x + 220, y: parent.position.y + 40 }, parent.id, parent.projectId)
      // 设置生成状态
      const childNode: Node = { ...child, status: 'generating' }
      addNode(childNode)
      addEdge({
        id: crypto.randomUUID(),
        projectId: parent.projectId,
        fromNodeId: parent.id,
        toNodeId: childNode.id,
        fromAnchor: 'bottom',
        toAnchor: 'top',
        meta: {}
      })

      // 后台生成内容
      ;(async () => {
        try {
          const ctx = buildNodeContext(childNode, nodes, edges, text)
          const result = await apiClient.generateNode(childNode.id, {
            theme: childNode.theme,
            description: text,
            language: 'zh-CN',
            length: 'medium',
            context: ctx
          })
          updateNode(childNode.id, {
            summary: result.summary,
            contentMd: result.contentMd,
            toc: parseTocFromMarkdown(result.contentMd),
            status: 'completed',
            metadata: { ...childNode.metadata, updatedAt: new Date(), version: childNode.metadata.version + 1 }
          })
        } catch (err) {
          updateNode(childNode.id, { status: 'error', metadata: { ...childNode.metadata, updatedAt: new Date() } })
        }
      })()

      setSelectedText('')
      setToolbarPosition(null)
      return
    }
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="fixed inset-0 z-50 flex bg-background p-4">
      {/* 左侧目录 - 仅在文本模式下显示 */}
      {viewMode === 'text' && (
        <div className="w-64 bg-card border-r border-border flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">目录</h2>
          </div>

          {/* 目录内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {computedToc.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleSectionClick(item.anchor)}
                  className={`w-full text-left flex items-center px-2 py-1 rounded text-sm hover:bg-accent transition-colors ${
                    selectedSection === item.anchor ? 'bg-accent' : ''
                  }`}
                  style={{ paddingLeft: `${(item.level - 1) * 16 + 8}px` }}
                >
                  <span
                    className={`text-foreground ${
                      item.level === 1 ? 'font-semibold text-base' :
                      item.level === 2 ? 'font-medium text-sm' :
                      'font-normal text-xs'
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 收藏列表 */}
          {node.annotations && node.annotations.filter(a => a.type === 'favorite').length > 0 && (
            <div className="border-t border-border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary" />
                收藏库
              </h3>
              <div className="space-y-2">
                {node.annotations
                  .filter(a => a.type === 'favorite')
                  .map((fav, index) => (
                    <div 
                      key={index} 
                      className="bg-accent/50 rounded p-2 text-xs border border-border/50 hover:bg-accent hover:border-border transition-colors cursor-pointer group relative"
                      onClick={() => {
                        const el = document.getElementById(`fav-${fav.id}`)
                        if (el) {
                           el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        } else {
                           copy(fav.originalText || fav.text)
                        }
                      }}
                      title="点击跳转"
                    >
                      <p className="line-clamp-3 text-foreground/90 leading-relaxed">
                        {fav.originalText || fav.text}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{new Date(fav.timestamp).toLocaleDateString()}</span>
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-accent rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              返回画布
            </button>
            <div className="h-6 w-px bg-border mx-2" />
            <div>
              <h1 className="text-xl font-bold truncate max-w-md">{node.theme}</h1>
              {node.summary && <p className="text-sm text-muted-foreground truncate max-w-md">{node.summary}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button
                onClick={handleMindMapClick}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent rounded-md transition-colors border border-border"
                title={viewMode === 'mindmap' ? '切换回文本' : '切换到思维导图'}
              >
                <Network className={`w-4 h-4 ${viewMode === 'mindmap' ? 'text-primary' : ''}`} />
                <span>{viewMode === 'mindmap' ? '文本视图' : '思维导图'}</span>
              </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div
          className={`flex-1 overflow-y-auto ${viewMode === 'mindmap' ? 'p-0' : 'p-6'}`}
          ref={contentRef}
          style={{ userSelect: 'text' }}
          onMouseUp={handleTextSelection}
          onKeyUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          <div className={`${viewMode === 'mindmap' ? 'w-full h-full' : 'max-w-4xl mx-auto h-full'}`}>
            {viewMode === 'mindmap' ? (
              <div className="h-full flex flex-col relative bg-background">
                <div className="flex-1 w-full h-full overflow-hidden">
                   {mindmapData ? (
                     <MindMapGraph 
                       data={mindmapData} 
                        isDark={isDark} 
                        onNodeClick={handleNodeClick}
                     />
                   ) : (
                     <div className="flex items-center justify-center h-full text-muted-foreground">
                       暂无思维导图数据（请确保内容包含标题层级）
                     </div>
                   )}
                </div>
                
                {/* 侧滑内容框 */}
                {selectedMindmapNode && (
                  <div className="absolute top-0 right-0 bottom-0 w-1/3 min-w-[300px] bg-background border-l border-border shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
                      <span className="text-sm font-medium">节点详情</span>
                      <button 
                        onClick={() => setSelectedMindmapNode(null)}
                        className="text-xs px-2 py-1 hover:bg-accent rounded"
                      >
                        关闭
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      {renderMindmapContent()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
            <>
            {/* Markdown 内容渲染 */}
            <div className={markdownProseClasses}>
              <ReactMarkdown
                key={node.id}
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
              >
                {processContent(node.contentMd || '', node.annotations || [], node.animations || [])}
              </ReactMarkdown>

            </div>

            {/* 注释和批注 */}
            {node.annotations && node.annotations.length > 0 && (
              <div className="mt-8 p-4 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-4">批注与注释</h3>
                <div className="space-y-3">
                  {node.annotations.map((annotation, index) => (
                    <div key={index} className="border-l-4 border-primary pl-4">
                      <p className="text-sm">{annotation.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {annotation.author} • {annotation.timestamp.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}


            </>
            )}
          </div>
        </div>
      </div>

      {sandboxOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSandboxOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-base font-semibold">代码沙箱</div>
                <select
                  value={sandboxLanguage}
                  onChange={(e) => setSandboxLanguage(e.target.value as any)}
                  className="px-2 py-1 border border-border rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="html">HTML</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runSandbox}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors shadow-sm font-medium"
                >
                  运行
                </button>
                <button
                  onClick={() => {
                    setSandboxStdout('')
                    setSandboxStderr('')
                    setSandboxIframeDoc(null)
                  }}
                  className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-accent transition-colors"
                >
                  清空输出
                </button>
                <button
                  onClick={() => setSandboxOpen(false)}
                  className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-accent transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-background">
              {/* 左侧：代码编辑区 */}
              <div className="w-full md:w-1/2 flex flex-col md:h-full border-b md:border-b-0 md:border-r border-border shrink-0">
                <div className="h-[400px] md:h-auto md:flex-[2] flex flex-col border-b border-border">
                  <div className="p-3 pb-2 text-sm font-medium flex justify-between items-center text-muted-foreground">
                    <span>代码编辑器</span>
                    <span className="text-xs opacity-70">支持语法高亮</span>
                  </div>
                  <div className="flex-1 px-3 pb-3 relative min-h-0">
                    <div className="w-full h-full border border-border rounded-md bg-background relative overflow-hidden ring-offset-background focus-within:ring-1 focus-within:ring-ring">
                      {/* 高亮层 */}
                      <div
                        ref={codeHighlightRef}
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                      >
                        <SyntaxHighlighter
                          language={highlightLang()}
                          style={isDark ? vscDarkPlus : materialLight}
                          customStyle={{
                            margin: 0,
                            background: 'transparent',
                            whiteSpace: 'pre',
                            wordBreak: 'normal',
                            fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            padding: '12px',
                            tabSize: 2,
                            border: 'none',
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: '14px',
                              lineHeight: '1.5',
                            }
                          }}
                        >
                          {sandboxCode || ''}
                        </SyntaxHighlighter>
                      </div>
                      {/* 输入层 */}
                      <textarea
                        ref={codeTextareaRef}
                        value={sandboxCode}
                        onChange={(e) => setSandboxCode(e.target.value)}
                        onScroll={onCodeScrollSync}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        wrap="off"
                        className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-foreground focus:outline-none"
                        style={{
                          whiteSpace: 'pre',
                          wordBreak: 'normal',
                          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          padding: '12px',
                          tabSize: 2,
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="h-[150px] md:h-auto md:flex-[1] flex flex-col p-3 bg-muted/5">
                  <div className="text-sm font-medium mb-2 text-muted-foreground">标准输入 (stdin)</div>
                  <textarea
                    value={sandboxStdin}
                    onChange={(e) => setSandboxStdin(e.target.value)}
                    placeholder="在此输入程序需要的输入数据..."
                    className="flex-1 w-full resize-none p-3 border border-border rounded-md bg-background font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* 右侧：预览与输出区 */}
              <div className="w-full md:w-1/2 flex flex-col md:h-full shrink-0 bg-muted/5">
                <div className="h-[350px] md:h-auto md:flex-1 flex flex-col border-b border-border p-3">
                  <div className="text-sm font-medium mb-2 text-muted-foreground">运行预览</div>
                  {sandboxIframeDoc && (sandboxLanguage === 'html' || sandboxLanguage === 'javascript') ? (
                    <div className="flex-1 w-full border border-border rounded-md bg-white overflow-hidden shadow-sm">
                      <iframe
                        title="sandbox-preview"
                        sandbox="allow-scripts"
                        srcDoc={sandboxIframeDoc}
                        className="w-full h-full border-none"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 w-full border border-border rounded-md bg-background/50 border-dashed flex items-center justify-center text-sm text-muted-foreground">
                      {sandboxLanguage === 'python' ? 'Python 代码无图形预览' : '点击运行查看效果'}
                    </div>
                  )}
                </div>

                <div className="h-[300px] md:h-auto md:flex-1 flex flex-col p-3 gap-3 overflow-hidden">
                  {/* 依赖安装进度（仅 Python） */}
                  {sandboxLanguage === 'python' && (
                    <div className="shrink-0 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>环境状态</span>
                        <span>{pythonInstalling ? '正在初始化...' : '就绪'}</span>
                      </div>
                      <div className="w-full h-1.5 bg-border/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${pythonProgress}%` }}
                        />
                      </div>
                      {pythonMessages.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate opacity-80">
                           {pythonMessages[pythonMessages.length - 1]}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 grid grid-rows-2 gap-3 min-h-0">
                    <div className="flex flex-col min-h-0">
                      <div className="text-xs font-medium mb-1.5 text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                        标准输出 (stdout)
                      </div>
                      <pre className="flex-1 overflow-auto border border-border rounded-md bg-background p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed shadow-sm">
                        {sandboxStdout || <span className="text-muted-foreground/40 italic">无输出</span>}
                      </pre>
                    </div>
                    <div className="flex flex-col min-h-0">
                      <div className="text-xs font-medium mb-1.5 text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                        错误输出 (stderr)
                      </div>
                      <pre className="flex-1 overflow-auto border border-border rounded-md bg-background p-3 text-xs font-mono whitespace-pre-wrap text-destructive leading-relaxed shadow-sm">
                        {sandboxStderr || <span className="text-muted-foreground/40 italic">无错误</span>}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 划词高亮功能已移除 */}
      {/* 悬浮工具条：非高亮工具动作 */}
      {toolbarPosition && selectedText && (
        <div
          className="fixed z-[80] bg-card border border-border rounded-md shadow-md px-2 py-1 flex items-center gap-2"
          style={{ left: toolbarPosition.x, top: toolbarPosition.y, transform: 'translate(-50%, 0%)' }}
        >
          <button
            className="p-1 hover:bg-accent rounded-md"
            title="批注"
            onClick={() => handleToolbarAction('annotate')}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded-md"
            title="收藏"
            onClick={() => handleToolbarAction('favorite')}
          >
            <Heart className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded-md"
            title="加入聊天"
            onClick={() => handleToolbarAction('add_to_chat')}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded-md"
            title="生成动画（占位）"
            onClick={() => handleToolbarAction('generate_animation')}
          >
            <Wand2 className="w-4 h-4" />
          </button>
          <button
            className="p-1 hover:bg-accent rounded-md"
            title="扩展为子节点"
            onClick={() => handleToolbarAction('expand')}
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <AnimationModal
        isOpen={animationModal.isOpen}
        onClose={() => setAnimationModal(prev => ({ ...prev, isOpen: false }))}
        code={animationModal.code}
        title={animationModal.title}
      />

      {/* 批注对话框 */}
      {annotationDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-lg shadow-lg w-[400px] max-w-[90vw] p-4 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold">添加批注</h3>
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded line-clamp-3 italic border border-border/50">
              "{annotationDialog.targetText}"
            </div>
            <textarea
              value={annotationDialog.text}
              onChange={e => setAnnotationDialog(prev => ({ ...prev, text: e.target.value }))}
              placeholder="输入批注内容..."
              className="min-h-[100px] p-3 border border-border rounded-md bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAnnotationDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm hover:bg-muted rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!annotationDialog.text.trim()) return
                  const text = annotationDialog.targetText
                  const idx = annotationDialog.range ? annotationDialog.range.start : (node.contentMd || '').indexOf(text)
                  const range = annotationDialog.range || { start: Math.max(0, idx), end: Math.max(0, idx) + text.length }

                  const newAnno = {
                    id: crypto.randomUUID(),
                    range,
                    text: annotationDialog.text.trim(),
                    originalText: text,
                    author: '用户',
                    timestamp: new Date(),
                    type: 'comment' as const,
                  }
                  updateNode(node.id, { annotations: [...(node.annotations || []), newAnno] })
                  setAnnotationDialog(prev => ({ ...prev, isOpen: false }))
                }}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Tooltip.Provider>
  )
}
