import React, { useMemo, useState } from 'react';
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
import { BarChart3, CheckCircle2, Layers, Table2 } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { formatDuration, formatNumber } from '../../utils/format';

export const EvaluationPage: React.FC = () => {
  const { activeProjectId, trainingRuns, architectures } = useAppStore();

  const projectRuns = useMemo(
    () =>
      trainingRuns.filter(
        (r) => (!activeProjectId || r.projectId === activeProjectId) && r.evaluation
      ),
    [trainingRuns, activeProjectId]
  );

  const [selectedRunId, setSelectedRunId] = useState<string>(projectRuns[0]?.id ?? '');
  const activeRun =
    projectRuns.find((r) => r.id === selectedRunId) ?? projectRuns[0] ?? null;

  const activeArch = activeRun
    ? architectures.find((a) => a.id === activeRun.architectureId)
    : null;

  const [inspectedWeightLayerIdx, setInspectedWeightLayerIdx] = useState(1);

  if (!activeRun || !activeRun.evaluation) {
    return (
      <div className="nl-surface rounded-2xl border p-10 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-cyan-400" />
        <h2 className="mt-3 text-lg font-bold">Evaluación y Métricas</h2>
        <p className="nl-text-muted mt-1 text-sm">
          Entrena primero un modelo para evaluar su rendimiento real sobre el conjunto Test aislado.
        </p>
      </div>
    );
  }

  const ev = activeRun.evaluation;
  const layerSnapshots = activeArch?.weightsSnapshot ?? [];
  const selectedLayerSnap =
    layerSnapshots[inspectedWeightLayerIdx] ?? layerSnapshots[1] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evaluación y Métricas (Conjunto Test)</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Métricas calculadas directamente sobre la partición Test ({ev.sampleCount} registros nunca vistos durante el entrenamiento).
          </p>
        </div>

        <select
          value={activeRun.id}
          onChange={(e) => setSelectedRunId(e.target.value)}
          className="nl-surface-muted rounded-lg border px-3 py-2 text-sm font-semibold"
        >
          {projectRuns.map((r) => (
            <option key={r.id} value={r.id}>
              {r.architectureName} — {r.datasetName} ({r.currentEpoch} ép.)
            </option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      {ev.taskType === 'classification' ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">Accuracy (Test)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
              {((ev.accuracy ?? 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">Precision (Macro)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-400">
              {((ev.precisionMacro ?? 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">Recall (Macro)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-indigo-400">
              {((ev.recallMacro ?? 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">F1-Score (Macro)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-violet-400">
              {((ev.f1Macro ?? 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">Test Loss</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-400">
              {formatNumber(ev.testLoss)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">Test Loss</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-400">
              {formatNumber(ev.testLoss)}
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">MAE</div>
            <div className="mt-1 font-mono text-2xl font-bold text-cyan-400">
              {formatNumber(ev.mae)}
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">RMSE</div>
            <div className="mt-1 font-mono text-2xl font-bold text-indigo-400">
              {formatNumber(ev.rmse)}
            </div>
          </div>
          <div className="nl-surface rounded-xl border p-4">
            <div className="nl-text-muted text-xs">R²</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
              {formatNumber(ev.r2)}
            </div>
          </div>
        </div>
      )}

      {/* Confusion Matrix + Per-class Metrics */}
      {ev.taskType === 'classification' && ev.confusionMatrix && ev.classLabels && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="nl-surface rounded-xl border p-5 overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold">Matriz de Confusión (Real vs Predicho)</h3>
            <table className="w-full text-center font-mono text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-slate-400">Real \ Pred</th>
                  {ev.classLabels.map((lbl) => (
                    <th key={lbl} className="p-2 text-cyan-400">
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ev.confusionMatrix.map((row, rIdx) => {
                  const rowMax = Math.max(1, ...row);
                  return (
                    <tr key={rIdx}>
                      <td className="p-2 text-left font-semibold text-slate-300">
                        {ev.classLabels![rIdx]}
                      </td>
                      {row.map((val, cIdx) => {
                        const isDiag = rIdx === cIdx;
                        const alpha = (val / rowMax) * 0.65 + 0.08;
                        return (
                          <td
                            key={cIdx}
                            style={{
                              backgroundColor: isDiag
                                ? `rgba(16, 185, 129, ${alpha})`
                                : val > 0
                                ? `rgba(244, 63, 94, ${alpha})`
                                : 'rgba(30, 41, 59, 0.4)',
                            }}
                            className="border border-slate-900 p-2.5 font-bold text-white"
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="nl-surface rounded-xl border p-5 overflow-x-auto">
            <h3 className="mb-3 text-sm font-semibold">Métricas por Clase</h3>
            <table className="w-full text-left text-xs">
              <thead className="nl-surface-muted border-b border-slate-800/70 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Clase</th>
                  <th className="px-3 py-2">Precision</th>
                  <th className="px-3 py-2">Recall</th>
                  <th className="px-3 py-2">F1-Score</th>
                  <th className="px-3 py-2">Soporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ev.perClassMetrics?.map((cm) => (
                  <tr key={cm.label}>
                    <td className="px-3 py-2 font-sans font-semibold">{cm.label}</td>
                    <td className="px-3 py-2">{(cm.precision * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">{(cm.recall * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-emerald-400">{(cm.f1 * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2">{cm.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Curves */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="nl-surface rounded-xl border p-5">
          <h3 className="mb-3 text-sm font-semibold">Curva de Pérdida (Train vs Validation)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeRun.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="epoch" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend />
                <Line type="monotone" dataKey="loss" name="Train Loss" stroke="#22d3ee" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="valLoss" name="Val Loss" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="nl-surface rounded-xl border p-5">
          <h3 className="mb-3 text-sm font-semibold">
            {ev.taskType === 'classification' ? 'Curva de Accuracy' : 'Curva de Error Absoluto (MAE)'}
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeRun.history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis dataKey="epoch" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={ev.taskType === 'classification' ? 'accuracy' : 'mae'}
                  name={ev.taskType === 'classification' ? 'Train Acc' : 'Train MAE'}
                  stroke="#10b981"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey={ev.taskType === 'classification' ? 'valAccuracy' : 'valMae'}
                  name={ev.taskType === 'classification' ? 'Val Acc' : 'Val MAE'}
                  stroke="#f59e0b"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Real Weights & Biases Inspector */}
      {layerSnapshots.length > 1 && (
        <div className="nl-surface rounded-xl border p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold">Pesos y Sesgos Aprendidos (Reales TF.js)</h3>
            </div>
            <select
              value={inspectedWeightLayerIdx}
              onChange={(e) => setInspectedWeightLayerIdx(Number(e.target.value))}
              className="nl-surface-muted rounded-lg border px-2.5 py-1.5 text-xs"
            >
              {layerSnapshots.slice(1).map((snap) => (
                <option key={snap.layerId} value={snap.layerIndex}>
                  {snap.layerName} ({snap.inputUnits}×{snap.outputUnits})
                </option>
              ))}
            </select>
          </div>
          {selectedLayerSnap && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 text-xs">
              <div className="nl-surface-muted rounded-lg border p-3 overflow-x-auto lg:col-span-8">
                <div className="mb-2 font-semibold text-slate-300">
                  Matriz de Pesos W ({selectedLayerSnap.inputUnits} entradas × {selectedLayerSnap.outputUnits} neuronas — muestra hasta 8×8)
                </div>
                <table className="font-mono text-[11px]">
                  <tbody>
                    {selectedLayerSnap.weights.slice(0, 8).map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td className="pr-2 text-slate-500">in[{rIdx}]</td>
                        {row.slice(0, 8).map((w, cIdx) => (
                          <td
                            key={cIdx}
                            className={`border border-slate-800/70 px-2 py-1 ${
                              w >= 0 ? 'text-cyan-400' : 'text-rose-400'
                            }`}
                          >
                            {w.toFixed(4)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="nl-surface-muted rounded-lg border p-3 overflow-y-auto max-h-56 lg:col-span-4">
                <div className="mb-2 font-semibold text-slate-300">Vector de Sesgos (Bias b)</div>
                <div className="space-y-1 font-mono text-[11px]">
                  {selectedLayerSnap.biases.slice(0, 16).map((b, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="text-slate-400">b[{idx}]</span>
                      <span className={b >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {b.toFixed(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Experiment Comparison + Sample Predictions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="nl-surface rounded-xl border p-5 overflow-x-auto">
          <div className="mb-3 flex items-center gap-2">
            <Table2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold">Comparación entre Experimentos</h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="nl-surface-muted border-b border-slate-800/70 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Arquitectura</th>
                <th className="px-3 py-2">Opt / LR</th>
                <th className="px-3 py-2">Duración</th>
                <th className="px-3 py-2">Test Loss</th>
                <th className="px-3 py-2">Test Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {projectRuns.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={`cursor-pointer hover:bg-slate-800/30 ${
                    r.id === activeRun.id ? 'bg-cyan-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-sans font-semibold">{r.architectureName}</td>
                  <td className="px-3 py-2 uppercase">
                    {r.config.optimizer} ({r.config.learningRate})
                  </td>
                  <td className="px-3 py-2">{formatDuration(r.elapsedMs)}</td>
                  <td className="px-3 py-2">{formatNumber(r.evaluation?.testLoss)}</td>
                  <td className="px-3 py-2 text-emerald-400">
                    {r.evaluation?.accuracy !== undefined
                      ? `${(r.evaluation.accuracy * 100).toFixed(2)}%`
                      : formatNumber(r.evaluation?.r2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="nl-surface rounded-xl border p-5 overflow-x-auto">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Predicciones en Muestra de Test</h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="nl-surface-muted border-b border-slate-800/70 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Real</th>
                <th className="px-3 py-2">Predicho</th>
                <th className="px-3 py-2">Confianza / Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ev.samplePredictions.slice(0, 12).map((sp) => (
                <tr key={sp.index}>
                  <td className="px-3 py-2 text-slate-500">{sp.index}</td>
                  <td className="px-3 py-2">{sp.actual}</td>
                  <td className="px-3 py-2">{sp.predicted}</td>
                  <td className="px-3 py-2">
                    {sp.correct !== undefined ? (
                      <span className={sp.correct ? 'text-emerald-400' : 'text-rose-400'}>
                        {sp.correct ? '✓' : '✗'}{' '}
                        {sp.confidence !== undefined ? `${(sp.confidence * 100).toFixed(1)}%` : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
