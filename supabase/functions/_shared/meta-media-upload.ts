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
 */

const DEFAULT_GRAPH_VERSION = 'v23.0';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function guessImageMime(url: string, contentType?: string | null): 'image/jpeg' | 'image/png' | null {
  const ct = (contentType ?? '').toLowerCase();
  if (ct === 'image/jpeg' || ct === 'image/jpg') return 'image/jpeg';
  if (ct === 'image/png') return 'image/png';
  if (ct) return null; // content-type presente mas não suportado (ex.: image/gif)

  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  return null;
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
}

export async function uploadHeaderHandle(
  input: UploadInput,
  deps: UploadDeps = {},
): Promise<{ handle: string; bytes: number; mime: string }> {
  const { appId, accessToken, imageUrl } = input;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const graphVersion = deps.graphVersion ?? DEFAULT_GRAPH_VERSION;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;

  // 1. Baixa a imagem para descobrir tamanho e tipo real (content-type prevalece sobre a extensão).
  const imgRes = await fetchImpl(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Não foi possível baixar a imagem do header (HTTP ${imgRes.status})`);
  }
  const contentType = imgRes.headers.get('content-type');
  const mime = guessImageMime(imageUrl, contentType);
  if (!mime) {
    throw new Error('Formato não suportado (use JPEG ou PNG)');
  }

  const buffer = new Uint8Array(await imgRes.arrayBuffer());
  const bytes = buffer.length;

  if (bytes > maxBytes) {
    throw new Error(`Imagem muito grande (${bytes} bytes). O limite é ${maxBytes} bytes.`);
  }

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
