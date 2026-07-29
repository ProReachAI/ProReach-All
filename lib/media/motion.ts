import sharp from "sharp";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { ContentPillar, MediaFrame } from "@/lib/types";
import { normalizeBrandLogo } from "@/lib/media/logo";

const palettes: Record<ContentPillar, { main: string; secondary: string; dark: string }> = {
  makeover: { main: "#7C3AED", secondary: "#C084FC", dark: "#17131F" },
  insight: { main: "#2563EB", secondary: "#67E8F9", dark: "#101827" },
  building: { main: "#EA580C", secondary: "#FBBF24", dark: "#21150E" },
  proof: { main: "#059669", secondary: "#5EEAD4", dark: "#0D1F1A" },
};

const pillarLabel: Record<ContentPillar, string> = {
  makeover: "BEFORE → AFTER",
  insight: "PRODUCT INSIGHT",
  building: "BUILDING IN PUBLIC",
  proof: "VERIFIED PRODUCT MOMENT",
};

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function wrap(value: string, max = 22) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= max || !current) current = candidate;
    else { lines.push(current); current = word; if (lines.length === 3) break; }
  }
  if (current && lines.length < 4) lines.push(current);
  return lines;
}

function animatedMotif(pillar: ContentPillar, phase: number, progress: number, main: string, secondary: string, styleId?: string) {
  if (styleId === "feature-orbit-system") {
    const rotation = Math.round(progress * 24 + phase * 18);
    return `<g transform="translate(360 610) rotate(${rotation})"><circle r="82" fill="${main}"/><circle r="34" fill="#fff"/><ellipse rx="245" ry="110" fill="none" stroke="${secondary}" stroke-width="7" opacity=".72"/><g fill="${secondary}"><circle cx="-245" r="28"/><circle cx="245" r="28"/><circle cy="-110" r="22"/></g></g>`;
  }
  if (styleId === "toolkit-grid") {
    return `<g transform="translate(100 520)">${[0, 1, 2, 3].map((item) => { const active = item <= phase; const x = (item % 2) * 250; const y = Math.floor(item / 2) * 120; return `<g transform="translate(${x} ${y})"><rect width="210" height="92" rx="24" fill="${active ? secondary : "#fff"}" opacity="${active ? ".92" : ".24"}"/><path d="M34 34h112M34 58h76" stroke="${active ? main : "#9990A0"}" stroke-width="9" stroke-linecap="round"/></g>`; }).join("")}</g>`;
  }
  if (styleId === "faceless-character-story") {
    const lift = Math.round((1 - progress) * 14);
    return `<g transform="translate(235 ${500 + lift})" filter="url(#shadow)"><circle cx="120" cy="80" r="70" fill="${secondary}"/><rect x="58" y="145" width="124" height="185" rx="58" fill="${main}"/><rect x="190" y="178" width="230" height="112" rx="27" fill="#fff" opacity=".9"/><path d="M225 214h130M225 244h92" stroke="${main}" stroke-width="11" stroke-linecap="round"/></g>`;
  }
  if (pillar === "building") {
    return `<g transform="translate(74 500)">${[0, 1, 2].map((step) => {
      const active = step <= phase;
      return `<g transform="translate(${step * 205} 0)"><rect width="150" height="100" rx="24" fill="${active ? secondary : "#FFFFFF"}" opacity="${active ? .92 : .28}"/><path d="M34 38h82M34 61h58" stroke="${active ? main : "#A89EAE"}" stroke-width="10" stroke-linecap="round"/>${step < 2 ? `<path d="M160 50h34m-12-12 13 12-13 12" fill="none" stroke="${secondary}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` : ""}</g>`;
    }).join("")}</g>`;
  }
  if (pillar === "insight") {
    const offset = Math.round((1 - progress) * 20);
    return `<g transform="translate(90 500)"><path d="M0 ${offset}h210v95H74l-36 30V95H0zM330 ${20 - offset}h210v95H466l-36 30v-30H330z" fill="#FFFFFF" opacity=".8"/><path d="M40 38h120M40 62h90M370 58h120M370 82h82" stroke="${main}" stroke-width="10" stroke-linecap="round"/><path d="M230 56h76" stroke="${secondary}" stroke-width="9" stroke-linecap="round" opacity="${phase >= 1 ? 1 : .35}"/></g>`;
  }
  if (pillar === "proof") {
    return `<g transform="translate(118 490)"><path d="M0 120V${105 - phase * 22}M95 120V${82 - phase * 16}M190 120V${98 - phase * 30}M285 120V${58 - phase * 18}" stroke="${secondary}" stroke-width="44" stroke-linecap="round"/><circle cx="410" cy="56" r="58" fill="#FFFFFF" opacity=".9"/><path d="m378 57 23 23 45-58" fill="none" stroke="${main}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return `<g transform="translate(${70 + Math.round(progress * 28)} 485)" filter="url(#shadow)">
    <rect width="215" height="110" rx="24" fill="#FFFFFF" opacity="${phase === 0 ? ".72" : ".3"}"/>
    <path d="M30 35h115M30 56h154M30 77h88" stroke="#9C96A2" stroke-width="9" stroke-linecap="round"/>
    <path d="M245 55h92m-22-22 25 22-25 22" fill="none" stroke="${secondary}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="370" width="245" height="110" rx="24" fill="#FFFFFF" opacity="${phase === 2 ? "1" : ".64"}"/>
    <path d="M400 35h164M400 58h138M400 81h105" stroke="${main}" stroke-width="9" stroke-linecap="round"/>
  </g>`;
}

async function logoData(logo?: Buffer) {
  if (!logo) return undefined;
  try {
    const normalized = await normalizeBrandLogo(logo, 170, 46);
    const metadata = await sharp(normalized).metadata();
    return { href: `data:image/png;base64,${normalized.toString("base64")}`, wide: Boolean(metadata.width && metadata.height && metadata.width / metadata.height >= 1.8) };
  } catch { return undefined; }
}

function frameSvg(input: { productName: string; pillar: ContentPillar; frames: MediaFrame[]; styleId?: string }, logo: Awaited<ReturnType<typeof logoData>>, frameNumber: number, totalFrames: number) {
  const palette = palettes[input.pillar];
  const phase = Math.min(2, Math.floor(frameNumber / (totalFrames / 3)));
  const localProgress = (frameNumber % (totalFrames / 3)) / (totalFrames / 3 - 1);
  const beat = input.frames[Math.min(phase, input.frames.length - 1)];
  const lines = wrap(beat.headline);
  const shift = Math.round((1 - localProgress) * 18);
  const glow = (0.18 + localProgress * 0.22).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.dark}"/><stop offset="1" stop-color="${palette.main}" stop-opacity=".58"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-opacity=".25"/></filter></defs>
    <rect width="720" height="900" fill="url(#bg)"/><circle cx="650" cy="60" r="210" fill="${palette.secondary}" opacity="${glow}"/>
    <text x="48" y="58" fill="${palette.secondary}" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="3">${pillarLabel[input.pillar]}</text>
    ${lines.map((line, index) => `<text x="48" y="${150 + index * 62 + shift}" fill="#FFFDF8" font-family="Georgia,serif" font-size="54" font-style="${index % 2 ? "italic" : "normal"}">${escapeXml(line)}</text>`).join("")}
    <text x="48" y="420" fill="#DCD4E4" font-family="Arial,sans-serif" font-size="23">${escapeXml(beat.supportingText.slice(0, 82))}</text>
    ${animatedMotif(input.pillar, phase, localProgress, palette.main, palette.secondary, input.styleId)}
    ${logo ? `<image href="${logo.href}" x="48" y="826" width="170" height="46" preserveAspectRatio="xMinYMid meet"/>` : ""}
    ${logo?.wide ? "" : `<text x="${logo ? 125 : 48}" y="862" fill="#FFFDF8" font-family="Arial,sans-serif" font-size="26" font-weight="720">${escapeXml(input.productName)}</text>`}
    <g transform="translate(570 846)"><circle cx="0" r="6" fill="${phase === 0 ? palette.secondary : "#6E6377"}"/><circle cx="28" r="6" fill="${phase === 1 ? palette.secondary : "#6E6377"}"/><circle cx="56" r="6" fill="${phase === 2 ? palette.secondary : "#6E6377"}"/></g>
  </svg>`;
}

export async function renderMotionClip(input: { productName: string; pillar: ContentPillar; frames: MediaFrame[]; durationSeconds: 3 | 4 | 5; styleId?: string }, brandLogo?: Buffer) {
  const logo = await logoData(brandLogo);
  const totalFrames = 12;
  const delay = Math.round((input.durationSeconds * 1000) / totalFrames);
  const gif = GIFEncoder();
  for (let index = 0; index < totalFrames; index += 1) {
    const rgba = await sharp(Buffer.from(frameSvg(input, logo, index, totalFrames))).ensureAlpha().raw().toBuffer();
    const palette = quantize(rgba, 128, { format: "rgb444" });
    const indexed = applyPalette(rgba, palette, "rgb444");
    gif.writeFrame(indexed, 720, 900, { palette, delay, repeat: 0 });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
