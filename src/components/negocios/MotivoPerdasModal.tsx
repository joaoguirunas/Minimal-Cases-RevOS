
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMotivosPerda } from "@/hooks/useMotivosPerda";
import { XCircle } from "lucide-react";

interface MotivoPerdasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivoId: string, motivoTexto?: string) => void;
  isLoading?: boolean;
}

const MotivoPerdasModal = ({ isOpen, onClose, onConfirm, isLoading = false }: MotivoPerdasModalProps) => {
  
  const { motivos } = useMotivosPerda('single-tenant');
  const [selectedMotivoId, setSelectedMotivoId] = useState<string>("");
  const [motivoTexto, setMotivoTexto] = useState<string>("");

  const handleConfirm = () => {
    if (!selectedMotivoId) return;
    
    const selectedMotivo = motivos.find(m => m.id === selectedMotivoId);
    onConfirm(selectedMotivoId, motivoTexto || selectedMotivo?.name);
    
    // Reset form
    setSelectedMotivoId("");
    setMotivoTexto("");
  };

  const handleClose = () => {
    setSelectedMotivoId("");
    setMotivoTexto("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Motivo da Perda
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="motivo" className="text-sm font-medium text-foreground mb-2 block">
              Selecione o motivo da perda *
            </Label>
            <Select value={selectedMotivoId} onValueChange={setSelectedMotivoId}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Escolha um motivo" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {motivos.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-sm font-medium text-foreground mb-2 block">
              Observações adicionais (opcional)
            </Label>
            <Textarea
              id="observacoes"
              value={motivoTexto}
              onChange={(e) => setMotivoTexto(e.target.value)}
              placeholder="Descreva detalhes sobre o motivo da perda..."
              className="min-h-[80px] rounded-lg"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-lg h-[30px] text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedMotivoId || isLoading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg h-[30px] text-xs"
          >
            {isLoading ? "Salvando..." : "Confirmar Perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MotivoPerdasModal;
