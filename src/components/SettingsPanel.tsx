import React from 'react'
import { X, Moon, Sun, Settings as SettingsIcon, Database, Key } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Annotation, Edge, MindMapData, Node, Project, Theme } from '@/types'

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isMindMapData(value: unknown): value is MindMapData {
  return isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges)
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function normalizeAnnotation(raw: unknown): Annotation {
  if (!isRecord(raw)) {
    return {
      id: crypto.randomUUID(),
      range: { start: 0, end: 0 },
      text: '',
      author: 'unknown',
      timestamp: new Date(),
    }
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    range: isRecord(raw.range)
      ? {
          start: typeof raw.range.start === 'number' ? raw.range.start : 0,
          end: typeof raw.range.end === 'number' ? raw.range.end : 0,
          startOffset: typeof raw.range.startOffset === 'number' ? raw.range.startOffset : undefined,
          endOffset: typeof raw.range.endOffset === 'number' ? raw.range.endOffset : undefined,
        }
      : { start: 0, end: 0 },
    text: typeof raw.text === 'string' ? raw.text : '',
    originalText: typeof raw.originalText === 'string' ? raw.originalText : undefined,
    author: typeof raw.author === 'string' ? raw.author : 'unknown',
    timestamp: toDate(raw.timestamp),
    type: raw.type === 'highlight' || raw.type === 'comment' || raw.type === 'note' || raw.type === 'favorite'
      ? raw.type
      : undefined,
  }
}

function normalizeNode(raw: unknown, projectId: string): Node {
  const now = new Date()
  if (!isRecord(raw)) {
    return {
      id: crypto.randomUUID(),
      projectId,
      theme: '未命名',
      summary: '',
      contentMd: '',
      toc: [],
      annotations: [],
      favorites: false,
      animations: [],
      position: { x: 100, y: 100 },
      metadata: { createdAt: now, updatedAt: now, version: 1 },
      status: 'completed',
    }
  }

  const metadata = isRecord(raw.metadata) ? raw.metadata : {}
  const position = isRecord(raw.position) ? raw.position : {}

  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    projectId: typeof raw.projectId === 'string' ? raw.projectId : projectId,
    parentId: typeof raw.parentId === 'string' ? raw.parentId : undefined,
    theme: typeof raw.theme === 'string' ? raw.theme : '未命名',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    contentMd: typeof raw.contentMd === 'string' ? raw.contentMd : '',
    toc: Array.isArray(raw.toc) ? raw.toc : [],
    annotations: Array.isArray(raw.annotations) ? raw.annotations.map(normalizeAnnotation) : [],
    favorites: typeof raw.favorites === 'boolean' ? raw.favorites : false,
    animations: Array.isArray(raw.animations) ? raw.animations : [],
    mindmap: isMindMapData(raw.mindmap) ? raw.mindmap : undefined,
    position: {
      x: typeof position.x === 'number' ? position.x : 100,
      y: typeof position.y === 'number' ? position.y : 100,
    },
    metadata: {
      createdAt: toDate(metadata.createdAt),
      updatedAt: toDate(metadata.updatedAt),
      version: typeof metadata.version === 'number' ? metadata.version : 1,
    },
    status: raw.status === 'idle' || raw.status === 'generating' || raw.status === 'completed' || raw.status === 'error'
      ? raw.status
      : 'completed',
    progress: typeof raw.progress === 'number' ? raw.progress : undefined,
  }
}

function normalizeEdge(raw: unknown, projectId: string): Edge | null {
  if (!isRecord(raw)) return null
  if (typeof raw.fromNodeId !== 'string' || typeof raw.toNodeId !== 'string') return null

  const meta = isRecord(raw.meta) ? raw.meta : {}
  return {
    id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
    projectId: typeof raw.projectId === 'string' ? raw.projectId : projectId,
    fromNodeId: raw.fromNodeId,
    toNodeId: raw.toNodeId,
    fromAnchor: raw.fromAnchor === 'top' || raw.fromAnchor === 'bottom' ? raw.fromAnchor : 'bottom',
    toAnchor: raw.toAnchor === 'top' || raw.toAnchor === 'bottom' ? raw.toAnchor : 'top',
    meta: isRecord(meta)
      ? {
          type: typeof meta.type === 'string' ? meta.type : undefined,
          weight: typeof meta.weight === 'number' ? meta.weight : undefined,
          label: typeof meta.label === 'string' ? meta.label : undefined,
        }
      : {},
  }
}

function buildProjectFromMarkdown(
  markdown: string,
  preferences: { theme: Theme; language: string; autoSave: boolean },
  userId: string
): Project {
  const now = new Date()
  const firstLine = markdown.split('\n').find(line => line.trim().length > 0) || ''
  const title = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '').trim() : '导入项目'
  const projectId = crypto.randomUUID()
  const nodeId = crypto.randomUUID()

  const node: Node = {
    id: nodeId,
    projectId,
    theme: title || '导入内容',
    summary: '',
    contentMd: markdown,
    toc: [],
    annotations: [],
    favorites: false,
    animations: [],
    position: { x: 100, y: 100 },
    metadata: { createdAt: now, updatedAt: now, version: 1 },
    status: 'completed',
  }

  return {
    id: projectId,
    userId,
    name: title || '导入项目',
    nodes: [node],
    edges: [],
    settings: {
      theme: preferences.theme,
      defaultLanguage: preferences.language,
      autoSave: preferences.autoSave,
      showGrid: true,
      snapToGrid: false,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  }
}

function buildProjectFromJson(
  raw: unknown,
  preferences: { theme: Theme; language: string; autoSave: boolean },
  userId: string
): Project {
  if (!isRecord(raw)) throw new Error('JSON 根对象格式不正确')

  const projectId = typeof raw.id === 'string' ? raw.id : crypto.randomUUID()
  const nodesRaw = Array.isArray(raw.nodes) ? raw.nodes : []
  const edgesRaw = Array.isArray(raw.edges) ? raw.edges : []

  const nodes = nodesRaw.map(n => normalizeNode(n, projectId)).map(n => ({
    ...n,
    projectId,
  }))

  const nodeIdSet = new Set(nodes.map(n => n.id))
  const edges = edgesRaw
    .map(e => normalizeEdge(e, projectId))
    .filter((e): e is Edge => !!e && nodeIdSet.has(e.fromNodeId) && nodeIdSet.has(e.toNodeId))
    .map(e => ({ ...e, projectId }))

  const metadata = isRecord(raw.metadata) ? raw.metadata : {}
  const settings = isRecord(raw.settings) ? raw.settings : {}

  const theme: Theme =
    settings.theme === 'light' || settings.theme === 'dark' ? settings.theme : preferences.theme

  return {
    id: projectId,
    userId,
    name: typeof raw.name === 'string' ? raw.name : '导入项目',
    nodes,
    edges,
    settings: {
      theme,
      defaultLanguage: typeof settings.defaultLanguage === 'string' ? settings.defaultLanguage : preferences.language,
      autoSave: typeof settings.autoSave === 'boolean' ? settings.autoSave : preferences.autoSave,
      showGrid: typeof settings.showGrid === 'boolean' ? settings.showGrid : true,
      snapToGrid: typeof settings.snapToGrid === 'boolean' ? settings.snapToGrid : false,
    },
    metadata: {
      createdAt: toDate(metadata.createdAt),
      updatedAt: toDate(metadata.updatedAt),
      lastOpenedAt: metadata.lastOpenedAt ? toDate(metadata.lastOpenedAt) : undefined,
    },
  }
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { ui, preferences, setTheme, setCurrentProject, updatePreferences, nodes, edges, currentProject } = useAppStore()
  const { user } = useAuthStore()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)
  const currentUserId = user?.id || 'anonymous'

  const handleThemeChange = (theme: Theme) => {
    setTheme(theme)
    updatePreferences({ theme })
  }

  const downloadTextFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleExportJson = () => {
    const project = currentProject || {
      id: 'default',
      userId: currentUserId,
      name: '默认项目',
      nodes,
      edges,
      settings: {
        theme: preferences.theme,
        defaultLanguage: preferences.language,
        autoSave: preferences.autoSave,
        showGrid: true,
        snapToGrid: false,
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }

    downloadTextFile(
      `nexlearn-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ ...project, exportedAt: new Date().toISOString() }, null, 2),
      'application/json;charset=utf-8'
    )
  }

  const handleExportMarkdown = () => {
    const nodeById = new Map(nodes.map(n => [n.id, n]))
    const childrenByParent = new Map<string, string[]>()

    for (const n of nodes) {
      const key = n.parentId || '__root__'
      const list = childrenByParent.get(key) || []
      list.push(n.id)
      childrenByParent.set(key, list)
    }

    const lines: string[] = []
    lines.push(`# ${currentProject?.name || '默认项目'}`)
    lines.push('')
    lines.push(`导出时间：${new Date().toLocaleString()}`)
    lines.push('')

    const visited = new Set<string>()
    const walk = (id: string, depth: number) => {
      if (visited.has(id)) return
      visited.add(id)

      const n = nodeById.get(id)
      if (!n) return

      const level = Math.min(6, Math.max(2, depth + 2))
      lines.push(`${'#'.repeat(level)} ${n.theme}`)
      lines.push('')
      if (n.summary) {
        lines.push(n.summary)
        lines.push('')
      }
      if (n.contentMd) {
        lines.push(n.contentMd)
        lines.push('')
      }
      lines.push('---')
      lines.push('')

      const children = childrenByParent.get(id) || []
      for (const childId of children) walk(childId, depth + 1)
    }

    const roots = childrenByParent.get('__root__') || []
    for (const rootId of roots) walk(rootId, 0)

    downloadTextFile(
      `nexlearn-export-${new Date().toISOString().slice(0, 10)}.md`,
      lines.join('\n'),
      'text/markdown;charset=utf-8'
    )
  }

  const handleImportClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || importing) return

    setImportError(null)
    setImporting(true)
    try {
      const content = await file.text()
      const ext = file.name.toLowerCase().split('.').pop()

      const project =
        ext === 'md' || file.type.includes('markdown')
          ? buildProjectFromMarkdown(content, preferences, currentUserId)
          : buildProjectFromJson(JSON.parse(content), preferences, currentUserId)

      setCurrentProject(project)
      setTheme(project.settings.theme)
    } catch (e) {
      const message = e instanceof Error ? e.message : '导入失败'
      setImportError(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6" />
          <h1 className="text-2xl font-bold">设置</h1>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-accent rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* 账户设置 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Key className="w-5 h-5" />
              账户设置
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">后端 API 基地址</label>
                <input
                  value={preferences.apiBaseUrl || ''}
                  onChange={(e) => updatePreferences({ apiBaseUrl: e.target.value })}
                  placeholder="http://localhost:3001/api/v1"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">默认语言</label>
                <select
                  value={preferences.language}
                  onChange={(e) => updatePreferences({ language: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁体中文</option>
                  <option value="en-US">English</option>
                  <option value="ja-JP">日本語</option>
                  <option value="ko-KR">한국어</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">默认长度</label>
                <select
                  value={preferences.generationLength}
                  onChange={(e) => updatePreferences({ generationLength: e.target.value as any })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="short">简短</option>
                  <option value="medium">中等</option>
                  <option value="long">详细</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">写作风格</label>
                <input
                  value={preferences.writingStyle || ''}
                  onChange={(e) => updatePreferences({ writingStyle: e.target.value })}
                  placeholder="例如：教学风格、要点式、通俗易懂"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LLM 提供商</label>
                <select
                  value={preferences.llmProvider}
                  onChange={(e) => updatePreferences({ llmProvider: e.target.value as any })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="openai">OpenAI</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="custom">自定义</option>
                  <option value="ollama">Ollama</option>
                </select>
              </div>
              {preferences.llmProvider === 'ollama' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ollama 模型</label>
                    <input
                      value={preferences.ollamaModel || ''}
                      onChange={(e) => updatePreferences({ ollamaModel: e.target.value })}
                      placeholder="phi4-mini:latest"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ollama Base URL</label>
                    <input
                      value={preferences.ollamaBaseUrl || ''}
                      onChange={(e) => updatePreferences({ ollamaBaseUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Ollama API Key</label>
                    <input
                      type="password"
                      value={preferences.ollamaApiKey || ''}
                      onChange={(e) => updatePreferences({ ollamaApiKey: e.target.value })}
                      placeholder="用于 Ollama Cloud"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">LLM 模型</label>
                    <input
                      value={preferences.llmModel || ''}
                      onChange={(e) => updatePreferences({ llmModel: e.target.value })}
                      placeholder="gpt-4-turbo-preview"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">LLM Base URL</label>
                    <input
                      value={preferences.llmBaseUrl || ''}
                      onChange={(e) => updatePreferences({ llmBaseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">LLM API Key</label>
                    <input
                      type="password"
                      value={preferences.apiKey || ''}
                      onChange={(e) => updatePreferences({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">检索服务</label>
                <select
                  value={preferences.searchProvider}
                  onChange={(e) => updatePreferences({ searchProvider: e.target.value as any })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="bing">Bing Search</option>
                  <option value="google">Google Search</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">检索 API Key</label>
                <input
                  type="password"
                  value={preferences.searchApiKey || ''}
                  onChange={(e) => updatePreferences({ searchApiKey: e.target.value })}
                  placeholder="Bing 或 Google API Key"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                />
              </div>
              {preferences.searchProvider === 'google' && (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Google Search Engine ID</label>
                  <input
                    value={preferences.searchEngineId || ''}
                    onChange={(e) => updatePreferences({ searchEngineId: e.target.value })}
                    placeholder="自定义搜索引擎 ID"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  />
                </div>
              )}
            </div>
          </section>

          {/* 外观设置 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">外观</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-3 block">主题</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                      ui.theme === 'light'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    浅色
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                      ui.theme === 'dark'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    深色
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 数据管理 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Database className="w-5 h-5" />
              数据管理
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleExportJson}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-left"
              >
                导出 JSON
              </button>
              <button
                onClick={handleExportMarkdown}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-left"
              >
                导出 Markdown
              </button>
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {importing ? '导入中…' : '导入数据'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.md,application/json,text/markdown"
              className="hidden"
              onChange={handleImportChange}
            />
            {importError && (
              <div className="text-sm text-red-600">
                {importError}
              </div>
            )}
          </section>

          {/* 高级设置 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">高级设置</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">自动联网检索</label>
                  <p className="text-sm text-muted-foreground">生成内容时自动搜索相关信息</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.enableSearch}
                  onChange={(e) => updatePreferences({ enableSearch: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">自动保存</label>
                  <p className="text-sm text-muted-foreground">定期自动保存项目</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.autoSave}
                  onChange={(e) => updatePreferences({ autoSave: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </section>

          {/* 关于 */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">关于</h2>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>NexLearn</strong> - AI 自学辅助工具</p>
              <p>版本: 1.0.0</p>
              <p>基于无限画布的知识构建系统，支持AI驱动的内容生成和思维导图编辑。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
