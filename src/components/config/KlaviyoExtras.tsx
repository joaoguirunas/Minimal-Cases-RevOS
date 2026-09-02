/**
 * KlaviyoExtras — trava de envios (KLV-4) e gerenciador de imagens dos e-mails (EMAIL-3).
 *
 * A trava é fail-safe: envios via Klaviyo só acontecem com credentials.sends_locked
 * EXPLICITAMENTE 'false' (os dispatchers de e-mail/SMS bloqueiam qualquer outro valor).
 * O gerenciador sobe imagens pro bucket público `email-assets` do Storage — a URL
 * pública vai direto nos templates ({{asset_base}}/arquivo).
 */

import { useRef, useState } from 'react';
import { Copy, ImageIcon, Loader2, Lock, LockOpen, Trash2, Upload } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export const EMAIL_ASSETS_PUBLIC_BASE = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/email-assets`;

// ── Trava de envios ─────────────────────────────────────────────────────────────

export function KlaviyoSendLockCard({
  locked,
  onChange,
  channelLabel,
}: {
  locked: boolean;
  onChange: (locked: boolean) => void;
  channelLabel: string;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3',
      locked ? 'border-border bg-muted/30' : 'border-red-500/40 bg-red-500/5',
    )}>
      <div className="flex items-start gap-2.5 min-w-0">
        {locked
          ? <Lock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          : <LockOpen className="w-4 h-4 mt-0.5 text-red-500 shrink-0" strokeWidth={1.5} />}
        <div className="min-w-0">
          <span className="text-[12.5px] font-medium text-foreground">
            {locked ? `Envios de ${channelLabel} pelo Klaviyo TRAVADOS` : `Envios de ${channelLabel} pelo Klaviyo LIBERADOS`}
          </span>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            {locked
              ? 'Nenhum e-mail/SMS sai pelo Klaviyo (nem o botão de teste). Sincronizar templates e criar flows continua permitido — flows nascem em rascunho.'
              : 'ATENÇÃO: com a trava aberta E um flow Live no Klaviyo, os follow-ups disparam de verdade.'}
          </p>
        </div>
      </div>
      <Switch checked={!locked} onCheckedChange={(v) => onChange(!v)} />
    </div>
  );
}

// ── Imagens dos e-mails (bucket público) ────────────────────────────────────────

interface AssetRow { name: string; metadata?: { size?: number } | null }

export function EmailAssetsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['email-assets'],
    staleTime: 30_000,
    queryFn: async (): Promise<AssetRow[]> => {
      const { data, error } = await supabase.storage.from('email-assets')
        .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      return (data ?? []).filter((f) => f.name !== '.emptyFolderPlaceholder');
    },
  });

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const name = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
        const { error } = await supabase.storage.from('email-assets')
          .upload(name, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(`${file.name}: ${error.message}`);
      }
      toast({ title: 'Imagem no ar', description: 'Use {{asset_base}}/nome-do-arquivo no template.' });
      queryClient.invalidateQueries({ queryKey: ['email-assets'] });
    } catch (e) {
      toast({ title: 'Falha no upload', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (name: string) => {
    const { error } = await supabase.storage.from('email-assets').remove([name]);
    if (error) toast({ title: 'Falha ao remover', description: error.message, variant: 'destructive' });
    else queryClient.invalidateQueries({ queryKey: ['email-assets'] });
  };

  const copyUrl = (name: string) => {
    navigator.clipboard.writeText(`${EMAIL_ASSETS_PUBLIC_BASE}/${name}`);
    toast({ title: 'URL copiada' });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Imagens dos e-mails</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Bucket público — nos templates use <span className="font-mono">{'{{asset_base}}'}/arquivo</span>.
              Imagens coladas inline (base64) sobem sozinhas na exportação pro Klaviyo.
            </p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Enviar imagem
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
        </div>
      ) : (assets ?? []).length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-2">Nenhuma imagem no bucket ainda.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {(assets ?? []).map((a) => (
            <div key={a.name} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
              <img
                src={`${EMAIL_ASSETS_PUBLIC_BASE}/${a.name}`}
                alt={a.name}
                className="w-9 h-9 rounded-md object-cover bg-muted shrink-0"
                loading="lazy"
              />
              <span className="flex-1 min-w-0 text-[12px] font-mono truncate" title={a.name}>{a.name}</span>
              <button className="text-muted-foreground hover:text-foreground" title="Copiar URL pública" onClick={() => copyUrl(a.name)}>
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button className="text-muted-foreground hover:text-red-500" title="Remover" onClick={() => remove(a.name)}>
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
