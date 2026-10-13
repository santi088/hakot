const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const embeddings = require("../dist/embeddings");
const knowledgePath = require("../dist/knowledge").knowledgePath;
const originalRead = fs.readFileSync;
const originalEmbed = embeddings.embed;
fs.readFileSync = function (file, ...args) {
  if (file === knowledgePath) return JSON.stringify([
    { title: "CAMPUS-MAP.txt", locator: "Admin / Ground", text: "Medical and Dental Clinic (MDC) is located in ADMIN BUILDING, Ground Floor.", embedding: [1, 0] },
    { title: "CAMPUS-MAP.txt", locator: "HPSB / Eleventh", text: "Clinic is located in HPSB, Eleventh Floor.", embedding: [1, 0] },
    { title: "CAMPUS-MAP.txt", locator: "Admin / Mezzanine", text: "Office of the University Registrar (OUR) is located in ADMIN BUILDING, Mezzanine.", embedding: [1, 0] },
    { title: "UMAK-OFFICES", locator: "Medical and Dental Office", text: "Provides health services.", embedding: [1, 0] },
  ]);
  return originalRead.call(this, file, ...args);
};
const { search } = require("../dist/search");
fs.readFileSync = originalRead;

test("named locations cannot inherit a generic Clinic's location", async () => {
  embeddings.embed = async () => [[1, 0]];
  try {
    const results = await search("Where is the Medical and Dental Clinic located?");
    assert.equal(results.length, 1);
    assert.equal(results[0].locator, "Admin / Ground");
    assert.equal(results[0].title, "CAMPUS-MAP.txt");
    results[0].text = "changed by caller";
    assert.ok((await search("Where is the Medical and Dental Clinic located?"))[0].text.startsWith("Medical and Dental Clinic"));
  } finally { embeddings.embed = originalEmbed; }
});

test("multiple explicitly named locations remain available for compound questions", async () => {
  embeddings.embed = async () => [[1, 0]];
  try {
    const results = await search("Where are the Medical and Dental Clinic and Office of the University Registrar?");
    assert.deepEqual(results.map(result => result.locator), ["Admin / Ground", "Admin / Mezzanine"]);
    assert.equal((await search("What services are available?")).length, 3);
  } finally { embeddings.embed = originalEmbed; }
});