
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@4.0.0";

console.log('Checking RESEND_API_KEY:', Deno.env.get("RESEND_API_KEY") ? 'Found' : 'Missing');

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// HTML escape to prevent injection in email templates
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface InviteEmailRequest {
  email: string;
  nome: string;
  inviteUrl: string;
  tenantName: string;
  inviterName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nome, inviteUrl, tenantName, inviterName }: InviteEmailRequest = await req.json();

    // Validate inputs
    if (!email || !nome || !inviteUrl || !tenantName || !inviterName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate inviteUrl is a proper HTTPS URL (not javascript: or data: schemes)
    try {
      const parsedUrl = new URL(inviteUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid invite URL' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate string lengths
    if (nome.length > 100 || tenantName.length > 100 || inviterName.length > 100 || inviteUrl.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Input exceeds maximum length' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Enviando convite para:', email, 'Nome:', nome);

    // Verificar se a API key está configurada
    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error('RESEND_API_KEY não configurada');
      return new Response(
        JSON.stringify({ 
          error: 'RESEND_API_KEY não configurada. Configure a chave da API no painel do Supabase.' 
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Escape all user inputs for safe HTML embedding
    const safeNome = escapeHtml(nome);
    const safeInviterName = escapeHtml(inviterName);
    const safeTenantName = escapeHtml(tenantName);
    // inviteUrl is already validated as a proper URL above
    const safeInviteUrl = escapeHtml(inviteUrl);

    const emailResponse = await resend.emails.send({
      from: "CRM <noreply@resend.dev>",
      to: [email],
      subject: `Convite para acessar ${safeTenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3B82F6;">Você foi convidado para acessar o CRM</h2>
          <p>Olá <strong>${safeNome}</strong>!</p>
          <p><strong>${safeInviterName}</strong> convidou você para fazer parte da equipe de <strong>${safeTenantName}</strong>.</p>
          <p>Para aceitar o convite e criar sua conta, clique no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${safeInviteUrl}" 
               style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Aceitar Convite e Criar Conta
            </a>
          </div>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${safeInviteUrl}
          </p>
          <p><strong>Instruções:</strong></p>
          <ol>
            <li>Clique no link acima</li>
            <li>Preencha seus dados pessoais</li>
            <li>Crie uma senha segura</li>
            <li>Confirme seu cadastro</li>
          </ol>
          <p>Este convite é válido por 7 dias.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
          <p style="color: #666; font-size: 12px;">
            Se você não esperava receber este convite, pode ignorar este email com segurança.
          </p>
        </div>
      `,
    });

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
