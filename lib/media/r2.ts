import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function configuration() {
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error("R2 image storage is not configured.");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

function getClient() {
  const config = configuration();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return { client, config };
}

export async function uploadGeneratedAsset(input: {
  bytes: Buffer;
  projectId: string;
  postId: string;
  extension: "jpg" | "png" | "gif";
  contentType: "image/jpeg" | "image/png" | "image/gif";
  suffix?: string;
}) {
  const { client: s3, config } = getClient();
  const suffix = input.suffix ? `-${input.suffix.replace(/[^a-z0-9-]/gi, "-")}` : "";
  const key = `generated/${input.projectId}/${input.postId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${suffix}.${input.extension}`;
  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.bytes,
    ContentType: input.contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, url: `${config.publicBaseUrl}/${key}` };
}

export async function uploadGeneratedImage(input: { bytes: Buffer; projectId: string; postId: string }) {
  return uploadGeneratedAsset({ ...input, extension: "jpg", contentType: "image/jpeg" });
}

export async function uploadProjectLogo(input: { bytes: Buffer; projectId: string }) {
  const { client: s3, config } = getClient();
  const key = `brand/${input.projectId}/logo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.bytes,
    ContentType: "image/png",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, url: `${config.publicBaseUrl}/${key}` };
}

export async function deleteGeneratedImage(key: string | null | undefined) {
  if (!key) return;
  const { client: s3, config } = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function downloadStoredImage(key: string) {
  const { client: s3, config } = getClient();
  const result = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  if (!result.Body) throw new Error("Stored image is empty.");
  return Buffer.from(await result.Body.transformToByteArray());
}
