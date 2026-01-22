import React from 'react'
import { User, LogOut, Settings, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuthStore } from '../stores/authStore'

interface UserAvatarProps {
  onSettingsClick: () => void
}

export function UserAvatar({ onSettingsClick }: UserAvatarProps) {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow overflow-hidden border-2 border-background"
            title={user?.displayName || user?.email}
          >
            <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-lg">
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[200px] bg-popover rounded-lg shadow-xl p-1 z-50 border border-border animate-in fade-in zoom-in-95 duration-200"
            sideOffset={5}
            align="start"
          >
            <div className="px-2 py-2 text-sm text-muted-foreground border-b border-border mb-1">
              <div className="font-medium text-foreground truncate">
                {user?.displayName || '用户'}
              </div>
              <div className="text-xs truncate">{user?.email}</div>
            </div>

            <DropdownMenu.Item
              className="flex items-center px-2 py-2 text-sm text-foreground rounded hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none"
              onClick={onSettingsClick}
            >
              <Settings className="w-4 h-4 mr-2" />
              设置
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex items-center px-2 py-2 text-sm text-destructive rounded hover:bg-destructive/10 cursor-pointer outline-none mt-1"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
