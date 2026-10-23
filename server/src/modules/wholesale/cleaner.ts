/**
 * Upstream Wholesale Text & Description Sanitizer
 * Strips custom Telegram emojis, HTML entities, and formatting artifacts.
 */

export function cleanUpstreamText(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    .replace(/\{pe:\d+\}/gi, '')
    .replace(/\{emoji:\d+\}/gi, '')
    .replace(/\[pe:\d+\]/gi, '')
    .replace(/\[emoji:\d+\]/gi, '')
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1')
    .replace(/<tg-emoji[^>]*\/>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function cleanUpstreamDescription(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw
    .replace(/\{pe:\d+\}/gi, '')
    .replace(/\{emoji:\d+\}/gi, '')
    .replace(/\[pe:\d+\]/gi, '')
    .replace(/\[emoji:\d+\]/gi, '')
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1')
    .replace(/<tg-emoji[^>]*\/>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map(l => l.trim());
  return lines.join('\n').trim();
}

export function extractCategoryFromProduct(name: string, idOrSlug?: string, emoji?: string): { category: string; icon: string } {
  const cleanName = cleanUpstreamText(name);
  const combined = `${cleanName} ${idOrSlug || ''} ${emoji || ''}`.toLowerCase();

  if (/gemini/i.test(combined)) return { category: 'Gemini', icon: '🇬' };
  if (/chatgpt|openai|gpt/i.test(combined)) return { category: 'ChatGPT', icon: '🤖' };
  if (/claude|anthropic/i.test(combined)) return { category: 'Claude', icon: '☀️' };
  if (/notion/i.test(combined)) return { category: 'Notion Business', icon: '🗃' };
  if (/github/i.test(combined)) return { category: 'GitHub', icon: '🐙' };
  if (/capcut/i.test(combined)) return { category: 'CapCut', icon: '🎬' };
  if (/grok|x\.ai/i.test(combined)) return { category: 'Grok', icon: '𝕏' };
  if (/canva/i.test(combined)) return { category: 'Canva', icon: '🎨' };
  if (/loveable/i.test(combined)) return { category: 'Loveable Pro', icon: '🚀' };
  if (/telegram|tg\s*prem/i.test(combined)) return { category: 'Telegram Premium', icon: '✈️' };
  if (/vpn|nord|express|surfshark/i.test(combined)) return { category: 'VPN', icon: '🛡️' };
  if (/youtube/i.test(combined)) return { category: 'YouTube', icon: '▶️' };
  if (/email|gmail|mail|hotmail|outlook/i.test(combined)) return { category: 'Email', icon: '✉️' };
  if (/elevenlabs|voice/i.test(combined)) return { category: 'ElevenLabs', icon: '🗣️' };
  if (/elite\s*methods|vip/i.test(combined)) return { category: 'VIP & Methods', icon: '👑' };
  if (/figma/i.test(combined)) return { category: 'Figma', icon: '🖋️' };
  if (/duolingo/i.test(combined)) return { category: 'Doulingo', icon: '🦉' };
  if (/leonardo/i.test(combined)) return { category: 'Leonardo AI', icon: '🎨' };
  if (/muse/i.test(combined)) return { category: 'Muse AI', icon: '♾️' };
  if (/netflix|spotify|disney|prime|hulu|crunchyroll|streaming/i.test(combined)) return { category: 'Streaming & OTT', icon: '🍿' };
  if (/api\s*key|api\s*gateway|tokens/i.test(combined)) return { category: 'API Keys', icon: '🔑' };
  if (/cursor|v0|replit|developer/i.test(combined)) return { category: 'Developer Tools', icon: '💻' };

  return { category: 'General Digital', icon: '📦' };
}
