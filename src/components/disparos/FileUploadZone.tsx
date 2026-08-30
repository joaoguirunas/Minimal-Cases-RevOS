import { useRef, useState, useCallback } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParseImportFile } from '@/hooks/useParseImportFile';

interface FileUploadZoneProps {
  onFileParsed: (rows: Record<string, string>[], headers: string[], fileName: string) => void;
  maxRows?: number;
  maxSizeMb?: number;
  compact?: boolean;
}

const ACCEPTED = '.csv,.xlsx,.xls';

export default function FileUploadZone({
  onFileParsed,
  maxRows = 5000,
  maxSizeMb = 5,
  compact = false,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { parseFile, result, isParsing, error, reset } = useParseImportFile(maxRows, maxSizeMb);

  const handleFile = useCallback(async (file: File) => {
    reset();
    await parseFile(file);
  }, [parseFile, reset]);

  // Notify parent once parsed
  const prevResultRef = useRef<typeof result>(null);
  if (result && result !== prevResultRef.current) {
    prevResultRef.current = result;
    onFileParsed(result.rows, result.headers, result.fileName);
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'relative flex items-center justify-center gap-2 rounded-[4px] border-2 border-dashed px-3 py-3 cursor-pointer transition-colors',
            dragging
              ? 'border-primary/60 bg-primary/5'
              : 'border-border hover:border-primary/30 hover:bg-muted/40',
            isParsing && 'pointer-events-none opacity-60',
          )}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onInputChange} className="sr-only" />
          {isParsing ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              <p className="text-[11px] text-muted-foreground">Processando...</p>
            </>
          ) : result ? (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] font-medium text-foreground truncate">
                {result.rows.length.toLocaleString('pt-BR')} contatos carregados
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); prevResultRef.current = null; }}
                className="ml-auto p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Remover arquivo"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <UploadCloud className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] text-muted-foreground">
                Arraste ou <span className="text-primary">selecione</span> o arquivo
              </p>
            </>
          )}
        </div>
        {error && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-[4px] bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={1.5} />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-[4px] border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
          dragging
            ? 'border-primary/60 bg-primary/5'
            : 'border-border hover:border-primary/30 hover:bg-muted/40',
          isParsing && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={onInputChange}
          className="sr-only"
        />

        {isParsing ? (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-[13px] text-muted-foreground">Processando arquivo...</p>
          </>
        ) : result ? (
          <>
            <FileSpreadsheet className="w-8 h-8 text-primary" strokeWidth={1.5} />
            <div className="text-center space-y-0.5">
              <p className="text-[13px] font-medium text-foreground">{result.fileName}</p>
              <p className="text-[12px] text-muted-foreground">
                {result.rows.length.toLocaleString('pt-BR')} linhas · {result.headers.length} colunas
                {result.skippedRows > 0 && (
                  <span className="text-amber-500"> · {result.skippedRows} ignoradas (limite)</span>
                )}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); prevResultRef.current = null; }}
              className="absolute top-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Remover arquivo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="w-8 h-8 text-muted-foreground/50" strokeWidth={1.5} />
            <div className="text-center space-y-1">
              <p className="text-[13px] font-medium text-foreground">
                Arraste o arquivo ou <span className="text-primary">clique para selecionar</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                CSV · XLSX · XLS — máx. {maxSizeMb} MB · {maxRows.toLocaleString('pt-BR')} linhas
              </p>
            </div>
          </>
        )}
      </div>

      {/* Preview — 3 first lines */}
      {result && result.headers.length > 0 && (
        <div className="rounded-[4px] border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Prévia — 3 primeiras linhas
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/30">
                <tr>
                  {result.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-border">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {result.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
                        {row[h] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-[4px] bg-destructive/10 border border-destructive/20 text-[12px] text-destructive">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.5} />
          {error}
        </div>
      )}
    </div>
  );
}
