import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type {
  AppSettings,
  NeuralArchitecture,
  SelectedConnectionInfo,
  SelectedNeuronInfo,
} from '../../types';
import {
  type CameraTargetState,
  type NetworkLayout3D,
} from '../utils/networkLayout';

interface NeuralSceneContentProps {
  architecture: NeuralArchitecture;
  layout: NetworkLayout3D;
  settings: AppSettings;
  selectedNeuron: SelectedNeuronInfo | null;
  selectedConnection: SelectedConnectionInfo | null;
  selectedLayerId: string | null;
  liveActivations: number[][] | null;
  isPropagating: boolean;
  isTraining: boolean;
  cameraCommand: CameraTargetState | null;
  onSelectNeuron: (info: SelectedNeuronInfo) => void;
  onSelectLayer: (layerId: string) => void;
  onSelectConnection: (info: SelectedConnectionInfo) => void;
}

const LAYER_COLORS = {
  input: new THREE.Color('#22d3ee'),
  hidden: new THREE.Color('#6366f1'),
  output: new THREE.Color('#10b981'),
  selected: new THREE.Color('#f59e0b'),
  pulse: new THREE.Color('#38bdf8'),
};

export const NeuralSceneContent: React.FC<NeuralSceneContentProps> = ({
  architecture,
  layout,
  settings,
  selectedNeuron,
  selectedConnection,
  selectedLayerId,
  liveActivations,
  isPropagating,
  isTraining,
  cameraCommand,
  onSelectNeuron,
  onSelectLayer,
  onSelectConnection,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const neuronMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const pulseMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const animGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 4, 22),
    target: new THREE.Vector3(0, 0, 0),
    active: false,
  });

  // Reusable geometries & materials (memory-safe)
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.32, 20, 20), []);
  const pulseGeo = useMemo(() => new THREE.SphereGeometry(0.11, 10, 10), []);
  const neuronMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.25,
        metalness: 0.35,
      }),
    []
  );
  const pulseMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  useEffect(() => {
    return () => {
      sphereGeo.dispose();
      pulseGeo.dispose();
      neuronMat.dispose();
      pulseMat.dispose();
    };
  }, [sphereGeo, pulseGeo, neuronMat, pulseMat]);

  // Trigger camera transition when cameraCommand changes
  useEffect(() => {
    if (!cameraCommand) return;
    animGoalRef.current = {
      pos: new THREE.Vector3(...cameraCommand.position),
      target: new THREE.Vector3(...cameraCommand.target),
      active: true,
    };
  }, [cameraCommand]);

  // Update InstancedMesh transforms and per-instance colors for neurons
  useEffect(() => {
    const mesh = neuronMeshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    layout.neurons.forEach((n, idx) => {
      const isSelected =
        selectedNeuron &&
        selectedNeuron.layerIndex === n.layerIndex &&
        selectedNeuron.neuronIndex === n.neuronIndex;
      const isLayerSelected = selectedLayerId === n.layerId;

      const actVal = liveActivations?.[n.layerIndex]?.[n.neuronIndex];
      const actBoost =
        actVal !== undefined ? Math.min(1, Math.max(0, Math.abs(actVal))) : 0;

      const scale =
        settings.nodeScale *
        (isSelected ? 1.42 : isLayerSelected ? 1.15 : 1.0) *
        (1 + actBoost * 0.25);

      dummy.position.set(n.position[0], n.position[1], n.position[2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);

      if (isSelected) {
        color.copy(LAYER_COLORS.selected);
      } else {
        color.copy(LAYER_COLORS[n.layerType]);
        if (actVal !== undefined) {
          color.lerp(new THREE.Color('#ffffff'), actBoost * 0.55);
        }
      }
      mesh.setColorAt(idx, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [layout, selectedNeuron, selectedLayerId, liveActivations, settings.nodeScale]);

  // Build single LineSegments geometry for all connections
  const connectionsGeometry = useMemo(() => {
    const count = layout.connections.length;
    const positions = new Float32Array(count * 6);
    const colors = new Float32Array(count * 6);

    const posWeightColor = new THREE.Color('#22d3ee');
    const negWeightColor = new THREE.Color('#f43f5e');
    const uninitColor = new THREE.Color(settings.theme === 'light' ? '#94a3b8' : '#334155');
    const highlightDim = new THREE.Color(settings.theme === 'light' ? '#cbd5e1' : '#1e293b');
    const tmpColor = new THREE.Color();

    layout.connections.forEach((edge, i) => {
      const base = i * 6;
      positions[base] = edge.fromPos[0];
      positions[base + 1] = edge.fromPos[1];
      positions[base + 2] = edge.fromPos[2];
      positions[base + 3] = edge.toPos[0];
      positions[base + 4] = edge.toPos[1];
      positions[base + 5] = edge.toPos[2];

      const touchesSelectedNeuron =
        selectedNeuron &&
        ((selectedNeuron.layerIndex === edge.fromLayerIndex &&
          selectedNeuron.neuronIndex === edge.fromNeuronIndex) ||
          (selectedNeuron.layerIndex === edge.toLayerIndex &&
            selectedNeuron.neuronIndex === edge.toNeuronIndex));

      if (selectedNeuron && !touchesSelectedNeuron) {
        tmpColor.copy(highlightDim);
      } else if (edge.weight === null) {
        tmpColor.copy(uninitColor);
      } else {
        const mag = Math.min(1, Math.abs(edge.weight) * 1.4);
        tmpColor
          .copy(edge.weight >= 0 ? posWeightColor : negWeightColor)
          .lerp(uninitColor, 1 - Math.max(0.25, mag));
      }

      colors[base] = tmpColor.r;
      colors[base + 1] = tmpColor.g;
      colors[base + 2] = tmpColor.b;
      colors[base + 3] = tmpColor.r;
      colors[base + 4] = tmpColor.g;
      colors[base + 5] = tmpColor.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [layout.connections, selectedNeuron, settings.theme]);

  useEffect(() => {
    return () => {
      connectionsGeometry.dispose();
    };
  }, [connectionsGeometry]);

  // Selected connection highlight endpoints
  const selectedConnectionCoords = useMemo(() => {
    if (!selectedConnection) return null;
    const found = layout.connections.find(
      (c) =>
        c.fromLayerIndex === selectedConnection.fromLayerIndex &&
        c.fromNeuronIndex === selectedConnection.fromNeuronIndex &&
        c.toLayerIndex === selectedConnection.toLayerIndex &&
        c.toNeuronIndex === selectedConnection.toNeuronIndex
    );
    if (found) return [found.fromPos, found.toPos] as [[number, number, number], [number, number, number]];

    const fromNeuron = layout.neurons.find(
      (n) =>
        n.layerIndex === selectedConnection.fromLayerIndex &&
        n.neuronIndex === selectedConnection.fromNeuronIndex
    );
    const toNeuron = layout.neurons.find(
      (n) =>
        n.layerIndex === selectedConnection.toLayerIndex &&
        n.neuronIndex === selectedConnection.toNeuronIndex
    );
    if (!fromNeuron || !toNeuron) return null;
    return [fromNeuron.position, toNeuron.position] as [
      [number, number, number],
      [number, number, number],
    ];
  }, [selectedConnection, layout]);

  // Subset of edges used for animated forward-pass pulses (capped at 160 for smooth 60 FPS)
  const pulseEdges = useMemo(() => {
    if (layout.connections.length === 0) return [];
    const maxPulses = 160;
    const step = Math.max(1, Math.floor(layout.connections.length / maxPulses));
    return layout.connections.filter((_, idx) => idx % step === 0).slice(0, maxPulses);
  }, [layout.connections]);

  const pulseDummy = useMemo(() => new THREE.Object3D(), []);
  const pulseProgressRef = useRef(0);

  // Per-frame camera interpolation + signal propagation animation
  useFrame((_, delta) => {
    if (animGoalRef.current.active && controlsRef.current) {
      const lerpAlpha = Math.min(1, delta * 5.5);
      camera.position.lerp(animGoalRef.current.pos, lerpAlpha);
      controlsRef.current.target.lerp(animGoalRef.current.target, lerpAlpha);
      controlsRef.current.update();

      if (
        camera.position.distanceTo(animGoalRef.current.pos) < 0.05 &&
        controlsRef.current.target.distanceTo(animGoalRef.current.target) < 0.05
      ) {
        animGoalRef.current.active = false;
      }
    }

    const pulseMesh = pulseMeshRef.current;
    if (pulseMesh && (isPropagating || isTraining) && pulseEdges.length > 0) {
      const speed = isTraining ? 1.4 : 0.75;
      pulseProgressRef.current = (pulseProgressRef.current + delta * speed) % Math.max(1, layout.layers.length - 1);
      const layerPhase = pulseProgressRef.current;

      pulseEdges.forEach((edge, idx) => {
        const localT = layerPhase - edge.fromLayerIndex;
        if (localT >= 0 && localT <= 1) {
          const x = THREE.MathUtils.lerp(edge.fromPos[0], edge.toPos[0], localT);
          const y = THREE.MathUtils.lerp(edge.fromPos[1], edge.toPos[1], localT);
          const z = THREE.MathUtils.lerp(edge.fromPos[2], edge.toPos[2], localT);
          pulseDummy.position.set(x, y, z);

          // Scale pulse by real activation or weight magnitude if available
          const srcAct = liveActivations?.[edge.fromLayerIndex]?.[edge.fromNeuronIndex];
          const wMag = edge.weight !== null ? Math.min(1.6, 0.7 + Math.abs(edge.weight)) : 1;
          const s = (srcAct !== undefined ? Math.max(0.4, Math.min(1.8, Math.abs(srcAct))) : 1) * wMag;
          pulseDummy.scale.setScalar(s);
        } else {
          pulseDummy.position.set(0, -9999, 0);
          pulseDummy.scale.setScalar(0.001);
        }
        pulseDummy.updateMatrix();
        pulseMesh.setMatrixAt(idx, pulseDummy.matrix);
      });
      pulseMesh.instanceMatrix.needsUpdate = true;
    }
  });

  const handleNeuronClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const neuron = layout.neurons[e.instanceId];
    if (!neuron) return;
    onSelectNeuron({
      layerIndex: neuron.layerIndex,
      neuronIndex: neuron.neuronIndex,
      layerId: neuron.layerId,
    });
  };

  const handleLineClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.index === undefined) return;
    // LineSegments vertex index -> edge index = Math.floor(e.index / 2)
    const edgeIdx = Math.floor(e.index / 2);
    const edge = layout.connections[edgeIdx];
    if (!edge) return;
    onSelectConnection({
      fromLayerIndex: edge.fromLayerIndex,
      fromNeuronIndex: edge.fromNeuronIndex,
      toLayerIndex: edge.toLayerIndex,
      toNeuronIndex: edge.toNeuronIndex,
    });
  };

  const labelColor = settings.theme === 'light' ? '#0f172a' : '#e2e8f0';
  const subLabelColor = settings.theme === 'light' ? '#475569' : '#94a3b8';

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        autoRotate={settings.autoRotate3D}
        autoRotateSpeed={0.8}
        minDistance={3}
        maxDistance={90}
      />

      <ambientLight intensity={0.7} />
      <directionalLight position={[15, 22, 18]} intensity={1.15} />
      <pointLight position={[-14, 10, -12]} intensity={0.65} color="#38bdf8" />
      <pointLight position={[14, -8, 12]} intensity={0.5} color="#818cf8" />

      {settings.show3DGrid && (
        <gridHelper
          args={[
            Math.max(40, layout.spanX + 14),
            36,
            settings.theme === 'light' ? '#cbd5e1' : '#1e293b',
            settings.theme === 'light' ? '#e2e8f0' : '#0f172a',
          ]}
          position={[0, -layout.spanYZ / 2 - 1.2, 0]}
        />
      )}

      {/* Layer structural bounding frames + clickable labels */}
      {layout.layers.map((layerLayout) => {
        const isSelected = selectedLayerId === layerLayout.layer.id;
        const frameColor =
          layerLayout.layer.type === 'input'
            ? '#22d3ee'
            : layerLayout.layer.type === 'output'
            ? '#10b981'
            : '#6366f1';
        return (
          <group key={layerLayout.layer.id} position={layerLayout.center}>
            {/* Subtle translucent layer plane */}
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectLayer(layerLayout.layer.id);
              }}
              rotation={[0, Math.PI / 2, 0]}
            >
              <planeGeometry args={[layerLayout.widthZ, layerLayout.heightY]} />
              <meshBasicMaterial
                color={frameColor}
                transparent
                opacity={isSelected ? 0.14 : 0.04}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            {settings.show3DLabels && (
              <group position={[0, layerLayout.heightY / 2 + 1.05, 0]}>
                <Text
                  fontSize={0.44}
                  color={isSelected ? '#f59e0b' : labelColor}
                  anchorX="center"
                  anchorY="bottom"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLayer(layerLayout.layer.id);
                  }}
                >
                  {layerLayout.layer.name}
                </Text>
                <Text
                  position={[0, -0.42, 0]}
                  fontSize={0.28}
                  color={subLabelColor}
                  anchorX="center"
                  anchorY="bottom"
                >
                  {`${layerLayout.layer.units}n • ${layerLayout.layer.activation}`}
                </Text>
              </group>
            )}
          </group>
        );
      })}

      {/* All connections as a single GPU LineSegments draw call */}
      {layout.connections.length > 0 && (
        <lineSegments
          geometry={connectionsGeometry}
          onClick={handleLineClick}
        >
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={selectedNeuron ? 0.85 : settings.connectionOpacity}
          />
        </lineSegments>
      )}

      {/* Highlighted selected connection */}
      {selectedConnectionCoords && (
        <Line
          points={selectedConnectionCoords}
          color="#f59e0b"
          lineWidth={3.5}
        />
      )}

      {/* All neurons as a single InstancedMesh draw call */}
      <instancedMesh
        key={`neurons-${layout.neurons.length}`}
        ref={neuronMeshRef}
        args={[sphereGeo, neuronMat, Math.max(1, layout.neurons.length)]}
        onClick={handleNeuronClick}
      />

      {/* Real signal propagation pulses */}
      {(isPropagating || isTraining) && pulseEdges.length > 0 && (
        <instancedMesh
          key={`pulses-${pulseEdges.length}`}
          ref={pulseMeshRef}
          args={[pulseGeo, pulseMat, pulseEdges.length]}
        />
      )}
    </>
  );
};
