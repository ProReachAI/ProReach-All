export function dailyAILimit(kind: "campaign" | "image" | "profile") {
  const key = kind === "campaign" ? "AI_DAILY_CAMPAIGN_LIMIT" : kind === "image" ? "AI_DAILY_IMAGE_LIMIT" : "AI_DAILY_PROFILE_LIMIT";
  const fallback = kind === "campaign" ? 5 : kind === "image" ? 30 : 10;
  const parsed = Number.parseInt(process.env[key] ?? String(fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
