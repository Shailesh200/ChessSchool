/** Tiny FEN preview using the shipped cburnett piece SVGs. */
export function MiniBoard({ fen, className }: { fen: string; className?: string }) {
  const board = fen.split(" ")[0] ?? "";
  const squares: { piece: string | null; light: boolean }[] = [];
  let file = 0;
  let rank = 0;
  for (const ch of board) {
    if (ch === "/") {
      rank += 1;
      file = 0;
      continue;
    }
    if (ch >= "1" && ch <= "8") {
      const n = Number(ch);
      for (let i = 0; i < n; i += 1) {
        squares.push({ piece: null, light: (file + rank) % 2 === 0 });
        file += 1;
      }
      continue;
    }
    const color = ch === ch.toUpperCase() ? "w" : "b";
    const piece = `${color}${ch.toUpperCase()}`;
    squares.push({ piece, light: (file + rank) % 2 === 0 });
    file += 1;
  }

  return (
    <span
      className={className ? `mini-board ${className}` : "mini-board"}
      aria-hidden="true"
    >
      {squares.slice(0, 64).map((sq, i) => (
        <i key={i} className={sq.light ? "l" : "d"}>
          {sq.piece ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/pieces/cburnett/${sq.piece}.svg`} alt="" />
          ) : null}
        </i>
      ))}
    </span>
  );
}
