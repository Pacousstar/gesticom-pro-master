'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('gesticom-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
      document.documentElement.classList.toggle('dark', saved === 'dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('gesticom-theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  const darkCss = `
.dark body,
.dark main,
.dark .bg-white,
.dark .bg-gray-50 {
  background-color: #0f172a !important;
}
.dark .text-gray-900,
.dark .text-gray-800,
.dark .text-gray-700 {
  color: #e2e8f0 !important;
}
.dark .text-gray-600,
.dark .text-gray-500 {
  color: #94a3b8 !important;
}
.dark .border-gray-200,
.dark .border-gray-100 {
  border-color: #334155 !important;
}
.dark .shadow-sm,
.dark .shadow {
  box-shadow: none !important;
}
.dark .divide-gray-200 {
  border-color: #334155 !important;
}
.dark th {
  background-color: #1e293b !important;
  color: #e2e8f0 !important;
}
.dark td {
  border-color: #334155 !important;
}
`

  return (
    <ThemeContext value={{ theme, toggle }}>
      <style dangerouslySetInnerHTML={{ __html: darkCss }} />
      {children}
    </ThemeContext>
  )
}

export const useTheme = () => useContext(ThemeContext)
