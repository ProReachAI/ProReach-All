import sharp, { type OverlayOptions } from "sharp";
import type { ContentPillar, MediaFrame } from "@/lib/types";
import { normalizeBrandLogo } from "@/lib/media/logo";

const accents: Record<ContentPillar, { main: string; secondary: string; dark: string; light: string }> = {
  makeover: { main: "#7C3AED", secondary: "#C084FC", dark: "#17131F", light: "#F5F0FF" },
  insight: { main: "#2563EB", secondary: "#67E8F9", dark: "#101827", light: "#EFF6FF" },
  building: { main: "#EA580C", secondary: "#FBBF24", dark: "#21150E", light: "#FFF7ED" },
  proof: { main: "#059669", secondary: "#5EEAD4", dark: "#0D1F1A", light: "#ECFDF5" },
};

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function wrap(value: string, maximumCharacters: number, maximumLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters || !current) current = candidate;
    else {
      lines.push(current); current = word;
      if (lines.length === maximumLines - 1) break;
    }
  }
  if (current && lines.length < maximumLines) lines.push(current);
  return lines;
}

function textLines(lines: string[], x: number, y: number, lineHeight: number, options = "") {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" ${options}>${escapeXml(line)}</text>`).join("");
}

function slideMotif(styleId: string | undefined, main: string, secondary: string, foreground: string) {
  if (styleId === "feature-orbit-system") return `<g transform="translate(810 950)"><circle r="105" fill="${main}"/><circle r="48" fill="#fff" opacity=".94"/><g fill="${secondary}"><circle cx="-170" cy="-25" r="36"/><circle cx="150" cy="-92" r="36"/><circle cx="158" cy="112" r="36"/></g><g fill="none" stroke="${secondary}" stroke-width="5" opacity=".72"><ellipse rx="220" ry="135"/><ellipse rx="220" ry="135" transform="rotate(58)"/></g></g>`;
  if (styleId === "toolkit-grid") return `<g transform="translate(690 825)">${[[0,0],[160,0],[0,160],[160,160]].map(([x,y], index) => `<g transform="translate(${x} ${y})"><rect width="132" height="132" rx="30" fill="${index === 3 ? main : foreground}" opacity="${index === 3 ? ".94" : ".12"}"/><path d="M33 42h66M33 66h45M33 90h76" stroke="${index === 3 ? "#fff" : secondary}" stroke-width="9" stroke-linecap="round"/></g>`).join("")}</g>`;
  if (styleId === "cinematic-3d-symbol" || styleId === "signal-vs-noise") return `<g transform="translate(815 960)" filter="url(#shadow)"><path d="M0-150 44-55 150 0 44 55 0 150-44 55-150 0-44-55Z" fill="${main}"/><path d="M0-92 26-34 92 0 26 34 0 92-26 34-92 0-26-34Z" fill="#fff" opacity=".9"/><circle r="24" fill="${secondary}"/></g>`;
  if (styleId === "faceless-character-story") return `<g transform="translate(760 805)" filter="url(#shadow)"><circle cx="105" cy="100" r="86" fill="${secondary}"/><rect x="38" y="170" width="134" height="188" rx="64" fill="${main}"/><rect x="-70" y="228" width="150" height="92" rx="28" fill="#fff" opacity=".92"/><path d="M-40 258h82M-40 283h58" stroke="${main}" stroke-width="10" stroke-linecap="round"/><circle cx="105" cy="100" r="28" fill="#fff" opacity=".18"/></g>`;
  if (styleId === "before-after-contrast") return `<g transform="translate(650 860)" filter="url(#shadow)"><rect width="172" height="220" rx="34" fill="${foreground}" opacity=".14"/><path d="M35 55h72M35 88h102M35 121h48M35 154h90" stroke="${secondary}" stroke-width="11" stroke-linecap="round" opacity=".55"/><path d="M202 110h72m-24-24 26 24-26 24" fill="none" stroke="${main}" stroke-width="13" stroke-linecap="round"/><rect x="304" width="214" height="220" rx="34" fill="${main}"/><path d="M345 63h125M345 101h94M345 139h110" stroke="#fff" stroke-width="12" stroke-linecap="round"/></g>`;
  return `<g transform="translate(700 840)" filter="url(#shadow)"><rect width="300" height="280" rx="42" fill="${foreground}" opacity=".12"/><rect x="30" y="30" width="240" height="48" rx="15" fill="${main}"/><rect x="30" y="100" width="106" height="116" rx="22" fill="${secondary}" opacity=".7"/><rect x="154" y="100" width="116" height="116" rx="22" fill="${foreground}" opacity=".16"/><path d="M181 136h62M181 166h44" stroke="${main}" stroke-width="10" stroke-linecap="round"/></g>`;
}

async function normalizedLogo(logo?: Buffer) {
  if (!logo) return undefined;
  try {
    return await normalizeBrandLogo(logo, 260, 62);
  } catch { return undefined; }
}

function slideArtwork(frame: MediaFrame, index: number, total: number, pillar: ContentPillar, productName: string, hasWideLogo: boolean, styleId?: string) {
  const palette = accents[pillar];
  const cover = index === 0;
  const finish = index === total - 1;
  const dark = cover || finish;
  const background = dark ? palette.dark : palette.light;
  const foreground = dark ? "#FFFDF8" : "#17131F";
  const supporting = dark ? "#D8D2DD" : "#625B69";
  const title = wrap(frame.headline, cover ? 18 : 23, cover ? 6 : 5);
  const body = wrap(frame.supportingText, 42, 5);
  const step = String(index + 1).padStart(2, "0");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${dark ? palette.main : "#FFFFFF"}" stop-opacity="${dark ? ".32" : ".7"}"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="14" stdDeviation="22" flood-opacity=".16"/></filter></defs>
    <rect width="1080" height="1080" fill="url(#wash)"/>
    <circle cx="1010" cy="105" r="270" fill="${palette.secondary}" opacity="${dark ? ".13" : ".2"}"/>
    <path d="M700 140h240v240H700zM770 210h240v240H770z" fill="none" stroke="${palette.secondary}" stroke-width="5" opacity=".32"/>
    <text x="72" y="82" fill="${palette.secondary}" font-family="Arial,sans-serif" font-size="19" font-weight="700" letter-spacing="4">${finish ? "YOUR NEXT STEP" : cover ? "SWIPE FOR THE PRACTICAL VERSION" : `IDEA ${step}`}</text>
    ${textLines(title, 72, cover ? 230 : 250, cover ? 82 : 68, `fill="${foreground}" font-family="Georgia,serif" font-size="${cover ? 75 : 62}" font-weight="500" letter-spacing="-1.5"`)}
    <line x1="72" y1="${cover ? 690 : 640}" x2="250" y2="${cover ? 690 : 640}" stroke="${palette.main}" stroke-width="10" stroke-linecap="round"/>
    ${textLines(body, 72, cover ? 755 : 705, 38, `fill="${supporting}" font-family="Arial,sans-serif" font-size="28" font-weight="450"`)}
    ${slideMotif(styleId, palette.main, palette.secondary, foreground)}
    ${hasWideLogo ? "" : `<text x="150" y="1275" fill="${foreground}" font-family="Arial,sans-serif" font-size="31" font-weight="720">${escapeXml(productName)}</text>`}
    <text x="1000" y="1275" text-anchor="end" fill="${supporting}" font-family="Arial,sans-serif" font-size="22" font-weight="650">${index + 1} / ${total}</text>
  </svg>`;
}

export async function renderCarouselSlides(input: { productName: string; pillar: ContentPillar; frames: MediaFrame[]; styleId?: string }, brandLogo?: Buffer) {
  const logo = await normalizedLogo(brandLogo);
  const metadata = logo ? await sharp(logo).metadata() : undefined;
  const hasWideLogo = Boolean(metadata?.width && metadata?.height && metadata.width / metadata.height >= 1.8);
  const frames = input.frames.slice(0, 5);
  const output: Buffer[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    const svg = slideArtwork(frames[index], index, frames.length, input.pillar, input.productName, hasWideLogo, input.styleId);
    const composites: OverlayOptions[] = [];
    if (logo) composites.push({ input: logo, left: 72, top: 1263 - Math.round((metadata?.height ?? 0) / 2) });
    output.push(await sharp(Buffer.from(svg)).composite(composites).jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer());
  }
  return output;
}
