type CloudflareEnvelope<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
};

export class CloudflareAIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerCode?: number,
  ) {
    super(message);
    this.name = "CloudflareAIError";
  }

  get quotaExceeded() {
    return this.status === 429 || /quota|limit|allowance|neuron/i.test(this.message);
  }
}

function configuration() {
  const provider = process.env.AI_PROVIDER ?? "cloudflare";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (provider !== "cloudflare") {
    throw new CloudflareAIError(`Unsupported AI provider: ${provider}.`, 503);
  }
  if (!accountId || !apiToken) {
    throw new CloudflareAIError("Cloudflare Workers AI is not configured.", 503);
  }
  return { accountId, apiToken };
}

function transportError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "TimeoutError" || name === "AbortError" || /timed?\s*out/i.test(message)) {
    return new CloudflareAIError(
      "The AI provider took too long to finish this campaign. Please try once more; no drafts were saved.",
      504,
    );
  }
  return new CloudflareAIError(
    "BuildToReach could not reach the AI provider. Check the connection and try again; no drafts were saved.",
    502,
  );
}

async function runModel<T>(model: string, body: Record<string, unknown>, timeoutMs = 120_000): Promise<T> {
  const { accountId, apiToken } = configuration();
  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    throw transportError(error);
  }

  let payload: CloudflareEnvelope<T> | undefined;
  try {
    payload = await response.json() as CloudflareEnvelope<T>;
  } catch {
    throw new CloudflareAIError(`Cloudflare returned an unreadable response (${response.status}).`, response.status);
  }

  if (!response.ok || !payload.success || payload.result === undefined) {
    const providerError = payload.errors?.[0] ?? payload.messages?.[0];
    throw new CloudflareAIError(
      providerError?.message ?? `Cloudflare Workers AI returned ${response.status}.`,
      response.status,
      providerError?.code,
    );
  }
  return payload.result;
}

async function runMultipartModel<T>(model: string, body: FormData): Promise<T> {
  const { accountId, apiToken } = configuration();
  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch (error) {
    throw transportError(error);
  }

  let payload: CloudflareEnvelope<T> | undefined;
  try {
    payload = await response.json() as CloudflareEnvelope<T>;
  } catch {
    throw new CloudflareAIError(`Cloudflare returned an unreadable response (${response.status}).`, response.status);
  }
  if (!response.ok || !payload.success || payload.result === undefined) {
    const providerError = payload.errors?.[0] ?? payload.messages?.[0];
    throw new CloudflareAIError(
      providerError?.message ?? `Cloudflare Workers AI returned ${response.status}.`,
      response.status,
      providerError?.code,
    );
  }
  return payload.result;
}

export async function generateStructuredText(options: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  schema: Record<string, unknown>;
  maxTokens?: number;
  timeoutMs?: number;
}) {
  const model = process.env.CLOUDFLARE_TEXT_MODEL ?? "@cf/meta/llama-3.1-8b-instruct-fast";
  const fallbackModel = process.env.CLOUDFLARE_TEXT_FALLBACK_MODEL;
  const models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
  let result: { response: unknown } | undefined;

  for (const [index, candidate] of models.entries()) {
    try {
      result = await runModel<{ response: unknown }>(candidate, {
        messages: options.messages,
        max_tokens: options.maxTokens ?? 4_096,
        temperature: 0.45,
        response_format: {
          type: "json_schema",
          json_schema: options.schema,
        },
      }, options.timeoutMs);
      break;
    } catch (error) {
      const canRetry = index < models.length - 1
        && error instanceof CloudflareAIError
        && !error.quotaExceeded
        && error.status >= 500;
      if (!canRetry) throw error;
      console.warn(`Cloudflare text model ${candidate} failed; retrying with the configured fallback model.`);
    }
  }

  if (!result) throw new CloudflareAIError("Cloudflare did not return a campaign response.", 502);

  if (typeof result.response === "string") {
    try {
      return JSON.parse(result.response) as unknown;
    } catch {
      throw new CloudflareAIError("Cloudflare returned invalid campaign JSON.", 502);
    }
  }
  return result.response;
}

export async function generatePremiumBackground(prompt: string) {
  const model = process.env.CLOUDFLARE_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-2-klein-4b";
  const seed = Math.floor(Math.random() * 2_147_483_647) + 1;
  let result: { image?: string };

  if (model.includes("flux-2-")) {
    const form = new FormData();
    form.set("prompt", prompt.slice(0, 2_048));
    // Generate in a native 4:5 feed composition. The application performs the
    // final 1080x1350 brand-safe crop and adds exact typography afterwards.
    form.set("width", "1024");
    form.set("height", "1280");
    form.set("guidance", "7.5");
    form.set("seed", String(seed));
    result = await runMultipartModel<{ image?: string }>(model, form);
  } else {
    result = await runModel<{ image?: string }>(model, {
      prompt: prompt.slice(0, 2_048),
      steps: 8,
      seed,
    });
  }

  if (!result.image) throw new CloudflareAIError("Cloudflare did not return an image.", 502);
  return Buffer.from(result.image, "base64");
}
