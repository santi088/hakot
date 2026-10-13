import { Chunk } from "./knowledge";

// Reformat deterministically from the original hierarchy; never infer rooms or floors.
export function reformatCampusMap(content: string, sourceTitle = "CAMPUS-MAP.txt"): Chunk[] {
  let building = "";
  let floor = "";
  let wing = "";
  const chunks: Chunk[] = [];
  for (const raw of content.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "").split("\n")) {
    const line = raw.trim();
    if (!line || line === "CAMPUS MAP") continue;
    const item = line.match(/^[\u25cf\u25cb\u2022\u27a2*-]\s+(.+)$/);
    if (item) {
      if (!building || !floor) throw new Error("Campus map entry has no building/floor: " + line);
      const locator = [building, floor, wing].filter(Boolean).join(" / ");
      chunks.push({
        title: sourceTitle,
        locator,
        text: item[1] + " is located in " + [building, floor, wing].filter(Boolean).join(", ") + ".",
      });
    } else if (line === line.toUpperCase() && /[A-Z]/.test(line)) {
      building = line;
      floor = "";
      wing = "";
    } else if (/^[A-Z]\.\s/.test(line)) {
      wing = line;
    } else {
      floor = line;
      wing = "";
    }
  }
  if (!chunks.length) throw new Error("Campus map has no location entries");
  return chunks;
}