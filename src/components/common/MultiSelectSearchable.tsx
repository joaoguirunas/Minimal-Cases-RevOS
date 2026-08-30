import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePessoas } from "@/hooks/usePessoas";

interface MultiSelectSearchableProps {
  type: 'pessoas';
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  tenantId?: string;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
}

const MultiSelectSearchable = ({
  type,
  selectedIds,
  onSelectionChange,
  tenantId,
  disabled = false,
  placeholder,
  emptyText
}: MultiSelectSearchableProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Fetch data
  const { data: pessoas, isLoading } = usePessoas(tenantId);
  
  // Prepare options (only pessoas)
  const options = (pessoas || []).map(pessoa => ({
    id: pessoa.id,
    label: pessoa.nome,
    subtitle: pessoa.whatsapp || pessoa.email,
    icon: Users
  }));

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
    (option.subtitle && option.subtitle.toLowerCase().includes(searchValue.toLowerCase()))
  );

  // Get selected items
  const selectedItems = options.filter(option => selectedIds.includes(option.id));

  const handleSelect = (optionId: string) => {
    const newSelection = selectedIds.includes(optionId)
      ? selectedIds.filter(id => id !== optionId)
      : [...selectedIds, optionId];
    
    onSelectionChange(newSelection);
  };

  const handleRemove = (optionId: string) => {
    onSelectionChange(selectedIds.filter(id => id !== optionId));
  };

  const defaultPlaceholder = 'Selecionar pessoas';
  const defaultEmptyText = 'Nenhuma pessoa encontrada';

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-[4px] border-border bg-card hover:bg-muted"
            disabled={disabled}
          >
            <span className="text-left truncate">
              {selectedItems.length > 0 
                ? `${selectedItems.length} pessoa(s) selecionada(s)`
                : placeholder || defaultPlaceholder
              }
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 rounded-[4px] border-border" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar pessoas..."
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Carregando..." : emptyText || defaultEmptyText}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => handleSelect(option.id)}
                    className="rounded-[4px] hover:bg-muted"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(option.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{option.label}</span>
                      {option.subtitle && (
                        <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected items display */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <Badge 
              key={item.id} 
              variant="secondary" 
              className="rounded-[4px] bg-muted text-foreground hover:bg-muted/50"
            >
              <item.icon className="w-3 h-3 mr-1" />
              <span className="font-medium">{item.label}</span>
              {item.subtitle && (
                <span className="text-xs text-muted-foreground ml-1">({item.subtitle})</span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                disabled={disabled}
                className="ml-2 hover:bg-destructive/20 rounded-full p-0.5 disabled:opacity-50"
              >
                <X className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectSearchable;