/** Pentagon radar of the five skill areas (#dashboard). Pure SVG, no deps. */
export function SkillRadar({ data }: { data: { area: string; mastery: number }[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const R = 78;
  const n = data.length || 1;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number): [number, number] => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
  const poly = (pts: [number, number][]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[260px]" role="img" aria-label="Skill radar">
      {[0.25, 0.5, 0.75, 1].map((lv) => (
        <polygon key={lv} points={poly(data.map((_, i) => point(i, R * lv)))} fill="none" stroke="var(--hairline)" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--hairline)" strokeWidth="1" />;
      })}
      <polygon
        points={poly(data.map((d, i) => point(i, R * Math.max(0.05, d.mastery))))}
        fill="rgba(91,91,214,0.25)"
        stroke="#5b5bd6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const [x, y] = point(i, R * Math.max(0.05, d.mastery));
        return <circle key={i} cx={x} cy={y} r="2.6" fill="#5b5bd6" />;
      })}
      {data.map((d, i) => {
        const [x, y] = point(i, R + 17);
        return (
          <text key={i} x={x} y={y} fontSize="9.5" fontWeight="800" textAnchor="middle" dominantBaseline="middle" fill="var(--ink-500, #6b7280)">
            {d.area}
          </text>
        );
      })}
    </svg>
  );
}
