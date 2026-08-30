import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OmniDedupHealthConfig from './OmniDedupHealthConfig';

export default function OmniGeralConfig() {
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-border">
        <p className="text-[15px] font-semibold text-foreground leading-tight">Geral</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">Configurações gerais do OMNI PRO</p>
      </div>

      <Tabs defaultValue="dedup" className="space-y-5">
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          <TabsTrigger
            value="dedup"
            className="flex-1 text-[13px] h-full px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Dedup Health
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dedup">
          <OmniDedupHealthConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
