import { createOtaHandler, fsStorage, s3Storage, sqlMetadata, type SqlClient } from "ota-server";
import type { Db } from "./db";

export type OtaHandler = (req: Request) => Promise<Response>;

/**
 * Our own over-the-air update server (packages/ota-server), mounted at /ota/*. Update records live in the API's
 * database (table ota_updates); bundles and assets live in the R2 bucket under `ota/` and are downloaded straight
 * from its public URL. Without R2 (local runs) they are served from a folder by this API.
 */
export function otaFromEnv(db: Db, env: Record<string, string | undefined>): OtaHandler {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  const r2 = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL;
  return createOtaHandler({
    basePath: "/ota",
    metadata: sqlMetadata(db.$client as unknown as SqlClient),
    storage: r2
      ? s3Storage({ endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, prefix: "ota" })
      : fsStorage(env.OTA_STORAGE_DIR ?? "ota-assets"),
    assetBaseUrl: r2 ? `${R2_PUBLIC_URL.replace(/\/$/, "")}/ota` : undefined,
    // PEM with real or escaped ("\n") line breaks, as a one-line env value needs.
    signingKey: env.OTA_SIGNING_KEY?.replace(/\\n/g, "\n"),
    adminToken: env.OTA_ADMIN_TOKEN,
  });
}
