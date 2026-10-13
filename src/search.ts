import fs from "fs";
import { normalizeForRetrieval } from "./normalize";
import { AsyncCache } from "./cache";
import { cosine, embed } from "./embeddings";
import { knowledgePath, SearchResult, StoredChunk } from "./knowledge";

function loadKnowledge(): StoredChunk[] {
  let content: string;
  try {
    content = fs.readFileSync(knowledgePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn("No knowledge.json found. Ingest documents and restart the server.");
      return [];
    }
    throw error;
  }
  const data: unknown = JSON.parse(content);
  if (!Array.isArray(data) || !data.every(chunk =>
    chunk && typeof chunk.text === "string" && typeof chunk.title === "string" &&
    (chunk.locator === undefined || typeof chunk.locator === "string") &&
    Array.isArray(chunk.embedding) && chunk.embedding.length > 0 &&
    chunk.embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value)),
  )) throw new Error("Invalid knowledge.json");
  return data as StoredChunk[];
}
const knowledge = loadKnowledge();
const queries = new AsyncCache<SearchResult[]>();


function normalizedName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function exactLocationMatches(question: string, results: SearchResult[]): SearchResult[] {
  if (!/\b(?:where|located|location|nasaan|saan)\b/i.test(question)) return results;
  const query = " " + normalizedName(question) + " ";
  const named = results.flatMap(result => {
    if (result.title !== "CAMPUS-MAP.txt") return [];
    const name = result.text.split(" is located in ")[0].replace(/\([^)]*\)/g, "").trim();
    const normalized = normalizedName(name);
    return normalized && query.includes(" " + normalized + " ") ? [{ result, normalized }] : [];
  });
  if (!named.length) return results;
  // "Clinic" may match the words in "Medical and Dental Clinic"; keep the
  // full named entity, including all of its explicitly documented locations.
  return named.filter(item => !named.some(other =>
    other.normalized !== item.normalized &&
    (" " + other.normalized + " ").includes(" " + item.normalized + " "),
  )).map(item => item.result);
}
export async function search(question: string, k = 3): Promise<SearchResult[]> {
  if (knowledge.length === 0 || k <= 0) return [];
  const retrievalQuestion = normalizeForRetrieval(question);
  const matches = await queries.get(retrievalQuestion, async () => {
    const [questionVector] = await embed([retrievalQuestion]);
    const ranked = knowledge.map(chunk => ({
      text: chunk.text,
      title: chunk.title,
      ...(chunk.locator ? { locator: chunk.locator } : {}),
      score: cosine(questionVector, chunk.embedding),
    })).sort((a, b) => b.score - a.score);
    return exactLocationMatches(retrievalQuestion, ranked);
  });
  return matches.slice(0, k).map(result => ({ ...result }));
}

// Re-tune against real document score distributions before trusting 0.6.
export function hasReliableMatch(results: Array<{ score: number }>): boolean {
  return results.length > 0 && results[0].score >= 0.6;
}