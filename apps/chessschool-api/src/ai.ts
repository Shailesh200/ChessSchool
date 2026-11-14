import Anthropic from "@anthropic-ai/sdk";

/**
 * Language-model providers for the game coach, tried in order: Cloudflare Workers AI and Groq
 * (free tiers) first, then the paid fallback. Each gets only the prompt the coach builds from
 * engine facts (moves and squares); no names, ids or typed text ever reach them.
 * `complete` returns null on any failure so the chain moves on.
 */
export type AiProvider = { name: string; complete: (system: string, prompt: string) => Promise<string | null> };

const TIMEOUT_MS = 15_000;
const MAX_TOKENS = 700;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) console.warn(`[ai] ${new URL(url).host} answered ${res.status}`);
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.warn(`[ai] ${new URL(url).host} failed: ${(err as Error).name}`);
    return null;
  }
}

export function workersAi(accountId: string, token: string, model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"): AiProvider {
  return {
    name: "workers-ai",
    complete: async (system, prompt) => {
      const d = (await postJson(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, { Authorization: `Bearer ${token}` }, {
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        max_tokens: MAX_TOKENS,
      })) as { result?: { response?: unknown } } | null;
      return typeof d?.result?.response === "string" ? d.result.response : null;
    },
  };
}

export function groq(key: string, model = "openai/gpt-oss-120b"): AiProvider {
  return {
    name: "groq",
    complete: async (system, prompt) => {
      const d = (await postJson("https://api.groq.com/openai/v1/chat/completions", { Authorization: `Bearer ${key}` }, {
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        // A reasoning model: keep the thinking short and leave room for the answer.
        reasoning_effort: "low",
        max_tokens: MAX_TOKENS * 2,
      })) as { choices?: { message?: { content?: unknown } }[] } | null;
      const text = d?.choices?.[0]?.message?.content;
      return typeof text === "string" ? text : null;
    },
  };
}

export function anthropic(key: string, model = "claude-haiku-5-5"): AiProvider {
  const client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 });
  return {
    name: "anthropic",
    complete: async (system, prompt) => {
      try {
        const msg = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          system,
          messages: [{ role: "user", content: prompt }],
        });
        // Token counts only, for keeping an eye on spend.
        console.info(`[ai] ${model} in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}`);
        if (msg.stop_reason === "refusal") return null;
        return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("") || null;
      } catch (err) {
        if (err instanceof Anthropic.APIError) console.warn(`[ai] ${model} failed: ${err.status ?? "network"}`);
        return null;
      }
    },
  };
}

/** The chain from whichever keys are set; empty when none are (the coach route then answers 503). */
export function providersFromEnv(env: Record<string, string | undefined>): AiProvider[] {
  const out: AiProvider[] = [];
  if (env.R2_ACCOUNT_ID && env.CF_AI_TOKEN) out.push(workersAi(env.R2_ACCOUNT_ID, env.CF_AI_TOKEN));
  if (env.GROQ_API_KEY) out.push(groq(env.GROQ_API_KEY));
  if (env.ANTHROPIC_API_KEY) out.push(anthropic(env.ANTHROPIC_API_KEY));
  return out;
}
