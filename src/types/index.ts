export type ThemeMode = 'dark' | 'light';

export type LayerType = 'input' | 'hidden' | 'output';
export type ActivationType = 'none' | 'relu' | 'sigmoid' | 'tanh' | 'softmax' | 'linear';
export type ArchitectureFamily = 'mlp' | 'cnn' | 'rnn' | 'lstm' | 'gan';
export type OptimizerType = 'adam' | 'sgd' | 'rmsprop';
export type LossType = 'categoricalCrossentropy' | 'binaryCrossentropy' | 'meanSquaredError' | 'meanAbsoluteError';
export type MissingValueStrategy = 'drop' | 'mean' | 'median' | 'mode' | 'zero';
export type ScalingStrategy = 'none' | 'minmax' | 'standard';
export type EncodingStrategy = 'onehot' | 'label';
export type TaskType = 'classification' | 'regression';

export interface Project {
  id: string;
  name: string;
  description: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  activeDatasetId?: string;
  activeArchitectureId?: string;
  activeTrainingRunId?: string;
}

export interface ColumnHistogramBin {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface CategoryFrequency {
  value: string;
  count: number;
  percentage: number;
}

export interface ColumnStats {
  name: string;
  inferredType: 'numeric' | 'categorical' | 'boolean';
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  histogram?: ColumnHistogramBin[];
  topCategories?: CategoryFrequency[];
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
}

export interface DatasetEDA {
  rowCount: number;
  colCount: number;
  duplicateCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  columns: ColumnStats[];
  correlationMatrix: CorrelationMatrix;
}

export interface PreprocessingConfig {
  droppedColumns: string[];
  featureColumns: string[];
  targetColumn: string;
  taskType: TaskType;
  missingStrategy: MissingValueStrategy;
  removeDuplicates: boolean;
  encoding: EncodingStrategy;
  scaling: ScalingStrategy;
  trainRatio: number;
  valRatio: number;
  testRatio: number;
  stratified: boolean;
  seed: number;
}

export interface PreparedDataset {
  featureNames: string[];
  inputDim: number;
  outputDim: number;
  classNames: string[];
  taskType: TaskType;
  XTrain: number[][];
  yTrain: number[][];
  XVal: number[][];
  yVal: number[][];
  XTest: number[][];
  yTest: number[][];
  transformations: string[];
  statsSummary: {
    originalRows: number;
    cleanedRows: number;
    trainRows: number;
    valRows: number;
    testRows: number;
  };
}

export interface DatasetRecord {
  id: string;
  projectId: string;
  name: string;
  fileName: string;
  fileSizeBytes: number;
  delimiter: string;
  headers: string[];
  rows: Record<string, string>[]; // Original immutable CSV rows
  eda: DatasetEDA;
  preprocessing: PreprocessingConfig;
  prepared?: PreparedDataset;
  createdAt: string;
  updatedAt: string;
}

export interface LayerConfig {
  id: string;
  name: string;
  type: LayerType;
  units: number;
  activation: ActivationType;
}

export interface LayerWeightsSnapshot {
  layerId: string;
  layerName: string;
  layerIndex: number;
  inputUnits: number;
  outputUnits: number;
  /** weights[fromIdx][toIdx] */
  weights: number[][];
  /** biases[toIdx] */
  biases: number[];
  initialized: boolean;
}

export interface NeuralArchitecture {
  id: string;
  projectId: string;
  name: string;
  family: ArchitectureFamily;
  layers: LayerConfig[];
  weightsSnapshot?: LayerWeightsSnapshot[];
  weightsInitialized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: OptimizerType;
  loss: LossType;
  seed: number;
}

export interface EpochMetric {
  epoch: number;
  loss: number;
  valLoss?: number;
  accuracy?: number;
  valAccuracy?: number;
  mae?: number;
  valMae?: number;
  timestampMs: number;
}

export interface ClassMetric {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface SamplePrediction {
  index: number;
  actual: string;
  predicted: string;
  confidence?: number;
  correct?: boolean;
}

export interface EvaluationResult {
  taskType: TaskType;
  testLoss: number;
  sampleCount: number;
  accuracy?: number;
  precisionMacro?: number;
  recallMacro?: number;
  f1Macro?: number;
  confusionMatrix?: number[][];
  classLabels?: string[];
  perClassMetrics?: ClassMetric[];
  mae?: number;
  rmse?: number;
  r2?: number;
  samplePredictions: SamplePrediction[];
}

export interface TrainingRun {
  id: string;
  projectId: string;
  architectureId: string;
  architectureName: string;
  datasetId: string;
  datasetName: string;
  modelId?: string;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'error';
  errorMessage?: string;
  config: TrainingConfig;
  backendUsed: string;
  startedAt: string;
  completedAt?: string;
  elapsedMs: number;
  currentEpoch: number;
  history: EpochMetric[];
  evaluation?: EvaluationResult;
}

export interface RegisteredModel {
  id: string;
  projectId: string;
  projectName: string;
  architectureId: string;
  architectureName: string;
  trainingRunId: string;
  datasetName: string;
  name: string;
  version: number;
  tfStorageKey: string; // e.g., indexeddb://neurolab-model-<id>
  taskType: TaskType;
  inputDim: number;
  outputDim: number;
  featureNames: string[];
  classNames: string[];
  parameterCount: number;
  metricsSummary: {
    testLoss: number;
    accuracy?: number;
    f1Macro?: number;
    rmse?: number;
    r2?: number;
  };
  layers: LayerConfig[];
  weightsSnapshot?: LayerWeightsSnapshot[];
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  projectId: string;
  projectName: string;
  trainingRunId?: string;
  title: string;
  fileName: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId?: string;
  type: 'project' | 'dataset' | 'architecture' | 'training' | 'evaluation' | 'model' | 'report' | 'system';
  title: string;
  detail: string;
  createdAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  show3DGrid: boolean;
  show3DLabels: boolean;
  autoRotate3D: boolean;
  nodeScale: number;
  connectionOpacity: number;
  maxRenderedConnections: number;
  chartSmooth: boolean;
  preferredBackend: 'auto' | 'webgl' | 'cpu';
}

export interface SelectedNeuronInfo {
  layerIndex: number;
  neuronIndex: number;
  layerId: string;
}

export interface SelectedConnectionInfo {
  fromLayerIndex: number;
  fromNeuronIndex: number;
  toLayerIndex: number;
  toNeuronIndex: number;
}
