// Frontend API client for NexLearn backend
import { UserPreferences, Project, Node, Edge } from '@/types'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
  timestamp: string
}

export interface LlmConfig {
  provider?: 'openai' | 'azure' | 'custom' | 'ollama'
  apiKey?: string
  baseUrl?: string
  model?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
  ollamaApiKey?: string
}

export interface SearchConfig {
  provider?: 'bing' | 'google' | 'custom' | 'duckduckgo'
  enabled?: boolean
  apiKey?: string
  engineId?: string
}

export interface RequestConfig {
  llm?: LlmConfig
  search?: SearchConfig
}

export const buildRequestConfig = (preferences: UserPreferences): RequestConfig => ({
  llm: {
    provider: preferences.llmProvider,
    apiKey: preferences.apiKey,
    baseUrl: preferences.llmBaseUrl,
    model: preferences.llmModel,
    ollamaBaseUrl: preferences.ollamaBaseUrl,
    ollamaModel: preferences.ollamaModel,
    ollamaApiKey: preferences.ollamaApiKey,
  },
  search: {
    provider: preferences.searchProvider,
    enabled: preferences.enableSearch,
    apiKey: preferences.searchApiKey,
    engineId: preferences.searchEngineId,
  }
})

const normalizeBaseUrl = (raw?: string): string => {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  const withoutSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
  return withoutSlash.endsWith('/api/v1') ? withoutSlash : `${withoutSlash}/api/v1`
}

export interface GenerateNodeRequest {
  theme: string
  description?: string
  language?: string
  length?: 'short' | 'medium' | 'long'
  style?: string
  config?: RequestConfig
  context?: {
    visibleText?: string
    nodeTree?: string
    parentNode?: {
      id: string
      theme: string
      summary: string
    }
    siblingNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
  }
}

export interface GenerateNodeResponse {
  nodeId: string
  theme: string
  summary: string
  contentMd: string
  searchResults: SearchResult[]
  generatedAt: string
}

export interface GenerateIdeasRequest {
  theme: string
  language?: string
  config?: RequestConfig
  context?: {
    visibleText?: string
    nodeTree?: string
    parentNode?: {
      id: string
      theme: string
      summary: string
    }
    siblingNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
    childNodes?: Array<{
      id: string
      theme: string
      summary: string
    }>
  }
}

export interface GenerateIdeasResponse {
  nodeId: string
  theme: string
  ideas: string[]
  searchResults: SearchResult[]
  generatedAt: string
}

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
}

export interface TableOfContentsItem {
  level: number
  text: string
  anchor: string
}

export interface ChatRequest {
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  config?: RequestConfig
  context?: {
    visibleText?: string
    nodeTree?: string
    searchResults?: SearchResult[]
  }
}

export interface ChatResponse {
  reply: string
  generatedAt: string
}

export interface ExecuteCodeRequest {
  code: string
  language: 'html' | 'python' | 'java' | 'cpp' | 'javascript'
  stdin?: string
  args?: string[]
}

export interface ExecuteCodeResponse {
  stdout: string
  stderr: string
  exitCode: number
  executionTime: number
  output?: string
}

export interface RegisterRequest {
  email: string
  password: string
  displayName?: string
}

export interface RegisterResponse {
  user: { id: string; email: string; displayName?: string }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: { id: string; email: string; displayName?: string }
}

export interface CurrentUserResponse {
  user: { id: string; email: string; displayName?: string }
}
export interface MindMapNode {
  id: string
  text: string
  position: { x: number; y: number }
  parentId?: string
  children: string[]
}

export interface MindMapEdge {
  id: string
  fromId: string
  toId: string
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

export interface GenerateMindMapRequest {
  content: string
  language?: string
  config?: RequestConfig
}

export interface GenerateMindMapResponse {
  mindmap: MindMapData
  generatedAt: string
}

export interface GenerateAnimationRequest {
  description: string
  context?: any
  config?: RequestConfig
}

export interface GenerateAnimationResponse {
  code: string
  generatedAt: string
}

// 项目相关 API 类型（用于后端持久化）
export interface ProjectDto {
  id: string
  userId: string
  name: string
  nodes: Node[]
  edges: Edge[]
  settings: {
    theme: string
    defaultLanguage: string
    autoSave: boolean
    showGrid: boolean
    snapToGrid: boolean
    [key: string]: any
  }
  metadata: {
    createdAt: string
    updatedAt: string
    lastOpenedAt?: string
    [key: string]: any
  }
  [key: string]: any
}

export interface CurrentProjectResponse {
  project: ProjectDto | null
}

export interface PreferencesResponse {
  preferences: UserPreferences | null
}


class ApiClient {
  private baseUrl: string | null = null
  private candidates: string[] = []
  private manualBaseUrl: string | null = null

  constructor() {
    this.candidates = this.buildCandidates()
  }

  setPreferredBaseUrl(baseUrl?: string) {
    const normalized = normalizeBaseUrl(baseUrl)
    this.manualBaseUrl = normalized || null
    this.baseUrl = null
    this.candidates = this.buildCandidates()
  }

  private buildCandidates(): string[] {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    const ports = [3001, 3002, 3003, 3004, 3005]
    const bases = ports.map(p => `http://${host}:${p}/api/v1`)
    const alts = ports.map(p => `http://127.0.0.1:${p}/api/v1`)
    const list: string[] = []
    if (this.manualBaseUrl) list.push(this.manualBaseUrl)
    return list.concat(bases).concat(alts)
  }

  private async ensureBaseUrl(): Promise<void> {
    if (this.baseUrl) return
    for (const b of this.candidates) {
      try {
        const r = await fetch(`${b}/health`, { method: 'GET' })
        if (r.ok) {
          this.baseUrl = b
          return
        }
      } catch {
        void 0
      }
    }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    this.baseUrl = this.candidates[0] || `http://${host}:3001/api/v1`
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const performRequest = async (baseUrl: string | null): Promise<ApiResponse<T>> => {
      const url = `${baseUrl}${endpoint}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
        ...options,
      })

      let data: any = null
      try {
        data = await response.json()
      } catch {
        data = null
      }

      if (!response.ok) {
        const message =
          (data && data.error && typeof data.error.message === 'string'
            ? data.error.message
            : response.statusText || 'API request failed')
        const error: any = new Error(message)
        error.status = response.status
        if (response.status === 401) {
          error.code = 'UNAUTHORIZED'
        }
        throw error
      }

      return data as ApiResponse<T>
    }

    try {
      await this.ensureBaseUrl()
      return await performRequest(this.baseUrl)
    } catch (error: any) {
      if (error && (error.code === 'UNAUTHORIZED' || error.status === 401)) {
        throw error
      }
      try {
        this.baseUrl = null
        await this.ensureBaseUrl()
        return await performRequest(this.baseUrl)
      } catch (e: any) {
        if (!(e && (e.code === 'UNAUTHORIZED' || e.status === 401))) {
          console.error('API request failed:', e)
        }
        throw e
      }
    }
  }

  // Chat with LLM
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Chat failed')
    }

    return response.data
  }

  // Chat with fallback (safe)
  async chatSafe(request: ChatRequest): Promise<ChatResponse> {
    try {
      return await this.chat(request)
    } catch (error: any) {
      // 占位实现：在后端未就绪时返回模拟回复
      return {
        reply: `（占位回复）\n你说：${request.message}\n\n上下文摘要：${(request.context?.visibleText || '').slice(0, 80)}${(request.context?.visibleText || '').length > 80 ? '...' : ''}\n\n当前后端对话接口未启用，已使用前端占位逻辑。`,
        generatedAt: new Date().toISOString(),
      }
    }
  }

  // Mock chat (for development)
  async mockChat(request: ChatRequest): Promise<ChatResponse> {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      reply: `收到您的消息："${request.message}"。\n\n基于上下文，我注意到您正在查看关于 "${request.context?.visibleText?.substring(0, 20)}..." 的内容。这是一个非常有意思的话题！\n\n(这是一个模拟回复，真实回复将由 LLM 生成)`,
      generatedAt: new Date().toISOString()
    }
  }

  // Generate node content
  async generateNode(
    nodeId: string,
    request: GenerateNodeRequest
  ): Promise<GenerateNodeResponse> {
    const response = await this.request<GenerateNodeResponse>(
      `/nodes/${nodeId}/generate`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    )

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate node')
    }

    return response.data
  }

  // Generate node ideas
  async generateIdeas(
    nodeId: string,
    request: GenerateIdeasRequest
  ): Promise<GenerateIdeasResponse> {
    const response = await this.request<GenerateIdeasResponse>(
      `/nodes/${nodeId}/ideas`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    )

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate ideas')
    }

    return response.data
  }

  // Search
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const response = await this.request<{
      query: string
      results: SearchResult[]
      totalResults: number
      limitedResults: number
      searchedAt: string
    }>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      method: 'GET',
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Search failed')
    }

    return response.data.results
  }

  // Search with fallback (safe)
  async searchSafe(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      return await this.search(query, limit)
    } catch {
      return await this.mockSearch(query)
    }
  }

  // Mock search (for development)
  async mockSearch(query: string): Promise<SearchResult[]> {
    const response = await this.request<{
      query: string
      results: SearchResult[]
      totalResults: number
      isMock: boolean
      searchedAt: string
    }>(`/search/mock?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Mock search failed')
    }

    return response.data.results
  }

  async executeCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    const response = await this.request<ExecuteCodeResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Execute code failed')
    }

    return response.data
  }

  // Execute code with fallback (safe)
  async executeCodeSafe(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    try {
      return await this.executeCode(request)
    } catch {
      // 回退到前端占位执行
      return await this.mockExecuteCode(request)
    }
  }

  async mockExecuteCode(request: ExecuteCodeRequest): Promise<ExecuteCodeResponse> {
    const start = performance.now()
    await new Promise(resolve => setTimeout(resolve, 400))
    const executionTime = Math.max(1, Math.round(performance.now() - start))

    if (request.language === 'html') {
      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
        executionTime,
        output: request.code,
      }
    }

    if (request.language === 'javascript') {
      return {
        stdout: '已在浏览器沙箱中运行（输出请看右侧预览/输出区）。',
        stderr: '',
        exitCode: 0,
        executionTime,
      }
    }

    return {
      stdout: `（Mock）已接收 ${request.language} 代码，暂未接入真实执行环境。`,
      stderr: '',
      exitCode: 0,
      executionTime,
    }
  }

  async generateMindMap(nodeId: string, request: GenerateMindMapRequest): Promise<GenerateMindMapResponse> {
    const response = await this.request<GenerateMindMapResponse>(`/nodes/${nodeId}/mindmap`, {
      method: 'POST',
      body: JSON.stringify(request),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Generate mindmap failed')
    }

    return response.data
  }

  // Mindmap with fallback (safe)
  async generateAnimationSafe(
    description: string,
    context?: any,
    config?: RequestConfig
  ): Promise<GenerateAnimationResponse> {
    try {
      const response = await this.request<GenerateAnimationResponse>('/animation', {
        method: 'POST',
        body: JSON.stringify({ description, context, config }),
      })
      if (!response.data) throw new Error('No data returned')
      return response.data
    } catch (error) {
      console.error('Animation generation failed:', error)
      throw error
    }
  }

  async generateMindMapSafe(nodeId: string, request: GenerateMindMapRequest): Promise<GenerateMindMapResponse> {
    try {
      return await this.generateMindMap(nodeId, request)
    } catch {
      return await this.mockGenerateMindMap(request)
    }
  }

  async mockGenerateMindMap(request: GenerateMindMapRequest): Promise<GenerateMindMapResponse> {
    await new Promise(resolve => setTimeout(resolve, 600))
    const content = request.content || ''

    const lines = content.split('\n')
    let inFence = false
    const headings: Array<{ level: number; text: string }> = []

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence
        continue
      }
      if (inFence) continue

      const match = /^(#{1,4})\s+(.+)$/.exec(line.trimStart())
      if (!match) continue
      const level = match[1].length
      const text = match[2].trim()
      if (!text) continue
      headings.push({ level, text })
      if (headings.length >= 12) break
    }

    const rootId = 'mindmap-root'
    const nodes: MindMapNode[] = [
      { id: rootId, text: '知识结构', position: { x: 0, y: 0 }, children: [] },
    ]
    const edges: MindMapEdge[] = []
    const nodeById = new Map<string, MindMapNode>()
    nodeById.set(rootId, nodes[0])

    const stack: Array<{ level: number; id: string }> = [{ level: 0, id: rootId }]

    const makeId = () => `mm-${crypto.randomUUID()}`

    for (const h of headings) {
      while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
        stack.pop()
      }
      const parent = stack[stack.length - 1]
      const id = makeId()
      const newNode: MindMapNode = {
        id,
        text: h.text,
        position: { x: 0, y: 0 },
        parentId: parent.id,
        children: [],
      }
      nodes.push(newNode)
      nodeById.set(id, newNode)

      const parentNode = nodeById.get(parent.id)
      if (parentNode) parentNode.children = [...parentNode.children, id]

      edges.push({ id: `edge-${crypto.randomUUID()}`, fromId: parent.id, toId: id })
      stack.push({ level: h.level, id })
    }

    return {
      mindmap: { nodes, edges },
      generatedAt: new Date().toISOString(),
    }
  }

  async register(req: RegisterRequest) {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async login(req: LoginRequest) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  }

  async logout() {
    return this.request<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    })
  }

  async me() {
    return this.request<CurrentUserResponse>('/auth/me', {
      method: 'GET',
    })
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const response = await this.request<PreferencesResponse>('/user/preferences', {
      method: 'GET',
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Get preferences failed')
    }

    return response.data.preferences || null
  }

  async savePreferences(preferences: UserPreferences): Promise<void> {
    const response = await this.request<{ ok: boolean }>('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    })

    if (!response.success) {
      throw new Error(response.error?.message || 'Save preferences failed')
    }
  }

  // 获取后端保存的“当前项目”
  async getCurrentProject(): Promise<ProjectDto | null> {
    const response = await this.request<CurrentProjectResponse>('/projects/current', {
      method: 'GET',
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Get current project failed')
    }

    return response.data.project || null
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString()
      }
    }
    const d = new Date()
    return d.toISOString()
  }

  private toOptionalIsoString(value: unknown): string | undefined {
    if (value == null) return undefined
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString()
      }
    }
    return undefined
  }

  // 保存当前项目到后端
  async saveCurrentProject(project: Project): Promise<ProjectDto> {
    const payload: ProjectDto = {
      id: project.id,
      userId: project.userId,
      name: project.name,
      nodes: project.nodes as Node[],
      edges: project.edges as Edge[],
      settings: {
        theme: project.settings.theme,
        defaultLanguage: project.settings.defaultLanguage,
        autoSave: project.settings.autoSave,
        showGrid: project.settings.showGrid,
        snapToGrid: project.settings.snapToGrid,
      },
      metadata: {
        createdAt: this.toIsoString((project.metadata as any).createdAt),
        updatedAt: this.toIsoString((project.metadata as any).updatedAt),
        lastOpenedAt: this.toOptionalIsoString((project.metadata as any).lastOpenedAt),
      },
    }

    const response = await this.request<{ project: ProjectDto }>('/projects/current', {
      method: 'PUT',
      body: JSON.stringify({ project: payload }),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Save project failed')
    }

    return response.data.project
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
