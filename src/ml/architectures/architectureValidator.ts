import type { LayerConfig, NeuralArchitecture, PreparedDataset } from '../../types';
import { createId } from '../../utils/id';

export interface ArchitectureValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalParameters: number;
  layerSummaries: Array<{
    layerId: string;
    name: string;
    inputDim: number;
    outputDim: number;
    params: number;
  }>;
}

export function validateArchitecture(
  architecture: NeuralArchitecture,
  prepared?: PreparedDataset
): ArchitectureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const layers = architecture.layers;

  if (layers.length < 2) {
    errors.push('La arquitectura necesita al menos una capa de entrada y una capa de salida.');
  } else {
    if (layers[0].type !== 'input') {
      errors.push('La primera capa debe ser de tipo Input.');
    }
    if (layers[layers.length - 1].type !== 'output') {
      errors.push('La última capa debe ser de tipo Output.');
    }
    const hiddenWrong = layers.slice(1, -1).some((l) => l.type !== 'hidden');
    if (hiddenWrong) {
      errors.push('Las capas intermedias deben ser de tipo Hidden.');
    }
  }

  for (const layer of layers) {
    if (!Number.isInteger(layer.units) || layer.units < 1) {
      errors.push(`La capa "${layer.name}" debe tener al menos 1 neurona.`);
    }
    if (layer.units > 512) {
      warnings.push(`La capa "${layer.name}" tiene ${layer.units} neuronas; puede ralentizar el entrenamiento en navegador.`);
    }
  }

  let totalParameters = 0;
  const layerSummaries: ArchitectureValidationResult['layerSummaries'] = [];

  for (let i = 0; i < layers.length; i++) {
    const curr = layers[i];
    if (i === 0) {
      layerSummaries.push({
        layerId: curr.id,
        name: curr.name,
        inputDim: curr.units,
        outputDim: curr.units,
        params: 0,
      });
    } else {
      const prev = layers[i - 1];
      const params = prev.units * curr.units + curr.units;
      totalParameters += params;
      layerSummaries.push({
        layerId: curr.id,
        name: curr.name,
        inputDim: prev.units,
        outputDim: curr.units,
        params,
      });
    }
  }

  if (prepared && layers.length >= 2) {
    const inputLayer = layers[0];
    const outputLayer = layers[layers.length - 1];
    if (inputLayer.units !== prepared.inputDim) {
      errors.push(
        `La capa de entrada tiene ${inputLayer.units} neuronas, pero el dataset preparado tiene ${prepared.inputDim} variables de entrada.`
      );
    }
    if (outputLayer.units !== prepared.outputDim) {
      errors.push(
        `La capa de salida tiene ${outputLayer.units} neuronas, pero el target requiere ${prepared.outputDim} salidas.`
      );
    }
    if (prepared.taskType === 'classification' && prepared.outputDim > 1 && outputLayer.activation !== 'softmax') {
      warnings.push('Para clasificación multiclase se recomienda activación Softmax en la capa de salida.');
    }
    if (prepared.taskType === 'regression' && (outputLayer.activation === 'softmax' || outputLayer.activation === 'sigmoid')) {
      warnings.push('Para regresión se recomienda activación Linear en la capa de salida.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalParameters,
    layerSummaries,
  };
}

export function createDefaultLayers(inputDim = 4, outputDim = 3, isRegression = false): LayerConfig[] {
  return [
    {
      id: createId('layer'),
      name: 'Input Layer',
      type: 'input',
      units: inputDim,
      activation: 'none',
    },
    {
      id: createId('layer'),
      name: 'Hidden Dense 1',
      type: 'hidden',
      units: Math.max(8, Math.min(32, inputDim * 3)),
      activation: 'relu',
    },
    {
      id: createId('layer'),
      name: 'Hidden Dense 2',
      type: 'hidden',
      units: Math.max(6, Math.min(16, inputDim * 2)),
      activation: 'relu',
    },
    {
      id: createId('layer'),
      name: 'Output Layer',
      type: 'output',
      units: outputDim,
      activation: isRegression ? 'linear' : 'softmax',
    },
  ];
}
