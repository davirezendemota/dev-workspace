'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyUiTheme, type UiTheme } from '@/app/lib/theme';

type ThemeContextValue = {
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useUiTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useUiTheme must be used within ThemeProvider');
  }
  return context;
}

type ThemeProviderProps = {
  children: React.ReactNode;
};

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<UiTheme>('light');

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next);
    applyUiTheme(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        if (data.ui_theme === 'light' || data.ui_theme === 'dark') {
          setTheme(data.ui_theme);
        }
      } catch {
        /* keep cached theme from inline script */
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
