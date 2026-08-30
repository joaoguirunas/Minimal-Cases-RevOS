import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Archive,
  RefreshCw,
  Users,
  Loader2,
  Target,
  LayoutGrid,
  List,
  Briefcase,
  Filter,
} from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Hooks
import { usePessoasPaginadas, PessoasFilters } from "@/hooks/usePessoasPaginadas";
import { useDeletarPessoa } from "@/hooks/usePessoas";
import { useArquivarPessoa } from "@/hooks/useArquivarPessoa";
import { useDesarquivarPessoa } from "@/hooks/useDesarquivarPessoa";
import { useCompaniesPaginated } from "@/hooks/useCompaniesPaginated";
import { useDeleteCompany, Company } from "@/hooks/useCompanies";
import { useCompanyAssociations } from "@/hooks/useCompanyAssociations";

// Modals - Pessoas
import NovaPessoaModal from "@/components/modals/NovaPessoaModal";
import ArquivarPessoaModal from "@/components/modals/ArquivarPessoaModal";
import { ConfirmarExclusaoModal } from "@/components/modals/ConfirmarExclusaoModal";

// Modals - Empresas
import NovaEmpresaModal from "@/components/modals/NovaEmpresaModal";

// Components
import { PaginationControls } from "@/components/ui/pagination-controls";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join("");
}

// ─── Component ───────────────────────────────────────────────────────────────

const Clientes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"pessoas" | "empresas">("pessoas");

  // Search
  const [searchPessoas, setSearchPessoas] = useState("");
  const [searchEmpresas, setSearchEmpresas] = useState("");

  // Pagination
  const [currentPagePessoas, setCurrentPagePessoas] = useState(1);
  const [currentPageEmpresas, setCurrentPageEmpresas] = useState(1);
  const [perPage] = useState(20);
  const [showArquivados, setShowArquivados] = useState(false);

  // Filters — Pessoas
  const [pessoasFilters, setPessoasFilters] = useState<PessoasFilters>({});

  // Modals - Pessoas
  const [modalNovaPessoa, setModalNovaPessoa] = useState(false);
  const [modalArquivarPessoa, setModalArquivarPessoa] = useState<string | null>(null);
  const [modalExcluirPessoa, setModalExcluirPessoa] = useState<string | null>(null);

  // Modals - Empresas
  const [modalNovaEmpresa, setModalNovaEmpresa] = useState(false);
  const [modalExcluirEmpresa, setModalExcluirEmpresa] = useState<string | null>(null);

  
  const { canCreateClient, canEditClient, canDeleteClient } = useUserPermissions();

  const debouncedSearchPessoas = useDebounce(searchPessoas, 300);
  const debouncedSearchEmpresas = useDebounce(searchEmpresas, 300);

  // Data — Pessoas
  const {
    pessoas,
    leadCounts,
    pagination: paginationPessoas,
    isLoading: isLoadingPessoas,
    refetch: refetchPessoas,
  } = usePessoasPaginadas(
    'single-tenant' || "",
    currentPagePessoas,
    perPage,
    debouncedSearchPessoas,
    showArquivados,
    pessoasFilters
  );

  // Data — Empresas
  const {
    empresas,
    pagination: paginationEmpresas,
    isLoading: isLoadingEmpresas,
    refetch: refetchEmpresas,
  } = useCompaniesPaginated(currentPageEmpresas, perPage, debouncedSearchEmpresas);

  const companyIds = empresas.map(e => e.id);
  const { data: companyAssociations = {} } = useCompanyAssociations(companyIds);

  // Mutations
  const deletarPessoa = useDeletarPessoa();
  const { mutate: arquivarPessoa, isPending: isArquivandoPessoa } = useArquivarPessoa();
  const { mutate: desarquivarPessoa } = useDesarquivarPessoa();
  const deleteCompany = useDeleteCompany();

  const handleExcluirPessoa = async (id: string) => {
    if (!'single-tenant') { toast.error("Tenant não identificado"); return; }
    try {
      await deletarPessoa.mutateAsync({ id, tenantId: 'single-tenant' });
      setModalExcluirPessoa(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExcluirEmpresa = async (id: string) => {
    try {
      await deleteCompany.mutateAsync(id);
      setModalExcluirEmpresa(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePageChangePessoas = (page: number) => setCurrentPagePessoas(page);
  const handlePageChangeEmpresas = (page: number) => setCurrentPageEmpresas(page);

  // ─── Tab bar ───────────────────────────────────────────────────────────────

  const tabs = [
    { value: "pessoas" as const, icon: Users, label: "Pessoas", count: paginationPessoas.total },
    { value: "empresas" as const, icon: Building2, label: "Empresas", count: paginationEmpresas.total },
  ];

  return (
    <div className="flex flex-col min-h-0">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex-none bg-background border-b border-border">
        <div className="flex items-center gap-2 px-4 py-2">

          {/* View toggle: Kanban | Lista | Pessoas */}
          <div className="flex border border-border rounded-[2px] overflow-hidden h-[30px] flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/crm/kanban")}
              className="border-none h-full px-2.5 rounded-none"
              title="Kanban"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/crm/list")}
              className="border-none h-full px-2.5 rounded-none"
              title="Lista"
            >
              <List className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/crm/clients")}
              className="border-none h-full px-2.5 rounded-none"
              title="Clientes"
            >
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Button>
          </div>

          {/* Search — dynamic per tab */}
          {activeTab === "pessoas" ? (
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
              <Input
                type="search"
                placeholder="Buscar pessoa..."
                value={searchPessoas}
                onChange={e => { setSearchPessoas(e.target.value); setCurrentPagePessoas(1); }}
                className="pl-8 h-[30px] text-[13px] border-border"
              />
            </div>
          ) : (
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={1.5} />
              <Input
                type="search"
                placeholder="Buscar empresa..."
                value={searchEmpresas}
                onChange={e => { setSearchEmpresas(e.target.value); setCurrentPageEmpresas(1); }}
                className="pl-8 h-[30px] text-[13px] border-border"
              />
            </div>
          )}

          {/* Archived toggle — only for Pessoas */}
          {activeTab === "pessoas" && (
            <Button
              variant={showArquivados ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowArquivados(!showArquivados); setCurrentPagePessoas(1); }}
              className="h-[30px] px-3 text-xs gap-1.5 border-border flex-shrink-0 rounded-[4px]"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={1.5} />
              {showArquivados ? "Ver ativos" : "Arquivados"}
            </Button>
          )}

          {/* Filter chips — Status */}
          {activeTab === "pessoas" && (
            <div className="flex items-center gap-1 border border-border rounded-[2px] overflow-hidden h-[30px] flex-shrink-0">
              {([
                { label: "Todos", value: undefined },
                { label: "Ativo", value: "active" },
                { label: "Inativo", value: "inactive" },
              ] as { label: string; value: string | undefined }[]).map(opt => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setPessoasFilters(f => ({ ...f, statusFilter: opt.value }));
                    setCurrentPagePessoas(1);
                  }}
                  className={cn(
                    "h-full px-2.5 text-[12px] transition-colors",
                    pessoasFilters.statusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Filter chips — Negócios */}
          {activeTab === "pessoas" && (
            <div className="flex items-center gap-1 border border-border rounded-[2px] overflow-hidden h-[30px] flex-shrink-0">
              {([
                { label: "Todos", value: undefined },
                { label: "Com negócio", value: true },
                { label: "Sem negócio", value: false },
              ] as { label: string; value: boolean | undefined }[]).map(opt => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setPessoasFilters(f => ({ ...f, hasLeads: opt.value }));
                    setCurrentPagePessoas(1);
                  }}
                  className={cn(
                    "h-full px-2.5 text-[12px] transition-colors",
                    pessoasFilters.hasLeads === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeTab === "pessoas" ? refetchPessoas() : refetchEmpresas()}
            disabled={activeTab === "pessoas" ? isLoadingPessoas : isLoadingEmpresas}
            className="h-[30px] w-[30px] p-0 border-border flex-shrink-0 rounded-[4px]"
            title="Atualizar"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", (activeTab === "pessoas" ? isLoadingPessoas : isLoadingEmpresas) && "animate-spin")} strokeWidth={1.5} />
          </Button>

          <div className="flex-1" />

          {/* Action button */}
          {activeTab === "pessoas" && !showArquivados && canCreateClient && (
            <Button
              size="sm"
              onClick={() => setModalNovaPessoa(true)}
              className="h-[30px] px-3 text-xs gap-1.5 flex-shrink-0 rounded-[4px]"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Nova Pessoa
            </Button>
          )}
          {activeTab === "empresas" && canCreateClient && (
            <Button
              size="sm"
              onClick={() => setModalNovaEmpresa(true)}
              className="h-[30px] px-3 text-xs gap-1.5 flex-shrink-0 rounded-[4px]"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Nova Empresa
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-4 h-[45px] border-b border-border bg-card dark:bg-zinc-950">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-4 h-full text-[13px] border-b-2 transition-colors",
                activeTab === tab.value
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] leading-none",
                  activeTab === tab.value
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
      </div>

      {/* ── Pessoas ──────────────────────────────────────────────────────── */}
      {activeTab === "pessoas" && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoadingPessoas ? (
              <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">Carregando...</span>
              </div>
            ) : pessoas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-foreground">
                  {showArquivados ? "Nenhuma pessoa arquivada" : "Nenhuma pessoa cadastrada"}
                </p>
                <p className="text-[12px] text-muted-foreground/60">
                  {showArquivados ? "Pessoas arquivadas aparecerão aqui." : "Comece adicionando sua primeira pessoa."}
                </p>
                {!showArquivados && canCreateClient && (
                  <Button size="sm" onClick={() => setModalNovaPessoa(true)} className="h-[30px] px-3 text-xs gap-1.5 mt-1 rounded-[4px]">
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Nova Pessoa
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9 px-4">Nome</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Email</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">WhatsApp</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Negócios</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Score</TableHead>
                      <TableHead className="w-10 h-9" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pessoas.map(pessoa => {
                      const name = pessoa.name || "";
                      const initials = getInitials(name);
                      const score = pessoa.score;
                      return (
                        <TableRow
                          key={pessoa.id}
                          className="border-white/[0.06] hover:bg-muted cursor-pointer"
                          onClick={() => navigate(`/crm/clients/${pessoa.id}`)}
                        >
                          <TableCell className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-semibold text-primary leading-none">{initials || "?"}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-foreground truncate">{name}</p>
                                {pessoa.whatsapp && (
                                  <p className="text-[11px] text-muted-foreground/60 truncate">{pessoa.whatsapp}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                            {pessoa.email ? (
                              <a href={`mailto:${pessoa.email}`} className="text-[13px] text-foreground hover:text-primary flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                                <span className="truncate max-w-[200px]">{pessoa.email}</span>
                              </a>
                            ) : (
                              <span className="text-[13px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                            {pessoa.whatsapp ? (
                              <a
                                href={`https://wa.me/${pessoa.whatsapp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] text-foreground hover:text-primary flex items-center gap-1.5"
                              >
                                <Phone className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                                {pessoa.whatsapp}
                              </a>
                            ) : (
                              <span className="text-[13px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className={cn(
                              "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border leading-none",
                              pessoa.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground border-border"
                            )}>
                              {pessoa.status === "active" ? "Ativo"
                                : pessoa.status === "inactive" ? "Inativo"
                                : pessoa.status === "archived" ? "Arquivado"
                                : pessoa.status ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {(() => {
                              const n = leadCounts[pessoa.id] ?? 0;
                              return n > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border border-white/[0.06] bg-muted text-muted-foreground leading-none">
                                  <Briefcase className="w-2.5 h-2.5" strokeWidth={1.5} />
                                  {n} {n === 1 ? "negócio" : "negócios"}
                                </span>
                              ) : (
                                <span className="text-[13px] text-muted-foreground/40">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {score != null ? (
                              <span className={cn(
                                "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] border leading-none",
                                score >= 8
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/40 dark:text-emerald-400"
                                  : score >= 5
                                  ? "bg-amber-500/10 text-amber-600 border-amber-200/40 dark:text-amber-400"
                                  : "bg-red-500/10 text-red-600 border-red-200/40 dark:text-red-400"
                              )}>
                                {score}
                              </span>
                            ) : (
                              <span className="text-[13px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 pr-3" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground">
                                  <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-[13px]">
                                {canEditClient && (
                                  <DropdownMenuItem onClick={() => navigate(`/crm/clients/${pessoa.id}`)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {canEditClient && (showArquivados ? (
                                  <DropdownMenuItem onClick={() => desarquivarPessoa({ id: pessoa.id })}>
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Desarquivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setModalArquivarPessoa(pessoa.id)}>
                                    <Archive className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Arquivar
                                  </DropdownMenuItem>
                                ))}
                                {canDeleteClient && (
                                  <DropdownMenuItem
                                    onClick={() => setModalExcluirPessoa(pessoa.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="border-t border-border px-4 py-3">
                  <PaginationControls
                    currentPage={paginationPessoas.page}
                    totalPages={paginationPessoas.totalPages}
                    perPage={paginationPessoas.perPage}
                    total={paginationPessoas.total}
                    onPageChange={handlePageChangePessoas}
                    onPerPageChange={(n) => { setCurrentPagePessoas(1); setCurrentPageEmpresas(1); }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Empresas ─────────────────────────────────────────────────────── */}
      {activeTab === "empresas" && (
        <div className="flex flex-col flex-1 min-h-0">

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoadingEmpresas ? (
              <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">Carregando...</span>
              </div>
            ) : empresas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-foreground">Nenhuma empresa cadastrada</p>
                <p className="text-[12px] text-muted-foreground/60">Comece adicionando sua primeira empresa.</p>
                {canCreateClient && (
                  <Button size="sm" onClick={() => setModalNovaEmpresa(true)} className="h-[30px] px-3 text-xs gap-1.5 mt-1 rounded-[4px]">
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Nova Empresa
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9 px-4">Nome Fantasia</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Razão Social</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">CNPJ</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Negócios</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 h-9">Email</TableHead>
                      <TableHead className="w-10 h-9" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empresas.map(empresa => {
                      const assoc = companyAssociations[empresa.id];
                      const leadsCount = assoc?.leadsCount ?? 0;
                      const initials = getInitials(empresa.trade_name || "");
                      return (
                        <TableRow
                          key={empresa.id}
                          className="border-white/[0.06] hover:bg-muted cursor-pointer"
                          onClick={() => navigate(`/crm/empresas/${empresa.id}`)}
                        >
                          <TableCell className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-semibold text-primary leading-none">{initials || "?"}</span>
                              </div>
                              <span className="text-[13px] font-medium text-foreground truncate">{empresa.trade_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-[13px] text-foreground">{empresa.legal_name || <span className="text-muted-foreground/40">—</span>}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <span className="text-[13px] text-muted-foreground font-mono">{empresa.tax_id || <span className="text-muted-foreground/40">—</span>}</span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            {leadsCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] border border-white/[0.06] bg-muted text-muted-foreground leading-none">
                                <Target className="w-2.5 h-2.5" strokeWidth={1.5} />
                                {leadsCount} {leadsCount === 1 ? "negócio" : "negócios"}
                              </span>
                            ) : (
                              <span className="text-[13px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                            {empresa.email ? (
                              <a href={`mailto:${empresa.email}`} className="text-[13px] text-foreground hover:text-primary flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                                <span className="truncate max-w-[200px]">{empresa.email}</span>
                              </a>
                            ) : (
                              <span className="text-[13px] text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 pr-3" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-foreground">
                                  <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-[13px]">
                                {canEditClient && (
                                  <DropdownMenuItem onClick={() => navigate(`/crm/empresas/${empresa.id}`)}>
                                    <Edit className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {canDeleteClient && (
                                  <DropdownMenuItem
                                    onClick={() => setModalExcluirEmpresa(empresa.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="border-t border-border px-4 py-3">
                  <PaginationControls
                    currentPage={paginationEmpresas.page}
                    totalPages={paginationEmpresas.totalPages}
                    perPage={paginationEmpresas.perPage}
                    total={paginationEmpresas.total}
                    onPageChange={handlePageChangeEmpresas}
                    onPerPageChange={(n) => { setCurrentPagePessoas(1); setCurrentPageEmpresas(1); }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modals — Pessoas ─────────────────────────────────────────────── */}
      <NovaPessoaModal
        open={modalNovaPessoa}
        onOpenChange={setModalNovaPessoa}
        tenantId={'single-tenant' || ""}
      />

      {modalArquivarPessoa && (
        <ArquivarPessoaModal
          open={!!modalArquivarPessoa}
          onOpenChange={() => setModalArquivarPessoa(null)}
          onConfirmar={() => {
            arquivarPessoa(modalArquivarPessoa!, {
              onSuccess: () => setModalArquivarPessoa(null),
            });
          }}
          nomePessoa={pessoas?.find(p => p.id === modalArquivarPessoa)?.name || ""}
          isLoading={isArquivandoPessoa}
        />
      )}

      {modalExcluirPessoa && (
        <ConfirmarExclusaoModal
          open={!!modalExcluirPessoa}
          onOpenChange={() => setModalExcluirPessoa(null)}
          onConfirm={() => handleExcluirPessoa(modalExcluirPessoa!)}
          title="Excluir Pessoa"
          description="Esta ação não pode ser desfeita. Tem certeza que deseja excluir esta pessoa?"
          isLoading={deletarPessoa.isPending}
        />
      )}

      {/* ── Modals — Empresas ────────────────────────────────────────────── */}
      <NovaEmpresaModal
        open={modalNovaEmpresa}
        onOpenChange={setModalNovaEmpresa}
      />

      {modalExcluirEmpresa && (
        <ConfirmarExclusaoModal
          open={!!modalExcluirEmpresa}
          onOpenChange={() => setModalExcluirEmpresa(null)}
          onConfirm={() => handleExcluirEmpresa(modalExcluirEmpresa!)}
          title="Excluir Empresa"
          description="Esta ação não pode ser desfeita. Tem certeza que deseja excluir esta empresa?"
          isLoading={deleteCompany.isPending}
        />
      )}
    </div>
  );
};

export default Clientes;
