import { copy, rankEmblem, type RankId } from "@chessschool/design";
import { useMemo } from "react";
import { SvgXml } from "react-native-svg";

/** The rank's still emblem (wood Pawn … diamond King). Under 64px the name banner is dropped. */
export function RankEmblem({ rank, size }: { rank: RankId; size: number }) {
  const small = size < 64;
  const xml = useMemo(() => rankEmblem(rank, copy.ranks[rank], { small }), [rank, small]);
  return <SvgXml xml={xml} width={size} height={size * (252 / 272)} accessibilityLabel={copy.ranks[rank]} />;
}
