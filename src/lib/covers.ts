/**
 * Generated fallback covers.
 *
 * When an entry has no TMDB poster (offline, demo mode, or TMDB dropped the
 * image), the cupboard still looks great: each case gets a deterministic
 * two-tone gradient sleeve with the title set in the middle - drawn on a
 * canvas so it can be used directly as a Three.js texture.
 */

const PALETTES: Array<[string, string]> = [
  ['#1a2a6c', '#b21f1f'],
  ['#0f2027', '#2c5364'],
  ['#2b5876', '#4e4376'],
  ['#42275a', '#734b6d'],
  ['#141e30', '#243b55'],
  ['#093028', '#237a57'],
  ['#8e2de2', '#4a00e0'],
  ['#c31432', '#240b36'],
  ['#136a8a', '#267871'],
  ['#0b486b', '#f56217'],
  ['#3a1c71', '#d76d77'],
  ['#2193b0', '#6dd5ed'],
  ['#41295a', '#2f0743'],
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function coverPalette(seed: string): [string, string] {
  return PALETTES[hashString(seed) % PALETTES.length];
}

export function coverCss(seed: string): string {
  const [a, b] = coverPalette(seed);
  return `linear-gradient(150deg, ${a}, ${b})`;
}

/** Wrap text into lines that fit maxLineChars (roughly proportional). */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    // elide
    let last = lines[maxLines - 1];
    if (last.length > maxChars - 1) last = `${last.slice(0, maxChars - 1)}…`;
    lines[maxLines - 1] = last;
  }
  return lines;
}

/** Draw a fallback sleeve onto a canvas (used as a Three.js texture). */
export function drawCoverCanvas(
  canvas: HTMLCanvasElement,
  title: string,
  year: number | null,
  subtitle?: string,
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const [c1, c2] = coverPalette(title);
  const grad = ctx.createLinearGradient(0, 0, w * 0.6, h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // subtle vignette
  const vign = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.85);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);

  // top studio band
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(w * 0.18, h * 0.06, w * 0.64, Math.max(2, h * 0.012));

  // title
  const maxChars = Math.max(10, Math.round((w / h) * 26));
  const lines = wrapText(title.toUpperCase(), maxChars, 4);
  const fontSize = Math.round(h * (lines.length > 2 ? 0.085 : 0.105));
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = fontSize * 1.18;
  const blockHeight = lineHeight * lines.length;
  let y = h / 2 - blockHeight / 2 + lineHeight / 2;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y, w * 0.88);
    y += lineHeight;
  }

  // year / subtitle band
  if (year || subtitle) {
    ctx.font = `500 ${Math.round(h * 0.055)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(subtitle ?? String(year), w / 2, h * 0.86, w * 0.8);
  }

  // bottom bar, blu-ray style
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.round(h * 0.032)}px Arial, sans-serif`;
  ctx.fillText('BLU-RAY', w / 2, h * 0.94, w * 0.6);

  return canvas;
}
