'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  applyUiAppearance,
  isUiMode,
  isUiTheme,
  type UiMode,
  type UiTheme,
} from '@/app/lib/theme';

type ThemeContextValue = {
  theme: UiTheme;
  mode: UiMode;
  setAppearance: (theme: UiTheme, mode: UiMode) => void;
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
  const [theme, setTheme] = useState<UiTheme>('classic');
  const [mode, setMode] = useState<UiMode>('light');

  const setAppearance = useCallback((nextTheme: UiTheme, nextMode: UiMode) => {
    setTheme(nextTheme);
    setMode(nextMode);
    applyUiAppearance(nextTheme, nextMode);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        if (isUiTheme(data.ui_theme) && isUiMode(data.ui_mode)) {
          setAppearance(data.ui_theme, data.ui_mode);
        }
      } catch {
        /* keep cached appearance from inline script */
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [setAppearance]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}
