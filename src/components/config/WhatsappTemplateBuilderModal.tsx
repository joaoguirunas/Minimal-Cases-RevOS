import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WhatsappTemplatePreview } from './WhatsappTemplatePreview';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Trash2, ArrowLeft, Calendar, MessageSquare, UserPlus, Clock, Star, FileText,
  RefreshCw, XCircle, CheckCircle, CreditCard, Receipt, FileSignature, Package, Key, Mail,
  Handshake, BarChart3, PartyPopper, Megaphone, BookOpen, Gift, Award, Rocket, Cake, Users,
  HeartHandshake, Monitor, ClipboardCheck, TrendingUp, Newspaper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Template Presets ─────────────────────────────────────────────────────────

interface TemplatePreset {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  header: string;
  body: string;
  footer: string;
  buttons: ButtonItem[];
  variables: string[];
  /** Example values for Meta API review — one per variable, in order */
  examples: string[];
}

interface ButtonItem {
  type: 'QUICK_REPLY' | 'URL';
  text: string;
  url: string;
}

const PRESETS: TemplatePreset[] = [
  // ── Agendamento ──────────────────────────────────────────────────────────
  {
    id: 'confirmacao_reuniao',
    label: 'Confirmação de Agendamento',
    description: 'Confirma reunião com data, hora e link do Google Meet',
    icon: <Calendar className="h-5 w-5" />,
    name: 'confirmacao_reuniao',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, sua reunião foi confirmada para o dia {{2}} às {{3}}.\n\nCaso precise reagendar, entre em contato.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar reunião', url: 'https://meet.google.com/{{1}}' },
    ],
    variables: ['Nome do contato', 'Data da reunião', 'Horário da reunião'],
    examples: ['João Silva', '20/03/2026', '14:00'],
  },
  {
    id: 'lembrete_reuniao',
    label: 'Lembrete de Reunião',
    description: 'Lembra o contato antes da reunião',
    icon: <Clock className="h-5 w-5" />,
    name: 'lembrete_reuniao',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, este é um lembrete da sua reunião do dia {{2}} às {{3}}.\n\nNos vemos em breve!',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar reunião', url: 'https://meet.google.com/{{1}}' },
    ],
    variables: ['Nome do contato', 'Data da reunião', 'Horário da reunião'],
    examples: ['Maria Santos', '20/03/2026', '14:00'],
  },
  {
    id: 'reagendamento_reuniao',
    label: 'Reagendamento de Reunião',
    description: 'Informa nova data/hora após reagendamento',
    icon: <RefreshCw className="h-5 w-5" />,
    name: 'reagendamento_reuniao',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, sua reunião foi reagendada para o dia {{2}} às {{3}}.\n\nQualquer dúvida, estou à disposição.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar reunião', url: 'https://meet.google.com/{{1}}' },
    ],
    variables: ['Nome do contato', 'Nova data', 'Novo horário'],
    examples: ['Carlos Pereira', '25/03/2026', '10:00'],
  },
  {
    id: 'cancelamento_reuniao',
    label: 'Cancelamento de Reunião',
    description: 'Notifica cancelamento e oferece reagendamento',
    icon: <XCircle className="h-5 w-5" />,
    name: 'cancelamento_reuniao',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, informamos que a reunião do dia {{2}} às {{3}} foi cancelada.\n\nCaso queira reagendar, entre em contato conosco. Pedimos desculpas pelo inconveniente.',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero reagendar', url: '' },
    ],
    variables: ['Nome do contato', 'Data original', 'Horário original'],
    examples: ['Ana Costa', '20/03/2026', '14:00'],
  },
  {
    id: 'pos_reuniao',
    label: 'Pós-Reunião / Follow-up',
    description: 'Agradecimento e próximos passos após reunião',
    icon: <Star className="h-5 w-5" />,
    name: 'pos_reuniao_followup',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, obrigado pelo seu tempo hoje!\n\nComo combinado, seguem os próximos passos: {{2}}\n\nQualquer dúvida, estou à disposição.',
    footer: '',
    buttons: [],
    variables: ['Nome do contato', 'Resumo dos próximos passos'],
    examples: ['João Silva', 'Enviaremos a proposta até sexta-feira'],
  },
  // ── Comercial / Vendas ───────────────────────────────────────────────────
  {
    id: 'envio_proposta',
    label: 'Envio de Proposta',
    description: 'Notifica envio de proposta comercial com link',
    icon: <FileText className="h-5 w-5" />,
    name: 'envio_proposta_comercial',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, conforme conversamos, preparamos uma proposta personalizada para você.\n\nFico no aguardo do seu retorno para avançarmos!',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Ver proposta', url: 'https://app.exemplo.com/proposta/123' },
      { type: 'QUICK_REPLY', text: 'Tenho dúvidas', url: '' },
    ],
    variables: ['Nome do contato'],
    examples: ['Maria Santos'],
  },
  {
    id: 'proposta_aprovada',
    label: 'Proposta Aprovada',
    description: 'Confirma aprovação e próximos passos do contrato',
    icon: <CheckCircle className="h-5 w-5" />,
    name: 'proposta_aprovada',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, sua proposta foi aprovada!\n\nPróximos passos: {{2}}\n\nEntraremos em contato em breve para formalizar.',
    footer: '',
    buttons: [],
    variables: ['Nome do contato', 'Próximos passos'],
    examples: ['Carlos Pereira', 'Assinatura do contrato e emissão de nota fiscal'],
  },
  {
    id: 'boleto_gerado',
    label: 'Boleto Gerado',
    description: 'Envia link do boleto para pagamento',
    icon: <CreditCard className="h-5 w-5" />,
    name: 'boleto_gerado',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, seu boleto no valor de {{2}} foi gerado com vencimento em {{3}}.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar boleto', url: 'https://app.exemplo.com/boleto/123' },
    ],
    variables: ['Nome do contato', 'Valor do boleto', 'Data de vencimento'],
    examples: ['Ana Costa', 'R$ 1.500,00', '25/03/2026'],
  },
  {
    id: 'pagamento_confirmado',
    label: 'Pagamento Confirmado',
    description: 'Confirma recebimento do pagamento',
    icon: <Receipt className="h-5 w-5" />,
    name: 'pagamento_confirmado',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, confirmamos o recebimento do seu pagamento no valor de {{2}}, referente a {{3}}.\n\nObrigado pela confiança!',
    footer: '',
    buttons: [],
    variables: ['Nome do contato', 'Valor pago', 'Referência do serviço'],
    examples: ['João Silva', 'R$ 1.500,00', 'Consultoria março/2026'],
  },
  {
    id: 'contrato_assinado',
    label: 'Contrato para Assinatura',
    description: 'Envia link do contrato digital para assinatura',
    icon: <FileSignature className="h-5 w-5" />,
    name: 'contrato_assinado',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, seu contrato está pronto para assinatura. Acesse o link abaixo para revisar e assinar digitalmente.\n\nQualquer dúvida, estamos à disposição.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Assinar contrato', url: 'https://app.exemplo.com/contrato/123' },
    ],
    variables: ['Nome do contato'],
    examples: ['Maria Santos'],
  },
  {
    id: 'status_pedido',
    label: 'Status do Pedido',
    description: 'Atualiza o cliente sobre o andamento do pedido',
    icon: <Package className="h-5 w-5" />,
    name: 'status_pedido',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, segue atualização do seu pedido {{2}}.\n\nStatus atual: {{3}}',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acompanhar pedido', url: 'https://app.exemplo.com/pedido/123' },
    ],
    variables: ['Nome do contato', 'Número do pedido', 'Status atual'],
    examples: ['Carlos Pereira', '#4521', 'Em processamento'],
  },
  {
    id: 'credenciais_acesso',
    label: 'Credenciais de Acesso',
    description: 'Envia dados de acesso à plataforma/sistema',
    icon: <Key className="h-5 w-5" />,
    name: 'credenciais_acesso',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, seus dados de acesso à plataforma {{2}} estão prontos.\n\nSeu login é: {{3}}\n\nRecomendamos alterar sua senha no primeiro acesso.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar plataforma', url: 'https://app.exemplo.com/login' },
    ],
    variables: ['Nome do contato', 'Nome da plataforma', 'Login ou e-mail'],
    examples: ['Ana Costa', 'GrowthSales', 'ana.costa@email.com'],
  },
  {
    id: 'nota_fiscal_enviada',
    label: 'Nota Fiscal Enviada',
    description: 'Notifica envio da nota fiscal com link de download',
    icon: <Mail className="h-5 w-5" />,
    name: 'nota_fiscal_enviada',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, sua nota fiscal referente a {{2}} está disponível para download.\n\nEm caso de dúvidas, entre em contato.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Baixar nota fiscal', url: 'https://app.exemplo.com/nf/123' },
    ],
    variables: ['Nome do contato', 'Referência ou mês'],
    examples: ['João Silva', 'março/2026'],
  },
  // ── Onboarding / Relacionamento ──────────────────────────────────────────
  {
    id: 'onboarding_boas_vindas',
    label: 'Boas-vindas (Onboarding)',
    description: 'Mensagem de boas-vindas para novos clientes',
    icon: <Handshake className="h-5 w-5" />,
    name: 'onboarding_boas_vindas',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, seja muito bem-vindo(a) à {{2}}!\n\nEstamos felizes em ter você conosco. Seu ponto de contato é {{3}}.\n\nQualquer dúvida, é só chamar!',
    footer: '',
    buttons: [],
    variables: ['Nome do cliente', 'Nome da empresa', 'Nome do responsável'],
    examples: ['Maria Santos', 'GrowthSales', 'Carlos Pereira'],
  },
  {
    id: 'pesquisa_satisfacao',
    label: 'Pesquisa de Satisfação',
    description: 'NPS / feedback pós-atendimento ou projeto',
    icon: <BarChart3 className="h-5 w-5" />,
    name: 'pesquisa_satisfacao',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, como foi sua experiência conosco?\n\nSua opinião é muito importante para continuarmos melhorando. Responda nossa pesquisa rápida — leva menos de 1 minuto.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Responder pesquisa', url: 'https://app.exemplo.com/pesquisa/123' },
    ],
    variables: ['Nome do contato'],
    examples: ['Ana Costa'],
  },
  {
    id: 'resultado_diagnostico',
    label: 'Resultado de Diagnóstico',
    description: 'Envia resultado de análise ou diagnóstico para o lead',
    icon: <ClipboardCheck className="h-5 w-5" />,
    name: 'resultado_diagnostico',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, finalizamos a análise do seu {{2}}.\n\nResumo: {{3}}',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Ver relatório completo', url: 'https://app.exemplo.com/relatorio/123' },
    ],
    variables: ['Nome do contato', 'Tipo de diagnóstico', 'Resumo dos pontos'],
    examples: ['Carlos Pereira', 'diagnóstico comercial', 'Oportunidade de melhoria em 3 áreas-chave'],
  },
  {
    id: 'feedback_pos_trial',
    label: 'Feedback Pós-Trial',
    description: 'Coleta feedback após período de teste gratuito',
    icon: <TrendingUp className="h-5 w-5" />,
    name: 'feedback_pos_trial',
    category: 'UTILITY',
    header: '',
    body: 'Olá {{1}}, seu período de teste de {{2}} terminou.\n\nGostaríamos de saber sua experiência! Qual sua impressão sobre a ferramenta?',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero assinar', url: '' },
      { type: 'QUICK_REPLY', text: 'Tenho dúvidas', url: '' },
      { type: 'QUICK_REPLY', text: 'Não atendeu', url: '' },
    ],
    variables: ['Nome do contato', 'Nome do produto ou plano'],
    examples: ['João Silva', 'GrowthSales Pro'],
  },
  // ── Marketing ────────────────────────────────────────────────────────────
  {
    id: 'abertura_conversa',
    label: 'Abertura de Conversa',
    description: 'Primeiro contato com lead — apresentação e interesse',
    icon: <MessageSquare className="h-5 w-5" />,
    name: 'abertura_conversa',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, sou {{2}} da {{3}}. Vi que você demonstrou interesse em nossos serviços.\n\nGostaria de entender melhor suas necessidades para ver como podemos ajudar. Podemos conversar?',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Sim, vamos conversar', url: '' },
      { type: 'QUICK_REPLY', text: 'Agora não', url: '' },
    ],
    variables: ['Nome do lead', 'Nome do vendedor', 'Nome da empresa'],
    examples: ['Maria Santos', 'Carlos Pereira', 'GrowthSales'],
  },
  {
    id: 'retomar_conversa',
    label: 'Retomar Conversa',
    description: 'Reabrir conversa com lead que parou de responder',
    icon: <UserPlus className="h-5 w-5" />,
    name: 'retomar_conversa_v2',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, passando para saber se ainda tem interesse no que conversamos.\n\nEstamos com condições especiais esta semana e gostaria de te apresentar. Posso te explicar rapidamente?',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Sim, me conte mais', url: '' },
      { type: 'QUICK_REPLY', text: 'Não tenho interesse', url: '' },
    ],
    variables: ['Nome do lead'],
    examples: ['Ana Costa'],
  },
  {
    id: 'convite_evento',
    label: 'Convite para Evento',
    description: 'Convida para webinar, workshop ou evento presencial',
    icon: <PartyPopper className="h-5 w-5" />,
    name: 'convite_evento',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, temos um evento especial para você!\n\nEvento: {{2}}\nData e horário: {{3}}\nLocal: {{4}}\n\nVagas limitadas — garanta a sua!',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero participar', url: '' },
      { type: 'QUICK_REPLY', text: 'Mais informações', url: '' },
    ],
    variables: ['Nome do contato', 'Nome do evento', 'Data e horário', 'Local ou formato'],
    examples: ['João Silva', 'Workshop de Vendas Digitais', '25/03/2026 às 19h', 'Online via Google Meet'],
  },
  {
    id: 'conteudo_educativo',
    label: 'Conteúdo Educativo',
    description: 'Compartilha artigo, e-book ou material relevante',
    icon: <BookOpen className="h-5 w-5" />,
    name: 'conteudo_educativo',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, preparamos um conteúdo que pode te ajudar: {{2}}.\n\n{{3}}',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Acessar conteúdo', url: 'https://app.exemplo.com/conteudo/123' },
    ],
    variables: ['Nome do contato', 'Título do material', 'Breve descrição'],
    examples: ['Maria Santos', 'Guia: 10 Estratégias de Prospecção', 'Um guia prático para aumentar suas vendas em 2026'],
  },
  {
    id: 'oferta_exclusiva',
    label: 'Oferta Exclusiva',
    description: 'Promoção ou desconto especial por tempo limitado',
    icon: <Gift className="h-5 w-5" />,
    name: 'oferta_exclusiva',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, temos uma oferta exclusiva para você!\n\n{{2}}\n\nCondição válida até {{3}}. Aproveite!',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tenho interesse', url: '' },
      { type: 'QUICK_REPLY', text: 'Não, obrigado', url: '' },
    ],
    variables: ['Nome do contato', 'Descrição da oferta', 'Data limite'],
    examples: ['Carlos Pereira', '30% de desconto no plano anual', '31/03/2026'],
  },
  {
    id: 'case_sucesso',
    label: 'Case de Sucesso',
    description: 'Compartilha resultado de cliente para gerar prova social',
    icon: <Award className="h-5 w-5" />,
    name: 'case_sucesso',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, quero compartilhar um resultado incrível! {{2}} conseguiu {{3}} usando nossa solução.\n\nQuer saber como aplicar isso no seu negócio?',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Sim, me conte mais', url: '' },
      { type: 'QUICK_REPLY', text: 'Agora não', url: '' },
    ],
    variables: ['Nome do contato', 'Nome do cliente case', 'Resultado alcançado'],
    examples: ['Ana Costa', 'Empresa XYZ', 'aumentar as vendas em 40% em 3 meses'],
  },
  {
    id: 'lancamento_produto',
    label: 'Lançamento de Produto',
    description: 'Anuncia novo produto, serviço ou funcionalidade',
    icon: <Rocket className="h-5 w-5" />,
    name: 'lancamento_produto',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, acabamos de lançar {{2}}!\n\n{{3}}\n\nSeja um dos primeiros a experimentar.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Conhecer agora', url: 'https://app.exemplo.com/lancamento' },
    ],
    variables: ['Nome do contato', 'Nome do produto ou serviço', 'Descrição breve'],
    examples: ['João Silva', 'o GrowthSales Pro', 'Automação de vendas com inteligência artificial para triplicar sua produtividade'],
  },
  {
    id: 'feliz_aniversario',
    label: 'Feliz Aniversário',
    description: 'Parabeniza o contato no dia do aniversário',
    icon: <Cake className="h-5 w-5" />,
    name: 'feliz_aniversario',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, a equipe da {{2}} deseja um feliz aniversário!\n\nQue este novo ciclo seja cheio de realizações. Como presente, preparamos algo especial: {{3}}',
    footer: '',
    buttons: [],
    variables: ['Nome do contato', 'Nome da empresa', 'Descrição do presente ou desconto'],
    examples: ['Maria Santos', 'GrowthSales', '20% de desconto válido por 7 dias'],
  },
  {
    id: 'indicacao_programa',
    label: 'Programa de Indicação',
    description: 'Convida o cliente a indicar amigos/empresas',
    icon: <Users className="h-5 w-5" />,
    name: 'indicacao_programa',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, você sabia que pode ganhar benefícios indicando a {{2}}?\n\n{{3}}\n\nIndique amigos e comece a ganhar hoje mesmo!',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero indicar', url: '' },
      { type: 'QUICK_REPLY', text: 'Como funciona?', url: '' },
    ],
    variables: ['Nome do contato', 'Nome da empresa', 'Descrição do benefício'],
    examples: ['Carlos Pereira', 'GrowthSales', 'Ganhe 1 mês grátis para cada indicação que se tornar cliente'],
  },
  {
    id: 'reativacao_cliente',
    label: 'Reativação de Cliente',
    description: 'Recupera clientes inativos com incentivo especial',
    icon: <HeartHandshake className="h-5 w-5" />,
    name: 'reativacao_cliente',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, faz tempo que não conversamos!\n\nPreparamos algo especial para o seu retorno: {{2}}\n\nVálido até {{3}}. Vamos retomar?',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Vamos conversar', url: '' },
      { type: 'QUICK_REPLY', text: 'Não tenho interesse', url: '' },
    ],
    variables: ['Nome do contato', 'Oferta de reativação', 'Data limite'],
    examples: ['Ana Costa', '50% de desconto nos 3 primeiros meses', '31/03/2026'],
  },
  {
    id: 'convite_demo',
    label: 'Convite para Demo',
    description: 'Convida para demonstração do produto ou serviço',
    icon: <Monitor className="h-5 w-5" />,
    name: 'convite_demo',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, gostaria de ver {{2}} funcionando na prática?\n\nAgende uma demonstração gratuita e descubra como podemos ajudar seu negócio. Duração de aproximadamente 30 minutos.',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero agendar', url: '' },
      { type: 'QUICK_REPLY', text: 'Me envie mais info', url: '' },
    ],
    variables: ['Nome do contato', 'Nome do produto ou serviço'],
    examples: ['João Silva', 'o GrowthSales'],
  },
  {
    id: 'upgrade_plano',
    label: 'Upgrade de Plano',
    description: 'Sugere upgrade com benefícios do plano superior',
    icon: <TrendingUp className="h-5 w-5" />,
    name: 'upgrade_plano',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, notamos que você está aproveitando bem o plano {{2}}!\n\nCom o plano {{3}}, você terá acesso a ainda mais recursos. Fale conosco para condições especiais de upgrade.',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Quero saber mais', url: '' },
      { type: 'QUICK_REPLY', text: 'Estou bem no atual', url: '' },
    ],
    variables: ['Nome do contato', 'Plano atual', 'Plano superior'],
    examples: ['Maria Santos', 'Starter', 'Pro'],
  },
  {
    id: 'newsletter_mensal',
    label: 'Newsletter Mensal',
    description: 'Resumo mensal com novidades e destaques',
    icon: <Newspaper className="h-5 w-5" />,
    name: 'newsletter_mensal',
    category: 'MARKETING',
    header: '',
    body: 'Olá {{1}}, confira os destaques deste mês!\n\n{{2}}\n\nLeia mais no nosso blog.',
    footer: '',
    buttons: [
      { type: 'URL', text: 'Ver novidades', url: 'https://app.exemplo.com/blog' },
    ],
    variables: ['Nome do contato', 'Resumo das novidades'],
    examples: ['Carlos Pereira', 'Novo módulo de automação lançado e integração com Google Calendar disponível'],
  },
  // ── Curso Agents ─────────────────────────────────────────────────────────
  {
    id: 'inicio_compra_curso_agents_b',
    label: 'Início de Compra — Curso Agents (B)',
    description: 'Enviado quando alguém inicia a compra do curso de Agentes IA',
    icon: <Rocket className="h-5 w-5" />,
    name: 'inicio_compra_curso_agents_b',
    category: 'MARKETING',
    header: '',
    body: 'Oi {{1}}! Aqui é o clone do João Guirunas 🤖 Vimos que você está quase lá no curso de Agentes IA. Qualquer dúvida, é só falar!',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tenho uma dúvida', url: '' },
    ],
    variables: ['Nome do contato'],
    examples: ['Maria'],
  },
  {
    id: 'inicio_compra_curso_agents_c',
    label: 'Início de Compra — Curso Agents (C)',
    description: 'Tom mais leve e próximo para quem iniciou a compra do curso',
    icon: <Rocket className="h-5 w-5" />,
    name: 'inicio_compra_curso_agents_c',
    category: 'MARKETING',
    header: '',
    body: 'Oi {{1}}! Fala, aqui é o clone do João 🤖 Vi que você deu o primeiro passo para montar sua squad de agentes de IA. Qualquer dúvida antes de finalizar, pode me chamar!',
    footer: '',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Tenho uma dúvida', url: '' },
    ],
    variables: ['Nome do contato'],
    examples: ['Pedro'],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface WhatsappTemplateBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
}

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'UTILITY', label: 'Utilidade' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
];

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'English (US)' },
  { value: 'es', label: 'Español' },
];

export const WhatsappTemplateBuilderModal: React.FC<WhatsappTemplateBuilderModalProps> = ({
  open,
  onOpenChange,
  channelId,
}) => {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<'select' | 'edit'>('select');
  const [selectedPreset, setSelectedPreset] = useState<TemplatePreset | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('pt_BR');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<ButtonItem[]>([]);
  const [variableHints, setVariableHints] = useState<string[]>([]);
  const [exampleValues, setExampleValues] = useState<string[]>([]);
  const [purpose, setPurpose] = useState<string>('none');

  const [nameError, setNameError] = useState('');
  const [presetFilter, setPresetFilter] = useState<'all' | 'UTILITY' | 'MARKETING'>('all');

  const resetForm = () => {
    setName('');
    setCategory('MARKETING');
    setLanguage('pt_BR');
    setHeader('');
    setBody('');
    setFooter('');
    setButtons([]);
    setNameError('');
    setVariableHints([]);
    setExampleValues([]);
    setPurpose('none');
    setStep('select');
    setSelectedPreset(null);
  };

  const applyPreset = (preset: TemplatePreset) => {
    setSelectedPreset(preset);
    setName(preset.name);
    setCategory(preset.category);
    setHeader(preset.header);
    setBody(preset.body);
    setFooter(preset.footer);
    setButtons([...preset.buttons]);
    setVariableHints(preset.variables);
    setExampleValues(preset.examples);
    setStep('edit');
  };

  const startBlank = () => {
    resetForm();
    setStep('edit');
  };

  // ── Validation ───────────────────────────────────────────────────────────

  const validateName = (value: string) => {
    if (!value) { setNameError('Nome é obrigatório'); return false; }
    if (!/^[a-z][a-z0-9_]*$/.test(value)) {
      setNameError('Apenas letras minúsculas, números e underscores. Deve começar com letra.');
      return false;
    }
    if (value.length > 512) { setNameError('Máximo 512 caracteres'); return false; }
    setNameError('');
    return true;
  };

  const isValid = () => {
    if (!name || !body.trim()) return false;
    if (!/^[a-z][a-z0-9_]*$/.test(name)) return false;
    if (category === 'AUTHENTICATION' && /\{\{\d+\}\}/.test(body)) return false;
    return true;
  };

  // ── Build components ─────────────────────────────────────────────────────

  const buildComponents = () => {
    const components: Array<Record<string, unknown>> = [];

    // Header — detect variables and attach example
    if (header.trim()) {
      const headerVarNums = [...header.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1]));
      const headerComp: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: header.trim() };
      if (headerVarNums.length > 0) {
        headerComp.example = {
          header_text: headerVarNums.map(n => exampleValues[n - 1] || `exemplo${n}`),
        };
      }
      components.push(headerComp);
    }

    // Body — detect variables and attach example
    const bodyVarNums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1]));
    const bodyComp: Record<string, unknown> = { type: 'BODY', text: body.trim() };
    if (bodyVarNums.length > 0) {
      bodyComp.example = {
        body_text: [bodyVarNums.sort((a, b) => a - b).map(n => exampleValues[n - 1] || `exemplo${n}`)],
      };
    }
    components.push(bodyComp);

    if (footer.trim()) components.push({ type: 'FOOTER', text: footer.trim() });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map(btn => {
          if (btn.type === 'URL') {
            const btnDef: Record<string, unknown> = { type: 'URL', text: btn.text, url: btn.url };
            // If URL has {{1}} dynamic variable, add example
            if (/\{\{1\}\}/.test(btn.url)) {
              btnDef.example = ['https://meet.google.com/abc-defg-hij'];
            }
            return btnDef;
          }
          return { type: 'QUICK_REPLY', text: btn.text };
        }),
      });
    }
    return components;
  };

  const buildPreviewComponents = () => {
    const components: Array<{ type: string; text?: string; buttons?: Array<{ text: string; type: string }> }> = [];
    if (header.trim()) components.push({ type: 'HEADER', text: header.trim() });
    components.push({ type: 'BODY', text: body.trim() || 'Texto da mensagem...' });
    if (footer.trim()) components.push({ type: 'FOOTER', text: footer.trim() });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.filter(b => b.text.trim()).map(btn => ({ text: btn.text, type: btn.type })),
      });
    }
    return components;
  };

  // ── Buttons management ───────────────────────────────────────────────────

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '', url: '' }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: keyof ButtonItem, value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    setButtons(updated);
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!isValid()) return;
    setCreating(true);
    try {
      const payload = {
        action: 'create',
        channel_id: channelId,
        name,
        category,
        language,
        components: buildComponents(),
        ...(purpose !== 'none' ? { purpose } : {}),
      };
      console.log('[TemplateBuilder] payload:', JSON.stringify(payload, null, 2));

      const { data, error } = await supabase.functions.invoke('whatsapp-templates-manage', {
        body: payload,
      });

      console.log('[TemplateBuilder] response:', { data, error });

      // supabase.functions.invoke returns error for non-2xx AND relay errors
      if (error) {
        // Try to extract structured error from the response context
        const msg = (error as any)?.context?.body
          ? JSON.parse((error as any).context.body)?.error
          : error.message;
        toast.error(msg || 'Erro ao criar template');
        return;
      }
      if (data?.error) { toast.error(data.error); return; }

      await queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template criado. Status: Aguardando aprovação da Meta');
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[TemplateBuilder] exception:', err);
      toast.error(err?.message || 'Erro ao criar template');
    } finally {
      setCreating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        step === 'select' ? 'max-w-2xl' : 'max-w-4xl'
      )}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {step === 'edit' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="h-[30px] w-[30px] p-0 mr-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'select' ? 'Novo Template — Escolha um modelo' : 'Novo Template WhatsApp'}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Preset Selection ────────────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-3 mt-2">
            <p className="text-[13px] text-muted-foreground/70">
              Escolha um modelo pronto para começar ou crie do zero. Você pode personalizar tudo antes de enviar para a Meta.
            </p>

            {/* Category filter tabs */}
            <div className="flex gap-1.5">
              {([['all', 'Todos'], ['UTILITY', 'Utilidade'], ['MARKETING', 'Marketing']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPresetFilter(key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-medium transition-colors border",
                    presetFilter === key
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  )}
                >
                  {label} ({key === 'all' ? PRESETS.length : PRESETS.filter(p => p.category === key).length})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {PRESETS.filter(p => presetFilter === 'all' || p.category === presetFilter).map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="flex items-start gap-3 p-3.5 rounded-[2px] border border-border hover:border-foreground/20 hover:bg-muted/50 transition-all text-left group"
                >
                  <div className="p-2 rounded-[4px] bg-muted text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition-colors shrink-0">
                    {preset.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{preset.label}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{preset.description}</p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 border border-border">
                        {preset.category}
                      </span>
                      {preset.variables.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 border border-border">
                          {preset.variables.length} variáveis
                        </span>
                      )}
                      {preset.buttons.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/60 border border-border">
                          {preset.buttons.length} botões
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={startBlank} className="w-full h-[30px] text-[13px] gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Criar do zero
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Edit Form + Preview ─────────────────────────────────── */}
        {step === 'edit' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
            {/* ── Form ─────────────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-[13px] font-medium text-foreground">Nome do template</label>
                <Input
                  value={name}
                  onChange={e => { setName(e.target.value); validateName(e.target.value); }}
                  placeholder="ex: confirmacao_agendamento"
                  className={cn("mt-1 h-[30px] text-[13px] font-mono", nameError && "border-red-400")}
                />
                {nameError && <p className="text-[11px] text-red-500 mt-1">{nameError}</p>}
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Letras minúsculas, números e underscores</p>
              </div>

              {/* Category + Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-foreground">Categoria</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-1 h-[30px] text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-foreground">Idioma</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="mt-1 h-[30px] text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Finalidade (tag interna do CRM, não é campo da Meta) */}
              <div>
                <label className="text-[13px] font-medium text-foreground">
                  Finalidade <span className="text-muted-foreground/50 font-normal">(opcional, uso interno do CRM)</span>
                </label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger className="mt-1 h-[30px] text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="retomada">Retomada de conversa</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  "Retomada de conversa" aparece no filtro que o comercial usa pra reabrir leads fora da janela de 24h
                </p>
              </div>

              {/* Header */}
              <div>
                <label className="text-[13px] font-medium text-foreground">
                  Header <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                </label>
                <Input
                  value={header}
                  onChange={e => setHeader(e.target.value)}
                  placeholder="Título da mensagem"
                  maxLength={60}
                  className="mt-1 h-[30px] text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 text-right">{header.length}/60</p>
              </div>

              {/* Body */}
              <div>
                <label className="text-[13px] font-medium text-foreground">
                  Corpo da mensagem <span className="text-red-400">*</span>
                </label>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={"Olá {{1}}, sua consulta está confirmada para {{2}}.\n\nUse {{1}}, {{2}} para variáveis."}
                  maxLength={1024}
                  rows={5}
                  className="mt-1 text-[13px] resize-none"
                />
                <div className="flex justify-between mt-0.5">
                  {category === 'AUTHENTICATION' && /\{\{\d+\}\}/.test(body) && (
                    <p className="text-[11px] text-red-500">Templates de autenticação não permitem variáveis customizadas</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/50 ml-auto">{body.length}/1024</p>
                </div>
              </div>

              {/* Variable hints */}
              {variableHints.length > 0 && (
                <div className="bg-muted rounded-[4px] px-3 py-2 border border-border">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Variáveis neste modelo:</p>
                  <div className="space-y-0.5">
                    {variableHints.map((hint, idx) => (
                      <p key={idx} className="text-[11px] text-muted-foreground/70">
                        <code className="font-mono text-foreground/70 bg-muted px-1 rounded">{`{{${idx + 1}}}`}</code> — {hint}
                        {exampleValues[idx] && (
                          <span className="text-muted-foreground/40 ml-1">(ex: {exampleValues[idx]})</span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div>
                <label className="text-[13px] font-medium text-foreground">
                  Footer <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                </label>
                <Input
                  value={footer}
                  onChange={e => setFooter(e.target.value)}
                  placeholder="Rodapé da mensagem"
                  maxLength={60}
                  className="mt-1 h-[30px] text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 text-right">{footer.length}/60</p>
              </div>

              {/* Buttons */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-foreground">
                    Botões <span className="text-muted-foreground/50 font-normal">(opcional, máx 3)</span>
                  </label>
                  {buttons.length < 3 && (
                    <Button variant="ghost" size="sm" onClick={addButton} className="h-6 text-[11px] gap-1 px-2">
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  )}
                </div>

                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex gap-2 mt-2 items-start">
                    <Select value={btn.type} onValueChange={v => updateButton(idx, 'type', v)}>
                      <SelectTrigger className="w-[120px] h-[30px] text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUICK_REPLY">Resposta</SelectItem>
                        <SelectItem value="URL">URL</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={btn.text}
                      onChange={e => updateButton(idx, 'text', e.target.value)}
                      placeholder="Texto do botão"
                      maxLength={25}
                      className="h-[30px] text-[13px] flex-1"
                    />
                    {btn.type === 'URL' && (
                      <Input
                        value={btn.url}
                        onChange={e => updateButton(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="h-[30px] text-[13px] flex-1"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeButton(idx)}
                      className="h-[30px] w-8 p-0 text-muted-foreground/50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <div className="pt-2 border-t border-border">
                <Button
                  onClick={handleCreate}
                  disabled={creating || !isValid()}
                  className="w-full h-[30px] text-[13px]"
                >
                  {creating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Criando...</>
                  ) : (
                    'Criar Template'
                  )}
                </Button>
              </div>
            </div>

            {/* ── Preview ──────────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-foreground">Preview</label>
              <WhatsappTemplatePreview components={buildPreviewComponents()} />
              <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
                Templates criados entram com status "Pendente" e são revisados pela Meta (até 24h).
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
