import React from 'react'
import { User } from 'lucide-react'

interface UserAvatarProps {
  onSettingsClick: () => void
}

export function UserAvatar({ onSettingsClick }: UserAvatarProps) {
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <button
        className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
        onClick={onSettingsClick}
        title="设置"
      >
        <User className="w-6 h-6" />
      </button>
    </div>
  )
}