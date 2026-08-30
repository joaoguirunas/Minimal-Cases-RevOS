import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WhatsappTemplatePreview } from './WhatsappTemplatePreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Template Evolution é texto livre — sem categoria/idioma/aprovação da Meta.
// {{1}}, {{2}}, ... funcionam igual ao template Meta (mesma convenção que
// sendTemplateToEvolution já entende, ver evolution-outbound-lib.ts).

interface WhatsappEvolutionTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WhatsappEvolutionTemplateModal: React.FC<WhatsappEvolutionTemplateModalProps> = ({
  open,
  onOpenChange,
}) => {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [nameError, setNameError] = useState('');

  const resetForm = () => {
    setName('');
    setBody('');
    setNameError('');
  };

  const validateName = (value: string) => {
    if (!value) { setNameError('Nome é obrigatório'); return false; }
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
      setNameError('Apenas letras minúsculas, números e underscores. Deve começar com letra.');
      return false;
    }
    setNameError('');
    return true;
  };

  const isValid = () => !!name && !!body.trim() && /^[a-z][a-z0-9_]*$/.test(name);

  const handleCreate = async () => {
    if (!isValid()) return;
    setCreating(true);
    try {
      // slug com sufixo |evolution evita colisão com um template Meta de mesmo nome
      // (slug é UNIQUE na tabela, mas os dois providers coexistem).
      const { error } = await supabase.from('whatsapp_templates').insert({
        name,
        slug: `${name}|evolution`,
        id_template: crypto.randomUUID(),
        provider: 'evolution',
        status: 'approved', // sem aprovação externa — fica usável na hora
        system_enabled: true,
        json_data: {
          components: [{ type: 'BODY', text: body.trim() }],
        },
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template (não-oficial) criado');
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.code === '23505'
        ? 'Já existe um template com esse nome'
        : (err?.message || 'Erro ao criar template');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Novo Template (WhatsApp não-oficial)</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-1">
          <div className="space-y-4">
            <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
              Templates Evolution são só texto pré-configurado — sem aprovação da Meta, sem categoria, sem janela de 24h.
              Use pra FUP e Sends PRO no canal não-oficial.
            </p>

            <div>
              <label className="text-[13px] font-medium text-foreground">Nome do template</label>
              <Input
                value={name}
                onChange={e => { setName(e.target.value); validateName(e.target.value); }}
                placeholder="ex: confirmacao_agendamento_evo"
                className={cn("mt-1 h-[30px] text-[13px] font-mono", nameError && "border-red-400")}
              />
              {nameError && <p className="text-[11px] text-red-500 mt-1">{nameError}</p>}
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">Letras minúsculas, números e underscores</p>
            </div>

            <div>
              <label className="text-[13px] font-medium text-foreground">
                Corpo da mensagem <span className="text-red-400">*</span>
              </label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={"Olá {{1}}, sua consulta está confirmada para {{2}}.\n\nUse {{1}}, {{2}} para variáveis."}
                maxLength={4096}
                rows={7}
                className="mt-1 text-[13px] resize-none"
              />
              <p className="text-[11px] text-muted-foreground/50 mt-0.5 text-right">{body.length}/4096</p>
            </div>

            <div className="pt-2 border-t border-border">
              <Button
                onClick={handleCreate}
                disabled={creating || !isValid()}
                className="w-full h-[30px] text-[13px]"
              >
                {creating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Criando...</>
                ) : (
                  'Criar Template'
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-foreground">Preview</label>
            <WhatsappTemplatePreview components={[{ type: 'BODY', text: body.trim() || 'Texto da mensagem...' }]} />
            <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
              Fica disponível pra uso imediatamente após criar.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
