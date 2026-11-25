import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Edit3,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { formatDateTime } from '../../utils/format';
import {
  exportProjectBundleAsJSON,
  parseProjectBundleFile,
} from '../../services/projectBundleService';
import type { Project } from '../../types';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const {
    projects,
    activeProjectId,
    datasets,
    architectures,
    trainingRuns,
    models,
    reports,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    importProjectBundle,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_models' | 'with_datasets'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchesText =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.goal.toLowerCase().includes(q);
      if (!matchesText) return false;
      if (filterMode === 'with_datasets') {
        return datasets.some((d) => d.projectId === p.id);
      }
      if (filterMode === 'with_models') {
        return models.some((m) => m.projectId === p.id);
      }
      return true;
    });
  }, [projects, search, filterMode, datasets, models]);

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setGoal('');
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description);
    setGoal(project.goal);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('El nombre del proyecto es obligatorio.');
      return;
    }
    if (editingProject) {
      await updateProject(editingProject.id, { name, description, goal });
    } else {
      const created = await createProject({ name, description, goal });
      await selectProject(created.id);
    }
    setShowModal(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bundle = await parseProjectBundleFile(file);
      const imported = await importProjectBundle(bundle);
      navigate(`/projects/${imported.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error importando proyecto.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Proyectos</h1>
          <p className="nl-text-muted mt-1 text-sm">
            Organiza datasets, arquitecturas 3D, entrenamientos, modelos e informes localmente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportJSON}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="nl-surface-muted inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition hover:border-cyan-500/50"
          >
            <Upload className="h-4 w-4 text-cyan-400" />
            Importar JSON
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" />
            Crear Proyecto
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Search and filter bar */}
      <div className="nl-surface flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, descripción u objetivo..."
            className="nl-surface-muted w-full rounded-lg border py-2 pl-9 pr-3 text-sm focus:border-cyan-500 focus:outline-hidden"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}
          className="nl-surface-muted rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-hidden"
        >
          <option value="all">Todos los proyectos</option>
          <option value="with_datasets">Con datasets importados</option>
          <option value="with_models">Con modelos entrenados</option>
        </select>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="nl-surface rounded-xl border border-dashed p-12 text-center">
          <p className="text-base font-medium">No hay proyectos que coincidan</p>
          <p className="nl-text-muted mt-1 text-sm">
            Crea un nuevo proyecto de IA para comenzar a importar datos y diseñar tu red en 3D.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" /> Crear Proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const dsCount = datasets.filter((d) => d.projectId === proj.id).length;
            const archCount = architectures.filter((a) => a.projectId === proj.id).length;
            const runCount = trainingRuns.filter((r) => r.projectId === proj.id).length;
            const mdlCount = models.filter((m) => m.projectId === proj.id).length;

            return (
              <div
                key={proj.id}
                className={`nl-surface flex flex-col justify-between rounded-xl border p-5 transition ${
                  isActive ? 'border-cyan-500/60 ring-1 ring-cyan-500/20' : 'hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{proj.name}</h3>
                        {isActive && (
                          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-indigo-400">
                        {proj.goal || 'Sin objetivo específico'}
                      </p>
                    </div>
                  </div>
                  <p className="nl-text-muted mt-2 line-clamp-2 text-sm">
                    {proj.description || 'Sin descripción.'}
                  </p>

                  <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="nl-surface-muted rounded-lg border p-2">
                      <div className="font-bold">{dsCount}</div>
                      <div className="nl-text-muted text-[10px]">Datasets</div>
                    </div>
                    <div className="nl-surface-muted rounded-lg border p-2">
                      <div className="font-bold">{archCount}</div>
                      <div className="nl-text-muted text-[10px]">Redes</div>
                    </div>
                    <div className="nl-surface-muted rounded-lg border p-2">
                      <div className="font-bold">{runCount}</div>
                      <div className="nl-text-muted text-[10px]">Runs</div>
                    </div>
                    <div className="nl-surface-muted rounded-lg border p-2">
                      <div className="font-bold">{mdlCount}</div>
                      <div className="nl-text-muted text-[10px]">Modelos</div>
                    </div>
                  </div>

                  <div className="nl-text-muted mt-3 space-y-0.5 text-[11px]">
                    <div>Creado: {formatDateTime(proj.createdAt)}</div>
                    <div>Último acceso: {formatDateTime(proj.lastAccessedAt)}</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800/60 pt-3">
                  <button
                    onClick={async () => {
                      await selectProject(proj.id);
                      navigate(`/projects/${proj.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/25"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Abrir Workspace
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        exportProjectBundleAsJSON({
                          project: proj,
                          datasets,
                          architectures,
                          trainingRuns,
                          models,
                          reports,
                        })
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-cyan-400"
                      title="Exportar proyecto JSON"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(proj)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                      title="Editar proyecto"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar el proyecto "${proj.name}" y todos sus datos?`)) {
                          void deleteProject(proj.id);
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="nl-surface w-full max-w-lg rounded-2xl border p-6 shadow-2xl">
            <h2 className="text-lg font-bold">
              {editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto de IA'}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nombre del proyecto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Clasificador Botánico Iris MLP"
                  className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Objetivo del proyecto
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Ej. Predecir especie con Accuracy > 95%"
                  className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas sobre el dataset, arquitectura o hipótesis experimental..."
                  className="nl-surface-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nl-surface-muted rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  {editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
