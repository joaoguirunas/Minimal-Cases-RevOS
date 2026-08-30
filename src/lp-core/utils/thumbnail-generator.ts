/**
 * LP PRO™ — Thumbnail Generator
 * Phase 3 Task #12: Auto-generate lightweight page thumbnails
 *
 * Generates SVG previews from page content for fast thumbnail display.
 * Falls back to og_image if available, otherwise creates a minimal SVG.
 *
 * Benefits:
 * - Reduces preview load time by using cached thumbnails
 * - No external screenshot service needed
 * - Can be enhanced with Playwright later
 */

import type { LpPageContent } from '@/hooks/useLpTemplates';

/**
 * Generate a lightweight SVG thumbnail from page content
 */
export function generateSvgThumbnail(content: LpPageContent): string {
  const title = content.meta?.title || 'Landing Page';
  const primaryColor = content.theme?.primary_color || '#3b82f6';
  const bgColor = content.theme?.bg_color || '#ffffff';
  const blockCount = content.blocks?.length || 0;

  // Create a simple SVG representation
  const svg = `
    <svg width="320" height="200" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="320" height="200" fill="${bgColor}"/>

      <!-- Header bar -->
      <rect width="320" height="40" fill="${primaryColor}" opacity="0.1"/>

      <!-- Title -->
      <text x="16" y="26" font-size="14" font-weight="600" fill="#1f2937" font-family="sans-serif">
        ${escapeXml(title.substring(0, 25))}
      </text>

      <!-- Content blocks indicator -->
      ${Array.from({ length: Math.min(blockCount, 3) })
        .map(
          (_, i) => `
        <rect x="16" y="${56 + i * 40}" width="288" height="32"
              fill="${primaryColor}" opacity="${0.05 + i * 0.05}"
              rx="4" stroke="${primaryColor}" stroke-width="0.5" stroke-opacity="0.3"/>
        <line x1="16" y1="${80 + i * 40}" x2="304" y2="${80 + i * 40}"
              stroke="#e5e7eb" stroke-width="1"/>
      `
        )
        .join('')}

      <!-- Footer info -->
      <text x="16" y="195" font-size="10" fill="#9ca3af" font-family="sans-serif">
        ${blockCount} blocks • ${content.theme?.layout_key || 'classic'}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate thumbnail from page content (smart strategy)
 *
 * Strategy:
 * 1. Use og_image if available (social media preview)
 * 2. Fall back to SVG thumbnail
 *
 * Phase 3 can be enhanced with actual screenshot via Playwright edge function
 */
export function generatePageThumbnail(content: LpPageContent): string {
  // Use og_image if available (already optimized for social sharing)
  if (content.meta?.og_image) {
    return content.meta.og_image;
  }

  // Fall back to lightweight SVG
  return generateSvgThumbnail(content);
}

/**
 * Escape XML special characters in SVG text
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
