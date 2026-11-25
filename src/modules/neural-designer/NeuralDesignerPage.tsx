import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Box,
  Camera,
  CheckCircle2,
  Compass,
  Copy,
  Crosshair,
  Eye,
  Focus,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { NeuralCanvas3D, type NeuralCanvas3DHandle } from '../../three/scenes/NeuralCanvas3D';
import {
  type CameraPresetType,
  type CameraTargetState,
  computeNetworkLayout3D,
} from '../../three/utils/networkLayout';
import { validateArchitecture } from '../../ml/architectures/architectureValidator';
import { computeRealForwardActivations } from '../../ml/training/tfEngine';
import { createId } from '../../utils/id';
import type { ActivationType, LayerConfig } from '../../types';

export const NeuralDesignerPage: React.FC = () => {
  const canvasRef = useRef<NeuralCanvas3DHandle | null>(null);
  const {
    projects,
    activeProjectId,
    datasets,
    architectures,
    settings,
    isTraining,
    selectedNeuron,
    selectedConnection,
    selectedLayerId,
    liveActivations,
    createProject,
    createArchitecture,
    updateArchitecture,
    duplicateArchitecture,
    deleteArchitecture,
    initializeArchitectureTFWeights,
    setSelectedNeuron,
    setSelectedConnection,
    setSelectedLayerId,
    setLiveActivations,
  } = useAppStore();

  const projectArchs = useMemo(
    () => architectures.filter((a) => !activeProjectId || a.projectId === activeProjectId),
    [architectures, activeProjectId]
  );

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeDataset =
    datasets.find((d) => d.id === activeProject?.activeDatasetId) ??
    datasets.find((d) => d.projectId === activeProjectId) ??
    null;

  const [selectedArchId, setSelectedArchId] = useState<string | null>(
    activeProject?.activeArchitectureId ?? projectArchs[0]?.id ?? null
  );
  const activeArch =
    architectures.find((a) => a.id === selectedArchId) ?? projectArchs[0] ?? null;

  const [cameraCommand, setCameraCommand] = useState<CameraTargetState | null>(null);
  const [isPropagating, setIsPropagating] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!activeArch) return null;
    return computeNetworkLayout3D(activeArch, settings.maxRenderedConnections);
  }, [activeArch, settings.maxRenderedConnections]);

  const validation = useMemo(() => {
    if (!activeArch) return null;
    return validateArchitecture(activeArch, activeDataset?.prepared);
  }, [activeArch, activeDataset?.prepared]);

  const handleCreateArchitecture = async () => {
    let projId = activeProjectId;
    if (!projId) {
      const p = await createProject({
        name: 'Laboratorio 3D',
        description: 'Proyecto creado desde el diseñador neuronal 3D.',
        goal: 'Diseño y visualización 3D de MLP',
      });
      projId = p.id;
    }
    const created = await createArchitecture(projId, `Red Neuronal ${projectArchs.length + 1}`);
    setSelectedArchId(created.id);
    setSelectedNeuron(null);
    setSelectedConnection(null);
    setSelectedLayerId(null);
  };

  const handleLayersUpdate = async (nextLayers: LayerConfig[]) => {
    if (!activeArch) return;
    await updateArchitecture(activeArch.id, {
      layers: nextLayers,
      weightsInitialized: false,
      weightsSnapshot: undefined,
    });
    setLiveActivations(null);
  };

  const addHiddenLayer = async () => {
    if (!activeArch) return;
    const layers = [...activeArch.layers];
    const hiddenCount = layers.filter((l) => l.type === 'hidden').length;
    const newLayer: LayerConfig = {
      id: createId('layer'),
      name: `Hidden Dense ${hiddenCount + 1}`,
      type: 'hidden',
      units: 8,
      activation: 'relu',
    };
    // Insert right before Output Layer
    layers.splice(Math.max(1, layers.length - 1), 0, newLayer);
    await handleLayersUpdate(layers);
    setSelectedLayerId(newLayer.id);
  };

  const removeLayer = async (layerId: string) => {
    if (!activeArch) return;
    const target = activeArch.layers.find((l) => l.id === layerId);
    if (!target || target.type !== 'hidden') return;
    const next = activeArch.layers.filter((l) => l.id !== layerId);
    await handleLayersUpdate(next);
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  };

  const moveHiddenLayer = async (index: number, direction: -1 | 1) => {
    if (!activeArch) return;
    const targetIdx = index + direction;
    if (targetIdx <= 0 || targetIdx >= activeArch.layers.length - 1) return;
    const copy = [...activeArch.layers];
    [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
    await handleLayersUpdate(copy);
  };

  const updateLayerField = async (layerId: string, patch: Partial<LayerConfig>) => {
    if (!activeArch) return;
    const next = activeArch.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l));
    await handleLayersUpdate(next);
  };

  const syncWithDatasetDimensions = async () => {
    if (!activeArch || !activeDataset?.prepared) return;
    const { inputDim, outputDim, taskType } = activeDataset.prepared;
    const next = activeArch.layers.map((l, idx) => {
      if (idx === 0) return { ...l, units: inputDim };
      if (idx === activeArch.layers.length - 1) {
        return {
          ...l,
          units: outputDim,
          activation: (taskType === 'regression' ? 'linear' : 'softmax') as ActivationType,
        };
      }
      return l;
    });
    await handleLayersUpdate(next);
    setStatusNotice(`Dimensiones sincronizadas con "${activeDataset.name}": ${inputDim} entradas → ${outputDim} salidas.`);
  };

  const handleInitializeWeights = async () => {
    if (!activeArch) return;
    await initializeArchitectureTFWeights(activeArch.id);
    setStatusNotice('Pesos y sesgos reales inicializados mediante TensorFlow.js.');
  };

  const triggerCameraPreset = (preset: CameraPresetType) => {
    if (!layout) return;
    const dist = Math.max(16, layout.spanX * 0.9, layout.spanYZ * 1.4);
    const nonce = Date.now();

    if (preset === 'reset' || preset === 'center') {
      setCameraCommand({ position: [0, 3.5, dist], target: [0, 0, 0], nonce });
    } else if (preset === 'front') {
      setCameraCommand({ position: [0, 0, dist], target: [0, 0, 0], nonce });
    } else if (preset === 'side') {
      setCameraCommand({ position: [dist + 4, 1.5, 0], target: [0, 0, 0], nonce });
    } else if (preset === 'top') {
      setCameraCommand({ position: [0, dist + 4, 0.01], target: [0, 0, 0], nonce });
    } else if (preset === 'focusLayer') {
      const targetLayerId = selectedLayerId ?? selectedNeuron?.layerId ?? activeArch?.layers[0]?.id;
      const layerLayout = layout.layers.find((l) => l.layer.id === targetLayerId);
      if (layerLayout) {
        setCameraCommand({
          position: [layerLayout.center[0] + 4, 2, 10],
          target: layerLayout.center,
          nonce,
        });
      }
    } else if (preset === 'focusNeuron' && selectedNeuron) {
      const node = layout.neurons.find(
        (n) =>
          n.layerIndex === selectedNeuron.layerIndex &&
          n.neuronIndex === selectedNeuron.neuronIndex
      );
      if (node) {
        setCameraCommand({
          position: [node.position[0] + 2.5, node.position[1] + 1.5, node.position[2] + 5.5],
          target: node.position,
          nonce,
        });
      }
    }
  };

  const toggleRealForwardPropagation = async () => {
    if (!activeArch) return;
    if (isPropagating) {
      setIsPropagating(false);
      return;
    }

    // Ensure real weights exist before computing real forward pass
    if (!activeArch.weightsInitialized || !activeArch.weightsSnapshot) {
      await initializeArchitectureTFWeights(activeArch.id);
    }

    const updatedArch = useAppStore
      .getState()
      .architectures.find((a) => a.id === activeArch.id);
    if (!updatedArch) return;

    const inputDim = updatedArch.layers[0]?.units ?? 1;
    let inputVector: number[];

    if (activeDataset?.prepared && activeDataset.prepared.XTest.length > 0) {
      const row = activeDataset.prepared.XTest[sampleIdx % activeDataset.prepared.XTest.length];
      inputVector = row.slice(0, inputDim);
      setStatusNotice(
        `Propagación real ejecutada con registro Test #${(sampleIdx % activeDataset.prepared.XTest.length) + 1} de "${activeDataset.name}".`
      );
      setSampleIdx((i) => i + 1);
    } else {
      // Deterministic unit input vector when no dataset is loaded yet
      inputVector = Array.from({ length: inputDim }, (_, i) => Number(((i + 1) / inputDim).toFixed(2)));
      setStatusNotice('Propagación real ejecutada con vector normalizado de prueba.');
    }

    const acts = computeRealForwardActivations(updatedArch, inputVector);
    setLiveActivations(acts);
    setIsPropagating(true);
  };

  const capture3DImage = () => {
    const dataUrl = canvasRef.current?.captureScreenshot();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${activeArch?.name.replace(/[^a-zA-Z0-9_-]/g, '_') ?? 'red_3d'}.png`;
    a.click();
  };

  // Derive selected layer / neuron / connection details
  const inspectedLayer = activeArch?.layers.find(
    (l) => l.id === (selectedLayerId ?? selectedNeuron?.layerId)
  );
  const inspectedLayerIndex = inspectedLayer
    ? activeArch?.layers.findIndex((l) => l.id === inspectedLayer.id) ?? -1
    : -1;

  const neuronDetails = useMemo(() => {
    if (!activeArch || !selectedNeuron) return null;
    const layer = activeArch.layers[selectedNeuron.layerIndex];
    if (!layer) return null;
    const snap = activeArch.weightsSnapshot?.[selectedNeuron.layerIndex];
    const nextSnap = activeArch.weightsSnapshot?.[selectedNeuron.layerIndex + 1];
    const prevLayer = activeArch.layers[selectedNeuron.layerIndex - 1];
    const nextLayer = activeArch.layers[selectedNeuron.layerIndex + 1];

    const bias =
      snap?.initialized && snap.biases[selectedNeuron.neuronIndex] !== undefined
        ? snap.biases[selectedNeuron.neuronIndex]
        : null;

    const incoming = prevLayer
      ? Array.from({ length: prevLayer.units }, (_, srcIdx) => ({
          fromLayerIndex: selectedNeuron.layerIndex - 1,
          fromNeuronIndex: srcIdx,
          weight:
            snap?.initialized && snap.weights[srcIdx]?.[selectedNeuron.neuronIndex] !== undefined
              ? snap.weights[srcIdx][selectedNeuron.neuronIndex]
              : null,
        }))
      : [];

    const outgoing = nextLayer
      ? Array.from({ length: nextLayer.units }, (_, dstIdx) => ({
          toLayerIndex: selectedNeuron.layerIndex + 1,
          toNeuronIndex: dstIdx,
          weight:
            nextSnap?.initialized &&
            nextSnap.weights[selectedNeuron.neuronIndex]?.[dstIdx] !== undefined
              ? nextSnap.weights[selectedNeuron.neuronIndex][dstIdx]
              : null,
        }))
      : [];

    const activationValue =
      liveActivations?.[selectedNeuron.layerIndex]?.[selectedNeuron.neuronIndex] ?? null;

    return { layer, bias, incoming, outgoing, activationValue };
  }, [activeArch, selectedNeuron, liveActivations]);

  const connectionWeightValue = useMemo(() => {
    if (!activeArch || !selectedConnection) return null;
    const snap = activeArch.weightsSnapshot?.[selectedConnection.toLayerIndex];
    if (!snap?.initialized) return null;
    return snap.weights[selectedConnection.fromNeuronIndex]?.[selectedConnection.toNeuronIndex] ?? null;
  }, [activeArch, selectedConnection]);

  if (!activeArch || !layout) {
    return (
      <div className="nl-surface rounded-2xl border p-10 text-center">
        <Box className="mx-auto h-10 w-10 text-cyan-400" />
        <h2 className="mt-3 text-lg font-bold">Diseñador Neuronal 3D</h2>
        <p className="nl-text-muted mt-1 text-sm">
          Crea tu primera arquitectura para visualizar e interactuar con la red en 3D.
        </p>
        <button
          onClick={() => void handleCreateArchitecture()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" /> Crear Arquitectura 3D
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Designer Control Bar */}
      <div className="nl-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Box className="h-5 w-5 text-cyan-400" />
          <select
            value={activeArch.id}
            onChange={(e) => {
              setSelectedArchId(e.target.value);
              setSelectedNeuron(null);
              setSelectedConnection(null);
              setSelectedLayerId(null);
            }}
            className="nl-surface-muted rounded-lg border px-3 py-1.5 text-sm font-semibold focus:border-cyan-500 focus:outline-hidden"
          >
            {projectArchs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.layers.map((l) => l.units).join('→')})
              </option>
            ))}
          </select>

          <button
            onClick={() => void handleCreateArchitecture()}
            className="nl-surface-muted inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:border-cyan-500/50"
            title="Nueva arquitectura"
          >
            <Plus className="h-3.5 w-3.5 text-cyan-400" /> Nueva
          </button>
          <button
            onClick={async () => {
              const copy = await duplicateArchitecture(activeArch.id);
              if (copy) setSelectedArchId(copy.id);
            }}
            className="nl-surface-muted inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:border-cyan-500/50"
            title="Duplicar arquitectura"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </button>
          {projectArchs.length > 1 && (
            <button
              onClick={() => void deleteArchitecture(activeArch.id)}
              className="nl-surface-muted inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:border-rose-500/50"
              title="Eliminar arquitectura"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Camera & Action Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeDataset?.prepared && (
            <button
              onClick={() => void syncWithDatasetDimensions()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/25"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ajustar a Dataset ({activeDataset.prepared.inputDim}→{activeDataset.prepared.outputDim})
            </button>
          )}

          <button
            onClick={() => void handleInitializeWeights()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
          >
            <Zap className="h-3.5 w-3.5" />
            {activeArch.weightsInitialized ? 'Reinicializar Pesos' : 'Inicializar Pesos (TF.js)'}
          </button>

          <button
            onClick={() => void toggleRealForwardPropagation()}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isPropagating
                ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
            }`}
          >
            {isPropagating ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPropagating ? 'Detener Flujo' : 'Propagar Señal Real'}
          </button>

          <button
            onClick={capture3DImage}
            className="nl-surface-muted inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:border-cyan-500/50"
            title="Capturar imagen PNG del modelo 3D"
          >
            <Camera className="h-3.5 w-3.5" /> PNG
          </button>
        </div>
      </div>

      {/* Validation & Camera Presets Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {validation?.valid ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Arquitectura válida • {validation.totalParameters.toLocaleString()} parámetros
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 font-medium text-rose-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {validation?.errors[0]}
            </span>
          )}
          {validation?.warnings.map((w, i) => (
            <span key={i} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">
              {w}
            </span>
          ))}
          {statusNotice && <span className="text-cyan-400">{statusNotice}</span>}
        </div>

        {/* Camera Controls */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="nl-text-muted mr-1 flex items-center gap-1">
            <Compass className="h-3.5 w-3.5" /> Cámara:
          </span>
          {(
            [
              ['front', 'Frontal'],
              ['side', 'Lateral'],
              ['top', 'Superior'],
              ['center', 'Centrar'],
              ['reset', 'Restablecer'],
            ] as Array<[CameraPresetType, string]>
          ).map(([preset, label]) => (
            <button
              key={preset}
              onClick={() => triggerCameraPreset(preset)}
              className="nl-surface-muted rounded-md border px-2 py-1 text-[11px] font-medium hover:border-cyan-500/50"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => triggerCameraPreset('focusLayer')}
            disabled={!selectedLayerId && !selectedNeuron}
            className="nl-surface-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:border-cyan-500/50 disabled:opacity-40"
          >
            <Focus className="h-3 w-3" /> Capa
          </button>
          <button
            onClick={() => triggerCameraPreset('focusNeuron')}
            disabled={!selectedNeuron}
            className="nl-surface-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:border-cyan-500/50 disabled:opacity-40"
          >
            <Crosshair className="h-3 w-3" /> Neurona
          </button>
        </div>
      </div>

      {/* Main 3-Column 3D Workspace */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Left: Layer Stack Builder */}
        <div className="nl-surface flex flex-col gap-3 rounded-xl border p-4 xl:col-span-3">
          <div>
            <label className="nl-text-muted mb-1 block text-[11px] font-semibold uppercase">
              Nombre de Arquitectura
            </label>
            <input
              type="text"
              value={activeArch.name}
              onChange={(e) => void updateArchitecture(activeArch.id, { name: e.target.value })}
              className="nl-surface-muted w-full rounded-lg border px-2.5 py-1.5 text-sm font-medium focus:border-cyan-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="nl-text-muted mb-1 block text-[11px] font-semibold uppercase">
              Tipo de Red
            </label>
            <select
              value={activeArch.family}
              disabled
              className="nl-surface-muted w-full rounded-lg border px-2.5 py-1.5 text-xs"
            >
              <option value="mlp">Feedforward (MLP) — Activo</option>
              <option value="cnn" disabled>CNN (Próximamente)</option>
              <option value="rnn" disabled>RNN (Próximamente)</option>
              <option value="lstm" disabled>LSTM (Próximamente)</option>
              <option value="gan" disabled>GAN (Próximamente)</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Layers className="h-3.5 w-3.5 text-cyan-400" /> Capas ({activeArch.layers.length})
            </span>
            <button
              onClick={() => void addHiddenLayer()}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 px-2 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/30"
            >
              <Plus className="h-3 w-3" /> Capa Oculta
            </button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {activeArch.layers.map((layer, idx) => {
              const isSelected = selectedLayerId === layer.id;
              const badgeColor =
                layer.type === 'input'
                  ? 'text-cyan-400 bg-cyan-500/15'
                  : layer.type === 'output'
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-indigo-400 bg-indigo-500/15';
              return (
                <div
                  key={layer.id}
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    setSelectedNeuron(null);
                    setSelectedConnection(null);
                  }}
                  className={`nl-surface-muted cursor-pointer rounded-lg border p-2.5 transition ${
                    isSelected ? 'border-amber-400/70 ring-1 ring-amber-400/30' : 'hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{layer.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeColor}`}>
                      {layer.type}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="nl-text-muted text-[11px]">Neuronas:</span>
                      <input
                        type="number"
                        min={1}
                        max={256}
                        value={layer.units}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          void updateLayerField(layer.id, {
                            units: Math.max(1, Math.min(256, Number(e.target.value) || 1)),
                          })
                        }
                        className="nl-surface w-14 rounded border px-1.5 py-0.5 font-mono text-xs"
                      />
                    </div>
                    {layer.type !== 'input' && (
                      <select
                        value={layer.activation}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          void updateLayerField(layer.id, {
                            activation: e.target.value as ActivationType,
                          })
                        }
                        className="nl-surface rounded border px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="relu">ReLU</option>
                        <option value="sigmoid">Sigmoid</option>
                        <option value="tanh">Tanh</option>
                        <option value="softmax">Softmax</option>
                        <option value="linear">Linear</option>
                      </select>
                    )}
                  </div>
                  {layer.type === 'hidden' && (
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-800/50 pt-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void moveHiddenLayer(idx, -1);
                        }}
                        disabled={idx <= 1}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        title="Mover arriba"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void moveHiddenLayer(idx, 1);
                        }}
                        disabled={idx >= activeArch.layers.length - 2}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        title="Mover abajo"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeLayer(layer.id);
                        }}
                        className="rounded p-1 text-rose-400 hover:bg-slate-800"
                        title="Eliminar capa"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Primary 3D Viewport */}
        <div className="relative h-[540px] xl:col-span-6 xl:h-[640px]">
          <NeuralCanvas3D
            ref={canvasRef}
            architecture={activeArch}
            layout={layout}
            settings={settings}
            selectedNeuron={selectedNeuron}
            selectedConnection={selectedConnection}
            selectedLayerId={selectedLayerId}
            liveActivations={liveActivations}
            isPropagating={isPropagating}
            isTraining={isTraining}
            cameraCommand={cameraCommand}
            onSelectNeuron={(info) => setSelectedNeuron(info)}
            onSelectLayer={(id) => {
              setSelectedLayerId(id);
              setSelectedNeuron(null);
              setSelectedConnection(null);
            }}
            onSelectConnection={(info) => setSelectedConnection(info)}
          />

          {/* HUD Overlay Legend */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 text-[11px] backdrop-blur-md">
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> Input
            </span>
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> Hidden
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Output
            </span>
            <span className="text-slate-400">
              • {layout.neurons.length} neuronas • {layout.connections.length}/{layout.totalConnectionsInModel} conexiones visibles
            </span>
          </div>

          {isTraining && (
            <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-cyan-300">
              <Activity className="h-4 w-4 animate-pulse" />
              Entrenamiento TF.js en curso — Pesos actualizándose
            </div>
          )}
        </div>

        {/* Right: Inspector Panel (Neuron / Connection / Layer) */}
        <div className="nl-surface flex flex-col gap-4 rounded-xl border p-4 xl:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4 text-cyan-400" />
              Inspector 3D
            </span>
            {(selectedNeuron || selectedConnection || selectedLayerId) && (
              <button
                onClick={() => {
                  setSelectedNeuron(null);
                  setSelectedConnection(null);
                  setSelectedLayerId(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>

          {/* NEURON INSPECTOR */}
          {selectedNeuron && neuronDetails && (
            <div className="space-y-3 text-xs overflow-y-auto max-h-[540px] pr-1">
              <div className="nl-surface-muted rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-amber-400">
                    L{selectedNeuron.layerIndex}-N{selectedNeuron.neuronIndex + 1}
                  </span>
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                    Neurona seleccionada
                  </span>
                </div>
                <div className="nl-text-muted">Capa: {neuronDetails.layer.name}</div>
                <div className="nl-text-muted">Activación: {neuronDetails.layer.activation}</div>
                <div className="pt-1 font-mono">
                  Bias:{' '}
                  {neuronDetails.bias !== null ? (
                    <span className="font-semibold text-cyan-400">
                      {neuronDetails.bias.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-amber-400">Pendiente de inicialización</span>
                  )}
                </div>
                {neuronDetails.activationValue !== null && (
                  <div className="font-mono">
                    Activación propagada:{' '}
                    <span className="font-semibold text-emerald-400">
                      {neuronDetails.activationValue.toFixed(5)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 font-semibold text-slate-300">
                  Conexiones Entrantes ({neuronDetails.incoming.length})
                </div>
                {neuronDetails.incoming.length === 0 ? (
                  <p className="nl-text-muted">Capa de entrada (sin conexiones entrantes).</p>
                ) : (
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {neuronDetails.incoming.slice(0, 40).map((conn) => (
                      <button
                        key={conn.fromNeuronIndex}
                        onClick={() =>
                          setSelectedConnection({
                            fromLayerIndex: conn.fromLayerIndex,
                            fromNeuronIndex: conn.fromNeuronIndex,
                            toLayerIndex: selectedNeuron.layerIndex,
                            toNeuronIndex: selectedNeuron.neuronIndex,
                          })
                        }
                        className="nl-surface-muted flex w-full items-center justify-between rounded border px-2.5 py-1.5 font-mono text-[11px] hover:border-cyan-500/50"
                      >
                        <span>
                          L{conn.fromLayerIndex}-N{conn.fromNeuronIndex + 1} → aquí
                        </span>
                        <span
                          className={
                            conn.weight === null
                              ? 'text-slate-400'
                              : conn.weight >= 0
                              ? 'text-cyan-400'
                              : 'text-rose-400'
                          }
                        >
                          {conn.weight !== null ? conn.weight.toFixed(4) : 'Pendiente'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 font-semibold text-slate-300">
                  Conexiones Salientes ({neuronDetails.outgoing.length})
                </div>
                {neuronDetails.outgoing.length === 0 ? (
                  <p className="nl-text-muted">Capa de salida (sin conexiones salientes).</p>
                ) : (
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {neuronDetails.outgoing.slice(0, 40).map((conn) => (
                      <button
                        key={conn.toNeuronIndex}
                        onClick={() =>
                          setSelectedConnection({
                            fromLayerIndex: selectedNeuron.layerIndex,
                            fromNeuronIndex: selectedNeuron.neuronIndex,
                            toLayerIndex: conn.toLayerIndex,
                            toNeuronIndex: conn.toNeuronIndex,
                          })
                        }
                        className="nl-surface-muted flex w-full items-center justify-between rounded border px-2.5 py-1.5 font-mono text-[11px] hover:border-cyan-500/50"
                      >
                        <span>
                          aquí → L{conn.toLayerIndex}-N{conn.toNeuronIndex + 1}
                        </span>
                        <span
                          className={
                            conn.weight === null
                              ? 'text-slate-400'
                              : conn.weight >= 0
                              ? 'text-cyan-400'
                              : 'text-rose-400'
                          }
                        >
                          {conn.weight !== null ? conn.weight.toFixed(4) : 'Pendiente'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONNECTION INSPECTOR */}
          {selectedConnection && (
            <div className="nl-surface-muted space-y-2.5 rounded-lg border p-3.5 text-xs">
              <div className="font-semibold text-amber-400">Conexión Sináptica Seleccionada</div>
              <div className="font-mono">
                Origen: L{selectedConnection.fromLayerIndex}-N{selectedConnection.fromNeuronIndex + 1} (
                {activeArch.layers[selectedConnection.fromLayerIndex]?.name})
              </div>
              <div className="font-mono">
                Destino: L{selectedConnection.toLayerIndex}-N{selectedConnection.toNeuronIndex + 1} (
                {activeArch.layers[selectedConnection.toLayerIndex]?.name})
              </div>
              <div className="pt-1 font-mono text-sm">
                Peso (w):{' '}
                {connectionWeightValue !== null ? (
                  <span
                    className={
                      connectionWeightValue >= 0
                        ? 'font-bold text-cyan-400'
                        : 'font-bold text-rose-400'
                    }
                  >
                    {connectionWeightValue.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-amber-400">Pendiente de inicialización</span>
                )}
              </div>
            </div>
          )}

          {/* LAYER INSPECTOR */}
          {!selectedNeuron && !selectedConnection && inspectedLayer && (
            <div className="space-y-3 text-xs">
              <div className="nl-surface-muted rounded-lg border p-3 space-y-2">
                <div className="font-semibold text-cyan-400">Propiedades de la Capa</div>
                <div>
                  <label className="nl-text-muted mb-1 block">Nombre</label>
                  <input
                    type="text"
                    value={inspectedLayer.name}
                    onChange={(e) =>
                      void updateLayerField(inspectedLayer.id, { name: e.target.value })
                    }
                    className="nl-surface w-full rounded border px-2 py-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="nl-text-muted mb-1 block">Tipo</label>
                    <div className="nl-surface rounded border px-2 py-1 font-mono uppercase">
                      {inspectedLayer.type}
                    </div>
                  </div>
                  <div>
                    <label className="nl-text-muted mb-1 block">Neuronas</label>
                    <input
                      type="number"
                      min={1}
                      max={256}
                      value={inspectedLayer.units}
                      onChange={(e) =>
                        void updateLayerField(inspectedLayer.id, {
                          units: Math.max(1, Math.min(256, Number(e.target.value) || 1)),
                        })
                      }
                      className="nl-surface w-full rounded border px-2 py-1 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="nl-text-muted mb-1 block">Activación</label>
                  <select
                    disabled={inspectedLayer.type === 'input'}
                    value={inspectedLayer.activation}
                    onChange={(e) =>
                      void updateLayerField(inspectedLayer.id, {
                        activation: e.target.value as ActivationType,
                      })
                    }
                    className="nl-surface w-full rounded border px-2 py-1"
                  >
                    <option value="none">none (Entrada)</option>
                    <option value="relu">ReLU</option>
                    <option value="sigmoid">Sigmoid</option>
                    <option value="tanh">Tanh</option>
                    <option value="softmax">Softmax</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
                <div className="nl-text-muted border-t border-slate-800/60 pt-2 font-mono space-y-1">
                  <div>
                    Dimensión entrada:{' '}
                    {inspectedLayerIndex === 0
                      ? inspectedLayer.units
                      : activeArch.layers[inspectedLayerIndex - 1]?.units}
                  </div>
                  <div>Dimensión salida: {inspectedLayer.units}</div>
                </div>
              </div>
            </div>
          )}

          {!selectedNeuron && !selectedConnection && !inspectedLayer && (
            <div className="nl-surface-muted rounded-lg border border-dashed p-5 text-center text-xs text-slate-400">
              Haz clic en cualquier esfera (neurona), línea (conexión) o plano de capa en la escena 3D para inspeccionar pesos, sesgos y propiedades en tiempo real.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
