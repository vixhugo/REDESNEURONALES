import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
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
import { NeuralSceneContent } from '../components/NeuralSceneContent';

export interface NeuralCanvas3DHandle {
  captureScreenshot: () => string | null;
}

interface NeuralCanvas3DProps {
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

export const NeuralCanvas3D = forwardRef<NeuralCanvas3DHandle, NeuralCanvas3DProps>(
  (props, ref) => {
    const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useImperativeHandle(ref, () => ({
      captureScreenshot: () => {
        if (!glCanvasRef.current) return null;
        try {
          return glCanvasRef.current.toDataURL('image/png');
        } catch {
          return null;
        }
      },
    }));

    const bgColor = props.settings.theme === 'light' ? '#f8fafc' : '#030712';

    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950">
        <Canvas
          camera={{ position: [0, 3.5, Math.max(18, props.layout.spanX * 0.9)], fov: 46, near: 0.1, far: 250 }}
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => {
            glCanvasRef.current = gl.domElement;
          }}
        >
          <color attach="background" args={[bgColor]} />
          <NeuralSceneContent {...props} />
        </Canvas>
      </div>
    );
  }
);

NeuralCanvas3D.displayName = 'NeuralCanvas3D';
