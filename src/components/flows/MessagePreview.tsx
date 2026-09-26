// src/components/flows/MessagePreview.tsx
export function WhatsAppPreview({ body, coupon }: { body: string; coupon: boolean }) {
  const text = body.replace(/\{\{1\}\}/g, 'Ana').replace(/\{\{2\}\}/g, 'Case Minimal Preta').replace(/\{\{3\}\}/g, coupon ? 'ANA15' : '—').replace(/\{\{4\}\}/g, '29/09 às 14:30');
  return (
    <div className="rounded-xl bg-[#efeae2] p-3 dark:bg-[#0b141a]">
      <div className="ml-auto max-w-[260px] whitespace-pre-wrap rounded-lg rounded-tr-none bg-white px-3 py-2 text-[12.5px] leading-snug text-[#111] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]"
        dangerouslySetInnerHTML={{ __html: text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)).replace(/\*(.+?)\*/g, '<b>$1</b>') }} />
    </div>
  );
}
export function EmailPreview({ templateId }: { templateId: string }) {
  if (!templateId) return null;
  return <p className="text-[12px] text-muted-foreground">Pré-visualização completa no editor de templates de e-mail (Configurações → E-mail).</p>;
}
