import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, Cpu, GitBranch, Layers, Sliders, Zap } from 'lucide-react';

type ActivationDemo = 'relu' | 'sigmoid' | 'tanh' | 'softmax';

const CONCEPTS = [
  {
    title: 'Inteligencia Artificial, Machine Learning y Deep Learning',
    icon: Cpu,
    body: 'La Inteligencia Artificial (IA) engloba sistemas capaces de realizar tareas cognitivas. El Machine Learning (ML) es la rama donde los algoritmos aprenden patrones directamente desde datos. El Deep Learning (DL) utiliza redes neuronales artificiales profundas con múltiples capas ocultas para aprender representaciones jerárquicas complejas.',
  },
  {
    title: 'Neurona Artificial, Pesos (w) y Sesgo (b)',
    icon: Zap,
    body: 'Una neurona recibe entradas numéricas (x₁, x₂, ...), las multiplica por pesos sinápticos (w₁, w₂, ...) que miden la importancia de cada señal, suma un sesgo (bias, b) para desplazar el umbral de activación y aplica una función de activación no lineal: y = f(∑ wᵢ·xᵢ + b).',
  },
  {
    title: 'Capas de Entrada, Ocultas y de Salida',
    icon: Layers,
    body: 'La Capa de Entrada (Input) recibe las variables del dataset. Las Capas Ocultas (Hidden) transforman y combinan características intermedias. La Capa de Salida (Output) produce la predicción final: probabilidades por clase (clasificación) o un valor continuo (regresión).',
  },
  {
    title: 'Propagación hacia Adelante y Retropropagación',
    icon: GitBranch,
    body: 'En Forward Propagation, los datos fluyen desde la entrada hasta la salida generando una predicción. Luego se calcula el error (Loss). Mediante Backpropagation (regla de la cadena), se calculan los gradientes del error respecto a cada peso y sesgo, y el optimizador (Adam, SGD, RMSprop) actualiza los parámetros para reducir el error.',
  },
];

export const FundamentalsPage: React.FC = () => {
  // Interactive single-neuron lab
  const [x1, setX1] = useState(1.2);
  const [x2, setX2] = useState(-0.6);
  const [w1, setW1] = useState(0.8);
  const [w2, setW2] = useState(-1.1);
  const [bias, setBias] = useState(0.25);
  const [activation, setActivation] = useState<ActivationDemo>('relu');
  const [softmaxLogit3, setSoftmaxLogit3] = useState(0.5);

  const z = x1 * w1 + x2 * w2 + bias;

  const neuronOutput = useMemo(() => {
    if (activation === 'relu') return Math.max(0, z);
    if (activation === 'sigmoid') return 1 / (1 + Math.exp(-z));
    if (activation === 'tanh') return Math.tanh(z);
    // Softmax demo across 3 logits: [z, -z*0.5, softmaxLogit3]
    const logits = [z, -z * 0.4, softmaxLogit3];
    const maxL = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - maxL));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps[0] / sum;
  }, [z, activation, softmaxLogit3]);

  const softmaxProbs = useMemo(() => {
    const logits = [z, -z * 0.4, softmaxLogit3];
    const maxL = Math.max(...logits);
    const exps = logits.map((v) => Math.exp(v - maxL));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  }, [z, softmaxLogit3]);

  const activationCurveData = useMemo(() => {
    const pts = [];
    for (let v = -5; v <= 5; v += 0.25) {
      let y = 0;
      if (activation === 'relu') y = Math.max(0, v);
      else if (activation === 'sigmoid') y = 1 / (1 + Math.exp(-v));
      else if (activation === 'tanh') y = Math.tanh(v);
      else y = 1 / (1 + Math.exp(-v)); // Reference logistic curve when viewing softmax
      pts.push({ x: Number(v.toFixed(2)), y: Number(y.toFixed(4)) });
    }
    return pts;
  }, [activation]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fundamentos Neurorales</h1>
        <p className="nl-text-muted mt-1 text-sm">
          Laboratorio interactivo para comprender cómo procesa información una neurona artificial y sus funciones de activación.
        </p>
      </div>

      {/* Theory Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CONCEPTS.map(({ title, icon: Icon, body }) => (
          <div key={title} className="nl-surface rounded-xl border p-5">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <Icon className="h-5 w-5" />
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            </div>
            <p className="nl-text-muted mt-2.5 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* Interactive Neuron Simulator */}
      <div className="nl-surface rounded-xl border p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold">Simulador Interactivo de Neurona Artificial</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['relu', 'sigmoid', 'tanh', 'softmax'] as ActivationDemo[]).map((act) => (
              <button
                key={act}
                onClick={() => setActivation(act)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition ${
                  activation === act
                    ? 'bg-cyan-500 text-slate-950'
                    : 'nl-surface-muted border hover:border-cyan-500/40'
                }`}
              >
                {act}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Controls */}
          <div className="space-y-4 lg:col-span-5">
            <div className="nl-surface-muted rounded-xl border p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Entradas y Pesos Sinápticos
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span>Entrada x₁</span>
                  <span className="font-mono">{x1.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={x1}
                  onChange={(e) => setX1(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span>Peso w₁</span>
                  <span className="font-mono">{w1.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={w1}
                  onChange={(e) => setW1(Number(e.target.value))}
                  className="w-full accent-indigo-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span>Entrada x₂</span>
                  <span className="font-mono">{x2.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={x2}
                  onChange={(e) => setX2(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span>Peso w₂</span>
                  <span className="font-mono">{w2.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.1}
                  value={w2}
                  onChange={(e) => setW2(Number(e.target.value))}
                  className="w-full accent-indigo-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span>Sesgo (Bias b)</span>
                  <span className="font-mono">{bias.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={-3}
                  max={3}
                  step={0.05}
                  value={bias}
                  onChange={(e) => setBias(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              {activation === 'softmax' && (
                <div>
                  <div className="flex justify-between text-xs">
                    <span>Logit competidor (Clase 3)</span>
                    <span className="font-mono">{softmaxLogit3.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    step={0.1}
                    value={softmaxLogit3}
                    onChange={(e) => setSoftmaxLogit3(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              )}
            </div>

            {/* Real-time mathematical readout */}
            <div className="nl-surface-muted rounded-xl border p-4 font-mono text-xs space-y-2">
              <div className="text-slate-400">Cálculo en tiempo real:</div>
              <div>
                z = ({x1.toFixed(2)}×{w1.toFixed(2)}) + ({x2.toFixed(2)}×{w2.toFixed(2)}) + ({bias.toFixed(2)}) ={' '}
                <span className="font-bold text-cyan-400">{z.toFixed(4)}</span>
              </div>
              <div className="text-sm">
                Salida {activation.toUpperCase()}(z) ={' '}
                <span className="font-bold text-emerald-400">{neuronOutput.toFixed(4)}</span>
              </div>
            </div>
          </div>

          {/* Visual SVG Diagram + Activation Curve */}
          <div className="space-y-4 lg:col-span-7">
            <div className="nl-surface-muted rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Flujo de Señal Neuronal
                </span>
                <span className="nl-text-muted">Suma ponderada → Activación</span>
              </div>
              <svg viewBox="0 0 540 180" className="h-44 w-full">
                {/* Connections */}
                <line
                  x1="90"
                  y1="45"
                  x2="265"
                  y2="90"
                  stroke={w1 >= 0 ? '#22d3ee' : '#f43f5e'}
                  strokeWidth={Math.min(6, Math.max(1.5, Math.abs(w1) * 2.2))}
                  strokeOpacity={0.8}
                />
                <line
                  x1="90"
                  y1="135"
                  x2="265"
                  y2="90"
                  stroke={w2 >= 0 ? '#22d3ee' : '#f43f5e'}
                  strokeWidth={Math.min(6, Math.max(1.5, Math.abs(w2) * 2.2))}
                  strokeOpacity={0.8}
                />
                <line
                  x1="295"
                  y1="90"
                  x2="450"
                  y2="90"
                  stroke="#10b981"
                  strokeWidth={3.5}
                />

                {/* Input nodes */}
                <circle cx="70" cy="45" r="24" fill="#0e7490" stroke="#22d3ee" strokeWidth="2" />
                <text x="70" y="49" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="monospace">
                  x₁={x1.toFixed(1)}
                </text>

                <circle cx="70" cy="135" r="24" fill="#0e7490" stroke="#22d3ee" strokeWidth="2" />
                <text x="70" y="139" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="monospace">
                  x₂={x2.toFixed(1)}
                </text>

                {/* Weight labels */}
                <text x="165" y="55" fill="#94a3b8" fontSize="11" fontFamily="monospace">
                  w₁={w1.toFixed(1)}
                </text>
                <text x="165" y="132" fill="#94a3b8" fontSize="11" fontFamily="monospace">
                  w₂={w2.toFixed(1)}
                </text>

                {/* Neuron summation + activation */}
                <circle cx="280" cy="90" r="34" fill="#312e81" stroke="#818cf8" strokeWidth="2.5" />
                <text x="280" y="85" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontFamily="monospace">
                  z={z.toFixed(2)}
                </text>
                <text x="280" y="102" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
                  {activation.toUpperCase()}
                </text>

                {/* Output node */}
                <circle cx="470" cy="90" r="26" fill="#065f46" stroke="#10b981" strokeWidth="2.5" />
                <text x="470" y="94" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="monospace">
                  {neuronOutput.toFixed(2)}
                </text>
              </svg>
            </div>

            {activation === 'softmax' ? (
              <div className="nl-surface-muted rounded-xl border p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <BookOpen className="h-4 w-4 text-emerald-400" />
                  Distribución Softmax (la suma de probabilidades siempre es 100%)
                </div>
                {softmaxProbs.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>{idx === 0 ? 'Clase 1 (tu neurona z)' : `Clase ${idx + 1}`}</span>
                      <span>{(p * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${p * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nl-surface-muted rounded-xl border p-4">
                <div className="mb-2 text-xs font-semibold">
                  Curva de Activación: {activation.toUpperCase()}(z)
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activationCurveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                      <XAxis dataKey="x" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
