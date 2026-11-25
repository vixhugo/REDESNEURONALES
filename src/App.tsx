import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from './stores/useAppStore';
import { Layout } from './components/Layout';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { ProjectsPage } from './modules/projects/ProjectsPage';
import { ProjectWorkspacePage } from './modules/projects/ProjectWorkspacePage';
import { DatasetsPage } from './modules/datasets/DatasetsPage';
import { NeuralDesignerPage } from './modules/neural-designer/NeuralDesignerPage';
import { TrainingPage } from './modules/training/TrainingPage';
import { EvaluationPage } from './modules/evaluation/EvaluationPage';
import { ModelRegistryPage } from './modules/model-registry/ModelRegistryPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { FundamentalsPage } from './modules/education/FundamentalsPage';
import { SettingsPage } from './modules/settings/SettingsPage';

export function App() {
  const { initialized, loading, initApp } = useAppStore();

  useEffect(() => {
    void initApp();
  }, [initApp]);

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <p className="mt-4 font-mono text-xs tracking-wider text-cyan-400">
          INICIALIZANDO NEUROLAB STUDIO (INDEXEDDB + TENSORFLOW.JS)...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/designer" element={<NeuralDesignerPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/models" element={<ModelRegistryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/fundamentals" element={<FundamentalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
