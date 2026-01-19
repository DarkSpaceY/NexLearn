import React, { createContext, useContext, useEffect } from 'react'
import { Theme } from '@/types'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  theme: Theme
  children: React.ReactNode
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    // 这里可以添加主题切换逻辑
    console.log('Theme switched to:', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}