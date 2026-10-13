const { test } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { AsyncCache } = require("../dist/cache");
const { callLLM } = require("../dist/llm");

test("cache coalesces exact requests, expires, and bounds its entries", async () => {
  let now = 0;
  let calls = 0;
  const cache = new AsyncCache(2, 100, () => now);
  const create = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get("a", create), cache.get("a", create)]), [1, 1]);
  await cache.get("b", create);
  assert.equal(await cache.get("a", create), 1);
  await cache.get("c", create); // b is least recently used.
  assert.equal(await cache.get("b", create), 4);
  now = 101;
  assert.equal(await cache.get("b", create), 5);
});

test("cache failures are retried and never served as successful results", async () => {
  const cache = new AsyncCache();
  await assert.rejects(cache.get("failed", async () => { throw new Error("Ollama unavailable"); }));
  assert.equal(await cache.get("failed", async () => "recovered"), "recovered");
});

test("model cache includes complete prompt, sources, and model", async () => {
  const originalPost = axios.post;
  let calls = 0;
  axios.post = async () => ({ data: { response: "answer-" + ++calls } });
  try {
    assert.equal(await callLLM("security-one", "sources-one"), "answer-1");
    assert.equal(await callLLM("security-one", "sources-one"), "answer-1");
    assert.equal(await callLLM("security-two", "sources-one"), "answer-2");
    assert.equal(await callLLM("security-one", "sources-two"), "answer-3");
    assert.equal(await callLLM("security-one", "sources-one", "another-model"), "answer-4");
    assert.equal(calls, 4);
  } finally { axios.post = originalPost; }
});

test("cached model answers still pass the current output guard on every request", async () => {
  const retrieval = require("../dist/search");
  const rag = require("../dist/rag");
  const originalSearch = retrieval.search;
  const originalPost = axios.post;
  const originalKey = process.env.API_KEY;
  const originalOpenaiKey = process.env.OPENAI_API_KEY;
  let calls = 0;
  try {
    delete process.env.API_KEY;
    delete process.env.OPENAI_API_KEY;
    retrieval.search = async () => [{ title: "Test source", locator: "Test section", text: "test-cache-secret", score: 1 }];
    axios.post = async () => { calls++; return { data: { response: "test-cache-secret" } }; };
    assert.equal((await rag.askRAG("cache guard regression question")).answer, "test-cache-secret");
    process.env.API_KEY = "test-cache-secret";
    const guarded = await rag.askRAG("cache guard regression question");
    assert.equal(calls, 1);
    assert.equal(guarded.answer, rag.REFUSAL);
    assert.deepEqual(guarded.sources, []);
  } finally {
    retrieval.search = originalSearch;
    axios.post = originalPost;
    if (originalKey === undefined) delete process.env.API_KEY; else process.env.API_KEY = originalKey;
    if (originalOpenaiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenaiKey;
  }
});