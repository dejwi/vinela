import { useTheme as useNextTheme } from 'next-themes'

type Theme = 'light' | 'dark'

interface UseThemeReturn {
  theme: Theme | undefined
  setTheme: (theme: Theme | 'system') => void
  toggleTheme: () => void
}

export function useTheme(): UseThemeReturn {
  const { theme, setTheme, systemTheme } = useNextTheme()

  const currentTheme = (theme === 'system' ? systemTheme : theme) as
    | Theme
    | undefined

  return {
    theme: currentTheme,
    setTheme,
    toggleTheme: () => setTheme(currentTheme === 'dark' ? 'light' : 'dark'),
  }
}
