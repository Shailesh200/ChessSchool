import { copy, language, type ShareCardData, type ShareCardKind } from "@chessschool/design";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";
import { api } from "./api";

export const INVITE_KEY = "chessschool.v2.invite";
const seatKey = (code: string) => `chessschool.v2.seat.${code}`;
/** The friend's seat in a challenge game (this token is their key; no account needed). */
export const seat = {
  get: (code: string) => AsyncStorage.getItem(seatKey(code)).catch(() => null),
  set: (code: string, value: string) => AsyncStorage.setItem(seatKey(code), value).catch(() => {}),
};

/** Opens the share sheet with a line of text and a link. True when the learner shared it. */
export async function shareLink(text: string, url: string): Promise<boolean> {
  try {
    // iOS shows `message` and `url` both, so the link would appear twice; Android only reads `message`.
    const r = await Share.share(Platform.OS === "ios" ? { message: text, url } : { message: `${text}\n${url}` });
    return r.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

/**
 * Makes a share card and opens the share sheet with its link (chess-school.in/s/<id> shows the card).
 * A child profile's card never carries a name (the server enforces it; `child` says whose card it is).
 * shortcut: shares the card's link, not the PNG file; attaching the image needs expo-sharing and expo-file-system in a store build.
 */
export async function shareCard(kind: ShareCardKind, data: ShareCardData, who: { child?: string | null; avatar?: string; showName?: boolean } = {}): Promise<boolean> {
  const link = await api.createShare({ kind, data, lang: language(), ...who });
  return shareLink(copy.share.text, link.url);
}
