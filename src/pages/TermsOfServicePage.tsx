import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PublicSettings {
  company_name: string | null;
  logo_url: string | null;
}

export default function TermsOfServicePage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    supabase.rpc('get_public_settings').then(({ data }) => {
      const rows = data as PublicSettings[] | null;
      if (rows && rows.length > 0) setSettings(rows[0]);
    });
  }, []);

  const company = settings?.company_name ?? 'nossa empresa';
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">

        {/* Header */}
        <div className="text-center space-y-4 mb-10">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt={company}
              className="h-10 object-contain mx-auto"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-1">
              <FileText className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
          )}
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">Termos de Serviço</h1>
            <p className="text-[13px] text-muted-foreground">{company}</p>
          </div>
        </div>

        {/* Content */}
        <div className="border border-border rounded-[2px] bg-card divide-y divide-border text-[13px] leading-relaxed text-muted-foreground">

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma <strong className="text-foreground">{company}</strong>, você concorda
              com estes Termos de Serviço e com nossa{' '}
              <a
                href="/politica-de-privacidade"
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                Política de Privacidade
              </a>
              . Se você não concordar com qualquer parte destes termos, não utilize o serviço.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p>
              A plataforma é um software SaaS (Software as a Service) multi-tenant voltado para
              gestão de vendas, relacionamento com clientes e automação de marketing. O serviço inclui,
              sem limitação:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>CRM e gestão de negócios (pipeline, kanban, follow-ups);</li>
              <li>Central de mensagens omnichannel (WhatsApp, Instagram, e-mail, SMS);</li>
              <li>Agendamento e gestão de reuniões;</li>
              <li>Integrações com plataformas de anúncios (TikTok Ads, Meta Ads, Google Ads);</li>
              <li>Automações de marketing e disparo de campanhas;</li>
              <li>Relatórios e dashboards de performance (BI PRO);</li>
              <li>Agentes de inteligência artificial para atendimento.</li>
            </ul>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">3. Elegibilidade e Conta</h2>
            <p>
              O serviço é destinado exclusivamente a pessoas jurídicas ou pessoas físicas maiores de
              18 anos que utilizem a plataforma para fins comerciais. Ao criar uma conta, você
              garante que as informações fornecidas são verdadeiras e atualizadas. Você é responsável
              pela confidencialidade de suas credenciais de acesso e por todas as atividades
              realizadas em sua conta.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">4. Integrações com Terceiros</h2>
            <p>
              A plataforma oferece integrações opcionais com serviços de terceiros, incluindo TikTok,
              Meta (Facebook e Instagram), Google, Microsoft e WhatsApp Business. Ao ativar essas
              integrações, você autoriza o acesso às suas contas nessas plataformas nos limites
              definidos durante o processo de autenticação (OAuth).
            </p>
            <p>
              O uso dessas integrações está sujeito aos termos e políticas de cada plataforma
              terceira. Não nos responsabilizamos por alterações nas APIs ou políticas dessas
              plataformas que afetem o funcionamento das integrações.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">5. Uso Aceitável</h2>
            <p>Você concorda em não utilizar o serviço para:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Enviar spam, mensagens não solicitadas em massa ou conteúdo enganoso;</li>
              <li>Violar leis aplicáveis, incluindo legislação de proteção de dados (LGPD, GDPR);</li>
              <li>Coletar ou processar dados pessoais sem a devida base legal;</li>
              <li>Comprometer a segurança ou a integridade da plataforma ou de outros usuários;</li>
              <li>Fazer engenharia reversa, descompilar ou tentar extrair o código-fonte da plataforma.</li>
            </ul>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">6. Propriedade Intelectual</h2>
            <p>
              Todos os direitos de propriedade intelectual sobre a plataforma, seus componentes,
              marcas, logotipos e conteúdo produzido pela empresa permanecem exclusivamente com
              <strong className="text-foreground"> {company}</strong>. O uso do serviço não implica
              transferência de quaisquer direitos de propriedade intelectual.
            </p>
            <p>
              Você mantém a titularidade dos dados inseridos na plataforma e concede a nós uma
              licença limitada para processar esses dados exclusivamente para a prestação do serviço.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">7. Pagamentos e Planos</h2>
            <p>
              O acesso ao serviço pode estar condicionado ao pagamento de uma assinatura conforme
              o plano contratado. Os valores, prazos e condições de pagamento são definidos no
              momento da contratação. Em caso de inadimplência, podemos suspender ou encerrar o
              acesso à plataforma após notificação prévia.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">8. Disponibilidade e SLA</h2>
            <p>
              Envidamos todos os esforços razoáveis para manter a plataforma disponível de forma
              contínua. No entanto, não garantimos disponibilidade ininterrupta. Manutenções
              programadas serão comunicadas com antecedência sempre que possível. Eventos fora do
              nosso controle (força maior, falhas de terceiros) podem afetar a disponibilidade sem
              que isso implique responsabilidade da nossa parte.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">9. Limitação de Responsabilidade</h2>
            <p>
              Na máxima extensão permitida pela lei aplicável, não somos responsáveis por danos
              indiretos, incidentais, especiais ou consequentes decorrentes do uso ou da
              impossibilidade de uso do serviço, incluindo lucros cessantes ou perda de dados.
              Nossa responsabilidade total, em qualquer circunstância, não excederá o valor pago
              pelo usuário nos 12 meses anteriores ao evento que gerou o dano.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">10. Rescisão</h2>
            <p>
              Qualquer das partes pode encerrar o contrato de serviço mediante notificação prévia
              conforme acordado na contratação. Podemos suspender ou encerrar o acesso
              imediatamente em caso de violação grave destes Termos, sem prejuízo de outras
              medidas cabíveis. Após o encerramento, seus dados serão retidos pelo período exigido
              por lei e, em seguida, excluídos ou anonimizados conforme nossa Política de Privacidade.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">11. Alterações nos Termos</h2>
            <p>
              Podemos atualizar estes Termos de Serviço periodicamente. Notificaremos você sobre
              alterações materiais por e-mail ou por aviso em destaque na plataforma com pelo menos
              15 dias de antecedência. O uso continuado do serviço após esse prazo constitui
              aceitação das novas condições.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">12. Lei Aplicável e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais
              disputas serão submetidas ao foro da comarca da sede da empresa, com renúncia expressa
              a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">13. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Serviço? Entre em contato com{' '}
              <strong className="text-foreground">{company}</strong> pelos canais disponíveis em
              nosso site ou diretamente na plataforma.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[11px] text-muted-foreground/40">
            Última atualização: {today}
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            {company} &middot; Brasil
          </p>
        </div>

      </div>
    </div>
  );
}
