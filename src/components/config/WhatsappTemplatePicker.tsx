import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsappTemplatePreview } from './WhatsappTemplatePreview';
import type { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: Array<{ text: string; type: string }>;
}

interface WhatsappTemplatePickerProps {
  templates: WhatsappTemplate[];
  value: string | null;
  onChange: (id: string | null) => void;
  triggerClassName?: string;
}

export function WhatsappTemplatePicker({
  templates,
  value,
  onChange,
  triggerClassName,
}: WhatsappTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const selected = templates.find((t) => t.id === value) ?? null;
  const previewed = templates.find((t) => t.id === (hovered ?? value)) ?? null;
  const previewComponents = (previewed?.json_data as { components?: TemplateComponent[] } | null)
    ?.components ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-[30px] justify-between text-[12px] font-normal',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate">{selected ? selected.nome : 'Nenhum'}</span>
          <ChevronDown className="w-3.5 h-3.5 ml-1.5 shrink-0 opacity-50" strokeWidth={1.5} />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[580px]"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex h-[360px]">
          {/* Left: template list */}
          <div className="flex flex-col w-[220px] border-r border-border shrink-0">
            <Command>
              <CommandInput placeholder="Buscar template..." className="h-9 text-[12px]" />
              <CommandList className="flex-1 overflow-y-auto">
                <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                  Nenhum template
                </CommandEmpty>

                {/* Nenhum option */}
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(null); setOpen(false); }}
                  onMouseEnter={() => setHovered(null)}
                  className="text-[12px] text-muted-foreground gap-2 cursor-pointer"
                >
                  <Check className={cn('w-3.5 h-3.5 shrink-0', value === null ? 'opacity-100' : 'opacity-0')} strokeWidth={2} />
                  Nenhum
                </CommandItem>

                {templates.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.nome}
                    onSelect={() => { onChange(t.id); setOpen(false); }}
                    onMouseEnter={() => setHovered(t.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="text-[12px] gap-2 cursor-pointer"
                  >
                    <Check
                      className={cn('w-3.5 h-3.5 shrink-0', value === t.id ? 'opacity-100' : 'opacity-0')}
                      strokeWidth={2}
                    />
                    <span className="truncate">{t.nome}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>

          {/* Right: preview */}
          <div className="flex-1 overflow-y-auto">
            {previewComponents.length > 0 ? (
              <div className="scale-[0.85] origin-top-left w-[calc(100%/0.85)]">
                <WhatsappTemplatePreview components={previewComponents} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40 p-6">
                <MessageSquare className="w-8 h-8" strokeWidth={1} />
                <p className="text-[12px] text-center">
                  {hovered || value
                    ? 'Sem dados de preview para este template'
                    : 'Passe o mouse sobre um template para ver o preview'}
                </p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
