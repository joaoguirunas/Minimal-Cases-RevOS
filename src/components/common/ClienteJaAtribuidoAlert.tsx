
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ClienteJaAtribuidoAlertProps {
  nomeCliente: string;
  nomeResponsavel: string;
}

const ClienteJaAtribuidoAlert = ({ nomeCliente, nomeResponsavel }: ClienteJaAtribuidoAlertProps) => {
  return (
    <Alert className="border-orange-200 bg-orange-50 rounded-[4px]">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <strong>{nomeCliente}</strong> já está atribuído ao atendente <strong>{nomeResponsavel}</strong>.
        Você não pode criar negócios para este cliente.
      </AlertDescription>
    </Alert>
  );
};

export default ClienteJaAtribuidoAlert;
