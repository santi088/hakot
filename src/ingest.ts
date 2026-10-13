import fs from "fs";
import path from "path";
import { embed } from "./embeddings";
import { reformatCampusMap } from "./campus-map";
import { Chunk, knowledgePath } from "./knowledge";

type DocumentFormat = "auto" | "directory" | "narrative";

const BULLET = /^\s*(?:[-*+\u2022\u25cf\u25cb\u27a2\u25aa\u25a0]|\d+[.)])\s/;

interface Section {
  start: number;
  locator: string;
  context?: string;
}

function splitSections(lines: string[], title: string, sections: Section[]): Chunk[] {
  return sections.flatMap((section, i) => {
    const body = lines.slice(section.start, sections[i + 1]?.start ?? lines.length).join("\n").trim();
    if (!body || body === section.locator) return [];
    return [{
      title, locator: section.locator,
      text: section.context ? section.context + "\n" + body : body,
    }];
  });
}

// These supplied documents have nested structures that a flat heading heuristic
// cannot safely separate. Keep parent context and complete requirement lists.
function suppliedDocumentChunks(lines: string[], title: string): Chunk[] | undefined {
  const documentTitle = lines.find(line => line.trim())?.trim();
  if (documentTitle === "CAMPUS MAP") {
    return reformatCampusMap(lines.join("\n"));
  }
  if (documentTitle === "COLLEGE REQUIREMENTS") {
    const college = lines.find(line => /^College of /.test(line))?.trim() || documentTitle;
    const sections: Section[] = [{ start: 0, locator: college + " / Program offerings" }];
    let requirements = false;
    for (let i = 1; i < lines.length; i++) {
      const text = lines[i].trim();
      if (text === "Program Requirements:") requirements = true;
      if (requirements && /^\d+\. (?:Bachelor|Diploma)\b/.test(text)) {
        sections.push({ start: i, locator: college + " / " + text.replace(/^\d+\. /, ""), context: college });
      } else if (text === "OTHER COLLEGES AVAILABLE") {
        requirements = false;
        sections.push({ start: i, locator: text });
      }
    }
    return splitSections(lines, title, sections);
  }
  if (documentTitle === "SCHOLARSHIPS") {
    const sections: Section[] = [{ start: 0, locator: "Overview" }];
    let audience = "";
    let faq = false;
    const descriptionStart = /^(?:Awarded\b|This\b|The granting\b|The University awards\b|Unified Scholarship\b|.+?Token Fee Exemption Grant is awarded\b)/i;
    for (let i = 1; i < lines.length; i++) {
      const text = lines[i].trim();
      if (/^FOR (?:INCOMING|UNDERGRADUATES|GRADUATES)\b/.test(text) || text === "FREQUENTLY ASKED QUESTIONS") {
        audience = text;
        faq = text === "FREQUENTLY ASKED QUESTIONS";
        sections.push({ start: i, locator: text });
        continue;
      }
      if (faq) {
        if (/^\d+\.\s/.test(text)) {
          sections.push({ start: i, locator: audience + " / " + text.replace(/^\d+\.\s/, ""), context: audience });
        }
        continue;
      }
      if (text === "Basic Requirements" || text === "Application Process") {
        sections.push({ start: i, locator: text });
        continue;
      }
      const candidate = text.replace(/^\d+\.\s*/, "");
      if (!/^[A-Z]/.test(candidate) || /^(?:Requirements\b|Step\b)/.test(candidate) ||
          /[.!?;:,]$/.test(candidate) || candidate.length > 110) continue;
      let heading = candidate;
      let after = i + 1;
      // Two grant titles in the source wrap onto a second line.
      if (/(?:Sangguniang|Teachers and)$/.test(candidate)) {
        heading += " " + (lines[after]?.trim() || "");
        after++;
      }
      if (!descriptionStart.test(lines[after]?.trim() || "")) continue;
      sections.push({ start: i, locator: [audience, heading].filter(Boolean).join(" / "), context: audience || undefined });
      i = after - 1;
    }
    return splitSections(lines, title, sections);
  }
  if (documentTitle === "UMAK OFFICES") {
    const sections: Section[] = [];
    for (let i = 1; i < lines.length; i++) {
      const text = lines[i].trim();
      const next = lines.slice(i + 1).find(line => line.trim()) || "";
      if (isHeading(lines[i]) && text.split(/\s+/).length >= 2 && !/^[A-Z]\.\s/.test(text) &&
          /^\s*[-*+\u2022\u25cf\u25cb\u27a2]\s/.test(next)) {
        sections.push({ start: i, locator: text });
      }
    }
    return splitSections(lines, title, sections);
  }
  return undefined;
}


function isHeading(line: string): boolean {
  const text = line.trim();
  return line === line.trimStart() && text.length > 0 && text.length <= 100 &&
    !BULLET.test(text) && !/[.!?;:,]$/.test(text) && /^[A-Z#]/.test(text);
}

function narrativeChunks(content: string, title: string, locator?: string): Chunk[] {
  const chunks: Chunk[] = [];
  let pending = "";
  const flush = () => {
    if (pending.length >= 80) chunks.push({ text: pending, title, ...(locator ? { locator } : {}) });
    pending = "";
  };
  for (const paragraph of content.split(/\n\s*\n/)) {
    const text = paragraph.replace(/\s+/g, " ").trim();
    if (!text) continue;
    // A sentence longer than 600 characters stays intact.
    const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [text];
    for (const sentence of sentences) {
      const part = sentence.trim();
      if (!part) continue;
      if (pending && pending.length + part.length + 1 > 600) flush();
      pending = pending ? pending + " " + part : part;
    }
    flush();
  }
  flush();
  return chunks;
}

export function chunkFile(content: string, title: string, format: DocumentFormat = "auto"): Chunk[] {
  const normalized = content.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n");
  if (format === "auto") {
    const supplied = suppliedDocumentChunks(lines, title);
    if (supplied) return supplied;
  }
  const headings = lines.filter(isHeading);
  const directory = format === "directory" ||
    (format === "auto" && headings.length >= 2 && lines.some(line => BULLET.test(line)));
  if (directory) {
    const chunks: Chunk[] = [];
    let heading: string | undefined;
    let block: string[] = [];
    const flush = () => {
      if (heading && block.some(line => line.trim())) {
        chunks.push({ title, locator: heading, text: [heading, ...block].join("\n").trim() });
      }
    };
    for (const line of lines) {
      if (isHeading(line)) {
        flush();
        heading = line.trim().replace(/^#{1,6}\s+/, "");
        block = [];
      } else {
        block.push(line);
      }
    }
    flush();
    return chunks;
  }
  // Preserve explicit page markers; never invent page numbers.
  const chunks: Chunk[] = [];
  let locator: string | undefined;
  let block: string[] = [];
  for (const line of lines) {
    const page = line.trim().match(/^(?:page|p\.)\s+(\d+)$/i);
    if (page) {
      chunks.push(...narrativeChunks(block.join("\n"), title, locator));
      block = [];
      locator = line.trim();
    } else block.push(line);
  }
  chunks.push(...narrativeChunks(block.join("\n"), title, locator));
  return chunks;
}

export async function ingest(filePaths: string | string[], format: DocumentFormat = "auto"): Promise<void> {
  const inputs = Array.isArray(filePaths) ? filePaths : [filePaths];
  const paths = inputs.flatMap(input => fs.statSync(input).isDirectory()
    ? fs.readdirSync(input).filter(name => /\.txt$/i.test(name)).sort().map(name => path.join(input, name))
    : [input]);
  if (paths.length === 0) throw new Error("No text documents found");
  const chunks = paths.flatMap(filePath => {
    const content = fs.readFileSync(filePath, "utf8");
    if (format === "auto" && /^CAMPUS MAP\r?\n/.test(content.trimStart())) {
      const passages = reformatCampusMap(content, path.basename(filePath));
      fs.mkdirSync(path.resolve("generated"), { recursive: true });
      fs.writeFileSync(path.resolve("generated/CAMPUS-MAP.reformatted.txt"),
        passages.map(chunk => chunk.text).join("\n\n") + "\n");
      const preparedPath = path.resolve("umak_campus_map_chunks.jsonl");
      fs.writeFileSync(preparedPath, passages.map(chunk => JSON.stringify(chunk)).join("\n") + "\n");
      // Embed the prepared passages while retaining original filename/locators.
      return fs.readFileSync(preparedPath, "utf8").trim().split("\n").map(line => JSON.parse(line) as Chunk);
    }
    return chunkFile(content, path.basename(filePath, path.extname(filePath)), format);
  });
  if (chunks.length === 0) throw new Error("No usable document chunks found");
  const embeddings = await embed(chunks.map(chunk => chunk.text));
  fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
  fs.writeFileSync(knowledgePath, JSON.stringify(chunks.map((chunk, i) => ({
    ...chunk, embedding: embeddings[i],
  })), null, 2));
  console.log(`Wrote ${chunks.length} chunks to ${knowledgePath}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const formatArg = args.find(arg => arg.startsWith("--format="));
  const format = (formatArg?.slice("--format=".length) || "auto") as DocumentFormat;
  const paths = args.filter(arg => !arg.startsWith("--format="));
  if (!paths.length || !["auto", "directory", "narrative"].includes(format)) {
    console.error("Usage: npm run ingest -- [--format=auto|directory|narrative] file.txt [more.txt]");
    process.exitCode = 1;
  } else {
    ingest(paths, format).catch(error => { console.error(error); process.exitCode = 1; });
  }
}