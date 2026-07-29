import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderCarouselSlides } from "@/lib/media/carousel";
import { renderMotionClip } from "@/lib/media/motion";

const frames = [
  { headline: "A rough message", supportingText: "Start with the real communication problem." },
  { headline: "Choose the outcome", supportingText: "Keep the original intent and clarify the next step." },
  { headline: "Ready to send", supportingText: "Communicate with a deliberate tone." },
  { headline: "Try the workflow", supportingText: "Use it on the next difficult message." },
];

describe("mixed media renderers", () => {
  it("renders every carousel frame as a square JPEG", async () => {
    const slides = await renderCarouselSlides({ productName: "ProPhrase", pillar: "makeover", frames });
    expect(slides).toHaveLength(4);
    const metadata = await sharp(slides[0]).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
  });

  it("renders a compact animated GIF motion asset", async () => {
    const bytes = await renderMotionClip({ productName: "ProPhrase", pillar: "building", frames: frames.slice(0, 3), durationSeconds: 4 });
    expect(bytes.subarray(0, 6).toString()).toBe("GIF89a");
    const metadata = await sharp(bytes, { animated: true }).metadata();
    expect(metadata.pages).toBe(12);
    expect(metadata.width).toBe(720);
    expect(metadata.pageHeight).toBe(900);
  });
});
