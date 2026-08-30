
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from 'lucide-react';
import { usePessoas } from "@/hooks/usePessoas";

interface MultiSelectPessoasProps {
  selectedPessoas: string[];
  onPessoasChange: (pessoas: string[]) => void;
  tenantId: string;
  disabled?: boolean;
}

const MultiSelectPessoas = ({ selectedPessoas, onPessoasChange, tenantId, disabled }: MultiSelectPessoasProps) => {
  const { data: pessoas = [] } = usePessoas(tenantId);
  
  const availablePessoas = pessoas.filter(pessoa => 
    !selectedPessoas.includes(pessoa.id)
  );
  
  const selectedPessoasData = pessoas.filter(pessoa => 
    selectedPessoas.includes(pessoa.id)
  );

  const handleAddPessoa = (pessoaId: string) => {
    if (pessoaId && !selectedPessoas.includes(pessoaId)) {
      onPessoasChange([...selectedPessoas, pessoaId]);
    }
  };

  const handleRemovePessoa = (pessoaId: string) => {
    onPessoasChange(selectedPessoas.filter(id => id !== pessoaId));
  };

  return (
    <div className="space-y-3">
      <Select onValueChange={handleAddPessoa} disabled={disabled || availablePessoas.length === 0}>
        <SelectTrigger className="rounded-[4px]">
          <SelectValue placeholder={
            availablePessoas.length === 0 
              ? "Todas as pessoas já foram selecionadas" 
              : "Selecionar pessoa"
          } />
        </SelectTrigger>
        <SelectContent className="rounded-[4px]">
          {availablePessoas.map((pessoa) => (
            <SelectItem key={pessoa.id} value={pessoa.id} className="rounded-[4px]">
              {pessoa.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPessoasData.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Pessoas selecionadas:</p>
          <div className="flex flex-wrap gap-2">
            {selectedPessoasData.map((pessoa) => (
              <Badge key={pessoa.id} className="flex items-center gap-2 bg-primary/10 text-primary border-0 rounded-[4px] px-3 py-1">
                {pessoa.nome}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePessoa(pessoa.id)}
                  className="h-4 w-4 p-0 hover:bg-destructive/10 rounded-[4px]"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectPessoas;
