import type { RankId } from "./progress";

/**
 * Bot characters: each bot is its own cute chess piece with its own personality, and its own reaction to
 * each moment of a game. Pure SVG strings, so the app (react-native-svg) and the website draw the same art.
 * Chaukor ("cody") is the mascot and keeps its Lottie animations, so it has no drawing here.
 */
export type BotMood = "wait" | "turn" | "ahead" | "behind" | "won" | "lost";
export type CharacterBot = "pip" | "rooky" | "bishop" | "ivy" | "atlas" | "raja";
type BotLook = { id: CharacterBot; name: string; piece: string; rating: number; color: string; who: string; moves: string; react: Record<BotMood, string>; draw: (m: BotMood, u: string) => string };

// Each bot is its own cute chess piece with its own personality. viewBox 0 0 200 220.
const INK = "#2B2850";
const eye = (x: number, y: number, r = 9, dx = 0, dy = 0) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="${INK}"/><circle cx="${x - r * 0.35 + dx}" cy="${y - r * 0.45 + dy}" r="${r * 0.38}" fill="#fff"/>`;
const arcUp = (x: number, y: number, w = 9) => `<path d="M${x - w} ${y + 3} Q${x} ${y - 9} ${x + w} ${y + 3}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
const arcDown = (x: number, y: number, w = 9) => `<path d="M${x - w} ${y - 2} Q${x} ${y + 8} ${x + w} ${y - 2}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
const line = (d: string, w = 4.5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const blush = (x1: number, x2: number, y: number, o = 0.45) => `<g fill="#FF5C7A" opacity="${o}"><ellipse cx="${x1}" cy="${y}" rx="8" ry="5"/><ellipse cx="${x2}" cy="${y}" rx="8" ry="5"/></g>`;
const bubble = (x: number, y: number, text: string, cls = "say") => `<g class="${cls}" style="transform-origin:${x}px ${y}px"><rect x="${x - text.length * 5.2 - 10}" y="${y - 16}" width="${text.length * 10.4 + 20}" height="30" rx="12" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Fredoka,Nunito,sans-serif" font-weight="700" font-size="15" fill="${INK}">${text}</text></g>`;
const sweat = (x: number, y: number) => `<path class="sweat" d="M${x} ${y} q8 13 0 18 q-8 -5 0 -18 Z" fill="#8CD0FF" stroke="#2F78C0" stroke-width="2"/>`;
const sparkle = (x: number, y: number, s = 9, d = 0) => `<path class="twinkle" style="animation-delay:${d}s" d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="#F6C343"/>`;
const base = (c: string) => `<ellipse cx="100" cy="207" rx="62" ry="6" fill="${INK}" opacity=".14"/><rect x="40" y="180" width="120" height="24" rx="12" fill="${c}"/>`;
const shade = (id: string, top: string, bot: string) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs>`;

const LOOKS: BotLook[] = [
  {
    id: "pip", name: "Pip", piece: "Pawn", rating: 300, color: "#F4C04E",
    who: "Shy little pawn. Easily startled, cheers for everyone, can't believe it when it wins.",
    moves: "Quick, fidgety hops; peeks around; trembles when nervous.",
    react: { wait: "Peeking", turn: "Nervous thinking", ahead: "Tiny cheer", behind: "Panicking", won: "\"I won?!\"", lost: "Cheers for you" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const face = {
        wait: eye(84, 88, 10, 3) + eye(116, 88, 10, 3) + line("M94 108 Q100 112 106 108"),
        turn: eye(84, 88, 9, -3, -2) + eye(116, 88, 9, -3, -2) + line("M92 110 q4 -4 8 0 t8 0", 4) + sweat(140, 62),
        ahead: arcUp(84, 90) + arcUp(116, 90) + `<path d="M90 104 Q100 120 110 104 Z" fill="${INK}"/>`,
        behind: `<circle cx="84" cy="88" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="84" cy="88" r="3.5" fill="${INK}"/><circle cx="116" cy="88" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="116" cy="88" r="3.5" fill="${INK}"/><ellipse cx="100" cy="110" rx="6" ry="7" fill="${INK}"/>` + sweat(138, 58) + sweat(58, 66),
        won: `<circle cx="84" cy="86" r="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="84" cy="86" r="5" fill="${INK}"/><circle cx="116" cy="86" r="11" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="116" cy="86" r="5" fill="${INK}"/><ellipse cx="100" cy="110" rx="8" ry="9" fill="${INK}"/>` + sparkle(40, 50, 10) + sparkle(162, 40, 8, 0.3) + bubble(100, -2, "I won?!"),
        lost: arcUp(84, 90) + arcUp(116, 90) + `<path d="M90 104 Q100 118 110 104 Z" fill="${INK}"/>` + bubble(100, -2, "yay you!"),
      }[m];
      const arms = m === "lost" || m === "ahead" ? `<g class="clap"><ellipse cx="72" cy="140" rx="9" ry="12" fill="#E0A93A"/><ellipse cx="128" cy="140" rx="9" ry="12" fill="#E0A93A"/></g>` : m === "behind" ? `<ellipse cx="62" cy="108" rx="9" ry="12" fill="#E0A93A"/><ellipse cx="138" cy="108" rx="9" ry="12" fill="#E0A93A"/>` : `<ellipse cx="62" cy="150" rx="8" ry="11" fill="#E0A93A"/><ellipse cx="138" cy="150" rx="8" ry="11" fill="#E0A93A"/>`;
      return shade(u, "#FFE08A", "#E9A92E") + base("#C98E22") + `<g class="b">
<path d="M66 124 Q62 160 46 182 H154 Q138 160 134 124 Z" fill="${g}" stroke="#B07A18" stroke-width="3"/>
<rect x="58" y="116" width="84" height="16" rx="8" fill="#F0B640" stroke="#B07A18" stroke-width="3"/>
<circle cx="100" cy="84" r="44" fill="${g}" stroke="#B07A18" stroke-width="3"/>
<ellipse cx="84" cy="58" rx="12" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 84 58)"/>
${blush(72, 128, 102)}<g class="f">${face}</g>${arms}</g>`;
    },
  },
  {
    id: "rooky", name: "Sir Gallop", piece: "Knight", rating: 600, color: "#4DA3F0",
    who: "Brave, eager, a bit of a show-off. Charges in, then bows like a true knight.",
    moves: "Head tosses, mane flicks, rears up when excited.",
    react: { wait: "Prancing", turn: "Pawing the ground", ahead: "Showing off", behind: "Ears back", won: "\"Huzzah!\"", lost: "Gallant bow" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const eyeF = { wait: eye(116, 78, 10, 2), turn: eye(116, 76, 10, 4, -3) + line("M104 60 L126 64", 4), ahead: arcUp(116, 80, 10), behind: eye(116, 80, 8) + line("M104 64 L126 58", 4) + sweat(92, 60), won: arcUp(116, 80, 10), lost: arcDown(116, 80, 10) }[m];
      const mouth = { wait: line("M140 116 Q150 122 158 114"), turn: line("M142 118 H156"), ahead: `<path d="M138 112 Q150 128 160 110 Z" fill="${INK}"/>`, behind: line("M140 120 q5 -4 9 0 t9 0", 4), won: `<path d="M136 110 Q150 132 162 108 Z" fill="${INK}"/>`, lost: line("M140 116 Q150 122 158 114") }[m];
      const ear = m === "behind" ? "M96 46 L74 38 L92 60 Z" : "M96 48 L92 18 L112 42 Z";
      const extra = m === "won" ? bubble(120, -2, "Huzzah!") + sparkle(30, 60, 9) : m === "lost" ? bubble(110, -2, "Well played!") : "";
      return shade(u, "#8CC6F8", "#2F78C0") + base("#22609E") + `<g class="b"><g class="h">
<path d="M60 182 C54 150 58 124 70 104 C62 80 72 50 96 42 C128 32 158 54 164 88 C168 104 166 118 156 124 C146 130 134 126 128 122 C122 140 128 162 140 182 Z" fill="${g}" stroke="#1E5A94" stroke-width="3" stroke-linejoin="round"/>
<path d="${ear}" fill="#4DA3F0" stroke="#1E5A94" stroke-width="3" stroke-linejoin="round"/>
<path class="mane" d="M90 44 Q70 46 70 62 Q56 66 62 82 Q48 92 60 104 Q48 118 62 128 Q54 146 66 156 L74 140 Q70 120 78 100 Q74 76 92 56 Z" fill="#E5484D" stroke="#A8282D" stroke-width="2.5" stroke-linejoin="round"/>
<ellipse cx="154" cy="104" rx="4" ry="3" fill="#1E5A94"/>
<ellipse cx="120" cy="56" rx="12" ry="5" fill="#fff" opacity=".5" transform="rotate(-20 120 56)"/>
${eyeF}${mouth}</g></g>${extra}`;
    },
  },
  {
    id: "bishop", name: "Professor Bishop", piece: "Bishop", rating: 900, color: "#9A7BE8",
    who: "Kind, bookish teacher. Thinks out loud, loves a clever move, even yours.",
    moves: "Slow, thoughtful sway; adjusts glasses; a lightbulb when an idea lands.",
    react: { wait: "Reading", turn: "\"Hmm…\"", ahead: "Approving nod", behind: "Polishing glasses", won: "\"Elementary!\"", lost: "Polite applause" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const glasses = m === "behind" ? "" : `<g fill="#fff" fill-opacity=".2" stroke="${INK}" stroke-width="3.5"><circle cx="86" cy="100" r="14"/><circle cx="114" cy="100" r="14"/></g>${line("M100 99 V99", 3)}`;
      const eyes = { wait: eye(86, 102, 6, 0, 2) + eye(114, 102, 6, 0, 2), turn: eye(86, 98, 6, 3, -3) + eye(114, 98, 6, 3, -3), ahead: arcUp(86, 102, 7) + arcUp(114, 102, 7), behind: line("M78 102 H94") + line("M106 102 H122"), won: arcUp(86, 102, 7) + arcUp(114, 102, 7), lost: arcUp(86, 102, 7) + arcUp(114, 102, 7) }[m];
      const mouth = { wait: line("M94 124 Q100 128 106 124", 4), turn: line("M94 126 H106", 4), ahead: line("M90 122 Q100 132 110 122", 4), behind: line("M92 127 q4 -3 8 0 t8 0", 3.5), won: `<path d="M90 121 Q100 136 110 121 Z" fill="${INK}"/>`, lost: line("M90 122 Q100 132 110 122", 4) }[m];
      const prop = m === "wait" ? `<g class="book"><rect x="70" y="146" width="60" height="26" rx="4" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M100 146 V172" stroke="${INK}" stroke-width="3"/><path d="M78 154 H94 M78 162 H92 M106 154 H122 M106 162 H120" stroke="#B9A6F2" stroke-width="2.5"/></g>`
        : m === "turn" ? `<g class="bulb"><circle cx="156" cy="40" r="14" fill="#FFE08A" stroke="${INK}" stroke-width="3"/><rect x="150" y="54" width="12" height="8" rx="2" fill="#C8D2DC" stroke="${INK}" stroke-width="2.5"/></g><ellipse cx="120" cy="150" rx="10" ry="12" fill="#B9A6F2" stroke="#4E3794" stroke-width="2.5"/>`
        : m === "behind" ? `<g class="polish"><circle cx="122" cy="150" r="12" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="3"/><circle cx="146" cy="150" r="12" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="3"/></g>` + sweat(140, 70)
        : m === "won" ? bubble(100, -4, "Elementary!") : m === "lost" ? `<g class="clap"><ellipse cx="92" cy="152" rx="9" ry="12" fill="#B9A6F2" stroke="#4E3794" stroke-width="2.5"/><ellipse cx="108" cy="152" rx="9" ry="12" fill="#B9A6F2" stroke="#4E3794" stroke-width="2.5"/></g>` + bubble(100, -4, "Splendid!") : "";
      return shade(u, "#C9B6F6", "#6E52BF") + base("#4E3794") + `<g class="b">
<path d="M70 140 Q64 166 48 182 H152 Q136 166 130 140 Z" fill="${g}" stroke="#4E3794" stroke-width="3"/>
<rect x="62" y="132" width="76" height="14" rx="7" fill="#B9A6F2" stroke="#4E3794" stroke-width="3"/>
<path d="M100 30 C136 52 148 90 140 118 Q134 136 100 136 Q66 136 60 118 C52 90 64 52 100 30 Z" fill="${g}" stroke="#4E3794" stroke-width="3"/>
<path d="M116 52 L98 76" stroke="#4E3794" stroke-width="5" stroke-linecap="round"/>
<circle cx="100" cy="24" r="9" fill="#C9B6F6" stroke="#4E3794" stroke-width="3"/>
<ellipse cx="80" cy="60" rx="10" ry="5" fill="#fff" opacity=".5" transform="rotate(-50 80 60)"/>
${blush(72, 128, 116, 0.35)}${eyes}${glasses}${mouth}<g class="p">${prop}</g></g>`;
    },
  },
  {
    id: "ivy", name: "Rooky", piece: "Rook", rating: 1200, color: "#6E8B9B",
    who: "Grumpy, stubborn wall of a rook. Hard to break, secretly a softie.",
    moves: "Heavy and still; arms crossed; stomps; loses a brick when rattled.",
    react: { wait: "Arms crossed", turn: "Glaring", ahead: "Smug", behind: "Losing bricks", won: "Victory stomp", lost: "Grumpy huff" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const brows = { wait: line("M74 92 L94 96 M106 96 L126 92", 5), turn: line("M74 90 L94 98 M106 98 L126 90", 5.5), ahead: line("M74 94 L94 94 M106 90 L126 94", 5), behind: line("M74 96 L94 90 M106 90 L126 96", 5), won: line("M74 90 L94 96 M106 96 L126 90", 5), lost: line("M74 92 L94 98 M106 98 L126 92", 5) }[m];
      const eyes = { wait: eye(84, 108, 7) + eye(116, 108, 7), turn: eye(84, 108, 7, 3) + eye(116, 108, 7, 3), ahead: line("M77 108 H91") + eye(116, 108, 7), behind: eye(84, 108, 8) + eye(116, 108, 8), won: arcUp(84, 110, 8) + arcUp(116, 110, 8), lost: line("M77 109 H91") + line("M109 109 H123") }[m];
      const mouth = { wait: line("M92 128 H108", 4.5), turn: line("M90 130 Q100 124 110 130", 4.5), ahead: line("M90 128 Q102 134 112 124", 4.5), behind: line("M90 130 q5 -4 10 0 t10 0", 4), won: `<path d="M88 124 Q100 140 112 124 Z" fill="${INK}"/>`, lost: line("M90 132 Q100 124 110 132", 4.5) }[m];
      const arms = m === "wait" || m === "turn" || m === "lost" ? `<g><rect x="62" y="140" width="76" height="16" rx="8" fill="#93AFBE" stroke="#34495A" stroke-width="3" transform="rotate(8 100 148)"/><rect x="62" y="140" width="76" height="16" rx="8" fill="#98B2C0" stroke="#34495A" stroke-width="3" transform="rotate(-8 100 148)"/></g>` : m === "won" ? `<g class="flex"><rect x="22" y="96" width="44" height="18" rx="9" fill="#98B2C0" stroke="#34495A" stroke-width="3" transform="rotate(-50 44 105)"/><rect x="134" y="96" width="44" height="18" rx="9" fill="#98B2C0" stroke="#34495A" stroke-width="3" transform="rotate(50 156 105)"/></g>` : "";
      const extra = m === "behind" ? `<rect class="brick" x="122" y="38" width="22" height="14" rx="3" fill="#98B2C0" stroke="#34495A" stroke-width="3"/>` + sweat(52, 96) : m === "lost" ? `<g class="huff"><circle cx="58" cy="30" r="10" fill="#E4E9EE"/><circle cx="70" cy="22" r="8" fill="#E4E9EE"/><circle cx="142" cy="30" r="10" fill="#E4E9EE"/><circle cx="130" cy="22" r="8" fill="#E4E9EE"/></g>` + bubble(100, 16, "hmph. gg") : m === "won" ? bubble(100, 16, "STOMP!") : "";
      const top = m === "behind" ? "M54 40 H74 V54 H90 V40 H110 V54 H122 V54 H146 V82 Q146 88 140 88 H60 Q54 88 54 82 Z" : "M54 40 H74 V54 H90 V40 H110 V54 H126 V40 H146 V82 Q146 88 140 88 H60 Q54 88 54 82 Z";
      return shade(u, "#A9C0CC", "#4B6573") + base("#34495A") + `<g class="b">
<path d="M64 88 H136 L140 160 Q142 174 152 182 H48 Q58 174 60 160 Z" fill="${g}" stroke="#34495A" stroke-width="3"/>
<path d="${top}" fill="${g}" stroke="#34495A" stroke-width="3" stroke-linejoin="round"/>
<path d="M66 70 H134 M100 54 V70" stroke="#34495A" stroke-width="2" opacity=".35"/>
<path d="M66 166 H134 M84 150 V166 M116 150 V166" stroke="#34495A" stroke-width="2" opacity=".3"/>
<ellipse cx="72" cy="48" rx="8" ry="4" fill="#fff" opacity=".45"/>
${blush(70, 130, 122, 0.3)}${brows}${eyes}${mouth}${arms}</g>${extra}`;
    },
  },
  {
    id: "atlas", name: "Queen Ivy", piece: "Queen", rating: 1500, color: "#3FB27A",
    who: "Elegant, confident attacker. Always one step ahead, always gracious.",
    moves: "Graceful sway; a knowing wink; curtsies when you beat her.",
    react: { wait: "Graceful sway", turn: "Raised eyebrow", ahead: "Wink", behind: "Tut-tut", won: "Crown sparkle", lost: "Curtsy" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const lash = (x: number) => line(`M${x + 8} ${86} l5 -4`, 3);
      const lid = (x: number) => `<path d="M${x - 10} 92 Q${x} 80 ${x + 10} 92 Z" fill="#3FB27A"/>`;
      const eyes = {
        wait: eye(86, 94, 7) + eye(114, 94, 7) + lid(86) + lid(114) + lash(86) + lash(114),
        turn: eye(86, 94, 7, 3) + eye(114, 94, 7, 3) + lid(86) + lash(114) + line("M78 80 Q86 76 94 80 M106 72 Q114 68 122 74", 3.5),
        ahead: eye(86, 94, 7) + arcUp(114, 96, 8) + lash(86),
        behind: eye(86, 95, 6) + eye(114, 95, 6) + line("M78 82 L94 86 M106 86 L122 82", 3.5),
        won: arcUp(86, 96, 8) + arcUp(114, 96, 8),
        lost: arcDown(86, 94, 8) + arcDown(114, 94, 8),
      }[m];
      const mouth = { wait: line("M92 112 Q100 117 108 112", 4), turn: line("M92 113 Q102 116 108 110", 4), ahead: `<path d="M90 110 Q100 122 110 110 Z" fill="${INK}"/>`, behind: line("M94 114 H106", 4), won: `<path d="M90 109 Q100 124 110 109 Z" fill="${INK}"/>`, lost: line("M92 112 Q100 117 108 112", 4) }[m];
      const extra = m === "won" ? sparkle(64, 26, 9) + sparkle(138, 20, 11, 0.3) + sparkle(160, 60, 7, 0.6) : m === "lost" ? bubble(100, 6, "Well played") : m === "behind" ? bubble(160, 40, "tsk.") : "";
      return shade(u, "#8AD9B0", "#2A8458") + base("#1C5E3D") + `<g class="b">
<path d="M72 122 Q68 156 44 182 H156 Q132 156 128 122 Z" fill="${g}" stroke="#1C5E3D" stroke-width="3"/>
<path class="vine" d="M66 176 Q86 160 78 146 Q92 136 88 124 M134 176 Q116 162 124 148" fill="none" stroke="#1C5E3D" stroke-width="3"/>
${[[78, 146], [88, 124], [124, 148], [70, 166]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4.5" fill="#A6E8C4" stroke="#1C5E3D" stroke-width="2" transform="rotate(-30 ${x} ${y})"/>`).join("")}
<rect x="66" y="116" width="68" height="12" rx="6" fill="#F6C343" stroke="#B88A1C" stroke-width="3"/>
<circle cx="100" cy="98" r="32" fill="${g}" stroke="#1C5E3D" stroke-width="3"/>
<g class="crown"><path d="M66 72 L72 38 L86 58 L100 30 L114 58 L128 38 L134 72 Z" fill="#F6C343" stroke="#B88A1C" stroke-width="3" stroke-linejoin="round"/>
${[[72, 36], [100, 27], [128, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="#B88A1C" stroke-width="2.5"/>`).join("")}<circle cx="100" cy="60" r="5" fill="#E5484D"/></g>
${blush(76, 124, 106, 0.4)}${eyes}${mouth}</g>${extra}`;
    },
  },
  {
    id: "raja", name: "King Atlas", piece: "King", rating: 1800, color: "#C2344C",
    who: "Calm, wise old king. Rarely surprised, never rushed, always fair.",
    moves: "Slow breathing; meditates on his turn; tips the crown when beaten.",
    react: { wait: "Slow breathing", turn: "Meditating", ahead: "Warm smile", behind: "One bead of sweat", won: "Quiet nod", lost: "Tips the crown" },
    draw(m: BotMood, u: string) {
      const g = `url(#${u})`;
      const brow = (raise: number) => `<path d="M72 ${88 - raise} Q84 ${80 - raise} 95 ${88 - raise}" fill="none" stroke="#F2EEE4" stroke-width="6" stroke-linecap="round"/><path d="M105 ${88 - raise} Q116 ${80 - raise} 128 ${88 - raise}" fill="none" stroke="#F2EEE4" stroke-width="6" stroke-linecap="round"/>`;
      const lidEye = (x: number) => eye(x, 99, 6) + `<path d="M${x - 8} 96 Q${x} 90 ${x + 8} 96 V91 H${x - 8} Z" fill="#E57A8B"/>`;
      const eyes = {
        wait: brow(0) + lidEye(84) + lidEye(116),
        turn: brow(0) + arcDown(84, 98, 8) + arcDown(116, 98, 8),
        ahead: brow(2) + arcUp(84, 100, 8) + arcUp(116, 100, 8),
        behind: brow(5) + eye(84, 99, 6) + eye(116, 99, 6),
        won: brow(0) + arcDown(84, 98, 8) + arcDown(116, 98, 8),
        lost: brow(3) + arcUp(84, 100, 8) + arcUp(116, 100, 8),
      }[m];
      const smile = { wait: "M93 124 Q100 128 107 124", turn: "M95 125 H105", ahead: "M90 122 Q100 132 110 122", behind: "M93 126 q3.5 -3 7 0 t7 0", won: "M92 123 Q100 130 108 123", lost: "M90 122 Q100 132 110 122" }[m];
      const beard = `<path d="M70 112 Q66 128 76 138 Q78 148 90 146 Q100 156 110 146 Q122 148 124 138 Q134 128 130 112 Q122 126 100 126 Q78 126 70 112 Z" fill="#F7F4EC" stroke="#C9C1AE" stroke-width="2.5" stroke-linejoin="round"/>`;
      const stache = `<path d="M80 118 Q90 110 100 117 Q110 110 120 118 Q112 124 100 120 Q88 124 80 118 Z" fill="#F7F4EC" stroke="#C9C1AE" stroke-width="2"/>`;
      const crown = `<g class="crown${m === "lost" ? " lift" : ""}"><path d="M64 70 L60 40 L80 54 L100 34 L120 54 L140 40 L136 70 Q100 78 64 70 Z" fill="#F6C343" stroke="#B88A1C" stroke-width="3" stroke-linejoin="round"/><path d="M64 66 Q100 74 136 66" fill="none" stroke="#B88A1C" stroke-width="2.5"/><circle cx="82" cy="64" r="4" fill="#4DA3F0"/><circle cx="100" cy="66" r="5.5" fill="#E5484D"/><circle cx="118" cy="64" r="4" fill="#3FB27A"/><path d="M100 34 V12 M91 21 H109" stroke="#B88A1C" stroke-width="9" stroke-linecap="round"/><path d="M100 34 V12 M91 21 H109" stroke="#F6C343" stroke-width="4" stroke-linecap="round"/></g>`;
      const orb = m === "turn" || m === "wait" ? "" : `<g><ellipse cx="146" cy="160" rx="11" ry="9" fill="#F49AA8" stroke="#5A0C1C" stroke-width="2.5"/><circle cx="146" cy="144" r="12" fill="#F6C343" stroke="#B88A1C" stroke-width="3"/><path d="M134 144 H158 M146 132 V144" stroke="#B88A1C" stroke-width="2.5"/><path d="M146 132 V122 M141 126 H151" stroke="#B88A1C" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="142" cy="139" rx="3.5" ry="2" fill="#fff" opacity=".7"/></g>`;
      const hands = m === "turn" ? `<ellipse cx="88" cy="160" rx="10" ry="8" fill="#F49AA8" stroke="#5A0C1C" stroke-width="2.5"/><ellipse cx="112" cy="160" rx="10" ry="8" fill="#F49AA8" stroke="#5A0C1C" stroke-width="2.5"/>` : "";
      const extra = m === "turn" ? `<g class="zen">${[0, 1, 2].map((i) => `<circle cx="${146 + i * 14}" cy="${60 - i * 12}" r="${4 + i * 2}" fill="#fff" stroke="${INK}" stroke-width="2.5" style="animation-delay:${i * 0.5}s"/>`).join("")}</g>` : m === "behind" ? sweat(134, 74) : m === "won" ? sparkle(40, 50, 8) + sparkle(160, 36, 7, 0.4) : m === "lost" ? bubble(100, -4, "Well played.") : "";
      return shade(u, "#F49AA8", "#C2344C") + shade(u + "r", "#B8283F", "#6A0F22") + base("#5A0C1C") + `<g class="b">
<path d="M68 140 Q60 166 44 182 H156 Q140 166 132 140 Z" fill="url(#${u}r)" stroke="#5A0C1C" stroke-width="3"/>
<path d="M100 146 V182" stroke="#F6C343" stroke-width="6"/>
<path d="M58 136 Q100 152 142 136 L144 148 Q100 164 56 148 Z" fill="#fff" stroke="#5A0C1C" stroke-width="2.5"/>${[[70, 145], [86, 151], [114, 151], [130, 145]].map(([x, y]) => `<path d="M${x} ${y - 3} v6 M${x - 2} ${y} h4" stroke="${INK}" stroke-width="2"/>`).join("")}
<circle cx="100" cy="102" r="38" fill="${g}" stroke="#5A0C1C" stroke-width="3"/>
<ellipse cx="80" cy="84" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-35 80 84)"/>
${blush(70, 130, 112, 0.5)}${eyes}${beard}${stache}${line(smile, 3.5)}${crown}${hands}${orb}</g>${extra}`;
    },
  },
];

const VIEWBOX = "-20 -24 240 248";
const FX = /<g class="say"[\s\S]*?<\/g>|<path class="(?:twinkle|sweat)"[^>]*\/>|<g class="(?:zen|huff)">[\s\S]*?<\/g><\/g>|<g class="(?:zen|huff)">[\s\S]*?<\/g>/g;

export const isCharacterBot = (id: string): id is CharacterBot => LOOKS.some((b) => b.id === id);

/**
 * The bot in one mood, split in two layers: `body` (the character, which the apps move as a whole)
 * and `fx` (speech bubble, sweat, sparkles, thought dots), drawn on top and kept still. Same viewBox.
 */
export function botArt(id: CharacterBot, mood: BotMood, uid = id): { body: string; fx: string; viewBox: string } {
  const look = LOOKS.find((b) => b.id === id)!;
  const all = look.draw(mood, `${uid}${mood}`);
  const fx = (all.match(FX) ?? []).join("");
  const body = all.replace(FX, "").replace(/ class="[^"]*"/g, "").replace(/ style="[^"]*"/g, "");
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${inner}</svg>`;
  return { body: wrap(body), fx: fx ? wrap(fx.replace(/ class="[^"]*"/g, "").replace(/ style="[^"]*"/g, "")) : "", viewBox: VIEWBOX };
}

/**
 * The bot's mood during a game. `result` is the player's (win means the bot lost); `edge` is the bot's
 * material lead in pawns. Three pawns either way counts as ahead or losing.
 */
export function gameMood({ result, thinking, edge }: { result: "win" | "loss" | "draw" | null; thinking: boolean; edge: number }): BotMood {
  if (result === "win") return "lost";
  if (result === "loss") return "won";
  if (result === "draw") return "wait";
  if (thinking) return "turn";
  return edge >= 3 ? "ahead" : edge <= -3 ? "behind" : "wait";
}

/* ---------- motion: one rhythm per bot and mood ---------- */

/** Keyframes in viewBox units (body is 240 wide): translate x/y, rotate (deg), scale x/y. Origin is the base centre. */
type Frame = { at: number; x?: number; y?: number; r?: number; sx?: number; sy?: number };
const K: Record<string, Frame[]> = {
  hop: [{ at: 0 }, { at: 0.45, y: -10 }, { at: 0.8, sy: 0.96 }, { at: 1 }],
  tremble: [{ at: 0 }, { at: 0.25, x: -2 }, { at: 0.75, x: 2 }, { at: 1 }],
  jump: [{ at: 0 }, { at: 0.15, sx: 1.06, sy: 0.9 }, { at: 0.5, y: -30, sx: 0.95, sy: 1.06 }, { at: 1 }],
  prance: [{ at: 0 }, { at: 0.3, y: -8, r: -3 }, { at: 0.6, r: 2 }, { at: 1 }],
  nod: [{ at: 0 }, { at: 0.5, r: 3 }, { at: 1 }],
  rear: [{ at: 0 }, { at: 0.4, r: -10, y: -6 }, { at: 0.6, r: -10, y: -6 }, { at: 1 }],
  backoff: [{ at: 0 }, { at: 0.5, x: -6, r: -2 }, { at: 1 }],
  bow: [{ at: 0 }, { at: 0.2 }, { at: 0.45, r: 12 }, { at: 0.75, r: 12 }, { at: 1 }],
  sway: [{ at: 0, r: -2 }, { at: 0.5, r: 2 }, { at: 1, r: -2 }],
  tilt: [{ at: 0 }, { at: 0.5, r: 5 }, { at: 1 }],
  sink: [{ at: 0 }, { at: 0.5, y: 4 }, { at: 1 }],
  stomp: [{ at: 0 }, { at: 0.8 }, { at: 0.86, y: -8 }, { at: 0.92, sx: 1.05, sy: 0.93 }, { at: 1 }],
  squint: [{ at: 0 }, { at: 0.5, sx: 1.01, sy: 0.98 }, { at: 1 }],
  smug: [{ at: 0 }, { at: 0.5, r: 3 }, { at: 1 }],
  thud: [{ at: 0 }, { at: 0.4, y: -18 }, { at: 0.6, sx: 1.08, sy: 0.9 }, { at: 1 }],
  swayQ: [{ at: 0, r: -3 }, { at: 0.5, r: 3 }, { at: 1, r: -3 }],
  lean: [{ at: 0 }, { at: 0.3, r: 4 }, { at: 0.7, r: 4 }, { at: 1 }],
  headshake: [{ at: 0 }, { at: 0.2, r: -3 }, { at: 0.4, r: 3 }, { at: 0.6 }, { at: 1 }],
  twirl: [{ at: 0 }, { at: 0.4, sx: -1 }, { at: 0.6, sx: -1 }, { at: 0.8 }, { at: 1 }],
  curtsy: [{ at: 0 }, { at: 0.3 }, { at: 0.5, y: 6, sy: 0.94 }, { at: 0.8, y: 6, sy: 0.94 }, { at: 1 }],
  breathe: [{ at: 0 }, { at: 0.5, sx: 1.025, sy: 1.025 }, { at: 1 }],
  float: [{ at: 0 }, { at: 0.5, y: -6 }, { at: 1 }],
};
const MOTION: Record<CharacterBot, Record<BotMood, [kind: keyof typeof K, ms: number]>> = {
  pip: { wait: ["hop", 1100], turn: ["tremble", 180], ahead: ["hop", 700], behind: ["tremble", 100], won: ["jump", 900], lost: ["hop", 600] },
  rooky: { wait: ["prance", 1300], turn: ["nod", 500], ahead: ["rear", 1200], behind: ["backoff", 1800], won: ["rear", 1200], lost: ["bow", 2400] },
  bishop: { wait: ["sway", 3200], turn: ["tilt", 2600], ahead: ["sink", 1800], behind: ["tremble", 400], won: ["hop", 1400], lost: ["sink", 1800] },
  ivy: { wait: ["stomp", 3400], turn: ["squint", 2000], ahead: ["smug", 2400], behind: ["tremble", 250], won: ["thud", 1000], lost: ["squint", 2000] },
  atlas: { wait: ["swayQ", 3000], turn: ["lean", 3000], ahead: ["swayQ", 2000], behind: ["headshake", 1600], won: ["twirl", 2400], lost: ["curtsy", 2400] },
  raja: { wait: ["breathe", 4500], turn: ["float", 5000], ahead: ["sink", 3600], behind: ["breathe", 2400], won: ["sink", 3600], lost: ["sink", 3000] },
};
export type BotMotion = { name: string; ms: number; frames: Required<Frame>[] };
/** How this bot moves in this mood: the frames filled in, ready for CSS keyframes or an interpolation. */
export function botMotion(id: CharacterBot, mood: BotMood): BotMotion {
  const [name, ms] = MOTION[id][mood];
  return { name, ms, frames: K[name].map((f) => ({ x: 0, y: 0, r: 0, sx: 1, sy: 1, ...f })) };
}

/* ---------- rank emblems ---------- */
const SHIELD = "M120 34 L194 58 V118 Q194 184 120 222 Q46 184 46 118 V58 Z";
const SHIELD_IN = "M120 48 L182 68 V118 Q182 174 120 207 Q58 174 58 118 V68 Z";
const leaf = (x: string, y: string, a: string, f: string, st: string) => `<path d="M0 0 Q10 -8 22 0 Q10 8 0 0 Z" fill="${f}" stroke="${st}" stroke-width="1.8" stroke-linejoin="round" transform="translate(${x} ${y}) rotate(${a})"/>`;
function laurel(f: string, st: string) {
  // A curved stem up each side of the shield, leaf pairs angled off it.
  let o = `<path d="M96 234 Q2 196 26 52" fill="none" stroke="${st}" stroke-width="3" stroke-linecap="round"/>`;
  for (let i = 0; i < 7; i++) {
    const t = 0.08 + i * 0.13, x = (1 - t) ** 2 * 96 + 2 * (1 - t) * t * 2 + t * t * 26, y = (1 - t) ** 2 * 234 + 2 * (1 - t) * t * 196 + t * t * 52;
    const dx = 2 * (1 - t) * (2 - 96) + 2 * t * (26 - 2), dy = 2 * (1 - t) * (196 - 234) + 2 * t * (52 - 196), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    o += leaf(x.toFixed(1), y.toFixed(1), (ang - 40).toFixed(0), f, st) + leaf(x.toFixed(1), y.toFixed(1), (ang + 40).toFixed(0), f, st);
  }
  return `<g>${o}</g><g transform="translate(240 0) scale(-1 1)">${o}</g>`;
}
const wing = (f: string, st: string, big: boolean) => {
  // Layered rounded feathers fanning out from behind the shield.
  const feathers = [
    "M72 112 Q34 116 14 92 Q42 94 72 98 Z",
    "M70 98 Q30 92 16 64 Q44 74 72 84 Z",
    "M72 84 Q36 66 30 36 Q52 56 78 70 Z",
    ...(big ? ["M80 70 Q56 44 58 12 Q72 40 90 58 Z"] : []),
  ];
  const w = feathers.map((d) => `<path d="${d}" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/>`).join("");
  const big2 = `<g transform="translate(72 90) scale(1.35) translate(-72 -90)">${w}</g>`;
  return big2 + `<g transform="translate(240 0) scale(-1 1)">${big2}</g>`;
};
const rays = (f: string) => { let o = ""; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, b = a + 0.12, c = a - 0.12; o += `M120 120 L${(120 + 128 * Math.sin(b)).toFixed(1)} ${(120 - 128 * Math.cos(b)).toFixed(1)} L${(120 + 128 * Math.sin(c)).toFixed(1)} ${(120 - 128 * Math.cos(c)).toFixed(1)} Z `; } return `<path d="${o}" fill="${f}" opacity=".5"/>`; };
const crown = (king: boolean, f: string, st: string) => king
  ? `<path d="M90 44 L84 12 L102 26 L120 4 L138 26 L156 12 L150 44 Q120 52 90 44 Z" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/><circle cx="120" cy="38" r="5" fill="#E5484D" stroke="${st}" stroke-width="1.5"/><circle cx="102" cy="38" r="3.5" fill="#4DA3F0"/><circle cx="138" cy="38" r="3.5" fill="#3FB27A"/>`
  : `<path d="M96 46 L92 22 L106 32 L120 16 L134 32 L148 22 L144 46 Q120 52 96 46 Z" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/>${[92, 120, 148].map((x, i) => `<circle cx="${x}" cy="${[22, 16, 22][i]}" r="4" fill="#fff" stroke="${st}" stroke-width="1.5"/>`).join("")}`;
const tower = (f: string, st: string) => `<path d="M100 48 V24 H108 V30 H116 V24 H124 V30 H132 V24 H140 V48 Z" fill="${f}" stroke="${st}" stroke-width="3" stroke-linejoin="round"/>`;
const gem = (x: number, y: number, r: number, f: string) => `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="${f}" stroke="#fff" stroke-width="1.5"/>`;
const banner = (name: string, f: string, dark: string) => `<path d="M38 204 L58 196 V226 L38 234 L46 218 Z" fill="${dark}"/><path d="M202 204 L182 196 V226 L202 234 L194 218 Z" fill="${dark}"/><path d="M56 192 Q120 206 184 192 V222 Q120 236 56 222 Z" fill="${f}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/><text x="120" y="218" text-anchor="middle" font-family="Fredoka,Nunito,sans-serif" font-weight="700" font-size="17" letter-spacing="1.5" fill="#fff">${name.toUpperCase()}</text>`;

function emblem(rank: Rank, level: number, piece: string, uid: string, small: boolean, label: string) {
  const [l0, l1, l2, l3, l4] = rank.ramp;
  const defs = `<defs><linearGradient id="${uid}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${l1}"/><stop offset=".45" stop-color="${l2}"/><stop offset="1" stop-color="${l3}"/></linearGradient><radialGradient id="${uid}i" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="${l0}"/><stop offset="1" stop-color="${l1}"/></radialGradient></defs>`;
  let back = "", frame = "", top = "";
  if (level === 1) {
    frame = `<circle cx="120" cy="122" r="82" fill="url(#${uid}m)" stroke="${l4}" stroke-width="4"/><circle cx="120" cy="122" r="82" fill="none" stroke="${l3}" stroke-width="2" stroke-dasharray="2 9" transform="rotate(10 120 122)"/><circle cx="120" cy="122" r="66" fill="url(#${uid}i)" stroke="${l4}" stroke-width="3"/>`;
  } else {
    if (level >= 6) back += rays(l1);
    if (level >= 5) back += wing(`url(#${uid}m)`, l4, level >= 6);
    else if (level === 2) back += wing(`url(#${uid}m)`, l4, false);
    if (level >= 3 && level <= 4) back += laurel(l1, l4);
    frame = `<path d="${SHIELD}" fill="url(#${uid}m)" stroke="${l4}" stroke-width="4" stroke-linejoin="round"/><path d="${SHIELD_IN}" fill="url(#${uid}i)" stroke="${l4}" stroke-width="3" stroke-linejoin="round"/>`;
    if (level >= 2) frame += [[66, 70], [174, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${l0}" stroke="${l4}" stroke-width="2"/>`).join("");
    if (level >= 5) frame += gem(120, 41, 6, level === 6 ? "#E8FBFF" : "#FFD3DC") + gem(51, 120, 5, level === 6 ? "#B4EEFA" : "#FF8FA6") + gem(189, 120, 5, level === 6 ? "#B4EEFA" : "#FF8FA6");
    if (level === 4) top = tower(`url(#${uid}m)`, l4);
    if (level === 5) top = crown(false, "#F6C343", "#B88A1C");
    if (level === 6) top = crown(true, "#F6C343", "#B88A1C");
  }
  const shine = `<path d="M70 86 Q84 60 116 54" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".6"/>`;
  const pc = `<g transform="translate(64 62) scale(.56)">${piece}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -8 272 252">${defs}${back}${frame}${shine}${pc}${top}${small ? "" : banner(label, l3, l4)}</svg>`;
}

type Rank = { id: RankId; bot: CharacterBot; ramp: [string, string, string, string, string] };
/** Wood → bronze → silver → gold → ruby → diamond; each rank shows its own piece. */
const RANK_LOOKS: Rank[] = [
  { id: "pawn", bot: "pip", ramp: ["#F3D9B5", "#D9A877", "#B9824F", "#8E5E34", "#6B4424"] },
  { id: "knight", bot: "rooky", ramp: ["#F6C9A0", "#E0995E", "#C47A3C", "#9A5A26", "#6E3E17"] },
  { id: "bishop", bot: "bishop", ramp: ["#F4F7FA", "#D5DDE5", "#AEBBC8", "#7F8EA0", "#56657A"] },
  { id: "rook", bot: "ivy", ramp: ["#FFF0B8", "#FFD95E", "#F0B429", "#C48A12", "#8A5E08"] },
  { id: "queen", bot: "atlas", ramp: ["#FFD3DC", "#FF8FA6", "#E5486A", "#B42E4E", "#7E1B34"] },
  { id: "king", bot: "raja", ramp: ["#E8FBFF", "#B4EEFA", "#6FD3EE", "#2FA6CB", "#16708F"] },
];
const KEEP = new Set(["#2B2850", "#FFF", "#FFFFFF", "#FF5C7A", "#8CD0FF", "#F6C343", "#B88A1C", "#E5484D", "#A8282D", "#FFE08A", "#C8D2DC", "#F2EEE4", "#E4DED0", "#B9B2A0", "#E4E9EE", "#A6E8C4", "#F7F4EC", "#C9C1AE"]);
const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };
/** Repaints a piece into the rank's metal: its own colours, lightest to darkest, onto the ramp. */
function recolor(svg: string, ramp: string[]) {
  const cols = [...new Set(svg.match(/#[0-9A-Fa-f]{6}\b/g) ?? [])].filter((c) => !KEEP.has(c.toUpperCase())).sort((a, b) => lum(b) - lum(a));
  cols.forEach((c, i) => { svg = svg.split(c).join(ramp[Math.min(ramp.length - 1, Math.round((i / Math.max(1, cols.length - 1)) * (ramp.length - 1)))]); });
  return svg;
}
/** A still emblem for a rank: frame grows with the rank, the rank's piece inside. `small` drops the name banner (list rows). */
export function rankEmblem(rank: RankId, label: string, { small = false, uid = rank } = {}): string {
  const r = RANK_LOOKS.find((x) => x.id === rank) ?? RANK_LOOKS[0];
  const look = LOOKS.find((b) => b.id === r.bot)!;
  const u = `rk${uid}${small ? "s" : ""}`;
  const piece = recolor(look.draw("ahead", `${u}p`), r.ramp).replace(FX, "").replace(/ class="[^"]*"/g, "").replace(/<ellipse cx="100" cy="207"[^>]*\/>/, "");
  return emblem(r, RANK_LOOKS.indexOf(r) + 1, piece, u, small, label);
}
