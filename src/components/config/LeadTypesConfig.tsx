import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Check, X, Tag } from 'lucide-react';
import { useLeadTypes, type LeadType, type LeadTypeInput } from '@/hooks/useLeadTypes';
import { useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';
import { WhatsappTemplatePicker } from './WhatsappTemplatePicker';
import { toast } from 'sonner';

function headersToString(headers: string[]): string {
  return headers.join(', ');
}

function stringToHeaders(s: string): string[] {
  return s.split(',').map((h) => h.trim()).filter(Boolean);
}

interface EditState {
  name: string;
  description: string;
  csv_headers: string;
  whatsapp_template_id: string | null;
}

const EMPTY_EDIT: EditState = { name: '', description: '', csv_headers: 'nome, whatsapp', whatsapp_template_id: null };

export default function LeadTypesConfig() {
  const { leadTypes, isLoading, addLeadType, updateLeadType, deleteLeadType, isMutating } =
    useLeadTypes(false);
  const { data: templates = [] } = useWhatsappTemplates();
  const activeTemplates = templates.filter((t) => t.system_enabled !== false);

  const [form, setForm] = useState<EditState>(EMPTY_EDIT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome do tipo'); return; }
    const headers = stringToHeaders(form.csv_headers);
    if (headers.length === 0) { toast.error('Informe ao menos uma coluna'); return; }
    const input: LeadTypeInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      csv_headers: headers,
      sort_order: leadTypes.length,
      whatsapp_template_id: form.whatsapp_template_id ?? null,
    };
    try {
      await addLeadType(input);
      setForm(EMPTY_EDIT);
      toast.success('Tipo adicionado');
    } catch {
      // error toast handled by hook
    }
  };

  const startEdit = (tipo: LeadType) => {
    setEditingId(tipo.id);
    setEditState({
      name: tipo.name,
      description: tipo.description,
      csv_headers: headersToString(tipo.csv_headers),
      whatsapp_template_id: tipo.whatsapp_template_id,
    });
  };

  const handleSaveEdit = async () => {
    if (!editState.name.trim()) { toast.error('Informe o nome do tipo'); return; }
    const headers = stringToHeaders(editState.csv_headers);
    if (headers.length === 0) { toast.error('Informe ao menos uma coluna'); return; }
    try {
      await updateLeadType(editingId!, {
        name: editState.name.trim(),
        description: editState.description.trim(),
        csv_headers: headers,
        whatsapp_template_id: editState.whatsapp_template_id ?? null,
      });
      setEditingId(null);
      toast.success('Tipo atualizado');
    } catch {
      // error toast handled by hook
    }
  };

  const handleToggleActive = async (tipo: LeadType) => {
    try {
      await updateLeadType(tipo.id, { is_active: !tipo.is_active } as never);
    } catch {
      // error toast handled by hook
    }
  };

  const handleDelete = async (tipo: LeadType) => {
    if (!confirm(`Remover tipo "${tipo.name}"? Dados históricos não serão afetados.`)) return;
    try {
      await deleteLeadType(tipo.id);
      toast.success('Tipo removido');
    } catch {
      // error toast handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-[2px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          Tipos de Lista
        </h1>
        <p className="text-[13px] text-muted-foreground/70 mt-0.5">
          Defina os tipos de lead usados na importação de planilhas, com seus respectivos campos CSV.
        </p>
      </div>

      {/* Add form */}
      <div className="border border-border rounded-[2px] p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          Novo tipo
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ex: Captação Digital"
              className="h-[30px] text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Curta descrição do tipo"
              className="h-[30px] text-[13px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">
              Colunas CSV <span className="text-muted-foreground/50">(separadas por vírgula)</span>
            </Label>
            <Input
              value={form.csv_headers}
              onChange={(e) => setForm((f) => ({ ...f, csv_headers: e.target.value }))}
              placeholder="nome, whatsapp, origem"
              className="h-[30px] text-[13px] font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">Template WhatsApp</Label>
            <WhatsappTemplatePicker
              templates={activeTemplates}
              value={form.whatsapp_template_id}
              onChange={(id) => setForm((f) => ({ ...f, whatsapp_template_id: id }))}
              triggerClassName="w-full"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!form.name.trim() || isMutating}
          className="h-[30px] text-xs gap-1.5 rounded-[4px]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Adicionar tipo
        </Button>
      </div>

      {/* List */}
      {leadTypes.length === 0 ? (
        <div className="border border-border rounded-[2px] p-8 text-center">
          <p className="text-[13px] text-muted-foreground/50">Nenhum tipo cadastrado</p>
        </div>
      ) : (
        <div className="border border-border rounded-[2px] overflow-hidden">
          {leadTypes.map((tipo, index) => (
            <div
              key={tipo.id}
              className={cn(
                'px-4 py-3 hover:bg-muted/40 transition-colors',
                index < leadTypes.length - 1 && 'border-b border-border',
              )}
            >
              {editingId === tipo.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={editState.name}
                      onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      placeholder="Nome"
                      className="h-[28px] text-[12px]"
                      autoFocus
                    />
                    <Input
                      value={editState.description}
                      onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                      placeholder="Descrição"
                      className="h-[28px] text-[12px]"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={editState.csv_headers}
                      onChange={(e) => setEditState((s) => ({ ...s, csv_headers: e.target.value }))}
                      placeholder="nome, whatsapp"
                      className="h-[28px] text-[12px] font-mono flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <WhatsappTemplatePicker
                      templates={activeTemplates}
                      value={editState.whatsapp_template_id}
                      onChange={(id) => setEditState((s) => ({ ...s, whatsapp_template_id: id }))}
                      triggerClassName="w-[160px] shrink-0"
                    />
                    <Button variant="ghost" size="sm" onClick={handleSaveEdit} disabled={isMutating}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/60 hover:text-foreground shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/60 hover:text-foreground shrink-0">
                      <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-tight truncate">{tipo.name}</p>
                    {tipo.description && (
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                        {tipo.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 truncate">
                      {tipo.csv_headers.join(', ')}
                    </p>
                    {tipo.whatsapp_template_id && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                        WA: {activeTemplates.find((t) => t.id === tipo.whatsapp_template_id)?.nome ?? tipo.whatsapp_template_id}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={tipo.is_active}
                      onCheckedChange={() => handleToggleActive(tipo)}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="sm" onClick={() => startEdit(tipo)}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/50 hover:text-foreground">
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tipo)}
                      className="h-[28px] w-[28px] p-0 text-muted-foreground/50 hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
