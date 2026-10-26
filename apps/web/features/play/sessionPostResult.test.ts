import { describe, expect, it, vi } from "vitest";
import { consumeSessionPost, postedSessionRow } from "./sessionPostResult";

const serverRow = {
  fen: "server-fen",
  turn: "b" as const,
  status: "active" as const,
  result: null,
  pgn: "1. e4",
  error: "conflict",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("postedSessionRow", () => {
  it("keeps a 409 session row and drops the error flag", () => {
    const row = postedSessionRow(409, serverRow);
    expect(row).toMatchObject({ fen: "server-fen", turn: "b", pgn: "1. e4" });
    expect(row).not.toHaveProperty("error");
  });

  it("ignores a 409 that is only an error string", () => {
    expect(postedSessionRow(409, { error: "not your turn" })).toBeNull();
    expect(postedSessionRow(409, { error: "clock still running" })).toBeNull();
  });

  it("ignores rejected posts that are not a conflict", () => {
    expect(postedSessionRow(400, { error: "illegal move" })).toBeNull();
    expect(postedSessionRow(403, { error: "invalid seat" })).toBeNull();
  });
});

describe("consumeSessionPost", () => {
  it("drops the optimistic move and applies the 409 row", async () => {
    const order: string[] = [];
    const refetch = vi.fn();
    await consumeSessionPost(jsonResponse(serverRow, 409), {
      dropOptimistic: () => order.push("drop"),
      apply: (row: Posted) => {
        order.push("apply");
        expect(row.fen).toBe("server-fen");
        expect(row).not.toHaveProperty("error");
      },
      refetch,
    });
    expect(order).toEqual(["drop", "apply"]);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches when a 409 has no session row", async () => {
    const apply = vi.fn();
    const dropOptimistic = vi.fn();
    const refetch = vi.fn(async () =>
      jsonResponse(
        { fen: "fresh-fen", turn: "w", status: "active", result: null },
        200,
      ),
    );
    await consumeSessionPost(jsonResponse({ error: "not your turn" }, 409), {
      apply,
      dropOptimistic,
      refetch,
    });
    expect(dropOptimistic).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ fen: "fresh-fen" }));
  });

  it("drops the optimistic move on a non-conflict rejection", async () => {
    const apply = vi.fn();
    const refetch = vi.fn();
    const dropOptimistic = vi.fn();
    await consumeSessionPost(jsonResponse({ error: "illegal move" }, 400), {
      apply,
      dropOptimistic,
      refetch,
    });
    expect(dropOptimistic).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("applies a successful post after dropping the optimistic move", async () => {
    const order: string[] = [];
    await consumeSessionPost(
      jsonResponse({ fen: "after-e4", turn: "b", status: "active" }, 200),
      {
        dropOptimistic: () => order.push("drop"),
        apply: () => order.push("apply"),
        refetch: vi.fn(),
      },
    );
    expect(order).toEqual(["drop", "apply"]);
  });
});

type Posted = { fen: string; error?: string };
