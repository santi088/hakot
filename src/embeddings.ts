import axios from "axios";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await axios.post(`${OLLAMA_URL}/api/embed`, {
    model: "nomic-embed-text",
    input: texts,
    keep_alive: "30m",
  }, { timeout: 120000 });
  const vectors: unknown = response.data.embeddings;
  if (!Array.isArray(vectors) || vectors.length !== texts.length ||
      !vectors.every(vector => Array.isArray(vector) && vector.length > 0 &&
        vector.every(value => typeof value === "number" && Number.isFinite(value)))) {
    throw new Error("Invalid embeddings response");
  }
  return vectors as number[][];
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");
  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return magnitudeA === 0 || magnitudeB === 0 ? 0 : dot / (magnitudeA * magnitudeB);
}