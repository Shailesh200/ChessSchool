import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootApiTestEnv, bearer, type TestDb } from "@/lib/test-db.harness";

const PW = "testpass123";

describe("POST /api/qa/expire-session", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let route: typeof import("@/app/api/qa/expire-session/route");
  let auth: typeof import("@/lib/auth");
  let a1: string;
  let a2: string;
  let b1: string;
  let aId: string;
  let bId: string;

  const post = (
    headers: Record<string, string> = {},
    url = "http://test/api/qa/expire-session",
  ) => route.POST(new Request(url, { method: "POST", headers }));

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown, db } = await bootApiTestEnv());
    route = await import("@/app/api/qa/expire-session/route");
    auth = await import("@/lib/auth");
    const a = await auth.registerWithToken("qa-a@test.dev", PW, "A");
    const b = await auth.registerWithToken("qa-b@test.dev", PW, "B");
    if ("error" in a || "error" in b) throw new Error("setup");
    a1 = a.token;
    b1 = b.token;
    aId = a.user.id;
    bId = b.user.id;
    a2 = await auth.createSessionToken(aId); // A's second device
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    teardown();
    vi.resetModules();
  });

  const sessionsOf = async (userId: string) =>
    (await db.select().from((await import("@/db/schema")).sessions)).filter(
      (s) => s.userId === userId,
    );

  describe("route does not exist (404, nothing revoked)", () => {
    const expect404 = async () => {
      const res = await post(bearer(a1));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
      for (const m of [route.GET, route.PUT, route.PATCH, route.DELETE]) {
        expect((await m()).status).toBe(404);
      }
      expect(await auth.getUserByToken(a1)).not.toBeNull();
      expect(await auth.getUserByToken(a2)).not.toBeNull();
      expect(await auth.getUserByToken(b1)).not.toBeNull();
    };

    it("with QA_SIM unset", async () => {
      vi.stubEnv("QA_SIM", "");
      await expect404();
    });

    it("with QA_SIM=0", async () => {
      vi.stubEnv("QA_SIM", "0");
      await expect404();
    });

    it("in a production config (QA_SIM=1, NODE_ENV=production, Vercel production)", async () => {
      vi.stubEnv("QA_SIM", "1");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("VERCEL_ENV", "production");
      await expect404();
    });

    it("on a Vercel preview with QA_SIM=1", async () => {
      vi.stubEnv("QA_SIM", "1");
      vi.stubEnv("VERCEL_ENV", "preview");
      await expect404();
    });

    it("with QA_SIM=1 and the production Turso database", async () => {
      vi.stubEnv("QA_SIM", "1");
      vi.stubEnv(
        "DATABASE_URL",
        "libsql://chessschool-shailesh200.aws-ap-south-1.turso.io",
      );
      vi.stubEnv("DATABASE_AUTH_TOKEN", "token");
      await expect404();
    });
  });

  describe("one condition at a time: from a fully enabled env, flipping exactly one check turns the route off", () => {
    const ENABLED = {
      QA_SIM: "1",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_AUTH_TOKEN: "",
      DATABASE_URL: "file:/tmp/qa-sim.db",
    };
    let savedTurso: Record<string, string | undefined> = {};
    const enable = () => {
      savedTurso = {};
      for (const k of Object.keys(process.env).filter((k) => k.startsWith("TURSO_"))) {
        savedTurso[k] = process.env[k];
        delete process.env[k];
      }
      vi.stubEnv("NODE_ENV", "production"); // `next start`
      for (const [k, v] of Object.entries(ENABLED)) vi.stubEnv(k, v);
    };
    afterEach(() => {
      for (const k of Object.keys(process.env).filter((k) => k.startsWith("TURSO_")))
        delete process.env[k];
      for (const [k, v] of Object.entries(savedTurso))
        if (v !== undefined) process.env[k] = v;
    });

    it("control: the fully enabled env serves the route (so each flip below is the only difference)", async () => {
      enable();
      const res = await post(bearer(a1));
      expect(res.status).toBe(200);
    });

    const flips: [string, () => void][] = [
      ["QA_SIM unset", () => vi.stubEnv("QA_SIM", "")],
      ["QA_SIM=0", () => vi.stubEnv("QA_SIM", "0")],
      ["QA_SIM=true (anything but 1)", () => vi.stubEnv("QA_SIM", "true")],
      ["VERCEL set", () => vi.stubEnv("VERCEL", "1")],
      ["VERCEL_ENV=production set", () => vi.stubEnv("VERCEL_ENV", "production")],
      ["VERCEL_ENV=preview set", () => vi.stubEnv("VERCEL_ENV", "preview")],
      ["DATABASE_AUTH_TOKEN set", () => vi.stubEnv("DATABASE_AUTH_TOKEN", "token")],
      ["a TURSO_* variable set", () => void (process.env.TURSO_DATABASE_URL = "x")],
      [
        "a TURSO_* variable set, even empty",
        () => void (process.env.TURSO_AUTH_TOKEN = ""),
      ],
      [
        "DATABASE_URL is a libsql URL",
        () => vi.stubEnv("DATABASE_URL", "libsql://db.turso.io"),
      ],
      [
        "DATABASE_URL is a bare path (the container image)",
        () => vi.stubEnv("DATABASE_URL", "/app/data/local.db"),
      ],
      ["DATABASE_URL unset", () => void delete process.env.DATABASE_URL],
    ];
    it.each(flips)(
      "404 and nothing revoked when only this is flipped: %s",
      async (_name, flip) => {
        enable();
        flip();
        const res = await post(bearer(a1));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe("");
        expect((await route.GET()).status).toBe(404);
        expect(await auth.getUserByToken(a1)).not.toBeNull();
        expect(await auth.getUserByToken(a2)).not.toBeNull();
        expect(await sessionsOf(aId)).toHaveLength(2);
      },
    );
  });

  describe("QA_SIM=1 on a file database (the qa-sim runner)", () => {
    beforeEach(() => {
      vi.stubEnv("QA_SIM", "1");
      vi.stubEnv("NODE_ENV", "production"); // `next start` forces this
    });

    it("answers 401 without a valid Bearer token and revokes nothing", async () => {
      expect((await post()).status).toBe(401);
      expect((await post(bearer("not-a-token"))).status).toBe(401);
      expect((await post({ cookie: "chessschool_session=" + a1 })).status).toBe(401);
      expect(await sessionsOf(aId)).toHaveLength(2);
    });

    it("answers 401 to a valid token that is not a Bearer credential and revokes nothing", async () => {
      expect((await post({ authorization: a1 })).status).toBe(401); // raw token, no scheme
      expect((await post({ authorization: `Basic ${a1}` })).status).toBe(401);
      expect((await post({ authorization: `Token ${a1}` })).status).toBe(401);
      expect((await post({ authorization: "Basic x" })).status).toBe(401);
      expect(await sessionsOf(aId)).toHaveLength(2);
      expect(await auth.getUserByToken(a1)).not.toBeNull();
    });

    it("revokes all of the caller's sessions and only the caller's", async () => {
      const res = await post(bearer(a1));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, revoked: 2 });
      expect(await auth.getUserByToken(a1)).toBeNull();
      expect(await auth.getUserByToken(a2)).toBeNull();
      expect(await auth.getUserByToken(b1)).not.toBeNull();
      expect(await sessionsOf(aId)).toHaveLength(0);
      expect(await sessionsOf(bId)).toHaveLength(1);
    });

    it("keeps the account: A can sign in again with the password", async () => {
      await post(bearer(a1));
      const login = await auth.loginWithToken("qa-a@test.dev", PW);
      expect("token" in login).toBe(true);
      if ("token" in login) expect(login.user.id).toBe(aId);
    });

    it("takes no user id: a body or query user id is ignored", async () => {
      const res = await route.POST(
        new Request(`http://test/api/qa/expire-session?userId=${bId}&user=${bId}`, {
          method: "POST",
          headers: { ...bearer(a1), "content-type": "application/json" },
          body: JSON.stringify({ userId: bId, id: bId }),
        }),
      );
      expect(res.status).toBe(200);
      expect(await auth.getUserByToken(b1)).not.toBeNull();
      expect(await sessionsOf(bId)).toHaveLength(1);
      expect(await sessionsOf(aId)).toHaveLength(0);
    });

    it("answers 405 to other methods", async () => {
      expect((await route.GET()).status).toBe(405);
    });

    it("a second call from a revoked token is 401", async () => {
      await post(bearer(a1));
      expect((await post(bearer(a1))).status).toBe(401);
    });
  });
});
