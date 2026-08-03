import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type S3Config = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
};

function s3Config(): S3Config | null {
  if (process.env.S3_ENABLED !== "true") return null;
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  if (!endpoint || !bucket) return null;
  return {
    endpoint,
    bucket,
    region: process.env.S3_REGION ?? "us-east-1",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  };
}

export async function uploadExportToStorage(
  fileName: string,
  csv: string
): Promise<string | null> {
  const cfg = s3Config();
  if (!cfg) return null;

  try {
    const client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });

    const safeName = fileName.replace(/[^a-z0-9-_.]/gi, "_");
    const key = `exports/${new Date().toISOString().slice(0, 10)}/${safeName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: Buffer.from(csv, "utf8"),
        ContentType: "text/csv; charset=utf-8",
        CacheControl: "private, max-age=0",
      })
    );

    const base = (cfg.publicBaseUrl ?? `${cfg.endpoint}/${cfg.bucket}`).replace(/\/$/, "");
    return `${base}/${key}`;
  } catch (err) {
    console.error("[export-storage] upload S3/MinIO impossible, repli sur le stream local :", err);
    return null;
  }
}
