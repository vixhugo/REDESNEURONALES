import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type {
  DatasetRecord,
  NeuralArchitecture,
  Project,
  TrainingRun,
} from '../types';
import { formatDateTime, formatDuration, formatNumber } from '../utils/format';

export interface GenerateReportOptions {
  project: Project;
  dataset?: DatasetRecord;
  architecture?: NeuralArchitecture;
  trainingRun?: TrainingRun;
  architectureImageDataUrl?: string | null;
  chartsContainerEl?: HTMLElement | null;
}

export async function generateProjectPDFReport(opts: GenerateReportOptions): Promise<string> {
  const { project, dataset, architecture, trainingRun, architectureImageDataUrl, chartsContainerEl } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(14);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(56, 189, 248);
    doc.text(title, margin + 3, y + 0.5);
    y += 8;
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
  };

  const addLine = (label: string, value: string) => {
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(value || '—', pageWidth - margin * 2 - 42);
    doc.text(wrapped, margin + 42, y);
    y += Math.max(5.5, wrapped.length * 4.5);
  };

  // Header Banner
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(56, 189, 248);
  doc.text('NEUROLAB STUDIO — INFORME TÉCNICO DE EXPERIMENTO', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado en navegador (100% local) • ${formatDateTime(new Date().toISOString())}`, margin, 21);
  y = 36;

  // 1. Project Info
  addSectionTitle('1. Información del Proyecto');
  addLine('Proyecto', project.name);
  addLine('Objetivo', project.goal || 'No especificado');
  addLine('Descripción', project.description || 'Sin descripción');
  addLine('Fecha de creación', formatDateTime(project.createdAt));
  addLine('Fecha de ejecución', trainingRun ? formatDateTime(trainingRun.startedAt) : formatDateTime(new Date().toISOString()));
  y += 3;

  // 2-5. Dataset & Preprocessing
  addSectionTitle('2. Dataset, Variables y Preprocesamiento');
  if (dataset) {
    addLine('Archivo / Nombre', `${dataset.name} (${dataset.fileName})`);
    addLine('Cantidad de registros', `${dataset.eda.rowCount} filas × ${dataset.eda.colCount} columnas (${dataset.eda.duplicateCount} duplicados originales)`);
    addLine('Variable objetivo', `${dataset.preprocessing.targetColumn} (${dataset.preprocessing.taskType})`);
    addLine('Variables entrada', dataset.preprocessing.featureColumns.join(', '));
    addLine(
      'Preprocesamiento',
      `Nulos: ${dataset.preprocessing.missingStrategy} | Codificación: ${dataset.preprocessing.encoding} | Escalado: ${dataset.preprocessing.scaling} | División: ${Math.round(dataset.preprocessing.trainRatio * 100)}/${Math.round(dataset.preprocessing.valRatio * 100)}/${Math.round(dataset.preprocessing.testRatio * 100)} (seed=${dataset.preprocessing.seed})`
    );
    if (dataset.prepared) {
      addLine(
        'Particiones finales',
        `Train=${dataset.prepared.statsSummary.trainRows}, Val=${dataset.prepared.statsSummary.valRows}, Test=${dataset.prepared.statsSummary.testRows} | Dimensión=${dataset.prepared.inputDim}→${dataset.prepared.outputDim}`
      );
    }
  } else {
    addLine('Estado', 'Sin dataset asociado');
  }
  y += 3;

  // 6-7. Neural Architecture + 3D Screenshot
  addSectionTitle('3. Arquitectura Neuronal y Representación 3D');
  if (architecture) {
    addLine('Arquitectura', `${architecture.name} (${architecture.family.toUpperCase()})`);
    const layerDesc = architecture.layers
      .map((l, idx) => `${idx + 1}. ${l.name} [${l.type}] (${l.units} neuronas, act=${l.activation})`)
      .join(' | ');
    addLine('Capas configuradas', layerDesc);
  } else {
    addLine('Estado', 'Sin arquitectura seleccionada');
  }

  if (architectureImageDataUrl) {
    ensureSpace(68);
    try {
      doc.addImage(architectureImageDataUrl, 'PNG', margin, y + 2, pageWidth - margin * 2, 62);
      y += 67;
    } catch {
      addLine('Vista 3D', 'Captura 3D no disponible en este contexto WebGL.');
    }
  }
  y += 2;

  // 8-10. Training Config & Evaluation Metrics
  addSectionTitle('4. Entrenamiento y Evaluación en Test');
  if (trainingRun) {
    addLine('Estado / Backend', `${trainingRun.status.toUpperCase()} — TensorFlow.js (${trainingRun.backendUsed.toUpperCase()})`);
    addLine(
      'Hiperparámetros',
      `Épocas=${trainingRun.currentEpoch}/${trainingRun.config.epochs}, Batch=${trainingRun.config.batchSize}, LR=${trainingRun.config.learningRate}, Opt=${trainingRun.config.optimizer.toUpperCase()}, Loss=${trainingRun.config.loss}`
    );
    addLine('Duración', formatDuration(trainingRun.elapsedMs));

    const lastEpoch = trainingRun.history[trainingRun.history.length - 1];
    if (lastEpoch) {
      addLine(
        'Última época',
        `Train Loss=${formatNumber(lastEpoch.loss)}${lastEpoch.valLoss !== undefined ? `, Val Loss=${formatNumber(lastEpoch.valLoss)}` : ''}${lastEpoch.accuracy !== undefined ? `, Train Acc=${(lastEpoch.accuracy * 100).toFixed(2)}%` : ''}`
      );
    }

    if (trainingRun.evaluation) {
      const ev = trainingRun.evaluation;
      addLine('Test Loss', formatNumber(ev.testLoss));
      if (ev.taskType === 'classification') {
        addLine(
          'Métricas Test',
          `Accuracy=${((ev.accuracy ?? 0) * 100).toFixed(2)}% | Precision=${((ev.precisionMacro ?? 0) * 100).toFixed(2)}% | Recall=${((ev.recallMacro ?? 0) * 100).toFixed(2)}% | F1=${((ev.f1Macro ?? 0) * 100).toFixed(2)}%`
        );
      } else {
        addLine(
          'Métricas Regresión',
          `MAE=${formatNumber(ev.mae)} | RMSE=${formatNumber(ev.rmse)} | R²=${formatNumber(ev.r2)}`
        );
      }
    }
  } else {
    addLine('Estado', 'Sin entrenamiento ejecutado');
  }

  // 11. Charts snapshot via html2canvas if provided
  if (chartsContainerEl) {
    try {
      const canvas = await html2canvas(chartsContainerEl, {
        backgroundColor: '#0f172a',
        scale: 1.5,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const ratio = canvas.height / canvas.width;
      const drawW = pageWidth - margin * 2;
      const drawH = Math.min(95, drawW * ratio);
      ensureSpace(drawH + 16);
      addSectionTitle('5. Gráficos de Entrenamiento y Resultados');
      doc.addImage(imgData, 'PNG', margin, y + 1, drawW, drawH);
      y += drawH + 5;
    } catch {
      // Ignore html2canvas capture edge cases
    }
  }

  const fileName = `NeuroLab_Informe_${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function exportTrainingResultsCSV(trainingRun: TrainingRun): void {
  const headers = ['epoch', 'loss', 'val_loss', 'accuracy', 'val_accuracy', 'mae', 'val_mae', 'elapsed_ms'];
  const lines = [headers.join(',')];
  for (const h of trainingRun.history) {
    lines.push(
      [
        h.epoch,
        h.loss,
        h.valLoss ?? '',
        h.accuracy ?? '',
        h.valAccuracy ?? '',
        h.mae ?? '',
        h.valMae ?? '',
        h.timestampMs.toFixed(1),
      ].join(',')
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resultados_${trainingRun.architectureName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
