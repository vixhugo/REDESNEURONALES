import { describe, expect, it } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { parseCSVString } from '../preprocessing/csvParser';
import { runDatasetEDA, suggestDefaultPreprocessing } from '../preprocessing/edaEngine';
import { prepareDataset } from '../preprocessing/dataPreprocessor';
import { createDefaultLayers, validateArchitecture } from '../architectures/architectureValidator';
import { computeRealForwardActivations, trainNeuralNetwork } from '../training/tfEngine';
import { SAMPLE_CSV_DATASETS } from '../../utils/sampleDatasets';
import type { NeuralArchitecture } from '../../types';

describe('NeuroLab Studio End-to-End ML Pipeline', () => {
  it('parses CSV, runs EDA, preprocesses with stratified split, trains real TF.js MLP, and evaluates on Test', async () => {
    await tf.setBackend('cpu');
    await tf.ready();

    const irisSample = SAMPLE_CSV_DATASETS.find((s) => s.id === 'iris')!;
    const parsed = parseCSVString(irisSample.csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.headers).toEqual([
      'sepal_length',
      'sepal_width',
      'petal_length',
      'petal_width',
      'species',
    ]);
    expect(parsed.rows).toHaveLength(150);

    const eda = runDatasetEDA(parsed.headers, parsed.rows);
    expect(eda.rowCount).toBe(150);
    expect(eda.numericColumns).toHaveLength(4);
    expect(eda.categoricalColumns).toEqual(['species']);
    expect(eda.correlationMatrix.columns).toHaveLength(4);

    const prepConfig = suggestDefaultPreprocessing(parsed.headers, eda);
    expect(prepConfig.taskType).toBe('classification');
    expect(prepConfig.targetColumn).toBe('species');

    const prepared = prepareDataset(parsed.headers, parsed.rows, eda, prepConfig);
    expect(prepared.inputDim).toBe(4);
    expect(prepared.outputDim).toBe(3);
    expect(prepared.classNames).toEqual(['Iris-setosa', 'Iris-versicolor', 'Iris-virginica']);
    expect(prepared.XTrain.length + prepared.XVal.length + prepared.XTest.length).toBe(
      prepared.statsSummary.cleanedRows
    );

    const arch: NeuralArchitecture = {
      id: 'arch_test',
      projectId: 'proj_test',
      name: 'Iris Test MLP',
      family: 'mlp',
      layers: createDefaultLayers(prepared.inputDim, prepared.outputDim, false),
      weightsInitialized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validation = validateArchitecture(arch, prepared);
    expect(validation.valid).toBe(true);
    expect(validation.totalParameters).toBeGreaterThan(0);

    const result = await trainNeuralNetwork(
      arch,
      prepared,
      {
        epochs: 12,
        batchSize: 16,
        learningRate: 0.03,
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        seed: 42,
      },
      'cpu',
      {
        onEpoch: () => {},
        shouldCancel: () => false,
      }
    );

    expect(result.history).toHaveLength(12);
    expect(result.weightsSnapshot).toHaveLength(arch.layers.length);
    expect(result.evaluation.taskType).toBe('classification');
    expect(result.evaluation.accuracy).toBeGreaterThan(0.7);
    expect(result.evaluation.confusionMatrix).toHaveLength(3);

    // Verify real forward activations calculation matches layer units
    const trainedArch: NeuralArchitecture = {
      ...arch,
      weightsInitialized: true,
      weightsSnapshot: result.weightsSnapshot,
    };
    const acts = computeRealForwardActivations(trainedArch, prepared.XTest[0]);
    expect(acts).toHaveLength(arch.layers.length);
    expect(acts[acts.length - 1]).toHaveLength(3);
    const probSum = acts[acts.length - 1].reduce((a, b) => a + b, 0);
    expect(probSum).toBeCloseTo(1, 3);

    result.tfModel.dispose();
  });

  it('handles missing values and categorical encoding in medical_risk dataset without mutating original rows', () => {
    const medSample = SAMPLE_CSV_DATASETS.find((s) => s.id === 'medical_risk')!;
    const parsed = parseCSVString(medSample.csv);
    const originalCopy = JSON.stringify(parsed.rows);

    const eda = runDatasetEDA(parsed.headers, parsed.rows);
    expect(eda.duplicateCount).toBeGreaterThan(0);

    const colChol = eda.columns.find((c) => c.name === 'cholesterol');
    expect(colChol?.nullCount).toBe(1);

    const prepConfig = suggestDefaultPreprocessing(parsed.headers, eda);
    const prepared = prepareDataset(parsed.headers, parsed.rows, eda, prepConfig);

    expect(prepared.inputDim).toBeGreaterThan(4);
    expect(prepared.outputDim).toBe(2);
    expect(JSON.stringify(parsed.rows)).toBe(originalCopy);
  });
});
