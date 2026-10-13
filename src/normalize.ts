// Normalize retrieval text only. Original questions still undergo all security checks
// and are supplied unchanged to the model; citations never use corrected source text.
const vocabulary = [
  "university", "makati", "scholarship", "scholarships", "requirement", "requirements",
  "registrar", "admission", "admissions", "enrollment", "medical", "dental", "clinic",
  "building", "campus", "office", "offices", "college", "colleges", "location",
  "locations", "computer", "information", "technology",
];
const explicitTypos: Record<string, string> = {
  umac: "UMak", umakk: "UMak", umka: "UMak", uamk: "UMak", umk: "UMak",
  wher: "where", wherre: "where", whre: "where", wht: "what",
  enrolment: "enrollment", enrolmnt: "enrollment", scholorship: "scholarship",
  scholorships: "scholarships", reqs: "requirements",
};

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a].flatMap((letter, i) => letter !== b[i] ? [i] : []);
    return differences.length === 1 || (differences.length === 2 &&
      differences[1] === differences[0] + 1 &&
      a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]]);
  }
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  let i = 0;
  while (i < shorter.length && shorter[i] === longer[i]) i++;
  return shorter.slice(i) === longer.slice(i + 1);
}

export function normalizeForRetrieval(question: string): string {
  const corrected = question.replace(/\bu[\s.-]+mak\b/gi, "UMak").replace(/\b[a-z]+\b/gi, word => {
    const lower = word.toLowerCase();
    if (lower === "umak") return "UMak";
    if (explicitTypos[lower]) return explicitTypos[lower];
    if (lower.length < 5 || vocabulary.includes(lower) || lower === "collage") return word;
    const matches = vocabulary.filter(candidate => oneEditApart(lower, candidate));
    return matches.length === 1 ? matches[0] : word;
  });
  return corrected.replace(/\buniversity\s+of\s+makati(?:\s*\(UMak\))?|\bUMak\b/gi,
    "University of Makati (UMak)");
}