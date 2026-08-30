export interface CalcomUrlParams {
  username: string;
  slug: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

/**
 * Gera URL de agendamento Cal.com com dados do lead pré-preenchidos.
 * Com disableOnPrefill configurado no Cal.com, os campos ficam read-only.
 */
export function buildCalcomBookingUrl(params: CalcomUrlParams): string {
  const { username, slug, name, email, phone, notes } = params;
  const base = `https://cal.com/${username}/${slug}`;
  const qs = new URLSearchParams();
  if (name) qs.set('name', name);
  if (email) qs.set('email', email);
  if (phone) qs.set('phone', phone);
  if (notes) qs.set('notes', notes);
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}
