import { copy, language, type ShareCardData, type ShareCardKind } from "@chessschool/design";
import { api } from "./api";

export const INVITE_KEY = "chessschool.v2.invite";
const seatKey = (code: string) => `chessschool.v2.seat.${code}`;
/** The friend's seat in a challenge game (they have no account; this token is their key). */
export const seat = {
  get: (code: string) => {
    try {
      return localStorage.getItem(seatKey(code));
    } catch {
      return null;
    }
  },
  set: (code: string, value: string) => {
    try {
      localStorage.setItem(seatKey(code), value);
    } catch {}
  },
};

/** A link (and a line of text) to the share sheet when there is one, else to the clipboard. Returns "copied" when it was copied. */
export async function shareLink(text: string, url: string): Promise<"shared" | "copied" | "none"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text, url });
      return "shared";
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return "none";
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "none";
  }
}

/**
 * Makes a share card and hands the PNG to the share sheet; browsers that cannot share files download it.
 * A child profile's card never carries a name (the server enforces it; `child` says whose card it is).
 */
export async function shareCard(kind: ShareCardKind, data: ShareCardData, who: { child?: string | null; avatar?: string; showName?: boolean } = {}): Promise<"shared" | "saved" | "none"> {
  const link = await api.createShare({ kind, data, lang: language(), ...who });
  const res = await fetch(link.image);
  if (!res.ok) throw new Error("card");
  const blob = await res.blob();
  const file = new File([blob], "chessschool-card.png", { type: "image/png" });
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${copy.share.text} ${link.url}` });
      return "shared";
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return "none";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "saved";
}

/** Puts text on the clipboard. True when it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Saves text as a file (a PGN download). */
export function downloadText(name: string, text: string, type = "application/x-chess-pgn") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
