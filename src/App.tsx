import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { WorkspacePage } from './pages/WorkspacePage'
import { AuthPage } from './pages/AuthPage'
import { useAppStore } from './stores/appStore'
import { useAuthStore } from './stores/authStore'
import { Loader2 } from 'lucide-react'
import { apiClient } from './lib/api'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function App() {
  const { ui, preferences, updatePreferences } = useAppStore()
  const { checkAuth, user, isAuthenticated } = useAuthStore()
  const hasLoadedPreferencesRef = useRef(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    apiClient.setPreferredBaseUrl(preferences.apiBaseUrl)
  }, [preferences.apiBaseUrl])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    let cancelled = false

    ;(async () => {
      try {
        const prefs = await apiClient.getPreferences()
        if (prefs) {
          updatePreferences(prefs)
        }
      } catch (error) {
        console.error('加载用户偏好失败', error)
      } finally {
        if (!cancelled) {
          hasLoadedPreferencesRef.current = true
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user, updatePreferences])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    if (!hasLoadedPreferencesRef.current) return

    const timer = window.setTimeout(async () => {
      try {
        await apiClient.savePreferences(preferences)
      } catch (error) {
        console.error('保存用户偏好失败', error)
      }
    }, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isAuthenticated, user, preferences])

  return (
    <ThemeProvider theme={ui.theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WorkspacePage />
              </ProtectedRoute>
            }
          />
          {/* 任何其他路径重定向到 / */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
