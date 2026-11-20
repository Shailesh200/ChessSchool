import { describe, expect, it } from "vitest";
import { checkDetails, cleanHandle, emptyDetails, hasContact, isRude, nameProblem, providerName, socialUrl } from "./social";

describe("display names", () => {
  it("accepts ordinary names in English and Hindi", () => {
    for (const n of ["Asha Rao", "Kabir", "Ravi Shitole", "Ashita", "Dickens", "Claude", "O'Brien", "Anne-Marie", "J. R. Rao", "आरव शर्मा", "Riya 2012", "Badminton Ben"]) expect(nameProblem(n), n).toBeNull();
  });

  it("refuses empty, long, odd characters, links and phone numbers", () => {
    expect(nameProblem("   ")).toBe("empty");
    expect(nameProblem("a".repeat(41))).toBe("long");
    expect(nameProblem("<script>")).toBe("chars");
    expect(nameProblem("1234")).toBe("chars");
    expect(nameProblem("riya.com")).toBe("link");
    expect(nameProblem("@riya")).toBe("link");
    expect(nameProblem("www.win")).toBe("link");
    expect(nameProblem("Call 98765 43210")).toBe("link");
  });

  it("refuses rude words, also disguised, in English, Hinglish and Hindi", () => {
    for (const n of ["fuck", "Fuuuck you", "f u c k", "sh1t", "Big Dick", "chutiya", "Bhenchod Raj", "madar chod", "चूतिया", "Randi"]) expect(nameProblem(n), n).toBe("rude");
    expect(isRude("I love chess")).toBe(false);
  });

  it("keeps team names for staff accounts", () => {
    for (const n of ["Admin", "ChessSchool", "Chess School Team", "Chaukor", "chaukor fan", "Support", "Moderator Mike"]) expect(nameProblem(n), n).toBe("reserved");
    expect(nameProblem("Admin", { staff: true })).toBeNull();
  });

  it("drops a provider name that fails instead of failing sign-in", () => {
    expect(providerName("  Asha   Rao ")).toBe("Asha Rao");
    expect(providerName("ChessSchool Official")).toBe("");
  });
});

describe("social handles", () => {
  it("reduces @names and pasted links to the bare handle", () => {
    expect(cleanHandle("instagram", "@riya.plays")).toBe("riya.plays");
    expect(cleanHandle("instagram", "https://www.instagram.com/riya_plays/?hl=en")).toBe("riya_plays");
    expect(cleanHandle("lichess", "lichess.org/@/DrNykterstein")).toBe("DrNykterstein");
    expect(cleanHandle("chesscom", "https://www.chess.com/member/hikaru")).toBe("hikaru");
    expect(cleanHandle("youtube", "youtube.com/@GothamChess")).toBe("GothamChess");
    expect(cleanHandle("x", "twitter.com/riya")).toBe("riya");
    expect(cleanHandle("x", "")).toBe("");
  });

  it("refuses other sites and invalid handles", () => {
    expect(cleanHandle("instagram", "https://evil.example/riya")).toBeNull();
    expect(cleanHandle("x", "this_is_far_too_long_for_x")).toBeNull();
    expect(cleanHandle("facebook", "abc")).toBeNull();
    expect(cleanHandle("lichess", "a b")).toBeNull();
  });

  it("builds profile links", () => {
    expect(socialUrl("lichess", "riya")).toBe("https://lichess.org/@/riya");
    expect(socialUrl("youtube", "riya")).toBe("https://www.youtube.com/@riya");
  });
});

describe("profile details", () => {
  const base = emptyDetails();
  it("tidies and keeps valid details, and drops unknown fields", () => {
    const r = checkDetails({ bio: "  Love  endgames ", favPiece: "knight", playingSince: 2020, banner: "gold", socials: { lichess: "@riya" }, admin: true }, base, 2026);
    expect(r).toEqual({ details: { ...base, bio: "Love endgames", favPiece: "knight", playingSince: 2020, banner: "gold", socials: { lichess: "riya" } } });
  });

  it("names the first bad field", () => {
    expect(checkDetails({ bio: "x".repeat(161) }, base, 2026)).toEqual({ problem: { field: "bio", reason: "long" } });
    expect(checkDetails({ bio: "add me at riya.com" }, base, 2026)).toEqual({ problem: { field: "bio", reason: "link" } });
    expect(checkDetails({ goal: "beat that bsdk" }, base, 2026)).toEqual({ problem: { field: "goal", reason: "rude" } });
    expect(checkDetails({ favPiece: "dragon" }, base, 2026)).toEqual({ problem: { field: "favPiece", reason: "invalid" } });
    expect(checkDetails({ playingSince: 2030 }, base, 2026)).toEqual({ problem: { field: "playingSince", reason: "invalid" } });
    expect(checkDetails({ socials: { x: "https://x.com/not-valid!" } }, base, 2026)).toEqual({ problem: { field: "socials.x", reason: "invalid" } });
  });

  it("clears a handle with an empty value", () => {
    const r = checkDetails({ socials: { x: "" } }, { ...base, socials: { x: "riya", lichess: "riya" } }, 2026);
    expect(r).toEqual({ details: { ...base, socials: { lichess: "riya" } } });
  });

  it("spots contact details in free text", () => {
    expect(hasContact("whatsapp 98765-43210")).toBe(true);
    expect(hasContact("I started in 2019")).toBe(false);
  });
});
