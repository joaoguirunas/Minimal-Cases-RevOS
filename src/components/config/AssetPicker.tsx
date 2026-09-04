/**
 * AssetPicker — seleção de imagem do bucket público `email-assets` (EMAIL-3),
 * usado pelo editor de HTML dos e-mails para inserir imagens já hospedadas.
 */

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEmailAssets, useUploadEmailAsset } from '@/hooks/useEmailAssets';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WebP',
};

/** Converte um `accept` HTML (ex.: "image/jpeg,image/png") na lista de MIME types aceitos. */
function parseAcceptedTypes(accept?: string): string[] {
  if (!accept) return ACCEPTED_TYPES;
  const parsed = accept.split(',').map(s => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : ACCEPTED_TYPES;
}

interface AssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  prefix?: string;
  accept?: string;
}

export function AssetPicker({ open, onOpenChange, onSelect, prefix = '', accept }: AssetPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { data: assets, isLoading } = useEmailAssets(prefix);
  const uploadAsset = useUploadEmailAsset();

  const handleFileChange = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const acceptedTypes = parseAcceptedTypes(accept);
    if (!acceptedTypes.includes(file.type)) {
      const labels = acceptedTypes.map(t => MIME_LABELS[t] ?? t).join(', ');
      toast.error(`Formato não suportado. Use ${labels}.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Imagem muito grande. Limite de 5 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadAsset.mutateAsync({ file, prefix });
      onSelect(url);
      onOpenChange(false);
    } catch (e) {
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <ImageIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            Selecionar imagem
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Imagens do bucket
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={accept ?? 'image/jpeg,image/png,image/gif,image/webp'}
            hidden
            onChange={(e) => handleFileChange(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[12px] shrink-0"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />}
            Enviar imagem
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-6 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
          </div>
        ) : (assets ?? []).length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-6 text-center">Nenhuma imagem nesta pasta.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 max-h-[420px] overflow-y-auto">
            {(assets ?? []).map((asset) => (
              <button
                key={asset.path}
                type="button"
                onClick={() => handleSelect(asset.url)}
                className="flex flex-col gap-1 text-left"
              >
                <img
                  src={asset.url}
                  alt={asset.name}
                  loading="lazy"
                  className="w-full aspect-square rounded-xl border border-border object-cover bg-muted"
                />
                <span className="text-[11px] truncate text-muted-foreground" title={asset.name}>{asset.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
