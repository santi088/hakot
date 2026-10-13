import axios from "axios";
import { createHash } from "crypto";
import { AsyncCache } from "./cache";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const responses = new AsyncCache<string>();

export async function callLLM(
  systemPrompt: string,
  userContent: string,
  model = "qwen3.5:4b",
): Promise<string> {
  // Include the complete security prompt, source text, model, and endpoint.
  // A changed prompt/source cannot reuse a previous response.
  const key = createHash("sha256").update(JSON.stringify([
    OLLAMA_URL, model, systemPrompt, userContent,
  ])).digest("hex");
  return responses.get(key, async () => {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model,
      system: systemPrompt,
      prompt: userContent,
      stream: false,
      think: false,
      keep_alive: "30m",
      options: { temperature: 0 },
    }, { timeout: 120000 });
    if (typeof response.data.response !== "string") throw new Error("Invalid generation response");
    // Raw responses are guarded by askRAG on every request, including cache hits.
    return response.data.response;
  });
}