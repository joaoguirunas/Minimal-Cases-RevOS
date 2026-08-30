import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';

export interface FieldMapping {
  source: 'column' | 'fixed' | 'skip';
  value: string;
}

interface FieldMappingRowProps {
  fieldKey: string;
  fieldLabel: string;
  fieldType?: 'text' | 'number' | 'boolean' | 'select';
  selectOptions?: { value: string; label: string }[];
  required?: boolean;
  availableColumns: string[];
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
}

export function FieldMappingRow({
  fieldKey,
  fieldLabel,
  fieldType = 'text',
  selectOptions,
  required,
  availableColumns,
  mapping,
  onMappingChange,
}: FieldMappingRowProps) {
  return (
    <div className="grid gap-3 p-3 bg-muted rounded-[4px] hover:bg-accent transition-colors">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{fieldLabel}</Label>
        {required && (
          <Badge variant="destructive" className="h-5 text-xs rounded-[4px]">
            Obrigatório
          </Badge>
        )}
      </div>

      <RadioGroup
        value={mapping.source}
        onValueChange={(value: 'column' | 'fixed' | 'skip') => {
          onMappingChange({
            source: value,
            value: value === 'skip' ? '' : mapping.value,
          });
        }}
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="column" id={`${fieldKey}-column`} />
          <Label htmlFor={`${fieldKey}-column`} className="text-sm cursor-pointer">
            Mapear da planilha
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="fixed" id={`${fieldKey}-fixed`} />
          <Label htmlFor={`${fieldKey}-fixed`} className="text-sm cursor-pointer">
            Valor fixo
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="skip" id={`${fieldKey}-skip`} />
          <Label htmlFor={`${fieldKey}-skip`} className="text-sm cursor-pointer">
            Não preencher
          </Label>
        </div>
      </RadioGroup>

      {mapping.source === 'column' && (
        <Select
          value={mapping.value || undefined}
          onValueChange={(value) => onMappingChange({ ...mapping, value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma coluna" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {mapping.source === 'fixed' && (
        <>
          {fieldType === 'select' && selectOptions ? (
            <Select
              value={mapping.value || undefined}
              onValueChange={(value) => onMappingChange({ ...mapping, value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um valor" />
              </SelectTrigger>
              <SelectContent>
                {selectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : fieldType === 'boolean' ? (
            <Select
              value={mapping.value || undefined}
              onValueChange={(value) => onMappingChange({ ...mapping, value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Não</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={fieldType === 'number' ? 'number' : 'text'}
              value={mapping.value}
              onChange={(e) => onMappingChange({ ...mapping, value: e.target.value })}
              placeholder={`Digite o valor ${fieldType === 'number' ? 'numérico' : ''}`}
            />
          )}
        </>
      )}
    </div>
  );
}
