/**
 * WhatsApp template rendering helpers — shared across edge functions that
 * enqueue WhatsApp messages (lp-submit, webhook-inbound, ...).
 *
 * Handles both POSITIONAL ({{1}}) and NAMED ({{nome}}) parameter formats,
 * with auto-detection from template text when `parameter_format` is absent.
 */

/** Extract unique positional {{N}} numbers from a text string, in order of appearance. */
export function extractPositionals(text: string): number[] {
  const seen = new Set<number>();
  const nums: number[] = [];
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (!seen.has(n)) { seen.add(n); nums.push(n); }
  }
  return nums;
}

/** Extract unique named {{word}} vars from a text string, in order of appearance. */
export function extractNamedVars(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); names.push(m[1]); }
  }
  return names;
}

export function isNamedTemplate(jsonData: Record<string, unknown> | null): boolean {
  if (!jsonData) return false;
  if ((jsonData.parameter_format as string) === 'NAMED') return true;
  if (Array.isArray(jsonData.components)) {
    return (jsonData.components as Array<Record<string, unknown>>).some((c) => {
      const text = typeof c.text === 'string' ? c.text : '';
      return /\{\{[a-zA-Z_]\w*\}\}/.test(text);
    });
  }
  return false;
}

/**
 * Build Meta-API components array from template json_data.
 * - For NAMED: namedResolver(varName) → resolved string value
 * - For POSITIONAL: resolvedValues[n-1] → resolved string value
 */
export function buildTemplateComponents(
  jsonData: Record<string, unknown> | null,
  resolvedValues: string[],
  namedResolver: (varName: string) => string,
): Array<Record<string, unknown>> {
  const isNamed = isNamedTemplate(jsonData);
  const getPositional = (n: number) => resolvedValues[n - 1] ?? '';

  const makeNamedParam = (varName: string): Record<string, string> => ({
    type: 'text',
    text: namedResolver(varName),
    parameter_name: varName,
  });

  if (jsonData && Array.isArray(jsonData.components)) {
    const result: Array<Record<string, unknown>> = [];

    for (const component of jsonData.components as Array<Record<string, unknown>>) {
      const ctype = (component.type as string)?.toUpperCase();

      if (ctype === 'HEADER' && (component.format as string)?.toUpperCase() === 'TEXT' && typeof component.text === 'string') {
        if (isNamed) {
          const vars = extractNamedVars(component.text);
          if (vars.length > 0) result.push({ type: 'header', parameters: vars.map(makeNamedParam) });
        } else {
          const nums = extractPositionals(component.text);
          if (nums.length > 0) result.push({ type: 'header', parameters: nums.map((n) => ({ type: 'text', text: getPositional(n) })) });
        }
      }

      if (ctype === 'BODY' && typeof component.text === 'string') {
        if (isNamed) {
          const vars = extractNamedVars(component.text);
          if (vars.length > 0) result.push({ type: 'body', parameters: vars.map(makeNamedParam) });
        } else {
          const nums = extractPositionals(component.text);
          if (nums.length > 0) result.push({ type: 'body', parameters: nums.map((n) => ({ type: 'text', text: getPositional(n) })) });
        }
      }

      if (ctype === 'BUTTONS' && Array.isArray(component.buttons)) {
        (component.buttons as Array<Record<string, unknown>>).forEach((btn, idx) => {
          if (btn.type === 'URL' && typeof btn.url === 'string') {
            if (isNamed) {
              extractNamedVars(btn.url).forEach((v) => {
                result.push({ type: 'button', sub_type: 'url', index: String(idx), parameters: [makeNamedParam(v)] });
              });
            } else {
              extractPositionals(btn.url).forEach((n) => {
                result.push({ type: 'button', sub_type: 'url', index: String(idx), parameters: [{ type: 'text', text: getPositional(n) }] });
              });
            }
          }
        });
      }
    }

    if (result.length > 0) return result;
  }

  return resolvedValues.length > 0
    ? [{ type: 'body', parameters: resolvedValues.map((v) => ({ type: 'text', text: v })) }]
    : [];
}

/**
 * Render the BODY text of a WhatsApp template for display in OMNI.
 */
export function renderWaTemplateBody(
  jsonData: Record<string, unknown> | null,
  resolvedValues: string[],
  namedResolver: (varName: string) => string,
): string {
  if (!jsonData) return '';

  const isNamed = isNamedTemplate(jsonData);
  let bodyText = '';

  if (Array.isArray(jsonData.components)) {
    for (const component of jsonData.components as Array<Record<string, unknown>>) {
      const ctype = (component.type as string)?.toUpperCase();
      if (ctype === 'BODY' && typeof component.text === 'string') {
        bodyText = component.text;
        break;
      }
    }
  }

  if (!bodyText) {
    let containerMeta: Record<string, unknown> = {};
    try {
      if (jsonData.containerMeta) {
        containerMeta = typeof jsonData.containerMeta === 'string'
          ? JSON.parse(jsonData.containerMeta as string)
          : (jsonData.containerMeta as Record<string, unknown>);
      }
    } catch { /* ignore */ }
    bodyText = (containerMeta.data as string) || (jsonData.data as string) || '';
  }

  if (bodyText) {
    if (isNamed) {
      bodyText = bodyText.replace(/\{\{(\w+)\}\}/g, (_, varName) => namedResolver(varName));
    } else if (resolvedValues.length > 0) {
      bodyText = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => resolvedValues[Number(n) - 1] ?? '');
    }
  }

  return bodyText;
}

/**
 * Render the HEADER text (TEXT format) of a WhatsApp template, with placeholders resolved.
 * Returns '' if no text header exists.
 */
export function renderWaTemplateHeader(
  jsonData: Record<string, unknown> | null,
  resolvedValues: string[],
  namedResolver: (varName: string) => string,
): string {
  if (!jsonData || !Array.isArray(jsonData.components)) return '';
  const isNamed = isNamedTemplate(jsonData);
  const hComp = (jsonData.components as Array<Record<string, unknown>>).find(
    (c) => (c.type as string)?.toUpperCase() === 'HEADER' && (c.format as string)?.toUpperCase() === 'TEXT',
  );
  if (!hComp?.text || typeof hComp.text !== 'string') return '';
  return isNamed
    ? hComp.text.replace(/\{\{(\w+)\}\}/g, (_, v) => namedResolver(v))
    : hComp.text.replace(/\{\{(\d+)\}\}/g, (_, n) => resolvedValues[Number(n) - 1] ?? '');
}

/**
 * Extract the buttons block (text + type) for OMNI visual rendering.
 */
export function extractTemplateButtons(
  jsonData: Record<string, unknown> | null,
): { text: string; type: string }[] {
  if (!jsonData || !Array.isArray(jsonData.components)) return [];
  const bComp = (jsonData.components as Array<Record<string, unknown>>).find(
    (c) => (c.type as string)?.toUpperCase() === 'BUTTONS',
  );
  if (!bComp || !Array.isArray(bComp.buttons)) return [];
  return (bComp.buttons as Array<Record<string, unknown>>).map((btn) => ({
    text: btn.text as string,
    type: btn.type as string,
  }));
}
