import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { apiClient } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { Loader2 } from 'lucide-react'

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { isAuthenticated, setUser } = useAuthStore()

  // 如果已登录，重定向到主页
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const displayName = formData.get('displayName') as string

    try {
      if (isLogin) {
        const res = await apiClient.login({ email, password })
        if (res.success && res.data?.user) {
          setUser(res.data.user)
          navigate('/')
        }
      } else {
        const res = await apiClient.register({ email, password, displayName })
        if (res.success && res.data?.user) {
          // 注册成功后自动登录
          const loginRes = await apiClient.login({ email, password })
          if (loginRes.success && loginRes.data?.user) {
            setUser(loginRes.data.user)
            navigate('/')
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-xl shadow-lg border border-border">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {isLogin ? '欢迎回来' : '创建新账户'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            NexLearn - 您的 AI 自学助手
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1">昵称</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required={!isLogin}
                  className="appearance-none relative block w-full px-3 py-2 border border-input placeholder-muted-foreground text-foreground bg-background rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                  placeholder="请输入您的昵称"
                />
              </div>
            )}
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-foreground mb-1">邮箱地址</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-input placeholder-muted-foreground text-foreground bg-background rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">密码</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="appearance-none relative block w-full px-3 py-2 border border-input placeholder-muted-foreground text-foreground bg-background rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                placeholder="至少8位字符"
              />
            </div>
          </div>

          {error && (
            <div className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />}
              {isLogin ? '登录' : '注册'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {isLogin ? '还没有账号？点击注册' : '已有账号？点击登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
