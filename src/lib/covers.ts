/**
 * Cover and texture generation.
 *
 * The cupboard renders blu-ray cases whose sleeves come from TMDB art.
 * When art is missing (demo mode, offline, TMDB dropped the image) each
 * case gets a deterministic two-tone gradient sleeve drawn on a canvas —
 * usable directly as a Three.js texture. Spines get the Criterion-style
 * treatment: dominant color from the artwork, clean vertical typography,
 * and a numbered frame. Shelves and walls use procedural wood grain.
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

/**
 * Extract a dominant color from an image URL by sampling pixels. Returns
 * null when the image cannot be loaded (CORS or network). Used to give each
 * case's spine the artwork's own color, Criterion-style.
 */
export function extractDominantColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (v: string | null) => {
      img.onload = null;
      img.onerror = null;
      resolve(v);
    };
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return done(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          // weight saturated, mid-bright pixels more (skips black bars / white)
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          const weight = 0.25 + sat + (lum > 0.15 && lum < 0.9 ? 0.5 : 0);
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
          n += weight;
        }
        if (n === 0) return done(null);
        const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
        done(`#${toHex(r / n)}${toHex(g / n)}${toHex(b / n)}`);
      } catch {
        done(null); // tainted canvas (no CORS) — fall back to palette color
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}

/**
 * Draw a Criterion-style spine: the artwork's dominant color (or a
 * deterministic palette color), a thin double frame, the title set
 * vertically, the year, and the collection number. Drawn on a tall thin
 * canvas used as the case's spine texture.
 */
export function drawSpineCanvas(
  canvas: HTMLCanvasElement,
  title: string,
  year: number | null,
  number: number,
  dominantColor: string | null,
): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const base = dominantColor ?? coverPalette(title)[0];
  // darken for the spine so white type reads well
  ctx.fillStyle = shade(base, -0.25);
  ctx.fillRect(0, 0, w, h);

  // top & bottom accent bands in the palette's partner color
  const accent = dominantColor ? shade(base, 0.35) : coverPalette(title)[1];
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, Math.round(h * 0.035));
  ctx.fillRect(0, h - Math.round(h * 0.035), w, Math.round(h * 0.035));

  // thin double frame, Criterion-style
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.strokeRect(w * 0.14, h * 0.055, w * 0.72, h * 0.89);

  // collection number at the top
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(w * 0.3)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`№ ${number}`, w / 2, h * 0.115, w * 0.7);
  ctx.restore();

  // title set vertically (reading top to bottom)
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  ctx.rotate(Math.PI / 2);
  const fontSize = Math.round(w * 0.26);
  ctx.font = `700 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxLen = Math.round(h * 0.5);
  let text = title.toUpperCase();
  if (ctx.measureText(text).width > maxLen) {
    while (text.length > 3 && ctx.measureText(`${text}…`).width > maxLen) text = text.slice(0, -1);
    text = `${text}…`;
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();

  // year at the bottom
  if (year) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${Math.round(w * 0.22)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(year), w / 2, h * 0.9, w * 0.7);
    ctx.restore();
  }

  return canvas;
}

/** Shade a hex color by percent (-1..1). */
export function shade(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const channel = (shift: number) => {
    const v = (num >> shift) & 0xff;
    const out = percent >= 0 ? v + (255 - v) * percent : v * (1 + percent);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`;
}

/**
 * Procedural wood grain texture for the closet's shelves and walls.
 * Vertical streaks with noise, warm tones; `plank` adds horizontal seams.
 */
export function drawWoodCanvas(
  canvas: HTMLCanvasElement,
  opts: { tone?: 'warm' | 'dark' | 'floor'; plank?: boolean; seed?: string } = {},
): HTMLCanvasElement {
  const { tone = 'warm', plank = false, seed = 'wood' } = opts;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const tones: Record<string, [string, string]> = {
    warm: ['#8a5a33', '#5f3a1e'],
    dark: ['#6b4423', '#452a13'],
    floor: ['#4f3018', '#2f1c0c'],
  };
  const [light, dark] = tones[tone] ?? tones.warm;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // grain streaks: vertical wavy lines with varying alpha
  let rng = hashString(seed);
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };
  const streaks = Math.round(w * 0.6);
  for (let i = 0; i < streaks; i++) {
    const x = rand() * w;
    const width = 0.5 + rand() * 2.2;
    const alpha = 0.03 + rand() * 0.12;
    ctx.strokeStyle = rand() > 0.35 ? `rgba(30,16,6,${alpha})` : `rgba(220,180,130,${alpha * 0.7})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    let y = 0;
    ctx.moveTo(x, 0);
    while (y < h) {
      y += h * 0.12;
      ctx.lineTo(x + (rand() - 0.5) * w * 0.03, y);
    }
    ctx.stroke();
  }

  // knots
  const knots = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < knots; i++) {
    const kx = rand() * w;
    const ky = rand() * h;
    const kr = 2 + rand() * (w * 0.04);
    for (let r = kr; r > 0; r -= 1.5) {
      ctx.strokeStyle = `rgba(35,18,7,${0.05 + rand() * 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r, r * (0.5 + rand() * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // plank seams
  if (plank) {
    const rows = 5;
    for (let i = 1; i < rows; i++) {
      const y = (h / rows) * i;
      ctx.strokeStyle = 'rgba(15,8,3,0.55)';
      ctx.lineWidth = Math.max(1.5, h * 0.004);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,150,100,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(w, y + 2);
      ctx.stroke();
    }
  }

  return canvas;
}
