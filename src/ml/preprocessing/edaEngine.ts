import type {
  CategoryFrequency,
  ColumnHistogramBin,
  ColumnStats,
  CorrelationMatrix,
  DatasetEDA,
  PreprocessingConfig,
  TaskType,
} from '../../types';

const NULL_TOKENS = new Set(['', 'null', 'na', 'n/a', 'nan', 'none', 'undefined', '?']);

export function isNullValue(val: string | undefined): boolean {
  if (val === undefined || val === null) return true;
  return NULL_TOKENS.has(val.trim().toLowerCase());
}

function buildHistogram(values: number[], binsCount = 10): ColumnHistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: min.toFixed(2), min, max, count: values.length }];
  }
  const step = (max - min) / binsCount;
  const counts = new Array<number>(binsCount).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / step);
    if (idx >= binsCount) idx = binsCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  return counts.map((count, i) => {
    const bMin = min + i * step;
    const bMax = min + (i + 1) * step;
    return {
      label: `${bMin.toFixed(1)}–${bMax.toFixed(1)}`,
      min: bMin,
      max: bMax,
      count,
    };
  });
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computePearson(xs: number[], ys: number[]): number {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  if (pairs.length < 2) return 0;
  const n = pairs.length;
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of pairs) {
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den));
}

export function runDatasetEDA(headers: string[], rows: Record<string, string>[]): DatasetEDA {
  const rowCount = rows.length;
  const colCount = headers.length;

  // Duplicate detection using serialized row signature
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const row of rows) {
    const key = headers.map((h) => row[h] ?? '').join('\u0001');
    if (seen.has(key)) duplicateCount++;
    else seen.add(key);
  }

  const columns: ColumnStats[] = [];
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];
  const numericVectors: Record<string, number[]> = {};

  for (const col of headers) {
    let nullCount = 0;
    const nonNullValues: string[] = [];
    const uniqueSet = new Set<string>();
    const numericValues: number[] = [];
    const booleanTokens = new Set(['true', 'false', '0', '1', 'yes', 'no', 'si', 'sí']);
    let booleanCount = 0;

    for (const row of rows) {
      const val = row[col];
      if (isNullValue(val)) {
        nullCount++;
      } else {
        const trimmed = val.trim();
        nonNullValues.push(trimmed);
        uniqueSet.add(trimmed);
        const parsed = Number(trimmed);
        if (trimmed !== '' && Number.isFinite(parsed)) {
          numericValues.push(parsed);
        }
        if (booleanTokens.has(trimmed.toLowerCase())) {
          booleanCount++;
        }
      }
    }

    const isNumeric = nonNullValues.length > 0 && numericValues.length / nonNullValues.length >= 0.85;
    const isBoolean =
      !isNumeric && nonNullValues.length > 0 && booleanCount === nonNullValues.length && uniqueSet.size <= 2;

    if (isNumeric) {
      numericColumns.push(col);
      const sorted = [...numericValues].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const mean = numericValues.reduce((acc, v) => acc + v, 0) / numericValues.length;
      const median = computeMedian(sorted);
      const variance =
        numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / numericValues.length;
      const std = Math.sqrt(variance);

      // Keep aligned numeric vector with NaN for missing
      numericVectors[col] = rows.map((r) => {
        const raw = r[col];
        if (isNullValue(raw)) return Number.NaN;
        const n = Number(raw);
        return Number.isFinite(n) ? n : Number.NaN;
      });

      columns.push({
        name: col,
        inferredType: 'numeric',
        nullCount,
        uniqueCount: uniqueSet.size,
        min,
        max,
        mean,
        median,
        std,
        histogram: buildHistogram(numericValues, 10),
      });
    } else {
      categoricalColumns.push(col);
      const freqMap = new Map<string, number>();
      for (const v of nonNullValues) {
        freqMap.set(v, (freqMap.get(v) ?? 0) + 1);
      }
      const total = nonNullValues.length || 1;
      const topCategories: CategoryFrequency[] = Array.from(freqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([value, count]) => ({
          value,
          count,
          percentage: (count / total) * 100,
        }));

      columns.push({
        name: col,
        inferredType: isBoolean ? 'boolean' : 'categorical',
        nullCount,
        uniqueCount: uniqueSet.size,
        topCategories,
      });
    }
  }

  // Correlation matrix across up to 12 numeric columns
  const corrCols = numericColumns.slice(0, 12);
  const matrix: number[][] = corrCols.map((c1) =>
    corrCols.map((c2) => {
      if (c1 === c2) return 1;
      return computePearson(numericVectors[c1], numericVectors[c2]);
    })
  );

  const correlationMatrix: CorrelationMatrix = {
    columns: corrCols,
    matrix,
  };

  return {
    rowCount,
    colCount,
    duplicateCount,
    numericColumns,
    categoricalColumns,
    columns,
    correlationMatrix,
  };
}

export function suggestDefaultPreprocessing(headers: string[], eda: DatasetEDA): PreprocessingConfig {
  const targetColumn = headers[headers.length - 1] ?? '';
  const targetStats = eda.columns.find((c) => c.name === targetColumn);

  let taskType: TaskType = 'classification';
  if (targetStats && targetStats.inferredType === 'numeric' && targetStats.uniqueCount > 12) {
    taskType = 'regression';
  }

  const featureColumns = headers.filter((h) => h !== targetColumn);

  return {
    droppedColumns: [],
    featureColumns,
    targetColumn,
    taskType,
    missingStrategy: 'mean',
    removeDuplicates: true,
    encoding: 'onehot',
    scaling: 'standard',
    trainRatio: 0.7,
    valRatio: 0.15,
    testRatio: 0.15,
    stratified: taskType === 'classification',
    seed: 42,
  };
}
