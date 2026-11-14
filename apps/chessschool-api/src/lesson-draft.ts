import Anthropic from "@anthropic-ai/sdk";
import { checkLessonEdit } from "./course-admin";
import type { CourseDoc, CourseLessonDoc } from "./course-check";

/** What the admin asks for. Staff-written text only; no learner data is ever part of a brief. */
export type LessonBrief = { topic: string; level: "beginner" | "intermediate" | "advanced" };
export const LEVELS = new Set<LessonBrief["level"]>(["beginner", "intermediate", "advanced"]);

/** One prompt in, the model's lesson JSON (unchecked) out. Tests pass a fake; production calls the language model. */
export type LessonWriter = (prompt: string) => Promise<{ lesson: unknown; inputTokens: number; outputTokens: number }>;

const square = { type: "string", pattern: "^[a-h][1-8]$" } as const;
const squares = { type: "array", items: square } as const;
const pose = { type: "string", enum: ["idle", "wave", "thinking", "happy", "proud", "wow", "reading", "celebrate"] } as const;
const base = { pose, title: { type: "string" }, body: { type: "string" }, fen: { type: "string" } } as const;
const BASE_REQUIRED = ["kind", "pose", "title", "body", "fen"];
const step = (kind: string, props: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties: { kind: { type: "string", const: kind }, ...base, ...props },
  required: [...BASE_REQUIRED, ...required],
});

/** The course step format (see Step in @chessschool/chess), minus "game", which the editor rarely needs. */
export const LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    sub: { type: "string" },
    idea: { type: "string" },
    minutes: { type: "integer" },
    xp: { type: "integer" },
    steps: {
      type: "array",
      items: {
        anyOf: [
          step("say", { highlight: squares }, []),
          step("tap", { targets: squares, hint: { type: "string" } }, ["targets", "hint"]),
          step(
            "move",
            {
              goal: {
                anyOf: [
                  { type: "object", additionalProperties: false, properties: { type: { type: "string", const: "exact" }, from: square, to: square }, required: ["type", "from", "to"] },
                  { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["capture", "check", "mate", "promote"] } }, required: ["type"] },
                ],
              },
              hint: { type: "string" },
              hintSquares: squares,
            },
            ["goal", "hint"],
          ),
          step("stars", { stars: squares, hint: { type: "string" } }, ["stars", "hint"]),
          step(
            "choice",
            {
              options: { type: "array", items: { type: "object", additionalProperties: false, properties: { label: { type: "string" }, correct: { type: "boolean" } }, required: ["label", "correct"] } },
              hint: { type: "string" },
            },
            ["options", "hint"],
          ),
          step("line", { moves: { type: "array", items: { type: "string", pattern: "^[a-h][1-8][a-h][1-8][qrbn]?$" } }, hint: { type: "string" }, mateEnds: { type: "boolean" } }, ["moves", "hint"]),
        ],
      },
    },
  },
  required: ["title", "sub", "idea", "minutes", "xp", "steps"],
} as const;

const RULES = `You write lessons for ChessSchool, a chess course for children and adults. Return one lesson as JSON in the given schema.
How lessons work (a validator plays every step the way a learner would; a lesson that can't be played is rejected):
- 6 to 10 steps. Start with a "say" step, end with a short "say" or "choice". Mix explanations with practice.
- Every step has a legal FEN with exactly one king per side; the learner is always White and it is White to move.
- "move": the goal is met by the learner's move. With an "exact" goal, from/to must be a legal White move. With capture/check/mate/promote, at least one legal move must meet it and at least one must not.
- "line": UCI moves alternating learner, reply, learner..., odd count, learner first and last; every move legal in turn. Set mateEnds only when the last move is checkmate. Keep lines short (3 or 5 moves).
- "choice": two to four options, exactly one with correct true.
- "tap": targets are the squares the learner should tap. "stars": a board with one White piece (plus kings only if needed) that can reach every star in turn.
- Plain, warm, short sentences (title up to 60 characters, body up to 300). Speak to the learner as "you". No names of real people.
- minutes 3 to 10, xp 10 to 30, idea is one short sentence (under 120 characters) with the key takeaway.`;

export function lessonPrompt(doc: CourseDoc, lesson: CourseLessonDoc, brief: LessonBrief): string {
  const unit = doc.units.find((u) => u.id === lesson.unit);
  return [
    RULES,
    `Unit: ${unit?.title ?? lesson.unit} (${unit?.sub ?? ""}). Level: ${brief.level}.`,
    `Topic, from the course editor: ${brief.topic}`,
    `The lesson currently in this slot, for the format and tone (write a new one for the topic above):\n${JSON.stringify({ title: lesson.title, sub: lesson.sub, steps: lesson.steps })}`,
  ].join("\n\n");
}

export type DraftResult = { lesson: CourseLessonDoc; errors: string[]; attempts: number; inputTokens: number; outputTokens: number };

/**
 * Asks the writer for a lesson in `lesson`'s slot (its id and unit are kept), checks it with the
 * seed script's validator, and asks once more with the errors if it fails. Never publishes.
 */
export async function draftLesson(doc: CourseDoc, lesson: CourseLessonDoc, brief: LessonBrief, write: LessonWriter): Promise<DraftResult> {
  const prompt = lessonPrompt(doc, lesson, brief);
  let inputTokens = 0;
  let outputTokens = 0;
  let draft: CourseLessonDoc | null = null;
  let errors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const retry = draft ? `\n\nYour previous draft:\n${JSON.stringify(draft)}\n\nThe validator rejected it:\n- ${errors.join("\n- ")}\n\nReturn a corrected lesson that fixes every error.` : "";
    const out = await write(prompt + retry);
    inputTokens += out.inputTokens;
    outputTokens += out.outputTokens;
    const raw = out.lesson && typeof out.lesson === "object" ? (out.lesson as Partial<CourseLessonDoc>) : {};
    draft = { ...raw, id: lesson.id, unit: lesson.unit } as CourseLessonDoc;
    const checked = checkLessonEdit(doc, draft);
    errors = checked.ok ? [] : checked.errors;
    if (!errors.length) return { lesson: draft, errors, attempts: attempt, inputTokens, outputTokens };
  }
  return { lesson: draft!, errors, attempts: 2, inputTokens, outputTokens };
}

export const LESSON_MODEL = "claude-opus-5-5";

/** The production writer (ANTHROPIC_API_KEY). Null without a key, which turns "Draft with AI" off. */
export function anthropicLessonWriter(apiKey: string | undefined): LessonWriter | null {
  if (!apiKey) return null;
  // Two attempts must fit the API's 180 s function limit.
  const client = new Anthropic({ apiKey, timeout: 85_000, maxRetries: 0 });
  return async (prompt) => {
    const res = await client.beta.messages.create({
      model: LESSON_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: { type: "json_schema", schema: LESSON_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: prompt }],
    });
    const usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`lesson draft stopped: ${res.stop_reason}`);
    const text = res.content.find((b) => b.type === "text");
    return { lesson: text ? (JSON.parse(text.text) as unknown) : null, ...usage };
  };
}
