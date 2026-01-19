// 基础类型定义

export type Theme = 'light' | 'dark'

export type NodeStatus =
  | 'idle'
  | 'generating'
  | 'completed'
  | 'error'

export type AnchorPosition = 'top' | 'bottom'

// 节点数据结构
export interface Node {
  id: string
  projectId: string
  parentId?: string
  theme: string
  summary: string
  contentMd: string
  toc: TableOfContentsItem[]
  annotations: Annotation[]
  favorites: boolean
  animations: Animation[]
  mindmap?: MindMapData
  position: Position
  metadata: NodeMetadata
  status: NodeStatus
  progress?: number // 生成进度 0-100
}

// 边数据结构
export interface Edge {
  id: string
  projectId: string
  fromNodeId: string
  toNodeId: string
  fromAnchor: AnchorPosition
  toAnchor: AnchorPosition
  meta: EdgeMeta
}

// 项目数据结构
export interface Project {
  id: string
  userId: string
  name: string
  nodes: Node[]
  edges: Edge[]
  settings: ProjectSettings
  metadata: ProjectMetadata
}

// 辅助数据结构
export interface Position {
  x: number
  y: number
}

export interface TableOfContentsItem {
  level: number
  text: string
  anchor: string
}

export interface Annotation {
  id: string
  range: TextRange
  text: string
  originalText?: string // 可选的原文记录
  author: string
  timestamp: Date
  type?: 'highlight' | 'comment' | 'note' | 'favorite'
}

export interface Animation {
  id: string
  filePath: string
  meta: Record<string, any>
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

export interface MindMapNode {
  id: string
  text: string
  position: Position
  parentId?: string
  children?: string[]
  anchor?: string
  hasContent?: boolean
  stats?: {
    hasAnnotations?: boolean
    hasFavorites?: boolean
    hasAnimations?: boolean
  }
}

export interface MindMapEdge {
  id: string
  fromId: string
  toId: string
}

export interface TextRange {
  start: number
  end: number
  startOffset?: number
  endOffset?: number
}

export interface NodeMetadata {
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface EdgeMeta {
  type?: string
  weight?: number
  label?: string
}

export interface ProjectSettings {
  theme: Theme
  defaultLanguage: string
  autoSave: boolean
  showGrid: boolean
  snapToGrid: boolean
}

export interface ProjectMetadata {
  createdAt: Date
  updatedAt: Date
  lastOpenedAt?: Date
}

// UI 状态类型
export interface UIState {
  theme: Theme
  sidebarOpen: boolean
  selectedNodeId: string | null
  canvas: CanvasState
  modals: ModalState
}

export interface CanvasState {
  zoom: number
  pan: Position
  viewport: {
    width: number
    height: number
  }
}

export interface ModalState {
  nodeCreate: boolean
  nodeEdit: boolean
  settings: boolean
  export: boolean
}

// 用户设置
export interface UserPreferences {
  theme: Theme
  language: string
  llmProvider: 'openai' | 'azure' | 'custom'
  llmModel: string
  apiKey?: string
  searchProvider: 'bing' | 'google' | 'custom'
  searchApiKey?: string
  enableSearch: boolean
  autoSave: boolean
  autoSaveInterval: number // 分钟
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface GenerateNodeRequest {
  theme: string
  description?: string
  parentId?: string
  language?: string
  length?: 'short' | 'medium' | 'long'
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
  isPublic?: boolean
}

export interface GenerateNodeResponse {
  node: Node
  searchResults?: SearchResult[]
}

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source: string
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
  output?: string // HTML 渲染结果
}

// 思维导图相关
export interface GenerateMindMapRequest {
  content: string
  language?: string
}

export interface GenerateMindMapResponse {
  mindmap: MindMapData
}

// 联想推荐相关
export interface GenerateIdeasRequest {
  nodeId: string
  theme: string
  context?: string
}

export interface GenerateIdeasResponse {
  ideas: string[]
  searchResults?: SearchResult[]
}

// 对话相关
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  context: {
    nodeId?: string
    visibleText?: string
    nodeTree?: string
  }
  createdAt: Date
  updatedAt: Date
}