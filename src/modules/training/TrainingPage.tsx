import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Cpu,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { validateArchitecture } from '../../ml/architectures/architectureValidator';
import { formatDuration, formatNumber } from '../../utils/format';
import type { LossType, OptimizerType, TrainingConfig } from '../../types';

export const TrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeProjectId,
    datasets,
    architectures,
    trainingRuns,
    backendStatus,
    settings,
    isTraining,
    activeTrainingRunId,
    liveHistory,
    startTraining,
    cancelTraining,
    deleteTrainingRun,
  } = useAppStore();

  const projectDatasets = useMemo(
    () => datasets.filter((d) => !activeProjectId || d.projectId === activeProjectId),
    [datasets, activeProjectId]
  );
  const projectArchs = useMemo(
    () => architectures.filter((a) => !activeProjectId || a.projectId === activeProjectId),
    [architectures, activeProjectId]
  );
  const projectRuns = useMemo(
    () => trainingRuns.filter((r) => !activeProjectId || r.projectId === activeProjectId),
    [trainingRuns, activeProjectId]
  );

  const [datasetId, setDatasetId] = useState<string>(projectDatasets[0]?.id ?? '');
  const [archId, setArchId] = useState<string>(projectArchs[0]?.id ?? '');
  const [epochs, setEpochs] = useState(35);
  const [batchSize, setBatchSize] = useState(16);
  const [learningRate, setLearningRate] = useState(0.01);
  const [optimizer, setOptimizer] = useState<OptimizerType>('adam');
  const [loss, setLoss] = useState<LossType>('categoricalCrossentropy');
  const [seed, setSeed] = useState(42);
  const [autoSaveModel, setAutoSaveModel] = useState(true);
  const [modelName, setModelName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedLive, setElapsedLive] = useState(0);

  const selectedDataset = datasets.find((d) => d.id === datasetId) ?? projectDatasets[0] ?? null;
  const selectedArch = architectures.find((a) => a.id === archId) ?? projectArchs[0] ?? null;

  useEffect(() => {
    if (selectedDataset?.prepared) {
      if (selectedDataset.prepared.taskType === 'regression') {
        setLoss('meanSquaredError');
      } else if (selectedDataset.prepared.outputDim === 1) {
        setLoss('binaryCrossentropy');
      } else {
        setLoss('categoricalCrossentropy');
      }
    }
  }, [selectedDataset?.id, selectedDataset?.prepared?.taskType]);

  useEffect(() => {
    if (!isTraining) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsedLive(Date.now() - start), 250);
    return () => clearInterval(timer);
  }, [isTraining]);

  const validation = useMemo(() => {
    if (!selectedArch) return null;
    return validateArchitecture(selectedArch, selectedDataset?.prepared);
  }, [selectedArch, selectedDataset?.prepared]);

  const handleStart = async () => {
    setErrorMsg(null);
    if (!selectedDataset || !selectedDataset.prepared) {
      setErrorMsg('El dataset seleccionado no está preparado. Ve a Datasets → Preparación y Split.');
      return;
    }
    if (!selectedArch || !validation?.valid) {
      setErrorMsg(validation?.errors[0] ?? 'La arquitectura seleccionada no es válida.');
      return;
    }

    const config: TrainingConfig = {
      epochs,
      batchSize,
      learningRate,
      optimizer,
      loss,
      seed,
    };

    try {
      await startTraining({
        projectId: selectedDataset.projectId,
        datasetId: selectedDataset.id,
        architectureId: selectedArch.id,
        config,
        autoSaveModel,
        modelName: modelName.trim() || undefined,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error ejecutando el entrenamiento.');
    }
  };

  const displayedHistory = isTraining
    ? liveHistory
    : projectRuns[0]?.history ?? [];
  const activeTaskType = selectedDataset?.prepared?.taskType ?? 'classification';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entrenamiento Real con TensorFlow.js</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Configura hiperparámetros, entrena redes MLP reales sobre tus datos preparados y observa la evolución época a época.
          </p>
        </div>
        <div className="nl-surface-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
          <Cpu className="h-4 w-4 text-cyan-400" />
          <span>Backend activo:</span>
          <span className="font-mono font-bold uppercase text-emerald-400">
            {backendStatus?.activeBackend ?? 'cpu'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Training Configuration */}
        <div className="nl-surface rounded-xl border p-5 space-y-4 xl:col-span-4">
          <h2 className="text-base font-semibold">Configuración de Ejecución</h2>

          <div>
            <label className="nl-text-muted mb-1 block text-xs font-semibold">Dataset Preparado</label>
            <select
              value={selectedDataset?.id ?? ''}
              onChange={(e) => setDatasetId(e.target.value)}
              className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm"
            >
              {projectDatasets.length === 0 && <option value="">Sin datasets en este proyecto</option>}
              {projectDatasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.prepared ? `(${d.prepared.inputDim}→${d.prepared.outputDim})` : '(Sin preparar)'}
                </option>
              ))}
            </select>
            {selectedDataset && !selectedDataset.prepared && (
              <Link to="/datasets" className="mt-1 inline-block text-xs text-amber-400 hover:underline">
                Preparar dataset ahora →
              </Link>
            )}
          </div>

          <div>
            <label className="nl-text-muted mb-1 block text-xs font-semibold">Arquitectura MLP</label>
            <select
              value={selectedArch?.id ?? ''}
              onChange={(e) => setArchId(e.target.value)}
              className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm"
            >
              {projectArchs.length === 0 && <option value="">Sin arquitecturas</option>}
              {projectArchs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.layers.map((l) => l.units).join('→')})
                </option>
              ))}
            </select>
          </div>

          {validation && (
            <div
              className={`rounded-lg border p-3 text-xs ${
                validation.valid
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              {validation.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Compatible ({validation.totalParameters.toLocaleString()} parámetros)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Incompatibilidad detectada:
                  </div>
                  {validation.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                  <Link to="/designer" className="inline-block underline">
                    Ajustar en Diseñador 3D →
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Épocas</label>
              <input
                type="number"
                min={1}
                max={500}
                value={epochs}
                onChange={(e) => setEpochs(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="nl-surface-muted w-full rounded-lg border px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Batch Size</label>
              <input
                type="number"
                min={1}
                max={512}
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, Math.min(512, Number(e.target.value) || 1)))}
                className="nl-surface-muted w-full rounded-lg border px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Learning Rate</label>
              <input
                type="number"
                step={0.0005}
                min={0.00001}
                max={1}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value) || 0.001)}
                className="nl-surface-muted w-full rounded-lg border px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Semilla</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 42)}
                className="nl-surface-muted w-full rounded-lg border px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Optimizador</label>
              <select
                value={optimizer}
                onChange={(e) => setOptimizer(e.target.value as OptimizerType)}
                className="nl-surface-muted w-full rounded-lg border px-2.5 py-2"
              >
                <option value="adam">Adam</option>
                <option value="sgd">SGD</option>
                <option value="rmsprop">RMSprop</option>
              </select>
            </div>
            <div>
              <label className="nl-text-muted mb-1 block font-semibold">Función de Pérdida</label>
              <select
                value={loss}
                onChange={(e) => setLoss(e.target.value as LossType)}
                className="nl-surface-muted w-full rounded-lg border px-2.5 py-2"
              >
                <option value="categoricalCrossentropy">Categorical Crossentropy</option>
                <option value="binaryCrossentropy">Binary Crossentropy</option>
                <option value="meanSquaredError">Mean Squared Error</option>
                <option value="meanAbsoluteError">Mean Absolute Error</option>
              </select>
            </div>
          </div>

          <div className="nl-surface-muted space-y-2 rounded-lg border p-3 text-xs">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={autoSaveModel}
                onChange={(e) => setAutoSaveModel(e.target.checked)}
                className="accent-cyan-500"
              />
              Guardar modelo automáticamente en IndexedDB
            </label>
            {autoSaveModel && (
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Nombre del modelo (opcional)"
                className="nl-surface w-full rounded border px-2.5 py-1.5 text-xs"
              />
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {!isTraining ? (
            <button
              onClick={() => void handleStart()}
              disabled={!selectedDataset?.prepared || !validation?.valid}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              Iniciar Entrenamiento Real
            </button>
          ) : (
            <button
              onClick={cancelTraining}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              <Square className="h-4 w-4" />
              Cancelar Entrenamiento ({liveHistory.length}/{epochs})
            </button>
          )}
        </div>

        {/* Right: Live Progress & Real-Time Metrics */}
        <div className="space-y-4 xl:col-span-8">
          {/* Live Status Bar */}
          <div className="nl-surface rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold">
                {isTraining
                  ? `Entrenando Época ${liveHistory.length} de ${epochs}...`
                  : projectRuns[0]
                  ? `Último Run: ${projectRuns[0].architectureName} (${projectRuns[0].status.toUpperCase()})`
                  : 'Listo para entrenar'}
              </div>
              <div className="font-mono text-cyan-400">
                Tiempo: {isTraining ? formatDuration(elapsedLive) : formatDuration(projectRuns[0]?.elapsedMs ?? 0)}
              </div>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
                style={{
                  width: `${
                    isTraining
                      ? Math.min(100, (liveHistory.length / Math.max(1, epochs)) * 100)
                      : projectRuns[0]
                      ? 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {displayedHistory.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                {(() => {
                  const last = displayedHistory[displayedHistory.length - 1];
                  return (
                    <>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="nl-text-muted">Train Loss</div>
                        <div className="font-mono text-sm font-bold text-cyan-400">
                          {formatNumber(last.loss)}
                        </div>
                      </div>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="nl-text-muted">Val Loss</div>
                        <div className="font-mono text-sm font-bold text-indigo-400">
                          {formatNumber(last.valLoss)}
                        </div>
                      </div>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="nl-text-muted">
                          {activeTaskType === 'classification' ? 'Train Accuracy' : 'Train MAE'}
                        </div>
                        <div className="font-mono text-sm font-bold text-emerald-400">
                          {last.accuracy !== undefined
                            ? `${(last.accuracy * 100).toFixed(2)}%`
                            : formatNumber(last.mae)}
                        </div>
                      </div>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="nl-text-muted">
                          {activeTaskType === 'classification' ? 'Val Accuracy' : 'Val MAE'}
                        </div>
                        <div className="font-mono text-sm font-bold text-amber-400">
                          {last.valAccuracy !== undefined
                            ? `${(last.valAccuracy * 100).toFixed(2)}%`
                            : formatNumber(last.valMae)}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Loss & Accuracy Real-Time Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="nl-surface rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold">Evolución de Loss (Train vs Validation)</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayedHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                    <XAxis dataKey="epoch" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    />
                    <Legend />
                    <Line
                      type={settings.chartSmooth ? 'monotone' : 'linear'}
                      dataKey="loss"
                      name="Train Loss"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type={settings.chartSmooth ? 'monotone' : 'linear'}
                      dataKey="valLoss"
                      name="Val Loss"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="nl-surface rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {activeTaskType === 'classification'
                  ? 'Evolución de Accuracy (Train vs Validation)'
                  : 'Evolución de MAE (Train vs Validation)'}
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayedHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                    <XAxis dataKey="epoch" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    />
                    <Legend />
                    <Line
                      type={settings.chartSmooth ? 'monotone' : 'linear'}
                      dataKey={activeTaskType === 'classification' ? 'accuracy' : 'mae'}
                      name={activeTaskType === 'classification' ? 'Train Acc' : 'Train MAE'}
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type={settings.chartSmooth ? 'monotone' : 'linear'}
                      dataKey={activeTaskType === 'classification' ? 'valAccuracy' : 'valMae'}
                      name={activeTaskType === 'classification' ? 'Val Acc' : 'Val MAE'}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Runs Table */}
          <div className="nl-surface rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-semibold">Historial de Entrenamientos</h3>
            {projectRuns.length === 0 ? (
              <p className="nl-text-muted text-xs">Aún no se han ejecutado entrenamientos en este proyecto.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="nl-surface-muted border-b border-slate-800/70 text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Arquitectura</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Épocas</th>
                      <th className="px-3 py-2">Test Loss</th>
                      <th className="px-3 py-2">Métrica Test</th>
                      <th className="px-3 py-2">Backend</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {projectRuns.map((run) => (
                      <tr key={run.id} className={run.id === activeTrainingRunId ? 'bg-cyan-500/5' : ''}>
                        <td className="px-3 py-2 font-semibold">{run.architectureName}</td>
                        <td className="px-3 py-2 uppercase font-mono text-[11px]">{run.status}</td>
                        <td className="px-3 py-2 font-mono">
                          {run.currentEpoch}/{run.config.epochs}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {formatNumber(run.evaluation?.testLoss)}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-400">
                          {run.evaluation?.accuracy !== undefined
                            ? `${(run.evaluation.accuracy * 100).toFixed(2)}%`
                            : run.evaluation?.rmse !== undefined
                            ? `RMSE ${formatNumber(run.evaluation.rmse)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2 font-mono uppercase">{run.backendUsed}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => navigate('/evaluation')}
                              className="rounded bg-indigo-500/15 px-2 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/25"
                            >
                              <BarChart3 className="inline h-3 w-3 mr-1" />
                              Evaluar
                            </button>
                            <button
                              onClick={() => void deleteTrainingRun(run.id)}
                              className="rounded p-1 text-slate-400 hover:text-rose-400"
                              title="Eliminar registro"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
