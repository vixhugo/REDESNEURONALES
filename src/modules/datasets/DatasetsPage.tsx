import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Filter,
  FlaskConical,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { parseCSVFile, parseCSVString } from '../../ml/preprocessing/csvParser';
import { runDatasetEDA, suggestDefaultPreprocessing } from '../../ml/preprocessing/edaEngine';
import { prepareDataset } from '../../ml/preprocessing/dataPreprocessor';
import { SAMPLE_CSV_DATASETS } from '../../utils/sampleDatasets';
import { createId } from '../../utils/id';
import { formatBytes, formatNumber } from '../../utils/format';
import type { DatasetRecord, PreprocessingConfig } from '../../types';

type DatasetTab = 'preview' | 'eda' | 'charts' | 'prepare';
const PIE_COLORS = ['#22d3ee', '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#38bdf8'];

export const DatasetsPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    projects,
    activeProjectId,
    datasets,
    createProject,
    saveDataset,
    deleteDataset,
  } = useAppStore();

  const projectDatasets = useMemo(
    () => datasets.filter((d) => !activeProjectId || d.projectId === activeProjectId),
    [datasets, activeProjectId]
  );

  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    projectDatasets[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<DatasetTab>('eda');
  const [dragOver, setDragOver] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [prepMessage, setPrepMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activeDataset =
    datasets.find((d) => d.id === selectedDatasetId) ?? projectDatasets[0] ?? null;

  // Visualization column selectors
  const [selectedColForChart, setSelectedColForChart] = useState<string>('');
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
  const [catChartType, setCatChartType] = useState<'bar' | 'pie'>('bar');

  const ensureProject = async (): Promise<string> => {
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
      return activeProjectId;
    }
    const created = await createProject({
      name: 'Proyecto Exploratorio',
      description: 'Proyecto creado automáticamente al importar un dataset CSV.',
      goal: 'Análisis y modelado neuronal',
    });
    return created.id;
  };

  const ingestParsedCSV = async (
    fileName: string,
    fileSizeBytes: number,
    headers: string[],
    rows: Record<string, string>[],
    delimiter: string,
    errors: string[]
  ) => {
    if (errors.length > 0 && (headers.length === 0 || rows.length === 0)) {
      setImportErrors(errors);
      return;
    }
    setImportErrors(errors);

    const projectId = await ensureProject();
    const eda = runDatasetEDA(headers, rows);
    const preprocessing = suggestDefaultPreprocessing(headers, eda);

    // Auto-run initial preparation with default config so user gets immediate feedback
    let prepared;
    try {
      prepared = prepareDataset(headers, rows, eda, preprocessing);
    } catch {
      prepared = undefined;
    }

    const now = new Date().toISOString();
    const record: DatasetRecord = {
      id: createId('ds'),
      projectId,
      name: fileName.replace(/\.csv$/i, ''),
      fileName,
      fileSizeBytes,
      delimiter,
      headers,
      rows,
      eda,
      preprocessing,
      prepared,
      createdAt: now,
      updatedAt: now,
    };

    await saveDataset(record);
    setSelectedDatasetId(record.id);
    setActiveTab('eda');
    setPrepMessage(null);
  };

  const handleFileUpload = async (file: File) => {
    const parsed = await parseCSVFile(file);
    await ingestParsedCSV(
      file.name,
      file.size,
      parsed.headers,
      parsed.rows,
      parsed.delimiter,
      parsed.errors
    );
  };

  const handleLoadSample = async (sampleId: string) => {
    const sample = SAMPLE_CSV_DATASETS.find((s) => s.id === sampleId);
    if (!sample) return;
    const parsed = parseCSVString(sample.csv);
    await ingestParsedCSV(
      `${sample.id}.csv`,
      new Blob([sample.csv]).size,
      parsed.headers,
      parsed.rows,
      parsed.delimiter,
      parsed.errors
    );
  };

  const updatePrepConfig = async (patch: Partial<PreprocessingConfig>) => {
    if (!activeDataset) return;
    const nextPrep = { ...activeDataset.preprocessing, ...patch };
    await saveDataset({
      ...activeDataset,
      preprocessing: nextPrep,
      updatedAt: new Date().toISOString(),
    });
  };

  const runPreparation = async () => {
    if (!activeDataset) return;
    setPrepMessage(null);
    try {
      const prepared = prepareDataset(
        activeDataset.headers,
        activeDataset.rows,
        activeDataset.eda,
        activeDataset.preprocessing
      );
      await saveDataset({
        ...activeDataset,
        prepared,
        updatedAt: new Date().toISOString(),
      });
      setPrepMessage({
        type: 'ok',
        text: `Dataset preparado correctamente: ${prepared.statsSummary.trainRows} Train / ${prepared.statsSummary.valRows} Val / ${prepared.statsSummary.testRows} Test (${prepared.inputDim} features → ${prepared.outputDim} salidas).`,
      });
    } catch (err) {
      setPrepMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Error al preparar el dataset.',
      });
    }
  };

  // Chart data derivations
  const activeColStats = useMemo(() => {
    if (!activeDataset) return null;
    const colName = selectedColForChart || activeDataset.headers[0];
    return activeDataset.eda.columns.find((c) => c.name === colName) ?? activeDataset.eda.columns[0];
  }, [activeDataset, selectedColForChart]);

  const scatterData = useMemo(() => {
    if (!activeDataset) return [];
    const numCols = activeDataset.eda.numericColumns;
    if (numCols.length < 2) return [];
    const colX = scatterX && numCols.includes(scatterX) ? scatterX : numCols[0];
    const colY = scatterY && numCols.includes(scatterY) ? scatterY : numCols[1];
    return activeDataset.rows
      .slice(0, 400)
      .map((r) => ({ x: Number(r[colX]), y: Number(r[colY]) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }, [activeDataset, scatterX, scatterY]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión y Análisis de Datasets</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Importa archivos CSV locales, ejecuta análisis exploratorio (EDA) automático y prepara tus datos sin modificar el original.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_CSV_DATASETS.map((s) => (
            <button
              key={s.id}
              onClick={() => void handleLoadSample(s.id)}
              className="nl-surface-muted inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:border-cyan-500/50"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Cargar {s.id.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Drag & Drop CSV Importer */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFileUpload(f);
        }}
        className={`nl-surface flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700/80 hover:border-cyan-500/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileUpload(f);
            e.target.value = '';
          }}
        />
        <UploadCloud className="h-9 w-9 text-cyan-400" />
        <p className="mt-2 text-sm font-semibold">
          Arrastra y suelta un archivo CSV aquí o{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-cyan-400 underline hover:text-cyan-300"
          >
            explora tu ordenador
          </button>
        </p>
        <p className="nl-text-muted mt-1 text-xs">
          Detección automática de delimitadores, encabezados, tipos numéricos/categóricos y persistencia en IndexedDB.
        </p>
      </div>

      {importErrors.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Advertencias de importación CSV:
          </div>
          <ul className="mt-1 list-disc pl-5">
            {importErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dataset Selector Bar */}
      {projectDatasets.length > 0 && activeDataset && (
        <>
          <div className="nl-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Database className="h-4 w-4 text-cyan-400" />
              <select
                value={activeDataset.id}
                onChange={(e) => {
                  setSelectedDatasetId(e.target.value);
                  setSelectedColForChart('');
                  setPrepMessage(null);
                }}
                className="nl-surface-muted rounded-lg border px-3 py-1.5 text-sm font-medium focus:border-cyan-500 focus:outline-hidden"
              >
                {projectDatasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.eda.rowCount}×{d.eda.colCount})
                  </option>
                ))}
              </select>
              <span className="nl-text-muted font-mono text-xs">
                Delimitador: "{activeDataset.delimiter}" • {formatBytes(activeDataset.fileSizeBytes)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(['eda', 'charts', 'prepare', 'preview'] as DatasetTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === t
                      ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
                      : 'nl-surface-muted border hover:border-slate-600'
                  }`}
                >
                  {t === 'eda' && 'Análisis EDA'}
                  {t === 'charts' && 'Gráficos y Correlación'}
                  {t === 'prepare' && 'Preparación y Split'}
                  {t === 'preview' && 'Vista Previa CSV'}
                </button>
              ))}
              <button
                onClick={() => {
                  if (window.confirm(`¿Eliminar dataset "${activeDataset.name}"?`)) {
                    void deleteDataset(activeDataset.id);
                  }
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                title="Eliminar dataset"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TAB 1: EDA */}
          {activeTab === 'eda' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="nl-surface rounded-xl border p-3.5">
                  <div className="nl-text-muted text-xs">Filas</div>
                  <div className="mt-1 text-xl font-bold">{activeDataset.eda.rowCount}</div>
                </div>
                <div className="nl-surface rounded-xl border p-3.5">
                  <div className="nl-text-muted text-xs">Columnas</div>
                  <div className="mt-1 text-xl font-bold">{activeDataset.eda.colCount}</div>
                </div>
                <div className="nl-surface rounded-xl border p-3.5">
                  <div className="nl-text-muted text-xs">Numéricas</div>
                  <div className="mt-1 text-xl font-bold text-cyan-400">
                    {activeDataset.eda.numericColumns.length}
                  </div>
                </div>
                <div className="nl-surface rounded-xl border p-3.5">
                  <div className="nl-text-muted text-xs">Categóricas</div>
                  <div className="mt-1 text-xl font-bold text-indigo-400">
                    {activeDataset.eda.categoricalColumns.length}
                  </div>
                </div>
                <div className="nl-surface rounded-xl border p-3.5">
                  <div className="nl-text-muted text-xs">Filas Duplicadas</div>
                  <div className="mt-1 text-xl font-bold text-amber-400">
                    {activeDataset.eda.duplicateCount}
                  </div>
                </div>
              </div>

              <div className="nl-surface overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="nl-surface-muted border-b border-slate-800/70 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Columna</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Nulos</th>
                      <th className="px-4 py-3">Únicos</th>
                      <th className="px-4 py-3">Mín</th>
                      <th className="px-4 py-3">Máx</th>
                      <th className="px-4 py-3">Media</th>
                      <th className="px-4 py-3">Mediana</th>
                      <th className="px-4 py-3">Desv. Est.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeDataset.eda.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-800/20">
                        <td className="px-4 py-2.5 font-semibold">{col.name}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              col.inferredType === 'numeric'
                                ? 'bg-cyan-500/15 text-cyan-400'
                                : 'bg-indigo-500/15 text-indigo-400'
                            }`}
                          >
                            {col.inferredType}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          <span className={col.nullCount > 0 ? 'text-amber-400 font-bold' : ''}>
                            {col.nullCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono">{col.uniqueCount}</td>
                        <td className="px-4 py-2.5 font-mono">{formatNumber(col.min, 3)}</td>
                        <td className="px-4 py-2.5 font-mono">{formatNumber(col.max, 3)}</td>
                        <td className="px-4 py-2.5 font-mono">{formatNumber(col.mean, 3)}</td>
                        <td className="px-4 py-2.5 font-mono">{formatNumber(col.median, 3)}</td>
                        <td className="px-4 py-2.5 font-mono">{formatNumber(col.std, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CHARTS */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Distribution Chart */}
                <div className="nl-surface rounded-xl border p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Distribución de Variable</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeColStats?.name ?? ''}
                        onChange={(e) => setSelectedColForChart(e.target.value)}
                        className="nl-surface-muted rounded-lg border px-2.5 py-1 text-xs"
                      >
                        {activeDataset.eda.columns.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} ({c.inferredType})
                          </option>
                        ))}
                      </select>
                      {activeColStats?.inferredType !== 'numeric' && (
                        <select
                          value={catChartType}
                          onChange={(e) => setCatChartType(e.target.value as 'bar' | 'pie')}
                          className="nl-surface-muted rounded-lg border px-2 py-1 text-xs"
                        >
                          <option value="bar">Barras</option>
                          <option value="pie">Circular</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    {activeColStats?.inferredType === 'numeric' && activeColStats.histogram ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeColStats.histogram}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" name="Frecuencia" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : catChartType === 'pie' ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={activeColStats?.topCategories ?? []}
                            dataKey="count"
                            nameKey="value"
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            label
                          >
                            {(activeColStats?.topCategories ?? []).map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeColStats?.topCategories ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                          <XAxis dataKey="value" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" name="Registros" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Scatter Plot */}
                <div className="nl-surface rounded-xl border p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Diagrama de Dispersión</h3>
                    {activeDataset.eda.numericColumns.length >= 2 && (
                      <div className="flex items-center gap-2 text-xs">
                        <select
                          value={scatterX || activeDataset.eda.numericColumns[0]}
                          onChange={(e) => setScatterX(e.target.value)}
                          className="nl-surface-muted rounded-lg border px-2 py-1"
                        >
                          {activeDataset.eda.numericColumns.map((c) => (
                            <option key={c} value={c}>X: {c}</option>
                          ))}
                        </select>
                        <select
                          value={scatterY || activeDataset.eda.numericColumns[1]}
                          onChange={(e) => setScatterY(e.target.value)}
                          className="nl-surface-muted rounded-lg border px-2 py-1"
                        >
                          {activeDataset.eda.numericColumns.map((c) => (
                            <option key={c} value={c}>Y: {c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="h-64 w-full">
                    {scatterData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                          <XAxis type="number" dataKey="x" name="X" stroke="#94a3b8" fontSize={11} />
                          <YAxis type="number" dataKey="y" name="Y" stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                          />
                          <Scatter data={scatterData} fill="#10b981" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="nl-text-muted flex h-full items-center justify-center text-xs">
                        Se necesitan al menos 2 variables numéricas para graficar dispersión.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Correlation Matrix */}
              {activeDataset.eda.correlationMatrix.columns.length >= 2 && (
                <div className="nl-surface rounded-xl border p-5 overflow-x-auto">
                  <h3 className="mb-3 text-sm font-semibold">Matriz de Correlación de Pearson</h3>
                  <table className="text-xs font-mono">
                    <thead>
                      <tr>
                        <th className="p-2 text-left"></th>
                        {activeDataset.eda.correlationMatrix.columns.map((c) => (
                          <th key={c} className="p-2 text-center text-slate-400">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDataset.eda.correlationMatrix.columns.map((rowCol, rIdx) => (
                        <tr key={rowCol}>
                          <td className="p-2 font-semibold text-slate-300">{rowCol}</td>
                          {activeDataset.eda.correlationMatrix.matrix[rIdx].map((val, cIdx) => {
                            const alpha = Math.min(0.85, Math.abs(val) * 0.85);
                            const bg =
                              val >= 0
                                ? `rgba(34, 211, 238, ${alpha})`
                                : `rgba(244, 63, 94, ${alpha})`;
                            return (
                              <td
                                key={cIdx}
                                style={{ backgroundColor: bg }}
                                className="min-w-16 border border-slate-900/50 p-2 text-center text-white"
                              >
                                {val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREPARATION & SPLIT */}
          {activeTab === 'prepare' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="nl-surface rounded-xl border p-5 space-y-5 lg:col-span-7">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                  <h3 className="text-base font-semibold">Configuración de Preprocesamiento</h3>
                </div>

                {/* Target & Task */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      Variable Objetivo (Target)
                    </label>
                    <select
                      value={activeDataset.preprocessing.targetColumn}
                      onChange={(e) => {
                        const target = e.target.value;
                        const feat = activeDataset.headers.filter(
                          (h) => h !== target && !activeDataset.preprocessing.droppedColumns.includes(h)
                        );
                        void updatePrepConfig({ targetColumn: target, featureColumns: feat });
                      }}
                      className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      {activeDataset.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      Tipo de Problema
                    </label>
                    <select
                      value={activeDataset.preprocessing.taskType}
                      onChange={(e) =>
                        void updatePrepConfig({
                          taskType: e.target.value as 'classification' | 'regression',
                        })
                      }
                      className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="classification">Clasificación</option>
                      <option value="regression">Regresión</option>
                    </select>
                  </div>
                </div>

                {/* Feature Selection / Drop columns */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Filter className="h-3.5 w-3.5" /> Variables de Entrada (Marca para incluir)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {activeDataset.headers
                      .filter((h) => h !== activeDataset.preprocessing.targetColumn)
                      .map((col) => {
                        const included =
                          activeDataset.preprocessing.featureColumns.includes(col) &&
                          !activeDataset.preprocessing.droppedColumns.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => {
                              const currFeatures = activeDataset.preprocessing.featureColumns;
                              const nextFeatures = included
                                ? currFeatures.filter((c) => c !== col)
                                : [...currFeatures, col];
                              const nextDropped = included
                                ? [...activeDataset.preprocessing.droppedColumns, col]
                                : activeDataset.preprocessing.droppedColumns.filter((c) => c !== col);
                              void updatePrepConfig({
                                featureColumns: nextFeatures,
                                droppedColumns: nextDropped,
                              });
                            }}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                              included
                                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                                : 'nl-surface-muted text-slate-500 line-through'
                            }`}
                          >
                            {col}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Cleaning, Encoding, Scaling */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      Valores Faltantes
                    </label>
                    <select
                      value={activeDataset.preprocessing.missingStrategy}
                      onChange={(e) =>
                        void updatePrepConfig({
                          missingStrategy: e.target.value as PreprocessingConfig['missingStrategy'],
                        })
                      }
                      className="nl-surface-muted w-full rounded-lg border px-2.5 py-2 text-xs"
                    >
                      <option value="mean">Imputar Media</option>
                      <option value="median">Imputar Mediana</option>
                      <option value="mode">Imputar Moda</option>
                      <option value="zero">Rellenar con 0</option>
                      <option value="drop">Eliminar filas con nulos</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      Codificación Categórica
                    </label>
                    <select
                      value={activeDataset.preprocessing.encoding}
                      onChange={(e) =>
                        void updatePrepConfig({
                          encoding: e.target.value as PreprocessingConfig['encoding'],
                        })
                      }
                      className="nl-surface-muted w-full rounded-lg border px-2.5 py-2 text-xs"
                    >
                      <option value="onehot">One-Hot Encoding</option>
                      <option value="label">Label Encoding</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">
                      Escalado Numérico
                    </label>
                    <select
                      value={activeDataset.preprocessing.scaling}
                      onChange={(e) =>
                        void updatePrepConfig({
                          scaling: e.target.value as PreprocessingConfig['scaling'],
                        })
                      }
                      className="nl-surface-muted w-full rounded-lg border px-2.5 py-2 text-xs"
                    >
                      <option value="standard">Estandarización (Z-Score)</option>
                      <option value="minmax">Normalización Min-Max [0,1]</option>
                      <option value="none">Sin escalado</option>
                    </select>
                  </div>
                </div>

                {/* Split ratios & options */}
                <div className="nl-surface-muted rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold">División Train / Validation / Test</span>
                    <span className="font-mono text-xs text-cyan-400">
                      {Math.round(activeDataset.preprocessing.trainRatio * 100)}% /{' '}
                      {Math.round(activeDataset.preprocessing.valRatio * 100)}% /{' '}
                      {Math.round(activeDataset.preprocessing.testRatio * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="nl-text-muted block mb-1">Train (%)</label>
                      <input
                        type="number"
                        min={40}
                        max={85}
                        value={Math.round(activeDataset.preprocessing.trainRatio * 100)}
                        onChange={(e) => {
                          const tr = Math.max(40, Math.min(85, Number(e.target.value))) / 100;
                          const rem = 1 - tr;
                          void updatePrepConfig({
                            trainRatio: tr,
                            valRatio: Number((rem / 2).toFixed(2)),
                            testRatio: Number((rem / 2).toFixed(2)),
                          });
                        }}
                        className="nl-surface w-full rounded border px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="nl-text-muted block mb-1">Validation (%)</label>
                      <input
                        type="number"
                        min={5}
                        max={40}
                        value={Math.round(activeDataset.preprocessing.valRatio * 100)}
                        onChange={(e) => {
                          const val = Math.max(5, Math.min(40, Number(e.target.value))) / 100;
                          const test = Math.max(0.05, 1 - activeDataset.preprocessing.trainRatio - val);
                          void updatePrepConfig({ valRatio: val, testRatio: Number(test.toFixed(2)) });
                        }}
                        className="nl-surface w-full rounded border px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="nl-text-muted block mb-1">Semilla (Seed)</label>
                      <input
                        type="number"
                        value={activeDataset.preprocessing.seed}
                        onChange={(e) => void updatePrepConfig({ seed: Number(e.target.value) || 42 })}
                        className="nl-surface w-full rounded border px-2 py-1 font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={activeDataset.preprocessing.removeDuplicates}
                        onChange={(e) => void updatePrepConfig({ removeDuplicates: e.target.checked })}
                        className="accent-cyan-500"
                      />
                      Eliminar duplicados
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={activeDataset.preprocessing.stratified}
                        onChange={(e) => void updatePrepConfig({ stratified: e.target.checked })}
                        className="accent-cyan-500"
                      />
                      División estratificada (clasificación)
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => void runPreparation()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  <FlaskConical className="h-4 w-4" />
                  Aplicar Transformaciones y Preparar Particiones
                </button>

                {prepMessage && (
                  <div
                    className={`rounded-lg border px-3 py-2.5 text-xs ${
                      prepMessage.type === 'ok'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    {prepMessage.text}
                  </div>
                )}
              </div>

              {/* Transformation Summary */}
              <div className="nl-surface rounded-xl border p-5 space-y-4 lg:col-span-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-base font-semibold">Resumen de Transformaciones</h3>
                </div>
                {activeDataset.prepared ? (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="font-bold text-cyan-400">
                          {activeDataset.prepared.statsSummary.trainRows}
                        </div>
                        <div className="nl-text-muted text-[10px]">Train</div>
                      </div>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="font-bold text-indigo-400">
                          {activeDataset.prepared.statsSummary.valRows}
                        </div>
                        <div className="nl-text-muted text-[10px]">Validation</div>
                      </div>
                      <div className="nl-surface-muted rounded-lg border p-2.5">
                        <div className="font-bold text-emerald-400">
                          {activeDataset.prepared.statsSummary.testRows}
                        </div>
                        <div className="nl-text-muted text-[10px]">Test (Aislado)</div>
                      </div>
                    </div>

                    <div className="nl-surface-muted rounded-lg border p-3 font-mono space-y-1">
                      <div>
                        Dimensión entrada:{' '}
                        <span className="text-cyan-400">{activeDataset.prepared.inputDim}</span>
                      </div>
                      <div>
                        Dimensión salida:{' '}
                        <span className="text-emerald-400">{activeDataset.prepared.outputDim}</span>
                      </div>
                      <div>
                        Clases / Salida:{' '}
                        <span className="text-slate-200">
                          {activeDataset.prepared.classNames.join(', ')}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 font-semibold text-slate-300">
                        Registro de operaciones aplicadas:
                      </div>
                      <ul className="space-y-1.5">
                        {activeDataset.prepared.transformations.map((t, i) => (
                          <li
                            key={i}
                            className="nl-surface-muted rounded border px-2.5 py-1.5 text-slate-300"
                          >
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="nl-text-muted text-sm">
                    Ejecuta la preparación para generar las particiones Train, Validation y Test.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PREVIEW */}
          {activeTab === 'preview' && (
            <div className="nl-surface overflow-x-auto rounded-xl border">
              <div className="flex items-center gap-2 border-b border-slate-800/70 px-4 py-3 text-xs font-semibold">
                <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                Vista previa inmutable del CSV original (primeras 25 filas)
              </div>
              <table className="w-full text-left text-xs">
                <thead className="nl-surface-muted border-b border-slate-800/70 font-mono text-[11px] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    {activeDataset.headers.map((h) => (
                      <th key={h} className="px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {activeDataset.rows.slice(0, 25).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      {activeDataset.headers.map((h) => (
                        <td key={h} className="px-3 py-2">
                          {row[h] || <span className="text-amber-400">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
