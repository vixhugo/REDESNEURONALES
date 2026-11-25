import * as tf from '@tensorflow/tfjs';
import type {
  ActivationType,
  EpochMetric,
  EvaluationResult,
  LayerWeightsSnapshot,
  NeuralArchitecture,
  PreparedDataset,
  TrainingConfig,
} from '../../types';
import {
  computeClassificationEvaluation,
  computeRegressionEvaluation,
} from '../evaluation/metricsCalculator';

export interface BackendStatusInfo {
  activeBackend: string;
  availableBackends: string[];
  isGpuAccelerated: boolean;
  tfVersion: string;
  numTensors: number;
  numBytes: number;
}

export async function ensureTFBackend(preferred: 'auto' | 'webgl' | 'cpu' = 'auto'): Promise<BackendStatusInfo> {
  if (preferred !== 'auto') {
    try {
      await tf.setBackend(preferred);
    } catch {
      // Fallback to whatever TFJS supports
    }
  } else {
    // Prefer webgl if available, else cpu
    const current = tf.getBackend();
    if (!current) {
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu');
      }
    }
  }
  await tf.ready();
  const activeBackend = tf.getBackend() || 'cpu';
  const mem = tf.memory();
  return {
    activeBackend,
    availableBackends: Object.keys(tf.engine().registryFactory),
    isGpuAccelerated: activeBackend === 'webgl' || activeBackend === 'webgpu',
    tfVersion: tf.version.tfjs,
    numTensors: mem.numTensors,
    numBytes: mem.numBytes,
  };
}

function mapActivation(act: ActivationType): 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear' {
  if (act === 'none' || act === 'linear') return 'linear';
  return act;
}

function buildOptimizer(config: TrainingConfig): tf.Optimizer {
  switch (config.optimizer) {
    case 'sgd':
      return tf.train.sgd(config.learningRate);
    case 'rmsprop':
      return tf.train.rmsprop(config.learningRate);
    case 'adam':
    default:
      return tf.train.adam(config.learningRate);
  }
}

export function buildSequentialModel(
  architecture: NeuralArchitecture,
  trainingConfig?: TrainingConfig
): tf.Sequential {
  const layers = architecture.layers;
  if (layers.length < 2) {
    throw new Error('La arquitectura debe tener al menos una capa de entrada y una capa de salida.');
  }

  const model = tf.sequential();
  const inputUnits = layers[0].units;

  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];
    const denseConfig: Parameters<typeof tf.layers.dense>[0] = {
      units: layer.units,
      activation: mapActivation(layer.activation),
      useBias: true,
      kernelInitializer: layer.activation === 'relu' ? 'heNormal' : 'glorotUniform',
      name: `${layer.id}_${i}`,
    };
    if (i === 1) {
      denseConfig.inputShape = [inputUnits];
    }
    model.add(tf.layers.dense(denseConfig));
  }

  if (trainingConfig) {
    const isClassification =
      trainingConfig.loss === 'categoricalCrossentropy' ||
      trainingConfig.loss === 'binaryCrossentropy';
    model.compile({
      optimizer: buildOptimizer(trainingConfig),
      loss: trainingConfig.loss,
      metrics: isClassification ? ['accuracy'] : ['mae'],
    });
  }

  return model;
}

export function extractWeightsFromModel(
  model: tf.LayersModel,
  architecture: NeuralArchitecture
): LayerWeightsSnapshot[] {
  const snapshots: LayerWeightsSnapshot[] = [];
  const archLayers = architecture.layers;

  // Input layer has no incoming weights
  if (archLayers.length > 0) {
    snapshots.push({
      layerId: archLayers[0].id,
      layerName: archLayers[0].name,
      layerIndex: 0,
      inputUnits: archLayers[0].units,
      outputUnits: archLayers[0].units,
      weights: [],
      biases: new Array<number>(archLayers[0].units).fill(0),
      initialized: true,
    });
  }

  model.layers.forEach((tfLayer, idx) => {
    const archLayer = archLayers[idx + 1];
    const prevLayer = archLayers[idx];
    if (!archLayer || !prevLayer) return;

    const tensors = tfLayer.getWeights();
    if (tensors.length === 0) return;

    const kernelArr = tensors[0].arraySync() as number[][];
    const biasArr = tensors.length > 1 ? (tensors[1].arraySync() as number[]) : new Array<number>(archLayer.units).fill(0);

    snapshots.push({
      layerId: archLayer.id,
      layerName: archLayer.name,
      layerIndex: idx + 1,
      inputUnits: prevLayer.units,
      outputUnits: archLayer.units,
      weights: kernelArr,
      biases: biasArr,
      initialized: true,
    });
  });

  return snapshots;
}

export async function initializeArchitectureWeights(
  architecture: NeuralArchitecture
): Promise<LayerWeightsSnapshot[]> {
  await ensureTFBackend('auto');
  const model = buildSequentialModel(architecture);
  try {
    return extractWeightsFromModel(model, architecture);
  } finally {
    model.dispose();
  }
}

export interface TrainCallbacks {
  onEpoch: (metric: EpochMetric, latestWeights: LayerWeightsSnapshot[]) => void;
  shouldCancel: () => boolean;
}

export interface TrainRunOutput {
  history: EpochMetric[];
  weightsSnapshot: LayerWeightsSnapshot[];
  evaluation: EvaluationResult;
  backendUsed: string;
  parameterCount: number;
  cancelled: boolean;
  tfModel: tf.Sequential;
}

export async function trainNeuralNetwork(
  architecture: NeuralArchitecture,
  dataset: PreparedDataset,
  config: TrainingConfig,
  preferredBackend: 'auto' | 'webgl' | 'cpu',
  callbacks: TrainCallbacks
): Promise<TrainRunOutput> {
  const backendInfo = await ensureTFBackend(preferredBackend);
  const model = buildSequentialModel(architecture, config);
  const parameterCount = model.countParams();

  const xTrain = tf.tensor2d(dataset.XTrain);
  const yTrain = tf.tensor2d(dataset.yTrain);
  const hasVal = dataset.XVal.length > 0 && dataset.yVal.length > 0;
  const xVal = hasVal ? tf.tensor2d(dataset.XVal) : null;
  const yVal = hasVal ? tf.tensor2d(dataset.yVal) : null;

  const history: EpochMetric[] = [];
  let cancelled = false;
  const t0 = performance.now();

  try {
    await model.fit(xTrain, yTrain, {
      epochs: config.epochs,
      batchSize: Math.max(1, Math.min(config.batchSize, dataset.XTrain.length)),
      shuffle: true,
      validationData: xVal && yVal ? [xVal, yVal] : undefined,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const loss = Number(logs?.loss ?? 0);
          const valLoss = logs?.val_loss !== undefined ? Number(logs.val_loss) : undefined;
          const acc =
            logs?.acc !== undefined
              ? Number(logs.acc)
              : logs?.accuracy !== undefined
              ? Number(logs.accuracy)
              : undefined;
          const valAcc =
            logs?.val_acc !== undefined
              ? Number(logs.val_acc)
              : logs?.val_accuracy !== undefined
              ? Number(logs.val_accuracy)
              : undefined;
          const mae = logs?.mae !== undefined ? Number(logs.mae) : undefined;
          const valMae = logs?.val_mae !== undefined ? Number(logs.val_mae) : undefined;

          const metric: EpochMetric = {
            epoch: epoch + 1,
            loss,
            valLoss,
            accuracy: acc,
            valAccuracy: valAcc,
            mae,
            valMae,
            timestampMs: performance.now() - t0,
          };
          history.push(metric);

          // Update weights snapshot periodically (or every epoch for small/medium nets)
          const snapshot =
            epoch === config.epochs - 1 || (epoch + 1) % Math.max(1, Math.floor(config.epochs / 15)) === 0
              ? extractWeightsFromModel(model, architecture)
              : [];
          callbacks.onEpoch(metric, snapshot);

          if (callbacks.shouldCancel()) {
            cancelled = true;
            model.stopTraining = true;
          }
          await tf.nextFrame();
        },
      },
    });

    const finalWeights = extractWeightsFromModel(model, architecture);
    const evaluation = await evaluateModelOnTest(model, dataset, config.loss);

    return {
      history,
      weightsSnapshot: finalWeights,
      evaluation,
      backendUsed: backendInfo.activeBackend,
      parameterCount,
      cancelled,
      tfModel: model,
    };
  } catch (err) {
    model.dispose();
    throw err;
  } finally {
    xTrain.dispose();
    yTrain.dispose();
    xVal?.dispose();
    yVal?.dispose();
  }
}

export async function evaluateModelOnTest(
  model: tf.LayersModel,
  dataset: PreparedDataset,
  lossName: TrainingConfig['loss']
): Promise<EvaluationResult> {
  const xTest = tf.tensor2d(dataset.XTest);
  const yTest = tf.tensor2d(dataset.yTest);

  try {
    // Ensure model is compiled if loaded fresh
    if (!model.optimizer) {
      model.compile({
        optimizer: 'adam',
        loss: lossName,
      });
    }
    const evalOut = model.evaluate(xTest, yTest);
    const lossTensor = Array.isArray(evalOut) ? evalOut[0] : evalOut;
    const testLoss = Number(lossTensor.dataSync()[0]);
    if (Array.isArray(evalOut)) {
      evalOut.forEach((t) => t.dispose());
    } else {
      evalOut.dispose();
    }

    const predsTensor = model.predict(xTest) as tf.Tensor;
    const predsArr = (await predsTensor.array()) as number[][];
    predsTensor.dispose();

    if (dataset.taskType === 'classification') {
      return computeClassificationEvaluation(dataset.yTest, predsArr, dataset.classNames, testLoss);
    }
    return computeRegressionEvaluation(dataset.yTest, predsArr, testLoss);
  } finally {
    xTest.dispose();
    yTest.dispose();
  }
}

export async function saveTFModelToIndexedDB(model: tf.LayersModel, modelId: string): Promise<string> {
  const key = `indexeddb://neurolab-model-${modelId}`;
  await model.save(key);
  return key;
}

export async function loadTFModelFromIndexedDB(tfStorageKey: string): Promise<tf.LayersModel> {
  return tf.loadLayersModel(tfStorageKey);
}

export async function deleteTFModelFromIndexedDB(tfStorageKey: string): Promise<void> {
  try {
    await tf.io.removeModel(tfStorageKey);
  } catch {
    // Ignore if already removed
  }
}

export async function downloadTFModelFiles(tfStorageKey: string, fileBaseName: string): Promise<void> {
  const model = await tf.loadLayersModel(tfStorageKey);
  try {
    const safeName = fileBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    await model.save(`downloads://${safeName}`);
  } finally {
    model.dispose();
  }
}

/**
 * Computes real forward-pass activations per layer using stored weights & biases.
 * Used by the 3D Designer to animate real signal propagation.
 */
export function computeRealForwardActivations(
  architecture: NeuralArchitecture,
  inputVector: number[]
): number[][] {
  const layers = architecture.layers;
  if (layers.length === 0) return [];
  const snapshots = architecture.weightsSnapshot;

  const activations: number[][] = [];
  // Normalize input vector length to input layer units
  const firstUnits = layers[0].units;
  const inputLayerAct = Array.from({ length: firstUnits }, (_, i) => inputVector[i] ?? 0);
  activations.push(inputLayerAct);

  if (!snapshots || snapshots.length < layers.length) {
    return activations;
  }

  let current = inputLayerAct;
  for (let l = 1; l < layers.length; l++) {
    const layer = layers[l];
    const snap = snapshots[l];
    const out = new Array<number>(layer.units).fill(0);

    for (let j = 0; j < layer.units; j++) {
      let z = snap.biases[j] ?? 0;
      for (let i = 0; i < current.length; i++) {
        const w = snap.weights[i]?.[j] ?? 0;
        z += current[i] * w;
      }
      if (layer.activation === 'relu') out[j] = Math.max(0, z);
      else if (layer.activation === 'sigmoid') out[j] = 1 / (1 + Math.exp(-z));
      else if (layer.activation === 'tanh') out[j] = Math.tanh(z);
      else out[j] = z;
    }

    if (layer.activation === 'softmax' && out.length > 0) {
      const maxVal = Math.max(...out);
      const exps = out.map((v) => Math.exp(v - maxVal));
      const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
      for (let j = 0; j < out.length; j++) out[j] = exps[j] / sumExp;
    }

    activations.push(out);
    current = out;
  }

  return activations;
}
