import { create } from 'zustand';
import type {
  ActivityEvent,
  AppSettings,
  DatasetRecord,
  EpochMetric,
  LayerConfig,
  NeuralArchitecture,
  Project,
  RegisteredModel,
  ReportRecord,
  SelectedConnectionInfo,
  SelectedNeuronInfo,
  TrainingConfig,
  TrainingRun,
} from '../types';
import { dbService, type ProjectBundleExport } from '../storage/indexeddb/database';
import {
  applyThemeToDocument,
  DEFAULT_SETTINGS,
  loadLastProjectId,
  loadSettings,
  saveLastProjectId,
  saveSettings,
} from '../storage/localstorage/settingsStorage';
import { createId } from '../utils/id';
import {
  type BackendStatusInfo,
  deleteTFModelFromIndexedDB,
  ensureTFBackend,
  initializeArchitectureWeights,
  saveTFModelToIndexedDB,
  trainNeuralNetwork,
} from '../ml/training/tfEngine';
import { createDefaultLayers } from '../ml/architectures/architectureValidator';

interface StorageStats {
  usageBytes: number;
  quotaBytes: number;
  percent: number;
}

interface AppState {
  initialized: boolean;
  loading: boolean;
  settings: AppSettings;
  backendStatus: BackendStatusInfo | null;
  storageStats: StorageStats;

  projects: Project[];
  activeProjectId: string | null;
  datasets: DatasetRecord[];
  architectures: NeuralArchitecture[];
  trainingRuns: TrainingRun[];
  models: RegisteredModel[];
  reports: ReportRecord[];
  activities: ActivityEvent[];

  // Live training state
  isTraining: boolean;
  activeTrainingRunId: string | null;
  liveHistory: EpochMetric[];
  cancelRequested: boolean;

  // 3D Designer inspection state
  selectedNeuron: SelectedNeuronInfo | null;
  selectedConnection: SelectedConnectionInfo | null;
  selectedLayerId: string | null;
  liveActivations: number[][] | null;

  // Actions
  initApp: () => Promise<void>;
  refreshBackendStatus: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  logActivity: (
    type: ActivityEvent['type'],
    title: string,
    detail: string,
    projectId?: string
  ) => Promise<void>;

  // Projects
  createProject: (input: { name: string; description: string; goal: string }) => Promise<Project>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null) => Promise<void>;

  // Datasets
  saveDataset: (dataset: DatasetRecord) => Promise<void>;
  deleteDataset: (id: string) => Promise<void>;

  // Architectures
  createArchitecture: (
    projectId: string,
    name: string,
    layers?: LayerConfig[]
  ) => Promise<NeuralArchitecture>;
  updateArchitecture: (id: string, patch: Partial<NeuralArchitecture>) => Promise<void>;
  duplicateArchitecture: (id: string) => Promise<NeuralArchitecture | null>;
  deleteArchitecture: (id: string) => Promise<void>;
  initializeArchitectureTFWeights: (id: string) => Promise<void>;

  // Training & Models
  startTraining: (params: {
    projectId: string;
    datasetId: string;
    architectureId: string;
    config: TrainingConfig;
    autoSaveModel?: boolean;
    modelName?: string;
  }) => Promise<TrainingRun | null>;
  cancelTraining: () => void;
  deleteTrainingRun: (id: string) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;

  // Reports
  saveReportRecord: (report: ReportRecord) => Promise<void>;

  // Maintenance & Import
  importProjectBundle: (bundle: ProjectBundleExport) => Promise<Project>;
  clearAllWorkspaceData: () => Promise<void>;

  // 3D selection
  setSelectedNeuron: (info: SelectedNeuronInfo | null) => void;
  setSelectedConnection: (info: SelectedConnectionInfo | null) => void;
  setSelectedLayerId: (layerId: string | null) => void;
  setLiveActivations: (acts: number[][] | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  loading: false,
  settings: DEFAULT_SETTINGS,
  backendStatus: null,
  storageStats: { usageBytes: 0, quotaBytes: 0, percent: 0 },

  projects: [],
  activeProjectId: null,
  datasets: [],
  architectures: [],
  trainingRuns: [],
  models: [],
  reports: [],
  activities: [],

  isTraining: false,
  activeTrainingRunId: null,
  liveHistory: [],
  cancelRequested: false,

  selectedNeuron: null,
  selectedConnection: null,
  selectedLayerId: null,
  liveActivations: null,

  initApp: async () => {
    if (get().initialized) return;
    set({ loading: true });

    const settings = loadSettings();
    applyThemeToDocument(settings.theme);

    const [allData, backendStatus, storageStats] = await Promise.all([
      dbService.loadAllState(),
      ensureTFBackend(settings.preferredBackend),
      dbService.estimateStorageUsage(),
    ]);

    const lastProjectId = loadLastProjectId();
    const validActive =
      lastProjectId && allData.projects.some((p) => p.id === lastProjectId)
        ? lastProjectId
        : allData.projects[0]?.id ?? null;

    set({
      initialized: true,
      loading: false,
      settings,
      backendStatus,
      storageStats,
      ...allData,
      activeProjectId: validActive,
    });
  },

  refreshBackendStatus: async () => {
    const status = await ensureTFBackend(get().settings.preferredBackend);
    set({ backendStatus: status });
  },

  refreshStorageStats: async () => {
    const storageStats = await dbService.estimateStorageUsage();
    set({ storageStats });
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    applyThemeToDocument(next.theme);
    set({ settings: next });
    if (patch.preferredBackend) {
      const backendStatus = await ensureTFBackend(next.preferredBackend);
      set({ backendStatus });
    }
  },

  logActivity: async (type, title, detail, projectId) => {
    const event: ActivityEvent = {
      id: createId('act'),
      projectId,
      type,
      title,
      detail,
      createdAt: new Date().toISOString(),
    };
    await dbService.putActivity(event);
    set((s) => ({
      activities: [event, ...s.activities].slice(0, 100),
    }));
  },

  createProject: async ({ name, description, goal }) => {
    const now = new Date().toISOString();
    const project: Project = {
      id: createId('proj'),
      name: name.trim(),
      description: description.trim(),
      goal: goal.trim(),
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    await dbService.putProject(project);

    // Create a starter architecture for convenience inside the new project
    const starterArch: NeuralArchitecture = {
      id: createId('arch'),
      projectId: project.id,
      name: 'MLP Base 4→12→8→3',
      family: 'mlp',
      layers: createDefaultLayers(4, 3, false),
      weightsInitialized: false,
      createdAt: now,
      updatedAt: now,
    };
    await dbService.putArchitecture(starterArch);

    project.activeArchitectureId = starterArch.id;
    await dbService.putProject(project);
    saveLastProjectId(project.id);

    set((s) => ({
      projects: [project, ...s.projects],
      architectures: [starterArch, ...s.architectures],
      activeProjectId: project.id,
    }));

    await get().logActivity('project', 'Proyecto creado', `"${project.name}"`, project.id);
    await get().refreshStorageStats();
    return project;
  },

  updateProject: async (id, patch) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) return;
    const updated: Project = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await dbService.putProject(updated);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProject: async (id) => {
    const proj = get().projects.find((p) => p.id === id);
    const projectModels = get().models.filter((m) => m.projectId === id);
    for (const m of projectModels) {
      await deleteTFModelFromIndexedDB(m.tfStorageKey);
    }
    await dbService.deleteProjectCascade(id);

    const remainingProjects = get().projects.filter((p) => p.id !== id);
    const nextActive =
      get().activeProjectId === id ? remainingProjects[0]?.id ?? null : get().activeProjectId;
    saveLastProjectId(nextActive);

    set((s) => ({
      projects: remainingProjects,
      activeProjectId: nextActive,
      datasets: s.datasets.filter((d) => d.projectId !== id),
      architectures: s.architectures.filter((a) => a.projectId !== id),
      trainingRuns: s.trainingRuns.filter((r) => r.projectId !== id),
      models: s.models.filter((m) => m.projectId !== id),
      reports: s.reports.filter((r) => r.projectId !== id),
    }));

    if (proj) {
      await get().logActivity('project', 'Proyecto eliminado', `"${proj.name}"`);
    }
    await get().refreshStorageStats();
  },

  selectProject: async (id) => {
    saveLastProjectId(id);
    set({ activeProjectId: id, selectedNeuron: null, selectedConnection: null, selectedLayerId: null });
    if (id) {
      const proj = get().projects.find((p) => p.id === id);
      if (proj) {
        const updated = { ...proj, lastAccessedAt: new Date().toISOString() };
        await dbService.putProject(updated);
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
      }
    }
  },

  saveDataset: async (dataset) => {
    await dbService.putDataset(dataset);
    const exists = get().datasets.some((d) => d.id === dataset.id);
    set((s) => ({
      datasets: exists
        ? s.datasets.map((d) => (d.id === dataset.id ? dataset : d))
        : [dataset, ...s.datasets],
    }));

    // Link as active dataset on project
    await get().updateProject(dataset.projectId, { activeDatasetId: dataset.id });
    await get().logActivity(
      'dataset',
      exists ? 'Dataset actualizado' : 'Dataset importado',
      `${dataset.name} (${dataset.eda.rowCount} filas, ${dataset.eda.colCount} columnas)`,
      dataset.projectId
    );
    await get().refreshStorageStats();
  },

  deleteDataset: async (id) => {
    const ds = get().datasets.find((d) => d.id === id);
    await dbService.deleteDataset(id);
    set((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
    }));
    if (ds) {
      await get().logActivity('dataset', 'Dataset eliminado', ds.name, ds.projectId);
    }
    await get().refreshStorageStats();
  },

  createArchitecture: async (projectId, name, layers) => {
    const now = new Date().toISOString();
    const dataset = get().datasets.find((d) => d.projectId === projectId);
    const inputDim = dataset?.prepared?.inputDim ?? 4;
    const outputDim = dataset?.prepared?.outputDim ?? 3;
    const isReg = dataset?.prepared?.taskType === 'regression';

    const arch: NeuralArchitecture = {
      id: createId('arch'),
      projectId,
      name: name.trim(),
      family: 'mlp',
      layers: layers ?? createDefaultLayers(inputDim, outputDim, isReg),
      weightsInitialized: false,
      createdAt: now,
      updatedAt: now,
    };
    await dbService.putArchitecture(arch);
    set((s) => ({ architectures: [arch, ...s.architectures] }));
    await get().updateProject(projectId, { activeArchitectureId: arch.id });
    await get().logActivity('architecture', 'Arquitectura creada', arch.name, projectId);
    await get().refreshStorageStats();
    return arch;
  },

  updateArchitecture: async (id, patch) => {
    const existing = get().architectures.find((a) => a.id === id);
    if (!existing) return;
    const updated: NeuralArchitecture = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await dbService.putArchitecture(updated);
    set((s) => ({
      architectures: s.architectures.map((a) => (a.id === id ? updated : a)),
    }));
  },

  duplicateArchitecture: async (id) => {
    const source = get().architectures.find((a) => a.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy: NeuralArchitecture = {
      ...source,
      id: createId('arch'),
      name: `${source.name} (Copia)`,
      layers: source.layers.map((l) => ({ ...l, id: createId('layer') })),
      weightsSnapshot: undefined,
      weightsInitialized: false,
      createdAt: now,
      updatedAt: now,
    };
    await dbService.putArchitecture(copy);
    set((s) => ({ architectures: [copy, ...s.architectures] }));
    await get().updateProject(copy.projectId, { activeArchitectureId: copy.id });
    await get().logActivity('architecture', 'Arquitectura duplicada', copy.name, copy.projectId);
    return copy;
  },

  deleteArchitecture: async (id) => {
    const arch = get().architectures.find((a) => a.id === id);
    await dbService.deleteArchitecture(id);
    set((s) => ({
      architectures: s.architectures.filter((a) => a.id !== id),
    }));
    if (arch) {
      await get().logActivity('architecture', 'Arquitectura eliminada', arch.name, arch.projectId);
    }
  },

  initializeArchitectureTFWeights: async (id) => {
    const arch = get().architectures.find((a) => a.id === id);
    if (!arch) return;
    const snapshot = await initializeArchitectureWeights(arch);
    await get().updateArchitecture(id, {
      weightsSnapshot: snapshot,
      weightsInitialized: true,
    });
    await get().logActivity(
      'architecture',
      'Pesos inicializados (TF.js)',
      `Modelo compilado e inicializado para "${arch.name}"`,
      arch.projectId
    );
  },

  startTraining: async ({ projectId, datasetId, architectureId, config, autoSaveModel = true, modelName }) => {
    if (get().isTraining) return null;
    const project = get().projects.find((p) => p.id === projectId);
    const dataset = get().datasets.find((d) => d.id === datasetId);
    const architecture = get().architectures.find((a) => a.id === architectureId);

    if (!project || !dataset || !dataset.prepared || !architecture) {
      throw new Error('Selecciona un proyecto, un dataset preparado y una arquitectura válida.');
    }

    const runId = createId('run');
    const startedAt = new Date().toISOString();
    const initialRun: TrainingRun = {
      id: runId,
      projectId,
      architectureId,
      architectureName: architecture.name,
      datasetId,
      datasetName: dataset.name,
      status: 'running',
      config,
      backendUsed: get().backendStatus?.activeBackend ?? 'cpu',
      startedAt,
      elapsedMs: 0,
      currentEpoch: 0,
      history: [],
    };

    await dbService.putTrainingRun(initialRun);
    set((s) => ({
      isTraining: true,
      activeTrainingRunId: runId,
      liveHistory: [],
      cancelRequested: false,
      trainingRuns: [initialRun, ...s.trainingRuns],
    }));

    const tStart = performance.now();
    try {
      const result = await trainNeuralNetwork(
        architecture,
        dataset.prepared,
        config,
        get().settings.preferredBackend,
        {
          shouldCancel: () => get().cancelRequested,
          onEpoch: (metric, latestWeights) => {
            set((s) => ({
              liveHistory: [...s.liveHistory, metric],
            }));
            if (latestWeights.length > 0) {
              set((s) => ({
                architectures: s.architectures.map((a) =>
                  a.id === architectureId
                    ? { ...a, weightsSnapshot: latestWeights, weightsInitialized: true }
                    : a
                ),
              }));
            }
          },
        }
      );

      // Update architecture with final trained weights
      await get().updateArchitecture(architectureId, {
        weightsSnapshot: result.weightsSnapshot,
        weightsInitialized: true,
      });

      let savedModelId: string | undefined;
      if (autoSaveModel && result.history.length > 0) {
        const existingVersions = get().models.filter(
          (m) => m.projectId === projectId && m.architectureId === architectureId
        );
        const version = existingVersions.length + 1;
        const mId = createId('mdl');
        const tfStorageKey = await saveTFModelToIndexedDB(result.tfModel, mId);
        const regModel: RegisteredModel = {
          id: mId,
          projectId,
          projectName: project.name,
          architectureId,
          architectureName: architecture.name,
          trainingRunId: runId,
          datasetName: dataset.name,
          name: (modelName || `${architecture.name} v${version}`).trim(),
          version,
          tfStorageKey,
          taskType: dataset.prepared.taskType,
          inputDim: dataset.prepared.inputDim,
          outputDim: dataset.prepared.outputDim,
          featureNames: dataset.prepared.featureNames,
          classNames: dataset.prepared.classNames,
          parameterCount: result.parameterCount,
          metricsSummary: {
            testLoss: result.evaluation.testLoss,
            accuracy: result.evaluation.accuracy,
            f1Macro: result.evaluation.f1Macro,
            rmse: result.evaluation.rmse,
            r2: result.evaluation.r2,
          },
          layers: architecture.layers,
          weightsSnapshot: result.weightsSnapshot,
          createdAt: new Date().toISOString(),
        };
        await dbService.putModel(regModel);
        savedModelId = mId;
        set((s) => ({ models: [regModel, ...s.models] }));
        await get().logActivity(
          'model',
          'Modelo guardado en Registry',
          `${regModel.name} (${regModel.parameterCount} parámetros)`,
          projectId
        );
      }

      // Dispose TF model instance from GPU/RAM after saving & evaluating
      result.tfModel.dispose();

      const completedRun: TrainingRun = {
        ...initialRun,
        modelId: savedModelId,
        status: result.cancelled ? 'cancelled' : 'completed',
        backendUsed: result.backendUsed,
        completedAt: new Date().toISOString(),
        elapsedMs: performance.now() - tStart,
        currentEpoch: result.history.length,
        history: result.history,
        evaluation: result.evaluation,
      };

      await dbService.putTrainingRun(completedRun);
      await get().updateProject(projectId, { activeTrainingRunId: completedRun.id });

      set((s) => ({
        isTraining: false,
        activeTrainingRunId: null,
        cancelRequested: false,
        trainingRuns: s.trainingRuns.map((r) => (r.id === runId ? completedRun : r)),
      }));

      await get().logActivity(
        'training',
        result.cancelled ? 'Entrenamiento cancelado' : 'Entrenamiento completado',
        `${architecture.name} — ${result.history.length} épocas (${result.backendUsed.toUpperCase()})`,
        projectId
      );
      await get().refreshBackendStatus();
      await get().refreshStorageStats();
      return completedRun;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error durante el entrenamiento.';
      const failedRun: TrainingRun = {
        ...initialRun,
        status: 'error',
        errorMessage: msg,
        completedAt: new Date().toISOString(),
        elapsedMs: performance.now() - tStart,
        history: get().liveHistory,
      };
      await dbService.putTrainingRun(failedRun);
      set((s) => ({
        isTraining: false,
        activeTrainingRunId: null,
        cancelRequested: false,
        trainingRuns: s.trainingRuns.map((r) => (r.id === runId ? failedRun : r)),
      }));
      throw err;
    }
  },

  cancelTraining: () => {
    set({ cancelRequested: true });
  },

  deleteTrainingRun: async (id) => {
    await dbService.deleteTrainingRun(id);
    set((s) => ({
      trainingRuns: s.trainingRuns.filter((r) => r.id !== id),
    }));
  },

  deleteModel: async (id) => {
    const mdl = get().models.find((m) => m.id === id);
    if (mdl) {
      await deleteTFModelFromIndexedDB(mdl.tfStorageKey);
    }
    await dbService.deleteModel(id);
    set((s) => ({
      models: s.models.filter((m) => m.id !== id),
    }));
    if (mdl) {
      await get().logActivity('model', 'Modelo eliminado', mdl.name, mdl.projectId);
    }
    await get().refreshStorageStats();
  },

  saveReportRecord: async (report) => {
    await dbService.putReport(report);
    set((s) => ({ reports: [report, ...s.reports] }));
    await get().logActivity('report', 'Informe PDF generado', report.fileName, report.projectId);
    await get().refreshStorageStats();
  },

  importProjectBundle: async (bundle) => {
    const now = new Date().toISOString();
    const newProjectId = createId('proj');
    const datasetIdMap = new Map<string, string>();
    const archIdMap = new Map<string, string>();
    const runIdMap = new Map<string, string>();
    const modelIdMap = new Map<string, string>();

    const importedProject: Project = {
      ...bundle.project,
      id: newProjectId,
      name: `${bundle.project.name} (Importado)`,
      updatedAt: now,
      lastAccessedAt: now,
    };

    const datasets = (bundle.datasets ?? []).map((d) => {
      const nid = createId('ds');
      datasetIdMap.set(d.id, nid);
      return { ...d, id: nid, projectId: newProjectId };
    });

    const architectures = (bundle.architectures ?? []).map((a) => {
      const nid = createId('arch');
      archIdMap.set(a.id, nid);
      return { ...a, id: nid, projectId: newProjectId };
    });

    const models = (bundle.models ?? []).map((m) => {
      const nid = createId('model');
      modelIdMap.set(m.id, nid);
      return {
        ...m,
        id: nid,
        projectId: newProjectId,
        projectName: importedProject.name,
        architectureId: archIdMap.get(m.architectureId) ?? m.architectureId,
      };
    });

    const runs = (bundle.trainingRuns ?? []).map((r) => {
      const nid = createId('run');
      runIdMap.set(r.id, nid);
      return {
        ...r,
        id: nid,
        projectId: newProjectId,
        datasetId: datasetIdMap.get(r.datasetId) ?? r.datasetId,
        architectureId: archIdMap.get(r.architectureId) ?? r.architectureId,
        modelId: r.modelId ? modelIdMap.get(r.modelId) : undefined,
      };
    });

    for (const m of models) {
      m.trainingRunId = runIdMap.get(m.trainingRunId) ?? m.trainingRunId;
    }

    const reports = (bundle.reports ?? []).map((rep) => ({
      ...rep,
      id: createId('rep'),
      projectId: newProjectId,
      projectName: importedProject.name,
      trainingRunId: rep.trainingRunId ? runIdMap.get(rep.trainingRunId) : undefined,
    }));

    importedProject.activeDatasetId = datasets[0]?.id;
    importedProject.activeArchitectureId = architectures[0]?.id;
    importedProject.activeTrainingRunId = runs[0]?.id;

    await dbService.putProject(importedProject);
    for (const d of datasets) await dbService.putDataset(d);
    for (const a of architectures) await dbService.putArchitecture(a);
    for (const r of runs) await dbService.putTrainingRun(r);
    for (const m of models) await dbService.putModel(m);
    for (const rep of reports) await dbService.putReport(rep);

    saveLastProjectId(newProjectId);

    set((s) => ({
      projects: [importedProject, ...s.projects],
      datasets: [...datasets, ...s.datasets],
      architectures: [...architectures, ...s.architectures],
      trainingRuns: [...runs, ...s.trainingRuns],
      models: [...models, ...s.models],
      reports: [...reports, ...s.reports],
      activeProjectId: newProjectId,
    }));

    await get().logActivity('project', 'Proyecto importado', importedProject.name, newProjectId);
    await get().refreshStorageStats();
    return importedProject;
  },

  clearAllWorkspaceData: async () => {
    const models = get().models;
    for (const m of models) {
      await deleteTFModelFromIndexedDB(m.tfStorageKey);
    }
    await dbService.clearAllData();
    saveLastProjectId(null);
    set({
      projects: [],
      activeProjectId: null,
      datasets: [],
      architectures: [],
      trainingRuns: [],
      models: [],
      reports: [],
      activities: [],
      selectedNeuron: null,
      selectedConnection: null,
      selectedLayerId: null,
      liveActivations: null,
    });
    await get().refreshStorageStats();
  },

  setSelectedNeuron: (info) => set({ selectedNeuron: info, selectedConnection: null }),
  setSelectedConnection: (info) => set({ selectedConnection: info, selectedNeuron: null }),
  setSelectedLayerId: (layerId) => set({ selectedLayerId: layerId }),
  setLiveActivations: (acts) => set({ liveActivations: acts }),
}));
