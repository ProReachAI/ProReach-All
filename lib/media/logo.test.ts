import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeBrandLogo } from "@/lib/media/logo";

describe("normalizeBrandLogo", () => {
  it("removes a flat white image backdrop while preserving the mark", async () => {
    const source = await sharp({ create: { width: 300, height: 120, channels: 3, background: "#ffffff" } })
      .composite([{ input: Buffer.from('<svg width="300" height="120"><rect x="45" y="20" width="70" height="80" rx="14" fill="#16131d"/><rect x="185" y="20" width="70" height="80" rx="14" fill="#16131d"/></svg>') }])
      .jpeg()
      .toBuffer();
    const normalized = await normalizeBrandLogo(source, 300, 120);
    const { data, info } = await sharp(normalized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];

    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBeLessThan(20);
    expect(alphaAt(Math.floor(info.width / 5), Math.floor(info.height / 2))).toBeGreaterThan(240);
  });
});
