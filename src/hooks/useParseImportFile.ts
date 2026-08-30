import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParseResult {
  rows: Record<string, string>[];
  headers: string[];
  totalRows: number;
  skippedRows: number;
  fileName: string;
}

const DEFAULT_MAX_ROWS = 5000;
const DEFAULT_MAX_MB   = 5;

export function useParseImportFile(
  maxRows = DEFAULT_MAX_ROWS,
  maxSizeMb = DEFAULT_MAX_MB,
) {
  const [result, setResult]     = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setError(null);

    try {
      const limitBytes = maxSizeMb * 1024 * 1024;
      if (file.size > limitBytes) {
        throw new Error(
          `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${maxSizeMb} MB.`,
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      let allRows: Record<string, string>[] = [];
      let headers: string[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
          transform: (v) => v.trim(),
        });

        if (parsed.errors.length > 0 && allRows.length === 0) {
          throw new Error(`Erro ao ler CSV: ${parsed.errors[0].message}`);
        }

        headers  = parsed.meta.fields ?? [];
        allRows  = parsed.data;

      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer  = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Arquivo Excel sem planilhas.');

        const sheet = workbook.Sheets[sheetName];
        const raw   = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: true, // raw JS values — avoids scientific-notation formatting that truncates phone numbers
        });

        if (raw.length === 0) throw new Error('Planilha vazia.');

        headers = Object.keys(raw[0]).map((h) => h.trim());
        allRows = raw.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => {
              let strVal: string;
              if (typeof v === 'number') {
                // Use toFixed(0) for integers to avoid "5.54E+12" → "55412" truncation
                strVal = Number.isInteger(v) ? v.toFixed(0) : String(v);
              } else {
                strVal = String(v ?? '');
              }
              return [k.trim(), strVal.trim()];
            }),
          ),
        );

      } else {
        throw new Error('Formato não suportado. Use .csv, .xlsx ou .xls');
      }

      const totalRows  = allRows.length;
      const trimmed    = allRows.slice(0, maxRows);
      const skipped    = totalRows - trimmed.length;

      setResult({
        rows: trimmed,
        headers,
        totalRows,
        skippedRows: skipped,
        fileName: file.name,
      });
    } catch (e) {
      setError((e as Error).message ?? 'Erro desconhecido ao processar arquivo.');
    } finally {
      setIsParsing(false);
    }
  }, [maxRows, maxSizeMb]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { parseFile, result, isParsing, error, reset };
}
