import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Save, Trash2, Building2, Loader2, Mail, Phone, Globe, MapPin, FileText
} from 'lucide-react';
import { useCompany, useUpdateCompany, useDeleteCompany } from '@/hooks/useCompanies';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Company } from '@/hooks/useCompanies';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

// ─── Component ───────────────────────────────────────────────────────────────

const EmpresaSingle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setNavigationState, clearNavigationState } = useNavigation();

  const { mutate: updateCompany, isPending } = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hasInitializedForm, setHasInitializedForm] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: empresa, isLoading } = useCompany(id || '');

  // ── Form state ───────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState({
    trade_name: '',
    legal_name: '',
    tax_id: '',
    email: '',
    phone: '',
    website: '',
    address: '',
  });

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Set DashLayout back button
  useEffect(() => {
    if (empresa) {
      setNavigationState({
        showBackButton: true,
        leadName: empresa.trade_name || 'Empresa',
        onBack: () => navigate(-1),
      });
    }
  }, [empresa, navigate, setNavigationState]);

  // Clear on unmount
  useEffect(() => {
    return () => { clearNavigationState(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset form init when id changes
  useEffect(() => { setHasInitializedForm(false); }, [id]);

  // Init form from fetched data
  useEffect(() => {
    if (empresa && !hasInitializedForm) {
      setFormData({
        trade_name: empresa.trade_name || '',
        legal_name: empresa.legal_name || '',
        tax_id: empresa.tax_id || '',
        email: empresa.email || '',
        phone: empresa.phone || '',
        website: empresa.website || '',
        address: empresa.address || '',
      });
      setHasInitializedForm(true);
    }
  }, [empresa, hasInitializedForm]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formData.trade_name.trim() || !id) return;

    updateCompany({
      id,
      trade_name: formData.trade_name,
      legal_name: formData.legal_name || undefined,
      tax_id: formData.tax_id || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      address: formData.address || undefined,
    }, {
      onSuccess: () => {
        toast.success('Empresa atualizada!');
      },
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) {
      return;
    }
    deleteCompany.mutate(id, {
      onSuccess: () => navigate('/crm/clients'),
    });
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (isLoading || (empresa && !hasInitializedForm)) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[13px]">Carregando...</span>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-foreground">Empresa não encontrada</p>
          <p className="text-[12px] text-muted-foreground/60">
            A empresa foi removida ou o link é inválido.
          </p>
          <Button size="sm" onClick={() => navigate('/crm/clients')} className="h-[30px] px-3 text-xs mt-1 rounded-[4px]">
            Voltar para Clientes
          </Button>
        </div>
      </div>
    );
  }

  const initials = getInitials(empresa.trade_name || '');

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-72px)] flex flex-col overflow-hidden">

      {/* ── Top identity bar ──────────────────────────────────────────────── */}
      <div className="flex-none border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

          {/* Avatar + name */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-bold text-primary leading-none">{initials || '?'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground truncate">{empresa.trade_name}</p>
              {empresa.legal_name && (
                <p className="text-[12px] text-muted-foreground/60 truncate">{empresa.legal_name}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              disabled={isPending || deleteCompany.isPending}
              className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive rounded-[4px]"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending || !formData.trade_name.trim()}
              className="h-[30px] px-3 text-xs gap-1.5 rounded-[4px]"
            >
              {isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
              }
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: main fields ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Informações básicas */}
              <section className="border border-border rounded-[4px] bg-card">
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Informações básicas
                  </p>
                </div>
                <div className="p-4 space-y-4">

                  {/* Nome Fantasia */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Nome Fantasia *
                    </Label>
                    <Input
                      value={formData.trade_name}
                      onChange={e => setFormData({ ...formData, trade_name: e.target.value })}
                      placeholder="Nome da empresa"
                      className="h-[30px] text-[13px]"
                    />
                  </div>

                  {/* Razão Social */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Razão Social
                    </Label>
                    <Input
                      value={formData.legal_name}
                      onChange={e => setFormData({ ...formData, legal_name: e.target.value })}
                      placeholder="Razão social completa"
                      className="h-[30px] text-[13px]"
                    />
                  </div>

                  {/* CNPJ */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      CNPJ
                    </Label>
                    <div className="relative">
                      <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                      <Input
                        value={formData.tax_id}
                        onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                        placeholder="00.000.000/0000-00"
                        className="h-[30px] text-[13px] pl-8"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          placeholder="contato@empresa.com"
                          className="h-[30px] text-[13px] pl-8"
                        />
                      </div>
                    </div>

                    {/* Telefone */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                        Telefone
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                        <Input
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(00) 0000-0000"
                          className="h-[30px] text-[13px] pl-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Website */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Website
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                      <Input
                        value={formData.website}
                        onChange={e => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://www.exemplo.com"
                        className="h-[30px] text-[13px] pl-8"
                      />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Endereço
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
                      <Textarea
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Rua, número, complemento, cidade, estado, CEP"
                        rows={2}
                        className="text-[13px] resize-none pl-8"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Right: sidebar ────────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Danger zone */}
              <section className="border border-destructive/20 rounded-[4px] bg-card">
                <div className="px-4 pt-4 pb-3 border-b border-destructive/10">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-destructive/60">
                    Zona de risco
                  </p>
                </div>
                <div className="p-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isPending || deleteCompany.isPending}
                    className="w-full h-[30px] text-xs gap-1.5 border-destructive/30 rounded-[4px] text-destructive hover:bg-destructive/5 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Excluir empresa
                  </Button>
                </div>
              </section>

            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-[4px] p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-destructive" strokeWidth={1.5} />
              </div>
              <h2 className="text-[15px] font-semibold text-foreground">Excluir empresa</h2>
            </div>
            <p className="text-[13px] text-muted-foreground mb-6">
              Tem certeza que deseja excluir <strong>{empresa?.trade_name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteCompany.isPending}
                className="h-[30px] text-[13px]"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteCompany.isPending}
                className="h-8 text-[13px] gap-1.5"
              >
                {deleteCompany.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                )}
                {deleteCompany.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpresaSingle;
