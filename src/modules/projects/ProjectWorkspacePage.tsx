import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Box,
  Database,
  Download,
  FileText,
  Layers,
  Play,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateTime, formatDuration, formatNumber } from '../../utils/format';
import { exportProjectBundleAsJSON } from '../../services/projectBundleService';

type WorkspaceTab = 'datasets' | 'architectures' | 'trainings' | 'models' | 'reports';

export const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    projects,
    datasets,
    architectures,
    trainingRuns,
    models,
    reports,
    selectProject,
    updateProject,
  } = useAppStore();

  const [tab, setTab] = useState<WorkspaceTab>('datasets');

  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (projectId && project) {
      void selectProject(projectId);
    }
  }, [projectId]);

  if (!project) {
    return (
      <div className="nl-surface rounded-xl border p-8 text-center">
        <p className="text-base font-semibold">Proyecto no encontrado</p>
        <Link to="/projects" className="mt-3 inline-block text-sm text-cyan-400 hover:underline">
          ← Volver a Mis Proyectos
        </Link>
      </div>
    );
  }

  const pDatasets = datasets.filter((d) => d.projectId === project.id);
  const pArchs = architectures.filter((a) => a.projectId === project.id);
  const pRuns = trainingRuns.filter((r) => r.projectId === project.id);
  const pModels = models.filter((m) => m.projectId === project.id);
  const pReports = reports.filter((r) => r.projectId === project.id);

  const tabs: Array<{ id: WorkspaceTab; label: string; count: number; icon: React.ElementType }> = [
    { id: 'datasets', label: 'Datasets', count: pDatasets.length, icon: Database },
    { id: 'architectures', label: 'Arquitecturas', count: pArchs.length, icon: Box },
    { id: 'trainings', label: 'Entrenamientos y Resultados', count: pRuns.length, icon: Play },
    { id: 'models', label: 'Modelos', count: pModels.length, icon: Layers },
    { id: 'reports', label: 'Reportes', count: pReports.length, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            to="/projects"
            className="nl-text-muted mb-2 inline-flex items-center gap-1.5 text-xs hover:text-cyan-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Mis proyectos
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-0.5 text-sm text-cyan-400">{project.goal || 'Workspace de experimentación IA'}</p>
          {project.description && <p className="nl-text-muted mt-1 text-xs">{project.description}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              exportProjectBundleAsJSON({
                project,
                datasets,
                architectures,
                trainingRuns,
                models,
                reports,
              })
            }
            className="nl-surface-muted inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:border-cyan-500/50"
          >
            <Download className="h-3.5 w-3.5 text-cyan-400" /> Exportar Proyecto
          </button>
          <button
            onClick={() => navigate('/designer')}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Box className="h-3.5 w-3.5" /> Abrir Diseñador 3D
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800/70 pb-3">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              tab === id
                ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30'
                : 'nl-surface-muted border hover:border-slate-600'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'datasets' && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Datasets del Proyecto</h2>
            <Link to="/datasets" className="text-xs font-semibold text-cyan-400 hover:underline">
              + Importar o Preprocesar CSV
            </Link>
          </div>
          {pDatasets.length === 0 ? (
            <p className="nl-text-muted text-sm">No hay datasets importados en este proyecto.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {pDatasets.map((ds) => (
                <div key={ds.id} className="nl-surface-muted rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{ds.name}</span>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      {ds.prepared ? 'Preparado' : 'Sin preparar'}
                    </span>
                  </div>
                  <p className="nl-text-muted mt-1 text-xs">
                    {ds.eda.rowCount} filas × {ds.eda.colCount} columnas • Target: {ds.preprocessing.targetColumn || '—'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={async () => {
                        await updateProject(project.id, { activeDatasetId: ds.id });
                        navigate('/datasets');
                      }}
                      className="text-xs font-medium text-cyan-400 hover:underline"
                    >
                      Analizar / Preparar →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'architectures' && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Arquitecturas Neuronales 3D</h2>
            <Link to="/designer" className="text-xs font-semibold text-cyan-400 hover:underline">
              Diseñar nueva red →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pArchs.map((arch) => (
              <div key={arch.id} className="nl-surface-muted rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{arch.name}</span>
                  <span className="font-mono text-[11px] text-indigo-400">{arch.family.toUpperCase()}</span>
                </div>
                <p className="nl-text-muted mt-1 text-xs">
                  Capas: {arch.layers.map((l) => l.units).join(' → ')} ({arch.weightsInitialized ? 'Pesos TF listos' : 'Sin inicializar'})
                </p>
                <button
                  onClick={async () => {
                    await updateProject(project.id, { activeArchitectureId: arch.id });
                    navigate('/designer');
                  }}
                  className="mt-3 text-xs font-medium text-cyan-400 hover:underline"
                >
                  Abrir en Diseñador 3D →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'trainings' && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Historial de Entrenamientos y Resultados</h2>
            <Link to="/training" className="text-xs font-semibold text-cyan-400 hover:underline">
              Ejecutar nuevo entrenamiento →
            </Link>
          </div>
          {pRuns.length === 0 ? (
            <p className="nl-text-muted text-sm">No se han ejecutado entrenamientos todavía.</p>
          ) : (
            <div className="space-y-3">
              {pRuns.map((run) => (
                <div key={run.id} className="nl-surface-muted flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{run.architectureName}</span>
                      <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-400">
                        {run.status}
                      </span>
                    </div>
                    <p className="nl-text-muted mt-1 text-xs">
                      Dataset: {run.datasetName} • Épocas: {run.currentEpoch}/{run.config.epochs} • {formatDuration(run.elapsedMs)} • Backend: {run.backendUsed}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {run.evaluation && (
                      <div className="text-right font-mono">
                        <div>Test Loss: {formatNumber(run.evaluation.testLoss)}</div>
                        {run.evaluation.accuracy !== undefined && (
                          <div className="text-emerald-400">
                            Acc: {(run.evaluation.accuracy * 100).toFixed(2)}%
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => navigate('/evaluation')}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25"
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Evaluar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'models' && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Modelos Entrenados del Proyecto</h2>
            <Link to="/models" className="text-xs font-semibold text-cyan-400 hover:underline">
              Ir al Model Registry →
            </Link>
          </div>
          {pModels.length === 0 ? (
            <p className="nl-text-muted text-sm">Aún no hay modelos guardados para este proyecto.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {pModels.map((m) => (
                <div key={m.id} className="nl-surface-muted rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{m.name}</span>
                    <span className="font-mono text-xs text-emerald-400">v{m.version}</span>
                  </div>
                  <p className="nl-text-muted mt-1 text-xs">
                    {m.parameterCount} parámetros • {formatDateTime(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Informes Generados</h2>
            <Link to="/reports" className="text-xs font-semibold text-cyan-400 hover:underline">
              Generar nuevo PDF →
            </Link>
          </div>
          {pReports.length === 0 ? (
            <p className="nl-text-muted text-sm">No se han exportado informes PDF para este proyecto.</p>
          ) : (
            <div className="space-y-2">
              {pReports.map((rep) => (
                <div key={rep.id} className="nl-surface-muted flex items-center justify-between rounded-lg border p-3 text-xs">
                  <div>
                    <div className="font-semibold">{rep.title}</div>
                    <div className="nl-text-muted">{rep.fileName}</div>
                  </div>
                  <span className="nl-text-muted">{formatDateTime(rep.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
