/** Programmatic proposal-cover generator — no image-gen AI, just an on-brand SVG
 * gradient (same two-stop 135deg diagonal shape as --grad-brand in app/globals.css,
 * but computed in hex/HSL so it renders identically as a plain <img>/background-image
 * asset, without depending on the viewer's oklch() support). Used by onboarding as the
 * default cover when the customer didn't share an image worth using directly. */

function hexToRgb(hex: string): [number, number, number] {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#5B3DF6";
  return [parseInt(clean.slice(1, 3), 16), parseInt(clean.slice(3, 5), 16), parseInt(clean.slice(5, 7), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Rotates the brand color ~30° around the wheel and deepens it slightly for the
 * second gradient stop — mirrors --grad-brand's indigo→violet relationship for any
 * starting hue, not just indigo. */
function secondStop(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex((h + 32) % 360, Math.min(1, s + 0.05), Math.max(0.28, l - 0.08));
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildCoverSvg({
  primaryColor,
  logoDataUri,
  width = 1600,
  height = 500,
}: {
  primaryColor: string;
  /** Pass the logo as a data: URI (fetched + base64-encoded by the caller) — an SVG
   * <image> can't reliably cross-origin-load a remote Supabase Storage URL. */
  logoDataUri?: string | null;
  width?: number;
  height?: number;
}): string {
  const from = /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#5B3DF6";
  const to = secondStop(from);
  const logoSize = Math.min(height * 0.34, 120);
  const logo = logoDataUri
    ? `<image href="${escapeXml(logoDataUri)}" x="${(width - logoSize) / 2}" y="${(height - logoSize) / 2}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" opacity="0.96" />`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
    <radialGradient id="glow1" cx="12%" cy="15%" r="55%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow2" cx="90%" cy="85%" r="60%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)" />
  <rect width="${width}" height="${height}" fill="url(#glow1)" />
  <rect width="${width}" height="${height}" fill="url(#glow2)" />
  ${logo}
</svg>`;
}
