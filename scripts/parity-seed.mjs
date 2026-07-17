#!/usr/bin/env node
/**
 * Upsert the parity fixture account on a running ChessSchool web API.
 * Usage: PARITY_BASE_URL=http://localhost:3210 node scripts/parity-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(__dirname, "parity-routes.json");
const { accounts } = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const ENV = process.env.PARITY_ENV === "prod" ? "prod" : "local";
const account = accounts[ENV];
const BASE = (process.env.PARITY_BASE_URL || "http://localhost:3210").replace(/\/$/, "");

async function post(pathname, body, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log(`→ Parity seed (${ENV}) @ ${BASE}`);
  console.log(`  account: ${account.email}`);

  const reg = await post("/api/auth/register", {
    email: account.email,
    password: account.password,
    name: account.name,
  });
  if (reg.ok) {
    console.log("✓ Registered parity user");
  } else if (reg.status === 409 || /already|exists/i.test(JSON.stringify(reg.json))) {
    console.log("→ User exists, logging in");
  } else {
    console.warn("→ Register response:", reg.status, reg.json);
  }

  const login = await post("/api/auth/login", {
    email: account.email,
    password: account.password,
  });
  if (!login.ok || !login.json?.token) {
    console.error("✗ Could not log in parity user:", login.status, login.json);
    process.exit(1);
  }
  const token = login.json.token;
  console.log("✓ Logged in parity user");

  const onboard = await post("/api/profile/onboarding", { goal: "compete", avatar: "pawn" }, token);
  if (onboard.ok) {
    console.log("✓ Parity user onboarded");
  }

  const progress = await fetch(`${BASE}/api/progress`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!progress.ok) {
    console.warn("→ Progress fetch failed (non-fatal):", progress.status);
    return;
  }
  console.log("✓ Progress endpoint reachable for parity user");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
