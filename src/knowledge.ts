import path from "path";

export interface Chunk {
  text: string;
  title: string;
  locator?: string;
}
export interface StoredChunk extends Chunk {
  embedding: number[];
}
export interface SearchResult extends Chunk {
  score: number;
}
export const knowledgePath = path.resolve(process.env.KNOWLEDGE_PATH || "knowledge.json");