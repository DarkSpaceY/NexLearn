import { create } from 'zustand'
import { Project, User } from '../types'
import { apiClient } from '../lib/api'
import { useAppStore } from '@/stores/appStore'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  checkAuth: () => Promise<void>
  setUser: (user: User) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // 初始加载状态为 true
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await apiClient.me()
      if (res.success && res.data?.user) {
        set({ user: res.data.user, isAuthenticated: true })
      } else {
        set({ user: null, isAuthenticated: false })
      }
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : ''
      const code = (err && (err.code as string)) || ''
      const isUnauthorized =
        code === 'UNAUTHORIZED' ||
        message.includes('Unauthorized')
      if (isUnauthorized) {
        set({ user: null, isAuthenticated: false })
      } else {
        const prev = get()
        set({
          user: prev.user,
          isAuthenticated: prev.isAuthenticated,
          error: 'AUTH_CHECK_FAILED',
        })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  setUser: (user: User) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nexlearn-current-user', user.id)
    }
    const appState = useAppStore.getState()
    const hasLocalData =
      !!appState.currentProject ||
      appState.nodes.length > 0 ||
      appState.edges.length > 0

    set({ user, isAuthenticated: true })

    if (hasLocalData) {
      (async () => {
        try {
          const baseProject: Project =
            appState.currentProject ?? {
              id: crypto.randomUUID(),
              userId: user.id,
              name: '默认项目',
              nodes: [],
              edges: [],
              settings: {
                theme: appState.preferences.theme,
                defaultLanguage: appState.preferences.language,
                autoSave: true,
                showGrid: true,
                snapToGrid: false,
              },
              metadata: {
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }

          const enriched: Project = {
            ...baseProject,
            userId: user.id,
            nodes: appState.nodes,
            edges: appState.edges,
            metadata: {
              ...baseProject.metadata,
              updatedAt: new Date(),
              lastOpenedAt: new Date(),
            },
          }

          await apiClient.saveCurrentProject(enriched)
        } catch (error) {
          console.error('登录时同步本地项目到后端失败', error)
        } finally {
          useAppStore.getState().reset()
          ;(useAppStore as any).persist?.rehydrate?.()
        }
      })()
    } else {
      useAppStore.getState().reset()
      ;(useAppStore as any).persist?.rehydrate?.()
    }
  },

  logout: async () => {
    try {
      await apiClient.logout()
    } catch (err) {
      console.error('Logout failed', err)
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('nexlearn-current-user')
      }
      // 无论后端是否成功，前端都清除状态
      set({ user: null, isAuthenticated: false })
      useAppStore.getState().reset()
      ;(useAppStore as any).persist?.rehydrate?.()
    }
  }
}))
