import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopyableIdProps {
  id: string;
  label?: string;
  className?: string;
}

const CopyableId = ({ id, label, className }: CopyableIdProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast({
        title: "ID copiado!",
        description: label ? `${label} copiado para a área de transferência` : "ID copiado para a área de transferência",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o ID",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span className="text-xs font-mono text-muted-foreground/80 truncate">
        {label && `${label}: `}{id}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-600" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
};

export default CopyableId;