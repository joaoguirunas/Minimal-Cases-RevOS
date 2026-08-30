import React from "react";
import { MessageCircle, Bot, Mail, Phone, User } from "lucide-react";

interface NegocioBadgesProps {
  ultimoCanal?: 'whatsapp' | 'email' | 'telefone';
  ultimaMensagemOrigem?: 'humano' | 'ia' | 'followup' | 'cliente';
}

const NegocioBadges = ({ ultimoCanal, ultimaMensagemOrigem }: NegocioBadgesProps) => {
  const badges = [];

  // Badge do último canal (se houver)
  if (ultimoCanal === 'whatsapp') {
    badges.push(
      <div key="whatsapp" className="flex items-center justify-center w-4 h-4 bg-[#00D26A] rounded-[4px]" title="WhatsApp">
        <MessageCircle className="w-2 h-2 text-white" />
      </div>
    );
  } else if (ultimoCanal === 'email') {
    badges.push(
      <div key="email" className="flex items-center justify-center w-4 h-4 bg-[#3B82F6] rounded-[4px]" title="Email">
        <Mail className="w-2 h-2 text-white" />
      </div>
    );
  } else if (ultimoCanal === 'telefone') {
    badges.push(
      <div key="telefone" className="flex items-center justify-center w-4 h-4 bg-[#EF4444] rounded-[4px]" title="Telefone">
        <Phone className="w-2 h-2 text-white" />
      </div>
    );
  }

  // Badge da origem da última mensagem
  if (ultimaMensagemOrigem === 'ia') {
    badges.push(
      <div 
        key="ia" 
        className="flex items-center justify-center w-4 h-4 bg-[#8B5CF6] rounded-[4px]"
        title="IA"
      >
        <Bot className="w-2 h-2 text-white" />
      </div>
    );
  } else if (ultimaMensagemOrigem === 'humano') {
    badges.push(
      <div key="humano" className="flex items-center justify-center w-4 h-4 bg-muted-foreground/60 rounded-[4px]" title="Agente">
        <User className="w-2 h-2 text-white" />
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      {badges}
    </div>
  );
};

export default NegocioBadges;