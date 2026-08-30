import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  EyeOff,
} from "lucide-react";
import type { CatalogField, CatalogGroup } from "@/hooks/useLpFormCatalog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CatalogSidebar({
  catalogGroups,
  alreadyAdded,
  onPick,
  onPickAll,
  onAddHidden,
  isLoading,
}: {
  catalogGroups: CatalogGroup[];
  alreadyAdded: Set<string>;
  onPick: (field: CatalogField) => void;
  onPickAll: (fields: CatalogField[]) => void;
  onAddHidden: () => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return catalogGroups;
    return catalogGroups
      .map((g) => ({
        ...g,
        fields: g.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.crm_field.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.fields.length > 0);
  }, [catalogGroups, search]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Header + Search — matches Mode bar (px-4 py-2.5 bg-card border-b) */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0 bg-card">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
          Catálogo
        </span>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-[30px] pl-7 text-xs rounded-[4px] bg-background"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            Nenhum resultado para &quot;{search}&quot;
          </p>
        ) : (
          <>
            {filtered.map((group) => {
              const isCollapsed = collapsed.has(group.id) && !search;
              const pending = group.fields.filter(
                (f) => !alreadyAdded.has(f.crm_field)
              );

              return (
                <div key={group.id}>
                  {/* Group header */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-muted/50 transition-colors"
                    onClick={() => toggle(group.id)}
                  >
                    <span className="text-sm shrink-0">{group.icon}</span>
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wide flex-1 truncate">
                      {group.label}
                    </span>
                    {!search && pending.length > 0 && (
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-[2px] font-mono shrink-0">
                        {pending.length}
                      </span>
                    )}
                    {group.allowAddAll && !search && pending.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPickAll(pending);
                        }}
                        className="text-[9px] font-bold text-primary hover:underline shrink-0 px-0.5"
                      >
                        +todos
                      </button>
                    )}
                    {!search &&
                      (isCollapsed ? (
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      ))}
                  </div>

                  {/* Group fields */}
                  {!isCollapsed && (
                    <div className="px-1.5 pb-1">
                      {group.fields.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground px-3 py-2 leading-relaxed">
                          Nenhum campo cadastrado.
                        </p>
                      ) : (
                        group.fields.map((cf) => {
                          const added = alreadyAdded.has(cf.crm_field);
                          return (
                            <button
                              key={cf.crm_field}
                              disabled={added}
                              onClick={() => onPick(cf)}
                              className={cn(
                                "w-full flex items-start gap-2 px-2.5 py-2 rounded-[4px] text-left transition-all",
                                added
                                  ? "opacity-35 cursor-not-allowed"
                                  : "hover:bg-primary/8 active:scale-[0.98] cursor-pointer group/item"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div
                                  className={cn(
                                    "text-xs font-medium leading-tight truncate",
                                    added
                                      ? "text-muted-foreground"
                                      : "text-foreground"
                                  )}
                                >
                                  {cf.label}
                                  {added && (
                                    <span className="ml-1.5 text-[9px] text-primary font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] font-mono text-muted-foreground/60 truncate mt-0.5">
                                  {cf.crm_field}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Hidden field option */}
            {!search && (
              <div>
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-sm">🔒</span>
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wide flex-1">
                    Oculto
                  </span>
                </div>
                <div className="px-1.5 pb-1">
                  <button
                    onClick={onAddHidden}
                    className="w-full flex items-start gap-2 px-2.5 py-2 rounded-[4px] text-left transition-all hover:bg-primary/8 active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                        Campo oculto
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                        Valor fixo, não exibido ao usuário
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
