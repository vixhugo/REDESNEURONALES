import type { AppSettings } from '../../types';

const SETTINGS_KEY = 'neurolab_studio_settings_v1';
const LAST_PROJECT_KEY = 'neurolab_studio_last_project_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  show3DGrid: true,
  show3DLabels: true,
  autoRotate3D: false,
  nodeScale: 1.0,
  connectionOpacity: 0.45,
  maxRenderedConnections: 1200,
  chartSmooth: true,
  preferredBackend: 'auto',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors on local preferences
  }
}

export function loadLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function saveLastProjectId(projectId: string | null): void {
  try {
    if (projectId) {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY);
    }
  } catch {
    // Ignore storage error
  }
}

export function applyThemeToDocument(theme: AppSettings['theme']): void {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}
