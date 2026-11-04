import type { BotId, PieceType } from "@chessschool/chess";
import { View } from "react-native";
import { useTheme } from "@/lib/theme";
import { PieceArt } from "./Board";
import { Cody } from "./Lottie";

const PIECE: Record<BotId, PieceType | null> = { pip: "p", cody: null, rooky: "r", bishop: "b", ivy: "q", atlas: "k" };

/** Each bot is a Toy piece; Cody is Cody. */
export function BotAvatar({ bot, size = 44 }: { bot: BotId; size?: number }) {
  const { c } = useTheme();
  const tint: Record<BotId, string> = { pip: c.successSoft, cody: c.brandSoft, rooky: c.dangerSoft, bishop: c.goldSoft, ivy: c.brandSoft, atlas: c.dangerSoft };
  const piece = PIECE[bot];
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: tint[bot], alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {piece ? <PieceArt piece={{ type: piece, color: "b" }} size={size * 0.82} set="toy" /> : <Cody animation="idle" size={size} />}
    </View>
  );
}
