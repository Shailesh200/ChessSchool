import { test, expect } from "@playwright/test";

const pw = "testpass123";

async function register(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  name: string,
) {
  const res = await request.post("/api/auth/register", {
    data: { email, password: pw, name },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { token: string };
  return body.token;
}

test("online PvP: unauthenticated create returns 401", async ({ request }) => {
  const res = await request.post("/api/session");
  expect(res.status()).toBe(401);
});

test("online PvP: seat tokens are user-bound — cannot move opponent seat", async ({
  request,
}) => {
  const stamp = Date.now();
  const whiteToken = await register(request, `pvp-white-${stamp}@test.dev`, "White");
  const blackToken = await register(request, `pvp-black-${stamp}@test.dev`, "Black");

  const create = await request.post("/api/session", {
    headers: { Authorization: `Bearer ${whiteToken}` },
  });
  expect(create.ok()).toBeTruthy();
  const { id, seatToken: whiteSeat } = (await create.json()) as {
    id: string;
    seatToken: string;
  };

  const join = await request.get(`/api/session/${id}?join=1`, {
    headers: { Authorization: `Bearer ${blackToken}` },
  });
  expect(join.ok()).toBeTruthy();
  const joined = (await join.json()) as { claimed: boolean; seatToken: string };
  expect(joined.claimed).toBe(true);

  // Black tries to move using White's stolen seat token — must fail.
  const hijack = await request.post(`/api/session/${id}`, {
    headers: { Authorization: `Bearer ${blackToken}` },
    data: {
      action: "move",
      color: "w",
      seatToken: whiteSeat,
      from: "e2",
      to: "e4",
    },
  });
  expect(hijack.status()).toBe(403);

  // White opens; then Black's legal move with own token succeeds.
  const whiteOpen = await request.post(`/api/session/${id}`, {
    headers: { Authorization: `Bearer ${whiteToken}` },
    data: {
      action: "move",
      color: "w",
      seatToken: whiteSeat,
      from: "e2",
      to: "e4",
    },
  });
  expect(whiteOpen.ok()).toBeTruthy();

  const legal = await request.post(`/api/session/${id}`, {
    headers: { Authorization: `Bearer ${blackToken}` },
    data: {
      action: "move",
      color: "b",
      seatToken: joined.seatToken,
      from: "e7",
      to: "e5",
    },
  });
  expect(legal.ok()).toBeTruthy();
  const after = (await legal.json()) as { fen: string; turn: string };
  expect(after.turn).toBe("w");
});
