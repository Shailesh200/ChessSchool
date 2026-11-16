import { timingSafeEqual } from "node:crypto";
import { AdminError, currentUpdates, pauseChannel, rollbackChannel, setPaused, setRollout } from "./admin";
import { buildManifest, multipart, sfvDictionary, signBody, type Directive, type Part } from "./protocol";
import { resolveUpdate } from "./rollout";
import { PLATFORMS, type AssetStorage, type MetadataStore, type Platform } from "./types";

export type OtaHandlerOptions = {
  metadata: MetadataStore;
  /** Needed to serve assets from `/assets/*`. Leave out when `assetBaseUrl` points at a public bucket. */
  storage?: AssetStorage;
  /** Where the handler is mounted, e.g. "/ota". */
  basePath?: string;
  /** Public URL of the asset storage root (e.g. an R2 public bucket URL plus prefix). Default: this handler's `/assets/`. */
  assetBaseUrl?: string;
  /** PEM private key (PKCS#1 or PKCS#8). When set, manifests and directives carry an RSA-SHA256 `expo-signature`. */
  signingKey?: string;
  /** Must match `codeSigningMetadata.keyid` in the app config. */
  signingKeyId?: string;
  /** Bearer token for the admin routes. Without it they answer 404. */
  adminToken?: string;
  /** Channel for clients that send no `expo-channel-name`. */
  defaultChannel?: string;
  now?: () => Date;
};

const COMMON = { "expo-protocol-version": "1", "expo-sfv-version": "0", "cache-control": "private, max-age=0" };

const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const text = (status: number, message: string) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * A fetch-style handler (Request in, Response out) for Expo Updates protocol v1 plus admin routes.
 * Mount it under `basePath` in Hono (`app.all("/ota/*", (c) => ota(c.req.raw))`), Next (route handler) or Node.
 *
 *   GET  /manifest                       the update check expo-updates makes
 *   GET  /assets/<key>                   asset bytes (when `storage` is given)
 *   GET  /updates?channel=&platform=     admin: list
 *   GET  /current?channel=               admin: what each platform gets now
 *   POST /updates/<id>/rollout {percent} admin
 *   POST /updates/<id>/pause | /resume   admin
 *   POST /channels/<channel>/pause       admin: pause the newest live update(s)
 *   POST /channels/<channel>/rollback    admin: send devices back to the embedded update
 */
export function createOtaHandler(opts: OtaHandlerOptions) {
  const base = (opts.basePath ?? "").replace(/\/$/, "");
  const now = opts.now ?? (() => new Date());

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(base)) return text(404, "not found");
    const path = url.pathname.slice(base.length) || "/";
    try {
      if (req.method === "GET" && path === "/manifest") return await manifest(req, url);
      if (req.method === "GET" && path.startsWith("/assets/")) return await asset(decodeURIComponent(path.slice("/assets/".length)));
      return await admin(req, url, path);
    } catch (err) {
      if (err instanceof AdminError) return text(err.status, err.message);
      throw err;
    }
  };

  async function manifest(req: Request, url: URL): Promise<Response> {
    const h = req.headers;
    const protocol = Number(h.get("expo-protocol-version") ?? "0");
    const platform = (h.get("expo-platform") ?? url.searchParams.get("platform")) as Platform | null;
    const runtimeVersion = h.get("expo-runtime-version") ?? url.searchParams.get("runtime-version");
    const channel = h.get("expo-channel-name") ?? opts.defaultChannel ?? "production";
    const clientId = h.get("eas-client-id") ?? h.get("expo-eas-client-id");
    const current = h.get("expo-current-update-id");
    const embedded = h.get("expo-embedded-update-id");
    const wantsSignature = h.has("expo-expect-signature");

    if (protocol !== 0 && protocol !== 1) return text(406, "unsupported expo-protocol-version");
    if (!platform || !PLATFORMS.includes(platform)) return text(400, "expo-platform must be ios or android");
    if (!runtimeVersion) return text(400, "expo-runtime-version is required");
    if (wantsSignature && !opts.signingKey) return text(400, "code signing was requested but the server has no signing key");
    const accept = h.get("accept") ?? "";
    if (accept && !/multipart\/mixed|\*\/\*/.test(accept)) return text(406, "only multipart/mixed responses are served");

    const headers: Record<string, string> = {
      ...COMMON,
      "expo-manifest-filters": sfvDictionary({ channel }),
      "expo-server-defined-headers": "",
    };
    const sign = (s: string) => (wantsSignature && opts.signingKey ? signBody(s, opts.signingKey, opts.signingKeyId) : undefined);
    const respond = (parts: Part[]) => {
      const m = multipart(parts);
      return new Response(m.body, { status: 200, headers: { ...headers, "content-type": m.contentType } });
    };
    // Nothing for this runtime/channel: protocol 1 says an empty multipart may be a bodiless 204; protocol 0 used 404.
    const nothing = () => (protocol === 0 ? new Response(null, { status: 404, headers }) : new Response(null, { status: 204, headers }));
    const directive = (d: Directive) => {
      if (protocol === 0) return nothing();
      const body = JSON.stringify(d);
      return respond([{ name: "directive", json: body, signature: sign(body) }]);
    };

    const record = await resolveUpdate(opts.metadata, { channel, runtimeVersion, platform, clientId });
    if (!record) return nothing();
    if (record.kind === "rollback") {
      // Already on the embedded update: nothing to do.
      if (current && embedded && current === embedded) return directive({ type: "noUpdateAvailable" });
      return directive({ type: "rollBackToEmbedded", parameters: { commitTime: record.createdAt } });
    }
    if (current && current.toLowerCase() === record.id.toLowerCase()) return directive({ type: "noUpdateAvailable" });

    // Behind a proxy that ends TLS, the request URL says http: trust the forwarded scheme so asset URLs stay https.
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
    const origin = `${proto}://${url.host}`;
    const assetUrl = (key: string) => (opts.assetBaseUrl ? `${opts.assetBaseUrl.replace(/\/$/, "")}/${key}` : `${origin}${base}/assets/${key}`);
    const body = JSON.stringify(buildManifest(record, assetUrl));
    return respond([
      { name: "manifest", json: body, signature: sign(body) },
      { name: "extensions", json: JSON.stringify({ assetRequestHeaders: {} }) },
    ]);
  }

  async function asset(key: string): Promise<Response> {
    if (!opts.storage || !key || key.includes("..")) return text(404, "not found");
    const file = await opts.storage.get(key);
    if (!file) return text(404, "not found");
    return new Response(file.body as BodyInit, { status: 200, headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable" } });
  }

  async function admin(req: Request, url: URL, path: string): Promise<Response> {
    if (!opts.adminToken) return text(404, "not found");
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ") || !sameSecret(auth.slice(7), opts.adminToken)) return text(401, "unauthorized");
    const q = url.searchParams;
    const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
    const m = req.method;
    let match: RegExpExecArray | null;

    if (m === "GET" && path === "/updates") {
      const platform = q.get("platform") as Platform | null;
      return json(200, await opts.metadata.list({ channel: q.get("channel") ?? undefined, runtimeVersion: q.get("runtimeVersion") ?? undefined, platform: platform ?? undefined, limit: 50 }));
    }
    if (m === "GET" && path === "/current") {
      const channel = q.get("channel");
      if (!channel) return text(400, "channel is required");
      return json(200, await currentUpdates(opts.metadata, channel, q.get("runtimeVersion") ?? undefined));
    }
    if (m === "POST" && (match = /^\/updates\/([^/]+)\/rollout$/.exec(path))) return json(200, await setRollout(opts.metadata, match[1]!, Number(body.percent)));
    if (m === "POST" && (match = /^\/updates\/([^/]+)\/(pause|resume)$/.exec(path))) return json(200, await setPaused(opts.metadata, match[1]!, match[2] === "pause"));
    if (m === "POST" && (match = /^\/channels\/([^/]+)\/pause$/.exec(path))) return json(200, { paused: await pauseChannel(opts.metadata, decodeURIComponent(match[1]!)) });
    if (m === "POST" && (match = /^\/channels\/([^/]+)\/rollback$/.exec(path))) {
      const record = await rollbackChannel(opts.metadata, decodeURIComponent(match[1]!), {
        runtimeVersion: typeof body.runtimeVersion === "string" ? body.runtimeVersion : undefined,
        platform: typeof body.platform === "string" ? (body.platform as Platform) : undefined,
        message: typeof body.message === "string" ? body.message : undefined,
        now: now(),
      });
      return json(200, record);
    }
    return text(404, "not found");
  }
}
