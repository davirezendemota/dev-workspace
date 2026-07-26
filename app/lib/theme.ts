export const UI_THEMES = ['light', 'dark'] as const;

export type UiTheme = (typeof UI_THEMES)[number];

export const UI_THEME_STORAGE_KEY = 'ui_theme';

export function isUiTheme(value: unknown): value is UiTheme {
  return value === 'light' || value === 'dark';
}

export function applyUiTheme(theme: UiTheme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function readCachedUiTheme(): UiTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return isUiTheme(cached) ? cached : null;
  } catch {
    return null;
  }
}
