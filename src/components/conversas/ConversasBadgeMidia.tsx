import { Bot, Mail, Phone, Instagram } from "lucide-react";

const TikTokSvg = () => (
  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current shrink-0" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
  </svg>
);

interface ConversasBadgeMidiaProps {
  whatsapp?: string;
  email?: string;
  telefone?: string;
  instagram?: string;
  tiktok?: string;
  temBot?: boolean;
  canal?: string;
}

const WaSvg = () => (
  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-current shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const ConversasBadgeMidia = ({
  whatsapp,
  email,
  telefone,
  instagram,
  tiktok,
  temBot,
  canal,
}: ConversasBadgeMidiaProps) => {
  const showWa     = canal ? canal === 'whatsapp'  && !!whatsapp  : !!whatsapp;
  const showIg     = canal ? canal === 'instagram' && !!instagram : !!instagram;
  const showMail   = canal ? canal === 'email'     && !!email     : !!email;
  const showTel    = canal ? canal === 'telefone'  && !!telefone  : !!telefone;
  const showTiktok = canal ? canal === 'tiktok'    && !!tiktok    : !!tiktok;

  const hasSomething = showWa || showIg || showMail || showTel || showTiktok || temBot;
  if (!hasSomething) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {showWa && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-green-500/15 text-green-700 dark:text-green-400 border-green-300/40">
          <WaSvg />WA
        </span>
      )}
      {showIg && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-300/40">
          <Instagram className="w-2.5 h-2.5 shrink-0" />IG
        </span>
      )}
      {showMail && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-[#B8924B]/15 text-[#7A5C24] dark:text-[#D4B071] border-[#B8924B]/30">
          <Mail className="w-2.5 h-2.5 shrink-0" />Email
        </span>
      )}
      {showTel && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-300/40">
          <Phone className="w-2.5 h-2.5 shrink-0" />Tel
        </span>
      )}
      {showTiktok && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300/40">
          <TikTokSvg />TT
        </span>
      )}
      {temBot && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold leading-none bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-300/40">
          <Bot className="w-2.5 h-2.5 shrink-0" />IA
        </span>
      )}
    </div>
  );
};

export default ConversasBadgeMidia;
