import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CopyPromptButtonProps {
  text: string;
  label?: string;
}

const CopyPromptButton = ({ text, label = "Prompt" }: CopyPromptButtonProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!text.trim()) {
      toast({
        title: "Nada para copiar",
        description: "O prompt está vazio",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Prompt copiado!",
        description: `${label} copiado para a área de transferência`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o prompt",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="h-8 px-3 text-xs"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 mr-1 text-green-600" />
          Copiado
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 mr-1" />
          Copiar
        </>
      )}
    </Button>
  );
};

export default CopyPromptButton;