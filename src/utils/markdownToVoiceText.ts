/**
 * Sanitiza markdown bruto vindo de respostas do assistente IA para texto
 * adequado a narração via TTS (ElevenLabs).
 *
 * Por que: o conteúdo do assistente pode incluir blocos ```chart {...}```,
 * tabelas markdown, código, formatação e URLs — narrar literalmente esse
 * conteúdo gera áudio ininteligível e longuíssimo. Esta função converte
 * para texto natural e, se necessário, sumariza.
 */

const CHART_FENCE_RE = /```chart\b[^\n]*\n[\s\S]*?```/g;
const ANY_FENCE_RE = /```[^\n]*\n[\s\S]*?```/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const TABLE_BLOCK_RE = /(^|\n)(\|[^\n]*\|\n\|[\s:|-]+\|\n(?:\|[^\n]*\|\n?)+)/g;
const IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const RAW_URL_RE = /\bhttps?:\/\/\S+/gi;
const HEADING_RE = /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
const BLOCKQUOTE_RE = /^[ \t]{0,3}>[ \t]?/gm;
const HR_RE = /^[ \t]{0,3}(?:-[ \t]*){3,}|^[ \t]{0,3}(?:\*[ \t]*){3,}|^[ \t]{0,3}(?:_[ \t]*){3,}$/gm;
const LIST_MARKER_RE = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+/gm;
const BOLD_RE = /(\*\*|__)(.+?)\1/g;
const ITALIC_RE = /(?<!\w)([*_])(?!\s)([^*_\n]+?)(?<!\s)\1(?!\w)/g;
const STRIKE_RE = /~~(.+?)~~/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const MULTI_NEWLINE_RE = /\n{3,}/g;
const MULTI_SPACE_RE = /[ \t]{2,}/g;

const SUMMARY_THRESHOLD = 600;
const SUMMARY_MAX_OUTPUT = 400;
const SUMMARY_TAIL = " Veja o painel para detalhes completos.";
const NUMBER_HINT_RE = /\d|%|R\$|\bporcento\b/i;

function stripFormatting(input: string): string {
  let out = input;

  out = out.replace(CHART_FENCE_RE, "\nVeja o gráfico no painel.\n");
  out = out.replace(ANY_FENCE_RE, " ");
  out = out.replace(TABLE_BLOCK_RE, (_m, lead) => `${lead}Veja a tabela no painel.\n`);

  out = out.replace(HTML_TAG_RE, " ");
  out = out.replace(IMAGE_RE, (_m, alt) => alt || " ");
  out = out.replace(LINK_RE, (_m, text) => text);
  out = out.replace(RAW_URL_RE, " ");

  out = out.replace(HEADING_RE, "$1.");
  out = out.replace(BLOCKQUOTE_RE, "");
  out = out.replace(HR_RE, "");
  out = out.replace(LIST_MARKER_RE, "");

  out = out.replace(BOLD_RE, (_m, _delim, txt) => txt);
  out = out.replace(ITALIC_RE, (_m, _delim, txt) => txt);
  out = out.replace(STRIKE_RE, "$1");
  out = out.replace(INLINE_CODE_RE, "$1");

  out = out.replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1");

  return out;
}

function normalizeWhitespace(input: string): string {
  return input
    .split("\n")
    .map(line => line.replace(MULTI_SPACE_RE, " ").trim())
    .join("\n")
    .replace(MULTI_NEWLINE_RE, "\n\n")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/)
    .map(s => s.trim())
    .filter(Boolean);
}

function summarize(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const leading = paragraphs.slice(0, 2).join(" ");

  const remainder = paragraphs.slice(2).join(" ");
  const metricSentences = splitSentences(remainder).filter(s => NUMBER_HINT_RE.test(s));

  const parts: string[] = [];
  if (leading) parts.push(leading);
  for (const sentence of metricSentences) {
    if (parts.join(" ").length + sentence.length + 1 > SUMMARY_MAX_OUTPUT) break;
    parts.push(sentence);
  }

  let result = parts.join(" ").replace(MULTI_SPACE_RE, " ").trim();
  if (result.length > SUMMARY_MAX_OUTPUT) {
    const truncated = result.slice(0, SUMMARY_MAX_OUTPUT);
    const lastBoundary = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? "),
    );
    result = lastBoundary > SUMMARY_MAX_OUTPUT * 0.5
      ? truncated.slice(0, lastBoundary + 1)
      : truncated.trimEnd() + "…";
  }

  if (!/[.!?…]$/.test(result)) result += ".";
  return result + SUMMARY_TAIL;
}

export function markdownToVoiceText(markdown: string): string {
  if (!markdown) return "";

  const stripped = stripFormatting(markdown);
  const normalized = normalizeWhitespace(stripped);
  if (!normalized) return "";

  if (normalized.length <= SUMMARY_THRESHOLD) return normalized;
  return summarize(normalized);
}
