/**
 * Self-host model plumbing.
 *
 * Upstream routes every LLM/embedding call through the Vercel AI Gateway
 * (model strings like "anthropic/claude-sonnet-4-5" + "openai/text-embedding-3-large").
 * A self-hosted box has no Vercel credit, so both are redirected here to
 * OpenAI-compatible + Gemini endpoints configured by env.
 *
 * Env:
 *   LLM_BASE_URL  default https://opencode.ai/zen/go/v1
 *   LLM_API_KEY   required
 *   LLM_MODEL     default deepseek-v4.1-flash
 *   EMBEDDING_API_KEY / GEMINI_API_KEY  required for memory tools
 *   EMBEDDING_MODEL default gemini-embedding-001 (must emit 1024 dims)
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const provider = createOpenAICompatible({
  name: "selfhost-llm",
  baseURL: process.env.LLM_BASE_URL ?? "https://opencode.ai/zen/go/v1",
  apiKey: process.env.LLM_API_KEY ?? "missing",
  // OpenCode Go refuses requests without this header (routing + prompt cache).
  headers: { "x-opencode-session": process.env.LLM_SESSION ?? "trustclaw-selfhost" },
});

/** Any anthropic model the UI picked collapses onto the configured self-host model. */
export function resolveChatModel(_hint?: string) {
  return provider.chatModel(process.env.LLM_MODEL ?? "deepseek-v4.1-flash");
}

const EMBED_DIMS = 1024;

export async function embedText(value: string): Promise<number[]> {
  const key = process.env.EMBEDDING_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) throw new Error("EMBEDDING_API_KEY/GEMINI_API_KEY is not set");
  const model = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: value }] },
        outputDimensionality: EMBED_DIMS,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`embedding failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length !== EMBED_DIMS) {
    throw new Error(`embedding bad dims: ${values?.length ?? 0}`);
  }
  return values;
}
