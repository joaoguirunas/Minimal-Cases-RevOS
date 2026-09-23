// src/components/bi/DataTable.tsx
import { useMemo, useState } from 'react';
import { toCsv, downloadCsv } from './csv';
export interface Col<T> { key: keyof T & string; label: string; format?: (v: any, row: T) => string; align?: 'left' | 'right' }
export function DataTable<T extends Record<string, any>>({ rows, columns, csvName, onRowClick, empty = 'Sem dados no período.' }: { rows: T[]; columns: Col<T>[]; csvName?: string; onRowClick?: (r: T) => void; empty?: string }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
  }, [rows, sort]);
  if (rows.length === 0) return <p className="text-[12px] text-muted-foreground py-6 text-center">{empty}</p>;
  return (
    <div className="space-y-2">
      {csvName && (
        <div className="flex justify-end">
          <button className="text-[12px] text-primary underline-offset-4 hover:underline" onClick={() => downloadCsv(csvName, toCsv(sorted, columns.map((c) => ({ key: c.key, label: c.label }))))}>Exportar CSV</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className={`py-2 px-2 font-medium text-muted-foreground cursor-pointer select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === -1 ? 1 : -1 }))}>
                {c.label}{sort?.key === c.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
              </th>))}
          </tr></thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className={`border-b border-border/40 ${onRowClick ? 'cursor-pointer hover:bg-muted/40' : ''}`} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 px-2 tabular-nums ${c.align === 'right' ? 'text-right' : ''}`}>{c.format ? c.format(r[c.key], r) : String(r[c.key] ?? '—')}</td>))}
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
