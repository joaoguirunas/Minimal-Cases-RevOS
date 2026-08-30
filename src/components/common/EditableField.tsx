import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import DOMPurify from "dompurify";
import { Edit3, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
interface EditableFieldProps {
  label: string;
  value: any;
  type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'richtext';
  options?: Array<{value: string, label: string}>;
  onSave: (value: any) => Promise<void>;
  validation?: (value: any) => string | null;
  icon: React.ReactNode;
  className?: string;
  placeholder?: string;       // displayed when empty (read mode)
  inputPlaceholder?: string;  // shown inside the input while editing
  isLoading?: boolean;
}

const EditableField = ({
  label,
  value,
  type,
  options,
  onSave,
  validation,
  icon,
  className = "",
  placeholder = "Não informado",
  inputPlaceholder,
  isLoading = false
}: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setTempValue(value || '');
    }
  }, [value, isEditing]);
  const { session, user } = useAuth();

  const handleEdit = () => {
    if (!session || !user) {
      toast.error("Você precisa estar autenticado para editar este campo");
      return;
    }
    setTempValue(value || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    // Validação
    if (validation) {
      const error = validation(tempValue);
      if (error) {
        toast.error(error);
        return;
      }
    }

    // Verificar se houve mudança
    if (tempValue === value) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(tempValue);
      setIsEditing(false);
      toast.success(`${label} atualizado com sucesso!`);
    } catch (error: any) {
      console.error(`Erro ao atualizar ${label}:`, error);
      
      const errorMessage = error?.message || 'Erro desconhecido';
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        toast.error("Erro de permissão: Você não tem acesso para editar esta pessoa");
      } else if (errorMessage.includes('auth')) {
        toast.error("Erro de autenticação: Faça login novamente");
      } else {
        toast.error(`Erro ao salvar: ${errorMessage}`);
      }
      
      setTempValue(value || ''); // Reset em caso de erro
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTempValue(value || '');
    setIsEditing(false);
  };

  const renderInput = () => {
    switch (type) {
      case 'richtext':
        return (
          <RichTextEditor
            content={tempValue}
            onChange={setTempValue}
            placeholder={inputPlaceholder || placeholder}
            minHeight="120px"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="min-h-[60px] text-sm border-border focus:border-primary rounded-[4px]"
            placeholder={inputPlaceholder || placeholder}
          />
        );

      case 'select':
        return (
          <Select value={tempValue} onValueChange={setTempValue}>
            <SelectTrigger className="h-8 text-sm border-border focus:border-primary rounded-[4px]">
              <SelectValue placeholder={inputPlaceholder || placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="h-8 text-sm border-border focus:border-primary rounded-[4px]"
            placeholder={inputPlaceholder || placeholder}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="h-8 text-sm border-border focus:border-primary rounded-[4px]"
            placeholder={inputPlaceholder || placeholder}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className="h-8 text-sm border-border focus:border-primary rounded-[4px]"
            placeholder={inputPlaceholder || placeholder}
          />
        );
    }
  };

  const displayValue = () => {
    if (!value) return placeholder;
    
    if (type === 'select' && options) {
      const option = options.find(opt => opt.value === value);
      return option ? option.label : value;
    }
    
    return value;
  };

  return (
    <div className={`flex items-center gap-3 p-3 bg-muted border border-border rounded-[4px] overflow-hidden ${className}`}>
      <div className="w-4 h-4 text-muted-foreground flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </Label>
        
        {isEditing ? (
          <div className="space-y-2 mt-1">
            {renderInput()}
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSave}
                disabled={saving}
                className="h-6 w-6 p-0 hover:bg-primary/10 rounded-[4px]"
              >
                {saving ? (
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3 text-primary" />
                )}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleCancel}
                disabled={saving}
                className="h-6 w-6 p-0 hover:bg-destructive/10 rounded-[4px]"
              >
                <X className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 group min-w-0">
            {(type === 'richtext' || type === 'textarea') && value ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground min-w-0"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(value)) }}
              />
            ) : (
              <p className="text-sm text-foreground truncate min-w-0" title={saving ? undefined : (displayValue() || undefined)}>
                {saving ? "Salvando..." : displayValue()}
              </p>
            )}
            {session && user && !isLoading && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEdit}
                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-[4px]"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableField;