
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConfirmarExclusaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmarExclusaoModal = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  isLoading = false,
  confirmText = "Excluir",
  cancelText = "Cancelar"
}: ConfirmarExclusaoModalProps) => {
  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md rounded-[4px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="rounded-[4px]">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Esta ação não pode ser desfeita.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-[4px]"
          >
            <X className="w-4 h-4 mr-2" />
            {cancelText}
          </Button>
          <Button 
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-[4px]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 mr-2" />
            )}
            {isLoading ? 'Excluindo...' : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
