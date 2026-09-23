// src/components/bi/FunnelChart.tsx
export function FunnelChart({ steps }: { steps: { step: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? s.value / prev : null;
        return (
          <div key={s.step} className="space-y-1">
            <div className="flex justify-between text-[12px]">
              <span className="text-foreground">{s.step}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.value.toLocaleString('pt-BR')}{conv != null && <span className="ml-2">({(conv * 100).toFixed(1)}% da etapa anterior)</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
