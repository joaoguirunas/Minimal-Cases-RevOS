/** Tema único dos gráficos recharts — raio 12, tokens do design Minimal. */
export const chartTheme = {
  tooltipStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    fontSize: 12,
    padding: '8px 12px',
    boxShadow: 'none',
  } as const,
  tooltipLabelStyle: { color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 4 } as const,
  axisTick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const,
  gridStroke: 'hsl(var(--border))',
  colors: {
    primary: 'hsl(var(--primary))',
    muted: 'hsl(var(--muted-foreground))',
    chart: [1, 2, 3, 4, 5].map((i) => `hsl(var(--chart-${i}))`),
  },
};
