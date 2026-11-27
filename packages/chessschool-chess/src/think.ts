import { START_FEN, type Color, type Square } from "./board";
import { load } from "./game";
import type { Step } from "./lessons";

/**
 * "Think like a player": a second Learn track, shipped with the app (not the server course), on how to
 * think in each phase: the opening (and eight openings move by move), the middlegame (plan, attack,
 * defend, open or closed) and the endgame. Lessons are always open and play in the normal lesson player.
 * Positions come from real move lists, so every board is legal by construction (see think.test.ts).
 */
type L = readonly [en: string, hi: string];
export type ThinkLang = "en" | "hi";
// Set for the duration of one build; content is plain data otherwise.
let lang: ThinkLang = "en";
const say = (l: L) => (lang === "hi" ? l[1] : l[0]);

/** One learner move: why to play it (after the opponent's reply, if any) and a hint for a wrong try. */
type Beat = { title: L; body: L; hint: L };
type Quiz = { title: L; body: L; options: readonly L[]; correct: number; hint: L };
type Block =
  | { say: { title: L; body: L; fen?: string; moves?: string } }
  | { line: { moves: string; side: Color; beats: readonly Beat[]; pre?: string } }
  | { quiz: Quiz & { fen?: string; moves?: string } }
  | { move: Beat & { fen: string; uci: string } }
  | { game: { moves: string; side: Color } };

/** `side`: the colour the learner plays in this lesson, so its explanation boards face the same way. */
type Def = { id: string; title: L; sub: L; minutes: number; xp: number; side?: Color; blocks: readonly Block[] };
export type ThinkLesson = { id: string; unit: string; title: string; sub: string; minutes: number; xp: number; steps: Step[] };
export type ThinkUnit = { id: string; title: string; sub: string; lessons: ThinkLesson[] };

const fenAfter = (moves: string) => {
  const c = load(START_FEN);
  for (const san of moves.split(/\s+/).filter(Boolean)) c.move(san);
  return c.fen();
};

function build(d: Def): Step[] {
  const steps: Step[] = [];
  for (const b of d.blocks) {
    if ("say" in b) steps.push({ kind: "say", pose: "reading", title: say(b.say.title), body: say(b.say.body), fen: b.say.fen ?? fenAfter(b.say.moves ?? ""), ...(d.side ? { side: d.side } : {}) });
    else if ("quiz" in b) {
      // The right answer moves around, so it is not always first.
      const n = b.quiz.options.length;
      const r = (d.id.length + steps.length) % n;
      const order = b.quiz.options.map((_, i) => (i + r) % n);
      steps.push({
        kind: "choice",
        pose: "thinking",
        title: say(b.quiz.title),
        body: say(b.quiz.body),
        fen: b.quiz.fen ?? fenAfter(b.quiz.moves ?? ""),
        options: order.map((i) => ({ label: say(b.quiz.options[i]!), ...(i === b.quiz.correct ? { correct: true } : {}) })),
        hint: say(b.quiz.hint),
        ...(d.side ? { side: d.side } : {}),
      });
    }
    else if ("move" in b) {
      const m = b.move;
      steps.push({ kind: "move", pose: "thinking", title: say(m.title), body: say(m.body), fen: m.fen, side: m.fen.split(" ")[1] === "b" ? "b" : "w", goal: { type: "exact", from: m.uci.slice(0, 2) as Square, to: m.uci.slice(2, 4) as Square }, hint: say(m.hint), hintSquares: [m.uci.slice(0, 2) as Square, m.uci.slice(2, 4) as Square] });
    } else if ("game" in b) steps.push({ kind: "game", pose: "happy", title: say(GAME.title), body: say(GAME.body), fen: fenAfter(b.game.moves), side: b.game.side, level: "pip", minMoves: 6 });
    else {
      // The learner plays `side`; every other move is the opponent's book reply, applied between steps.
      const { moves, side, beats } = b.line;
      const c = load(START_FEN);
      for (const san of (b.line.pre ?? "").split(/\s+/).filter(Boolean)) c.move(san);
      let i = 0;
      for (const san of moves.split(/\s+/).filter(Boolean)) {
        if (c.turn() === side) {
          const beat = beats[i++];
          if (!beat) throw new Error(`${d.id}: no beat for ${san}`);
          const fen = c.fen();
          const m = c.move(san);
          steps.push({ kind: "move", pose: "thinking", title: say(beat.title), body: say(beat.body), fen, side, goal: { type: "exact", from: m.from as Square, to: m.to as Square }, hint: say(beat.hint), hintSquares: [m.from as Square, m.to as Square] });
        } else c.move(san);
      }
      if (i !== beats.length) throw new Error(`${d.id}: ${beats.length - i} unused beats`);
    }
  }
  return steps;
}

const GAME: { title: L; body: L } = {
  title: ["Now play it out.", "अब खेलकर देखें।"],
  body: ["Keep asking the questions on every move. Play at least six moves.", "हर चाल पर वही सवाल पूछते रहें। कम से कम छह चालें खेलें।"],
};

const PLAN_QUIZ = (moves: string, correct: L, wrong: readonly [L, L], hint: L): Block => ({
  quiz: { title: ["What's the plan?", "योजना क्या है?"], body: ["After this opening, what should you aim for?", "इस ओपनिंग के बाद आपका लक्ष्य क्या होना चाहिए?"], moves, options: [correct, ...wrong], correct: 0, hint },
});

const UNITS: readonly { id: string; title: L; sub: L; lessons: readonly Def[] }[] = [
  {
    id: "think1",
    title: ["Part 1 · Opening thinking", "भाग 1 · ओपनिंग की सोच"],
    sub: ["The questions to ask on every early move", "शुरुआती हर चाल पर पूछे जाने वाले सवाल"],
    lessons: [
      {
        id: "thinkStart",
        title: ["Three questions every move", "हर चाल पर तीन सवाल"],
        sub: ["Centre, pieces, king", "केंद्र, मोहरे, राजा"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Think before you move.", "चलने से पहले सोचें।"], body: ["In the opening, ask three questions: Can I take the centre? Can I bring out a new piece? Is my king safe?", "ओपनिंग में तीन सवाल पूछें: क्या मैं केंद्र ले सकता हूँ? क्या नया मोहरा निकाल सकता हूँ? क्या मेरा राजा सुरक्षित है?"] } },
          {
            line: {
              side: "w",
              moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 O-O",
              beats: [
                { title: ["Question 1: the centre.", "सवाल 1: केंद्र।"], body: ["Push a centre pawn. e4 controls d5 and f5 and opens lines for your queen and bishop.", "बीच का प्यादा बढ़ाएँ। e4, d5 और f5 पर नज़र रखता है और रानी व ऊँट के रास्ते खोलता है।"], hint: ["Push the king's pawn two squares.", "राजा वाला प्यादा दो खाने बढ़ाएँ।"] },
                { title: ["Question 2: a new piece.", "सवाल 2: नया मोहरा।"], body: ["Black copied you. Bring out a piece that also attacks: the knight on f3 hits e5.", "काले ने वही किया। ऐसा मोहरा निकालें जो हमला भी करे: f3 का घोड़ा e5 पर वार करता है।"], hint: ["Knight from g1 to f3.", "घोड़ा g1 से f3 पर।"] },
                { title: ["Another piece.", "एक और मोहरा।"], body: ["Black defended e5. Develop the bishop to c4, where it aims at f7, the weak square near Black's king.", "काले ने e5 बचाया। ऊँट को c4 पर लाएँ, वहाँ से वह f7 को देखता है, जो काले राजा के पास कमज़ोर खाना है।"], hint: ["Bishop from f1 to c4.", "ऊँट f1 से c4 पर।"] },
                { title: ["Question 3: the king.", "सवाल 3: राजा।"], body: ["Your king is still in the middle. Castle now: the king hides, and the rook joins the game.", "आपका राजा अब भी बीच में है। अभी कैसलिंग करें: राजा छिप जाता है और हाथी खेल में आ जाता है।"], hint: ["Move the king two squares to the right.", "राजा को दाईं ओर दो खाने चलें।"] },
              ],
            },
          },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["Which move breaks the opening habits?", "कौन-सी चाल ओपनिंग की अच्छी आदतें तोड़ती है?"], options: [["Bringing the queen out on move 2", "दूसरी चाल में रानी निकालना"], ["Castling early", "जल्दी कैसलिंग"], ["Developing a knight", "घोड़ा निकालना"]], correct: 0, hint: ["An early queen gets chased by smaller pieces.", "जल्दी निकली रानी को छोटे मोहरे दौड़ाते हैं।"] } },
        ],
      },
      {
        id: "thinkReply",
        side: "b",
        title: ["After their move", "उनकी चाल के बाद"],
        sub: ["What changed? What does it attack?", "क्या बदला? वह किस पर हमला करती है?"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Their move first.", "पहले उनकी चाल।"], body: ["After every move your opponent makes, ask: what does it attack? Check their checks, captures and threats before your own plans.", "विरोधी की हर चाल के बाद पूछें: यह किस पर हमला करती है? अपनी योजना से पहले उनकी शह, मार और खतरे देखें।"], moves: "e4 e5 Bc4 Nc6 Qh5" } },
          {
            line: {
              side: "b",
              pre: "e4 e5 Bc4 Nc6",
              moves: "Qh5 g6 Qf3 Nf6",
              beats: [
                { title: ["The queen came out.", "रानी बाहर आई।"], body: ["White's queen hits f7 (mate with the bishop!) and e5. Block with g6, which also attacks the queen.", "सफ़ेद रानी f7 (ऊँट के साथ मात!) और e5 पर वार करती है। g6 से रोकें, यह रानी पर हमला भी करता है।"], hint: ["Push the g-pawn one square.", "g-प्यादा एक खाना बढ़ाएँ।"] },
                { title: ["Again: what does it attack?", "फिर: किस पर हमला है?"], body: ["The queen moved to f3 and aims at f7 again. Block the line with your knight, developing at the same time.", "रानी f3 पर आकर फिर f7 को देख रही है। घोड़े से रास्ता रोकें, साथ में मोहरा भी निकल जाता है।"], hint: ["Knight from g8 to f6.", "घोड़ा g8 से f6 पर।"] },
              ],
            },
          },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["Your opponent just moved. What do you look at first?", "विरोधी ने अभी चाल चली। आप पहले क्या देखेंगे?"], options: [["What their move attacks", "उनकी चाल किस पर हमला करती है"], ["Where my favourite piece can go", "मेरा पसंदीदा मोहरा कहाँ जा सकता है"], ["How fast I can attack", "मैं कितनी जल्दी हमला कर सकता हूँ"]], correct: 0, hint: ["Safety first, then plans.", "पहले सुरक्षा, फिर योजना।"] } },
        ],
      },
    ],
  },
  {
    id: "think2",
    title: ["Part 2 · Openings for White", "भाग 2 · सफ़ेद की ओपनिंग"],
    sub: ["Italian, Ruy Lopez, Queen's Gambit, London", "इटैलियन, रुई लोपेज़, क्वीन्स गैम्बिट, लंदन"],
    lessons: [
      {
        id: "thinkItalian",
        title: ["The Italian Game", "इटैलियन गेम"],
        sub: ["Quick pieces, then d4", "जल्दी मोहरे, फिर d4"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The Italian Game.", "इटैलियन गेम।"], body: ["A calm, classical start: centre pawn, knight, bishop to c4, castle. Then a slow push in the centre.", "एक शांत, पुरानी शुरुआत: बीच का प्यादा, घोड़ा, ऊँट c4 पर, कैसलिंग। फिर केंद्र में धीरे से बढ़त।"] } },
          {
            line: {
              side: "w",
              moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O",
              beats: [
                { title: ["Take the centre.", "केंद्र लें।"], body: ["Start with e4: it grabs the centre and opens lines.", "e4 से शुरू करें: यह केंद्र लेता है और रास्ते खोलता है।"], hint: ["The king's pawn, two squares.", "राजा वाला प्यादा, दो खाने।"] },
                { title: ["Develop with a threat.", "खतरे के साथ मोहरा निकालें।"], body: ["Black answered e5. Your knight on f3 attacks it.", "काले ने e5 खेला। f3 का घोड़ा उस पर हमला करता है।"], hint: ["Knight g1 to f3.", "घोड़ा g1 से f3।"] },
                { title: ["The best diagonal.", "सबसे अच्छी तिरछी रेखा।"], body: ["Black defended with Nc6. Your bishop on c4 aims at f7.", "काले ने Nc6 से बचाया। c4 का ऊँट f7 को देखता है।"], hint: ["Bishop f1 to c4.", "ऊँट f1 से c4।"] },
                { title: ["Prepare d4.", "d4 की तैयारी।"], body: ["Black's bishop mirrors yours. c3 gets ready to push d4 with support.", "काले का ऊँट आपके जैसा है। c3, सहारे के साथ d4 बढ़ाने की तैयारी है।"], hint: ["The c-pawn, one square.", "c-प्यादा, एक खाना।"] },
                { title: ["Defend calmly.", "शांति से बचाएँ।"], body: ["Black's knight attacks e4. Protect it with d3, solid and safe.", "काले का घोड़ा e4 पर हमला करता है। d3 से बचाएँ, मज़बूत और सुरक्षित।"], hint: ["The d-pawn, one square.", "d-प्यादा, एक खाना।"] },
                { title: ["Finish the opening.", "ओपनिंग पूरी करें।"], body: ["Black is solid too. Castle: king safe, rook ready. Now you can make plans.", "काला भी मज़बूत है। कैसलिंग करें: राजा सुरक्षित, हाथी तैयार। अब योजना बनाएँ।"], hint: ["King two squares to the right.", "राजा दाईं ओर दो खाने।"] },
              ],
            },
          },
          PLAN_QUIZ("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O", ["Push d4 later to win the centre", "बाद में d4 बढ़ाकर केंद्र जीतना"], [["Walk the king to the middle", "राजा को बीच में ले जाना"], ["Trade queens straight away", "तुरंत रानियाँ बदलना"]], ["Why did you play c3?", "आपने c3 क्यों खेला?"]),
          { game: { moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O", side: "w" } },
        ],
      },
      {
        id: "thinkRuy",
        title: ["The Ruy Lopez", "रुई लोपेज़"],
        sub: ["Press the defender of e5", "e5 के रक्षक पर दबाव"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The Ruy Lopez.", "रुई लोपेज़।"], body: ["Instead of aiming at f7, the bishop goes to b5 and attacks the knight that defends e5. Slow pressure, played by world champions.", "f7 की जगह ऊँट b5 पर जाकर उस घोड़े पर हमला करता है जो e5 बचाता है। धीमा दबाव, जिसे विश्व चैंपियन खेलते हैं।"] } },
          {
            line: {
              side: "w",
              moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1",
              beats: [
                { title: ["Take the centre.", "केंद्र लें।"], body: ["Start with e4.", "e4 से शुरू करें।"], hint: ["The king's pawn, two squares.", "राजा वाला प्यादा, दो खाने।"] },
                { title: ["Attack e5.", "e5 पर हमला।"], body: ["Black played e5. Hit it with your knight.", "काले ने e5 खेला। घोड़े से उस पर वार करें।"], hint: ["Knight g1 to f3.", "घोड़ा g1 से f3।"] },
                { title: ["Attack the defender.", "रक्षक पर हमला।"], body: ["Black's knight defends e5. Put pressure on that knight with Bb5.", "काले का घोड़ा e5 बचाता है। Bb5 से उस घोड़े पर दबाव डालें।"], hint: ["Bishop f1 to b5.", "ऊँट f1 से b5।"] },
                { title: ["Keep the pressure.", "दबाव बनाए रखें।"], body: ["Black asks the bishop with a6. Step back to a4: it still eyes c6.", "काले ने a6 से ऊँट को हटाने को कहा। a4 पर पीछे हटें: वह अब भी c6 देखता है।"], hint: ["Bishop b5 to a4.", "ऊँट b5 से a4।"] },
                { title: ["King first.", "पहले राजा।"], body: ["Black's knight now hits e4. Castle anyway: your king gets safe and the rook can defend e4 next.", "काले का घोड़ा अब e4 पर वार करता है। फिर भी कैसलिंग करें: राजा सुरक्षित होता है और हाथी अगली चाल में e4 बचा सकता है।"], hint: ["King two squares to the right.", "राजा दाईं ओर दो खाने।"] },
                { title: ["Rook to the centre.", "हाथी केंद्र में।"], body: ["Black develops. Guard e4 with the rook; next come c3 and d4.", "काला मोहरा निकालता है। हाथी से e4 बचाएँ; आगे c3 और d4 आते हैं।"], hint: ["Rook f1 to e1.", "हाथी f1 से e1।"] },
              ],
            },
          },
          PLAN_QUIZ("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1", ["Play c3 and d4 for a big centre", "c3 और d4 से बड़ा केंद्र बनाना"], [["Give up the bishop for nothing", "बिना वजह ऊँट गँवाना"], ["Push the h-pawn at once", "तुरंत h-प्यादा बढ़ाना"]], ["The rook on e1 supports the centre.", "e1 का हाथी केंद्र को सहारा देता है।"]),
          { game: { moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5", side: "w" } },
        ],
      },
      {
        id: "thinkQueensGambit",
        title: ["The Queen's Gambit", "क्वीन्स गैम्बिट"],
        sub: ["Fight for d5 from the side", "किनारे से d5 के लिए लड़ें"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The Queen's Gambit.", "क्वीन्स गैम्बिट।"], body: ["Start with the d-pawn, then offer the c-pawn to pull Black's d5 pawn away. Then pile up on d5 and develop.", "पहले d-प्यादा, फिर c-प्यादा पेश करें ताकि काले का d5 प्यादा हटे। फिर d5 पर दबाव बढ़ाएँ और मोहरे निकालें।"] } },
          {
            line: {
              side: "w",
              moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3",
              beats: [
                { title: ["A solid centre.", "मज़बूत केंद्र।"], body: ["Start with d4. The queen already guards it.", "d4 से शुरू करें। रानी पहले से इसे बचाती है।"], hint: ["The queen's pawn, two squares.", "रानी वाला प्यादा, दो खाने।"] },
                { title: ["The gambit.", "गैम्बिट।"], body: ["Black mirrors you. c4 attacks d5. If Black takes, you can win the pawn back.", "काला आपके जैसा खेलता है। c4, d5 पर हमला करता है। काला ले भी ले, तो आप प्यादा वापस जीत सकते हैं।"], hint: ["The c-pawn, two squares.", "c-प्यादा, दो खाने।"] },
                { title: ["Another attacker.", "एक और हमलावर।"], body: ["Black holds d5 with e6. Add the knight on c3, which also hits d5.", "काले ने e6 से d5 थामा। c3 पर घोड़ा लाएँ, वह भी d5 पर वार करता है।"], hint: ["Knight b1 to c3.", "घोड़ा b1 से c3।"] },
                { title: ["Pin the defender.", "रक्षक को पिन करें।"], body: ["Black's knight on f6 defends d5. Pin it to the queen with Bg5.", "f6 का काला घोड़ा d5 बचाता है। Bg5 से उसे रानी के साथ पिन करें।"], hint: ["Bishop c1 to g5.", "ऊँट c1 से g5।"] },
                { title: ["Open the other bishop.", "दूसरे ऊँट का रास्ता खोलें।"], body: ["Black unpinned with Be7. e3 opens a road for your light bishop.", "काले ने Be7 से पिन हटाया। e3 आपके हल्के ऊँट का रास्ता खोलता है।"], hint: ["The e-pawn, one square.", "e-प्यादा, एक खाना।"] },
                { title: ["Last knight out.", "आख़िरी घोड़ा बाहर।"], body: ["Black castled. Bring the last knight out; you'll castle next.", "काले ने कैसलिंग की। आख़िरी घोड़ा निकालें; अगली चाल कैसलिंग।"], hint: ["Knight g1 to f3.", "घोड़ा g1 से f3।"] },
              ],
            },
          },
          PLAN_QUIZ("d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3", ["Keep pressure on d5 and castle", "d5 पर दबाव रखना और कैसलिंग करना"], [["Push the f-pawn and attack at once", "तुरंत f-प्यादा बढ़ाकर हमला"], ["Move the queen every turn", "हर चाल रानी चलाना"]], ["Count the pieces aiming at d5.", "d5 पर निशाना लगाए मोहरे गिनें।"]),
          { game: { moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7", side: "w" } },
        ],
      },
      {
        id: "thinkLondon",
        title: ["The London System", "लंदन सिस्टम"],
        sub: ["One setup against almost anything", "लगभग हर जवाब पर एक ही ढाँचा"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The London System.", "लंदन सिस्टम।"], body: ["d4, bishop to f4, then e3, Nf3, c3 and Nbd2. The same easy setup works against most replies.", "d4, ऊँट f4 पर, फिर e3, Nf3, c3 और Nbd2। यही आसान ढाँचा ज़्यादातर जवाबों पर चलता है।"] } },
          {
            line: {
              side: "w",
              moves: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2",
              beats: [
                { title: ["The centre pawn.", "बीच का प्यादा।"], body: ["Start with d4.", "d4 से शुरू करें।"], hint: ["The queen's pawn, two squares.", "रानी वाला प्यादा, दो खाने।"] },
                { title: ["Bishop out first.", "पहले ऊँट बाहर।"], body: ["Black matches you. Bring the dark bishop to f4 before e3, so it isn't locked in.", "काला बराबरी करता है। e3 से पहले काले खानों वाला ऊँट f4 पर लाएँ, ताकि वह अंदर बंद न हो।"], hint: ["Bishop c1 to f4.", "ऊँट c1 से f4।"] },
                { title: ["Now e3.", "अब e3।"], body: ["The bishop is already outside, so e3 is safe and supports d4.", "ऊँट पहले ही बाहर है, इसलिए e3 सुरक्षित है और d4 को सहारा देता है।"], hint: ["The e-pawn, one square.", "e-प्यादा, एक खाना।"] },
                { title: ["Knight to the centre.", "घोड़ा केंद्र की ओर।"], body: ["Black is solid. Develop the knight to f3.", "काला मज़बूत है। घोड़ा f3 पर निकालें।"], hint: ["Knight g1 to f3.", "घोड़ा g1 से f3।"] },
                { title: ["Support d4.", "d4 को सहारा।"], body: ["Black hits d4 with c5. c3 keeps your pawn triangle strong.", "काले ने c5 से d4 पर वार किया। c3 आपके प्यादों का त्रिकोण मज़बूत रखता है।"], hint: ["The c-pawn, one square.", "c-प्यादा, एक खाना।"] },
                { title: ["The other knight.", "दूसरा घोड़ा।"], body: ["Black adds a knight. Yours goes to d2, since c3 is taken by the pawn.", "काले ने घोड़ा जोड़ा। आपका d2 पर जाता है, क्योंकि c3 पर प्यादा है।"], hint: ["Knight b1 to d2.", "घोड़ा b1 से d2।"] },
              ],
            },
          },
          PLAN_QUIZ("d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2", ["Finish with Bd3 and castle, then attack on the kingside", "Bd3 और कैसलिंग, फिर राजा की तरफ़ हमला"], [["Trade every piece quickly", "जल्दी सब मोहरे बदलना"], ["Leave the king in the centre", "राजा को बीच में छोड़ना"]], ["One bishop and the king are still at home.", "एक ऊँट और राजा अब भी घर पर हैं।"]),
          { game: { moves: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6", side: "w" } },
        ],
      },
    ],
  },
  {
    id: "think3",
    title: ["Part 3 · Openings for Black", "भाग 3 · काले की ओपनिंग"],
    sub: ["Sicilian, French, Caro-Kann, King's Indian", "सिसिलियन, फ़्रेंच, कारो-कान, किंग्स इंडियन"],
    lessons: [
      {
        id: "thinkSicilian",
        side: "b",
        title: ["The Sicilian Defence", "सिसिलियन डिफ़ेंस"],
        sub: ["An unbalanced fight against e4", "e4 के ख़िलाफ़ असंतुलित लड़ाई"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The Sicilian.", "सिसिलियन।"], body: ["You play Black. Against e4, c5 fights for d4 from the side. You trade a side pawn for a centre pawn and get a sharp game.", "आप काले हैं। e4 के ख़िलाफ़ c5 किनारे से d4 के लिए लड़ता है। आप किनारे का प्यादा देकर बीच का प्यादा लेते हैं और तेज़ खेल पाते हैं।"], moves: "e4" } },
          {
            line: {
              side: "b",
              moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
              beats: [
                { title: ["Fight for d4.", "d4 के लिए लड़ें।"], body: ["White took the centre with e4. Answer with c5.", "सफ़ेद ने e4 से केंद्र लिया। c5 से जवाब दें।"], hint: ["The c-pawn, two squares.", "c-प्यादा, दो खाने।"] },
                { title: ["Guard e5.", "e5 पर पहरा।"], body: ["White's knight came out. d6 keeps it off e5 and frees your light bishop.", "सफ़ेद घोड़ा निकला। d6 उसे e5 से दूर रखता है और हल्के ऊँट का रास्ता खोलता है।"], hint: ["The d-pawn, one square.", "d-प्यादा, एक खाना।"] },
                { title: ["Take it.", "ले लें।"], body: ["White opens the centre with d4. Take: a side pawn for a centre pawn.", "सफ़ेद ने d4 से केंद्र खोला। ले लें: किनारे का प्यादा देकर बीच का।"], hint: ["Your c-pawn takes on d4.", "आपका c-प्यादा d4 पर मारता है।"] },
                { title: ["Develop with a threat.", "खतरे के साथ मोहरा।"], body: ["White recaptured. Your knight on f6 attacks e4.", "सफ़ेद ने वापस मारा। f6 का घोड़ा e4 पर हमला करता है।"], hint: ["Knight g8 to f6.", "घोड़ा g8 से f6।"] },
                { title: ["A useful little move.", "एक काम की छोटी चाल।"], body: ["White defended e4. a6 keeps White's pieces off b5 and prepares e5 or b5.", "सफ़ेद ने e4 बचाया। a6, सफ़ेद मोहरों को b5 से दूर रखता है और e5 या b5 की तैयारी करता है।"], hint: ["The a-pawn, one square.", "a-प्यादा, एक खाना।"] },
              ],
            },
          },
          PLAN_QUIZ("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", ["Develop, castle, and attack on the queenside", "मोहरे निकालें, कैसलिंग करें, रानी की तरफ़ हमला"], [["Push the h-pawn to h5", "h-प्यादा h5 तक बढ़ाना"], ["Bring the king to d7", "राजा को d7 पर लाना"]], ["The open c-file is yours.", "खुली c-फ़ाइल आपकी है।"]),
          { game: { moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2", side: "b" } },
        ],
      },
      {
        id: "thinkFrench",
        side: "b",
        title: ["The French Defence", "फ़्रेंच डिफ़ेंस"],
        sub: ["Solid first, strike back later", "पहले मज़बूती, फिर पलटवार"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The French.", "फ़्रेंच।"], body: ["You play Black. e6 prepares d5 so your centre pawn is always supported. The game often closes, and you strike back with c5 or f6.", "आप काले हैं। e6, d5 की तैयारी करता है, ताकि बीच का प्यादा हमेशा सुरक्षित रहे। खेल अक्सर बंद होता है, और आप c5 या f6 से पलटवार करते हैं।"], moves: "e4" } },
          {
            line: {
              side: "b",
              moves: "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7",
              beats: [
                { title: ["Prepare d5.", "d5 की तैयारी।"], body: ["White took the centre. e6 first, so d5 will be supported.", "सफ़ेद ने केंद्र लिया। पहले e6, ताकि d5 को सहारा मिले।"], hint: ["The e-pawn, one square.", "e-प्यादा, एक खाना।"] },
                { title: ["Strike e4.", "e4 पर वार।"], body: ["White adds d4. Now d5 hits e4, and e6 protects it.", "सफ़ेद ने d4 जोड़ा। अब d5, e4 पर वार करता है, और e6 उसे बचाता है।"], hint: ["The d-pawn, two squares.", "d-प्यादा, दो खाने।"] },
                { title: ["Attack again.", "फिर हमला।"], body: ["White defended with Nc3. Your knight on f6 attacks e4 too.", "सफ़ेद ने Nc3 से बचाया। f6 का घोड़ा भी e4 पर हमला करता है।"], hint: ["Knight g8 to f6.", "घोड़ा g8 से f6।"] },
                { title: ["Break the pin.", "पिन तोड़ें।"], body: ["White pins your knight. Be7 unpins and develops.", "सफ़ेद ने आपका घोड़ा पिन किया। Be7 पिन हटाता है और मोहरा भी निकलता है।"], hint: ["Bishop f8 to e7.", "ऊँट f8 से e7।"] },
                { title: ["Step back, strike later.", "पीछे हटें, बाद में वार।"], body: ["White pushed e5 at your knight. Retreat to d7, ready for c5 and f6.", "सफ़ेद ने e5 बढ़ाकर घोड़े पर वार किया। d7 पर हटें, c5 और f6 के लिए तैयार।"], hint: ["The f6 knight goes to d7.", "f6 का घोड़ा d7 पर।"] },
              ],
            },
          },
          PLAN_QUIZ("e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7", ["Break the pawn chain with c5 and f6", "c5 और f6 से प्यादों की कड़ी तोड़ना"], [["Wait and never move a pawn", "रुके रहना, कोई प्यादा न चलाना"], ["Bring the queen to h4 at once", "तुरंत रानी h4 पर लाना"]], ["Closed centre: use pawn breaks.", "बंद केंद्र: प्यादों से रास्ता खोलें।"]),
          { game: { moves: "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 h4", side: "b" } },
        ],
      },
      {
        id: "thinkCaroKann",
        side: "b",
        title: ["The Caro-Kann", "कारो-कान"],
        sub: ["Solid, with a free bishop", "मज़बूत, और ऊँट आज़ाद"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The Caro-Kann.", "कारो-कान।"], body: ["You play Black. c6 prepares d5 like the French, but your light bishop stays free to come out.", "आप काले हैं। फ़्रेंच की तरह c6, d5 की तैयारी करता है, लेकिन आपका हल्का ऊँट बाहर आने को आज़ाद रहता है।"], moves: "e4" } },
          {
            line: {
              side: "b",
              moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6",
              beats: [
                { title: ["Prepare d5.", "d5 की तैयारी।"], body: ["Against e4, play c6.", "e4 के ख़िलाफ़ c6 खेलें।"], hint: ["The c-pawn, one square.", "c-प्यादा, एक खाना।"] },
                { title: ["Challenge the centre.", "केंद्र को चुनौती।"], body: ["White adds d4. Hit e4 with d5.", "सफ़ेद ने d4 जोड़ा। d5 से e4 पर वार करें।"], hint: ["The d-pawn, two squares.", "d-प्यादा, दो खाने।"] },
                { title: ["Clear the centre.", "केंद्र साफ़ करें।"], body: ["White defended with Nc3. Take on e4.", "सफ़ेद ने Nc3 से बचाया। e4 पर मारें।"], hint: ["Your d-pawn takes e4.", "आपका d-प्यादा e4 पर मारता है।"] },
                { title: ["The free bishop.", "आज़ाद ऊँट।"], body: ["White's knight recaptured. Bf5 develops outside your pawns and hits the knight.", "सफ़ेद घोड़े ने वापस मारा। Bf5 प्यादों के बाहर निकलता है और घोड़े पर वार करता है।"], hint: ["Bishop c8 to f5.", "ऊँट c8 से f5।"] },
                { title: ["Keep the diagonal.", "तिरछी रेखा रखें।"], body: ["The knight attacks your bishop. Step back to g6; it keeps the good diagonal.", "घोड़ा आपके ऊँट पर हमला करता है। g6 पर हटें; अच्छी रेखा बनी रहती है।"], hint: ["Bishop f5 to g6.", "ऊँट f5 से g6।"] },
              ],
            },
          },
          PLAN_QUIZ("e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6", ["Develop with e6, Nf6 and castle: solid and safe", "e6, Nf6 और कैसलिंग: मज़बूत और सुरक्षित"], [["Trade the bishop for nothing", "बिना वजह ऊँट बदलना"], ["Push the g-pawn to g4", "g-प्यादा g4 तक बढ़ाना"]], ["Finish developing first.", "पहले मोहरे पूरे निकालें।"]),
          { game: { moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4", side: "b" } },
        ],
      },
      {
        id: "thinkKingsIndian",
        side: "b",
        title: ["The King's Indian", "किंग्स इंडियन"],
        sub: ["Let White build, then hit back", "सफ़ेद को बनाने दें, फिर पलटवार"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["The King's Indian.", "किंग्स इंडियन।"], body: ["You play Black against d4. Let White build a big centre, hide your king behind a fianchettoed bishop, then strike with e5 or c5.", "आप d4 के ख़िलाफ़ काले हैं। सफ़ेद को बड़ा केंद्र बनाने दें, राजा को फ़ियानकेटो ऊँट के पीछे छिपाएँ, फिर e5 या c5 से वार करें।"], moves: "d4" } },
          {
            line: {
              side: "b",
              moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O",
              beats: [
                { title: ["A flexible knight.", "लचीला घोड़ा।"], body: ["Against d4, Nf6 watches e4 and d5.", "d4 के ख़िलाफ़ Nf6, e4 और d5 पर नज़र रखता है।"], hint: ["Knight g8 to f6.", "घोड़ा g8 से f6।"] },
                { title: ["Prepare the fianchetto.", "फ़ियानकेटो की तैयारी।"], body: ["White adds c4. g6 makes room for the bishop on g7.", "सफ़ेद ने c4 जोड़ा। g6, ऊँट के लिए g7 पर जगह बनाता है।"], hint: ["The g-pawn, one square.", "g-प्यादा, एक खाना।"] },
                { title: ["The long diagonal.", "लंबी तिरछी रेखा।"], body: ["White's knight comes out. Your bishop on g7 aims at White's centre.", "सफ़ेद घोड़ा निकला। g7 का ऊँट सफ़ेद केंद्र को निशाना बनाता है।"], hint: ["Bishop f8 to g7.", "ऊँट f8 से g7।"] },
                { title: ["Let them build.", "उन्हें बनाने दें।"], body: ["White builds a big centre with e4. d6 stops e5; you'll hit back later.", "सफ़ेद ने e4 से बड़ा केंद्र बनाया। d6, e5 को रोकता है; आप बाद में वार करेंगे।"], hint: ["The d-pawn, one square.", "d-प्यादा, एक खाना।"] },
                { title: ["King to safety.", "राजा सुरक्षित।"], body: ["Castle: your king hides behind the bishop. Next, strike with e5.", "कैसलिंग करें: राजा ऊँट के पीछे छिपता है। फिर e5 से वार करें।"], hint: ["King two squares towards the rook on h8.", "राजा h8 के हाथी की ओर दो खाने।"] },
              ],
            },
          },
          PLAN_QUIZ("d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O", ["Strike White's centre with e5 or c5", "e5 या c5 से सफ़ेद केंद्र पर वार"], [["Never touch the centre", "केंद्र को कभी न छूना"], ["Trade the g7 bishop at once", "तुरंत g7 का ऊँट बदलना"]], ["A big centre is also a target.", "बड़ा केंद्र निशाना भी होता है।"]),
          { game: { moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2", side: "b" } },
        ],
      },
    ],
  },
  {
    id: "think4",
    title: ["Part 4 · Middlegame thinking", "भाग 4 · मिडिलगेम की सोच"],
    sub: ["Make a plan, attack, defend", "योजना, हमला, बचाव"],
    lessons: [
      {
        id: "thinkPlan",
        title: ["Your move checklist", "आपकी चाल की सूची"],
        sub: ["Threats, then forcing moves, then a plan", "खतरे, फिर ज़बरदस्त चालें, फिर योजना"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["A checklist for every move.", "हर चाल के लिए सूची।"], body: ["1: What does their move threaten? 2: Do I have a check, capture or threat? 3: If not, improve my worst piece.", "1: उनकी चाल से क्या खतरा है? 2: क्या मेरे पास शह, मार या खतरा है? 3: नहीं, तो अपना सबसे कमज़ोर मोहरा बेहतर करें।"], moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O" } },
          { quiz: { title: ["Nothing is attacked.", "किसी पर हमला नहीं।"], body: ["No threats, no checks, no captures. What now?", "न खतरा, न शह, न मार। अब क्या?"], moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O", options: [["Improve my worst piece", "अपना सबसे कमज़ोर मोहरा बेहतर करना"], ["Push any pawn", "कोई भी प्यादा बढ़ाना"], ["Move the king again", "राजा फिर से चलाना"]], correct: 0, hint: ["Which piece hasn't moved yet?", "कौन-सा मोहरा अब तक नहीं चला?"] } },
          { move: { title: ["Your worst piece.", "सबसे कमज़ोर मोहरा।"], body: ["The bishop on c1 has not moved. Bring it to g5, where it pins the knight.", "c1 का ऊँट अब तक नहीं चला। उसे g5 पर लाएँ, वहाँ वह घोड़े को पिन करता है।"], hint: ["Bishop c1 to g5.", "ऊँट c1 से g5।"], fen: fenAfter("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O"), uci: "c1g5" } },
        ],
      },
      {
        id: "thinkAttack",
        title: ["Think like an attacker", "हमलावर की तरह सोचें"],
        sub: ["When and how to go for the king", "राजा पर कब और कैसे जाएँ"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["When to attack.", "हमला कब करें।"], body: ["Attack when their king is stuck in the centre or its pawns are weak, and more of your pieces are close to it than theirs.", "हमला तब करें जब उनका राजा बीच में फँसा हो या उसके प्यादे कमज़ोर हों, और उसके पास उनके मोहरों से ज़्यादा आपके मोहरे हों।"], moves: "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6" } },
          {
            line: {
              side: "w",
              pre: "e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6",
              moves: "Nxe5 Bxd1 Bxf7+ Ke7 Nd5#",
              beats: [
                { title: ["Pieces beat material.", "मोहरे सामग्री से ज़्यादा।"], body: ["Black's king is in the centre and f7 is weak. Take e5, even though your queen hangs.", "काला राजा बीच में है और f7 कमज़ोर है। e5 पर मारें, भले ही रानी खुली रहे।"], hint: ["The f3 knight takes on e5.", "f3 का घोड़ा e5 पर मारता है।"] },
                { title: ["Check!", "शह!"], body: ["Black took your queen. Now every piece attacks: check on f7.", "काले ने आपकी रानी ले ली। अब हर मोहरा हमला करता है: f7 पर शह।"], hint: ["The bishop takes on f7.", "ऊँट f7 पर मारता है।"] },
                { title: ["Finish it.", "ख़त्म करें।"], body: ["The king had to step to e7. One knight move is checkmate.", "राजा को e7 पर जाना पड़ा। घोड़े की एक चाल से मात।"], hint: ["The c3 knight jumps to d5.", "c3 का घोड़ा d5 पर कूदता है।"] },
              ],
            },
          },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["When should you attack the king?", "राजा पर हमला कब करना चाहिए?"], options: [["When it's stuck or weak and your pieces are close", "जब वह फँसा या कमज़ोर हो और आपके मोहरे पास हों"], ["Always, from the first move", "हमेशा, पहली चाल से"], ["Only when you're a piece up", "सिर्फ़ जब आप एक मोहरा आगे हों"]], correct: 0, hint: ["Count the pieces near the king.", "राजा के पास के मोहरे गिनें।"] } },
        ],
      },
      {
        id: "thinkDefend",
        side: "b",
        title: ["Think like a defender", "रक्षक की तरह सोचें"],
        sub: ["Find the threat, then add defenders", "खतरा पहचानें, फिर रक्षक जोड़ें"],
        minutes: 5,
        xp: 25,
        blocks: [
          { say: { title: ["Defend calmly.", "शांति से बचाव।"], body: ["Name the exact threat. Then: add a defender, trade an attacker, or move away. Count attackers and defenders.", "सही खतरा पहचानें। फिर: रक्षक जोड़ें, हमलावर बदलें, या हट जाएँ। हमलावर और रक्षक गिनें।"], moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 O-O d6 Ng5" } },
          {
            line: {
              side: "b",
              pre: "e4 e5 Nf3 Nc6 Bc4 Bc5 O-O d6",
              moves: "Ng5 Nh6 Qh5 O-O",
              beats: [
                { title: ["Two attackers on f7.", "f7 पर दो हमलावर।"], body: ["White's knight and bishop both hit f7. Add a defender: Nh6 guards it.", "सफ़ेद घोड़ा और ऊँट दोनों f7 पर वार करते हैं। रक्षक जोड़ें: Nh6 उसे बचाता है।"], hint: ["Knight g8 to h6.", "घोड़ा g8 से h6।"] },
                { title: ["Now three.", "अब तीन।"], body: ["The queen joins. Castle: king and rook both guard f7, and your king leaves the centre.", "रानी भी आ गई। कैसलिंग करें: राजा और हाथी दोनों f7 बचाते हैं, और राजा बीच से निकल जाता है।"], hint: ["King two squares to the right.", "राजा दाईं ओर दो खाने।"] },
              ],
            },
          },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["You're under attack. What comes first?", "आप पर हमला है। सबसे पहले क्या?"], options: [["Find exactly what they threaten", "ठीक-ठीक पता करें कि खतरा क्या है"], ["Attack somewhere else and hope", "कहीं और हमला करके उम्मीद करें"], ["Move the queen anywhere", "रानी को कहीं भी चलाएँ"]], correct: 0, hint: ["You can't stop a threat you haven't seen.", "जो खतरा देखा नहीं, उसे रोक नहीं सकते।"] } },
        ],
      },
      {
        id: "thinkOpenClosed",
        title: ["Open or closed?", "खुला या बंद?"],
        sub: ["Which pieces and plans fit the position", "किस स्थिति में कौन-से मोहरे और योजना"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Open position.", "खुली स्थिति।"], body: ["Centre pawns are traded and lines are open. Bishops and rooks love it: develop fast and look for attacks.", "बीच के प्यादे बदल चुके हैं और रास्ते खुले हैं। ऊँट और हाथी को यह पसंद है: जल्दी मोहरे निकालें और हमले देखें।"], moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nxd4 Qxd4" } },
          { say: { title: ["Closed position.", "बंद स्थिति।"], body: ["Pawns are locked in the centre. Knights shine and plans are slower: open lines with a pawn break.", "बीच में प्यादे अटके हैं। घोड़े चमकते हैं और योजनाएँ धीमी होती हैं: प्यादे से रास्ता खोलें।"], moves: "e4 e6 d4 d5 e5" } },
          { line: { side: "b", pre: "e4 e6 d4 d5", moves: "e5 c5", beats: [{ title: ["Break the chain.", "कड़ी तोड़ें।"], body: ["The centre is locked. Hit the base of White's pawn chain with c5.", "केंद्र बंद है। c5 से सफ़ेद प्यादों की कड़ी की जड़ पर वार करें।"], hint: ["The c-pawn, two squares.", "c-प्यादा, दो खाने।"] }] } },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["Which pieces usually do best in an open position?", "खुली स्थिति में आम तौर पर कौन-से मोहरे अच्छे रहते हैं?"], options: [["Bishops and rooks", "ऊँट और हाथी"], ["Knights", "घोड़े"], ["The king", "राजा"]], correct: 0, hint: ["Long open lines suit long-range pieces.", "लंबे खुले रास्ते दूर तक चलने वाले मोहरों को पसंद हैं।"] } },
        ],
      },
    ],
  },
  {
    id: "think5",
    title: ["Part 5 · Endgame thinking", "भाग 5 · एंडगेम की सोच"],
    sub: ["Switch gears when the queens come off", "रानियाँ हटें तो सोच बदलें"],
    lessons: [
      {
        id: "thinkEndgame",
        title: ["The endgame switch", "एंडगेम में बदलाव"],
        sub: ["Active king, push passed pawns", "सक्रिय राजा, आगे बढ़ते प्यादे"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Switch modes.", "सोच बदलें।"], body: ["With queens off and few pieces left, your king becomes a fighter, and every passed pawn wants to become a queen.", "रानियाँ हट जाएँ और कम मोहरे बचें, तो राजा लड़ाका बन जाता है, और हर आगे बढ़ा प्यादा रानी बनना चाहता है।"], fen: "8/5k2/8/3p4/3P4/8/5K2/8 w - - 0 1" } },
          { move: { title: ["King to the centre.", "राजा केंद्र में।"], body: ["Bring your king towards the middle first. Every move counts.", "पहले अपने राजा को बीच की ओर लाएँ। हर चाल मायने रखती है।"], hint: ["King f2 to e3.", "राजा f2 से e3।"], fen: "8/5k2/8/3p4/3P4/8/5K2/8 w - - 0 1", uci: "f2e3" } },
          { move: { title: ["Run, pawn, run.", "दौड़ो, प्यादे, दौड़ो।"], body: ["Black's king is far away. Push your passed pawn, using the double step.", "काला राजा दूर है। अपना आगे बढ़ा प्यादा दोहरे कदम से बढ़ाएँ।"], hint: ["The g-pawn, two squares.", "g-प्यादा, दो खाने।"], fen: "8/8/8/8/k7/8/6P1/6K1 w - - 0 1", uci: "g2g4" } },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["In the endgame, your king should…", "एंडगेम में आपका राजा…"], fen: "8/5k2/8/3p4/3P4/4K3/8/8 b - - 1 1", options: [["Come to the centre and fight", "केंद्र में आकर लड़े"], ["Hide in the corner", "कोने में छिपे"], ["Stay on its first square", "अपने पहले खाने पर रहे"]], correct: 0, hint: ["Few pieces left means little danger.", "कम मोहरे, यानी कम खतरा।"] } },
        ],
      },
      {
        id: "thinkConvert",
        title: ["Ahead? Trade pieces", "आगे हैं? मोहरे बदलें"],
        sub: ["Make your extra material count", "अपनी बढ़त को काम में लाएँ"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Trade when ahead.", "आगे हों तो बदलें।"], body: ["When you're ahead, trade pieces, not pawns. Every trade makes your extra pawn count more.", "जब आप आगे हों, मोहरे बदलें, प्यादे नहीं। हर बदलाव आपके अतिरिक्त प्यादे को और कीमती बनाता है।"], fen: "3r2k1/5pp1/7p/8/8/8/4PPPP/3R2K1 w - - 0 1" } },
          { move: { title: ["Offer the trade.", "बदलाव पेश करें।"], body: ["You have an extra pawn. Take the rook on d8; after the trade, the pawn ending is yours.", "आपके पास एक प्यादा ज़्यादा है। d8 पर हाथी मारें; बदलाव के बाद प्यादों का एंडगेम आपका है।"], hint: ["Your rook takes on d8.", "आपका हाथी d8 पर मारता है।"], fen: "3r2k1/5pp1/7p/8/8/8/4PPPP/3R2K1 w - - 0 1", uci: "d1d8" } },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["You're a pawn up. Which trade helps you most?", "आप एक प्यादा आगे हैं। कौन-सा बदलाव सबसे ज़्यादा मदद करता है?"], fen: "3R2k1/5pp1/7p/8/8/8/4PPPP/6K1 b - - 0 1", options: [["Trading pieces", "मोहरे बदलना"], ["Trading pawns", "प्यादे बदलना"], ["No trades at all", "कोई बदलाव नहीं"]], correct: 0, hint: ["Fewer pieces, bigger extra pawn.", "कम मोहरे, अतिरिक्त प्यादा ज़्यादा कीमती।"] } },
        ],
      },
      {
        id: "thinkFightBack",
        title: ["Behind? Make it hard", "पीछे हैं? मुश्किल बनाएँ"],
        sub: ["Threats, tricks and draws", "खतरे, चालाकी और ड्रॉ"],
        minutes: 4,
        xp: 20,
        blocks: [
          { say: { title: ["Don't give up.", "हार न मानें।"], body: ["When you're behind, keep pieces on, make threats, and look for draws: stalemate, perpetual check, or repetition.", "जब आप पीछे हों, मोहरे बोर्ड पर रखें, खतरे बनाएँ, और ड्रॉ ढूँढें: स्टेलमेट, लगातार शह, या दोहराव।"], fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1" } },
          { say: { title: ["Stalemate is a draw.", "स्टेलमेट ड्रॉ है।"], body: ["Black is not in check but has no legal move. It's a draw. Behind, aim for it; ahead, watch out for it.", "काले को शह नहीं है, पर कोई चाल नहीं बची। यह ड्रॉ है। पीछे हों तो इसे ढूँढें; आगे हों तो इससे बचें।"], fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1" } },
          { quiz: { title: ["Quick check.", "छोटा सवाल।"], body: ["You're a piece down. What's your best practical idea?", "आप एक मोहरा पीछे हैं। सबसे अच्छा व्यावहारिक विचार क्या है?"], fen: START_FEN, options: [["Keep pieces on and make threats", "मोहरे रखें और खतरे बनाएँ"], ["Trade everything", "सब कुछ बदल दें"], ["Resign straight away", "तुरंत हार मान लें"]], correct: 0, hint: ["Trades help the side that is ahead.", "बदलाव आगे वाले पक्ष की मदद करते हैं।"] } },
        ],
      },
    ],
  },
];

/** The track in `language` (Hindi or English; other languages get English). */
export function thinkTrack(language: string): ThinkUnit[] {
  lang = language === "hi" ? "hi" : "en";
  return UNITS.map((u) => ({
    id: u.id,
    title: say(u.title),
    sub: say(u.sub),
    lessons: u.lessons.map((d) => ({ id: d.id, unit: u.id, title: say(d.title), sub: say(d.sub), minutes: d.minutes, xp: d.xp, steps: build(d) })),
  }));
}

/** Lesson ids and XP. Keep in step with THINK_PATH in @chessschool/design (a test checks). */
export const THINK_LESSONS: readonly { id: string; xp: number }[] = UNITS.flatMap((u) => u.lessons.map((d) => ({ id: d.id, xp: d.xp })));

export const isThinkLesson = (id: string | undefined) => THINK_LESSONS.some((n) => n.id === id);

export function thinkLesson(id: string, language: string): ThinkLesson | null {
  if (!isThinkLesson(id)) return null;
  return thinkTrack(language).flatMap((u) => u.lessons).find((l) => l.id === id) ?? null;
}

/** The next unfinished track lesson after `id`, or null. */
export function thinkNext(id: string, completed: Record<string, string | undefined>, language: string): ThinkLesson | null {
  const all = thinkTrack(language).flatMap((u) => u.lessons);
  const i = all.findIndex((l) => l.id === id);
  return all.slice(i + 1).find((l) => !completed[l.id]) ?? null;
}
