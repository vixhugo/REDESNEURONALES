import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Box,
  Cpu,
  Database,
  FileText,
  FolderKanban,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Mis proyectos', icon: FolderKanban },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/designer', label: 'Diseñador 3D', icon: Box },
  { to: '/training', label: 'Entrenamientos', icon: Play },
  { to: '/evaluation', label: 'Evaluaciones', icon: BarChart3 },
  { to: '/models', label: 'Model Registry', icon: Layers },
  { to: '/reports', label: 'Reportes', icon: FileText },
  { to: '/fundamentals', label: 'Fundamentos neurorales', icon: BookOpen },
  { to: '/settings', label: 'Configuración', icon: Settings },
];

export const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const {
    projects,
    activeProjectId,
    selectProject,
    backendStatus,
    settings,
    updateSettings,
    isTraining,
    liveHistory,
  } = useAppStore();

  const toggleTheme = () => {
    void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`nl-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800/60 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">NeuroLab Studio</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-cyan-400">
                3D AI Workbench
              </div>
            </div>
          </div>
          <button
            className="rounded-md p-1 text-slate-400 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active project selector */}
        <div className="border-b border-slate-800/60 p-3">
          <label className="nl-text-muted mb-1 block text-[11px] font-semibold uppercase tracking-wider">
            Proyecto Activo
          </label>
          <select
            value={activeProjectId ?? ''}
            onChange={(e) => void selectProject(e.target.value || null)}
            className="nl-surface-muted w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:border-cyan-500 focus:outline-hidden"
          >
            {projects.length === 0 && <option value="">Sin proyectos</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
                    : 'nl-text-muted hover:bg-slate-800/40 hover:text-slate-100'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Runtime Status Footer */}
        <div className="border-t border-slate-800/60 p-3 text-xs">
          <div className="nl-surface-muted rounded-lg border p-2.5">
            <div className="flex items-center justify-between">
              <span className="nl-text-muted font-medium">Motor TF.js</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  backendStatus?.isGpuAccelerated
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {backendStatus?.activeBackend ?? 'cpu'}
              </span>
            </div>
            <div className="nl-text-muted mt-1 flex items-center justify-between text-[11px]">
              <span>Ejecución</span>
              <span>Local Browser</span>
            </div>
            {isTraining && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-cyan-400">
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                <span>Entrenando (Época {liveHistory.length})</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="nl-surface sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-slate-700/70 p-1.5 text-slate-400 hover:text-white lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="nl-text-muted hidden sm:inline">Entorno:</span>
              <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
                100% Client-Side • IndexedDB + TF.js {backendStatus?.tfVersion ?? ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="nl-surface-muted flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-cyan-500/50"
              title="Cambiar tema claro/oscuro"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Oscuro</span>
                </>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
