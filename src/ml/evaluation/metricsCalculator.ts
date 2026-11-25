import type { ClassMetric, EvaluationResult, SamplePrediction, TaskType } from '../../types';

export function computeClassificationEvaluation(
  yTrueOneHot: number[][],
  yPredProbs: number[][],
  classLabels: string[],
  testLoss: number
): EvaluationResult {
  const numClasses = classLabels.length;
  const cm: number[][] = Array.from({ length: numClasses }, () => new Array<number>(numClasses).fill(0));
  const samplePredictions: SamplePrediction[] = [];

  let correct = 0;
  for (let i = 0; i < yTrueOneHot.length; i++) {
    const trueRow = yTrueOneHot[i];
    const predRow = yPredProbs[i];

    let trueIdx = 0;
    let trueMax = -Infinity;
    for (let c = 0; c < trueRow.length; c++) {
      if (trueRow[c] > trueMax) {
        trueMax = trueRow[c];
        trueIdx = c;
      }
    }

    let predIdx = 0;
    let predMax = -Infinity;
    for (let c = 0; c < predRow.length; c++) {
      if (predRow[c] > predMax) {
        predMax = predRow[c];
        predIdx = c;
      }
    }

    if (trueIdx < numClasses && predIdx < numClasses) {
      cm[trueIdx][predIdx]++;
    }
    const isCorrect = trueIdx === predIdx;
    if (isCorrect) correct++;

    if (i < 30) {
      samplePredictions.push({
        index: i + 1,
        actual: classLabels[trueIdx] ?? String(trueIdx),
        predicted: classLabels[predIdx] ?? String(predIdx),
        confidence: predMax,
        correct: isCorrect,
      });
    }
  }

  const perClassMetrics: ClassMetric[] = [];
  let sumP = 0;
  let sumR = 0;
  let sumF1 = 0;

  for (let c = 0; c < numClasses; c++) {
    const tp = cm[c][c];
    let fp = 0;
    let fn = 0;
    let support = 0;
    for (let r = 0; r < numClasses; r++) {
      support += cm[c][r];
      if (r !== c) {
        fp += cm[r][c];
        fn += cm[c][r];
      }
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    sumP += precision;
    sumR += recall;
    sumF1 += f1;

    perClassMetrics.push({
      label: classLabels[c],
      precision,
      recall,
      f1,
      support,
    });
  }

  const total = yTrueOneHot.length || 1;
  return {
    taskType: 'classification',
    testLoss,
    sampleCount: yTrueOneHot.length,
    accuracy: correct / total,
    precisionMacro: sumP / numClasses,
    recallMacro: sumR / numClasses,
    f1Macro: sumF1 / numClasses,
    confusionMatrix: cm,
    classLabels,
    perClassMetrics,
    samplePredictions,
  };
}

export function computeRegressionEvaluation(
  yTrue: number[][],
  yPred: number[][],
  testLoss: number
): EvaluationResult {
  const n = yTrue.length || 1;
  const actuals = yTrue.map((r) => r[0]);
  const preds = yPred.map((r) => r[0]);

  let sumAbsErr = 0;
  let sumSqErr = 0;
  const meanActual = actuals.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;

  const samplePredictions: SamplePrediction[] = [];
  for (let i = 0; i < actuals.length; i++) {
    const err = preds[i] - actuals[i];
    sumAbsErr += Math.abs(err);
    sumSqErr += err * err;
    ssTot += Math.pow(actuals[i] - meanActual, 2);

    if (i < 30) {
      samplePredictions.push({
        index: i + 1,
        actual: actuals[i].toFixed(4),
        predicted: preds[i].toFixed(4),
      });
    }
  }

  const mae = sumAbsErr / n;
  const rmse = Math.sqrt(sumSqErr / n);
  const r2 = ssTot > 0 ? 1 - sumSqErr / ssTot : 0;

  return {
    taskType: 'regression' as TaskType,
    testLoss,
    sampleCount: actuals.length,
    mae,
    rmse,
    r2,
    samplePredictions,
  };
}
