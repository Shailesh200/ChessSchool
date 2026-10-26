import { describe, expect, it } from "vitest";
import { resolveDbTarget } from "./drizzle-baseline.mjs";
import { main, remoteMigrationDecision, yesRemoteHost } from "./migrate.mjs";

const PROD = "chessschool-shailesh200.aws-ap-south-1.turso.io";

describe("resolveDbTarget", () => {
  it("treats an unset URL and file paths as local", () => {
    expect(resolveDbTarget({}).kind).toBe("local");
    expect(resolveDbTarget({ DATABASE_URL: "file:/tmp/chess.db" }).kind).toBe("local");
    expect(resolveDbTarget({ DATABASE_URL: "local.db" }).kind).toBe("local");
  });

  it("allows only the exact local hosts", () => {
    expect(resolveDbTarget({ DATABASE_URL: "libsql://localhost" }).kind).toBe("local");
    expect(resolveDbTarget({ DATABASE_URL: "libsql://127.0.0.1:8080" }).kind).toBe(
      "local",
    );
    expect(resolveDbTarget({ DATABASE_URL: "http://LOCALHOST/db" }).kind).toBe("local");
  });

  it("does not treat spoofed or dotted hosts as local", () => {
    const refused = [
      "libsql://localhost\\@evil.com",
      "http://localhost\\@evil.com",
      "libsql://user:pass@localhost",
      "libsql://localhost.:8080",
      "http://LOCALHOST./db",
      "http://127.0.0.1.:8080",
    ];
    for (const url of refused) {
      const target = resolveDbTarget({ DATABASE_URL: url });
      expect(target.kind, url).not.toBe("local");
    }
  });

  it("strips trailing dots only for the production host match", () => {
    const dotted = resolveDbTarget({ DATABASE_URL: `libsql://${PROD}.` });
    expect(dotted.kind).toBe("remote");
    expect(dotted.host).toBe(`${PROD}.`);

    const fileUrl = resolveDbTarget({
      DATABASE_URL: `file://${PROD}./tmp/db`,
    });
    expect(fileUrl.kind).not.toBe("local");
  });

  it("does not expose a confirmable host for userinfo or backslash URLs", () => {
    expect(
      resolveDbTarget({ DATABASE_URL: "libsql://user:pass@localhost" }).host,
    ).toBeNull();
    expect(
      resolveDbTarget({ DATABASE_URL: "libsql://localhost\\@evil.com" }).host,
    ).toBeNull();
    expect(
      resolveDbTarget({ DATABASE_URL: "libsql://localhost\\@evil.com" }).url,
    ).toBeNull();
  });
});

describe("remoteMigrationDecision", () => {
  const remote = { kind: "remote", host: "evil.example" };
  const unsafe = { kind: "remote", host: null };

  it("reads --yes-remote=<host> and treats a bare flag as empty", () => {
    expect(yesRemoteHost(["--yes-remote=evil.example"])).toBe("evil.example");
    expect(yesRemoteHost(["--yes-remote"])).toBe("");
    expect(yesRemoteHost([])).toBeNull();
  });

  it("connects to a local target without a flag", () => {
    expect(
      remoteMigrationDecision({
        target: { kind: "local", host: null },
        argv: [],
        isTTY: false,
      }).connect,
    ).toBe(true);
  });

  it("requires an exact host match", () => {
    expect(
      remoteMigrationDecision({
        target: remote,
        argv: ["--yes-remote=evil.example"],
        isTTY: false,
      }).connect,
    ).toBe(true);
    expect(
      remoteMigrationDecision({
        target: remote,
        argv: ["--yes-remote=EVIL.example"],
        isTTY: false,
      }).connect,
    ).toBe(false);
    expect(
      remoteMigrationDecision({
        target: remote,
        argv: ["--yes-remote=libsql://evil.example"],
        isTTY: false,
      }).connect,
    ).toBe(false);
    expect(
      remoteMigrationDecision({
        target: remote,
        argv: [],
        isTTY: true,
        typedHost: "evil.example",
      }).connect,
    ).toBe(true);
    expect(
      remoteMigrationDecision({
        target: remote,
        argv: [],
        isTTY: true,
        typedHost: "other.example",
      }).connect,
    ).toBe(false);
    expect(
      remoteMigrationDecision({ target: remote, argv: [], isTTY: false }).connect,
    ).toBe(false);
    expect(
      remoteMigrationDecision({
        target: unsafe,
        argv: ["--yes-remote=localhost"],
        isTTY: false,
      }).connect,
    ).toBe(false);
  });
});

describe("db:migrate confirmation", () => {
  function harness(
    env: Record<string, string | undefined>,
    argv: string[],
    isTTY = false,
  ) {
    let opened = false;
    let migrated = false;
    let asked = false;
    return {
      opened: () => opened,
      migrated: () => migrated,
      asked: () => asked,
      run: (typed = "evil.example") =>
        main({
          argv,
          env,
          isTTY,
          ask: async () => {
            asked = true;
            return typed;
          },
          open: () => {
            opened = true;
            return {
              execute: async () => ({ rows: [] }),
              close() {},
            };
          },
          migrate: () => {
            migrated = true;
            return 0;
          },
        }),
    };
  }

  it("exits 1 without connecting when a remote URL is not confirmed", async () => {
    const run = harness({ DATABASE_URL: "libsql://evil.example" }, []);
    expect(await run.run()).toBe(1);
    expect(run.opened()).toBe(false);
    expect(run.migrated()).toBe(false);
    expect(run.asked()).toBe(false);
  });

  it("does not connect when --yes-remote does not match the host", async () => {
    const run = harness({ DATABASE_URL: "libsql://evil.example" }, [
      "--yes-remote=localhost",
    ]);
    expect(await run.run()).toBe(1);
    expect(run.opened()).toBe(false);
  });

  it("does not treat a spoofed localhost URL as confirmed by --yes-remote=localhost", async () => {
    const run = harness({ DATABASE_URL: "libsql://localhost\\@evil.com" }, [
      "--yes-remote=localhost",
    ]);
    expect(await run.run()).toBe(1);
    expect(run.opened()).toBe(false);
    expect(run.migrated()).toBe(false);
  });

  it("connects only after --yes-remote matches the host", async () => {
    const run = harness(
      { DATABASE_URL: "libsql://evil.example", DATABASE_AUTH_TOKEN: "token" },
      ["--yes-remote=evil.example"],
    );
    expect(await run.run()).toBe(0);
    expect(run.opened()).toBe(true);
    expect(run.migrated()).toBe(true);
  });

  it("connects after the prompt returns the exact host", async () => {
    const run = harness(
      { DATABASE_URL: "https://evil.example/db", DATABASE_AUTH_TOKEN: "token" },
      [],
      true,
    );
    expect(await run.run("evil.example")).toBe(0);
    expect(run.asked()).toBe(true);
    expect(run.opened()).toBe(true);
  });

  it("does not connect when the prompt returns a different host", async () => {
    const run = harness({ DATABASE_URL: "libsql://evil.example" }, [], true);
    expect(await run.run("other.example")).toBe(1);
    expect(run.asked()).toBe(true);
    expect(run.opened()).toBe(false);
  });
});
