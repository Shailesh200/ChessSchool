import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { journalListOwner, journalReadGeneration } from "./journalList";

describe("journal list owner", () => {
  it("waits for persisted auth and fails if the journal page reads before that", () => {
    expect(journalListOwner(false, true, "user-a")).toBeNull();
    expect(journalListOwner(true, null, null)).toBeNull();
    expect(journalListOwner(true, true, "user-a")).toBe("user-a");
    expect(journalListOwner(true, false, null)).toBe("guest");

    const page = readFileSync(path.resolve(__dirname, "../../app/journal/page.tsx"), "utf8");
    expect(page).toContain("journalListOwner");
    expect(page).toContain("useRehydrateReady");
    expect(page).toContain("journalReadGeneration");
    expect(page).toContain("chessschool-journal");
    expect(page).not.toContain("listJournal().then(setEntries)");
  });

  it("drops an older empty read once a newer read has started", () => {
    const generation = journalReadGeneration();
    const first = generation.start();
    const second = generation.start();
    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
  });
});
