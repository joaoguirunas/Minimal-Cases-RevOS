import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  User, Building2, Plus, Phone, Mail, Briefcase, MoreVertical, Archive,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePessoasPaginadas } from '@/hooks/usePessoasPaginadas';
import { useCompaniesPaginated } from '@/hooks/useCompaniesPaginated';
import { useArquivarPessoa } from '@/hooks/useArquivarPessoa';
import NovaPessoaModal from '@/components/modals/NovaPessoaModal';
import EditarPessoaModal from '@/components/modals/EditarPessoaModal';
import NovaEmpresaModal from '@/components/modals/NovaEmpresaModal';
import { cn } from '@/lib/utils';

interface MobileClientesTabsProps {
  searchTerm: string;
  showArquivados?: boolean;
}

const PER_PAGE = 20;

// ─── Pessoa Detail Sheet ────────────────────────────────────────────
const PessoaDetailSheet = ({
  pessoa,
  open,
  onOpenChange,
  leadCount,
}: {
  pessoa: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadCount: number;
}) => {
  const [editOpen, setEditOpen] = useState(false);

  if (!pessoa) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-[12px] px-4 pb-8">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-base">Detalhe do Contacto</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto mt-4 space-y-5">
            {/* Avatar + Nome */}
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {(pessoa.nome || pessoa.name || '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{pessoa.nome || pessoa.name}</p>
                {pessoa.empresa?.trade_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {pessoa.empresa.trade_name}
                  </p>
                )}
              </div>
            </div>

            {/* Contactos */}
            <div className="space-y-2">
              {pessoa.whatsapp && (
                <div className="flex items-center gap-2 p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{pessoa.whatsapp}</span>
                </div>
              )}
              {pessoa.email && (
                <div className="flex items-center gap-2 p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{pessoa.email}</span>
                </div>
              )}
            </div>

            {/* Negócios vinculados */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Negócios vinculados
              </label>
              <div className="p-2.5 rounded-[4px] border border-border bg-card min-h-[44px] text-sm flex items-center">
                {leadCount > 0
                  ? `${leadCount} negócio${leadCount > 1 ? 's' : ''}`
                  : 'Nenhum negócio vinculado'}
              </div>
            </div>

            {/* Ações */}
            <Button
              className="w-full min-h-[44px]"
              onClick={() => setEditOpen(true)}
            >
              Editar Contacto
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <EditarPessoaModal
        open={editOpen}
        onOpenChange={setEditOpen}
        pessoa={pessoa}
      />
    </>
  );
};

// ─── Pessoas List ───────────────────────────────────────────────────
const PessoasList = ({ searchTerm, showArquivados }: { searchTerm: string; showArquivados?: boolean }) => {
  
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPessoa, setSelectedPessoa] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const arquivar = useArquivarPessoa();
  const observerRef = useRef<HTMLDivElement | null>(null);

  const { pessoas = [], leadCounts = {}, pagination, isLoading } = usePessoasPaginadas(
    'single-tenant' || '',
    page,
    PER_PAGE,
    searchTerm || undefined,
    showArquivados,
  );

  // Reset page on search/filter change
  useEffect(() => { setPage(1); }, [searchTerm, showArquivados]);

  // Infinite scroll
  const hasMore = pagination ? page < pagination.totalPages : false;
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) setPage((p) => p + 1);
  }, [hasMore, isLoading]);

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleOpenDetail = (pessoa: any) => {
    setSelectedPessoa(pessoa);
    setDetailOpen(true);
  };

  if (isLoading && pessoas.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {pessoas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <User className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{showArquivados ? 'Nenhum cliente arquivado' : 'Nenhum cliente encontrado'}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {pessoas.map((pessoa: any) => (
            <div
              key={pessoa.id}
              className="px-4 py-3 flex items-center gap-3 min-h-[44px] active:bg-muted"
              onClick={() => handleOpenDetail(pessoa)}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {(pessoa.nome || pessoa.name || '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{pessoa.nome || pessoa.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {pessoa.whatsapp && (
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{pessoa.whatsapp}</span>
                  )}
                  {pessoa.email && (
                    <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{pessoa.email}</span>
                  )}
                </div>
              </div>
              {/* Menu contextual */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 min-h-[44px] min-w-[44px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      arquivar.mutate(pessoa.id);
                    }}
                    className="text-destructive"
                  >
                    <Archive className="h-4 w-4 mr-2" /> Arquivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {/* Infinite scroll sentinel */}
          {hasMore && <div ref={observerRef} className="h-10" />}
        </div>
      )}

      {/* FAB Criar */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full"
        onClick={() => setShowCreate(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NovaPessoaModal
        open={showCreate}
        onOpenChange={setShowCreate}
        tenantId={'single-tenant' || ''}
      />

      <PessoaDetailSheet
        pessoa={selectedPessoa}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        leadCount={selectedPessoa ? (leadCounts[selectedPessoa.id] || 0) : 0}
      />
    </>
  );
};

// ─── Empresas List ──────────────────────────────────────────────────
const EmpresasList = ({ searchTerm }: { searchTerm: string }) => {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const { empresas = [], pagination, isLoading } = useCompaniesPaginated(
    page,
    PER_PAGE,
    searchTerm || undefined,
  );

  useEffect(() => { setPage(1); }, [searchTerm]);

  const hasMore = pagination ? page < pagination.totalPages : false;
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) setPage((p) => p + 1);
  }, [hasMore, isLoading]);

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (isLoading && empresas.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-[4px]" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {empresas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {empresas.map((empresa: any) => (
            <div key={empresa.id} className="px-4 py-3 flex items-center gap-3 min-h-[44px]">
              <div className="h-10 w-10 rounded-[4px] bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{empresa.trade_name || empresa.nome}</p>
                {empresa.cnpj && (
                  <p className="text-xs text-muted-foreground">{empresa.cnpj}</p>
                )}
              </div>
            </div>
          ))}
          {hasMore && <div ref={observerRef} className="h-10" />}
        </div>
      )}

      {/* FAB Criar Empresa */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full"
        onClick={() => setShowCreate(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NovaEmpresaModal
        open={showCreate}
        onOpenChange={setShowCreate}
      />
    </>
  );
};

// ─── Main Tabs Component ────────────────────────────────────────────
export const MobileClientesTabs = ({ searchTerm, showArquivados }: MobileClientesTabsProps) => {
  return (
    <Tabs defaultValue="pessoas" className="flex-1 flex flex-col">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 gap-1">
        <TabsTrigger value="pessoas" className="gap-1.5 min-h-[44px] text-xs">
          <User className="h-3.5 w-3.5" />
          Pessoas
        </TabsTrigger>
        <TabsTrigger value="empresas" className="gap-1.5 min-h-[44px] text-xs">
          <Building2 className="h-3.5 w-3.5" />
          Empresas
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto">
        <TabsContent value="pessoas" className="mt-0">
          <PessoasList searchTerm={searchTerm} showArquivados={showArquivados} />
        </TabsContent>

        <TabsContent value="empresas" className="mt-0">
          <EmpresasList searchTerm={searchTerm} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
