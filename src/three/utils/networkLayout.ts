import type { LayerConfig, NeuralArchitecture } from '../../types';

export interface NeuronNode3D {
  globalIndex: number;
  layerIndex: number;
  neuronIndex: number;
  layerId: string;
  layerType: LayerConfig['type'];
  position: [number, number, number];
}

export interface LayerLayout3D {
  layerIndex: number;
  layer: LayerConfig;
  center: [number, number, number];
  widthZ: number;
  heightY: number;
  neuronStartIndex: number;
  neuronCount: number;
}

export interface ConnectionEdge3D {
  fromGlobalIndex: number;
  toGlobalIndex: number;
  fromLayerIndex: number;
  fromNeuronIndex: number;
  toLayerIndex: number;
  toNeuronIndex: number;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  weight: number | null;
}

export interface NetworkLayout3D {
  layers: LayerLayout3D[];
  neurons: NeuronNode3D[];
  connections: ConnectionEdge3D[];
  totalConnectionsInModel: number;
  boundsCenter: [number, number, number];
  spanX: number;
  spanYZ: number;
}

export function computeNetworkLayout3D(
  architecture: NeuralArchitecture,
  maxRenderedConnections = 1200
): NetworkLayout3D {
  const layerConfigs = architecture.layers;
  const layerCount = layerConfigs.length;
  const layerSpacingX = 6.5;
  const startX = -((layerCount - 1) * layerSpacingX) / 2;

  const layers: LayerLayout3D[] = [];
  const neurons: NeuronNode3D[] = [];
  let maxSpanYZ = 6;

  for (let l = 0; l < layerCount; l++) {
    const cfg = layerConfigs[l];
    const x = startX + l * layerSpacingX;
    const count = Math.max(1, cfg.units);

    // Arrange neurons in a balanced 3D grid (cols along Z, rows along Y)
    const cols = count <= 8 ? 1 : Math.min(8, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);
    const spacingY = count > 24 ? 1.05 : 1.35;
    const spacingZ = 1.35;

    const totalH = (rows - 1) * spacingY;
    const totalW = (cols - 1) * spacingZ;
    maxSpanYZ = Math.max(maxSpanYZ, totalH + 3, totalW + 3);

    const neuronStartIndex = neurons.length;

    for (let n = 0; n < count; n++) {
      const r = Math.floor(n / cols);
      const c = n % cols;
      const y = totalH / 2 - r * spacingY;
      const z = c * spacingZ - totalW / 2;

      neurons.push({
        globalIndex: neurons.length,
        layerIndex: l,
        neuronIndex: n,
        layerId: cfg.id,
        layerType: cfg.type,
        position: [x, y, z],
      });
    }

    layers.push({
      layerIndex: l,
      layer: cfg,
      center: [x, 0, 0],
      widthZ: Math.max(2.2, totalW + 1.8),
      heightY: Math.max(2.6, totalH + 1.8),
      neuronStartIndex,
      neuronCount: count,
    });
  }

  // Build connections (sampled evenly if total exceeds maxRenderedConnections for GPU performance)
  let totalConnectionsInModel = 0;
  for (let l = 0; l < layerCount - 1; l++) {
    totalConnectionsInModel += layers[l].neuronCount * layers[l + 1].neuronCount;
  }

  const connections: ConnectionEdge3D[] = [];
  const stride =
    totalConnectionsInModel > maxRenderedConnections
      ? Math.ceil(totalConnectionsInModel / maxRenderedConnections)
      : 1;

  let counter = 0;
  for (let l = 0; l < layerCount - 1; l++) {
    const srcLayer = layers[l];
    const dstLayer = layers[l + 1];
    const dstWeightsSnap = architecture.weightsSnapshot?.[l + 1];

    for (let i = 0; i < srcLayer.neuronCount; i++) {
      const srcNeuron = neurons[srcLayer.neuronStartIndex + i];
      for (let j = 0; j < dstLayer.neuronCount; j++) {
        if (counter % stride === 0) {
          const dstNeuron = neurons[dstLayer.neuronStartIndex + j];
          const w =
            dstWeightsSnap?.initialized && dstWeightsSnap.weights[i]?.[j] !== undefined
              ? dstWeightsSnap.weights[i][j]
              : null;

          connections.push({
            fromGlobalIndex: srcNeuron.globalIndex,
            toGlobalIndex: dstNeuron.globalIndex,
            fromLayerIndex: l,
            fromNeuronIndex: i,
            toLayerIndex: l + 1,
            toNeuronIndex: j,
            fromPos: srcNeuron.position,
            toPos: dstNeuron.position,
            weight: w,
          });
        }
        counter++;
      }
    }
  }

  return {
    layers,
    neurons,
    connections,
    totalConnectionsInModel,
    boundsCenter: [0, 0, 0],
    spanX: Math.max(8, (layerCount - 1) * layerSpacingX + 6),
    spanYZ: maxSpanYZ,
  };
}

export type CameraPresetType =
  | 'reset'
  | 'front'
  | 'side'
  | 'top'
  | 'center'
  | 'focusLayer'
  | 'focusNeuron';

export interface CameraTargetState {
  position: [number, number, number];
  target: [number, number, number];
  nonce: number;
}
