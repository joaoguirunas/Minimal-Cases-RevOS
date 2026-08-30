
import React, { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Trash2, Upload } from 'lucide-react';
import { useNegocioArquivos, useUploadArquivo, useDeletarArquivo } from '@/hooks/useNegocioArquivos';
import { toast } from 'sonner';

interface NegocioArquivosProps {
  negocioId: string;
}

const NegocioArquivos = ({ negocioId }: NegocioArquivosProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: arquivos = [], isLoading } = useNegocioArquivos(negocioId);
  const uploadArquivo = useUploadArquivo();
  const deletarArquivo = useDeletarArquivo();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 10MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      uploadArquivo.mutate({
        file,
        negocioId,
      });
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (arquivo: any) => {
    window.open(arquivo.url_arquivo, '_blank');
  };

  const handleDelete = (arquivo: any) => {
    if (window.confirm('Tem certeza que deseja excluir este arquivo?')) {
      deletarArquivo.mutate(arquivo);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Card className="p-6 rounded-[2px]">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded-[2px] w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-12 bg-muted rounded-[2px]"></div>
            <div className="h-12 bg-muted rounded-[2px]"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-[2px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Documentos e Arquivos</h3>
        <Button onClick={handleFileSelect} disabled={uploadArquivo.isPending} className="h-[30px] text-xs rounded-[4px] gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          {uploadArquivo.isPending ? 'Enviando...' : 'Adicionar Arquivo'}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept="*/*"
      />

      {arquivos.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-[2px] p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No files uploaded</p>
          <Button variant="outline" onClick={handleFileSelect} className="mt-4 h-[30px] text-xs rounded-[4px]">
            Selecionar Arquivos
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {arquivos.map((arquivo) => (
            <div
              key={arquivo.id}
              className="flex items-center justify-between p-4 border border-border rounded-[2px] hover:bg-white/[0.035] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-[#3B82F6]" />
                <div>
                  <p className="font-medium">{arquivo.nome_arquivo}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(arquivo.tamanho_arquivo)} • 
                    {new Date(arquivo.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(arquivo)}
                  className="h-[30px] w-[30px] p-0 rounded-[4px]"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(arquivo)}
                  disabled={deletarArquivo.isPending}
                  className="h-[30px] w-[30px] p-0 rounded-[4px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default NegocioArquivos;
