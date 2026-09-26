// src/pages/Descadastro.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, MailX, CheckCircle2 } from 'lucide-react';

const FN = 'https://maigkwlgzinykfvemexf.supabase.co/functions/v1/email-unsubscribe';
type State = { phase: 'loading' | 'ask' | 'done' | 'invalid' | 'error'; email?: string };

async function call(token: string, action: 'peek' | 'unsubscribe') {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action }) });
  return r.json() as Promise<{ ok: boolean; email?: string; status?: string }>;
}

export default function Descadastro() {
  const { token = '' } = useParams();
  const [s, setS] = useState<State>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call(token, 'peek').then((r) => setS(!r.ok ? { phase: 'invalid' } : { phase: r.status === 'subscribed' ? 'ask' : 'done', email: r.email }))
      .catch(() => setS({ phase: 'error' }));
  }, [token]);
  const confirm = async () => {
    setBusy(true);
    try { const r = await call(token, 'unsubscribe'); setS(r.ok ? { phase: 'done', email: r.email } : { phase: 'invalid' }); }
    catch { setS({ phase: 'error' }); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-[#f5f4f1] text-[#111] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-black/[0.07] p-8 text-center shadow-sm">
        <p className="text-[13px] tracking-[0.2em] uppercase text-black/50 mb-6">Minimal Cases</p>
        {s.phase === 'loading' && <Loader2 className="mx-auto size-6 animate-spin text-black/40" />}
        {s.phase === 'ask' && (<>
          <MailX className="mx-auto size-9 text-black/70" />
          <h1 className="mt-4 text-[22px] font-semibold">Não quer mais receber nossos e-mails?</h1>
          <p className="mt-2 text-[14px] text-black/60">Vamos parar de enviar e-mails para <b className="text-black">{s.email}</b>. Pedidos e rastreio continuam chegando normalmente.</p>
          <button onClick={confirm} disabled={busy} className="mt-6 w-full rounded-full bg-[#111] text-white py-3 text-[14px] font-medium disabled:opacity-60">
            {busy ? 'Confirmando…' : 'Não quero mais receber e-mails'}
          </button>
          <a href="https://minimalcases.com.br" className="mt-3 block text-[13px] text-black/50 underline-offset-4 hover:underline">Quero continuar recebendo</a>
        </>)}
        {s.phase === 'done' && (<>
          <CheckCircle2 className="mx-auto size-9 text-emerald-600" />
          <h1 className="mt-4 text-[22px] font-semibold">Pronto, você saiu da lista</h1>
          <p className="mt-2 text-[14px] text-black/60">{s.email ? <><b className="text-black">{s.email}</b> não vai mais receber </> : 'Você não vai mais receber '}e-mails promocionais da Minimal Cases.</p>
          <a href="https://minimalcases.com.br" className="mt-6 inline-block rounded-full border border-black/15 px-6 py-2.5 text-[14px]">Ir para a loja</a>
        </>)}
        {(s.phase === 'invalid' || s.phase === 'error') && (<>
          <h1 className="text-[20px] font-semibold">{s.phase === 'invalid' ? 'Link inválido ou expirado' : 'Algo deu errado'}</h1>
          <p className="mt-2 text-[14px] text-black/60">Para sair da lista, responda qualquer e-mail nosso com "descadastrar" ou fale com contato@minimalcases.com.br.</p>
        </>)}
      </div>
    </div>
  );
}
