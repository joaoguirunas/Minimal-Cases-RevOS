import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useAbExperiments, useAbAssignmentCounts, useCreateAbExperiment, useUpdateAbExperiment,
  usePromoteAbWinner, useFinishAbExperiment,
} from '@/hooks/useAbExperiments';
import type { StageFollowup } from '@/hooks/useFollowups';
import { variantTone, abStatusLabel, expectedSplit } from '@/lib/followups/ab';

interface AbExperimentPanelProps {
  pipelineId: string;
  /** Regras do pipeline — só para o aviso "N regras não vão disparar" quando pausado. */
  followupsDoPipeline: StageFollowup[];
}

/** Painel do teste A/B do pipeline: criar/iniciar/pausar/encerrar, ligado ao StageTimelineCard via ab_variant_id. */
const AbExperimentPanel = ({ pipelineId, followupsDoPipeline }: AbExperimentPanelProps) => {
  const { data: experiments = [] } = useAbExperiments(pipelineId);
  const current = experiments.find((e) => e.status !== 'finished') ?? null;
  const { data: counts = {} } = useAbAssignmentCounts(current?.id);

  const createExperiment = useCreateAbExperiment();
  const updateExperiment = useUpdateAbExperiment();
  const promoteWinner = usePromoteAbWinner();
  const finishExperiment = useFinishAbExperiment();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [nameA, setNameA] = useState('Controle');
  const [nameB, setNameB] = useState('Nova versão');
  const [weightA, setWeightA] = useState(50);

  const [finishOpen, setFinishOpen] = useState(false);
  const [winnerChoice, setWinnerChoice] = useState<string>('none');

  const resetCreateForm = () => {
    setName(''); setHypothesis(''); setNameA('Controle'); setNameB('Nova versão'); setWeightA(50);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createExperiment.mutate({
      pipeline_id: pipelineId,
      name: name.trim(),
      hypothesis: hypothesis.trim() || null,
      variants: [
        { key: 'A', name: nameA.trim() || 'Controle', weight: weightA, is_control: true },
        { key: 'B', name: nameB.trim() || 'Variante B', weight: 100 - weightA, is_control: false },
      ],
    });
    setCreateOpen(false);
    resetCreateForm();
  };

  const openFinish = () => { setWinnerChoice('none'); setFinishOpen(true); };

  const handleFinishConfirm = () => {
    if (!current) return;
    if (winnerChoice !== 'none') {
      promoteWinner.mutate({ experimentId: current.id, winnerVariantId: winnerChoice });
    } else {
      finishExperiment.mutate(current.id);
    }
    setFinishOpen(false);
  };

  if (!current) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[13px] text-foreground">
          Teste A/B: compare duas sequências de toques com leads divididos automaticamente.
        </p>
        <Button size="sm" className="mt-3 h-[30px] rounded-lg text-[12px]" onClick={() => setCreateOpen(true)}>
          Criar teste A/B
        </Button>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-semibold">Criar teste A/B</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Nome do teste</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-[13px]" placeholder="Ex.: Novo texto da 2ª mensagem" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">
                  Hipótese <span className="text-muted-foreground/50">(opcional)</span>
                </Label>
                <Textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} className="min-h-[60px] text-[13px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[12px]">
                    <Chip tone="info">A</Chip> Controle
                  </Label>
                  <Input value={nameA} onChange={(e) => setNameA(e.target.value)} className="h-8 text-[13px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-[12px]">
                    <Chip tone="violet">B</Chip> Variante
                  </Label>
                  <Input value={nameB} onChange={(e) => setNameB(e.target.value)} className="h-8 text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">
                  Divisão de tráfego · A {weightA}% · B {100 - weightA}%
                </Label>
                <Slider value={[weightA]} onValueChange={([v]) => setWeightA(v)} min={0} max={100} step={5} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={createExperiment.isPending || !name.trim()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const pausedRuleCount = followupsDoPipeline.filter(
    (f) => f.ab_variant_id && current.variants.some((v) => v.id === f.ab_variant_id),
  ).length;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">{current.name}</span>
          <Chip tone={current.status === 'running' ? 'success' : current.status === 'paused' ? 'warning' : 'neutral'}>
            {abStatusLabel(current.status)}
          </Chip>
        </div>
        <div className="flex items-center gap-2">
          {current.status === 'draft' && (
            <Button size="sm" className="h-[30px] rounded-lg text-[12px]" onClick={() => updateExperiment.mutate({ id: current.id, status: 'running' })}>
              Iniciar
            </Button>
          )}
          {current.status === 'running' && (
            <>
              <Button size="sm" variant="outline" className="h-[30px] rounded-lg text-[12px]" onClick={() => updateExperiment.mutate({ id: current.id, status: 'paused' })}>
                Pausar
              </Button>
              <Button size="sm" variant="outline" className="h-[30px] rounded-lg text-[12px]" onClick={openFinish}>
                Encerrar…
              </Button>
            </>
          )}
          {current.status === 'paused' && (
            <>
              <Button size="sm" className="h-[30px] rounded-lg text-[12px]" onClick={() => updateExperiment.mutate({ id: current.id, status: 'running' })}>
                Retomar
              </Button>
              <Button size="sm" variant="outline" className="h-[30px] rounded-lg text-[12px]" onClick={openFinish}>
                Encerrar…
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{expectedSplit(current.variants)}</p>

      <div className="flex flex-wrap items-center gap-3">
        {current.variants.map((v) => (
          <div key={v.id} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Chip tone={variantTone(v.key)}>{v.key}</Chip>
            <span>{v.name} · {counts[v.id] ?? 0} leads</span>
          </div>
        ))}
      </div>

      {current.status === 'paused' && pausedRuleCount > 0 && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-500">
          {pausedRuleCount} regra{pausedRuleCount !== 1 ? 's' : ''} de variante não {pausedRuleCount !== 1 ? 'vão' : 'vai'} disparar enquanto o teste estiver pausado.
        </p>
      )}

      <Link to="/dashboard" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
        Ver resultados no BI <ExternalLink className="h-3 w-3" />
      </Link>

      <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar teste A/B</AlertDialogTitle>
            <AlertDialogDescription>
              Regras da vencedora viram comuns; as das outras variantes ficam inativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup value={winnerChoice} onValueChange={setWinnerChoice} className="gap-2 py-2">
            {current.variants.map((v) => (
              <label key={v.id} htmlFor={`winner-${v.id}`} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <RadioGroupItem value={v.id} id={`winner-${v.id}`} />
                Promover vencedora: {v.key}
              </label>
            ))}
            <label htmlFor="winner-none" className="flex cursor-pointer items-center gap-2 text-[13px]">
              <RadioGroupItem value="none" id="winner-none" />
              Encerrar sem vencedora
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishConfirm}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AbExperimentPanel;
