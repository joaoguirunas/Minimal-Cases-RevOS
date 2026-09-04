/**
 * Meta Resumable Upload API — usada para obter um `header_handle` ao criar um
 * template do WhatsApp com header de imagem (WAT-05/06 rodada 3).
 *
 * Fluxo (docs.developers.facebook.com/graph-api/guides/upload):
 *   1. GET na URL da imagem (o cliente já hospeda a imagem em algum lugar público).
 *   2. POST `/{app_id}/uploads?file_length=<bytes>&file_type=<mime>` com
 *      `Authorization: OAuth <token>` → `{ id: 'upload:XYZ' }`.
 *   3. POST `/{upload:XYZ}` com `Authorization: OAuth <token>`,
 *      `file_offset: 0`, `Content-Type: application/octet-stream` e o binário
 *      no corpo → `{ h: '...' }` — esse `h` é o `header_handle` usado no
 *      `example.header_handle` do componente HEADER/IMAGE.
 *
 * Nota: a Resumable Upload API espera o esquema `OAuth`, não `Bearer` — é
 * diferente do resto da Graph API usada neste projeto.
 *
 * Módulo puro: nenhuma chamada de rede é feita fora de `fetchImpl` (injetável
 * para testes). Nunca loga o token de acesso.
 *
 * SSRF: a URL da imagem é fornecida pelo usuário (quem cria o template), então
 * o download roda com allowlist de host, sem seguir redirect e sem vazar o
 * status HTTP upstream na mensagem de erro — do contrário a função vira um
 * proxy que busca qualquer `https://` (inclusive um 302 pra endpoint de
 * metadados interno) a partir da rede da Supabase.
 */

const DEFAULT_GRAPH_VERSION = 'v23.0';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT_MS = 15_000;

export function guessImageMime(url: string, contentType?: string | null): 'image/jpeg' | 'image/png' | null {
  const rawCt = (contentType ?? '').trim();
  if (rawCt) {
    // Normaliza: remove parâmetros (`; charset=...`) e caixa (`Image/JPEG`).
    const ct = rawCt.split(';')[0].trim().toLowerCase();
    if (ct === 'image/jpeg' || ct === 'image/jpg') return 'image/jpeg';
    if (ct === 'image/png') return 'image/png';
    if (ct.startsWith('image/')) return null; // outro formato de imagem não suportado (ex.: image/gif)
    // content-type presente mas não é image/* (ex.: application/octet-stream) — cai pra extensão.
  }

  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  return null;
}

/** Hosts permitidos por padrão quando `UploadDeps.allowedHosts` não é passado. */
function defaultAllowedHosts(): string[] {
  const hosts: string[] = [];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (supabaseUrl) {
    try {
      hosts.push(new URL(supabaseUrl).host);
    } catch {
      // SUPABASE_URL malformada — ignora, não derruba o cálculo dos demais hosts.
    }
  }
  const extra = Deno.env.get('WA_HEADER_IMAGE_HOSTS') ?? '';
  for (const h of extra.split(',')) {
    const trimmed = h.trim();
    if (trimmed) hosts.push(trimmed);
  }
  return hosts;
}

/** Lê o corpo da resposta respeitando `maxBytes` via stream (content-length é só indicativo). */
async function readBodyWithCap(res: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const tooLarge = () => new Error(`Imagem muito grande. O limite é ${maxBytes} bytes.`);

  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw tooLarge();
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.length) {
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export interface UploadInput {
  appId: string;
  accessToken: string;
  imageUrl: string;
}

export interface UploadDeps {
  fetchImpl?: typeof fetch;
  graphVersion?: string;
  maxBytes?: number;
  /** Hosts permitidos para a URL da imagem. Default: host do SUPABASE_URL + env WA_HEADER_IMAGE_HOSTS. */
  allowedHosts?: string[];
  /** Timeout (ms) do GET da imagem. Default 15s. */
  timeoutMs?: number;
}

export async function uploadHeaderHandle(
  input: UploadInput,
  deps: UploadDeps = {},
): Promise<{ handle: string; bytes: number; mime: string }> {
  const { appId, accessToken, imageUrl } = input;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const graphVersion = deps.graphVersion ?? DEFAULT_GRAPH_VERSION;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowedHosts = deps.allowedHosts ?? defaultAllowedHosts();
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 0. Valida protocolo e host ANTES de qualquer fetch (defesa contra SSRF).
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error('URL da imagem inválida.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('URL da imagem deve usar https://');
  }
  if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.host)) {
    throw new Error('URL da imagem fora dos domínios permitidos (use uma imagem do bucket email-assets).');
  }

  // 1. Baixa a imagem para descobrir tamanho e tipo real (content-type prevalece sobre a extensão).
  //    redirect: 'manual' — nunca segue redirect (um 302 pra fora da allowlist não é buscado
  //    automaticamente); timeout evita pendurar a function num host lento/hostil.
  let imgRes: Response;
  try {
    imgRes = await fetchImpl(imageUrl, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error('Não foi possível baixar a imagem do header.');
  }

  const isRedirect = imgRes.type === 'opaqueredirect' || (imgRes.status >= 300 && imgRes.status < 400);
  if (isRedirect) {
    throw new Error('A URL da imagem não pode redirecionar.');
  }
  if (!imgRes.ok) {
    // Mensagem genérica — não ecoa o status HTTP upstream pro chamador.
    throw new Error('Não foi possível baixar a imagem do header.');
  }

  const contentType = imgRes.headers.get('content-type');
  const mime = guessImageMime(imageUrl, contentType);
  if (!mime) {
    throw new Error('Formato não suportado (use JPEG ou PNG)');
  }

  // Corta cedo pelo content-length (indicativo) antes de ler qualquer byte do corpo.
  const contentLengthHeader = imgRes.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Imagem muito grande. O limite é ${maxBytes} bytes.`);
    }
  }

  // Cap real via stream — content-length é só indicativo, o upstream pode mentir.
  const buffer = await readBodyWithCap(imgRes, maxBytes);
  const bytes = buffer.length;

  // 2. Inicia a sessão de upload.
  const startUrl = `https://graph.facebook.com/${graphVersion}/${appId}/uploads?file_length=${bytes}&file_type=${encodeURIComponent(mime)}`;
  const startRes = await fetchImpl(startUrl, {
    method: 'POST',
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const startBody = await startRes.json().catch(() => ({}));
  if (!startRes.ok || !startBody?.id) {
    const metaError = startBody?.error?.message ?? `Erro ao iniciar upload da imagem (HTTP ${startRes.status})`;
    throw new Error(metaError);
  }
  const uploadSessionId = startBody.id as string; // e.g. 'upload:XYZ'

  // 3. Envia os bytes.
  const uploadUrl = `https://graph.facebook.com/${graphVersion}/${uploadSessionId}`;
  const uploadRes = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  });
  const uploadBody = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadBody?.h) {
    const metaError = uploadBody?.error?.message ?? `Erro ao enviar a imagem para a Meta (HTTP ${uploadRes.status})`;
    throw new Error(metaError);
  }

  return { handle: uploadBody.h as string, bytes, mime };
}
