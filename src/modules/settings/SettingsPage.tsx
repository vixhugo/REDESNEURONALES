import React, { useState } from 'react';
import { HardDrive, Moon, RotateCcw, Settings, Sun, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { DEFAULT_SETTINGS } from '../../storage/localstorage/settingsStorage';
import { formatBytes } from '../../utils/format';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    storageStats,
    backendStatus,
    projects,
    datasets,
    models,
    updateSettings,
    clearAllWorkspaceData,
    refreshStorageStats,
  } = useAppStore();

  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración y Preferencias</h1>
        <p className="nl-text-muted mt-1 text-sm">
          Personaliza la apariencia visual, el motor 3D, TensorFlow.js y gestiona el almacenamiento local del navegador.
        </p>
      </div>

      {/* Theme & Charts */}
      <div className="nl-surface rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 font-semibold">
          <Settings className="h-4 w-4 text-cyan-400" />
          Interfaz y Gráficos
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60 pb-4 text-sm">
          <div>
            <div className="font-medium">Tema de color</div>
            <div className="nl-text-muted text-xs">Preferencia guardada automáticamente en LocalStorage.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void updateSettings({ theme: 'dark' })}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold ${
                settings.theme === 'dark'
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400'
                  : 'nl-surface-muted'
              }`}
            >
              <Moon className="h-3.5 w-3.5" /> Oscuro
            </button>
            <button
              onClick={() => void updateSettings({ theme: 'light' })}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold ${
                settings.theme === 'light'
                  ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                  : 'nl-surface-muted'
              }`}
            >
              <Sun className="h-3.5 w-3.5" /> Claro
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between text-sm">
          <span>Suavizado de curvas en gráficos Recharts</span>
          <input
            type="checkbox"
            checked={settings.chartSmooth}
            onChange={(e) => void updateSettings({ chartSmooth: e.target.checked })}
            className="h-4 w-4 accent-cyan-500"
          />
        </label>
      </div>

      {/* 3D & TensorFlow.js Settings */}
      <div className="nl-surface rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Entorno Tridimensional (Three.js) y TF.js</span>
          <button
            onClick={() => void updateSettings(DEFAULT_SETTINGS)}
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar predeterminados
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
            <span>Mostrar grilla espacial 3D</span>
            <input
              type="checkbox"
              checked={settings.show3DGrid}
              onChange={(e) => void updateSettings({ show3DGrid: e.target.checked })}
              className="accent-cyan-500"
            />
          </label>
          <label className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
            <span>Mostrar etiquetas de capas</span>
            <input
              type="checkbox"
              checked={settings.show3DLabels}
              onChange={(e) => void updateSettings({ show3DLabels: e.target.checked })}
              className="accent-cyan-500"
            />
          </label>
          <label className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
            <span>Rotación automática suave</span>
            <input
              type="checkbox"
              checked={settings.autoRotate3D}
              onChange={(e) => void updateSettings({ autoRotate3D: e.target.checked })}
              className="accent-cyan-500"
            />
          </label>
          <div className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
            <span>Backend TensorFlow.js</span>
            <select
              value={settings.preferredBackend}
              onChange={(e) =>
                void updateSettings({
                  preferredBackend: e.target.value as 'auto' | 'webgl' | 'cpu',
                })
              }
              className="nl-surface rounded border px-2 py-1 text-xs"
            >
              <option value="auto">Automático ({backendStatus?.activeBackend})</option>
              <option value="webgl">WebGL (GPU)</option>
              <option value="cpu">CPU</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <div className="mb-1 flex justify-between">
              <span>Escala de neuronas</span>
              <span className="font-mono">{settings.nodeScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.1}
              value={settings.nodeScale}
              onChange={(e) => void updateSettings({ nodeScale: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <span>Opacidad de conexiones</span>
              <span className="font-mono">{Math.round(settings.connectionOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.connectionOpacity}
              onChange={(e) => void updateSettings({ connectionOpacity: Number(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between">
              <span>Máx. conexiones 3D</span>
              <span className="font-mono">{settings.maxRenderedConnections}</span>
            </div>
            <input
              type="range"
              min={200}
              max={4000}
              step={200}
              value={settings.maxRenderedConnections}
              onChange={(e) =>
                void updateSettings({ maxRenderedConnections: Number(e.target.value) })
              }
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* Local Storage Management */}
      <div className="nl-surface rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <HardDrive className="h-4 w-4 text-emerald-400" />
            Gestión de Almacenamiento Local (IndexedDB + LocalStorage)
          </div>
          <button
            onClick={() => void refreshStorageStats()}
            className="text-xs text-cyan-400 hover:underline"
          >
            Actualizar uso
          </button>
        </div>

        <div className="nl-surface-muted rounded-lg border p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span>Espacio utilizado estimado</span>
            <span className="font-mono font-semibold">
              {formatBytes(storageStats.usageBytes)} / {formatBytes(storageStats.quotaBytes)} (
              {storageStats.percent.toFixed(2)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, Math.max(1, storageStats.percent))}%` }}
            />
          </div>
          <div className="nl-text-muted pt-1">
            Registros actuales: {projects.length} proyectos • {datasets.length} datasets • {models.length} modelos guardados.
          </div>
        </div>

        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar todos los proyectos y modelos locales
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/50 bg-rose-500/10 p-3 text-xs">
            <span className="font-semibold text-rose-300">
              ¿Confirmas eliminar permanentemente todos los proyectos, datasets y modelos de IndexedDB?
            </span>
            <button
              onClick={async () => {
                await clearAllWorkspaceData();
                setConfirmClear(false);
              }}
              className="rounded-lg bg-rose-500 px-3 py-1.5 font-semibold text-white hover:bg-rose-400"
            >
              Sí, eliminar todo
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="nl-surface-muted rounded-lg border px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
