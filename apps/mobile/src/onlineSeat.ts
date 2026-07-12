import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "chessschool.onlineSeats";
const isWeb = Platform.OS === "web";

type SeatRecord = { color: "w" | "b"; seatToken: string; savedAt: number };
type SeatMap = Record<string, SeatRecord>;

async function readMap(): Promise<SeatMap> {
  try {
    const raw = isWeb
      ? typeof localStorage !== "undefined"
        ? localStorage.getItem(KEY)
        : null
      : await SecureStore.getItemAsync(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SeatMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeMap(map: SeatMap): Promise<void> {
  const raw = JSON.stringify(map);
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

/** Persist seat credentials so reload doesn't lose online game access. */
export async function saveOnlineSeat(
  gameId: string,
  color: "w" | "b",
  seatToken: string,
): Promise<void> {
  if (!gameId || !seatToken) return;
  const map = await readMap();
  map[gameId.toLowerCase()] = { color, seatToken, savedAt: Date.now() };
  await writeMap(map);
}

export async function loadOnlineSeat(
  gameId: string,
): Promise<{ color: "w" | "b"; seatToken: string } | null> {
  const map = await readMap();
  const row = map[gameId.toLowerCase()];
  if (!row?.seatToken) return null;
  return { color: row.color, seatToken: row.seatToken };
}

export async function clearOnlineSeat(gameId: string): Promise<void> {
  const map = await readMap();
  delete map[gameId.toLowerCase()];
  await writeMap(map);
}
