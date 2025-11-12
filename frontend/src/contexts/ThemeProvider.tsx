import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

const THEME_STORAGE_KEY = 'theme-preference';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored as Theme;
    }
  } catch (error) {
    // localStorage may be unavailable
    console.warn('Failed to read theme from localStorage:', error);
  }
  return null;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

function applyTheme(resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolvedTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? defaultTheme;
  });

  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);

  // Apply theme to document
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Listen to system preference changes
  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const newResolvedTheme = getSystemTheme();
      applyTheme(newResolvedTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Persist theme to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

