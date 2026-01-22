import { useState, useEffect } from 'react'
import { Canvas } from '../components/Canvas'
import { Sidebar } from '../components/Sidebar'
import { Toolbar } from '../components/Toolbar'
import { UserAvatar } from '../components/UserAvatar'
import { SettingsPanel } from '../components/SettingsPanel'
import { Node, Project, Theme } from '../types'
import { NodeDetailView } from '../components/NodeDetailView'
import { IdeaDialog } from '../components/IdeaDialog'
import { useAppStore } from '../stores/appStore'
import { useAuthStore } from '../stores/authStore'
import { apiClient } from '../lib/api'

async function saveCurrentProjectToBackend() {
  try {
    const authState = useAuthStore.getState()
    if (!authState.isAuthenticated || !authState.user) return

    const appState = useAppStore.getState()
    const { currentProject, nodes, edges } = appState

    let project = currentProject

    if (!project) {
      project = await appState.createProject('默认项目')
    }

    const enriched: Project = {
      ...project,
      userId: authState.user.id,
      nodes,
      edges,
      metadata: {
        ...project.metadata,
        updatedAt: new Date(),
        lastOpenedAt: new Date(),
      },
    }

    await apiClient.saveCurrentProject(enriched)
  } catch (error) {
    console.error('自动保存到后端失败', error)
  }
}

export function WorkspacePage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [ideaDialogNode, setIdeaDialogNode] = useState<Node | null>(null)
  const { ui, setSidebarOpen, preferences, nodes, edges } = useAppStore()
  const { user, isAuthenticated } = useAuthStore()

  // 进入工作区时，总是从后端加载当前项目，保证跨浏览器同步
  useEffect(() => {
    if (!isAuthenticated || !user) return

    let cancelled = false

    const loadRemoteProject = async () => {
      try {
        const remote = await apiClient.getCurrentProject()
        if (!remote || cancelled) return

        const appState = useAppStore.getState()

        const theme: Theme =
          remote.settings.theme === 'light' || remote.settings.theme === 'dark'
            ? remote.settings.theme
            : appState.preferences.theme

        const project: Project = {
          id: remote.id,
          userId: remote.userId,
          name: remote.name,
          nodes: remote.nodes,
          edges: remote.edges,
          settings: {
            theme,
            defaultLanguage: typeof remote.settings.defaultLanguage === 'string'
              ? remote.settings.defaultLanguage
              : appState.preferences.language,
            autoSave: remote.settings.autoSave,
            showGrid: remote.settings.showGrid,
            snapToGrid: remote.settings.snapToGrid,
          },
          metadata: {
            createdAt: new Date(remote.metadata.createdAt),
            updatedAt: new Date(remote.metadata.updatedAt),
            lastOpenedAt: remote.metadata.lastOpenedAt ? new Date(remote.metadata.lastOpenedAt) : undefined,
          },
        }

        useAppStore.getState().setCurrentProject(project)
      } catch (error) {
        console.error('加载远程项目失败', error)
      }
    }

    void loadRemoteProject()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user])

  // 自动保存：定期将当前项目同步到后端（仅登录用户且开启自动保存时）
  useEffect(() => {
    if (!isAuthenticated || !user || !preferences.autoSave) return

    const intervalMinutes = preferences.autoSaveInterval || 5
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000

    const timer = window.setInterval(() => {
      void saveCurrentProjectToBackend()
    }, intervalMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [isAuthenticated, user, preferences.autoSave, preferences.autoSaveInterval])

  // 基于内容变更的自动保存：当节点或连线发生变化时立即保存
  useEffect(() => {
    if (!isAuthenticated || !user) return

    void saveCurrentProjectToBackend()
  }, [isAuthenticated, user, nodes, edges])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* 主画布区域 */}
      {!settingsOpen && !selectedNode && <Canvas onNodeDoubleClick={setSelectedNode} onNodeIdeaClick={setIdeaDialogNode} />}

      {/* 侧边栏抽屉 */}
      <Sidebar isOpen={ui.sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* 工具栏 */}
      <Toolbar />

      {/* 用户头像和菜单 */}
      <UserAvatar onSettingsClick={() => setSettingsOpen(true)} />

      {/* 节点详情视图 */}
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}

      {/* 节点详情界面 */}
      {selectedNode && (
        <NodeDetailView
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* 联想推荐对话框 */}
      {ideaDialogNode && (
        <IdeaDialog
          node={ideaDialogNode}
          isOpen={!!ideaDialogNode}
          onClose={() => setIdeaDialogNode(null)}
        />
      )}

      {/* 全局覆盖层 */}
      <div id="modal-root" />
    </div>
  )
}
