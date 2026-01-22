import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import localforage from 'localforage'
import { Node, Edge, Project, UIState, UserPreferences, Theme, ChatMessage } from '@/types'

// 应用状态接口
interface AppState {
  // 数据状态
  currentProject: Project | null
  nodes: Node[]
  edges: Edge[]

  // UI 状态
  ui: UIState

  // 用户设置
  preferences: UserPreferences

  // 对话状态
  chat: {
    messages: ChatMessage[]
    draft: string
    isLoading: boolean
  }

  // 操作状态
  isLoading: boolean
  error: string | null
}

// 应用操作接口
interface AppActions {
  // 项目操作
  setCurrentProject: (project: Project | null) => void
  createProject: (name: string) => Promise<Project>
  updateProject: (updates: Partial<Project>) => void
  deleteProject: (projectId: string) => Promise<void>

  // 节点操作
  addNode: (node: Node) => void
  updateNode: (nodeId: string, updates: Partial<Node>) => void
  deleteNode: (nodeId: string) => void
  setSelectedNode: (nodeId: string | null) => void

  // 边操作
  addEdge: (edge: Edge) => void
  updateEdge: (edgeId: string, updates: Partial<Edge>) => void
  deleteEdge: (edgeId: string) => void

  // UI 操作
  setTheme: (theme: Theme) => void
  setSidebarOpen: (open: boolean) => void
  setCanvasZoom: (zoom: number) => void
  setCanvasPan: (pan: { x: number; y: number }) => void

  // 用户设置操作
  updatePreferences: (updates: Partial<UserPreferences>) => void

  // 对话操作
  setChatDraft: (draft: string) => void
  addChatMessage: (msg: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearChat: () => void

  // 通用操作
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const resolveUserId = () => {
  if (typeof window === 'undefined') return 'anonymous'
  return window.localStorage.getItem('nexlearn-current-user') || 'anonymous'
}

const userScopedStorage = {
  async getItem(name: string) {
    return localforage.getItem<string>(`${name}:${resolveUserId()}`)
  },
  async setItem(name: string, value: string) {
    await localforage.setItem(`${name}:${resolveUserId()}`, value)
  },
  async removeItem(name: string) {
    return localforage.removeItem(`${name}:${resolveUserId()}`)
  },
}

// 创建默认状态
const createDefaultState = (): AppState => ({
  currentProject: null,
  nodes: [],
  edges: [],
  ui: {
    theme: 'light',
    sidebarOpen: false,
    selectedNodeId: null,
    canvas: {
      zoom: 1,
      pan: { x: 0, y: 0 },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
    modals: {
      nodeCreate: false,
      nodeEdit: false,
      settings: false,
      export: false,
    },
  },
  preferences: {
    theme: 'light',
    language: 'zh-CN',
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    apiBaseUrl: '',
    llmBaseUrl: '',
    apiKey: '',
    ollamaBaseUrl: '',
    ollamaModel: '',
    ollamaApiKey: '',
    searchProvider: 'bing',
    searchApiKey: '',
    searchEngineId: '',
    enableSearch: true,
    generationLength: 'medium',
    writingStyle: '',
    autoSave: true,
    autoSaveInterval: 5,
  },
  chat: {
    messages: [],
    draft: '',
    isLoading: false,
  },
  isLoading: false,
  error: null,
})

// 创建 store
export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...createDefaultState(),

      // 项目操作
      setCurrentProject: (project) => set((state) => ({
        currentProject: project,
        nodes: project?.nodes ?? [],
        edges: project?.edges ?? [],
        ui: {
          ...state.ui,
          selectedNodeId: null,
        },
      })),

      createProject: async (name) => {
        const newProject: Project = {
          id: crypto.randomUUID(),
          userId: resolveUserId(),
          name,
          nodes: [],
          edges: [],
          settings: {
            theme: get().preferences.theme,
            defaultLanguage: get().preferences.language,
            autoSave: true,
            showGrid: true,
            snapToGrid: false,
          },
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }

        set((state) => ({
          currentProject: newProject,
          nodes: [],
          edges: [],
          ui: {
            ...state.ui,
            selectedNodeId: null,
          },
        }))
        return newProject
      },

      updateProject: (updates) => {
        const currentProject = get().currentProject
        if (currentProject) {
          const updatedProject = {
            ...currentProject,
            ...updates,
            metadata: {
              ...currentProject.metadata,
              updatedAt: new Date(),
            },
          }
          set({ currentProject: updatedProject })
        }
      },

      deleteProject: async (projectId) => {
        // TODO: 实现删除逻辑
        set({ currentProject: null, nodes: [], edges: [] })
      },

      // 节点操作
      addNode: (node) => {
        set((state) => ({
          nodes: [...state.nodes, node],
          currentProject: state.currentProject ? {
            ...state.currentProject,
            nodes: [...state.currentProject.nodes, node],
            metadata: {
              ...state.currentProject.metadata,
              updatedAt: new Date(),
            },
          } : null,
        }))
      },

      updateNode: (nodeId, updates) => {
        set((state) => ({
          nodes: state.nodes.map(node =>
            node.id === nodeId ? { ...node, ...updates } : node
          ),
          currentProject: state.currentProject ? {
            ...state.currentProject,
            nodes: state.currentProject.nodes.map(node =>
              node.id === nodeId ? { ...node, ...updates } : node
            ),
            metadata: {
              ...state.currentProject.metadata,
              updatedAt: new Date(),
            },
          } : null,
        }))
      },

      deleteNode: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.filter(node => node.id !== nodeId),
          edges: state.edges.filter(edge =>
            edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId
          ),
          currentProject: state.currentProject ? {
            ...state.currentProject,
            nodes: state.currentProject.nodes.filter(node => node.id !== nodeId),
            edges: state.currentProject.edges.filter(edge =>
              edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId
            ),
            metadata: {
              ...state.currentProject.metadata,
              updatedAt: new Date(),
            },
          } : null,
        }))
      },

      setSelectedNode: (nodeId) => {
        set((state) => ({
          ui: {
            ...state.ui,
            selectedNodeId: nodeId,
          },
        }))
      },

      // 边操作
      addEdge: (edge) => {
        set((state) => {
          console.log('[AppStore] Adding edge:', edge)
          // 检查是否已存在相同ID的边
          const existingEdgeIndex = state.edges.findIndex(e => e.id === edge.id)
          if (existingEdgeIndex !== -1) {
            console.warn('[AppStore] Edge with ID already exists:', edge.id)
            return state // 不添加重复的边
          }

          return {
            edges: [...state.edges, edge],
            currentProject: state.currentProject ? {
              ...state.currentProject,
              edges: [...state.currentProject.edges, edge],
              metadata: {
                ...state.currentProject.metadata,
                updatedAt: new Date(),
              },
            } : null,
          }
        })
      },

      updateEdge: (edgeId, updates) => {
        set((state) => ({
          edges: state.edges.map(edge =>
            edge.id === edgeId ? { ...edge, ...updates } : edge
          ),
          currentProject: state.currentProject ? {
            ...state.currentProject,
            edges: state.currentProject.edges.map(edge =>
              edge.id === edgeId ? { ...edge, ...updates } : edge
            ),
            metadata: {
              ...state.currentProject.metadata,
              updatedAt: new Date(),
            },
          } : null,
        }))
      },

      deleteEdge: (edgeId) => {
        set((state) => ({
          edges: state.edges.filter(edge => edge.id !== edgeId),
          currentProject: state.currentProject ? {
            ...state.currentProject,
            edges: state.currentProject.edges.filter(edge => edge.id !== edgeId),
            metadata: {
              ...state.currentProject.metadata,
              updatedAt: new Date(),
            },
          } : null,
        }))
      },

      // UI 操作
      setTheme: (theme) => {
        set((state) => ({
          ui: { ...state.ui, theme },
          preferences: { ...state.preferences, theme },
        }))
        // 更新 document 类名
        document.documentElement.classList.toggle('dark', theme === 'dark')
      },

      setSidebarOpen: (open) => {
        set((state) => ({
          ui: { ...state.ui, sidebarOpen: open },
        }))
      },

      setCanvasZoom: (zoom) => {
        set((state) => ({
          ui: {
            ...state.ui,
            canvas: { ...state.ui.canvas, zoom },
          },
        }))
      },

      setCanvasPan: (pan) => {
        set((state) => ({
          ui: {
            ...state.ui,
            canvas: { ...state.ui.canvas, pan },
          },
        }))
      },

      // 用户设置操作
      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }))
      },

      // 对话操作
      setChatDraft: (draft) => {
        set((state) => ({
          chat: { ...state.chat, draft }
        }))
      },
      addChatMessage: (msg) => {
        set((state) => ({
          chat: { ...state.chat, messages: [...state.chat.messages, msg] }
        }))
      },
      setChatLoading: (loading) => {
        set((state) => ({
          chat: { ...state.chat, isLoading: loading }
        }))
      },
      clearChat: () => {
        set((state) => ({
          chat: { messages: [], draft: '', isLoading: false }
        }))
      },

      // 通用操作
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      reset: () => set(createDefaultState()),
    }),
    {
      name: 'nexlearn-storage',
      storage: createJSONStorage(() => userScopedStorage),
      partialize: (state) => ({
        currentProject: state.currentProject,
        nodes: state.nodes,
        edges: state.edges,
        preferences: state.preferences,
        ui: {
          theme: state.ui.theme,
        },
      }),
    }
  )
)

// 初始化主题
if (typeof window !== 'undefined') {
  const initialTheme = useAppStore.getState().ui.theme
  document.documentElement.classList.toggle('dark', initialTheme === 'dark')

  // 清除初始化标记，让App重新初始化数据
  sessionStorage.removeItem('app-initialized')
}
