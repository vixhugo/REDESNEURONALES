# NeuroLab Studio

Plataforma web 100% frontend para el diseño tridimensional, análisis exploratorio de datos, entrenamiento real con TensorFlow.js, evaluación y documentación de redes neuronales directamente en el navegador.

## Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Zustand, React Router
- **Visualización 3D**: Three.js, React Three Fiber, Drei (`InstancedMesh` y `LineSegments`)
- **Inteligencia Artificial**: TensorFlow.js (`@tensorflow/tfjs`, `@tensorflow/tfjs-vis`)
- **Procesamiento de Datos y Gráficos**: Papa Parse, motor EDA/Preprocesamiento en TypeScript, Recharts
- **Almacenamiento Local**: LocalStorage + IndexedDB (`idb` + almacenamiento nativo TF.js)
- **Exportación**: jsPDF, html2canvas, JSON de proyectos y pesos TF.js

## Módulos Implementados

1. **M01 — Dashboard Principal**: KPIs reales desde IndexedDB, últimos proyectos, actividad reciente, estado real del backend TensorFlow.js y uso de almacenamiento.
2. **M02 — Gestión de Proyectos y Workspace**: Creación, edición, eliminación, búsqueda, filtrado, espacio de trabajo por proyecto y exportación/importación de proyectos en JSON.
3. **M03 — Fundamentos Neurorales**: Explicaciones conceptuales y simulador interactivo en tiempo real de neurona artificial y funciones de activación (ReLU, Sigmoid, Softmax, Tanh).
4. **M04 — Diseñador Tridimensional de Redes Neuronales**: Escena 3D interactiva con esferas instanciadas, conexiones ponderadas, controles de cámara (frontal, lateral, superior, enfocar capa/neurona, restablecer), constructor de capas, inspector de neuronas/conexiones/capas, inicialización de pesos TF.js y animación de propagación hacia adelante con cálculos reales.
5. **M05 — Gestión y Análisis de Datasets**: Importación CSV (drag & drop / selector), análisis exploratorio automático (EDA), histogramas, barras, gráficos circulares, dispersión, matriz de correlación de Pearson, limpieza no destructiva, codificación, escalado ajustado solo sobre Train y división reproducible/estratificada Train/Validation/Test.
6. **M06 — Entrenamiento de Redes Neuronales**: Construcción y entrenamiento real de redes Feedforward (MLP) con Adam/SGD/RMSprop, seguimiento por época, cancelación y gestión de tensores (`dispose`).
7. **M07 — Evaluación y Métricas**: Evaluación real sobre Test (Accuracy, Precision, Recall, F1, Loss, Matriz de confusión, métricas de regresión MAE/RMSE/R²), comparación de experimentos e inspección de pesos/sesgos aprendidos.
8. **M08 — Model Registry**: Almacenamiento persistente en IndexedDB de modelos TensorFlow.js, versionado, inferencia en vivo y descarga de archivos `model.json` + `.weights.bin`.
9. **M09 — Reportes y Documentación**: Generación local de informes PDF completos con captura 3D y gráficos, además de exportación CSV.
10. **M10 — Configuración y Preferencias**: Tema claro/oscuro, preferencias 3D, selector de backend TF.js y control de almacenamiento local.

## Scripts de Desarrollo

```bash
npm install
npm run dev
npm run build
npm test
```
