import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ActivityEvent,
  DatasetRecord,
  NeuralArchitecture,
  Project,
  RegisteredModel,
  ReportRecord,
  TrainingRun,
} from '../../types';

interface NeuroLabDBSchema extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
  datasets: {
    key: string;
    value: DatasetRecord;
    indexes: { 'by-project': string };
  };
  architectures: {
    key: string;
    value: NeuralArchitecture;
    indexes: { 'by-project': string };
  };
  trainingRuns: {
    key: string;
    value: TrainingRun;
    indexes: { 'by-project': string };
  };
  models: {
    key: string;
    value: RegisteredModel;
    indexes: { 'by-project': string };
  };
  reports: {
    key: string;
    value: ReportRecord;
    indexes: { 'by-project': string };
  };
  activities: {
    key: string;
    value: ActivityEvent;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'neurolab_studio_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NeuroLabDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<NeuroLabDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<NeuroLabDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('datasets')) {
          const store = db.createObjectStore('datasets', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('architectures')) {
          const store = db.createObjectStore('architectures', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('trainingRuns')) {
          const store = db.createObjectStore('trainingRuns', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('models')) {
          const store = db.createObjectStore('models', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('reports')) {
          const store = db.createObjectStore('reports', { keyPath: 'id' });
          store.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('activities')) {
          const store = db.createObjectStore('activities', { keyPath: 'id' });
          store.createIndex('by-date', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export const dbService = {
  async loadAllState() {
    const db = await getDB();
    const [projects, datasets, architectures, trainingRuns, models, reports, activities] =
      await Promise.all([
        db.getAll('projects'),
        db.getAll('datasets'),
        db.getAll('architectures'),
        db.getAll('trainingRuns'),
        db.getAll('models'),
        db.getAll('reports'),
        db.getAll('activities'),
      ]);
    return {
      projects: projects.sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt)),
      datasets: datasets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      architectures: architectures.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      trainingRuns: trainingRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      models: models.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      reports: reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      activities: activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    };
  },

  async putProject(project: Project) {
    const db = await getDB();
    await db.put('projects', project);
  },

  async deleteProjectCascade(projectId: string) {
    const db = await getDB();
    const tx = db.transaction(
      ['projects', 'datasets', 'architectures', 'trainingRuns', 'models', 'reports'],
      'readwrite'
    );
    await tx.objectStore('projects').delete(projectId);

    const stores = ['datasets', 'architectures', 'trainingRuns', 'models', 'reports'] as const;
    for (const storeName of stores) {
      const items = await tx.objectStore(storeName).index('by-project').getAllKeys(projectId);
      for (const key of items) {
        await tx.objectStore(storeName).delete(key);
      }
    }
    await tx.done;
  },

  async putDataset(dataset: DatasetRecord) {
    const db = await getDB();
    await db.put('datasets', dataset);
  },

  async deleteDataset(id: string) {
    const db = await getDB();
    await db.delete('datasets', id);
  },

  async putArchitecture(arch: NeuralArchitecture) {
    const db = await getDB();
    await db.put('architectures', arch);
  },

  async deleteArchitecture(id: string) {
    const db = await getDB();
    await db.delete('architectures', id);
  },

  async putTrainingRun(run: TrainingRun) {
    const db = await getDB();
    await db.put('trainingRuns', run);
  },

  async deleteTrainingRun(id: string) {
    const db = await getDB();
    await db.delete('trainingRuns', id);
  },

  async putModel(model: RegisteredModel) {
    const db = await getDB();
    await db.put('models', model);
  },

  async deleteModel(id: string) {
    const db = await getDB();
    await db.delete('models', id);
  },

  async putReport(report: ReportRecord) {
    const db = await getDB();
    await db.put('reports', report);
  },

  async putActivity(event: ActivityEvent) {
    const db = await getDB();
    await db.put('activities', event);
  },

  async clearAllData() {
    const db = await getDB();
    const tx = db.transaction(
      ['projects', 'datasets', 'architectures', 'trainingRuns', 'models', 'reports', 'activities'],
      'readwrite'
    );
    await Promise.all([
      tx.objectStore('projects').clear(),
      tx.objectStore('datasets').clear(),
      tx.objectStore('architectures').clear(),
      tx.objectStore('trainingRuns').clear(),
      tx.objectStore('models').clear(),
      tx.objectStore('reports').clear(),
      tx.objectStore('activities').clear(),
    ]);
    await tx.done;
  },

  async estimateStorageUsage(): Promise<{ usageBytes: number; quotaBytes: number; percent: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const usageBytes = est.usage ?? 0;
      const quotaBytes = est.quota ?? 0;
      const percent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
      return { usageBytes, quotaBytes, percent };
    }
    return { usageBytes: 0, quotaBytes: 0, percent: 0 };
  },
};

export interface ProjectBundleExport {
  schemaVersion: 1;
  exportedAt: string;
  project: Project;
  datasets: DatasetRecord[];
  architectures: NeuralArchitecture[];
  trainingRuns: TrainingRun[];
  models: RegisteredModel[];
  reports: ReportRecord[];
}
