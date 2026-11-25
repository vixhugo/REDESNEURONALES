import type { ProjectBundleExport } from '../storage/indexeddb/database';
import type {
  DatasetRecord,
  NeuralArchitecture,
  Project,
  RegisteredModel,
  ReportRecord,
  TrainingRun,
} from '../types';

export function exportProjectBundleAsJSON(params: {
  project: Project;
  datasets: DatasetRecord[];
  architectures: NeuralArchitecture[];
  trainingRuns: TrainingRun[];
  models: RegisteredModel[];
  reports: ReportRecord[];
}): void {
  const bundle: ProjectBundleExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: params.project,
    datasets: params.datasets.filter((d) => d.projectId === params.project.id),
    architectures: params.architectures.filter((a) => a.projectId === params.project.id),
    trainingRuns: params.trainingRuns.filter((r) => r.projectId === params.project.id),
    models: params.models.filter((m) => m.projectId === params.project.id),
    reports: params.reports.filter((r) => r.projectId === params.project.id),
  };

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_neurolab.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseProjectBundleFile(file: File): Promise<ProjectBundleExport> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ProjectBundleExport;
  if (!parsed || parsed.schemaVersion !== 1 || !parsed.project || !parsed.project.name) {
    throw new Error('Archivo de proyecto inválido o incompatible con NeuroLab Studio.');
  }
  return parsed;
}
