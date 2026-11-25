import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  FolderKanban,
  HardDrive,
  Layers,
  Play,
  Plus,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '../../stores/useAppStore';
import { StatCard } from '../../components/StatCard';
import { NeuralCanvas3D } from '../../three/scenes/NeuralCanvas3D';
import { computeNetworkLayout3D } from '../../three/utils/networkLayout';
import { computeRealForwardActivations } from '../../ml/training/tfEngine';
import { formatBytes, formatDateTime, formatNumber } from '../../utils/format';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isPropagating, setIsPropagating] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const {
    projects,
    activeProjectId,
    datasets,
    architectures,
    trainingRuns,
    models,
    activities,
    backendStatus,
    storageStats,
    settings,
    isTraining,
    selectedNeuron,
    selectedConnection,
    selectedLayerId,
    liveActivations,
    selectProject,
    initializeArchitectureTFWeights,
    setSelectedNeuron,
    setSelectedConnection,
    setSelectedLayerId,
    setLiveActivations,
  } = useAppStore();

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const activeArchitecture =
    architectures.find((architecture) => architecture.id === activeProject?.activeArchitectureId) ??
    architectures.find((architecture) => architecture.projectId === activeProject?.id) ??
    null;
  const activeDataset =
    datasets.find((dataset) => dataset.id === activeProject?.activeDatasetId) ??
    datasets.find((dataset) => dataset.projectId === activeProject?.id && dataset.prepared) ??
    null;
  const projectTrainingRuns = trainingRuns.filter(
    (run) => !activeProject || run.projectId === activeProject.id
  );
  const latestTrainingRun = projectTrainingRuns[0];
  const networkLayout = useMemo(
    () =>
      activeArchitecture
        ? computeNetworkLayout3D(activeArchitecture, settings.maxRenderedConnections)
        : null,
    [activeArchitecture, settings.maxRenderedConnections]
  );
  const trainingChartData = useMemo(
    () =>
      (latestTrainingRun?.history ?? []).map((metric) => ({
        epoch: metric.epoch,
        loss: metric.loss,
        valLoss: metric.valLoss,
        accuracy: metric.accuracy,
        valAccuracy: metric.valAccuracy,
        mae: metric.mae,
        valMae: metric.valMae,
      })),
    [latestTrainingRun]
  );
  const isRegressionRun = latestTrainingRun?.evaluation?.taskType === 'regression';

  const propagateNetwork = async () => {
    if (!activeArchitecture || isTraining) return;
    if (isPropagating) {
      setIsPropagating(false);
      return;
    }

    try {
      setNetworkError(null);
      let architecture = activeArchitecture;
      if (!architecture.weightsInitialized || !architecture.weightsSnapshot) {
        await initializeArchitectureTFWeights(architecture.id);
        architecture =
          useAppStore.getState().architectures.find((item) => item.id === architecture.id) ??
          architecture;
      }

      const inputDim = architecture.layers[0]?.units ?? 1;
      const testRows = activeDataset?.prepared?.XTest ?? [];
      const input = testRows.length > 0
        ? testRows[sampleIndex % testRows.length].slice(0, inputDim)
        : Array.from({ length: inputDim }, (_, index) =>
            Number(((index + 1) / inputDim).toFixed(2))
          );
      setLiveActivations(computeRealForwardActivations(architecture, input));
      setIsPropagating(true);
      if (testRows.length > 0) setSampleIndex((index) => index + 1);
    } catch (error) {
      setNetworkError(
        error instanceof Error ? error.message : 'No se pudo ejecutar la propagación neuronal.'
      );
    }
  };

  const latestProjects = projects.slice(0, 4);
  const recentActivities = activities.slice(0, 8);

  const shortcuts = [
    { to: '/projects', title: 'Gestionar Proyectos', desc: 'Crea o abre espacios de trabajo', icon: FolderKanban },
    { to: '/datasets', title: 'Importar Dataset CSV', desc: 'EDA automático y preprocesamiento', icon: Database },
    { to: '/designer', title: 'Diseñador 3D', desc: 'Construye e inspecciona redes en 3D', icon: Box },
    { to: '/training', title: 'Entrenar Modelo', desc: 'TensorFlow.js en tiempo real', icon: Play },
    { to: '/models', title: 'Model Registry', desc: 'Versiones y descarga local', icon: Layers },
    { to: '/reports', title: 'Generar Informe PDF', desc: 'Documentación completa local', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Principal</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Laboratorio de redes neuronales ejecutándose 100% en tu navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proyecto
          </Link>
          <Link
            to="/designer"
            className="nl-surface-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition hover:border-cyan-500/50"
          >
            <Box className="h-4 w-4 text-cyan-400" />
            Abrir Diseñador 3D
          </Link>
        </div>
      </div>

      {/* KPI Metrics from IndexedDB */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Proyectos"
          value={projects.length}
          subtitle="Espacios locales"
          icon={FolderKanban}
          accent="cyan"
        />
        <StatCard
          title="Datasets"
          value={datasets.length}
          subtitle="CSV analizados"
          icon={Database}
          accent="indigo"
        />
        <StatCard
          title="Arquitecturas"
          value={architectures.length}
          subtitle="Redes diseñadas"
          icon={Box}
          accent="violet"
        />
        <StatCard
          title="Entrenamientos"
          value={trainingRuns.length}
          subtitle="Ejecuciones TF.js"
          icon={Play}
          accent="amber"
        />
        <StatCard
          title="Modelos Guardados"
          value={models.length}
          subtitle="En IndexedDB"
          icon={Layers}
          accent="emerald"
        />
      </div>

      {/* Active neural network */}
      <section className="nl-surface overflow-hidden rounded-xl border">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800/60 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <h2 className="text-base font-semibold">Red neuronal activa</h2>
            </div>
            <p className="nl-text-muted mt-1 text-xs">
              {activeArchitecture
                ? `${activeArchitecture.name} · ${activeProject?.name ?? 'Proyecto'}`
                : 'Crea una arquitectura para visualizar y ejecutar una red real.'}
            </p>
          </div>
          {activeArchitecture && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="nl-surface-muted rounded-lg border px-3 py-2 font-mono text-xs">
                {activeArchitecture.layers.map((layer) => layer.units).join(' → ')} neuronas
              </span>
              <button
                onClick={() => void propagateNetwork()}
                disabled={isTraining}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPropagating ? <CheckCircle2 className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {isPropagating ? 'Detener propagación' : 'Propagar señal real'}
              </button>
              <Link
                to="/designer"
                className="nl-surface-muted rounded-lg border px-3 py-2 text-xs font-medium hover:border-cyan-500/50"
              >
                Editar red
              </Link>
            </div>
          )}
        </div>

        {activeArchitecture && networkLayout ? (
          <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] lg:p-5">
            <div className="h-[320px] min-h-[280px]">
              <NeuralCanvas3D
                architecture={activeArchitecture}
                layout={networkLayout}
                settings={settings}
                selectedNeuron={selectedNeuron}
                selectedConnection={selectedConnection}
                selectedLayerId={selectedLayerId}
                liveActivations={liveActivations}
                isPropagating={isPropagating}
                isTraining={isTraining}
                cameraCommand={null}
                onSelectNeuron={setSelectedNeuron}
                onSelectLayer={setSelectedLayerId}
                onSelectConnection={setSelectedConnection}
              />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold">¿Cómo funciona?</h3>
                <p className="nl-text-muted mt-1 text-xs leading-5">
                  Al crear una red defines cuántas neuronas hay en cada capa y su función de
                  activación. La capa de entrada recibe las variables del dataset; cada conexión
                  combina esas señales con pesos y sesgos. Las capas ocultas aprenden patrones y
                  la capa de salida produce la predicción.
                </p>
              </div>
              <ol className="space-y-2.5">
                {[
                  ['1', 'Diseña', 'Crea capas y ajusta neuronas en el Diseñador 3D.'],
                  ['2', 'Prepara datos', 'Importa un CSV, elige el objetivo y prepara Train/Validación/Test.'],
                  ['3', 'Entrena', 'TensorFlow.js ajusta pesos con Train y mide el progreso por época.'],
                  ['4', 'Evalúa', 'Comprueba el resultado con Test, separado del entrenamiento.'],
                ].map(([step, title, description]) => (
                  <li key={step} className="nl-surface-muted flex gap-3 rounded-lg border p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[11px] font-bold text-cyan-400">
                      {step}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{title}</p>
                      <p className="nl-text-muted mt-0.5 text-[11px] leading-4">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {networkError && (
                <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {networkError}
                </div>
              )}
              {activeDataset?.prepared && (
                <p className="nl-text-muted text-[11px]">
                  La señal usa una fila de Test de «{activeDataset.name}».
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold">Tu flujo empieza con una arquitectura</p>
              <p className="nl-text-muted mt-1 max-w-2xl text-xs leading-5">
                Crea o selecciona un proyecto, diseña las capas, prepara un CSV y ejecuta el
                entrenamiento. La red y sus resultados se guardan localmente en este navegador.
              </p>
            </div>
            <Link
              to="/designer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Plus className="h-4 w-4" />
              Crear red neuronal
            </Link>
          </div>
        )}
      </section>

      {/* Real training history line charts */}
      <section className="nl-surface rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Evolución del entrenamiento</h2>
            <p className="nl-text-muted mt-1 text-xs">
              {latestTrainingRun
                ? `${latestTrainingRun.architectureName} · ${latestTrainingRun.datasetName} · valores por época`
                : 'Gráficos construidos con las métricas registradas en el último entrenamiento.'}
            </p>
          </div>
          <Link to="/training" className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline">
            Ver entrenamientos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {trainingChartData.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-300">Pérdida (Loss)</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={trainingChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="epoch" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(value: number) => formatNumber(value)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number) => formatNumber(value)}
                      labelFormatter={(label) => `Época ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="loss" name="Train" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="valLoss" name="Validación" stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-300">
                {isRegressionRun ? 'Error absoluto medio (MAE)' : 'Accuracy'}
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={trainingChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="epoch" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(value: number) => formatNumber(value)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 11 }}
                      formatter={(value: number) => formatNumber(value)}
                      labelFormatter={(label) => `Época ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {isRegressionRun ? (
                      <>
                        <Line type="monotone" dataKey="mae" name="Train MAE" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="valMae" name="Validación MAE" stroke="#fbbf24" strokeWidth={2} dot={false} connectNulls />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="accuracy" name="Train" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                        <Line type="monotone" dataKey="valAccuracy" name="Validación" stroke="#fbbf24" strokeWidth={2} dot={false} connectNulls />
                      </>
                    )}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="nl-surface-muted rounded-lg border border-dashed p-6 text-center">
            <p className="nl-text-muted text-sm">Todavía no hay métricas de entrenamiento para graficar.</p>
            <Link to="/training" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:underline">
              Entrenar una red <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Shortcuts */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Accesos Directos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ to, title, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="nl-surface group flex items-center justify-between rounded-xl border p-4 transition hover:border-cyan-500/50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-500/10 p-2.5 text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="nl-text-muted text-xs">{desc}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-cyan-400" />
            </Link>
          ))}
        </div>
      </div>

      {/* Main 3-column lower grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Latest Projects */}
        <div className="nl-surface rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Últimos Proyectos</h2>
            <Link to="/projects" className="text-xs font-medium text-cyan-400 hover:underline">
              Ver todos
            </Link>
          </div>
          {latestProjects.length === 0 ? (
            <div className="nl-surface-muted rounded-lg border border-dashed p-6 text-center">
              <p className="nl-text-muted text-sm">Aún no has creado ningún proyecto.</p>
              <Link
                to="/projects"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Crear primer proyecto
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {latestProjects.map((proj) => {
                const dsCount = datasets.filter((d) => d.projectId === proj.id).length;
                const archCount = architectures.filter((a) => a.projectId === proj.id).length;
                return (
                  <button
                    key={proj.id}
                    onClick={async () => {
                      await selectProject(proj.id);
                      navigate(`/projects/${proj.id}`);
                    }}
                    className="nl-surface-muted block w-full rounded-lg border p-3 text-left transition hover:border-cyan-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{proj.name}</span>
                      <span className="text-[11px] text-cyan-400">Abrir →</span>
                    </div>
                    <p className="nl-text-muted mt-1 line-clamp-1 text-xs">
                      {proj.goal || proj.description || 'Sin objetivo definido'}
                    </p>
                    <div className="nl-text-muted mt-2 flex items-center justify-between text-[11px]">
                      <span>{dsCount} datasets • {archCount} redes</span>
                      <span>{formatDateTime(proj.lastAccessedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="nl-surface rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h2 className="text-base font-semibold">Actividad Reciente</h2>
          </div>
          {recentActivities.length === 0 ? (
            <div className="nl-surface-muted rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
              Las acciones sobre proyectos, datasets y modelos aparecerán aquí.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {recentActivities.map((act) => (
                <div key={act.id} className="nl-surface-muted rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-cyan-400">{act.title}</span>
                    <span className="nl-text-muted text-[10px]">{formatDateTime(act.createdAt)}</span>
                  </div>
                  <p className="nl-text-muted mt-0.5 text-xs">{act.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Runtime Status */}
        <div className="nl-surface rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-semibold">Estado del Entorno</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
              <span className="nl-text-muted">Backend TensorFlow.js activo</span>
              <span className="font-mono font-semibold uppercase text-cyan-400">
                {backendStatus?.activeBackend ?? 'detectando...'}
              </span>
            </div>
            <div className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
              <span className="nl-text-muted">Aceleración GPU</span>
              <span
                className={`font-semibold ${
                  backendStatus?.isGpuAccelerated ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {backendStatus?.isGpuAccelerated
                  ? `Activa (${backendStatus.activeBackend.toUpperCase()})`
                  : 'CPU (Sin aceleración GPU)'}
              </span>
            </div>
            <div className="nl-surface-muted flex items-center justify-between rounded-lg border p-3">
              <span className="nl-text-muted">Tensores en memoria</span>
              <span className="font-mono">
                {backendStatus?.numTensors ?? 0} ({formatBytes(backendStatus?.numBytes ?? 0)})
              </span>
            </div>
            <div className="nl-surface-muted rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="nl-text-muted flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" /> Almacenamiento IndexedDB
                </span>
                <span className="font-mono">
                  {formatBytes(storageStats.usageBytes)} / {formatBytes(storageStats.quotaBytes)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(1, storageStats.percent))}%` }}
                />
              </div>
            </div>
            <Link
              to="/fundamentals"
              className="flex items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Explorar Fundamentos Neurorales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
