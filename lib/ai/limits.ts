export function dailyAILimit(kind: "campaign" | "image") {
  const key = kind === "campaign" ? "AI_DAILY_CAMPAIGN_LIMIT" : "AI_DAILY_IMAGE_LIMIT";
  const fallback = kind === "campaign" ? 5 : 30;
  const parsed = Number.parseInt(process.env[key] ?? String(fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
