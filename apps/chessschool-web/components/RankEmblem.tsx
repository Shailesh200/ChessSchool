import { copy, rankEmblem, type RankId } from "@chessschool/design";

/** The rank's still emblem (wood Pawn … diamond King). Under 64px the name banner is dropped. */
export function RankEmblem({ rank, size }: { rank: RankId; size: number }) {
  const small = size < 64;
  return <span className="rank-emblem" role="img" aria-label={copy.ranks[rank]} style={{ width: size, height: size * (252 / 272) }} dangerouslySetInnerHTML={{ __html: rankEmblem(rank, copy.ranks[rank], { small }) }} />;
}
