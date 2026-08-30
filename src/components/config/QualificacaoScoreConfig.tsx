import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MotivosConfig from './MotivosConfig';
import CamposExtrasConfig from './CamposExtrasConfig';
import { ScoreConfig } from './ScoreConfig';

export default function QualificacaoScoreConfig() {
  const [tab, setTab] = useState('motivos');
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-border">
        <p className="text-[15px] font-semibold text-foreground leading-tight">Qualificação e Score</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">Motivos de perda, campos personalizados e pontuação de leads</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          {([
            { value: 'motivos', label: 'Motivos de Perda' },
            { value: 'campos',  label: 'Campos Personalizados' },
            { value: 'score',   label: 'Score Pro' },
          ] as const).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 text-[13px] h-full px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="motivos"><MotivosConfig /></TabsContent>
        <TabsContent value="campos"><CamposExtrasConfig /></TabsContent>
        <TabsContent value="score"><ScoreConfig /></TabsContent>
      </Tabs>
    </div>
  );
}
