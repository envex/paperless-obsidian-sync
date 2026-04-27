import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function initCleanup(apiKey: string): void {
  client = new Anthropic({ apiKey });
}

export async function cleanupContent(content: string): Promise<string> {
  if (!client) return content;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: "You are an OCR text cleanup assistant. Fix OCR artifacts, correct obvious character recognition errors, normalize whitespace and line breaks, and fix broken words that were split across lines. Preserve the original meaning, structure, and all factual content exactly. Do not summarize, add commentary, or change any information. Return only the cleaned text.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : content;
}
