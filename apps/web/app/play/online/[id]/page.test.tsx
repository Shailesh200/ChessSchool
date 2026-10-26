import { Suspense, act } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnlineSessionPage from "./page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/features/board/ChessBoard", () => ({
  ChessBoard: () => <div data-testid="online-board" />,
}));

vi.mock("@/core/hooks/useSquareSize", () => ({
  useSquareSize: () => [{ current: null }, 320],
}));

vi.mock("@/core/analytics/track", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/pulse", () => ({
  pulseTrack: vi.fn(),
}));

const GAME_ID = "game-1";

/** Already-fulfilled params so `use(params)` does not suspend the test render. */
function resolvedParams(id: string) {
  const params = Promise.resolve({ id }) as Promise<{ id: string }> & {
    status: "fulfilled";
    value: { id: string };
  };
  params.status = "fulfilled";
  params.value = { id };
  return params;
}

const sessionState = {
  id: GAME_ID,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  turn: "w" as const,
  status: "active" as const,
  result: null,
  blackJoined: 1,
  pgn: "",
  lastFrom: null,
  lastTo: null,
  timeControlMin: 10,
  whiteMs: 600_000,
  blackMs: 600_000,
  createdAt: 1,
  updatedAt: 1,
  claimed: true,
  seatToken: "b.seat-token",
};

let joinFetches = 0;

function renderPage(id: string) {
  return render(
    <Suspense fallback={null}>
      <OnlineSessionPage params={resolvedParams(id)} />
    </Suspense>,
  );
}

describe("online join effect", () => {
  beforeEach(() => {
    joinFetches = 0;
    push.mockClear();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("ably-token")) {
          return new Response(null, { status: 503 });
        }
        if (url.includes("join=1")) joinFetches += 1;
        return Response.json(sessionState);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fetches the join endpoint once when the page re-renders", async () => {
    const params = resolvedParams(GAME_ID);
    const view = render(
      <Suspense fallback={null}>
        <OnlineSessionPage params={params} />
      </Suspense>,
    );

    await waitFor(() => {
      expect(screen.getByText("You are Black")).toBeInTheDocument();
    });
    expect(joinFetches).toBe(1);

    // Drop the stored seat so a second effect run would have to fetch again.
    // Clock ticks and a fresh router object both re-render the page. The join
    // effect is keyed on the game id, so neither may claim the seat again.
    localStorage.clear();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    view.rerender(
      <Suspense fallback={null}>
        <OnlineSessionPage params={params} />
      </Suspense>,
    );

    expect(joinFetches).toBe(1);
    expect(screen.getByText("You are Black")).toBeInTheDocument();
  });

  it("joins again only when the game id changes", async () => {
    const view = renderPage("game-a");
    await waitFor(() => expect(joinFetches).toBe(1));
    localStorage.clear();

    view.rerender(
      <Suspense fallback={null}>
        <OnlineSessionPage params={resolvedParams("game-a")} />
      </Suspense>,
    );
    expect(joinFetches).toBe(1);

    view.rerender(
      <Suspense fallback={null}>
        <OnlineSessionPage params={resolvedParams("game-b")} />
      </Suspense>,
    );
    await waitFor(() => expect(joinFetches).toBe(2));
  });
});
