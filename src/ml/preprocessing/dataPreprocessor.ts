import type { DatasetEDA, PreparedDataset, PreprocessingConfig } from '../../types';
import { createSeededRandom } from '../../utils/id';
import { isNullValue } from './edaEngine';

function medianOf(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function modeOf(values: string[]): string {
  const freq = new Map<string, number>();
  let best = '';
  let bestCount = -1;
  for (const v of values) {
    const c = (freq.get(v) ?? 0) + 1;
    freq.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function prepareDataset(
  headers: string[],
  rawRows: Record<string, string>[],
  eda: DatasetEDA,
  config: PreprocessingConfig
): PreparedDataset {
  const transformations: string[] = [];
  const activeFeatures = config.featureColumns.filter(
    (col) => col !== config.targetColumn && !config.droppedColumns.includes(col)
  );

  if (activeFeatures.length === 0) {
    throw new Error('Debes seleccionar al menos una variable de entrada.');
  }
  if (!config.targetColumn) {
    throw new Error('Debes seleccionar una variable objetivo (target).');
  }

  // 1. Work on a shallow clone of rows (non-destructive)
  let workingRows = rawRows.map((r) => ({ ...r }));
  const originalRows = workingRows.length;

  // 2. Remove duplicates if enabled
  if (config.removeDuplicates) {
    const colsToCheck = [...activeFeatures, config.targetColumn];
    const seen = new Set<string>();
    const deduped: Record<string, string>[] = [];
    for (const row of workingRows) {
      const sig = colsToCheck.map((c) => row[c] ?? '').join('\u0001');
      if (!seen.has(sig)) {
        seen.add(sig);
        deduped.push(row);
      }
    }
    const removed = workingRows.length - deduped.length;
    workingRows = deduped;
    if (removed > 0) {
      transformations.push(`Duplicados eliminados: ${removed} filas.`);
    }
  }

  // 3. Drop rows with missing target
  const beforeTargetFilter = workingRows.length;
  workingRows = workingRows.filter((r) => !isNullValue(r[config.targetColumn]));
  const droppedTargetNulls = beforeTargetFilter - workingRows.length;
  if (droppedTargetNulls > 0) {
    transformations.push(`Filas descartadas por target nulo: ${droppedTargetNulls}.`);
  }

  // 4. Handle missing values in features
  if (config.missingStrategy === 'drop') {
    const before = workingRows.length;
    workingRows = workingRows.filter((r) => activeFeatures.every((col) => !isNullValue(r[col])));
    const dropped = before - workingRows.length;
    if (dropped > 0) {
      transformations.push(`Filas eliminadas por valores nulos: ${dropped}.`);
    }
  } else {
    let imputedCount = 0;
    for (const col of activeFeatures) {
      const colStats = eda.columns.find((c) => c.name === col);
      const isNum = colStats?.inferredType === 'numeric';
      const nonNull = workingRows.map((r) => r[col]).filter((v) => !isNullValue(v));

      let fillVal = '0';
      if (isNum) {
        const nums = nonNull.map(Number).filter(Number.isFinite);
        if (config.missingStrategy === 'mean') {
          const m = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          fillVal = String(m);
        } else if (config.missingStrategy === 'median') {
          fillVal = String(medianOf(nums));
        } else if (config.missingStrategy === 'mode') {
          fillVal = modeOf(nonNull) || '0';
        } else {
          fillVal = '0';
        }
      } else {
        fillVal = modeOf(nonNull) || 'DESCONOCIDO';
      }

      for (const row of workingRows) {
        if (isNullValue(row[col])) {
          row[col] = fillVal;
          imputedCount++;
        }
      }
    }
    if (imputedCount > 0) {
      transformations.push(
        `Valores faltantes imputados (${config.missingStrategy}): ${imputedCount} celdas.`
      );
    }
  }

  if (workingRows.length < 6) {
    throw new Error('Después de la limpieza quedan muy pocos registros (mínimo 6) para dividir y entrenar.');
  }

  // 5. Encode features (numeric parse + categorical encoding)
  const encodedFeatureNames: string[] = [];
  const featureEncoders: Array<
    | { type: 'numeric'; col: string }
    | { type: 'onehot'; col: string; categories: string[] }
    | { type: 'label'; col: string; mapping: Map<string, number> }
  > = [];

  for (const col of activeFeatures) {
    const colStats = eda.columns.find((c) => c.name === col);
    if (colStats?.inferredType === 'numeric') {
      encodedFeatureNames.push(col);
      featureEncoders.push({ type: 'numeric', col });
    } else {
      const cats = Array.from(new Set(workingRows.map((r) => r[col].trim()))).sort();
      if (config.encoding === 'onehot' && cats.length <= 25) {
        for (const cat of cats) {
          encodedFeatureNames.push(`${col}=${cat}`);
        }
        featureEncoders.push({ type: 'onehot', col, categories: cats });
      } else {
        const mapping = new Map<string, number>();
        cats.forEach((c, idx) => mapping.set(c, idx));
        encodedFeatureNames.push(col);
        featureEncoders.push({ type: 'label', col, mapping });
      }
    }
  }

  const XAll: number[][] = workingRows.map((row) => {
    const vec: number[] = [];
    for (const enc of featureEncoders) {
      if (enc.type === 'numeric') {
        const v = Number(row[enc.col]);
        vec.push(Number.isFinite(v) ? v : 0);
      } else if (enc.type === 'onehot') {
        const val = row[enc.col].trim();
        for (const cat of enc.categories) {
          vec.push(val === cat ? 1 : 0);
        }
      } else {
        vec.push(enc.mapping.get(row[enc.col].trim()) ?? 0);
      }
    }
    return vec;
  });

  if (featureEncoders.some((e) => e.type !== 'numeric')) {
    transformations.push(`Codificación categórica (${config.encoding}) aplicada → ${encodedFeatureNames.length} variables finales.`);
  }

  // 6. Encode Target
  let classNames: string[] = [];
  let yAll: number[][] = [];
  let rawClassLabels: string[] = [];

  if (config.taskType === 'classification') {
    rawClassLabels = workingRows.map((r) => r[config.targetColumn].trim());
    classNames = Array.from(new Set(rawClassLabels)).sort();
    if (classNames.length < 2) {
      throw new Error('La variable objetivo de clasificación debe tener al menos 2 clases distintas.');
    }
    const classIndex = new Map<string, number>();
    classNames.forEach((c, idx) => classIndex.set(c, idx));

    yAll = rawClassLabels.map((lbl) => {
      const oneHot = new Array<number>(classNames.length).fill(0);
      const idx = classIndex.get(lbl) ?? 0;
      oneHot[idx] = 1;
      return oneHot;
    });
    transformations.push(`Target categórico "${config.targetColumn}" codificado en ${classNames.length} clases.`);
  } else {
    yAll = workingRows.map((r) => {
      const n = Number(r[config.targetColumn]);
      if (!Number.isFinite(n)) {
        throw new Error(`La columna target "${config.targetColumn}" contiene valores no numéricos para regresión.`);
      }
      return [n];
    });
    classNames = [config.targetColumn];
    transformations.push(`Target numérico "${config.targetColumn}" preparado para regresión.`);
  }

  // 7. Split into Train / Val / Test (stratified when classification + enabled)
  const rng = createSeededRandom(config.seed);
  const totalRatio = config.trainRatio + config.valRatio + config.testRatio || 1;
  const rTrain = config.trainRatio / totalRatio;
  const rVal = config.valRatio / totalRatio;

  let trainIndices: number[] = [];
  let valIndices: number[] = [];
  let testIndices: number[] = [];

  if (config.taskType === 'classification' && config.stratified) {
    const byClass = new Map<string, number[]>();
    rawClassLabels.forEach((lbl, idx) => {
      const list = byClass.get(lbl) ?? [];
      list.push(idx);
      byClass.set(lbl, list);
    });

    for (const [, indices] of byClass.entries()) {
      const shuffled = shuffleWithRng(indices, rng);
      const n = shuffled.length;
      const nTrain = Math.max(1, Math.round(n * rTrain));
      const nVal = Math.max(0, Math.round(n * rVal));
      const actualTrain = Math.min(nTrain, n);
      const actualVal = Math.min(nVal, n - actualTrain);

      trainIndices.push(...shuffled.slice(0, actualTrain));
      valIndices.push(...shuffled.slice(actualTrain, actualTrain + actualVal));
      testIndices.push(...shuffled.slice(actualTrain + actualVal));
    }

    // Ensure at least 1 sample in val and test if possible
    trainIndices = shuffleWithRng(trainIndices, rng);
    valIndices = shuffleWithRng(valIndices, rng);
    testIndices = shuffleWithRng(testIndices, rng);
    transformations.push('División estratificada ejecutada con semilla reproducible.');
  } else {
    const allIdx = shuffleWithRng(
      workingRows.map((_, i) => i),
      rng
    );
    const n = allIdx.length;
    const nTrain = Math.max(1, Math.round(n * rTrain));
    const nVal = Math.max(1, Math.round(n * rVal));
    trainIndices = allIdx.slice(0, Math.min(nTrain, n - 2));
    valIndices = allIdx.slice(trainIndices.length, Math.min(trainIndices.length + nVal, n - 1));
    testIndices = allIdx.slice(trainIndices.length + valIndices.length);
    transformations.push('División aleatoria reproducible aplicada.');
  }

  // Fallback if stratified rounding left test or val empty
  if (testIndices.length === 0 && trainIndices.length > 2) {
    testIndices.push(trainIndices.pop()!);
  }
  if (valIndices.length === 0 && trainIndices.length > 2) {
    valIndices.push(trainIndices.pop()!);
  }

  let XTrain = trainIndices.map((i) => [...XAll[i]]);
  let XVal = valIndices.map((i) => [...XAll[i]]);
  let XTest = testIndices.map((i) => [...XAll[i]]);
  const yTrain = trainIndices.map((i) => yAll[i]);
  const yVal = valIndices.map((i) => yAll[i]);
  const yTest = testIndices.map((i) => yAll[i]);

  // 8. Scaling fit ONLY on Train to prevent data leakage
  const dim = encodedFeatureNames.length;
  if (config.scaling !== 'none' && XTrain.length > 0) {
    if (config.scaling === 'minmax') {
      const mins = new Array<number>(dim).fill(Infinity);
      const maxs = new Array<number>(dim).fill(-Infinity);
      for (const row of XTrain) {
        for (let j = 0; j < dim; j++) {
          if (row[j] < mins[j]) mins[j] = row[j];
          if (row[j] > maxs[j]) maxs[j] = row[j];
        }
      }
      const applyMinMax = (rows: number[][]) =>
        rows.map((r) =>
          r.map((v, j) => {
            const range = maxs[j] - mins[j];
            return range === 0 ? 0 : (v - mins[j]) / range;
          })
        );
      XTrain = applyMinMax(XTrain);
      XVal = applyMinMax(XVal);
      XTest = applyMinMax(XTest);
      transformations.push('Normalización Min-Max [0, 1] ajustada sobre Train y aplicada a Val/Test.');
    } else if (config.scaling === 'standard') {
      const means = new Array<number>(dim).fill(0);
      const stds = new Array<number>(dim).fill(0);
      for (const row of XTrain) {
        for (let j = 0; j < dim; j++) means[j] += row[j];
      }
      for (let j = 0; j < dim; j++) means[j] /= XTrain.length;

      for (const row of XTrain) {
        for (let j = 0; j < dim; j++) stds[j] += Math.pow(row[j] - means[j], 2);
      }
      for (let j = 0; j < dim; j++) stds[j] = Math.sqrt(stds[j] / XTrain.length) || 1;

      const applyStd = (rows: number[][]) =>
        rows.map((r) => r.map((v, j) => (v - means[j]) / stds[j]));
      XTrain = applyStd(XTrain);
      XVal = applyStd(XVal);
      XTest = applyStd(XTest);
      transformations.push('Estandarización Z-score (μ=0, σ=1) ajustada sobre Train y aplicada a Val/Test.');
    }
  }

  return {
    featureNames: encodedFeatureNames,
    inputDim: dim,
    outputDim: config.taskType === 'classification' ? classNames.length : 1,
    classNames,
    taskType: config.taskType,
    XTrain,
    yTrain,
    XVal,
    yVal,
    XTest,
    yTest,
    transformations,
    statsSummary: {
      originalRows,
      cleanedRows: workingRows.length,
      trainRows: XTrain.length,
      valRows: XVal.length,
      testRows: XTest.length,
    },
  };
}
