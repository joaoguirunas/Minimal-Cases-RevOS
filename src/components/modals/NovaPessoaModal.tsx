import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, ChevronsUpDown, X, User, Plus } from 'lucide-react';
import { useCriarPessoa } from '@/hooks/useCriarPessoa';
import { usePipelines } from '@/hooks/usePipelines';
import { useTeams } from '@/hooks/useTeamsNew';
import { useCompanies, useCreateCompany } from '@/hooks/useCompanies';
import { useUpdatePeopleCompanies } from '@/hooks/usePeopleCompanies';
import { cn } from '@/lib/utils';
import { formatPhoneForDatabase } from '@/utils/phoneUtils';
import WhatsAppInput from '@/components/common/WhatsAppInput';
import { MergeContactModal } from '@/components/modals/MergeContactModal';
import { useCheckDuplicate, DuplicatePerson } from '@/hooks/useCheckDuplicate';

interface NovaPessoaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  tenantId?: string;
}

const EMPTY_FORM = {
  nome: '',
  email: '',
  whatsapp: '',
  documento: '',
  observacoes: '',
  pipeline_id: '',
  team_id: '',
};

export const NovaPessoaModal = ({ open, onOpenChange, onClose }: NovaPessoaModalProps) => {
  const { mutateAsync: criarPessoa, isPending } = useCriarPessoa();
  const { pipelines: allPipelines, isLoading: isLoadingPipelines } = usePipelines();
  const { data: teams = [], isLoading: isLoadingTeams } = useTeams();
  const { data: companies = [], isLoading: isLoadingCompanies } = useCompanies();
  const updatePeopleCompanies = useUpdatePeopleCompanies();
  const criarEmpresa = useCreateCompany();

  const pipelines = allPipelines.filter(p => p.active || p.ativo);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companiesPopoverOpen, setCompaniesPopoverOpen] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [duplicateContact, setDuplicateContact] = useState<DuplicatePerson | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const { check: checkDuplicate } = useCheckDuplicate();

  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM);
      setSelectedCompanyIds([]);
      setCompanySearchTerm('');
      setDuplicateContact(null);
    }
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(prev => ({ ...prev, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    const whatsappDb = formData.whatsapp ? formatPhoneForDatabase(formData.whatsapp) : undefined;

    setCheckingDuplicate(true);
    try {
      const dup = await checkDuplicate({
        whatsapp: whatsappDb || null,
        email: formData.email || null,
      });
      if (dup) {
        setDuplicateContact(dup);
        return;
      }
    } finally {
      setCheckingDuplicate(false);
    }

    await doCreate(whatsappDb);
  };

  const doCreate = async (whatsappDb?: string) => {
    try {
      const result = await criarPessoa({
        nome: formData.nome,
        email: formData.email || undefined,
        whatsapp: whatsappDb,
        documento: formData.documento || undefined,
        observacoes: formData.observacoes || undefined,
        pipeline_id: formData.pipeline_id || undefined,
        team_id: formData.team_id || undefined,
      });

      if (selectedCompanyIds.length > 0 && result?.pessoa?.id) {
        updatePeopleCompanies.mutate({
          peopleId: result.pessoa.id,
          companyIds: selectedCompanyIds,
        });
      }

      handleClose();
    } catch {
      // hook exibe o toast de erro
    }
  };

  const selectedCompanies = companies.filter(c => selectedCompanyIds.includes(c.id));

  const toggleCompany = (id: string) =>
    setSelectedCompanyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const trimmedCompanySearch = companySearchTerm.trim();
  const companySearchMatchesExisting = companies.some(
    c => c.trade_name.trim().toLowerCase() === trimmedCompanySearch.toLowerCase()
  );

  const handleCreateCompany = async () => {
    if (!trimmedCompanySearch || companySearchMatchesExisting) return;
    const novaEmpresa = await criarEmpresa.mutateAsync({ trade_name: trimmedCompanySearch });
    setSelectedCompanyIds(prev => [...prev, novaEmpresa.id]);
    setCompanySearchTerm('');
  };

  const isSubmitting = isPending || checkingDuplicate;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-[4px] bg-primary/10">
                <User className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
              </div>
              <DialogTitle className="text-[15px] font-semibold">Nova Pessoa</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-1">

            {/* ── Dados principais ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Dados de contato
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-[12px] text-muted-foreground">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  {...field('nome')}
                  placeholder="Nome completo"
                  className="h-8 text-[13px]"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[12px] text-muted-foreground">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    {...field('email')}
                    placeholder="email@exemplo.com"
                    className="h-8 text-[13px]"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">WhatsApp</Label>
                  <WhatsAppInput
                    value={formData.whatsapp}
                    onChange={(_display, db) => setFormData(prev => ({ ...prev, whatsapp: db }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="documento" className="text-[12px] text-muted-foreground">CPF / CNPJ</Label>
                <Input
                  id="documento"
                  {...field('documento')}
                  placeholder="000.000.000-00"
                  className="h-8 text-[13px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* ── Empresa ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Empresa
              </p>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Vincular empresa(s)</Label>
                <Popover open={companiesPopoverOpen} onOpenChange={setCompaniesPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full h-8 justify-between text-[13px] font-normal"
                      disabled={isLoadingCompanies || isSubmitting}
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {selectedCompanyIds.length === 0
                          ? 'Selecionar empresa...'
                          : `${selectedCompanyIds.length} selecionada${selectedCompanyIds.length > 1 ? 's' : ''}`}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" strokeWidth={1.5} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar ou criar empresa..."
                        className="text-[13px]"
                        value={companySearchTerm}
                        onValueChange={setCompanySearchTerm}
                      />
                      <CommandList>
                        {(() => {
                          const filtered = trimmedCompanySearch
                            ? companies.filter(c =>
                                c.trade_name.toLowerCase().includes(trimmedCompanySearch.toLowerCase())
                              )
                            : companies;
                          return (
                            <>
                              {filtered.length === 0 && !trimmedCompanySearch && (
                                <CommandEmpty className="text-[13px] py-4 text-center text-muted-foreground">
                                  Nenhuma empresa encontrada.
                                </CommandEmpty>
                              )}
                              <CommandGroup>
                                {filtered.map(company => (
                                  <CommandItem
                                    key={company.id}
                                    value={company.id}
                                    onSelect={() => toggleCompany(company.id)}
                                    className="text-[13px]"
                                  >
                                    <Check
                                      className={cn('mr-2 h-3.5 w-3.5', selectedCompanyIds.includes(company.id) ? 'opacity-100' : 'opacity-0')}
                                      strokeWidth={1.5}
                                    />
                                    <div>
                                      <p className="font-medium">{company.trade_name}</p>
                                      {company.legal_name && (
                                        <p className="text-[11px] text-muted-foreground">{company.legal_name}</p>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                                {trimmedCompanySearch && !companySearchMatchesExisting && (
                                  <CommandItem
                                    value={`__criar__${trimmedCompanySearch}`}
                                    onSelect={handleCreateCompany}
                                    disabled={criarEmpresa.isPending}
                                    className="text-[13px] text-primary"
                                  >
                                    <Plus className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                                    {criarEmpresa.isPending
                                      ? 'Criando...'
                                      : `Criar empresa "${trimmedCompanySearch}"`}
                                  </CommandItem>
                                )}
                              </CommandGroup>
                            </>
                          );
                        })()}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedCompanies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedCompanies.map(company => (
                      <Badge key={company.id} variant="secondary" className="text-[12px] gap-1 pl-1.5 pr-1">
                        <Building2 className="h-3 w-3" strokeWidth={1.5} />
                        {company.trade_name}
                        <button
                          type="button"
                          onClick={() => toggleCompany(company.id)}
                          className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                        >
                          <X className="h-2.5 w-2.5" strokeWidth={1.5} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Pipeline ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pipeline <span className="text-muted-foreground/30 normal-case font-normal tracking-normal">(opcional)</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pipeline" className="text-[12px] text-muted-foreground">Pipeline</Label>
                  <Select
                    value={formData.pipeline_id}
                    onValueChange={v => setFormData(prev => ({ ...prev, pipeline_id: v, team_id: '' }))}
                    disabled={isLoadingPipelines || isSubmitting}
                  >
                    <SelectTrigger id="pipeline" className="h-8 text-[13px]">
                      <SelectValue placeholder={isLoadingPipelines ? 'Carregando...' : 'Selecionar...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[13px]">
                          {p.name || p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="team" className="text-[12px] text-muted-foreground">Time de atendimento</Label>
                  <Select
                    value={formData.team_id}
                    onValueChange={v => setFormData(prev => ({ ...prev, team_id: v }))}
                    disabled={isLoadingTeams || isSubmitting}
                  >
                    <SelectTrigger id="team" className="h-8 text-[13px]">
                      <SelectValue placeholder={isLoadingTeams ? 'Carregando...' : 'Selecionar...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-[13px]">
                          {t.nome || t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Observações ── */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-[12px] text-muted-foreground">Observações</Label>
              <RichTextEditor
                content={formData.observacoes}
                onChange={(html) => setFormData(prev => ({ ...prev, observacoes: html }))}
                placeholder="Informações adicionais..."
                minHeight="120px"
              />
            </div>

            {/* ── Ações ── */}
            <div className="flex justify-end gap-2 pt-1 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-[13px]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-[13px]"
                disabled={isSubmitting || !formData.nome.trim()}
              >
                {checkingDuplicate ? 'Verificando...' : isPending ? 'Criando...' : 'Criar pessoa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {duplicateContact && (
        <MergeContactModal
          open={!!duplicateContact}
          onOpenChange={o => { if (!o) setDuplicateContact(null); }}
          current={{
            name: formData.nome,
            whatsapp: formData.whatsapp ? formatPhoneForDatabase(formData.whatsapp) : undefined,
            email: formData.email || undefined,
          }}
          duplicate={duplicateContact}
          conflictField={duplicateContact.whatsapp && formData.whatsapp ? 'whatsapp' : 'email'}
          onConfirmMerge={async () => {
            setDuplicateContact(null);
            await doCreate(formData.whatsapp ? formatPhoneForDatabase(formData.whatsapp) : undefined);
          }}
          onCancel={() => setDuplicateContact(null)}
          isLoading={isPending}
        />
      )}
    </>
  );
};

export default NovaPessoaModal;
