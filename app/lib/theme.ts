export const UI_THEMES = ['classic', 'github'] as const;
export const UI_MODES = ['light', 'dark'] as const;

export type UiTheme = (typeof UI_THEMES)[number];
export type UiMode = (typeof UI_MODES)[number];

export const UI_THEME_STORAGE_KEY = 'ui_theme';
export const UI_MODE_STORAGE_KEY = 'ui_mode';

export function isUiTheme(value: unknown): value is UiTheme {
  return value === 'classic' || value === 'github';
}

export function isUiMode(value: unknown): value is UiMode {
  return value === 'light' || value === 'dark';
}

export function applyUiAppearance(theme: UiTheme, mode: UiMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-ui-theme', theme);
  document.documentElement.setAttribute('data-color-mode', mode);
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function readCachedUiAppearance(): {
  theme: UiTheme;
  mode: UiMode;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const cachedTheme = localStorage.getItem(UI_THEME_STORAGE_KEY);
    const cachedMode = localStorage.getItem(UI_MODE_STORAGE_KEY);
    const theme = isUiTheme(cachedTheme) ? cachedTheme : 'classic';
    const mode = isUiMode(cachedMode)
      ? cachedMode
      : isUiMode(cachedTheme)
        ? cachedTheme
        : 'light';
    return { theme, mode };
  } catch {
    return null;
  }
}
