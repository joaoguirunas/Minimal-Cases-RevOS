import { describe, expect, it, vi } from 'vitest';

// Isola o teste do requisito de env vars (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) que
// `@/integrations/supabase/client` exige em runtime — o módulo sob teste só usa `supabaseUrl`
// para montar ASSET_BASE, então um stub mínimo basta.
vi.mock('@/integrations/supabase/client', () => ({ supabaseUrl: 'https://test.supabase.co', supabase: {} }));

import { buildPreviewDocument, previewVarsFromLead } from './emailTemplatePreview';

describe('buildPreviewDocument', () => {
  it('sem opts, mantém o documento padrão', () => {
    const doc = buildPreviewDocument('<p>x</p>');
    expect(doc).toContain('<body><p>x</p></body>');
    expect(doc).not.toContain('body{max-width');
  });

  it('com opts.width, adiciona max-width no <style>', () => {
    const doc = buildPreviewDocument('<p>x</p>', { width: 375 });
    expect(doc).toContain('max-width:375px');
    expect(doc).toContain('<body><p>x</p></body>');
  });
});

describe('previewVarsFromLead', () => {
  it('sem carrinho, retorna só o nome', () => {
    const vars = previewVarsFromLead({ name: 'Ana Paula', cart: null });
    expect(vars).toEqual({ nome: 'Ana' });
  });

  it('com carrinho completo, deriva todas as variáveis', () => {
    const vars = previewVarsFromLead({
      name: 'Ana Paula',
      cart: {
        produto: 'Case X',
        modelo: 'iPhone 17 Pro',
        modeloCurto: 'iPhone 17',
        imagem: 'u',
        total: 142.9,
        url: 'https://c',
      },
    });
    expect(vars).toEqual({
      nome: 'Ana',
      produto: 'Case X',
      modelo_celular: 'iPhone 17 Pro',
      modelo_celular_curto: 'IPHONE 17',
      imagem_produto: 'u',
      total: 'R$ 142,90',
      preco: 'R$ 142,90',
      link_checkout: 'https://c',
    });
  });
});
