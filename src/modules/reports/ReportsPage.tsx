import React, { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  exportTrainingResultsCSV,
  generateProjectPDFReport,
} from '../../services/reportService';
import { createId } from '../../utils/id';
import { formatDateTime, formatNumber } from '../../utils/format';
import { NeuralCanvas3D, type NeuralCanvas3DHandle } from '../../three/scenes/NeuralCanvas3D';
import { computeNetworkLayout3D } from '../../three/utils/networkLayout';

export const ReportsPage: React.FC = () => {
  const chartsRef = useRef<HTMLDivElement | null>(null);
  const preview3DRef = useRef<NeuralCanvas3DHandle | null>(null);

  const {
    projects,
    activeProjectId,
    datasets,
    architectures,
    trainingRuns,
    reports,
    settings,
    saveReportRecord,
  } = useAppStore();

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const projectDatasets = useMemo(
    () => datasets.filter((d) => !activeProject || d.projectId === activeProject.id),
    [datasets, activeProject]
  );
  const projectArchs = useMemo(
    () => architectures.filter((a) => !activeProject || a.projectId === activeProject.id),
    [architectures, activeProject]
  );
  const projectRuns = useMemo(
    () => trainingRuns.filter((r) => !activeProject || r.projectId === activeProject.id),
    [trainingRuns, activeProject]
  );

  const [selectedRunId, setSelectedRunId] = useState<string>(projectRuns[0]?.id ?? '');
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const selectedRun = projectRuns.find((r) => r.id === selectedRunId) ?? projectRuns[0];
  const selectedDataset =
    datasets.find((d) => d.id === selectedRun?.datasetId) ?? projectDatasets[0];
  const selectedArch =
    architectures.find((a) => a.id === selectedRun?.architectureId) ?? projectArchs[0];

  const archLayout = useMemo(() => {
    if (!selectedArch) return null;
    return computeNetworkLayout3D(selectedArch, settings.maxRenderedConnections);
  }, [selectedArch, settings.maxRenderedConnections]);

  const handleExportPDF = async () => {
    if (!activeProject) return;
    setGenerating(true);
    setStatusMsg(null);
    try {
      const screenshot3D = preview3DRef.current?.captureScreenshot() ?? null;
      const fileName = await generateProjectPDFReport({
        project: activeProject,
        dataset: selectedDataset,
        architecture: selectedArch,
        trainingRun: selectedRun,
        architectureImageDataUrl: screenshot3D,
        chartsContainerEl: chartsRef.current,
      });
      await saveReportRecord({
        id: createId('rep'),
        projectId: activeProject.id,
        projectName: activeProject.name,
        trainingRunId: selectedRun?.id,
        title: `Informe Técnico — ${selectedArch?.name ?? activeProject.name}`,
        fileName,
        createdAt: new Date().toISOString(),
      });
      setStatusMsg(`Informe descargado: ${fileName}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="nl-surface rounded-2xl border p-10 text-center">
        <FileText className="mx-auto h-10 w-10 text-cyan-400" />
        <h2 className="mt-3 text-lg font-bold">Reportes y Documentación</h2>
        <p className="nl-text-muted mt-1 text-sm">
          Crea primero un proyecto para generar informes PDF y exportar resultados CSV.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Documentación PDF</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Genera informes técnicos completos en PDF directamente desde el navegador y exporta historiales CSV.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedRun && (
            <button
              onClick={() => exportTrainingResultsCSV(selectedRun)}
              className="nl-surface-muted inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:border-cyan-500/50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Exportar Resultados CSV
            </button>
          )}
          <button
            onClick={() => void handleExportPDF()}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {generating ? 'Generando PDF...' : 'Generar Informe PDF'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* Selector */}
      <div className="nl-surface flex flex-wrap items-center gap-4 rounded-xl border p-4 text-xs">
        <div>
          <span className="nl-text-muted mr-2 font-semibold">Proyecto:</span>
          <span className="font-bold text-cyan-400">{activeProject.name}</span>
        </div>
        {projectRuns.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="nl-text-muted font-semibold">Experimento:</span>
            <select
              value={selectedRun?.id ?? ''}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="nl-surface-muted rounded-lg border px-2.5 py-1.5"
            >
              {projectRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.architectureName} ({r.datasetName})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Live Report Preview + Embedded 3D Snapshot & Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="nl-surface space-y-4 rounded-xl border p-5 text-xs lg:col-span-6">
          <h3 className="text-sm font-bold text-cyan-400">Contenido incluido en el Informe PDF</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="nl-surface-muted rounded-lg border p-3">
              <div className="nl-text-muted">Proyecto</div>
              <div className="mt-1 font-semibold">{activeProject.name}</div>
            </div>
            <div className="nl-surface-muted rounded-lg border p-3">
              <div className="nl-text-muted">Dataset</div>
              <div className="mt-1 font-semibold">
                {selectedDataset ? `${selectedDataset.name} (${selectedDataset.eda.rowCount} reg.)` : '—'}
              </div>
            </div>
            <div className="nl-surface-muted rounded-lg border p-3">
              <div className="nl-text-muted">Arquitectura</div>
              <div className="mt-1 font-semibold">
                {selectedArch ? selectedArch.layers.map((l) => l.units).join(' → ') : '—'}
              </div>
            </div>
            <div className="nl-surface-muted rounded-lg border p-3">
              <div className="nl-text-muted">Métrica Test</div>
              <div className="mt-1 font-mono font-bold text-emerald-400">
                {selectedRun?.evaluation?.accuracy !== undefined
                  ? `Acc ${(selectedRun.evaluation.accuracy * 100).toFixed(2)}%`
                  : selectedRun?.evaluation
                  ? `Loss ${formatNumber(selectedRun.evaluation.testLoss)}`
                  : 'Sin evaluación'}
              </div>
            </div>
          </div>

          {selectedArch && archLayout && (
            <div>
              <div className="mb-1.5 font-semibold text-slate-300">
                Representación 3D que se incrustará en el PDF:
              </div>
              <div className="h-56 w-full">
                <NeuralCanvas3D
                  ref={preview3DRef}
                  architecture={selectedArch}
                  layout={archLayout}
                  settings={{ ...settings, show3DLabels: true }}
                  selectedNeuron={null}
                  selectedConnection={null}
                  selectedLayerId={null}
                  liveActivations={null}
                  isPropagating={false}
                  isTraining={false}
                  cameraCommand={null}
                  onSelectNeuron={() => {}}
                  onSelectLayer={() => {}}
                  onSelectConnection={() => {}}
                />
              </div>
            </div>
          )}
        </div>

        {/* Charts container captured by html2canvas */}
        <div className="space-y-4 lg:col-span-6">
          <div ref={chartsRef} className="nl-surface rounded-xl border p-5">
            <h3 className="mb-3 text-sm font-semibold">Gráficos de Entrenamiento (incluidos en PDF)</h3>
            {selectedRun && selectedRun.history.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedRun.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                    <XAxis dataKey="epoch" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="loss" name="Train Loss" stroke="#22d3ee" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="valLoss" name="Val Loss" stroke="#f43f5e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="nl-text-muted flex h-48 items-center justify-center text-xs">
                Ejecuta un entrenamiento para visualizar e incluir curvas en el PDF.
              </div>
            )}
          </div>

          <div className="nl-surface rounded-xl border p-5">
            <h3 className="mb-3 text-sm font-semibold">Historial de Informes Generados</h3>
            {reports.length === 0 ? (
              <p className="nl-text-muted text-xs">Aún no se han generado informes PDF.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reports.map((rep) => (
                  <div key={rep.id} className="nl-surface-muted flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <div>
                      <div className="font-semibold">{rep.title}</div>
                      <div className="nl-text-muted font-mono text-[11px]">{rep.fileName}</div>
                    </div>
                    <span className="nl-text-muted text-[11px]">{formatDateTime(rep.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
