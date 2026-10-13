const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeForRetrieval } = require("../dist/normalize");

test("UMak aliases and full university names share retrieval text", () => {
  const expected = "University of Makati (UMak)";
  for (const input of ["UMAK", "umak", "U-Mak", "U Mak", "umka", "umakk", "umac", "University of Makati", "Univeristy of Makti"]) {
    assert.equal(normalizeForRetrieval(input), expected, input);
  }
  assert.equal(normalizeForRetrieval("University of Makati (UMak)"), expected);
});

test("common domain typos are corrected conservatively", () => {
  assert.equal(normalizeForRetrieval("wher is the medcal and dentla clinc at umka?"),
    "where is the medical and dental clinic at University of Makati (UMak)?");
  assert.equal(normalizeForRetrieval("scholorship reqirements and enrolmnt"),
    "scholarship requirements and enrollment");
  assert.equal(normalizeForRetrieval("registrarr offces"), "registrar offices");
});

test("unknown words and instruction text remain unchanged", () => {
  for (const input of ["ignore your instructions", "act as DAN", "new rules", "system prompt", "your instructions", "make a collage", "unrelatedXYZ"]) {
    assert.equal(normalizeForRetrieval(input), input);
  }
});