import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderSocialCard } from "@/lib/media/social-card";

describe("renderSocialCard", () => {
  it("renders a square high-quality JPEG without calling an image model", async () => {
    const card = await renderSocialCard({
      productName: "ProPhrase AI",
      hook: "Turn a rushed workplace message into something clear.",
      cta: "Try ProPhrase free",
      pillar: "makeover",
    });
    const metadata = await sharp(card).metadata();

    expect(metadata).toMatchObject({ format: "jpeg", width: 1200, height: 1500 });
    expect(card.byteLength).toBeGreaterThan(25_000);
  });

  it("composites exact brand typography over a generated scene", async () => {
    const background = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: "#d8c5a8" },
    }).jpeg().toBuffer();
    const card = await renderSocialCard({
      productName: "ProPhrase AI",
      hook: "Protect the relationship. Keep the boundary.",
      cta: "Try ProPhrase free",
      pillar: "insight",
      overlayMotif: "message-transformation",
    }, background);
    const metadata = await sharp(card).metadata();

    expect(metadata).toMatchObject({ format: "jpeg", width: 1200, height: 1500 });
    expect(card.byteLength).toBeGreaterThan(background.byteLength);
  });

  it("composites the supplied logo asset instead of inventing a mark", async () => {
    const background = await sharp({
      create: { width: 1200, height: 1200, channels: 3, background: "#e9e1d4" },
    }).jpeg().toBuffer();
    const logo = await sharp({
      create: { width: 420, height: 100, channels: 4, background: "#ffffff00" },
    }).composite([{ input: Buffer.from(`<svg width="420" height="100"><rect x="4" y="4" width="92" height="92" rx="24" fill="#111"/><text x="118" y="69" font-size="54" font-family="Arial" font-weight="700">ProPhrase</text></svg>`) }]).png().toBuffer();
    const card = await renderSocialCard({
      productName: "ProPhrase AI",
      hook: "A confident message starts with a clear thought.",
      cta: "Try ProPhrase free",
      pillar: "makeover",
    }, background, logo);
    const metadata = await sharp(card).metadata();

    expect(metadata).toMatchObject({ format: "jpeg", width: 1200, height: 1500 });
    expect(card.byteLength).toBeGreaterThan(background.byteLength);
  });
});
