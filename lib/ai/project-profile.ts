import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { CloudflareAIError, generateStructuredText } from "@/lib/ai/cloudflare";

const MAX_PAGE_BYTES = 650_000;
const MAX_CONTEXT_CHARACTERS = 26_000;
const MAX_PAGES = 4;
const REDIRECT_LIMIT = 4;

export const WebsiteProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  oneLiner: z.string().trim().min(10).max(240),
  description: z.string().trim().min(30).max(3000),
  problemStatement: z.string().trim().min(20).max(2000),
  solution: z.string().trim().min(20).max(2000),
  targetAudience: z.string().trim().min(20).max(2000),
  audiencePainPoints: z.string().trim().min(20).max(2000),
  useCases: z.string().trim().min(10).max(2000),
  keyFeatures: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  differentiators: z.string().trim().min(20).max(2000),
  proofPoints: z.string().trim().min(10).max(2500),
  competitors: z.string().trim().min(10).max(1000),
  brandVoice: z.string().trim().min(10).max(1000),
  toneGuidelines: z.string().trim().min(10).max(1500),
  wordsToUse: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  wordsToAvoid: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  primaryGoal: z.string().trim().min(10).max(1000),
  primaryCta: z.string().trim().min(5).max(500),
  additionalContext: z.string().trim().min(10).max(3000),
});

export type WebsiteProfile = z.infer<typeof WebsiteProfileSchema>;

type HostResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class WebsiteAnalysisError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "WebsiteAnalysisError";
  }
}

export function normalizeWebsiteUrl(value: string) {
  const input = value.trim();
  if (!input) throw new WebsiteAnalysisError("Enter a website URL to autofill the project.");
  let url: URL;
  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
    url = new URL(hasScheme ? input : `https://${input}`);
  } catch {
    throw new WebsiteAnalysisError("Enter a valid public website, such as https://example.com.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new WebsiteAnalysisError("Only public HTTP or HTTPS website URLs can be analyzed.");
  }
  url.hash = "";
  return url;
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return false;
  if (/^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff")) return false;
  if (normalized.startsWith("2001:db8:")) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPublicIpv4(mapped) : true;
}

async function defaultResolver(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

async function assertPublicUrl(url: URL, resolveHostname: HostResolver) {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new WebsiteAnalysisError("That address is not a public website.");
  }
  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) throw new WebsiteAnalysisError("Private or internal website addresses cannot be analyzed.");
    return;
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolveHostname(hostname);
  } catch {
    throw new WebsiteAnalysisError("The website address could not be found.", 422);
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new WebsiteAnalysisError("Private or internal website addresses cannot be analyzed.");
  }
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PAGE_BYTES) throw new WebsiteAnalysisError("The website page is too large to analyze.", 422);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new WebsiteAnalysisError("The website page is too large to analyze.", 422);
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

async function fetchPage(url: URL, fetchImpl: Fetcher, resolveHostname: HostResolver) {
  let current = url;
  for (let redirect = 0; redirect <= REDIRECT_LIMIT; redirect += 1) {
    await assertPublicUrl(current, resolveHostname);
    let response: Response;
    try {
      response = await fetchImpl(current, {
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
          "User-Agent": "ProReach-Website-Analyzer/1.0",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new WebsiteAnalysisError("The website could not be reached. Check the URL and try again.", 422);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new WebsiteAnalysisError("The website returned an invalid redirect.", 422);
      current = new URL(location, current);
      if (!["http:", "https:"].includes(current.protocol)) {
        throw new WebsiteAnalysisError("The website redirected to an unsupported address.", 422);
      }
      continue;
    }
    if (!response.ok) throw new WebsiteAnalysisError(`The website returned ${response.status} and could not be analyzed.`, 422);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) {
      throw new WebsiteAnalysisError("That URL does not point to a readable website page.", 422);
    }
    return { html: await readLimitedBody(response), url: current };
  }
  throw new WebsiteAnalysisError("The website redirected too many times.", 422);
}

const entityMap: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"",
};

function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return entityMap[entity.toLowerCase()] ?? match;
  });
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

export function extractReadablePage(html: string, pageUrl: URL) {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const descriptions = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .filter(([tag]) => ["description", "og:description", "twitter:description"].includes((attribute(tag, "name") || attribute(tag, "property")).toLowerCase()))
    .map(([tag]) => attribute(tag, "content"))
    .filter(Boolean);
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
    .map((match) => decodeEntities(match[1] ?? match[2] ?? match[3] ?? ""))
    .filter(Boolean);
  const text = decodeEntities(html
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(script|style|svg|canvas|noscript|template|form|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return {
    text: [`PAGE: ${pageUrl.href}`, title && `TITLE: ${title}`, ...descriptions.map((item) => `DESCRIPTION: ${item}`), text]
      .filter(Boolean).join("\n").slice(0, 12_000),
    links,
  };
}

function relevantLinks(links: string[], baseUrl: URL) {
  const terms = ["product", "feature", "solution", "use-case", "customer", "about", "pricing", "how-it-works", "platform", "service"];
  const scored = new Map<string, number>();
  for (const href of links) {
    let url: URL;
    try { url = new URL(href, baseUrl); } catch { continue; }
    if (url.origin !== baseUrl.origin || !["http:", "https:"].includes(url.protocol)) continue;
    url.hash = ""; url.search = "";
    const path = url.pathname.toLowerCase().replace(/\/$/, "") || "/";
    if (path === (baseUrl.pathname.toLowerCase().replace(/\/$/, "") || "/") || /\.(pdf|jpg|jpeg|png|webp|svg|zip)$/i.test(path)) continue;
    const score = terms.reduce((total, term, index) => total + (path.includes(term) ? terms.length - index : 0), 0);
    if (score > 0) scored.set(url.href, Math.max(score, scored.get(url.href) ?? 0));
  }
  return [...scored].sort((a, b) => b[1] - a[1]).slice(0, MAX_PAGES - 1).map(([href]) => new URL(href));
}

export async function collectWebsiteContext(rawUrl: string, options: { fetchImpl?: Fetcher; resolveHostname?: HostResolver } = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHostname = options.resolveHostname ?? defaultResolver;
  const requestedUrl = normalizeWebsiteUrl(rawUrl);
  const homepage = await fetchPage(requestedUrl, fetchImpl, resolveHostname);
  const first = extractReadablePage(homepage.html, homepage.url);
  if (first.text.replace(/PAGE:.*|TITLE:.*|DESCRIPTION:.*/g, "").trim().length < 80) {
    throw new WebsiteAnalysisError("The website did not expose enough readable information to autofill the project.", 422);
  }
  const pages = [{ url: homepage.url, text: first.text }];
  for (const link of relevantLinks(first.links, homepage.url)) {
    try {
      const page = await fetchPage(link, fetchImpl, resolveHostname);
      const readable = extractReadablePage(page.html, page.url).text;
      if (readable.length >= 100) pages.push({ url: page.url, text: readable });
    } catch {
      // A secondary page should not prevent analysis of a useful homepage.
    }
  }
  let remaining = MAX_CONTEXT_CHARACTERS;
  const context = pages.map((page) => {
    const excerpt = page.text.slice(0, Math.max(remaining, 0));
    remaining -= excerpt.length;
    return excerpt;
  }).filter(Boolean).join("\n\n---\n\n");
  return { websiteUrl: homepage.url.href, pages: pages.map((page) => page.url.href), context };
}

const profileSystemPrompt = `You are a meticulous product marketing researcher. Convert supplied website copy into an editable project brief.

Rules:
- The website excerpts are the only factual source. Never invent capabilities, users, results, integrations, customers, testimonials, awards, prices, or metrics.
- Separate explicit website claims from reasonable messaging interpretation. Phrase uncertain audience or pain-point interpretations conservatively.
- Proof points may contain only concrete facts or claims visibly present in the excerpts. Attribute claims to the website when independent verification is unavailable.
- Name competitors only when the excerpts name them. Otherwise describe obvious non-vendor alternatives such as manual work or the status quo and say that no named competitor was stated.
- Derive brand voice, preferred language, and tone from the actual copy style. Choose words to avoid as editorial guardrails, not as claims about the brand.
- Use plain, specific language. Do not use generic hype.
- Fill every field. Arrays must contain short, distinct items. Return only the requested structured object.`;

export async function generateWebsiteProfile(context: string) {
  const generated = await generateStructuredText({
    schema: z.toJSONSchema(WebsiteProfileSchema) as Record<string, unknown>,
    maxTokens: 3_200,
    timeoutMs: 75_000,
    messages: [
      { role: "system", content: profileSystemPrompt },
      { role: "user", content: `Build the project brief from these website excerpts:\n\n${context}` },
    ],
  });
  const validation = WebsiteProfileSchema.safeParse(generated);
  if (!validation.success) throw new CloudflareAIError("The website analysis was incomplete. Please try again.", 502);
  return validation.data;
}
