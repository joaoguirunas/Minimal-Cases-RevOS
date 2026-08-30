import type { FieldMappingConfig } from '@/hooks/useImportarLista';

const COMPANY_STRUCT_LABELS: Record<string, string> = {
  trade_name: 'Nome Fantasia',
  legal_name: 'Razão Social',
  tax_id:     'CNPJ / Tax ID',
  address:    'Endereço',
  website:    'Website',
  email:      'E-mail Empresa',
  phone:      'Telefone Empresa',
};

interface ImportPreviewTableProps {
  rows: Record<string, string>[];
  mapping: FieldMappingConfig;
  maxPreview?: number;
}

export default function ImportPreviewTable({
  rows,
  mapping,
  maxPreview = 10,
}: ImportPreviewTableProps) {
  const preview = rows.slice(0, maxPreview);

  if (preview.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground/40 text-center py-6">
        Nenhuma linha para exibir.
      </p>
    );
  }

  const mappedQFields = Object.keys(mapping.q_field ?? {});
  const mappedCompanyFields = Object.keys(mapping.company_struct ?? {});

  return (
    <div className="rounded-[4px] border border-border overflow-hidden">
      <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Prévia — {maxPreview} primeiras linhas
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          Total: {rows.length.toLocaleString('pt-BR')} linhas
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                Nome
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                Contato
              </th>
              {mappedQFields.map((qKey) => (
                <th key={qKey} className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                  {qKey}
                </th>
              ))}
              {mappedCompanyFields.map((compKey) => (
                <th key={compKey} className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                  {COMPANY_STRUCT_LABELS[compKey] ?? compKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => {
              const name    = mapping.name    ? row[mapping.name]    ?? '' : '';
              const contact = mapping.whatsapp
                ? row[mapping.whatsapp] ?? ''
                : mapping.email
                  ? row[mapping.email] ?? ''
                  : '';

              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground whitespace-nowrap max-w-[200px] truncate">
                    {name || <span className="text-muted-foreground/40 italic">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                    {contact || <span className="text-muted-foreground/40 italic">—</span>}
                  </td>
                  {mappedQFields.map((qKey) => {
                    const csvHeader = mapping.q_field?.[qKey];
                    const val = csvHeader ? row[csvHeader] ?? '' : '';
                    return (
                      <td key={qKey} className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                        {val || <span className="text-muted-foreground/40 italic">—</span>}
                      </td>
                    );
                  })}
                  {mappedCompanyFields.map((compKey) => {
                    const csvHeader = mapping.company_struct?.[compKey];
                    const val = csvHeader ? row[csvHeader] ?? '' : '';
                    return (
                      <td key={compKey} className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                        {val || <span className="text-muted-foreground/40 italic">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
