import Papa from 'papaparse';

export interface ParsedCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  errors: string[];
}

export function parseCSVString(csvText: string): ParsedCSVResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return {
      headers: [],
      rows: [],
      delimiter: ',',
      errors: ['El archivo CSV está vacío.'],
    };
  }

  const result = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
  const errors: string[] = [];

  if (headers.length === 0) {
    errors.push('No se encontraron encabezados válidos en el CSV.');
  }

  if (result.errors && result.errors.length > 0) {
    const firstErrors = result.errors.slice(0, 5).map((e) => `Fila ${e.row ?? '?'}: ${e.message}`);
    errors.push(...firstErrors);
  }

  const rows: Record<string, string>[] = result.data.map((row) => {
    const cleanRow: Record<string, string> = {};
    for (const h of headers) {
      const raw = row[h];
      cleanRow[h] = raw === undefined || raw === null ? '' : String(raw).trim();
    }
    return cleanRow;
  });

  if (rows.length === 0) {
    errors.push('El archivo CSV no contiene registros de datos.');
  }

  return {
    headers,
    rows,
    delimiter: result.meta.delimiter || ',',
    errors,
  };
}

export function parseCSVFile(file: File): Promise<ParsedCSVResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      resolve(parseCSVString(content));
    };
    reader.onerror = () => {
      resolve({
        headers: [],
        rows: [],
        delimiter: ',',
        errors: [`No se pudo leer el archivo ${file.name}.`],
      });
    };
    reader.readAsText(file);
  });
}
