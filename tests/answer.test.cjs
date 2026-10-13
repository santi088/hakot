const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const bundle = buildSync({
  entryPoints: [path.resolve(__dirname, "../frontend/Answer.jsx")],
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
});
const compiled = new Module(__filename + ".renderer", module);
compiled.filename = __filename;
compiled.paths = module.paths;
compiled._compile(bundle.outputFiles[0].text, __filename);
const Answer = compiled.exports.default;
const render = text => renderToStaticMarkup(React.createElement(Answer, { text }));

test("answers render headings, subheadings, paragraphs, lists and emphasis", () => {
  const html = render("## Registrar services\n\nA short **overview**.\n\n### Available services\n\n* Registration\n* **School records**\n\n### Steps\n\n1. Submit a request\n2. Wait for confirmation");
  assert.ok(html.includes("<h2>Registrar services</h2>"));
  assert.ok(html.includes("<h3>Available services</h3>"));
  assert.ok(html.includes("<p>A short <strong>overview</strong>.</p>"));
  assert.ok(html.includes("<ul>"));
  assert.ok(html.includes("<ol>"));
  assert.ok(html.includes("<strong>School records</strong>"));
  assert.ok(!html.includes("**"));
  assert.ok(!html.includes("##"));
});

test("answers render tables and nested requirement lists", () => {
  const html = render("| Program | Requirement |\n| --- | --- |\n| IT | 85% GWA |\n\n- Documents\n  - Report of grades");
  assert.ok(html.includes('class="answer-table"'));
  assert.ok(html.includes("<table>"));
  assert.ok(html.includes("<th>Requirement</th>"));
  assert.ok(html.includes("85% GWA"));
  assert.equal((html.match(/<ul>/g) || []).length, 2);
});

test("model HTML and unsafe links cannot execute", () => {
  const html = render('Safe text.\n\n<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[Click](javascript:alert%281%29)\n\n[University](https://example.edu)');
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("onerror"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes('href="https://example.edu"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes("Safe text."));
});