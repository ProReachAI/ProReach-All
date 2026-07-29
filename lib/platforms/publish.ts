import type { DuePost } from "@/lib/db";

export type PublishResult = { remotePostId: string; remotePostUrl?: string };

export function postText(post: Pick<DuePost, "hook" | "body" | "cta" | "hashtags">) {
  return [post.hook, post.body, post.cta, post.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

export function linkedInAuthor(post: Pick<DuePost, "providerAccountId" | "accountMetadata" | "accountScopes">) {
  const configuredOwner = typeof post.accountMetadata.authorUrn === "string" ? post.accountMetadata.authorUrn : "";
  const destinationType = post.accountMetadata.destinationType === "organization" ? "organization" : "person";
  const owner = configuredOwner || `urn:li:${destinationType}:${post.providerAccountId}`;
  if (!/^urn:li:(person|organization):[^\s]+$/.test(owner)) throw new Error("The selected LinkedIn destination has an invalid author identifier");
  const requiredScope = owner.startsWith("urn:li:organization:") ? "w_organization_social" : "w_member_social";
  if (!post.accountScopes.includes(requiredScope)) {
    throw new Error(`The selected LinkedIn destination is missing ${requiredScope}. Reconnect LinkedIn and approve the requested permission.`);
  }
  return owner;
}

async function jsonRequest(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const payload = await response.json() as Record<string, unknown> & { error?: { message?: string }; title?: string; detail?: string };
  if (!response.ok) throw new Error(payload.error?.message ?? payload.detail ?? payload.title ?? `Provider returned ${response.status}`);
  return payload;
}

async function publishX(post: DuePost): Promise<PublishResult> {
  const text = postText(post);
  if (text.length > 280) throw new Error(`X post is ${text.length} characters; edit it to 280 or fewer before publishing`);
  const sourceAssets = post.mediaItems.length > 0
    ? post.mediaItems.slice(0, 4)
    : post.mediaUrl ? [{ url: post.mediaUrl, key: "legacy", contentType: "image/jpeg" as const }] : [];
  const mediaIds: string[] = [];
  for (const asset of sourceAssets) {
    const source = await fetch(asset.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!source.ok) throw new Error(`Could not download the X image (${source.status})`);
    const mediaType = source.headers.get("content-type")?.split(";")[0] ?? asset.contentType;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(mediaType)) {
      throw new Error(`X simple image upload does not support ${mediaType}`);
    }
    const bytes = await source.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("The generated X image is larger than 5 MB");
    const upload = await jsonRequest("https://api.x.com/2/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${post.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        media: Buffer.from(bytes).toString("base64"),
        media_category: "tweet_image",
        media_type: mediaType,
        shared: false,
      }),
    });
    const mediaId = String((upload.data as { id?: string } | undefined)?.id ?? "");
    if (!mediaId) throw new Error("X did not return a media ID");
    mediaIds.push(mediaId);
  }
  const payload = await jsonRequest("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${post.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text, made_with_ai: true, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
  });
  const data = payload.data as { id?: string } | undefined;
  if (!data?.id) throw new Error("X did not return a post ID");
  return { remotePostId: data.id, remotePostUrl: `https://x.com/i/web/status/${data.id}` };
}

async function publishLinkedIn(post: DuePost): Promise<PublishResult> {
  const owner = linkedInAuthor(post);
  const version = process.env.LINKEDIN_API_VERSION ?? "202606";
  const uploadedImages: Array<{ id: string; altText: string }> = [];

  const sourceAssets = post.mediaItems.length > 0
    ? post.mediaItems
    : post.mediaUrl ? [{ url: post.mediaUrl, key: "legacy", contentType: "image/jpeg" as const }] : [];
  for (const [index, asset] of sourceAssets.entries()) {
    const source = await fetch(asset.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!source.ok) throw new Error(`Could not download the LinkedIn image (${source.status})`);
    const contentType = source.headers.get("content-type")?.split(";")[0] ?? asset.contentType;
    if (!new Set(["image/jpeg", "image/png", "image/gif"]).has(contentType)) {
      throw new Error(`LinkedIn does not support the generated image type ${contentType}`);
    }
    const imageBytes = await source.arrayBuffer();
    if (imageBytes.byteLength > 20 * 1024 * 1024) throw new Error("The generated LinkedIn image is larger than 20 MB");

    const initialize = await jsonRequest("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${post.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": version,
      },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    const value = initialize.value as { uploadUrl?: string; image?: string } | undefined;
    if (!value?.uploadUrl || !value.image) throw new Error("LinkedIn did not initialize the image upload");

    const upload = await fetch(value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${post.accessToken}`, "Content-Type": contentType },
      body: imageBytes,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!upload.ok) throw new Error(`LinkedIn image upload returned ${upload.status}: ${(await upload.text()).slice(0, 250)}`);
    uploadedImages.push({ id: value.image, altText: `${post.hook.slice(0, 100)}${sourceAssets.length > 1 ? ` — slide ${index + 1}` : ""}` });
  }

  const content = uploadedImages.length > 1
    ? { multiImage: { images: uploadedImages } }
    : uploadedImages[0] ? { media: uploadedImages[0] } : undefined;

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${post.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
    },
    body: JSON.stringify({
      author: owner,
      commentary: postText(post),
      ...(content ? { content } : {}),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn returned ${response.status}: ${error.slice(0, 300)}`);
  }
  const id = response.headers.get("x-restli-id");
  if (!id) throw new Error("LinkedIn did not return a post ID");
  return { remotePostId: id, remotePostUrl: `https://www.linkedin.com/feed/update/${id}/` };
}

async function publishThreads(post: DuePost): Promise<PublishResult> {
  const create = new URLSearchParams({
    media_type: post.mediaUrl ? "IMAGE" : "TEXT",
    text: postText(post),
    ...(post.mediaUrl ? { image_url: post.mediaUrl } : {}),
    access_token: post.accessToken,
  });
  const container = await jsonRequest(`https://graph.threads.net/v1.0/${encodeURIComponent(post.providerAccountId)}/threads`, { method: "POST", body: create });
  const creationId = String(container.id ?? "");
  if (!creationId) throw new Error("Threads did not return a container ID");
  const publish = new URLSearchParams({ creation_id: creationId, access_token: post.accessToken });
  const result = await jsonRequest(`https://graph.threads.net/v1.0/${encodeURIComponent(post.providerAccountId)}/threads_publish`, { method: "POST", body: publish });
  const id = String(result.id ?? "");
  if (!id) throw new Error("Threads did not return a post ID");
  return { remotePostId: id };
}

export function instagramGraphBase(post: Pick<DuePost, "accountMetadata">) {
  const version = process.env.META_GRAPH_VERSION ?? "v25.0";
  return post.accountMetadata.graphHost === "graph.instagram.com"
    ? `https://graph.instagram.com/${version}`
    : `https://graph.facebook.com/${version}`;
}

async function publishInstagram(post: DuePost): Promise<PublishResult> {
  if (!post.mediaUrl) throw new Error("Instagram publishing needs a publicly accessible media URL");
  const directLogin = post.accountMetadata.graphHost === "graph.instagram.com";
  const requiredScope = directLogin ? "instagram_business_content_publish" : "instagram_content_publish";
  if (!post.accountScopes.includes(requiredScope)) {
    throw new Error(`The selected Instagram account is missing ${requiredScope}. Reconnect Instagram and approve publishing.`);
  }
  const graphBase = instagramGraphBase(post);
  let creationId = "";
  if (post.mediaType === "carousel" && post.mediaItems.length >= 2) {
    const children: string[] = [];
    for (const asset of post.mediaItems.slice(0, 10)) {
      const child = await jsonRequest(`${graphBase}/${encodeURIComponent(post.providerAccountId)}/media`, {
        method: "POST",
        body: new URLSearchParams({ image_url: asset.url, is_carousel_item: "true", access_token: post.accessToken }),
      });
      if (!child.id) throw new Error("Instagram did not return a carousel child ID");
      children.push(String(child.id));
    }
    const container = await jsonRequest(`${graphBase}/${encodeURIComponent(post.providerAccountId)}/media`, {
      method: "POST",
      body: new URLSearchParams({ media_type: "CAROUSEL", children: JSON.stringify(children), caption: postText(post), access_token: post.accessToken }),
    });
    creationId = String(container.id ?? "");
  } else {
    if (post.mediaType === "motion") throw new Error("Instagram motion publishing requires native MP4; choose image or carousel for this version");
    const create = new URLSearchParams({ image_url: post.mediaUrl, caption: postText(post), access_token: post.accessToken });
    const container = await jsonRequest(`${graphBase}/${encodeURIComponent(post.providerAccountId)}/media`, { method: "POST", body: create });
    creationId = String(container.id ?? "");
  }
  if (!creationId) throw new Error("Instagram did not return a media container ID");
  const publish = new URLSearchParams({ creation_id: creationId, access_token: post.accessToken });
  const result = await jsonRequest(`${graphBase}/${encodeURIComponent(post.providerAccountId)}/media_publish`, { method: "POST", body: publish });
  const id = String(result.id ?? "");
  if (!id) throw new Error("Instagram did not return a post ID");
  return { remotePostId: id };
}

async function publishFacebook(post: DuePost): Promise<PublishResult> {
  const version = process.env.META_GRAPH_VERSION ?? "v25.0";
  if (post.mediaType === "carousel" && post.mediaItems.length >= 2) {
    const attached: Array<{ media_fbid: string }> = [];
    for (const asset of post.mediaItems.slice(0, 10)) {
      const photo = await jsonRequest(`https://graph.facebook.com/${version}/${encodeURIComponent(post.providerAccountId)}/photos`, {
        method: "POST",
        body: new URLSearchParams({ url: asset.url, published: "false", access_token: post.accessToken }),
      });
      if (!photo.id) throw new Error("Facebook did not return a photo ID for the carousel");
      attached.push({ media_fbid: String(photo.id) });
    }
    const result = await jsonRequest(`https://graph.facebook.com/${version}/${encodeURIComponent(post.providerAccountId)}/feed`, {
      method: "POST",
      body: new URLSearchParams({ message: postText(post), attached_media: JSON.stringify(attached), access_token: post.accessToken }),
    });
    const id = String(result.id ?? "");
    if (!id) throw new Error("Facebook did not return a post ID");
    return { remotePostId: id, remotePostUrl: `https://www.facebook.com/${id.replace("_", "/posts/")}` };
  }
  const endpoint = post.mediaUrl ? "photos" : "feed";
  const body = post.mediaUrl
    ? new URLSearchParams({ url: post.mediaUrl, caption: postText(post), published: "true", access_token: post.accessToken })
    : new URLSearchParams({ message: postText(post), access_token: post.accessToken });
  const result = await jsonRequest(
    `https://graph.facebook.com/${version}/${encodeURIComponent(post.providerAccountId)}/${endpoint}`,
    { method: "POST", body },
  );
  const id = String(result.post_id ?? result.id ?? "");
  if (!id) throw new Error("Facebook did not return a post ID");
  return { remotePostId: id, remotePostUrl: `https://www.facebook.com/${id.replace("_", "/posts/")}` };
}

export async function publishPost(post: DuePost): Promise<PublishResult> {
  switch (post.platform) {
    case "facebook": return publishFacebook(post);
    case "x": return publishX(post);
    case "linkedin": return publishLinkedIn(post);
    case "threads": return publishThreads(post);
    case "instagram": return publishInstagram(post);
  }
}
