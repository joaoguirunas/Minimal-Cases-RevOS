import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, MessageCircle, Instagram } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getSimularConversaData } from '@/hooks/useSimularConversa';
import { Badge } from '@/components/ui/badge';

interface ConversaDemoEduardoProps {
  onVoltar?: () => void;
  isFullScreen?: boolean;
}

export function ConversaDemoEduardo({ onVoltar, isFullScreen = false }: ConversaDemoEduardoProps) {
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { mensagens: simuladas, pessoa } = getSimularConversaData();

  useEffect(() => {
    if (isAnimating) {
      // Animar mensagens uma por uma
      simuladas.forEach((msg, idx) => {
        setTimeout(() => {
          setMensagens((prev) => [...prev, msg]);
        }, idx * 800); // 800ms entre mensagens
      });
    } else {
      setMensagens(simuladas);
    }
  }, [isAnimating, simuladas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const handleEnviarMensagem = () => {
    if (!novaMensagem.trim()) return;

    const newMsg = {
      id: mensagens.length + 1,
      content: novaMensagem,
      from_contact: 'humano' as const,
      channel: 'instagram' as const,
      message_type: 'texto' as const,
      created_at: new Date().toISOString(),
    };

    setMensagens((prev) => [...prev, newMsg]);
    setNovaMensagem('');

    // Simular resposta automática após delay
    setTimeout(() => {
      const respostas = [
        'Entendi! Deixa eu anotar isso aqui.',
        'Ótimo feedback! Vou considerar.',
        'Perfeito! Quando você quer continuar?',
        'Tudo bem, sem problemas! 👍',
      ];

      const respostaAleatoria = respostas[Math.floor(Math.random() * respostas.length)];

      setMensagens((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          content: respostaAleatoria,
          from_contact: 'ia' as const,
          channel: 'instagram' as const,
          message_type: 'texto' as const,
          created_at: new Date().toISOString(),
          metadata: { bot_name: 'Assistant', confidence: 0.95 },
        },
      ]);
    }, 1500);
  };

  const containerClass = isFullScreen ? 'h-screen flex flex-col' : 'h-[600px] flex flex-col';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="border-b border-border bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onVoltar && (
            <Button variant="ghost" size="icon" onClick={onVoltar}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <Avatar className="w-10 h-10">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Eduardo" />
            <AvatarFallback>EF</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{pessoa.name}</h3>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Instagram className="w-3 h-3 text-pink-500" />
                Instagram DM
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Ativo agora</p>
          </div>
        </div>
        <Badge className="bg-green-500/20 text-green-700 border-green-300/40">Score: 78</Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p>Carregando conversa de demo...</p>
            <p className="text-xs mt-2">Clique em "Reiniciar" para ver as mensagens</p>
          </div>
        ) : (
          <>
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                  msg.from_contact === 'humano' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.from_contact === 'ia' && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src="https://api.dicebear.com/7.x/bottts/svg?seed=assistant" />
                    <AvatarFallback>AS</AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-xs px-4 py-2 rounded-[2px] ${
                    msg.from_contact === 'humano'
                      ? 'bg-primary text-white'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.from_contact === 'humano'
                        ? 'text-[#E2C892]'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4 flex gap-2">
        <Input
          placeholder="Digite uma mensagem (simulada)..."
          value={novaMensagem}
          onChange={(e) => setNovaMensagem(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleEnviarMensagem()}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleEnviarMensagem}
          disabled={!novaMensagem.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Demo Controls */}
      <div className="border-t border-border bg-card px-4 py-2 flex gap-2 text-xs">
        <Badge variant="secondary">DEMO</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMensagens([]);
            setIsAnimating(!isAnimating);
          }}
        >
          {isAnimating ? 'Reiniciar' : 'Parar'}
        </Button>
        <span className="text-muted-foreground">
          Exibindo {mensagens.length} de {simuladas.length} mensagens
        </span>
      </div>
    </div>
  );
}
