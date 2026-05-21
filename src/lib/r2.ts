import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type R2Config = {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  endpoint: string;
  publicUrl: string | null;
  secretAccessKey: string;
};

function getEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return "";
}

function getR2Config(): R2Config {
  const accountId = getEnv("CLOUDFLARE_R2_ACCOUNT_ID", "R2_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = getEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
  const bucketName = getEnv("CLOUDFLARE_R2_BUCKET_NAME", "R2_BUCKET_NAME", "AWS_BUCKET_NAME");
  const endpoint =
    getEnv("CLOUDFLARE_R2_ENDPOINT", "R2_ENDPOINT", "AWS_ENDPOINT_URL_S3") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const publicUrl = getEnv("CLOUDFLARE_R2_PUBLIC_URL", "R2_PUBLIC_URL");

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("Cloudflare R2 is not configured for company logo uploads.");
  }

  return {
    accessKeyId,
    accountId,
    bucketName,
    endpoint,
    publicUrl: publicUrl || null,
    secretAccessKey,
  };
}

function getR2Client() {
  const config = getR2Config();

  return {
    bucketName: config.bucketName,
    client: new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: true,
      region: "auto",
    }),
    publicUrl: config.publicUrl,
  };
}

export async function uploadR2Object({ body, contentType, key }: { body: Buffer; contentType: string; key: string }) {
  const { bucketName, client } = getR2Client();

  await client.send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucketName,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: contentType,
      Key: key,
    }),
  );
}

export async function deleteR2Object(key: string | null | undefined) {
  if (!key) return;

  const { bucketName, client } = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export async function getR2Object(key: string) {
  const { bucketName, client } = getR2Client();

  return client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}

export function getR2PublicUrl(key: string) {
  const { publicUrl } = getR2Client();

  if (!publicUrl) {
    return null;
  }

  return `${publicUrl.replace(/\/+$/, "")}/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}
