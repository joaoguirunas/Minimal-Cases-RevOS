/**
 * Mobile LP PRO™ Page
 * Phase 4 Task #15: Mobile-optimized LP editor interface
 *
 * Mobile-first redesign of the LP editor:
 * - Full-screen editor canvas
 * - Bottom sheet for controls
 * - Touch-friendly layout
 * - Simplified block management
 */

import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
// TODO: LpPageEditor, useLpPages, LpPageContent não existem — implementar antes de ativar rota /m/lp
import { useLpForms, useDeleteLpForm } from '@/hooks/useLpForms';
import type { LpForm } from '@/hooks/useLpForms';

type LpPage = { id: string; name: string; slug: string; status: string; thumbnail_url?: string };
type LpPageContent = Record<string, unknown>;
const useLpPages = () => ({ data: [] as LpPage[] });
const useDeleteLpPage = () => ({ mutate: (_id: string) => {} });
const LpPageEditor = (_props: { page: LpPage | null; initialContent?: LpPageContent; onBack: () => void }) => null;

type LpTab = 'pages' | 'forms';

/**
 * Mobile LP PRO™ - Full-screen editor optimized for touch
 */
export default function MobileLpPro() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LpTab>('pages');
  const [editingPage, setEditingPage] = useState<LpPage | null | undefined>(undefined);
  const [initialPageContent, setInitialPageContent] = useState<LpPageContent | undefined>();
  const { data: pages = [] } = useLpPages();
  const { mutate: deletePage } = useDeleteLpPage();

  const [editingForm, setEditingForm] = useState<LpForm | null | undefined>(undefined);
  const { data: forms = [] } = useLpForms();
  const { mutate: deleteForm } = useDeleteLpForm();

  // Show editor if editing a page
  if (editingPage !== undefined) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header with back button */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-card shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingPage(undefined);
              setInitialPageContent(undefined);
            }}
            className="h-[30px] w-[30px] p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-semibold flex-1 text-center truncate">
            {editingPage?.name || 'Nova página'}
          </h2>
          <div className="w-8" /> {/* Spacer for alignment */}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
          <LpPageEditor
            page={editingPage}
            initialContent={initialPageContent}
            onBack={() => {
              setEditingPage(undefined);
              setInitialPageContent(undefined);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header with tabs and action */}
      <div className="h-12 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-4">
          {((['pages', 'forms'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-medium pb-3 border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {tab === 'pages' ? t('lpPro.tabs.pages') : t('lpPro.tabs.forms')}
              <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                {tab === 'pages' ? pages.length : forms.length}
              </span>
            </button>
          )))}
        </div>

        {/* Add button */}
        <Button
          size="sm"
          onClick={() => {
            if (activeTab === 'pages') {
              setEditingPage(null);
            } else {
              setEditingForm(null);
            }
          }}
          className="h-[30px] px-2 text-xs"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'pages' && (
          <PagesListMobile
            pages={pages}
            onEdit={setEditingPage}
            onDelete={(id) => deletePage(id)}
          />
        )}
        {activeTab === 'forms' && (
          <FormsListMobile
            forms={forms}
            onEdit={setEditingForm}
            onDelete={(id) => deleteForm(id)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Mobile pages list - grid layout
 */
function PagesListMobile({
  pages,
  onEdit,
  onDelete,
}: {
  pages: LpPage[];
  onEdit: (page: LpPage) => void;
  onDelete: (id: string) => void;
}) {
  if (pages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhuma página criada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => onEdit(page)}
          className="w-full flex items-start gap-3 p-3 border border-border rounded-[4px] bg-card hover:bg-muted transition-colors text-left"
        >
          {/* Thumbnail */}
          <div className="w-12 h-12 rounded bg-muted border border-border flex-shrink-0 overflow-hidden">
            {page.thumbnail_url ? (
              <img
                src={page.thumbnail_url}
                alt={page.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                📄
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{page.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {page.slug}
            </p>
            <div className="flex gap-1 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                page.status === 'published'
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {page.status === 'published' ? '✓ Publicada' : '⊘ Rascunho'}
              </span>
            </div>
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Deletar esta página?')) {
                onDelete(page.id);
              }
            }}
            className="text-destructive text-xs px-2 py-1 rounded hover:bg-destructive/10"
          >
            ✕
          </button>
        </button>
      ))}
    </div>
  );
}

/**
 * Mobile forms list
 */
function FormsListMobile({
  forms,
  onEdit,
  onDelete,
}: {
  forms: LpForm[];
  onEdit: (form: LpForm) => void;
  onDelete: (id: string) => void;
}) {
  if (forms.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum formulário criado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {forms.map((form) => (
        <button
          key={form.id}
          onClick={() => onEdit(form)}
          className="w-full text-left p-4 border border-border rounded-[4px] bg-card hover:bg-muted transition-colors"
        >
          <h3 className="font-medium text-sm">{form.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {form.fields?.length || 0} campos
          </p>
        </button>
      ))}
    </div>
  );
}
