export type Platform = "ios" | "android";
export const PLATFORMS: Platform[] = ["ios", "android"];

/** One file of an update, as stored. `storageKey` is where the bytes live in the asset storage. */
export type StoredAsset = {
  /** Base64URL SHA-256 of the file (the client checks it). */
  hash: string;
  /** The key the app's code uses for the asset (MD5 hex, as Metro names assets). */
  key: string;
  contentType: string;
  fileExtension?: string;
  storageKey: string;
};

export type UpdateBody = {
  launchAsset: StoredAsset;
  assets: StoredAsset[];
  /** Becomes `extra` in the manifest, e.g. `{ expoClient: <public app config> }`. */
  extra?: Record<string, unknown>;
  metadata?: Record<string, string>;
};

/**
 * A published update, or a "roll back to embedded" marker. `"*"` in runtimeVersion or platform matches any value
 * (rollbacks use it to cover a whole channel).
 */
export type OtaRecord = {
  id: string;
  kind: "update" | "rollback";
  channel: string;
  runtimeVersion: string;
  platform: Platform | "*";
  /** ISO 8601. Newest wins. */
  createdAt: string;
  message: string;
  /** 0–100: share of devices (by a stable hash of their client id) that get this update. */
  rolloutPercent: number;
  /** A paused record is skipped, so devices get the next older one. */
  paused: boolean;
  body: UpdateBody | null;
};

export type ListQuery = { channel?: string; runtimeVersion?: string; platform?: Platform; limit?: number };

/** Updates, channels and rollouts. `list` returns newest first; `"*"` rows match any runtime or platform asked for. */
export interface MetadataStore {
  add(record: OtaRecord): Promise<void>;
  get(id: string): Promise<OtaRecord | null>;
  list(query?: ListQuery): Promise<OtaRecord[]>;
  update(id: string, patch: Partial<Pick<OtaRecord, "rolloutPercent" | "paused">>): Promise<void>;
}

/** Content-addressed file storage for update assets. */
export interface AssetStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  has(key: string): Promise<boolean>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
}
