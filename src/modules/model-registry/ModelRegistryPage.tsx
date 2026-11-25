import React, { useMemo, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import {
  Download,
  Layers,
  Play,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  downloadTFModelFiles,
  loadTFModelFromIndexedDB,
} from '../../ml/training/tfEngine';
import { formatDateTime, formatNumber } from '../../utils/format';
import type { RegisteredModel } from '../../types';

export const ModelRegistryPage: React.FC = () => {
  const { activeProjectId, models, deleteModel } = useAppStore();
  const [filterByProject, setFilterByProject] = useState(false);

  const visibleModels = useMemo(() => {
    if (filterByProject && activeProjectId) {
      return models.filter((m) => m.projectId === activeProjectId);
    }
    return models;
  }, [models, filterByProject, activeProjectId]);

  const [inferModel, setInferModel] = useState<RegisteredModel | null>(null);
  const [inferInputs, setInferInputs] = useState<number[]>([]);
  const [inferOutput, setInferOutput] = useState<string | null>(null);

  const openInference = (m: RegisteredModel) => {
    setInferModel(m);
    setInferInputs(new Array<number>(m.inputDim).fill(0));
    setInferOutput(null);
  };

  const runLiveInference = async () => {
    if (!inferModel) return;
    const tfModel = await loadTFModelFromIndexedDB(inferModel.tfStorageKey);
    try {
      const inputTensor = tf.tensor2d([inferInputs]);
      const predTensor = tfModel.predict(inputTensor) as tf.Tensor;
      const arr = (await predTensor.array()) as number[][];
      inputTensor.dispose();
      predTensor.dispose();

      const probs = arr[0] ?? [];
      if (inferModel.taskType === 'classification') {
        let bestIdx = 0;
        probs.forEach((v, idx) => {
          if (v > probs[bestIdx]) bestIdx = idx;
        });
        const label = inferModel.classNames[bestIdx] ?? String(bestIdx);
        setInferOutput(
          `Clase predicha: ${label} (${((probs[bestIdx] ?? 0) * 100).toFixed(2)}% confianza)`
        );
      } else {
        setInferOutput(`Valor predicho: ${formatNumber(probs[0])}`);
      }
    } finally {
      tfModel.dispose();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Model Registry Local</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Repositorio de modelos TensorFlow.js almacenados persistentemente en IndexedDB.
          </p>
        </div>
        <label className="nl-surface-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={filterByProject}
            onChange={(e) => setFilterByProject(e.target.checked)}
            className="accent-cyan-500"
          />
          Solo modelos del proyecto activo
        </label>
      </div>

      {visibleModels.length === 0 ? (
        <div className="nl-surface rounded-2xl border border-dashed p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-cyan-400" />
          <p className="mt-3 text-base font-semibold">Aún no hay modelos registrados</p>
          <p className="nl-text-muted mt-1 text-sm">
            Entrena una red neuronal en el módulo Entrenamientos para guardarla automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModels.map((m) => (
            <div key={m.id} className="nl-surface flex flex-col justify-between rounded-xl border p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">{m.name}</h3>
                    <p className="text-xs text-cyan-400">Proyecto: {m.projectName}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-400">
                    v{m.version}
                  </span>
                </div>

                <div className="nl-surface-muted mt-3 space-y-1 rounded-lg border p-3 font-mono text-xs">
                  <div>Arquitectura: {m.layers.map((l) => l.units).join(' → ')}</div>
                  <div>Parámetros: {m.parameterCount.toLocaleString()}</div>
                  <div>Dataset: {m.datasetName}</div>
                  <div>Test Loss: {formatNumber(m.metricsSummary.testLoss)}</div>
                  {m.metricsSummary.accuracy !== undefined && (
                    <div className="text-emerald-400">
                      Accuracy: {(m.metricsSummary.accuracy * 100).toFixed(2)}%
                    </div>
                  )}
                </div>

                <p className="nl-text-muted mt-2 text-[11px]">
                  Entrenado: {formatDateTime(m.createdAt)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-3">
                <button
                  onClick={() => openInference(m)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/25"
                >
                  <Play className="h-3.5 w-3.5" /> Probar Inferencia
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => void downloadTFModelFiles(m.tfStorageKey, m.name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium hover:border-cyan-500/50"
                    title="Exportar model.json y pesos (.bin)"
                  >
                    <Download className="h-3.5 w-3.5 text-cyan-400" /> JSON + Pesos
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el modelo "${m.name}" de IndexedDB?`)) {
                        void deleteModel(m.id);
                      }
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                    title="Eliminar modelo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Inference Modal */}
      {inferModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="nl-surface w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Inferencia en Vivo — {inferModel.name}</h2>
              <button
                onClick={() => setInferModel(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            <p className="nl-text-muted text-xs">
              Introduce valores normalizados para las {inferModel.inputDim} variables de entrada y ejecuta el modelo cargado desde IndexedDB.
            </p>
            <div className="max-h-60 grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 text-xs">
              {inferInputs.map((val, idx) => (
                <div key={idx}>
                  <label className="nl-text-muted mb-1 block truncate font-mono">
                    {inferModel.featureNames[idx] ?? `x[${idx}]`}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={val}
                    onChange={(e) => {
                      const next = [...inferInputs];
                      next[idx] = Number(e.target.value) || 0;
                      setInferInputs(next);
                    }}
                    className="nl-surface-muted w-full rounded border px-2 py-1.5 font-mono"
                  />
                </div>
              ))}
            </div>
            {inferOutput && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 font-mono text-sm font-semibold text-emerald-300">
                {inferOutput}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setInferModel(null)}
                className="nl-surface-muted rounded-lg border px-4 py-2 text-xs font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={() => void runLiveInference()}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Ejecutar Predicción TF.js
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
