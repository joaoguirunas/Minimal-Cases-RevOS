import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PublicSettings {
  company_name: string | null;
  logo_url: string | null;
}

export default function PrivacyPolicyPage() {
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
              <Shield className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
          )}
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-foreground">Política de Privacidade</h1>
            <p className="text-[13px] text-muted-foreground">{company}</p>
          </div>
        </div>

        {/* Content */}
        <div className="border border-border rounded-[2px] bg-card divide-y divide-border text-[13px] leading-relaxed text-muted-foreground">

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">1. Informações que coletamos</h2>
            <p>
              Coletamos informações fornecidas diretamente por você, como nome, e-mail e telefone,
              ao preencher formulários ou interagir com nossa plataforma. Também podemos coletar
              automaticamente dados de uso e de dispositivo para fins operacionais.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">2. Como usamos suas informações</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Prestar e melhorar nossos serviços;</li>
              <li>Entrar em contato sobre produtos, serviços ou suporte;</li>
              <li>Cumprir obrigações legais e regulatórias;</li>
              <li>Personalizar sua experiência em nossa plataforma.</li>
            </ul>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">3. Compartilhamento de dados</h2>
            <p>
              Não vendemos suas informações pessoais a terceiros. Podemos compartilhá-las com
              parceiros de tecnologia essenciais à operação do serviço, sempre sob acordos de
              confidencialidade e proteção de dados. Esses parceiros incluem, sem limitação:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Provedores de infraestrutura em nuvem (armazenamento, banco de dados, computação);</li>
              <li>Plataformas de integração autorizadas pelo usuário, como TikTok, Meta (Facebook/Instagram), Google e Microsoft, quando o usuário conecta sua conta via OAuth;</li>
              <li>Serviços de mensageria e comunicação (WhatsApp Business API, e-mail, SMS) utilizados para operação da plataforma.</li>
            </ul>
            <p className="pt-1">
              Os dados compartilhados com plataformas de terceiros são limitados ao estritamente
              necessário para a funcionalidade solicitada e regidos pelas políticas de privacidade
              dessas plataformas.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">4. Armazenamento e segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS)
              e em repouso. Adotamos medidas técnicas e organizacionais adequadas para proteger suas
              informações contra acesso não autorizado, perda ou destruição.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">5. Seus direitos (LGPD)</h2>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Confirmar a existência de tratamento de seus dados;</li>
              <li>Acessar, corrigir ou solicitar a portabilidade dos seus dados;</li>
              <li>Revogar o consentimento ou solicitar a exclusão dos dados;</li>
              <li>Obter informações sobre com quem seus dados foram compartilhados.</li>
            </ul>
            <p className="pt-1">
              Para exercer seus direitos, acesse nossa{' '}
              <a
                href="/excluir-dados"
                className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                página de exclusão de dados
              </a>
              .
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">6. Cookies e rastreamento</h2>
            <p>
              Podemos utilizar cookies e tecnologias similares para manter sessões autenticadas
              e coletar métricas de uso agregadas. Você pode configurar seu navegador para recusar
              cookies, embora isso possa afetar o funcionamento de partes da plataforma.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">7. Retenção de dados</h2>
            <p>
              Mantemos seus dados pelo período necessário para a prestação do serviço e para o
              cumprimento de obrigações legais. Após o encerramento do relacionamento, os dados
              são excluídos ou anonimizados dentro de um prazo razoável.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">8. Crianças e adolescentes</h2>
            <p>
              Nossa plataforma é destinada exclusivamente a usuários com 18 anos ou mais. Não
              coletamos intencionalmente dados pessoais de crianças ou adolescentes menores de 18
              anos. Caso identifiquemos que dados de um menor foram coletados sem o devido
              consentimento parental, procederemos com a exclusão imediata dessas informações.
            </p>
            <p>
              Se você acredita que dados de um menor foram coletados inadvertidamente, entre em
              contato com nosso DPO imediatamente.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">9. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você
              sobre mudanças significativas por e-mail ou por aviso em destaque na plataforma.
              O uso continuado do serviço após as alterações constitui aceitação da nova versão.
            </p>
          </section>

          <section className="px-6 py-5 space-y-2">
            <h2 className="text-[13px] font-semibold text-foreground">10. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados? Entre em contato
              com o encarregado de proteção de dados (DPO) de <strong className="text-foreground">{company}</strong> pelos
              canais disponíveis em nosso site ou diretamente na plataforma.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[11px] text-muted-foreground/40">
            Última atualização: {today}
          </p>
          <p className="text-[11px] text-muted-foreground/30">
            {company} &middot; LGPD — Lei nº 13.709/2018
          </p>
        </div>

      </div>
    </div>
  );
}
