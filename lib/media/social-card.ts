import sharp, { type OverlayOptions } from "sharp";
import type { ContentPillar } from "@/lib/types";
import { normalizeBrandLogo } from "@/lib/media/logo";

type SocialCardInput = {
  productName: string;
  hook: string;
  cta: string;
  pillar: ContentPillar;
  styleId?: string;
  textPlacement?: "top-left" | "top-center" | "left" | "upper-half";
  backgroundTone?: "dark" | "light" | "vibrant";
  overlayMotif?: "message-transformation" | "guided-steps" | "evidence" | "conversation" | "none";
};

const palettes: Record<ContentPillar, { accent: string; accent2: string; wash: string; label: string }> = {
  makeover: { accent: "#7C3AED", accent2: "#A855F7", wash: "#F3E8FF", label: "BEFORE → AFTER" },
  insight: { accent: "#2563EB", accent2: "#06B6D4", wash: "#E0F2FE", label: "ONE USEFUL IDEA" },
  building: { accent: "#EA580C", accent2: "#F59E0B", wash: "#FEF3C7", label: "BUILDING IN PUBLIC" },
  proof: { accent: "#059669", accent2: "#14B8A6", wash: "#D1FAE5", label: "PRODUCT PROOF" },
};

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function truncate(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function wrap(value: string, maximumCharacters: number, maximumLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maximumLines - 1) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  const consumed = lines.join(" ").length;
  if (consumed < value.replace(/\s+/g, " ").trim().length && lines.length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], maximumCharacters - 1);
  }
  return lines;
}

function headlineText(hook: string) {
  const length = hook.replace(/\s+/g, " ").trim().length;
  const fontSize = length <= 55 ? 82 : length <= 90 ? 70 : 60;
  const maximumCharacters = length <= 55 ? 24 : length <= 90 ? 29 : 34;
  const lines = wrap(hook, maximumCharacters, 4);
  const lineHeight = Math.round(fontSize * 1.12);
  return {
    fontSize,
    lineHeight,
    markup: lines.map((line, index) => (
      `<tspan x="84" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )).join(""),
  };
}

function premiumHeadlineText(hook: string, x: number, centered = false, sans = false) {
  const length = hook.replace(/\s+/g, " ").trim().length;
  const fontSize = length <= 52 ? 72 : length <= 92 ? 59 : 49;
  const maximumCharacters = centered ? (length <= 52 ? 25 : 30) : (length <= 52 ? 18 : length <= 92 ? 21 : 24);
  const lines = wrap(hook, maximumCharacters, 5);
  const lineHeight = Math.round(fontSize * (sans ? 1.04 : 1.01));
  return {
    fontSize,
    markup: lines.map((line, index) => (
      `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}" font-style="${sans ? "normal" : index % 2 === 1 ? "italic" : "normal"}">${escapeXml(line)}</tspan>`
    )).join(""),
  };
}

function motif(pillar: ContentPillar, accent: string, accent2: string) {
  if (pillar === "makeover") {
    return `<g transform="translate(690 690)">
      <rect x="0" y="0" width="330" height="128" rx="30" fill="#FFFFFF" opacity=".72"/>
      <path d="M38 44h178M38 68h235M38 92h135" stroke="#AAA6B2" stroke-width="12" stroke-linecap="round" opacity=".65"/>
      <path d="M150 166h82" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
      <path d="m218 142 28 24-28 24" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="-56" y="220" width="386" height="150" rx="34" fill="#FFFFFF"/>
      <path d="M-8 270h258M-8 304h206" stroke="${accent2}" stroke-width="14" stroke-linecap="round"/>
      <circle cx="276" cy="318" r="26" fill="${accent}"/>
      <path d="m264 318 9 9 17-21" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
  }
  if (pillar === "proof") {
    return `<g transform="translate(700 690)">
      <rect width="330" height="350" rx="42" fill="#FFFFFF" opacity=".9"/>
      <path d="M56 288V170M126 288V118M196 288V202M266 288V72" stroke="url(#accentGradient)" stroke-width="34" stroke-linecap="round"/>
      <circle cx="270" cy="72" r="48" fill="${accent}"/>
      <path d="m247 72 16 16 31-39" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
  }
  if (pillar === "building") {
    return `<g transform="translate(700 690)">
      <rect x="0" y="0" width="150" height="150" rx="34" fill="#fff" transform="rotate(-8 75 75)"/>
      <rect x="178" y="22" width="150" height="150" rx="34" fill="${accent}" opacity=".92" transform="rotate(7 253 97)"/>
      <rect x="44" y="184" width="150" height="150" rx="34" fill="${accent2}" opacity=".82" transform="rotate(5 119 259)"/>
      <rect x="215" y="202" width="150" height="150" rx="34" fill="#fff" transform="rotate(-6 290 277)"/>
      <path d="M48 76h54M225 92h54M93 258h54M263 275h54" stroke="${accent}" stroke-width="15" stroke-linecap="round" opacity=".75"/>
    </g>`;
  }
  return `<g transform="translate(770 805)">
    <circle r="170" fill="#fff" opacity=".88"/>
    <circle r="110" fill="url(#accentGradient)" opacity=".95"/>
    <circle r="38" fill="#fff"/>
    <path d="M-260 0a260 260 0 0 1 520 0" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity=".48"/>
    <circle cx="-258" cy="0" r="24" fill="${accent2}"/>
    <circle cx="258" cy="0" r="24" fill="${accent}"/>
  </g>`;
}

function verifiedMechanismMotif(type: SocialCardInput["overlayMotif"], accent: string, accent2: string) {
  if (!type || type === "none") return "";
  const pillar: ContentPillar = type === "message-transformation"
    ? "makeover"
    : type === "guided-steps"
      ? "building"
      : type === "evidence"
        ? "proof"
        : "insight";
  return `<g opacity=".92">${motif(pillar, accent, accent2)}</g>`;
}

async function normalizedLogo(logo?: Buffer) {
  if (!logo) return undefined;
  try {
    return await normalizeBrandLogo(logo, 310, 72);
  } catch {
    return undefined;
  }
}

export async function renderSocialCard(input: SocialCardInput, generatedBackground?: Buffer, brandLogo?: Buffer) {
  const palette = palettes[input.pillar];
  const headline = headlineText(input.hook);
  const cta = truncate(input.cta, 50);
  const productName = truncate(input.productName, 28);
  const logo = await normalizedLogo(brandLogo);
  const logoMetadata = logo ? await sharp(logo).metadata() : undefined;
  const logoIsMark = Boolean(logoMetadata?.width && logoMetadata?.height && logoMetadata.width / logoMetadata.height < 1.8);

  if (generatedBackground) {
    const centered = input.textPlacement === "top-center";
    const upperHalf = input.textPlacement === "upper-half";
    const typeLed = input.styleId === "kinetic-type-world" || input.styleId === "toolkit-grid";
    const headlineX = centered ? 600 : 76;
    const headlineY = centered ? 190 : upperHalf ? 170 : 174;
    const premiumHeadline = premiumHeadlineText(input.hook, headlineX, centered, typeLed);
    const dark = input.backgroundTone === "dark" || input.backgroundTone === "vibrant";
    const textColor = dark ? "#FFFDF8" : "#15120F";
    const readability = dark ? "#09070D" : "#FFFDF8";
    const base = await sharp(generatedBackground)
      .resize(1200, 1500, { fit: "cover", position: "centre" })
      .modulate({ saturation: 0.96, brightness: dark ? 0.86 : 0.98 })
      .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
      <defs>
        <linearGradient id="readability" x1="0" y1="0" x2="${centered || upperHalf ? 0 : 1}" y2="${centered || upperHalf ? 1 : 0}">
          <stop offset="0" stop-color="${readability}" stop-opacity=".94"/><stop offset=".58" stop-color="${readability}" stop-opacity=".58"/><stop offset="1" stop-color="${readability}" stop-opacity="0"/>
        </linearGradient>
        <filter id="fineShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="${dark ? "#000000" : "#FFFFFF"}" flood-opacity=".68"/>
        </filter>
        <filter id="brandShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="${dark ? "#000000" : "#FFFFFF"}" flood-opacity=".8"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="${centered || upperHalf ? 1200 : 690}" height="${centered || upperHalf ? 690 : 1180}" fill="url(#readability)"/>
      ${verifiedMechanismMotif(input.overlayMotif, palette.accent, palette.accent2)}
      <g filter="url(#fineShadow)">
        <text x="${headlineX}" y="84" text-anchor="${centered ? "middle" : "start"}" fill="${palette.accent2}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" letter-spacing="4">${palette.label}</text>
        <text x="${headlineX}" y="${headlineY}" text-anchor="${centered ? "middle" : "start"}" fill="${textColor}" font-family="${typeLed ? "Arial, Helvetica, sans-serif" : "Georgia, 'Times New Roman', serif"}" font-size="${premiumHeadline.fontSize}" font-weight="${typeLed ? 800 : 500}" letter-spacing="${typeLed ? "-2.8" : "-2.2"}">${premiumHeadline.markup}</text>
      </g>
      <g filter="url(#brandShadow)">
        ${logo && !logoIsMark ? "" : `<text x="${logo ? 182 : 76}" y="1410" fill="${textColor}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="760">${escapeXml(productName)}</text>`}
        <rect x="${Math.max(690, 1115 - cta.length * 15)}" y="1358" width="${Math.min(425, Math.max(210, cta.length * 15 + 56))}" height="74" rx="37" fill="${palette.accent}"/>
        <text x="1090" y="1407" text-anchor="end" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="760">${escapeXml(cta)}</text>
      </g>
    </svg>`;
    const composites: OverlayOptions[] = [{ input: Buffer.from(overlay), blend: "over" }];
    if (logo) {
      const metadata = await sharp(logo).metadata();
      composites.push({
        input: logo,
        left: 76,
        top: 1397 - Math.round((metadata.height ?? 0) / 2),
        blend: "over",
      });
    }
    return sharp(base)
      .composite(composites)
      .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FBFAFF"/><stop offset="1" stop-color="${palette.wash}"/>
      </linearGradient>
      <linearGradient id="accentGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.accent}"/><stop offset="1" stop-color="${palette.accent2}"/>
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="24" stdDeviation="34" flood-color="#1E1635" flood-opacity=".14"/>
      </filter>
    </defs>
    <rect width="1200" height="1200" fill="url(#background)"/>
    <circle cx="1080" cy="90" r="310" fill="${palette.accent2}" opacity=".10"/>
    <circle cx="1030" cy="1430" r="380" fill="${palette.accent}" opacity=".10"/>
    <path d="M0 1360C280 1280 350 1440 630 1360s360-64 570 18v122H0z" fill="#fff" opacity=".65"/>

    <g font-family="Inter, Arial, Helvetica, sans-serif">
      ${logo && !logoIsMark ? "" : `<text x="${logo ? 184 : 84}" y="119" fill="#17131F" font-size="32" font-family="Georgia, 'Times New Roman', serif" font-weight="700">${escapeXml(productName)}</text>`}

      <text x="84" y="226" fill="${palette.accent}" font-size="22" font-weight="800" letter-spacing="3.4">${palette.label}</text>
      <text x="84" y="326" fill="#191620" font-size="${headline.fontSize}" font-weight="760" letter-spacing="-2.2">${headline.markup}</text>

      <g filter="url(#shadow)">${motif(input.pillar, palette.accent, palette.accent2)}</g>

      <circle cx="132" cy="1390" r="18" fill="${palette.accent}"/>
      <path d="m124 1390 6 6 13-16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="172" y="1401" fill="#282330" font-size="31" font-weight="650">${escapeXml(cta)}</text>
    </g>
  </svg>`;

  const fallback = sharp(Buffer.from(svg));
  if (logo) {
    const metadata = await sharp(logo).metadata();
    fallback.composite([{
      input: logo,
      left: 84,
      top: 107 - Math.round((metadata.height ?? 0) / 2),
      blend: "over",
    }]);
  }
  return fallback
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}
